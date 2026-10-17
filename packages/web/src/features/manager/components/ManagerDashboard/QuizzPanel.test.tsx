// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { ManagerConfig } from "@rahoot/common/types/manager"
import QuizzPanel from "./QuizzPanel"

const mocks = vi.hoisted(() => ({
  config: { quizz: [], results: [], role: "admin" } as ManagerConfig,
  emit: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock("@rahoot/web/features/manager/contexts/config-context", () => ({
  useConfig: () => mocks.config,
}))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({ socket: { connected: true, emit: mocks.emit } }),
  useEvent: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }))
vi.mock("@rahoot/web/features/manager/components/ShareSocialModal", () => ({
  ShareSocialModal: () => null,
}))
vi.mock("react-hot-toast", () => ({
  default: { success: mocks.success, error: mocks.error },
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: "fr" },
  }),
}))
vi.mock("animejs", () => ({
  animate: vi.fn(),
  createScope: () => {
    const scope = {
      add: (
        callback: (_self: {
          matches: { reducedMotion: boolean; hover: boolean }
        }) => unknown,
      ) => {
        callback({ matches: { reducedMotion: true, hover: false } })
        return scope
      },
      revert: vi.fn(),
    }
    return scope
  },
}))

const defaults = {
  search: "",
  setSearch: vi.fn(),
  activeFolder: null,
  activeTag: null,
  selectedQuizz: null,
  setSelectedQuizz: vi.fn(),
  onMoveToFolder: vi.fn(),
  onOpenFolder: vi.fn(),
  onClearTag: vi.fn(),
}
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.config = {
    role: "admin",
    results: [],
    quizz: [
      {
        id: "a",
        subject: "Disney",
        folder: "Culture",
        questionCount: 10,
        updatedAt: 10,
      },
      { id: "b", subject: "Musique", questionCount: 5, updatedAt: 20 },
      {
        id: "guest:alice:x",
        subject: "Quiz invité",
        folder: "Invités/Alice",
        questionCount: 2,
      },
    ],
  }
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "")
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open")
    },
  })
})
afterEach(cleanup)

it("filters favorites, persists the chosen layout and keeps portrait cards", () => {
  const view = render(<QuizzPanel {...defaults} />)
  expect(
    screen.getByRole("button", { name: "Disney" }).closest("article")
      ?.className,
  ).toContain("aspect-[3/4]")
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.favorite:Disney" }),
  )
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.filterOptions" }),
  )
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.filter.favorites" }),
  )
  expect(screen.queryByRole("button", { name: "Musique" })).toBeNull()
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.layout.list" }),
  )
  view.unmount()
  render(<QuizzPanel {...defaults} />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.filterOptions" }),
  )
  expect(
    screen
      .getByRole("button", { name: "manager:library.layout.list" })
      .getAttribute("aria-pressed"),
  ).toBe("true")
})

it("moves selected quizzes to an empty folder and only reports success after server confirmation", () => {
  localStorage.setItem("rahoot:folders", JSON.stringify(["Vide"]))
  const move = vi.fn()
  const view = render(<QuizzPanel {...defaults} onMoveToFolder={move} />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.organize" }),
  )
  fireEvent.click(screen.getByRole("button", { name: "Disney" }))
  fireEvent.click(screen.getByRole("button", { name: "Musique" }))
  fireEvent.click(screen.getByRole("button", { name: "manager:library.move" }))
  const dialog = screen.getByRole("dialog")
  fireEvent.change(within(dialog).getByRole("combobox"), {
    target: { value: "Vide" },
  })
  fireEvent.click(
    within(dialog).getByRole("button", { name: "manager:library.move" }),
  )
  expect(move.mock.calls).toEqual([
    ["a", "Vide"],
    ["b", "Vide"],
  ])
  expect(mocks.success).not.toHaveBeenCalled()
  mocks.config = {
    ...mocks.config,
    quizz: mocks.config.quizz.map((q) =>
      q.id.startsWith("guest:") ? q : { ...q, folder: "Vide" },
    ),
  }
  view.rerender(<QuizzPanel {...defaults} onMoveToFolder={move} />)
  expect(mocks.success).toHaveBeenCalledWith("manager:library.moved")
})

