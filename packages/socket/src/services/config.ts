import { EXAMPLE_QUIZZ } from "@rahoot/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzMeta,
  QuizzWithId,
} from "@rahoot/common/types/game"
import { isArchived } from "@rahoot/common/utils/folders"
import {
  formatGuestQuizId,
  GUEST_FOLDER,
  parseGuestQuizId,
} from "@rahoot/common/utils/guest"
import { quizzValidator } from "@rahoot/common/validators/quizz"
import { writeFileAtomic } from "@rahoot/socket/utils/atomic-write"
import { collectUploadRefs } from "@rahoot/socket/utils/collect-media-refs"
import { normalizeFilename } from "@rahoot/socket/utils/game"
import { hashPassword } from "@rahoot/socket/utils/password"
import fs from "fs"
import path, { resolve } from "path"
import { z } from "zod"

function safeId(id: string): string {
  const sanitized = path.basename(id).replace(/[^a-z0-9_.-]/giu, "")

  if (!sanitized) {
    throw new Error("ID invalide")
  }

  return sanitized
}

const inContainerPath = process.env.CONFIG_PATH

const getPath = (path: string = "") =>
  inContainerPath
    ? resolve(inContainerPath, path)
    : resolve(process.cwd(), "../../config", path)

// Répertoire de la bibliothèque de quiz : celle de l'admin par défaut, celle
// d'un compte invité si `owner` est fourni. La séparation est PHYSIQUE
// (guests/<id>/quizz) : un scope ne peut pas lire les fichiers d'un autre.
const quizzDir = (owner?: string) =>
  owner ? `guests/${safeId(owner)}/quizz` : "quizz"

const ADMIN_SCOPE = "__admin__"

// Id de compte invité dérivé du nom : lisible sur disque (guests/pierre) et
// stable — l'unicité est garantie par le rejet des doublons à la création.
const guestIdFromName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/[^a-z0-9-]/gu, "")
    .slice(0, 24)

export type GuestAccount = {
  id: string
  name: string
  passwordHash: string
  createdAt: number
}

const isGuestAccount = (value: unknown): value is GuestAccount => {
  const guest = value as GuestAccount | null

  return (
    Boolean(guest) &&
    typeof guest?.id === "string" &&
    typeof guest.name === "string" &&
    typeof guest.passwordHash === "string"
  )
}

class Config {
  // Un cache par bibliothèque (admin + un par invité), invalidé à chaque écriture.
  private static quizzCache = new Map<string, QuizzWithId[]>()

  static init() {
    const isConfigFolderExists = fs.existsSync(getPath())

    if (!isConfigFolderExists) {
      fs.mkdirSync(getPath())
    }

    const isGameConfigExists = fs.existsSync(getPath("game.json"))

    if (!isGameConfigExists) {
      writeFileAtomic(
        getPath("game.json"),
        JSON.stringify(
          {
            managerPassword: "PASSWORD",
          },
          null,
          2,
        ),
      )
    }

    const isQuizzExists = fs.existsSync(getPath("quizz"))

    if (!isQuizzExists) {
      fs.mkdirSync(getPath("quizz"))

      writeFileAtomic(
        getPath("quizz/example.json"),
        JSON.stringify(EXAMPLE_QUIZZ, null, 2),
      )
    }
  }

  static game() {
    const isExists = fs.existsSync(getPath("game.json"))

    if (!isExists) {
      throw new Error("Game config not found")
    }

    try {
      const config = fs.readFileSync(getPath("game.json"), "utf-8")

      return JSON.parse(config)
    } catch (error) {
      console.error("Failed to read game config:", error)
    }

    return {}
  }

  // Migration transparente legacy → hash : appelée après une auth réussie sur un
  // mot de passe en clair personnalisé, pour ne plus jamais le stocker lisible.
  static migratePasswordToHash(hash: string): void {
    const filePath = getPath("game.json")

    if (!fs.existsSync(filePath)) {
      return
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))

    delete raw.managerPassword
    raw.managerPasswordHash = hash

