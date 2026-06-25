import { type ChildProcess, spawn } from "child_process"
import * as net from "net"
import * as path from "path"
import * as fs from "fs"

// Gestion du process socket POUR LE TEST DE REPRISE APRÈS CRASH.
//
// On lance le serveur socket compilé (`node dist/index.cjs`) comme process
// enfant unique, ce qui permet de le TUER BRUTALEMENT (SIGKILL) pour simuler un
// crash réel — sans hook d'arrêt, sans sauvegarde de dernière minute. La reprise
// ne peut alors reposer que sur l'instantané périodique écrit sur disque.

const REPO_ROOT = path.resolve(process.cwd(), "..")
const SOCKET_DIST = path.join(REPO_ROOT, "packages", "socket", "dist", "index.cjs")

export interface SocketHandle {
  proc: ChildProcess
  port: number
  configPath: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Teste si un port TCP accepte les connexions (serveur up).
function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" })
    const done = (up: boolean) => {
      socket.destroy()
      resolve(up)
    }
    socket.once("connect", () => done(true))
    socket.once("error", () => done(false))
    socket.setTimeout(1000, () => done(false))
  })
}

export async function waitForPort(
  port: number,
  shouldBeUp: boolean,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const up = await probePort(port)

    if (up === shouldBeUp) {
      return
    }

    await sleep(250)
  }

  throw new Error(
    `Port ${port} n'est pas ${shouldBeUp ? "UP" : "DOWN"} après ${timeoutMs}ms`,
  )
}

// Démarre le serveur socket. `fresh` supprime l'état persistant (pour le 1er
// démarrage) ; au redémarrage post-crash on garde l'état pour tester la reprise.
export async function startSocket(opts: {
  port: number
  configPath: string
  fresh?: boolean
  password?: string
}): Promise<SocketHandle> {
  const { port, configPath, fresh, password = "test123" } = opts

  if (fresh && fs.existsSync(configPath)) {
    fs.rmSync(configPath, { recursive: true, force: true })
  }

  fs.mkdirSync(configPath, { recursive: true })

  // IMPORTANT : le serveur refuse le mot de passe par défaut "PASSWORD" (garde
  // « non configuré »). On seed donc un mot de passe RÉEL avant que Config.init
  // ne crée le défaut. Au redémarrage (fresh=false) on conserve le fichier.
  const gameJson = path.join(configPath, "game.json")

  if (!fs.existsSync(gameJson)) {
    fs.writeFileSync(
      gameJson,
      JSON.stringify({ managerPassword: password }, null, 2),
    )
  }

  if (!fs.existsSync(SOCKET_DIST)) {
    throw new Error(
      `Bundle socket introuvable : ${SOCKET_DIST}. Lance d'abord: pnpm --filter @rahoot/socket build`,
    )
  }

  const proc = spawn(process.execPath, [SOCKET_DIST], {
    env: {
      ...process.env,
      CONFIG_PATH: configPath,
      WS_PORT: String(port),
      NODE_ENV: "production",
      // Active les hooks de test (events __test_throw_*) pour valider le garde-fou.
      ENABLE_TEST_HOOKS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  proc.stdout?.on("data", (d) => {
    if (process.env.RECOVERY_DEBUG) {
      process.stdout.write(`[socket:${port}] ${d}`)
    }
  })
  proc.stderr?.on("data", (d) => {
    process.stderr.write(`[socket:${port}!] ${d}`)
  })

  await waitForPort(port, true, 20_000)

  return { proc, port, configPath }
}

// Tue brutalement le process (simulation de crash) et attend la libération du port.
export async function crashSocket(handle: SocketHandle): Promise<void> {
  const exited = new Promise<void>((resolve) => {
    handle.proc.once("exit", () => resolve())
  })

  handle.proc.kill("SIGKILL")
  await exited
  await waitForPort(handle.port, false, 10_000)
}

// Sert le build web via `vite preview`, avec le proxy /ws ciblant le socket de
// test (WS_PROXY_TARGET). On le gère NOUS-MÊMES (plutôt que webServer Playwright)
// pour garantir que l'env est bien appliqué — sinon le proxy retombe sur le
// défaut :3001 (la stack de dev) au lieu du socket de test.
export async function startPreview(opts: {
  webPort: number
  wsTarget: string
}): Promise<SocketHandle> {
  const webDir = path.join(REPO_ROOT, "packages", "web")
  // pnpm ne hoist pas forcément vite à la racine : on prend le binaire du paquet
  // web en priorité, avec repli sur la racine.
  const viteBin = [
    path.join(webDir, "node_modules", "vite", "bin", "vite.js"),
    path.join(REPO_ROOT, "node_modules", "vite", "bin", "vite.js"),
  ].find((p) => fs.existsSync(p))

  if (!viteBin) {
    throw new Error("Binaire vite introuvable (web ou racine)")
  }

  const proc = spawn(
    process.execPath,
    [viteBin, "preview", "--port", String(opts.webPort), "--strictPort"],
    {
      cwd: webDir,
      env: { ...process.env, WS_PROXY_TARGET: opts.wsTarget },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  proc.stdout?.on("data", (d) => {
    if (process.env.RECOVERY_DEBUG) {
      process.stdout.write(`[preview:${opts.webPort}] ${d}`)
    }
  })
  proc.stderr?.on("data", (d) => {
    process.stderr.write(`[preview:${opts.webPort}!] ${d}`)
  })

  await waitForPort(opts.webPort, true, 30_000)

  return { proc, port: opts.webPort, configPath: "" }
}

// Arrêt générique d'un process serveur (preview ou socket) géré par le test.
export async function stopServer(handle?: SocketHandle): Promise<void> {
  if (!handle?.proc || handle.proc.killed) {
    return
  }

  const exited = new Promise<void>((resolve) => {
    handle.proc.once("exit", () => resolve())
  })

  handle.proc.kill("SIGKILL")
  await exited
  await waitForPort(handle.port, false, 10_000).catch(() => undefined)
}
