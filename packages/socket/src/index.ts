import type { Server } from "@rahoot/common/types/game/socket"
import { gameSocketHandlers } from "@rahoot/socket/handlers/game"
import { managerSocketHandlers } from "@rahoot/socket/handlers/manager"
import { quizzSocketHandlers } from "@rahoot/socket/handlers/quizz"
import { resultsSocketHandlers } from "@rahoot/socket/handlers/results"
import type { SocketHandler } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import Manager from "@rahoot/socket/services/manager"
import Registry from "@rahoot/socket/services/registry"
import { logHandlerError, wrapListener } from "@rahoot/socket/utils/safe-handler"
import { GoogleGenAI } from "@google/genai"
import express from "express"
import { existsSync, mkdirSync } from "fs"
import { createServer } from "http"
import multer from "multer"
import { extname, resolve } from "path"
import sharp from "sharp"
import { Server as ServerIO } from "socket.io"
import { unlink, copyFile } from "fs/promises"

// Natively load .env variables in Node.js if present (useful for local start without dotenv-cli)
try {
  const rootEnv = resolve(process.cwd(), ".env")
  const parentEnv = resolve(process.cwd(), "../../.env")
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv)
  } else if (existsSync(parentEnv)) {
    process.loadEnvFile(parentEnv)
  }
} catch (e) {
  // Ignore if loadEnvFile is not supported (e.g. older node versions)
}

const WS_PORT = Number(process.env.WS_PORT) || 3001

const configPath = process.env.CONFIG_PATH
  ? resolve(process.env.CONFIG_PATH)
  : resolve(process.cwd(), "../../config")

const uploadsDir = resolve(configPath, "uploads")

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

// Multer stocke temporairement dans uploads, on convertira en WebP ensuite
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) =>
    cb(null, `tmp-${Date.now()}${extname(file.originalname)}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Seuls les fichiers image sont acceptés"))
    }
  },
})

const app = express()
const httpServer = createServer(app)

app.use(express.json())
app.use("/uploads", express.static(uploadsDir))

// Garde d'authentification placée AVANT multer : on rejette les requêtes non
// authentifiées sur les seuls headers, donc avant que le fichier ne soit écrit
// sur disque. Le client transmet son clientId (header x-client-id) qui doit
// figurer parmi les clients ayant validé le mot de passe manager — même
// garantie que les events socket.
const requireManager = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const rawClientId = req.headers["x-client-id"]
  const clientId = Array.isArray(rawClientId) ? rawClientId[0] : rawClientId

  if (!Manager.isAuthorized(clientId)) {
    res.status(401).json({ error: "Unauthorized" })

    return
  }

  next()
}

app.post(
  "/upload",
  requireManager,
  upload.single("image"),
  async (req: express.Request, res: express.Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file" })

      return
    }

    console.log(
      `Réception d'un fichier : ${req.file.originalname} (${req.file.size} octets)`,
    )

    const tmpPath = req.file.path
    const outName = `img-${Date.now()}.webp`
    const outPath = resolve(uploadsDir, outName)

    try {
      // Limiter la concurrence pour éviter de saturer la RAM sur de gros GIFs
      sharp.concurrency(1)

      await sharp(tmpPath, { animated: true })
        .webp({ quality: 82 })
        .toFile(outPath)

      // Supprimer le fichier temporaire
      await unlink(tmpPath).catch((err) =>
        console.error("Erreur lors de la suppression du temporaire :", err),
      )

      res.json({ url: `/uploads/${outName}` })
    } catch (err) {
      console.error(
        "Échec de la conversion WebP, tentative de conservation du fichier original. Raison :",
        err,
      )

      try {
        // Fallback : on garde le fichier original avec son extension d'origine
        const originalExt = extname(req.file.originalname) || ".bin"
        const fallbackName = `img-orig-${Date.now()}${originalExt}`
        const fallbackPath = resolve(uploadsDir, fallbackName)

        console.log(
          `Tentative de fallback par copie : ${tmpPath} -> ${fallbackPath}`,
        )
        await copyFile(tmpPath, fallbackPath)
        // Nettoyage non critique
        await unlink(tmpPath).catch(console.error)

        res.json({ url: `/uploads/${fallbackName}` })
      } catch (fallbackErr) {
        console.error("Échec critique du fallback :", fallbackErr)
        res.status(422).json({
          error: `Échec du traitement de l'image. Erreur Sharp: ${err instanceof Error ? err.message : String(err)}. Erreur Fallback: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
        })
      }
    }
  },
)

app.post(
  "/ai-image",
  requireManager,
  async (req: express.Request, res: express.Response) => {
    const { subject } = req.body as { subject?: string }

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ error: "Sujet requis pour la génération d'image" })
      return
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error("GEMINI_API_KEY manquante dans les variables d'environnement")
      res.status(500).json({ error: "Clé API Gemini non configurée sur le serveur" })
      return
    }

    console.log(`Génération d'image par Gemini Imagen pour le sujet : "${subject}"`)

    const genAI = new GoogleGenAI({ apiKey })

    const prompt = `${subject}, Pixar style, vibrant colors, 3D render, studio lighting, square format`

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
      })

      const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
      const imageData = part?.inlineData?.data
      if (!imageData) {
        throw new Error("Aucune image retournée par Gemini. Assurez-vous que la facturation est activée dans AI Studio.")
      }

      const buffer = Buffer.from(imageData, "base64")
      const outName = `img-ai-${Date.now()}.webp`
      const outPath = resolve(uploadsDir, outName)

      // Conversion WebP
      sharp.concurrency(1)
      await sharp(buffer)
        .webp({ quality: 82 })
        .toFile(outPath)

      res.json({ url: `/uploads/${outName}` })
    } catch (err) {
      console.error("Échec de la génération d'image par Gemini :", err)
      res.status(500).json({
        error: `Échec de la génération d'image par IA: ${err instanceof Error ? err.message : String(err)}`,
      })
    }

  },
)

