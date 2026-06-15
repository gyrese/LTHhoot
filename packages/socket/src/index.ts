import type { Server } from "@rahoot/common/types/game/socket"
import { gameSocketHandlers } from "@rahoot/socket/handlers/game"
import { managerSocketHandlers } from "@rahoot/socket/handlers/manager"
import { quizzSocketHandlers } from "@rahoot/socket/handlers/quizz"
import { resultsSocketHandlers } from "@rahoot/socket/handlers/results"
import type { SocketHandler } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import Manager from "@rahoot/socket/services/manager"
import Registry from "@rahoot/socket/services/registry"
import express from "express"
import { existsSync, mkdirSync } from "fs"
import { createServer } from "http"
import multer from "multer"
import { extname, resolve } from "path"
import sharp from "sharp"
import { Server as ServerIO } from "socket.io"
import { unlink, copyFile } from "fs/promises"

const WS_PORT = 3001

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

const io: Server = new ServerIO(httpServer, {
  path: "/ws",
  // 100MB
  maxHttpBufferSize: 1e8,
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
  // Hardening pour réseaux instables (mobile). On détecte une coupure réelle en
  // ~45s sans descendre assez bas pour éjecter un mobile temporairement lent. La
  // perte de slot n'est plus un risque : la reconnexion se fait par clientId et
  // la manche ne compte que les joueurs connectés (cf. countConnected).
  pingTimeout: 25000,
  pingInterval: 20000,
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

Config.init()

console.log(
  `Socket server running on port ${WS_PORT} (transports: polling + websocket)`,
)
httpServer.listen(WS_PORT, "0.0.0.0")

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

  socket.on("error", (err) => {
    console.error(`[IO_ERR] socketId=${socket.id}: ${err.message}`)
  })

  socketHandlers.forEach((handler) => {
    handler({ io, socket })
  })
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
