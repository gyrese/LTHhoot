import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs"
import { tmpdir } from "os"
import { resolve } from "path"
import { afterAll, describe, expect, it } from "vitest"

// CONFIG_PATH est capturé au chargement du module config → on l'installe AVANT
// tout import dynamique de Config (fait dans le test). D'où le seed en tête de
// fichier (module scope) plutôt que dans un beforeAll.
const dir = mkdtempSync(resolve(tmpdir(), "rahoot-guests-"))
process.env.CONFIG_PATH = dir

const validQuizz = (subject: string) => ({
  subject,
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
})

mkdirSync(resolve(dir, "quizz"), { recursive: true })
writeFileSync(
  resolve(dir, "game.json"),
  JSON.stringify({ managerPasswordHash: "salt:hash" }),
)
writeFileSync(
  resolve(dir, "quizz", "admin1.json"),
  JSON.stringify(validQuizz("Admin Quiz")),
)

describe("comptes invités", () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.CONFIG_PATH
  })

  it("createGuest crée le compte (hash, jamais de clair) et sa bibliothèque", async () => {
    const { default: Config } = await import("@rahoot/socket/services/config")

    const guest = Config.createGuest("Pierre Dupont", "secret42")

    expect(guest.id).toBe("pierre-dupont")
    expect(guest.passwordHash).toContain(":")

    const raw = JSON.parse(readFileSync(resolve(dir, "game.json"), "utf8"))

    expect(raw.guests).toHaveLength(1)
    expect(JSON.stringify(raw)).not.toContain("secret42")
    // Le mot de passe manager existant est préservé.
    expect(raw.managerPasswordHash).toBe("salt:hash")
    expect(existsSync(resolve(dir, "guests", "pierre-dupont", "quizz"))).toBe(
      true,
    )
  })

  it("rejette un nom en doublon et un mot de passe trop court", async () => {
    const { default: Config } = await import("@rahoot/socket/services/config")

    expect(() => Config.createGuest("Pierre Dupont", "autre123")).toThrow(
      "errors:manager.guestAlreadyExists",
    )
    expect(() => Config.createGuest("Marie", "abc")).toThrow(
      "errors:manager.guestInvalidPassword",
    )
    expect(() => Config.createGuest("   ", "pass1234")).toThrow(
      "errors:manager.guestInvalidName",
    )
  })

  it("isole les bibliothèques : un invité ne voit ni les quiz admin ni ceux des autres", async () => {
    const { default: Config } = await import("@rahoot/socket/services/config")

    Config.createGuest("Marie", "pass1234")
    const saved = Config.saveQuizz(
      validQuizz("Quiz de Pierre"),
      "pierre-dupont",
    )

    expect(Config.quizz("pierre-dupont").map((q) => q.id)).toEqual([saved.id])
    expect(Config.quizz("marie")).toHaveLength(0)
    // La bibliothèque admin ne contient pas le quiz invité…
    expect(Config.quizz().map((q) => q.subject)).toEqual(["Admin Quiz"])
    // …et le quiz invité n'est pas résoluble sans scope.
    expect(() => Config.quizzById(saved.id)).toThrow()
    expect(Config.quizzById(saved.id, "pierre-dupont").subject).toBe(
      "Quiz de Pierre",
    )
  })

  it("exclut les quiz qu'un guest a archivés dans SA propre bibliothèque", async () => {
    const { default: Config } = await import("@rahoot/socket/services/config")

    // Marie n'a que des quiz archivés : elle ne doit produire AUCUNE entrée
    // (donc aucun sous-dossier « Invités/Marie » côté admin).
    Config.saveQuizz(
      { ...validQuizz("Quiz archivé de Marie"), folder: "Archive" },
      "marie",
    )

    const metas = Config.allGuestQuizzMeta()

    expect(metas.map((m) => m.subject)).toEqual(["Quiz de Pierre"])
    expect(metas.every((m) => m.folder !== "Invités/Marie")).toBe(true)
  })

  it("expose les quiz invités à l'admin : id préfixé + dossier Invités/<nom>", async () => {
    const { default: Config } = await import("@rahoot/socket/services/config")

    const metas = Config.allGuestQuizzMeta()

    expect(metas).toHaveLength(1)
    expect(metas[0].id).toMatch(/^guest:pierre-dupont:/u)
    expect(metas[0].folder).toBe("Invités/Pierre Dupont")

    // La résolution d'un id préfixé (findQuizzByAnyId) atteint la bibliothèque
    // du compte, en conservant l'id connu du client.
    const resolved = Config.findQuizzByAnyId(metas[0].id)

    expect(resolved?.subject).toBe("Quiz de Pierre")
    expect(resolved?.id).toBe(metas[0].id)
    // Et reste capable de résoudre un id admin classique.
    expect(Config.findQuizzByAnyId("admin1")?.subject).toBe("Admin Quiz")
  })

  it("deleteGuest retire le compte et purge sa bibliothèque", async () => {
    const { default: Config } = await import("@rahoot/socket/services/config")

    Config.deleteGuest("pierre-dupont")

    expect(Config.listGuests().map((g) => g.id)).toEqual(["marie"])
    expect(existsSync(resolve(dir, "guests", "pierre-dupont"))).toBe(false)
    expect(Config.allGuestQuizzMeta()).toHaveLength(0)
    expect(() => Config.deleteGuest("pierre-dupont")).toThrow(
      "errors:manager.guestNotFound",
    )
  })
})
