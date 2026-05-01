import type { Server } from "@rahoot/common/types/game/socket"
import { gameSocketHandlers } from "@rahoot/socket/handlers/game"
import { managerSocketHandlers } from "@rahoot/socket/handlers/manager"
import { quizzSocketHandlers } from "@rahoot/socket/handlers/quizz"
import { resultsSocketHandlers } from "@rahoot/socket/handlers/results"
import type { SocketHandler } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import Registry from "@rahoot/socket/services/registry"
import express from "express"
import { existsSync, mkdirSync } from "fs"
import { createServer } from "http"
import multer from "multer"
import { extname, resolve } from "path"
import sharp from "sharp"
import { Server as ServerIO } from "socket.io"

const WS_PORT = 3001

const configPath = process.env.CONFIG_PATH
  ? resolve(process.env.CONFIG_PATH)
  : resolve(process.cwd(), "../../config")

const uploadsDir = resolve(configPath, "uploads")

if (!existsSync(uploadsDir)) {mkdirSync(uploadsDir, { recursive: true })}

// Multer stocke temporairement dans uploads, on convertira en WebP ensuite
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) =>
    cb(null, `tmp-${Date.now()}${extname(file.originalname)}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
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

app.post(
  "/upload",
  upload.single("image"),
  async (req: express.Request, res: express.Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file" })

      return
    }

    const tmpPath = req.file.path
    const outName = `img-${Date.now()}.webp`
    const outPath = resolve(uploadsDir, outName)

    try {
      await sharp(tmpPath)
        .webp({ quality: 82 })
        .toFile(outPath)

      // Supprimer le fichier temporaire
      const { unlink } = await import("fs/promises")
      await unlink(tmpPath)

      res.json({ url: `/uploads/${outName}` })
    } catch (err) {
      console.error("Échec de la conversion WebP :", err)

      
res.status(422).json({ error: "Échec de la conversion de l'image" })
    }
  },
)

const io: Server = new ServerIO(httpServer, {
  path: "/ws",
  cors: {
    origin: process.env.ALLOWED_ORIGIN ?? "*",
  },
})

Config.init()

console.log(`Socket server running on port ${WS_PORT}`)
httpServer.listen(WS_PORT, "0.0.0.0")

const socketHandlers: SocketHandler[] = [
  managerSocketHandlers,
  quizzSocketHandlers,
  gameSocketHandlers,
  resultsSocketHandlers,
]

io.on("connection", (socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

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
