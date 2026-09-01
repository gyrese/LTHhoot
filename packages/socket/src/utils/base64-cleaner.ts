import crypto from "crypto"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { writeFileAtomic } from "@rahoot/socket/utils/atomic-write"

/**
 * Traverses a JSON data structure recursively, finds any base64 image data URL
 * (`data:image/...;base64,...`), writes the binary image to `uploadsDir` (converted
 * to WebP if possible), and replaces the base64 string with the relative file URL
 * (`/uploads/img-migrated-XXXX.webp`).
 */
const IMAGE_DATA_URL_RE = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/u

/**
 * Écrit une image décodée dans `uploadsDir` : en WebP si sharp y parvient,
 * sinon le binaire d'origine tel quel. Extrait de la boucle de migration, qui
 * empilait sinon quatre niveaux d'imbrication.
 *
 * Le nom de fichier dérive du CONTENU (sha1) : la même image croisée dans dix
 * résultats archivés ne produit qu'un seul fichier, et relancer une migration
 * ne duplique rien.
 */
async function writeMigratedImage(
  buffer: Buffer,
  ext: string,
  uploadsDir: string,
): Promise<string> {
  const hash = crypto
    .createHash("sha1")
    .update(buffer)
    .digest("hex")
    .slice(0, 16)
  const baseName = `img-migrated-${hash}`

  for (const name of [`${baseName}.webp`, `${baseName}.${ext}`]) {
    if (fs.existsSync(path.join(uploadsDir, name))) {
      return `/uploads/${name}`
    }
  }

  try {
    sharp.concurrency(1)
    const outName = `${baseName}.webp`

    await sharp(buffer)
      .webp({ quality: 82 })
      .toFile(path.join(uploadsDir, outName))

    return `/uploads/${outName}`
  } catch (err) {
    console.error(
      "[Base64 Migration] Sharp WebP conversion failed, falling back to direct write:",
      err,
    )
    const outName = `${baseName}.${ext}`

    fs.writeFileSync(path.join(uploadsDir, outName), buffer)

    return `/uploads/${outName}`
  }
}

export async function migrateBase64InObject<T>(
  obj: T,
  uploadsDir: string,
): Promise<T> {
  if (!obj || typeof obj !== "object") {
    return obj
  }

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      // Migration volontairement séquentielle : sharp tourne en concurrence 1
      // pour ne pas faire exploser la mémoire sur un quiz plein d'images.
      // eslint-disable-next-line no-await-in-loop
      obj[i] = await migrateBase64InObject(obj[i], uploadsDir)
    }

    return obj
  }

  const record = obj as Record<string, unknown>

  for (const key of Object.keys(record)) {
    const val = record[key]

    if (typeof val === "string" && val.startsWith("data:image/")) {
      const matches = IMAGE_DATA_URL_RE.exec(val)

      if (matches) {
        const [, mime, base64Data] = matches
        const ext = mime === "jpeg" ? "jpg" : mime

        // eslint-disable-next-line no-await-in-loop
        record[key] = await writeMigratedImage(
          Buffer.from(base64Data, "base64"),
          ext,
          uploadsDir,
        )
      }
    } else if (val && typeof val === "object") {
      // eslint-disable-next-line no-await-in-loop
      record[key] = await migrateBase64InObject(val, uploadsDir)
    }
  }

  return obj
}

/** Dossiers `quizz/` de chaque invité, ignorés silencieusement s'ils manquent. */
function collectGuestQuizzDirs(guestsDir: string): string[] {
  if (!fs.existsSync(guestsDir)) {
    return []
  }

  try {
    return fs
      .readdirSync(guestsDir)
      .map((entry) => path.resolve(guestsDir, entry, "quizz"))
      .filter((dir) => fs.existsSync(dir))
  } catch {
    return []
  }
}

/**
 * Migre un fichier JSON (quiz ou résultat de partie) et retourne le nombre
 * d'images base64 converties (0 si le fichier n'en contenait pas, ou en cas
 * d'échec de lecture/écriture).
 */
export async function migrateBase64InFile(
  filePath: string,
  uploadsDir: string,
): Promise<number> {
  try {
    const content = fs.readFileSync(filePath, "utf-8")

    if (!content.includes("data:image/")) {
      return 0
    }

    const migratedObj = await migrateBase64InObject(
      JSON.parse(content),
      uploadsDir,
    )
    const count = (content.match(/data:image\//gu) ?? []).length

    if (count === 0) {
      return 0
    }

    writeFileAtomic(filePath, JSON.stringify(migratedObj, null, 2))

    return count
  } catch (err) {
    console.error(
      `[Base64 Migration] Échec de la migration pour ${path.basename(filePath)} :`,
      err,
    )

    return 0
  }
}

/**
 * Parcourt les dossiers JSON de `configDir` porteurs d'images — `quizz/`,
 * `guests/<id>/quizz/` et `results/` — extrait toute image base64 vers
 * `uploads/` et réécrit le fichier.
 *
 * `results/` est inclus parce qu'un résultat archive une COPIE des questions
 * jouées : les parties d'avant la migration des quiz portent donc encore leurs
 * images en base64, et ces fichiers-là sont relus à chaque ouverture de la
 * liste des résultats.
 */
export async function migrateAllBase64InConfig(configDir: string): Promise<{
  migratedCount: number
  filesUpdatedCount: number
}> {
  const uploadsDir = path.resolve(configDir, "uploads")
  const mainQuizzDir = path.resolve(configDir, "quizz")
  const guestsDir = path.resolve(configDir, "guests")
  const resultsDir = path.resolve(configDir, "results")

  const targetDirs: string[] = []

  if (fs.existsSync(mainQuizzDir)) {
    targetDirs.push(mainQuizzDir)
  }

  targetDirs.push(...collectGuestQuizzDirs(guestsDir))

  if (fs.existsSync(resultsDir)) {
    targetDirs.push(resultsDir)
  }

  let migratedCount = 0
  let filesUpdatedCount = 0

  for (const dir of targetDirs) {
    let files: string[] = []

    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
    } catch {
      continue
    }

    for (const file of files) {
      // Fichier par fichier : un quiz plein d'images ne doit pas mobiliser la
      // mémoire de tous les autres en même temps.
      // eslint-disable-next-line no-await-in-loop
      const migrated = await migrateBase64InFile(
        path.join(dir, file),
        uploadsDir,
      )

      if (migrated > 0) {
        migratedCount += migrated
        filesUpdatedCount += 1
        console.log(
          `[Base64 Migration] ✅ ${file} : ${migrated} image(s) base64 convertie(s) en fichiers /uploads/`,
        )
      }
    }
  }

  return { migratedCount, filesUpdatedCount }
}
