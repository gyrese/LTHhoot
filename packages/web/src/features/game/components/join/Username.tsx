import { EVENTS } from "@rahoot/common/constants"
import { STATUS } from "@rahoot/common/types/game/status"
import Button from "@rahoot/web/components/Button"
import Card from "@rahoot/web/components/Card"
import Input from "@rahoot/web/components/Input"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"

import { useNavigate } from "@tanstack/react-router"
import { RefreshCcw } from "lucide-react"
import { type KeyboardEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 as uuid } from "uuid"

const AVATAR_API = "https://api.dicebear.com/7.x/pixel-art/svg?seed="

const Username = () => {
  const { socket } = useSocket()
  const { gameId, login, setStatus } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [avatarSeed, setAvatarSeed] = useState("")
  const [isManualAvatar, setIsManualAvatar] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (!isManualAvatar) {
      setAvatarSeed(username || "default")
    }
  }, [username, isManualAvatar])

  const randomizeAvatar = () => {
    setIsManualAvatar(true)
    setAvatarSeed(uuid())
  }

  const handleLogin = () => {
    if (!gameId) {
      return
    }

    socket?.emit(EVENTS.PLAYER.LOGIN, {
      gameId,
      data: { username, avatar: avatarSeed },
    })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  useEvent(EVENTS.GAME.SUCCESS_JOIN, (gameId) => {
    setStatus(STATUS.WAIT, { text: "game:waitingForPlayers" })
    login(username, avatarSeed)

    navigate({ to: "/party/$gameId", params: { gameId } })
  })

  return (
    <Card className="flex flex-col items-center">
      <div className="relative mb-6">
        <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
          <img
            alt="Avatar"
            className="h-full w-full object-cover"
            src={`${AVATAR_API}${avatarSeed}`}
          />
        </div>
        <button
          className="absolute -right-2 -top-2 rounded-full bg-white p-2 text-slate-600 shadow-md transition-transform hover:scale-110 active:scale-95"
          onClick={randomizeAvatar}
          type="button"
        >
          <RefreshCcw size={20} />
        </button>
      </div>

      <Input
        className="text-center"
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("game:usernamePlaceholder")}
      />
      <Button className="mt-4 w-full" onClick={handleLogin}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Username
