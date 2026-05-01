import { EXAMPLE_QUIZZ } from "@rahoot/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzWithId,
} from "@rahoot/common/types/game"
import { quizzValidator } from "@rahoot/common/validators/quizz"
import { normalizeFilename } from "@rahoot/socket/utils/game"
import fs from "fs"
import path, { resolve } from "path"
import { z } from "zod"

function safeId(id: string): string {
  const sanitized = path.basename(id).replace(/[^a-z0-9_.-]/giu, "")

  if (!sanitized) {throw new Error("ID invalide")}
  
return sanitized
}

const inContainerPath = process.env.CONFIG_PATH

const getPath = (path: string = "") =>
  inContainerPath
    ? resolve(inContainerPath, path)
    : resolve(process.cwd(), "../../config", path)

class Config {
  static init() {
    const isConfigFolderExists = fs.existsSync(getPath())

    if (!isConfigFolderExists) {
      fs.mkdirSync(getPath())
    }

    const isGameConfigExists = fs.existsSync(getPath("game.json"))

    if (!isGameConfigExists) {
      fs.writeFileSync(
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

      fs.writeFileSync(
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

  static quizzMeta() {
    return Config.quizz().map(({ id, subject, folder, tags, salonImage, listingImage }) => ({
      id,
      subject,
      folder,
      tags,
      salonImage,
      listingImage,
    }))
  }

  static quizzById(id: string) {
    const filePath = getPath(`quizz/${safeId(id)}.json`)

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

  static quizz() {
    const isExists = fs.existsSync(getPath("quizz"))

    if (!isExists) {
      return []
    }

    try {
      const files = fs
        .readdirSync(getPath("quizz"))
        .filter((file) => file.endsWith(".json"))

      const quizz: QuizzWithId[] = files.flatMap((file) => {
        const data = fs.readFileSync(getPath(`quizz/${file}`), "utf-8")
        const id = file.replace(".json", "")

        const result = quizzValidator.safeParse(JSON.parse(data))

        if (!result.success) {
          console.warn(`Invalid quizz config "${file}":`, result.error.issues)

          return []
        }

        return [{ id, ...result.data }]
      })

      return quizz || []
    } catch (error) {
      console.error("Failed to read quizz config:", error)

      return []
    }
  }

  static updateQuizz(id: string, data: unknown): { id: string } {
    const result = quizzValidator.safeParse(data)

    if (!result.success) {
      throw new Error(result.error.issues[0].message)
    }

    const oldPath = getPath(`quizz/${id}.json`)

    if (!fs.existsSync(oldPath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    fs.writeFileSync(oldPath, JSON.stringify(result.data, null, 2))

    return { id }
  }

  static moveToFolder(id: string, folder: string | null): void {
    const filePath = getPath(`quizz/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))

    if (folder === null || folder === "") {
      delete raw.folder
    } else {
      raw.folder = folder
    }

    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2))
  }

  static deleteQuizz(id: string): void {
    const filePath = getPath(`quizz/${safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Quizz "${id}" not found`)
    }

    fs.unlinkSync(filePath)
  }

  static saveResult(data: GameResult): void {
    try {
      const resultsPath = getPath("results")

      if (!fs.existsSync(resultsPath)) {
        fs.mkdirSync(resultsPath)
      }

      fs.writeFileSync(
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

  static saveQuizz(data: unknown): { id: string } {
    const result = quizzValidator.safeParse(data)

    if (!result.success) {
      throw new Error(result.error.issues[0].message)
    }

    const id = normalizeFilename(result.data.subject)
    const filePath = getPath(`quizz/${id}.json`)

    fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2))

    return { id }
  }
}

export default Config
