import type { GameResult, Player } from "@rahoot/common/types/game"
import Config from "@rahoot/socket/services/config"
import { EveningTracker } from "@rahoot/socket/services/evening-tracker"
import * as atomicWrite from "@rahoot/socket/utils/atomic-write"
import { mkdtempSync, readFileSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

const folders: string[] = []
const tracker = () => {
  const dir = mkdtempSync(join(tmpdir(), "evening-"))
  folders.push(dir)
  const file = join(dir, "evenings.json")

  return { file, service: new EveningTracker(file) }
}
const player = (
  clientId: string,
  username: string,
  points: number,
): Player => ({
  id: `socket-${clientId}`,
  clientId,
  username,
  points,
  connected: true,
  streak: 0,
})
const result = (id: string): GameResult => ({
  id,
  subject: "Quiz",
  date: "2026-10-19",
  players: [],
  questions: [],
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true })
  }
})

describe("Classement de soirée", () => {
  it("conserve l'état et permet de réessayer après un échec d'écriture", () => {
    const { service } = tracker()
    const write = vi.spyOn(atomicWrite, "writeFileAtomic")
    const fail = () => {
      throw new Error("Disque indisponible")
    }
    write.mockImplementationOnce(fail)
    expect(() => service.start("host")).toThrow("Disque indisponible")
    expect(service.get("host")).toBeNull()
    const { id } = service.start("host")
    write.mockImplementationOnce(fail)
    expect(() =>
      service.record("host", id, result("q1"), [player("a", "Alex", 100)]),
    ).toThrow()
    expect(service.get("host")?.quizCount).toBe(0)
    service.record("host", id, result("q1"), [player("a", "Alex", 100)])
    const before = service.get("host")
    const save = vi.spyOn(Config, "saveResult").mockReturnValue(false)
    expect(() => service.finish("host")).toThrow("Impossible de sauvegarder")
    expect(service.get("host")).toEqual(before)
    save.mockReturnValue(true)
    write.mockImplementationOnce(fail)
    expect(() => service.finish("host")).toThrow("Disque indisponible")
    expect(service.get("host")).toEqual(before)
    expect(service.finish("host")?.leaderboard[0].points).toBe(100)
  })
  it("cumule par identité, conserve les absents et sépare les pseudos identiques", () => {
    const { service } = tracker()
    const { id } = service.start("host")
    expect(service.start("host").id).toBe(id)
    service.record("host", id, result("q1"), [
      player("a", "Alex", 100),
      player("b", "Alex", 50),
    ])
    const summary = service.record("host", id, result("q2"), [
      player("b", "Bob", 50),
    ])!
    expect(summary.quizCount).toBe(2)
    expect(summary.leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          username: "Alex",
          points: 100,
          quizCount: 1,
          rank: 1,
        }),
        expect.objectContaining({
          username: "Bob",
          points: 100,
          quizCount: 2,
          rank: 1,
        }),
      ]),
    )
    expect(new Set(summary.leaderboard.map((p) => p.id)).size).toBe(2)
    expect(JSON.stringify(summary)).not.toContain("clientId")
    expect(summary.leaderboard.map((p) => p.id)).not.toContain("a")
  })

  it("restaure le cumul et la déduplication après redémarrage", () => {
    const { service, file } = tracker()
    const { id } = service.start("host")
    service.record("host", id, result("q1"), [player("a", "Alex", 100)])
    const restored = new EveningTracker(file)
    expect(restored.getActiveId("host")).toBe(id)
    expect(restored.get("host")).toEqual(service.get("host"))
    restored.record("host", id, result("q1"), [player("a", "Alex", 100)])
    expect(restored.get("host")?.quizCount).toBe(1)
    restored.record("host", id, result("q2"), [player("a", "Alex", 25)])
    expect(restored.get("host")?.leaderboard[0].points).toBe(125)
  })

  it("clôture une seule fois, archive et isole la soirée suivante et les hôtes", () => {
    const save = vi.spyOn(Config, "saveResult").mockReturnValue(true)
    const { service, file } = tracker()
    const { id } = service.start("host")
    service.record("host", id, result("q1"), [player("a", "Alex", 100)])
    const finished = service.finish("host")
    expect(finished?.endedAt).toBeTruthy()
    expect(service.finish("host")).toEqual(finished)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Soirée", questions: [] }),
    )
    expect(JSON.stringify(save.mock.calls)).not.toContain("clientId")
    service.record("host", id, result("q2"), [player("a", "Alex", 200)])
    expect(service.get("host")).toEqual(finished)
    expect(new EveningTracker(file).get("host")).toEqual(finished)
    expect(service.getActiveId("host")).toBeUndefined()
    const next = service.start("host")
    expect(next.id).not.toBe(id)
    expect(next.leaderboard).toEqual([])
    service.record("host", id, result("q3"), [player("a", "Alex", 200)])
    expect(service.get("host")?.quizCount).toBe(0)
    service.start("other")
    expect(service.get("other")?.id).not.toBe(next.id)
    expect(JSON.parse(readFileSync(file, "utf-8"))).toHaveLength(3)
  })
})
