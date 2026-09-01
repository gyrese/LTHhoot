import fs from "fs"
import path from "path"
import { tmpdir } from "os"
import { describe, expect, it, afterEach } from "vitest"
import {
  migrateBase64InObject,
  migrateAllBase64InConfig,
} from "@rahoot/socket/utils/base64-cleaner"

describe("base64-cleaner utility", () => {
  const tempDirs: string[] = []

  const createTempDir = () => {
    const dir = fs.mkdtempSync(path.join(tmpdir(), "rahoot-cleaner-test-"))
    tempDirs.push(dir)

    return dir
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }

    tempDirs.length = 0
  })

  it("replaces base64 image data URLs with uploaded file paths", async () => {
    const tempDir = createTempDir()
    const uploadsDir = path.join(tempDir, "uploads")

    // A tiny 1x1 transparent PNG pixel in base64
    const tinyBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    const quizData = {
      subject: "Test Quiz",
      background: { type: "image", value: tinyBase64 },
      questions: [
        {
          type: "mcq",
          question: "Sample Q",
          media: { type: "image", url: tinyBase64 },
        },
      ],
    }

    const cleaned = await migrateBase64InObject(quizData, uploadsDir)

    expect(cleaned.background.value).toMatch(
      /^\/uploads\/img-migrated-.+\.webp$/u,
    )
    expect(cleaned.questions[0].media.url).toMatch(
      /^\/uploads\/img-migrated-.+\.webp$/u,
    )

    // Les deux champs portaient la MÊME image : le nom dérivant du contenu,
    // un seul fichier est écrit et les deux URL pointent dessus.
    expect(cleaned.background.value).toBe(cleaned.questions[0].media.url)

    const createdFiles = fs.readdirSync(uploadsDir)

    expect(createdFiles.length).toBe(1)
  })

  it("migrates base64 images in quiz json files on disk", async () => {
    const configDir = createTempDir()
    const quizzDir = path.join(configDir, "quizz")

    fs.mkdirSync(quizzDir, { recursive: true })

    const tinyBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    const quizFile = path.join(quizzDir, "quiz1.json")

    fs.writeFileSync(
      quizFile,
      JSON.stringify({
        subject: "Disk Quiz",
        salonImage: tinyBase64,
        questions: [],
      }),
    )

    const result = await migrateAllBase64InConfig(configDir)

    expect(result.filesUpdatedCount).toBe(1)
    expect(result.migratedCount).toBe(1)

    const updatedContent = JSON.parse(fs.readFileSync(quizFile, "utf-8"))

    expect(updatedContent.salonImage).toMatch(
      /^\/uploads\/img-migrated-.+\.webp$/u,
    )
  })

  it("migre aussi les résultats de partie archivés", async () => {
    const configDir = createTempDir()
    const resultsDir = path.join(configDir, "results")

    fs.mkdirSync(resultsDir, { recursive: true })

    const tinyBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    const resultFile = path.join(resultsDir, "1700000000000-abc.json")

    fs.writeFileSync(
      resultFile,
      JSON.stringify({
        id: "1700000000000-abc",
        subject: "Partie test",
        date: "2026-01-01",
        players: [],
        questions: [
          {
            type: "mcq",
            question: "Q1",
            background: { type: "image", value: tinyBase64 },
            playerAnswers: [],
          },
        ],
      }),
    )

    const result = await migrateAllBase64InConfig(configDir)

    expect(result.filesUpdatedCount).toBe(1)

    const updated = JSON.parse(fs.readFileSync(resultFile, "utf-8"))

    expect(updated.questions[0].background.value).toMatch(
      /^\/uploads\/img-migrated-.+\.webp$/u,
    )
  })
})
