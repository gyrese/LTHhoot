import type { Socket } from "@rahoot/common/types/game/socket"
import manager, { getRemotePin } from "@rahoot/socket/services/manager"
import { afterEach, describe, expect, it, vi } from "vitest"

const fakeSocket = (clientId: string) =>
  ({
    id: `socket-${clientId}`,
    handshake: { auth: { clientId }, address: "1.2.3.4", headers: {} },
    emit: vi.fn(),
  }) as unknown as Socket

describe("PIN de télécommande", () => {
  afterEach(() => {
    delete process.env.REMOTE_PIN
  })

  it("est désactivé sans variable d'environnement ou si trop court", () => {
    expect(getRemotePin()).toBeNull()

    process.env.REMOTE_PIN = "123"
    expect(getRemotePin()).toBeNull()

    process.env.REMOTE_PIN = " 4821 "
    expect(getRemotePin()).toBe("4821")
  })

  it("une session télécommande pilote mais n'accède à aucune bibliothèque", () => {
    const socket = fakeSocket("remote-device")

    manager.loginRemote(socket)

    expect(manager.canPilot(socket)).toBe(true)
    // Ni droits admin, ni accès HTTP aux médias.
    expect(manager.isLogged(socket)).toBe(false)
    expect(manager.isAuthorized("remote-device")).toBe(false)
    expect(manager.getMediaAccount("remote-device")).toBeUndefined()

    // Les handlers de bibliothèque (quiz, config) refusent la session.
    const handler = vi.fn()
    manager.withAnyAuth(socket, handler)()

    expect(handler).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith("manager:unauthorized")

    manager.logout(socket)
  })

  it("révoque les sessions d'un invité supprimé", () => {
    const socket = fakeSocket("guest-device")

    manager.loginGuest(socket, "invite1")
    expect(manager.isAuthorized("guest-device")).toBe(true)

    expect(manager.revokeGuest("invite1")).toEqual(["guest-device"])
    expect(manager.isAuthorized("guest-device")).toBe(false)
  })
})
