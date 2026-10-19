import { expect, it } from "vitest"
import type { QuizzMeta } from "@rahoot/common/types/game"
import { buildFolderGrid } from "./folderGrid"

const quiz = (id: string, folder?: string): QuizzMeta => ({
  id,
  subject: id,
  questionCount: 5,
  ...(folder === undefined ? {} : { folder }),
})

it("shows immediate ancestors at root and keeps classified quizzes inside their previews", () => {
  const quizzes = [
    quiz("nested", "Culture/Cinéma/Disney"),
    quiz("loose"),
    quiz("culture", "Culture"),
    quiz("sports", "Sports/Foot"),
  ]
  const result = buildFolderGrid(quizzes, [], null)
  expect(result.folders.map((folder) => folder.path)).toEqual([
    "Culture",
    "Sports",
  ])
  expect(result.folders[0].quizzes.map((item) => item.id)).toEqual([
    "nested",
    "culture",
  ])
  expect(result.quizzes.map((item) => item.id)).toEqual(["loose"])
  expect(result.folders[0].quizzes[0]).toBe(quizzes[0])
  expect(quizzes.map((item) => item.id)).toEqual([
    "nested",
    "loose",
    "culture",
    "sports",
  ])
})

it("shows exact-folder quizzes and immediate subfolders without duplicating visible cards", () => {
  const quizzes = [
    quiz("deep", "Culture/Cinéma/Disney"),
    quiz("direct", "Culture"),
    quiz("film", "Culture/Cinéma"),
    quiz("music", "Culture/Musique"),
    quiz("other", "Culture générale"),
  ]
  const result = buildFolderGrid(quizzes, [], "Culture")
  expect(result.quizzes.map((item) => item.id)).toEqual(["direct"])
  expect(
    result.folders.map((folder) => [
      folder.path,
      folder.quizzes.map((item) => item.id),
    ]),
  ).toEqual([
    ["Culture/Cinéma", ["deep", "film"]],
    ["Culture/Musique", ["music"]],
  ])
  const represented = [
    ...result.quizzes,
    ...result.folders.flatMap((folder) => folder.quizzes),
  ].map((item) => item.id)
  expect(new Set(represented).size).toBe(represented.length)
  expect(
    buildFolderGrid(quizzes, [], "Culture/Cinéma").quizzes.map(
      (item) => item.id,
    ),
  ).toEqual(["film"])
})

it("includes saved empty folders and their ancestors, discarding malformed paths without renaming valid ones", () => {
  const custom = [
    "Vide/Sous-dossier",
    "Vide/Sous-dossier",
    "Culture générale",
    "",
    "/",
    "Invalid//Child",
    "Trailing/",
    " /Child",
  ]
  expect(buildFolderGrid([], custom, null).folders).toEqual([
    { path: "Culture générale", quizzes: [] },
    { path: "Vide", quizzes: [] },
  ])
  expect(buildFolderGrid([], custom, "Vide").folders).toEqual([
    { path: "Vide/Sous-dossier", quizzes: [] },
  ])
  expect(custom).toContain("Invalid//Child")
})

it("excludes system collections at root but allows navigating a guest collection explicitly", () => {
  const quizzes = [
    quiz("archived", "Archive/2025"),
    quiz("guest", "Invités/Alice/Culture"),
    quiz("normal", "Archive personnelle"),
    quiz("root", ""),
  ]
  const custom = ["Archive/Vide", "Invités/Bob/Vide"]
  const root = buildFolderGrid(quizzes, custom, null)
  expect(root.folders.map((folder) => folder.path)).toEqual([
    "Archive personnelle",
  ])
  expect(root.quizzes.map((item) => item.id)).toEqual(["root"])
  const guests = buildFolderGrid(quizzes, custom, "Invités")
  expect(
    guests.folders.map((folder) => [
      folder.path,
      folder.quizzes.map((item) => item.id),
    ]),
  ).toEqual([
    ["Invités/Alice", ["guest"]],
    ["Invités/Bob", []],
  ])
})

it("preserves the incoming quiz order in previews and direct cards and naturally sorts folders", () => {
  const quizzes = [
    quiz("second", "Quiz 10"),
    quiz("root2"),
    quiz("first", "Quiz 2"),
    quiz("third", "Quiz 10/Child"),
    quiz("root1"),
  ]
  const result = buildFolderGrid(quizzes, [], null)
  expect(result.folders.map((folder) => folder.path)).toEqual([
    "Quiz 2",
    "Quiz 10",
  ])
  expect(result.folders[1].quizzes.map((item) => item.id)).toEqual([
    "second",
    "third",
  ])
  expect(result.quizzes.map((item) => item.id)).toEqual(["root2", "root1"])
})