    writeFileAtomic(filePath, JSON.stringify(raw, null, 2))
  }

  static quizzMeta(owner?: string) {
    return Config.quizz(owner).map(
      ({
        id,
        subject,
        publicName,
        description,
        folder,
        tags,
        salonImage,
        listingImage,
      }) => ({
        id,
        subject,
        publicName,
        description,
        folder,
        tags,
        salonImage,
        listingImage,
      }),
    )
  }

  static quizzById(id: string, owner?: string) {
    const cached = Config.quizzCache
      .get(owner ?? ADMIN_SCOPE)
      ?.find((q) => q.id === id)

    if (cached) {
      return cached
    }

    const filePath = getPath(`${quizzDir(owner)}/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    const data = fs.readFileSync(filePath, "utf-8")
    const result = quizzValidator.safeParse(JSON.parse(data))

    if (!result.success) {
      throw new Error(`Invalid quizz "${id}"`)
    }

    return { id, ...result.data }
  }

  static quizz(owner?: string) {
    const scope = owner ?? ADMIN_SCOPE
    const cached = Config.quizzCache.get(scope)

    if (cached) {
      return cached
    }

    const dir = quizzDir(owner)
    const isExists = fs.existsSync(getPath(dir))

    if (!isExists) {
      return []
    }

    try {
      const files = fs
        .readdirSync(getPath(dir))
        .filter((file) => file.endsWith(".json"))

      const quizz: QuizzWithId[] = files.flatMap((file) => {
        const data = fs.readFileSync(getPath(`${dir}/${file}`), "utf-8")
        const id = file.replace(".json", "")

        const result = quizzValidator.safeParse(JSON.parse(data))

        if (!result.success) {
          console.warn(`Invalid quizz config "${file}":`, result.error.issues)

          return []
        }

        return [{ id, ...result.data }]
      })

      Config.quizzCache.set(scope, quizz)

      return quizz
    } catch (error) {
      console.error("Failed to read quizz config:", error)

      return []
    }
  }

  static updateQuizz(
    id: string,
    data: unknown,
    owner?: string,
  ): { id: string; updatedAt: number } {
    const result = quizzValidator.safeParse(data)

    if (!result.success) {
      throw new Error(result.error.issues[0].message)
    }

    const oldPath = getPath(`${quizzDir(owner)}/${safeId(id)}.json`)

    if (!fs.existsSync(oldPath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    // Concurrence optimiste : si le client connaissait un `updatedAt` et que le
    // fichier sur disque en a un différent, quelqu'un d'autre a sauvegardé
    // entre-temps — on refuse d'écraser silencieusement (cf. `errors:quizz.conflict`).
    // Un client qui envoie explicitement `updatedAt: undefined` (force overwrite)
    // contourne volontairement ce contrôle.
    const existingRaw = JSON.parse(fs.readFileSync(oldPath, "utf-8"))
    const clientUpdatedAt = result.data.updatedAt

    if (
      existingRaw.updatedAt !== undefined &&
      clientUpdatedAt !== undefined &&
      existingRaw.updatedAt !== clientUpdatedAt
    ) {
      throw new Error("errors:quizz.conflict")
    }

    const updatedAt = Date.now()

    writeFileAtomic(
      oldPath,
      JSON.stringify({ ...result.data, updatedAt }, null, 2),
    )
    Config.quizzCache.delete(owner ?? ADMIN_SCOPE)

    return { id, updatedAt }
  }

  static moveToFolder(id: string, folder: string | null, owner?: string): void {
    const filePath = getPath(`${quizzDir(owner)}/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))

    if (folder === null || folder === "") {
      delete raw.folder
    } else {
      raw.folder = folder
    }

    // NB : on réécrit `raw` tel quel, `updatedAt` du disque est donc préservé —
    // ne pas le régénérer ici, sinon on invaliderait le contrôle de concurrence
    // optimiste d'un `updateQuizz` concurrent (cf. errors:quizz.conflict).
    writeFileAtomic(filePath, JSON.stringify(raw, null, 2))
    Config.quizzCache.delete(owner ?? ADMIN_SCOPE)
  }

  // Champs vus par les joueurs (nom public + description/règles), modifiables
  // sans passer par l'éditeur : même précaution que `moveToFolder` sur
  // `updatedAt` (préservé, cf. concurrence optimiste).
  static setPublicInfo(
    id: string,
    info: { publicName: string | null; description: string | null },
    owner?: string,
  ): void {
    const filePath = getPath(`${quizzDir(owner)}/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))

    for (const [key, value] of Object.entries(info)) {
      const trimmed = value?.trim()

      if (trimmed) {
        raw[key] = trimmed
      } else {
        delete raw[key]
      }
    }

    writeFileAtomic(filePath, JSON.stringify(raw, null, 2))
    Config.quizzCache.delete(owner ?? ADMIN_SCOPE)
  }

  static deleteQuizz(id: string, owner?: string): void {
    const filePath = getPath(`${quizzDir(owner)}/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    fs.unlinkSync(filePath)
    Config.quizzCache.delete(owner ?? ADMIN_SCOPE)
  }

  static saveResult(data: GameResult): void {
    try {
      const resultsPath = getPath("results")

      if (!fs.existsSync(resultsPath)) {
        fs.mkdirSync(resultsPath)
      }

      writeFileAtomic(
        getPath(`results/${data.id}.json`),
        JSON.stringify(data, null, 2),
      )

      console.log(`Saved result for "${data.subject}"`)
    } catch (error) {
      console.error("Failed to save result:", error)
    }
  }

  static resultsMeta(): GameResultMeta[] {
    const resultsPath = getPath("results")

    if (!fs.existsSync(resultsPath)) {
      return []
    }

    const readMeta = (file: string): GameResultMeta | null => {
      try {
        const data = fs.readFileSync(getPath(`results/${file}`), "utf-8")
        const result = JSON.parse(data) as GameResult

        return {
          id: result.id,
          subject: result.subject,
          date: result.date,
          playerCount: result.players.length,
        }
      } catch {
        return null
      }
    }

    try {
      return fs
        .readdirSync(resultsPath)
        .filter((file) => file.endsWith(".json"))
        .map(readMeta)
        .filter((meta): meta is GameResultMeta => meta !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch {
      return []
    }
  }

  static resultById(id: string): GameResult {
    const filePath = getPath(`results/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Result "${id}" not found`)
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    const check = z.record(z.string(), z.unknown()).safeParse(raw)

    if (!check.success) {
      console.warn(`Résultat "${id}" invalide :`, check.error.issues)
    }

    return raw as GameResult
  }

  static deleteResult(id: string): void {
    const filePath = getPath(`results/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Result "${id}" not found`)
    }

    fs.unlinkSync(filePath)
  }

  static saveQuizz(
    data: unknown,
    owner?: string,
  ): { id: string; updatedAt: number } {
    const result = quizzValidator.safeParse(data)

    if (!result.success) {
      throw new Error(result.error.issues[0].message)
    }

    const id = normalizeFilename(result.data.subject)
    const filePath = getPath(`${quizzDir(owner)}/${id}.json`)
    const updatedAt = Date.now()

    writeFileAtomic(
      filePath,
      JSON.stringify({ ...result.data, updatedAt }, null, 2),
    )
    Config.quizzCache.delete(owner ?? ADMIN_SCOPE)

    return { id, updatedAt }
  }

  // ── Comptes invités ─────────────────────────────────────────────────────────
  // Stockés dans game.json (clé `guests`), à côté du mot de passe manager.
  // Chaque compte possède sa bibliothèque physiquement isolée (guests/<id>/quizz).

  static listGuests(): GuestAccount[] {
    // Pas de game.json (premier démarrage avant init) → pas de comptes.
    if (!fs.existsSync(getPath("game.json"))) {
      return []
    }

    const { guests } = Config.game()

    if (!Array.isArray(guests)) {
      return []
    }

    return guests.filter(isGuestAccount)
  }

  static guestById(id: string): GuestAccount | undefined {
    return Config.listGuests().find((guest) => guest.id === id)
  }

  static guestByName(name: string): GuestAccount | undefined {
    const normalized = guestIdFromName(name)

    return Config.listGuests().find((guest) => guest.id === normalized)
  }

  static createGuest(name: string, password: string): GuestAccount {
    const trimmedName = name.trim()
    const id = guestIdFromName(trimmedName)

    if (!trimmedName || !id) {
      throw new Error("errors:manager.guestInvalidName")
    }

    if (!password || password.length < 4) {
      throw new Error("errors:manager.guestInvalidPassword")
    }

    const filePath = getPath("game.json")
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    const guests: unknown[] = Array.isArray(raw.guests) ? raw.guests : []

    if (guests.filter(isGuestAccount).some((guest) => guest.id === id)) {
      throw new Error("errors:manager.guestAlreadyExists")
    }

    const guest: GuestAccount = {
      id,
      name: trimmedName,
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    }

    raw.guests = [...guests, guest]
    writeFileAtomic(filePath, JSON.stringify(raw, null, 2))
    fs.mkdirSync(getPath(quizzDir(id)), { recursive: true })

    return guest
  }

  static deleteGuest(id: string): void {
    const cleanId = safeId(id)
    const filePath = getPath("game.json")
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    const guests: unknown[] = Array.isArray(raw.guests) ? raw.guests : []

    if (!guests.filter(isGuestAccount).some((guest) => guest.id === cleanId)) {
      throw new Error("errors:manager.guestNotFound")
    }

    raw.guests = guests.filter(
      (guest) => !isGuestAccount(guest) || guest.id !== cleanId,
    )
    writeFileAtomic(filePath, JSON.stringify(raw, null, 2))

    // La bibliothèque du compte part avec lui (l'UI confirme avant l'appel).
    fs.rmSync(getPath(`guests/${cleanId}`), { recursive: true, force: true })
    Config.quizzCache.delete(cleanId)
  }

  // Résolution d'un id de quiz potentiellement préfixé `guest:` (vue admin :
  // lancement de partie, mode soirée) vers la bonne bibliothèque. L'id retourné
  // reste celui demandé par le client (préfixé le cas échéant).
  static findQuizzByAnyId(id: string): QuizzWithId | undefined {
    const parsed = parseGuestQuizId(id)

    try {
      return parsed
        ? { ...Config.quizzById(parsed.quizId, parsed.guestId), id }
        : Config.quizzById(id)
    } catch {
      return undefined
    }
  }

  // Vue admin : tous les quiz invités, id préfixé (guest:<compte>:<quiz>) et
  // dossier virtuel « Invités/<nom> » — la sidebar les classe automatiquement.
  static allGuestQuizzMeta(): QuizzMeta[] {
    return Config.listGuests().flatMap((guest) =>
      Config.quizzMeta(guest.id)
        // Un quiz archivé par le guest DANS SA PROPRE bibliothèque reste invisible
        // côté admin — même sémantique que l'Archive admin (jamais mélangé aux
        // autres dossiers). Conséquence voulue : un guest sans quiz non-archivé
        // ne produit aucun sous-dossier « Invités/<nom> ».
        .filter((meta) => !isArchived(meta.folder))
        .map((meta) => ({
          ...meta,
          id: formatGuestQuizId(guest.id, meta.id),
          folder: `${GUEST_FOLDER}/${guest.name}`,
        })),
    )
  }

  // Ensemble des noms de fichiers d'uploads référencés par AU MOINS un quiz ou un
  // résultat sauvegardé. Les résultats embarquent des questions complètes (donc
  // leurs images) : on les scanne aussi pour ne jamais supprimer une image dont
  // dépend un replay/export de résultat.
  static listReferencedMedia(): Set<string> {
    const refs = new Set<string>()

    for (const quizz of Config.quizz()) {
      collectUploadRefs(quizz, refs)
    }

    // Les bibliothèques invités référencent les mêmes uploads partagés : on les
    // scanne aussi, sinon la purge supprimerait leurs images.
    for (const guest of Config.listGuests()) {
      for (const quizz of Config.quizz(guest.id)) {
        collectUploadRefs(quizz, refs)
      }
    }

    const resultsPath = getPath("results")

    if (fs.existsSync(resultsPath)) {
      const files = fs
        .readdirSync(resultsPath)
        .filter((file) => file.endsWith(".json"))

      for (const file of files) {
        try {
          const raw = JSON.parse(
            fs.readFileSync(getPath(`results/${file}`), "utf-8"),
          )

          collectUploadRefs(raw, refs)
        } catch {
          // Résultat illisible : ignoré (ne bloque pas le nettoyage global).
        }
      }
    }

    return refs
  }

  // Supprime les fichiers du dossier `uploads/` qui ne sont référencés par aucun
  // quiz/résultat. Garde-fous : (1) `dryRun` par défaut → n'énumère que les
  // candidats sans rien supprimer ; (2) `minAgeMs` protège un upload récent pas
  // encore rattaché à un quiz (édition en cours) ; (3) on ne touche jamais aux
  // fichiers non-média.
  static pruneOrphanUploads(options?: {
    dryRun?: boolean
    minAgeMs?: number
  }): { kept: string[]; removed: string[] } {
    const dryRun = options?.dryRun ?? true
    const minAgeMs = options?.minAgeMs ?? 60 * 60 * 1000
    const uploadsPath = getPath("uploads")

    if (!fs.existsSync(uploadsPath)) {
      return { kept: [], removed: [] }
    }

    const mediaExts = new Set([
      ".webp",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".bmp",
      ".ico",
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
    ])
    const referenced = Config.listReferencedMedia()
    const now = Date.now()
    const kept: string[] = []
    const removed: string[] = []

    for (const file of fs.readdirSync(uploadsPath)) {
      const ext = path.extname(file).toLowerCase()

      // Non-média ou encore référencé : on conserve.
      if (!mediaExts.has(ext) || referenced.has(file)) {
        kept.push(file)

        continue
      }

      const filePath = resolve(uploadsPath, file)
      let ageMs = 0

      try {
        ageMs = now - fs.statSync(filePath).mtimeMs
      } catch {
        // Fichier disparu entre-temps : rien à faire.
        continue
      }

      // Marge de sécurité : un upload tout frais peut ne pas encore être
      // sauvegardé dans un quiz.
      if (ageMs < minAgeMs) {
        kept.push(file)

        continue
      }

      if (dryRun) {
        removed.push(file)

        continue
      }

      try {
        fs.unlinkSync(filePath)
        removed.push(file)
      } catch (err) {
        console.error(`Échec suppression orphelin ${file}:`, err)
        kept.push(file)
      }
    }

    return { kept, removed }
  }
}

export default Config