app.get(
  "/api/media/unsplash",
  requireManager,
  async (req: express.Request, res: express.Response) => {
    const query = req.query.query as string
    const page = Number(req.query.page) || 1

    if (!query || !query.trim()) {
      res.status(400).json({ error: "Query parameter is required" })
      return
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY
    if (!accessKey) {
      res.status(400).json({ error: "UNSPLASH_ACCESS_KEY non configurée sur le serveur" })
      return
    }

    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=24`,
        {
          headers: {
            Authorization: `Client-ID ${accessKey}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Unsplash returned status ${response.status}`)
      }

      const data = await response.json() as any
      const results = (data.results || []).map((item: any) => ({
        id: item.id,
        url: item.urls?.regular,
        thumb: item.urls?.small || item.urls?.thumb,
        author: item.user?.name,
        authorUrl: item.user?.links?.html,
      }))

      res.json({ results })
    } catch (err) {
      console.error("Unsplash proxy error:", err)
      res.status(500).json({ error: "Échec de la recherche d'images" })
    }
  }
)

app.get(
  "/api/media/giphy",
  requireManager,
  async (req: express.Request, res: express.Response) => {
    const query = req.query.query as string
    const page = Number(req.query.page) || 1

    if (!query || !query.trim()) {
      res.status(400).json({ error: "Query parameter is required" })
      return
    }

    const apiKey = process.env.GIPHY_API_KEY
    if (!apiKey) {
      res.status(400).json({ error: "GIPHY_API_KEY non configurée sur le serveur" })
      return
    }

    try {
      const offset = (page - 1) * 24
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=24&offset=${offset}`
      )

      if (!response.ok) {
        throw new Error(`Giphy returned status ${response.status}`)
      }

      const data = await response.json() as any
      const results = (data.data || []).map((item: any) => ({
        id: item.id,
        url: item.images?.original?.url,
        thumb: item.images?.fixed_width?.url || item.images?.preview_gif?.url,
        title: item.title,
      }))

      res.json({ results })
    } catch (err) {
      console.error("Giphy proxy error:", err)
      res.status(500).json({ error: "Échec de la recherche de GIFs" })
    }
  }
)

const io: Server = new ServerIO(httpServer, {
  path: "/ws",
  // 5MB : les uploads d'images passent déjà par l'endpoint HTTP /upload (multer,
  // limite 50MB), ce buffer ne sert plus qu'aux échanges JSON classiques du socket.
  maxHttpBufferSize: 5 * 1024 * 1024,
  cors: {
    origin: process.env.ALLOWED_ORIGIN ?? "*",
    methods: ["GET", "POST"],
    // On n'active credentials qu'avec une origine explicite : "*" + credentials
    // est contradictoire (rejeté par les navigateurs) et inutilement permissif.
    credentials: Boolean(process.env.ALLOWED_ORIGIN),
  },
  // Polling d'abord, puis montée automatique en WebSocket si le réseau et le
  // proxy le permettent. WebSocket est nettement plus stable que le long-polling
  // sur mobile (pas une requête HTTP par message, pas de coupure de cycle de
  // poll en veille radio). Si l'upgrade échoue (proxy qui ne relaie pas
  // l'en-tête Upgrade), le client RESTE en polling sans rupture : pas de
  // régression possible par rapport au mode polling-only précédent.
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  // Hardening pour réseaux instables (mobile). Lien mort détecté en ≤20s
  // (pingInterval + pingTimeout) au lieu de ~45s : pendant une question de 20s,
  // 45s de lien mort non détecté = question ratée sans que le joueur le sache.
  // Un faux positif ne coûte qu'un blip : la reconnexion se fait par clientId
  // avec resync d'état, et la manche ne compte que les joueurs connectés
  // (cf. countConnected). Le client dispose en plus d'un watchdog au retour de
  // premier plan (sonde connection:ping) pour ne même pas attendre ces 20s.
  pingTimeout: 10000,
  pingInterval: 10000,
  connectTimeout: 45000,
  allowEIO3: false,
})

// Logging Engine.IO (Focus Polling)
io.engine.on("connection_error", (err) => {
  console.error(
    `[POLLING_ERR] code=${err.code} message=${err.message} req_url=${err.req.url}`,
  )
})

