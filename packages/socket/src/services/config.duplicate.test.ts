import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { resolve } from "path"
import { afterAll, describe, expect, it } from "vitest"

// CONFIG_PATH est lu au chargement du module : on l'installe avant l'import.
const dir = mkdtempSync(resolve(tmpdir(), "rahoot-duplicate-"))
process.env.CONFIG_PATH = dir

const quizz = (extra: Record<string, unknown>) => ({
  subject: "Halloween",
  questions: [
    {
      type: "mcq",
      question: "q",
      answers: ["a", "b"],
      solutions: [0],
      cooldown: 5,
      time: 20,
    },
  ],
  updatedAt: 1,
  ...extra,
})

mkdirSync(resolve(dir, "quizz"), { recursive: true })
writeFileSync(
  resolve(dir, "game.json"),
  JSON.stringify({ managerPasswordHash: "salt:hash" }),
)
writeFileSync(
  resolve(dir, "quizz", "src.json"),
  JSON.stringify(quizz({ folder: "Fêtes", tags: ["fun"] })),
)
writeFileSync(
  resolve(dir, "quizz", "old.json"),
  JSON.stringify(
    quizz({ folder: "Archive", archivedAt: 5, archivedFrom: "Fêtes" }),
  ),
)

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("Config.duplicateQuizz", () => {
  it("crée une copie indépendante sous un nouvel id", async () => {
    const { default: Config } = await import("./config")
    const { id } = await Config.duplicateQuizz(
      { id: "src" },
      "Halloween (copie)",
    )

    expect(id).not.toBe("src")
    const copy = Config.quizzById(id)
    expect(copy).toMatchObject({
      subject: "Halloween (copie)",
      folder: "Fêtes",
      tags: ["fun"],
    })
    expect(Config.quizzById("src").subject).toBe("Halloween")
  })

  it("sort la copie d'un quiz archivé vers son dossier d'origine", async () => {
    const { default: Config } = await import("./config")
    const { id } = await Config.duplicateQuizz({ id: "old" }, "Copie")
    const copy = Config.quizzById(id)

    expect(copy.folder).toBe("Fêtes")
    expect(copy.archivedAt).toBeUndefined()
    expect(copy.archivedFrom).toBeUndefined()
  })

  it("n'hérite pas du dossier lors d'une copie vers une autre bibliothèque", async () => {
    const { default: Config } = await import("./config")
    mkdirSync(resolve(dir, "guests", "g1", "quizz"), { recursive: true })
    const { id } = await Config.duplicateQuizz({ id: "src" }, "Copie", "g1")

    expect(Config.quizzById(id, "g1").folder).toBeUndefined()
  })
})
