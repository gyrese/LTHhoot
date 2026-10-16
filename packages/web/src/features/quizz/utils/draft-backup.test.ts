// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { findDraftBackup, parseDraftBackup } from "./draft-backup"

const draft = (
  subject: string,
  savedAt: number,
  savedId: string | null = null,
) =>
  JSON.stringify({
    subject,
    savedAt,
    savedId,
    questions: [{ type: "mcq", question: "À compléter", answers: ["", ""] }],
  })

afterEach(() => localStorage.clear())

describe("récupération des brouillons", () => {
  it("retrouve un nouveau quiz après fermeture de son ancien onglet", () => {
    localStorage.setItem("rahoot-backup-client-old-tab", draft("Ancien", 100))
    localStorage.setItem("rahoot-backup-client-newer-tab", draft("Récent", 200))
    localStorage.setItem("rahoot-backup-other-tab", draft("Autre compte", 300))

    const found = findDraftBackup(
      localStorage,
      "rahoot-backup-client-current-tab",
      "rahoot-backup-client-",
    )

    expect(found?.key).toBe("rahoot-backup-client-newer-tab")
    expect(found?.backup.subject).toBe("Récent")
  })

  it("isole le brouillon d'un quiz enregistré", () => {
    localStorage.setItem(
      "rahoot-backup-client-quiz-a",
      draft("A", 100, "quiz-a"),
    )
    localStorage.setItem(
      "rahoot-backup-client-quiz-b",
      draft("B", 200, "quiz-b"),
    )

    expect(
      findDraftBackup(
        localStorage,
        "rahoot-backup-client-quiz-a",
        "rahoot-backup-client-",
        "quiz-a",
      )?.backup.subject,
    ).toBe("A")
  })

  it("retrouve les modifications d'un quiz créé dans un ancien onglet", () => {
    localStorage.setItem(
      "rahoot-backup-client-old-creation-id",
      draft("Modifications récentes", 250, "quiz-a"),
    )
    expect(
      findDraftBackup(
        localStorage,
        "rahoot-backup-client-quiz-a",
        "rahoot-backup-client-",
        "quiz-a",
      )?.backup.subject,
    ).toBe("Modifications récentes")
  })

  it("ignore les données locales illisibles ou mal formées", () => {
    expect(parseDraftBackup("{cassé")).toBeNull()
    expect(
      parseDraftBackup(JSON.stringify({ questions: [{ type: "mcq" }] })),
    ).toBeNull()
    localStorage.setItem("rahoot-backup-client-invalid", "{cassé")
    expect(
      findDraftBackup(
        localStorage,
        "rahoot-backup-client-current",
        "rahoot-backup-client-",
      ),
    ).toBeNull()
  })
})
