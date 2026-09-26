import { describe, expect, it } from "vitest"
import { parseQuestionsCsv } from "./import-csv"

const HEADER =
  "type,question,time,cooldown,answers,correct,correctAnswers,min,max,correctValue,tolerance"

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n")

describe("parseQuestionsCsv", () => {
  it("importe une question QCM", () => {
    const { questions, errors } = parseQuestionsCsv(
      csv("mcq,Capitale de la France ?,20,5,Paris|Lyon|Nice,0|2"),
    )

    expect(errors).toEqual([])
    expect(questions).toEqual([
      {
        type: "mcq",
        question: "Capitale de la France ?",
        time: 20,
        cooldown: 5,
        answers: ["Paris", "Lyon", "Nice"],
        solutions: [0, 2],
      },
    ])
  })

  it("importe les types open et slider", () => {
    const { questions, errors } = parseQuestionsCsv(
      csv(
        "open,Synonyme de rapide ?,30,5,,,vite|prompt",
        "slider,Année de fondation ?,20,5,,,,0,2000,300,50",
      ),
    )

    expect(errors).toEqual([])
    expect(questions[0]).toMatchObject({
      type: "open",
      correctAnswers: ["vite", "prompt"],
    })
    expect(questions[1]).toMatchObject({
      type: "slider",
      min: 0,
      max: 2000,
      correctValue: 300,
      tolerance: 50,
    })
  })

  it("gère le BOM, les CRLF, le point-virgule et les guillemets RFC 4180", () => {
    const text = [
      "﻿type;question;answers;correct",
      'mcq;"Il a dit ""oui""; vraiment ?";A|B;1',
    ].join("\r\n")

    const { questions, errors } = parseQuestionsCsv(text)

    expect(errors).toEqual([])
    expect(questions[0]).toMatchObject({
      question: 'Il a dit "oui"; vraiment ?',
      answers: ["A", "B"],
      solutions: [1],
    })
  })

  it("applique les valeurs par défaut et borne time/cooldown", () => {
    const { questions } = parseQuestionsCsv(
      csv("mcq,Q1,,,A|B,0", "mcq,Q2,999,1,A|B,0"),
    )

    expect(questions[0]).toMatchObject({ time: 20, cooldown: 5 })
    expect(questions[1]).toMatchObject({ time: 120, cooldown: 3 })
  })

  it("ignore les lignes invalides en signalant leur numéro", () => {
    const { questions, errors } = parseQuestionsCsv(
      csv(
        "mcq,Une seule réponse,20,5,A,0",
        "mcq,Indice hors limites,20,5,A|B,5",
        "quiz,Type inconnu,20,5,A|B,0",
        "slider,Bornes inversées,20,5,,,,10,0,5,1",
        "mcq,Valide,20,5,A|B,1",
      ),
    )

    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({ question: "Valide" })
    expect(errors).toHaveLength(4)
    expect(errors[0]).toMatch(/^Ligne 2 :/u)
    expect(errors[1]).toMatch(/^Ligne 3 : indice de solution 5/u)
    expect(errors[2]).toMatch(/^Ligne 4 : type "quiz" non supporté/u)
    expect(errors[3]).toMatch(/^Ligne 5 : "min" \(10\)/u)
  })

  it("rejette un fichier vide ou sans colonnes obligatoires", () => {
    expect(parseQuestionsCsv("  \n\n").errors).toEqual([
      "Le fichier CSV est vide ou illisible.",
    ])
    expect(parseQuestionsCsv("foo,bar\n1,2").errors[0]).toMatch(
      /^En-tête invalide/u,
    )
  })
})
