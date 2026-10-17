// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest"
import type { QuizzMeta } from "@rahoot/common/types/game"
import {
  libraryScope,
  matchesSearch,
  moveDestinations,
  moveQuizInOrder,
  readPreferences,
  sortLibrary,
} from "./library"

const quizzes: QuizzMeta[] = [
  {
    id: "a",
    subject: "Été Disney",
    folder: "Culture/Cinéma",
    tags: ["famille"],
    updatedAt: 10,
    questionCount: 12,
    estimatedDurationSec: 600,
  },
  { id: "b", subject: "Quiz 10", updatedAt: 20, questionCount: 5 },
  { id: "c", subject: "Quiz 2", questionCount: 20, estimatedDurationSec: 300 },
]
beforeEach(() => localStorage.clear())
it("sorts by real revision, duration and natural title without mutating the library", () => {
  expect(sortLibrary(quizzes, "recent").map((q) => q.id)).toEqual([
    "b",
    "a",
    "c",
  ])
  expect(sortLibrary(quizzes, "duration").map((q) => q.id)).toEqual([
    "c",
    "a",
    "b",
  ])
  expect(sortLibrary(quizzes, "title").map((q) => q.id)).toEqual([
    "a",
    "c",
    "b",
  ])
  expect(sortLibrary(quizzes, "questions").map((q) => q.id)).toEqual([
    "c",
    "a",
    "b",
  ])
  expect(quizzes[0].id).toBe("a")
})
it("searches accents, folders, public titles and tags", () => {
  for (const query of ["ete", "cinema", "FAMILLE"]) {
    expect(matchesSearch(quizzes[0], query)).toBe(true)
  }
  expect(
    matchesSearch({ ...quizzes[0], publicName: "Soirée magique" }, "magique"),
  ).toBe(true)
})
it("includes empty folders and their ancestors while excluding system destinations", () => {
  expect(
    moveDestinations(
      [
        ...quizzes,
        { ...quizzes[0], folder: "Invités/Alice" },
        { ...quizzes[0], folder: "Archive/2025" },
      ],
      ["Vide", "Sports/Foot"],
    ),
  ).toEqual(["Culture", "Culture/Cinéma", "Sports", "Sports/Foot", "Vide"])
})
it("keeps preferences and favorites isolated by guest account", () => {
  const alice = libraryScope("guest", "Alice")
  localStorage.setItem(
    `rahoot:library:${alice}`,
    JSON.stringify({ sort: "title", layout: "list", favorites: ["a"] }),
  )
  expect(readPreferences(alice).favorites).toEqual(["a"])
  expect(readPreferences(libraryScope("guest", "Bob")).favorites).toEqual([])
  expect(readPreferences(libraryScope("admin")).favorites).toEqual([])
  localStorage.setItem(`rahoot:library:${alice}`, "broken")
  expect(readPreferences(alice).sort).toBe("recent")
})
it("reorders an evening without changing its quiz selection or moving past the boundaries", () => {
  const ids = ["a", "b", "c"]
  expect(moveQuizInOrder(ids, "c", -1)).toEqual(["a", "c", "b"])
  expect(moveQuizInOrder(ids, "a", -1)).toBe(ids)
  expect(moveQuizInOrder(ids, "missing", 1)).toBe(ids)
})
