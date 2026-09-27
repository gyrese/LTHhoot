import type { Question } from "@rahoot/common/types/game"
import {
  answerBoxAt,
  defaultAnswerBoxes,
  defaultAnswerFontSize,
  defaultTitleBox,
  fontFamilyCss,
  layoutAnswerCount,
  layoutAnswerLabels,
  materializeLayout,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
  moveResizeBox,
  resizeLayoutAnswers,
  resolveQuestionFont,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  updateLayoutBox,
} from "@rahoot/web/features/game/utils/question-layout"
import { describe, expect, it } from "vitest"

const base = { question: "Q", cooldown: 5, time: 20 }
const mcq = (answers: string[], extra: Partial<Question> = {}) =>
  ({ ...base, type: "mcq", answers, solutions: [0], ...extra }) as Question

const inSlide = ({ x, y, width, height }: ReturnType<typeof defaultTitleBox>) =>
  x >= 0 && y >= 0 && x + width <= SLIDE_WIDTH && y + height <= SLIDE_HEIGHT

describe("boîtes par défaut", () => {
  it("place le titre centré en haut, dans la slide", () => {
    const title = defaultTitleBox()

    expect(title.y).toBeLessThan(100)
    expect(title.x + title.width / 2).toBe(SLIDE_WIDTH / 2)
    expect(inSlide(title)).toBe(true)
  })

  it("reproduit la grille 2 colonnes collée en bas", () => {
    const four = defaultAnswerBoxes(4)

    expect(four).toHaveLength(4)
    expect(four.every(inSlide)).toBe(true)
    // Même ligne pour 0-1 et 2-3, colonnes alignées.
    expect(four[0]!.y).toBe(four[1]!.y)
    expect(four[2]!.y).toBeGreaterThan(four[0]!.y)
    expect(four[2]!.x).toBe(four[0]!.x)
    expect(four[1]!.x).toBeGreaterThan(four[0]!.x + four[0]!.width)
    // La dernière ligne touche le bas (marge de 16 px).
    expect(four[3]!.y + four[3]!.height).toBe(SLIDE_HEIGHT - 16)

    // Vrai-faux / 2 réponses : une seule ligne, en bas.
    const two = defaultAnswerBoxes(2)
    expect(two[0]!.y).toBe(four[2]!.y)

    // Nombre impair : la dernière case reste à gauche.
    expect(defaultAnswerBoxes(3)[2]!.x).toBe(four[0]!.x)
  })

  it("compte les cases positionnables selon le type", () => {
    expect(layoutAnswerCount(mcq(["a", "b", "c"]))).toBe(3)
    expect(
      layoutAnswerCount({ ...base, type: "true_false", solution: 1 }),
    ).toBe(2)
    expect(
      layoutAnswerCount({ ...base, type: "open", correctAnswers: ["x"] }),
    ).toBe(0)
  })

  it("donne les libellés des cases (QCM, vrai-faux) ou null", () => {
    expect(layoutAnswerLabels("mcq", ["a", "b"], ["F", "V"])).toEqual([
      "a",
      "b",
    ])
    expect(layoutAnswerLabels("true_false", undefined, ["F", "V"])).toEqual([
      "F",
      "V",
    ])
    expect(layoutAnswerLabels("open", undefined, ["F", "V"])).toBeNull()
  })

  it("adapte la taille du texte d'une réponse à sa longueur", () => {
    expect(defaultAnswerFontSize("Paris")).toBe(36)
    expect(defaultAnswerFontSize("x".repeat(30))).toBe(24)
    expect(defaultAnswerFontSize("x".repeat(60))).toBe(18)
  })
})

