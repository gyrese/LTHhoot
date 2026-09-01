import { describe, expect, it } from "vitest"
import {
  isSameAnswer,
  normalizeAnswer,
} from "@rahoot/common/utils/normalize-answer"

describe("normalizeAnswer", () => {
  it("ignore la casse et les espaces de bord", () => {
    expect(normalizeAnswer("  pARIS  ")).toBe("paris")
  })

  it("ignore les accents et les ligatures", () => {
    expect(normalizeAnswer("Éléphant")).toBe("elephant")
    expect(normalizeAnswer("Cœur")).toBe("coeur")
    expect(normalizeAnswer("Bœuf à l'os")).toBe("boeufalos")
  })

  it("conserve les symboles mathématiques et monétaires", () => {
    expect(normalizeAnswer("12 °C")).toBe("12°c")
    expect(normalizeAnswer("50 €")).toBe("50€")
    expect(normalizeAnswer("50")).not.toBe(normalizeAnswer("50 €"))
  })
})

describe("isSameAnswer — insensibilité à la ponctuation", () => {
  it("ignore l'apostrophe, droite comme typographique", () => {
    expect(isSameAnswer("l'eau", "leau")).toBe(true)
    expect(isSameAnswer("l’eau", "l'eau")).toBe(true)
    expect(isSameAnswer("Jeanne d'Arc", "jeanne darc")).toBe(true)
  })

  it("ignore les tirets", () => {
    expect(isSameAnswer("Jean-Pierre", "jean pierre")).toBe(true)
    expect(isSameAnswer("Saint-Étienne", "saint etienne")).toBe(true)
    expect(isSameAnswer("c'est-à-dire", "cest a dire")).toBe(true)
  })

  it("ignore virgules, points, deux-points et points d'exclamation", () => {
    expect(isSameAnswer("Paris, France", "paris france")).toBe(true)
    expect(isSameAnswer("J.F.K.", "jfk")).toBe(true)
    expect(isSameAnswer("Attention : danger", "attention danger")).toBe(true)
    expect(isSameAnswer("Bonjour !", "bonjour")).toBe(true)
    expect(isSameAnswer("Qui ?", "qui")).toBe(true)
  })

  it("ignore guillemets, parenthèses et barres obliques", () => {
    expect(isSameAnswer('"Le Cid"', "le cid")).toBe(true)
    expect(isSameAnswer("Bruxelles (Belgique)", "bruxelles belgique")).toBe(
      true,
    )
    expect(isSameAnswer("24/7", "247")).toBe(true)
  })

  it("ignore les espaces internes (nombres séparés, mots collés)", () => {
    expect(isSameAnswer("1 000", "1000")).toBe(true)
    expect(isSameAnswer("la tour Eiffel", "latoureiffel")).toBe(true)
  })

  it("cumule accents et ponctuation", () => {
    expect(isSameAnswer("Côte-d'Ivoire", "cote d ivoire")).toBe(true)
  })

  it("distingue toujours deux réponses réellement différentes", () => {
    expect(isSameAnswer("Paris", "Lyon")).toBe(false)
    expect(isSameAnswer("chat", "chats")).toBe(false)
  })
})
