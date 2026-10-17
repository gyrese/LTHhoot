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
import { EVENTS } from "@rahoot/common/constants"
import DashboardSidebar from "./DashboardSidebar"

const mocks = vi.hoisted(() => ({
  config: { quizz: [], results: [], role: "admin" } as ManagerConfig,
  emit: vi.fn(),
}))
vi.mock("@rahoot/web/features/manager/contexts/config-context", () => ({
  useConfig: () => mocks.config,
}))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({ socket: { connected: true, emit: mocks.emit } }),
  useEvent: vi.fn(),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}))
vi.mock("animejs", () => ({
  animate: vi.fn(),
  createScope: () => {
    const scope = {
      add: (
        callback: (_self: { matches: { reducedMotion: boolean } }) => unknown,
      ) => {
        callback({ matches: { reducedMotion: true } })
        return scope
      },
      revert: vi.fn(),
    }
    return scope
  },
}))

const defaults = {
  isOpen: true,
  onClose: vi.fn(),
  activeFolder: null,
  setActiveFolder: vi.fn(),
  activeTag: null,
  setActiveTag: vi.fn(),
  view: "quizz" as const,
  setView: vi.fn(),
  onMoveToFolder: vi.fn(),
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.config = { role: "admin", results: [], quizz: [] }
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

it("provides navigable ancestors for imported nested folders without an explicit parent", () => {
  mocks.config.quizz = [
    { id: "a", subject: "Disney", folder: "Culture/Cinéma", questionCount: 5 },
  ]
  render(<DashboardSidebar {...defaults} />)
  fireEvent.click(screen.getByText("Culture").closest("button")!)
  expect(defaults.setActiveFolder).toHaveBeenLastCalledWith("Culture")
  expect(defaults.onClose).toHaveBeenCalled()
  fireEvent.click(screen.getByText("Cinéma").closest("button")!)
  expect(defaults.setActiveFolder).toHaveBeenLastCalledWith("Culture/Cinéma")
})

it("returns the library navigation to the root and clears the active tag", () => {
  render(
    <DashboardSidebar
      {...defaults}
      activeFolder="Culture"
      activeTag="famille"
    />,
  )
  fireEvent.click(
    screen.getByRole("button", { name: /^manager:library.title/u }),
  )
  expect(defaults.setView).toHaveBeenCalledWith("quizz")
  expect(defaults.setActiveFolder).toHaveBeenCalledWith(null)
  expect(defaults.setActiveTag).toHaveBeenCalledWith(null)
  expect(defaults.onClose).toHaveBeenCalled()
})

it("keeps custom folders isolated when a mounted sidebar changes guest account", () => {
  localStorage.setItem(
    "rahoot:folders:guest:Alice",
    JSON.stringify(["Alice vide"]),
  )
  localStorage.setItem("rahoot:folders:guest:Bob", JSON.stringify(["Bob vide"]))
  mocks.config = { role: "guest", guestName: "Alice", quizz: [], results: [] }
  const view = render(<DashboardSidebar {...defaults} />)
  expect(screen.getByText("Alice vide")).toBeTruthy()
  mocks.config = { ...mocks.config, guestName: "Bob" }
  view.rerender(<DashboardSidebar {...defaults} />)
  expect(screen.queryByText("Alice vide")).toBeNull()
  expect(screen.getByText("Bob vide")).toBeTruthy()
  fireEvent.click(
    screen.getByRole("button", { name: "manager:sidebar.newFolder" }),
  )
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "manager:sidebar.newFolderPlaceholder",
    }),
    { target: { value: "Nouveau Bob" } },
  )
  fireEvent.click(
    screen.getByRole("button", { name: "manager:sidebar.createConfirm" }),
  )
  expect(JSON.parse(localStorage.getItem("rahoot:folders:guest:Bob")!)).toEqual(
    ["Bob vide", "Nouveau Bob"],
  )
  expect(
    JSON.parse(localStorage.getItem("rahoot:folders:guest:Alice")!),
  ).toEqual(["Alice vide"])
})

it("confirms deleting a folder and moves its quizzes to the root without deleting quizzes", () => {
  mocks.config.quizz = [
    { id: "a", subject: "Disney", folder: "Culture", questionCount: 5 },
    { id: "b", subject: "Films", folder: "Culture/Cinéma", questionCount: 5 },
    { id: "c", subject: "Foot", folder: "Sports", questionCount: 5 },
  ]
  localStorage.setItem(
    "rahoot:folders",
    JSON.stringify(["Culture", "Culture/Vide", "Sports"]),
  )
  render(<DashboardSidebar {...defaults} activeFolder="Culture/Cinéma" />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:library.actions:Culture" }),
  )
  fireEvent.click(
    screen.getByRole("menuitem", { name: "manager:sidebar.deleteFolder" }),
  )
  expect(defaults.onMoveToFolder).not.toHaveBeenCalled()
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "common:delete",
    }),
  )
  expect(defaults.onMoveToFolder.mock.calls).toEqual([
    ["a", null],
    ["b", null],
  ])
  expect(defaults.setActiveFolder).toHaveBeenCalledWith(null)
  expect(JSON.parse(localStorage.getItem("rahoot:folders")!)).toEqual([
    "Sports",
  ])
  expect(
    mocks.emit.mock.calls.some(([event]) => event === EVENTS.QUIZZ.DELETE),
  ).toBe(false)
})