describe("matérialisation et mise à jour du layout", () => {
  it("matérialise les boîtes par défaut d'une question sans layout", () => {
    const layout = materializeLayout(mcq(["a", "b"]))

    expect(layout.title).toEqual(defaultTitleBox())
    expect(layout.answers).toEqual(defaultAnswerBoxes(2))
  })

  it("déplacer le titre ne fige pas les réponses (et inversement)", () => {
    const question = mcq(["a", "b"])
    const withTitle = updateLayoutBox(question, "title", { x: 10 })

    expect(withTitle.title).toMatchObject({ x: 10, y: defaultTitleBox().y })
    expect(withTitle.answers).toBeUndefined()

    const withAnswer = updateLayoutBox(question, 1, { fill: "#ff0000" })

    expect(withAnswer.title).toBeUndefined()
    expect(withAnswer.answers).toHaveLength(2)
    expect(withAnswer.answers![1]).toMatchObject({ fill: "#ff0000" })
    expect(withAnswer.answers![0]).toEqual(defaultAnswerBoxes(2)[0])
  })

  it("retire une surcharge remise à zéro", () => {
    const question = mcq(["a", "b"], {
      layout: { title: { ...defaultTitleBox(), fontSize: 50 } },
    })
    const next = updateLayoutBox(question, "title", { fontSize: undefined })

    expect(next.title).not.toHaveProperty("fontSize")
  })

  it("garde layout.answers aligné à l'ajout / au retrait d'une réponse", () => {
    const custom = { x: 1, y: 2, width: 300, height: 90 }
    const layout = { answers: [custom, custom] }

    const grown = resizeLayoutAnswers(layout, 3)!
    expect(grown.answers).toHaveLength(3)
    expect(grown.answers![2]).toEqual(defaultAnswerBoxes(3)[2])

    const shrunk = resizeLayoutAnswers(grown, 2)!
    expect(shrunk.answers).toEqual([custom, custom])

    // Sans layout de réponses : rien à synchroniser.
    expect(resizeLayoutAnswers(undefined, 3)).toBeUndefined()
    expect(resizeLayoutAnswers({ title: custom }, 3)).toEqual({ title: custom })
  })

  it("retombe sur la boîte par défaut si layout.answers est incomplet", () => {
    const layout = { answers: [{ x: 1, y: 2, width: 3, height: 4 }] }

    expect(answerBoxAt(layout, 1, 2)).toEqual(defaultAnswerBoxes(2)[1])
  })
})

describe("déplacement / redimensionnement", () => {
  const start = { x: 100, y: 100, width: 400, height: 200, fill: "#000000" }

  it("déplace la boîte en gardant son style", () => {
    expect(moveResizeBox(start, "move", 50.4, -20)).toEqual({
      ...start,
      x: 150,
      y: 80,
    })
  })

  it("aimante le centre de la boîte au centre de la slide", () => {
    // Centre à 955 px (5 px du centre) : aimanté à 960.
    const moved = moveResizeBox(start, "move", 655, 0)

    expect(moved.x + moved.width / 2).toBe(SLIDE_WIDTH / 2)
  })

  it("redimensionne en gardant le bord opposé fixe", () => {
    const fromNw = moveResizeBox(start, "nw", 40, 30)

    expect(fromNw).toMatchObject({ x: 140, y: 130, width: 360, height: 170 })
    expect(fromNw.x + fromNw.width).toBe(start.x + start.width)

    expect(moveResizeBox(start, "se", 10, 20)).toMatchObject({
      x: 100,
      y: 100,
      width: 410,
      height: 220,
    })
  })

  it("respecte les tailles minimales", () => {
    const tiny = moveResizeBox(start, "e", -1000, 0)
    const flat = moveResizeBox(start, "n", 0, 1000)

    expect(tiny.width).toBe(MIN_BOX_WIDTH)
    expect(flat.height).toBe(MIN_BOX_HEIGHT)
    expect(flat.y + flat.height).toBe(start.y + start.height)
  })
})

describe("police", () => {
  it("résout question > quiz > interface", () => {
    expect(resolveQuestionFont({ fontFamily: "Lobster" }, {})).toBe("Lobster")
    expect(resolveQuestionFont({}, { fontFamily: "Roboto" })).toBe("Roboto")
    expect(resolveQuestionFont({}, {})).toBeUndefined()
  })

  it("produit une valeur CSS avec repli générique", () => {
    expect(fontFamilyCss("Open Sans")).toBe('"Open Sans", sans-serif')
    expect(fontFamilyCss(undefined)).toBeUndefined()
  })
})