io.engine.on("connection", (engineSocket) => {
  console.log(
    `[POLLING] Connexion active: sid=${engineSocket.id} transport=${engineSocket.transport.name} ip=${engineSocket.remoteAddress}`,
  )

  engineSocket.on("close", (reason: string) => {
    console.log(`[POLLING] Connexion close: sid=${engineSocket.id} raison=${reason}`)
  })
})

// ── Observabilité (Palier 1) ─────────────────────────────────────────────────
// Répartition des sockets connectés par transport. Permet de voir EN PROD si les
// clients montent bien en WebSocket ou restent bloqués en polling (signal de
// qualité réseau du lieu : c'est souvent la racine d'un « jamais réussi à se
// connecter » sur un Wi-Fi de salle saturé).
const transportBreakdown = () => {
  let websocket = 0
  let polling = 0

  for (const s of io.sockets.sockets.values()) {
    if (s.conn.transport.name === "websocket") {
      websocket += 1
    } else {
      polling += 1
    }
  }

  return { websocket, polling }
}

// Endpoint de santé : un moniteur d'uptime (ou l'hôte) peut vérifier que le
// serveur répond AVANT un événement et diagnostiquer en direct (parties, joueurs,
// transports). Léger, sans authentification (aucune donnée sensible).
app.get("/health", (_req, res) => {
  const games = Registry.getInstance().getAllGames()
  const players = games.reduce((sum, g) => sum + g.players.length, 0)

  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    games: games.length,
    players,
    sockets: io.engine.clientsCount,
    transports: transportBreakdown(),
  })
})

// Résumé périodique des transports : visibilité prod sur le taux d'upgrade WS.
// Silencieux quand personne n'est connecté (pas de bruit de log au repos).
setInterval(() => {
  const { websocket, polling } = transportBreakdown()

  if (websocket + polling > 0) {
    console.log(
      `[METRICS] sockets=${websocket + polling} ws=${websocket} polling=${polling} games=${Registry.getInstance().getGameCount()}`,
    )
  }
}, 30_000)

// Filet de dernier recours : une exception/rejet qui aurait échappé au garde-fou
// par-listener (timers, callbacks tiers…) ne doit PAS tuer le process et vider la
// RAM (= toutes les parties perdues). On log et on reste debout. Sûr car l'état
// des parties est aussi persisté sur disque (cf. services/persistence) : même un
// crash franc redevient récupérable.
process.on("uncaughtException", (err) => {
  logHandlerError("uncaughtException", err)
})

process.on("unhandledRejection", (reason) => {
  logHandlerError("unhandledRejection", reason)
})

Config.init()

// Reprise après crash/redéploiement : on recharge les parties persistées avant
// d'accepter des connexions. Les clients se rebrancheront par clientId.
Registry.getInstance().loadFromDisk(io)

console.log(
  `Socket server running on port ${WS_PORT} (transports: polling + websocket)`,
)
httpServer.listen(WS_PORT, "0.0.0.0")

// Exception au garde-fou « ne jamais exit » : un échec de bind (port occupé…)
// rend le serveur inutilisable. On laisse alors le superviseur le relancer
// proprement plutôt que de rester debout sans écouter aucune connexion.
httpServer.on("error", (err) => {
  logHandlerError("httpServer", err)
  process.exit(1)
})

const socketHandlers: SocketHandler[] = [
  managerSocketHandlers,
  quizzSocketHandlers,
  gameSocketHandlers,
  resultsSocketHandlers,
]

io.on("connection", (socket) => {
  const transport = socket.conn.transport.name
  console.log(
    `[IO] Client connecté: socketId=${socket.id} clientId=${socket.handshake.auth.clientId} transport=${transport}`,
  )

  // Garde-fou : on enveloppe socket.on pour que TOUT listener enregistré
  // ensuite (handlers métiers + "disconnect"/"error") soit protégé par un
  // try/catch. Une exception applicative est ainsi isolée au lieu de remonter
  // au process et d'éjecter toute la salle. cf. utils/safe-handler.
  const rawOn = socket.on.bind(socket)
  socket.on = ((event: string | symbol, listener: (..._a: unknown[]) => unknown) =>
    rawOn(event as never, wrapListener(event, listener) as never)) as typeof socket.on

  socket.on("error", (err) => {
    console.error(`[IO_ERR] socketId=${socket.id}: ${err.message}`)
  })

  socketHandlers.forEach((handler) => {
    handler({ io, socket })
  })

  // Hooks de test (gated par env, JAMAIS actifs en prod) : permettent de vérifier
  // en e2e que le garde-fou isole une exception de handler — sync ET async —
  // sans tuer le process ni déconnecter les autres clients. cf. utils/safe-handler.
  if (process.env.ENABLE_TEST_HOOKS === "1") {
    const testSocket = socket as unknown as {
      on: (_event: string, _cb: (..._a: unknown[]) => unknown) => void
    }

    testSocket.on("__test_throw_sync", () => {
      throw new Error("[TEST] throw synchrone intentionnel")
    })

    testSocket.on("__test_throw_async", () =>
      Promise.reject(new Error("[TEST] rejet async intentionnel")),
    )
  }
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
