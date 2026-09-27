import {
  questionLayoutBoxValidator,
  questionValidator,
  quizzValidator,
} from "@rahoot/common/validators/quizz"
import { resolveQuestionFont } from "@rahoot/common/utils/question-layout"
import { describe, expect, it } from "vitest"

const base = { question: "Question", cooldown: 5, time: 20 }
const mcq = { ...base, type: "mcq", answers: ["a", "b"], solutions: [0] }
const box = { x: 100, y: 50, width: 600, height: 120 }

describe("validateur — mise en page libre", () => {
  it("accepte un layout complet (titre + réponses stylées) et une police", () => {
    const result = questionValidator.safeParse({
      ...mcq,
      fontFamily: "Lobster",
      layout: {
        title: { ...box, fill: "#000000", textColor: "#ffffff", fontSize: 48 },
        answers: [box, { ...box, x: 800, fill: "#ff0000" }],
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      fontFamily: "Lobster",
      layout: { title: { fontSize: 48 }, answers: [box, { x: 800 }] },
    })
  })

  it("accepte une boîte débordant raisonnablement de la slide", () => {
    expect(
      questionLayoutBoxValidator.safeParse({ ...box, x: -200, y: 1100 })
        .success,
    ).toBe(true)
  })

  it.each([
    ["taille nulle", { ...box, width: 0 }],
    ["hauteur démesurée", { ...box, height: 5000 }],
    ["coordonnée aberrante", { ...box, x: 99999 }],
    ["texte trop petit", { ...box, fontSize: 2 }],
    ["texte trop grand", { ...box, fontSize: 500 }],
    ["couleur trop longue", { ...box, fill: "x".repeat(65) }],
    ["couleur vide", { ...box, textColor: " " }],
  ])("refuse une boîte invalide (%s)", (_label, invalid) => {
    expect(questionLayoutBoxValidator.safeParse(invalid).success).toBe(false)
  })

  it("refuse plus de 4 cases de réponse et une police trop longue", () => {
    expect(
      questionValidator.safeParse({
        ...mcq,
        layout: { answers: [box, box, box, box, box] },
      }).success,
    ).toBe(false)
    expect(
      questionValidator.safeParse({ ...mcq, fontFamily: "f".repeat(101) })
        .success,
    ).toBe(false)
  })

  it("garde valides les quiz existants, sans layout ni police", () => {
    const result = quizzValidator.safeParse({
      subject: "Historique",
      questions: [
        mcq,
        { ...base, type: "true_false", solution: 1 },
        { type: "title", question: "Slide", cooldown: 5, time: 5 },
        // Ancien format sans `type` : QCM implicite.
        { ...base, answers: ["x", "y"], solutions: 1 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data?.fontFamily).toBeUndefined()
    expect(result.data?.questions[0]).not.toHaveProperty("layout")
  })

  it("conserve la police par défaut du quiz", () => {
    const result = quizzValidator.safeParse({
      subject: "Police",
      fontFamily: "Poppins",
      questions: [mcq],
    })

    expect(result.data?.fontFamily).toBe("Poppins")
  })
})

describe("resolveQuestionFont", () => {
  it("préfère la police de la question, puis celle du quiz", () => {
    expect(resolveQuestionFont({ fontFamily: "Lobster" }, {})).toBe("Lobster")
    expect(
      resolveQuestionFont({ fontFamily: "Lobster" }, { fontFamily: "Roboto" }),
    ).toBe("Lobster")
    expect(resolveQuestionFont({}, { fontFamily: "Roboto" })).toBe("Roboto")
    expect(resolveQuestionFont({})).toBeUndefined()
  })
})