it("offers read-only guest quizzes without edit, delete or move actions", () => {
  render(<QuizzPanel {...defaults} activeFolder="Invités" />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.actions:Quiz invité" }),
  )
  expect(
    screen.queryByRole("menuitem", { name: "manager:library.move" }),
  ).toBeNull()
  expect(screen.queryByRole("menuitem", { name: "common:delete" })).toBeNull()
  expect(
    screen.getByRole("menuitem", { name: "manager:quizz.exportAs.json" }),
  ).toBeTruthy()
})

it("supports menu keyboard navigation and restores focus on Escape", () => {
  render(<QuizzPanel {...defaults} />)
  const trigger = screen.getByRole("button", {
    name: "manager:library.actions:Disney",
  })
  fireEvent.click(trigger)
  const menu = screen.getByRole("menu")
  const items = within(menu).getAllByRole("menuitem")
  expect(document.activeElement).toBe(items[0])
  fireEvent.keyDown(menu, { key: "End" })
  expect(document.activeElement).toBe(items.at(-1))
  fireEvent.keyDown(menu, { key: "Escape" })
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it("keeps sorting and filters folded until requested and makes an empty filtered view recoverable", () => {
  render(<QuizzPanel {...defaults} />)
  expect(
    screen.queryByRole("combobox", { name: "manager:library.sortLabel" }),
  ).toBeNull()
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.filterOptions" }),
  )
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.filter.favorites" }),
  )
  expect(screen.queryByRole("button", { name: "Disney" })).toBeNull()
  expect(
    screen.getAllByRole("button", { name: "manager:library.resetFilters" }),
  ).toHaveLength(2)
  expect(
    screen.getAllByRole("button", { name: "manager:quizz.create" }),
  ).toHaveLength(1)
  fireEvent.click(
    screen.getAllByRole("button", { name: "manager:library.resetFilters" })[1],
  )
  expect(screen.getByRole("button", { name: "Disney" })).toBeTruthy()
})

it("does not offer a no-op move and clears a batch when its folder changes", () => {
  const view = render(<QuizzPanel {...defaults} activeFolder="Culture" />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.organize" }),
  )
  fireEvent.click(screen.getByRole("button", { name: "Disney" }))
  fireEvent.click(screen.getByRole("button", { name: "manager:library.move" }))
  const dialog = screen.getByRole("dialog")
  expect(
    within(dialog)
      .getByRole("button", { name: "manager:library.move" })
      .hasAttribute("disabled"),
  ).toBe(true)
  fireEvent.click(within(dialog).getByRole("button", { name: "common:cancel" }))
  view.rerender(<QuizzPanel {...defaults} />)
  expect(
    screen
      .getByRole("button", { name: "manager:library.move" })
      .hasAttribute("disabled"),
  ).toBe(true)
})

it("can filter archived quizzes with no original folder separately from all origins", () => {
  mocks.config.quizz = [
    {
      id: "root",
      subject: "Sans dossier",
      folder: "Archive",
      archivedAt: 100,
      questionCount: 2,
    },
    {
      id: "filed",
      subject: "Dossier",
      folder: "Archive",
      archivedFrom: "Culture",
      archivedAt: 200,
      questionCount: 2,
    },
  ]
  render(<QuizzPanel {...defaults} activeFolder="Archive" />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.filterOptions" }),
  )
  const origin = screen.getByRole("combobox", {
    name: "manager:archive.origin",
  })
  const rootOption = within(origin).getByRole("option", {
    name: "manager:archive.noOrigin",
  }) as HTMLOptionElement
  fireEvent.change(origin, { target: { value: rootOption.value } })
  expect(screen.getByRole("button", { name: "Sans dossier" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Dossier" })).toBeNull()
})

it("clears a hidden play selection without touching a planned evening", () => {
  const select = vi.fn()
  const view = render(
    <QuizzPanel
      {...defaults}
      selectedQuizz="a"
      setSelectedQuizz={select}
      search="Musique"
    />,
  )
  expect(select).toHaveBeenCalledWith(null)
  select.mockClear()
  view.rerender(
    <QuizzPanel
      {...defaults}
      selectedQuizz="a"
      setSelectedQuizz={select}
      search="Musique"
      eveningMode
      eveningQuizIds={["a"]}
    />,
  )
  expect(select).not.toHaveBeenCalled()
})
