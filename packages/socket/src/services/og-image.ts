import { quizzDisplayName } from "@rahoot/common/utils/quizz-name"
import Config from "@rahoot/socket/services/config"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"
import sharp from "sharp"

// Format attendu par Facebook / X / LinkedIn / WhatsApp pour une grande carte.
const OG_WIDTH = 1200
const OG_HEIGHT = 630
const LOGO_WIDTH = 420
const CACHE_TTL_MS = 10 * 60 * 1000

type CacheEntry = { buffer: Buffer; expiresAt: number }

const cache = new Map<string, CacheEntry>()

// Racine des fichiers statiques du web : /app/web en conteneur, le dossier
// `public` du paquet web en local. Sert à lire le logo de la soirée, qui doit
// rester un seul fichier partagé par le front et le générateur d'image.
const webRoot = (): string | null => {
  const candidates = [
    process.env.WEB_DIST_PATH,
    "/app/web",
    resolve(process.cwd(), "../web/public"),
    resolve(process.cwd(), "../web/dist"),
  ].filter((path): path is string => Boolean(path))

  return candidates.find((path) => existsSync(path)) ?? null
}

const logoBuffer = (): Buffer | null => {
  const root = webRoot()

  if (!root) {
    return null
  }

  const logoPath = resolve(root, "logo-aperoquiz.png")

  return existsSync(logoPath) ? readFileSync(logoPath) : null
}

// Résout une image de quiz (« /uploads/img-x.webp ») vers son fichier disque.
const coverBuffer = (url: string | undefined, uploadsDir: string) => {
  if (!url) {
    return null
  }

  const name = url.split("/").pop()

  if (!name) {
    return null
  }

  const filePath = resolve(uploadsDir, name)

  return existsSync(filePath) ? readFileSync(filePath) : null
}

/**
 * Vignette de partage d'un quiz : sa couverture assombrie, surmontée du logo
 * de la soirée. Renvoie `null` si le quiz est introuvable — l'appelant répond
 * alors 404 et les réseaux retombent sur leur aperçu par défaut.
 */
export const buildOgImage = async (
  quizzId: string,
  uploadsDir: string,
): Promise<Buffer | null> => {
  const cached = cache.get(quizzId)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.buffer
  }

  let quizz

  try {
    quizz = Config.quizzById(quizzId)
  } catch {
    return null
  }

  const cover = coverBuffer(quizz.listingImage || quizz.salonImage, uploadsDir)
  const logo = logoBuffer()

  // Fond : couverture du quiz, dégradé neutre quand le quiz n'a pas d'image.
  const background = cover
    ? await sharp(cover)
        .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" })
        .toBuffer()
    : await sharp({
        create: {
          width: OG_WIDTH,
          height: OG_HEIGHT,
          channels: 4,
          background: { r: 15, g: 17, b: 26, alpha: 1 },
        },
      })
        .png()
        .toBuffer()

  const layers: sharp.OverlayOptions[] = []

  if (cover) {
    // Voile sombre uniforme : le logo doit rester lisible même sur une
    // couverture claire et chargée (un simple assombrissement ne suffit pas).
    layers.push({
      input: await sharp({
        create: {
          width: OG_WIDTH,
          height: OG_HEIGHT,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer(),
    })
  }

  if (logo) {
    layers.push({
      input: await sharp(logo).resize({ width: LOGO_WIDTH }).toBuffer(),
      gravity: "centre",
    })
  }

  const buffer = await sharp(background)
    .composite(layers)
    .png({ quality: 90 })
    .toBuffer()

  cache.set(quizzId, { buffer, expiresAt: Date.now() + CACHE_TTL_MS })

  return buffer
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")

/**
 * Injecte les balises Open Graph du quiz dans l'index.html du build web.
 * Les robots des réseaux sociaux n'exécutent pas le JS : sans cette étape, ils
 * ne voient que le HTML générique de la SPA.
 */
export const injectOgTags = (
  html: string,
  quizzId: string,
  origin: string,
): string => {
  let quizz

  try {
    quizz = Config.quizzById(quizzId)
  } catch {
    return html
  }

  const title = quizzDisplayName(quizz)
  const description =
    quizz.description?.trim() ||
    "Jouez en solo et tentez votre chance au tirage au sort !"
  const imageUrl = `${origin}/og/${encodeURIComponent(quizzId)}.png`
  const pageUrl = `${origin}/solo/${encodeURIComponent(quizzId)}`

  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="L'Apéro Quiz" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="${OG_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_HEIGHT}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
  ].join("\n    ")

  return html.replace("</head>", `    ${tags}\n  </head>`)
}

export const readWebIndex = (): string | null => {
  const root = webRoot()

  if (!root) {
    return null
  }

  // En local, `public` n'a pas d'index.html : seul le build en contient un.
  const candidates = [
    resolve(root, "index.html"),
    resolve(process.cwd(), "../web/dist/index.html"),
  ]
  const found = candidates.find((path) => existsSync(path))

  return found ? readFileSync(found, "utf-8") : null
}
