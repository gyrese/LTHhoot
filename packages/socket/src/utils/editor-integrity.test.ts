import { afterEach, describe, expect, it, vi } from "vitest"
import { questionValidator } from "@rahoot/common/validators/quizz"
import { validateQuestion } from "@rahoot/web/features/quizz/utils/validation"
import { exportQuizzWithMedia } from "@rahoot/web/features/quizz/utils/export"
import { SaveSession } from "@rahoot/web/features/quizz/utils/save-session"

const base = { question: "Question", cooldown: 5, time: 20 }

describe("editor document integrity", () => {
  it.each([
    { ...base, type: "mcq", answers: ["a", "b"], solutions: [99] },
    { ...base, type: "mcq", answers: [" ", "b"], solutions: [0] },
    {
      ...base,
      type: "slider",
      min: 10,
      max: 0,
      correctValue: 50,
      tolerance: 0,
    },
    {
      ...base,
      type: "date",
      minYear: 1900,
      maxYear: 2000,
      correctYear: 2100,
      tolerance: 1,
    },
    {
      ...base,
      type: "grid",
      cellsPerRow: 2,
      cells: [{ image: "a" }, { image: "b" }],
      correctIndexes: [99],
    },
    {
      ...base,
      type: "drop_pin",
      pinImage: "a",
      zones: [
        {
          id: "z",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          label: "zone",
          isCorrect: false,
        },
      ],
    },
  ])("rejects invalid $type consistently", (question) => {
    expect(questionValidator.safeParse(question).success).toBe(false)
    expect(
      validateQuestion(question as Parameters<typeof validateQuestion>[0])
        .length,
    ).toBeGreaterThan(0)
  })

  it("allows title-only slides and two-item puzzles in both validation paths", () => {
    for (const q of [
      { ...base, type: "title" as const, question: "" },
      { ...base, type: "puzzle" as const, items: ["a", "b"] },
    ]) {
      expect(questionValidator.safeParse(q).success).toBe(true)
      expect(validateQuestion(q)).toEqual([])
    }
  })

  it("keeps edits made during a save dirty and prevents concurrent saves", () => {
    const session = new SaveSession()
    session.change()
    const first = session.begin()!
    expect(session.begin()).toBeNull()
    session.change()
    expect(session.complete(first)).toBe(false)
    expect(session.dirty).toBe(true)
    const next = session.begin()!
    expect(session.complete(next)).toBe(true)
    expect(session.dirty).toBe(false)
  })

  it("does not confirm a failed save or a replayed creation", () => {
    const session = new SaveSession()
    session.change()
    session.begin()
    session.fail()
    expect(session.dirty).toBe(true)
    const retry = session.begin()!
    expect(session.complete(retry, true)).toBe(false)
    expect(session.dirty).toBe(true)
    expect(session.saving).toBe(false)
  })
})

describe("portable quiz export", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("embeds sequence, grid and reveal images, preserving the input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new Blob(["image"], { type: "image/webp" })),
        ),
      ),
    )
    vi.stubGlobal(
      "FileReader",
      class {
        result = "data:image/webp;base64,aW1hZ2U="
        onloadend?: () => void
        readAsDataURL() {
          this.onloadend?.()
        }
      },
    )
    const quiz = {
      subject: "quiz",
      publicName: "Public",
      podiumTheme: "random",
      questions: [
        {
          ...base,
          type: "image_sequence",
          images: ["/uploads/sequence.webp"],
          correctAnswers: ["a"],
        },
        {
          ...base,
          type: "grid",
          cells: [{ image: "/uploads/grid.webp" }],
          correctIndexes: [0],
          cellsPerRow: 2,
        },
        {
          ...base,
          type: "mcq",
          answers: ["a", "b"],
          solutions: [0],
          answerReveal: { enabled: true, image: "/uploads/reveal.webp" },
        },
      ],
    }
    const exported = await exportQuizzWithMedia(quiz)
    expect(exported.questions[0].images[0]).toMatch(/^data:image/u)
    expect(exported.questions[1].cells[0].image).toMatch(/^data:image/u)
    expect(exported.questions[2].answerReveal.image).toMatch(/^data:image/u)
    expect(exported.publicName).toBe("Public")
    expect(quiz.questions[0]).toMatchObject({
      images: ["/uploads/sequence.webp"],
    })
  })
  it("fails explicitly on missing media instead of exporting a broken URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("Missing", { status: 404 }))),
    )
    await expect(
      exportQuizzWithMedia({
        subject: "quiz",
        questions: [],
        salonImage: "/missing",
      }),
    ).rejects.toThrow("404")
  })
})
