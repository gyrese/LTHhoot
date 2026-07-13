import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "fs"
import { tmpdir } from "os"
import { resolve } from "path"
import { afterAll, describe, expect, it } from "vitest"

// CONFIG_PATH est capturé au chargement du module config → on l'installe AVANT
// tout import dynamique de Config (fait dans le test). D'où le seed en tête de
// fichier (module scope) plutôt que dans un beforeAll.
const dir = mkdtempSync(resolve(tmpdir(), "rahoot-prune-"))
process.env.CONFIG_PATH = dir

mkdirSync(resolve(dir, "quizz"), { recursive: true })
mkdirSync(resolve(dir, "uploads"), { recursive: true })

// Un quiz valide qui référence used.webp via salonImage.
writeFileSync(
  resolve(dir, "quizz", "q1.json"),
  JSON.stringify({
    subject: "Q1",
    salonImage: "/uploads/used.webp",
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
  }),
)

// Deux images anciennes (3h) : used.webp (référencée) et orphan.webp (orpheline) ;
// fresh.webp tout juste créée (protégée par la marge d'âge d'1h).
const old = new Date(Date.now() - 3 * 60 * 60 * 1000)

for (const name of ["used.webp", "orphan.webp"]) {
  const filePath = resolve(dir, "uploads", name)

  writeFileSync(filePath, "x")
  utimesSync(filePath, old, old)
}

writeFileSync(resolve(dir, "uploads", "fresh.webp"), "x")

describe("pruneOrphanUploads", () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.CONFIG_PATH
  })

  it("garde les fichiers référencés (même anciens) et récents, ne retire que les orphelins anciens", async () => {
    const { default: Config } = await import(
      "@rahoot/socket/services/config"
    )

    // Dry-run : liste l'orphelin sans rien supprimer.
    const dry = Config.pruneOrphanUploads({ dryRun: true })

    expect(dry.removed).toEqual(["orphan.webp"])
    expect([...dry.kept].sort()).toEqual(["fresh.webp", "used.webp"])
    expect(readdirSync(resolve(dir, "uploads")).sort()).toEqual([
      "fresh.webp",
      "orphan.webp",
      "used.webp",
    ])

    // Réel : supprime uniquement l'orphelin ancien.
    const real = Config.pruneOrphanUploads({ dryRun: false })

    expect(real.removed).toEqual(["orphan.webp"])
    expect(readdirSync(resolve(dir, "uploads")).sort()).toEqual([
      "fresh.webp",
      "used.webp",
    ])
  })
})
