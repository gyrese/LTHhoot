import { EVENTS } from "@rahoot/common/constants"
import type { Player } from "@rahoot/common/types/game"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { AnimatePresence, motion } from "motion/react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  data: ManagerStatusDataMap["SHOW_ROOM"]
}

const WAITING_ANIMATION_STATES = ["waiting"] as const

const Room = ({ data }: Props) => {
  const { text, inviteCode } = data
  const { gameId } = useManagerStore()
  const { socket } = useSocket()
  const webUrl = window.location.origin
  const joinUrl = inviteCode ? `${webUrl}/?pin=${inviteCode}` : webUrl
  const { players } = useManagerStore()
  const [playerList, setPlayerList] = useState<Player[]>(players)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const { t } = useTranslation()

  useEvent(EVENTS.MANAGER.NEW_PLAYER, (player) => {
    setPlayerList((prev) => [...prev, player])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (playerId) => {
    setPlayerList((prev) => prev.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (playerId) => {
    setPlayerList((prev) => prev.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.GAME.TOTAL_PLAYERS, (total) => {
    setTotalPlayers(total)
  })

  const handleKick = (playerId: string) => () => {
    if (!gameId) {
      return
    }

    socket?.emit(EVENTS.MANAGER.KICK_PLAYER, {
      gameId,
      playerId,
    })
  }

  const handleEndGame = () => {
    if (!gameId || !socket) {
      return
    }

    if (
      window.confirm(
        t("game:confirmEndGame", "Voulez-vous vraiment fermer cette session ?"),
      )
    ) {
      socket.emit(EVENTS.MANAGER.END_GAME, { gameId })
    }
  }

  return (
    <section className="relative mx-auto flex w-full flex-1 flex-col items-center justify-center overflow-hidden">
      <button
        onClick={handleEndGame}
        className="absolute top-4 right-4 z-50 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
      >
        {t("game:closeSession", "Fermer la session")}
      </button>

      {data.salonImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${data.salonImage})` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}

      <div className="relative z-10 flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-2">
        <div className="mb-10 flex flex-col-reverse items-center gap-3 md:flex-row md:items-stretch">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="game-pin-out flex flex-col justify-center rounded-md bg-white px-6 py-4">
              <p className="text-2xl font-bold">{t("game:joinInstruction")}</p>
              <p className="w-60 text-lg font-extrabold break-all">{webUrl}</p>
            </div>

            <div className="game-pin-in flex flex-col justify-center rounded-md bg-white px-6 py-4 text-center md:rounded-l-none md:text-left">
              <p className="text-2xl font-bold">{t("game:gamePinLabel")}</p>
              <p id="game-pin" className="text-6xl font-extrabold">
                {inviteCode}
              </p>
            </div>
          </div>

          <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-md bg-white p-2">
            {inviteCode && <QRCodeSVG size={144} value={joinUrl} />}
          </div>
        </div>

        <h2 className="mb-4 text-4xl font-bold text-white drop-shadow-lg">
          {t(text)}
        </h2>

        <div className="mb-6 flex items-center justify-center rounded-full bg-black/40 px-6 py-3">
          <span className="text-2xl font-bold text-white drop-shadow-md">
            {t("game:playersJoined")}
            <span
              key={totalPlayers}
              className="anim-pop-in inline-block tabular-nums"
            >
              {totalPlayers}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <AnimatePresence>
            {playerList.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, scale: 0.4, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4, y: 20 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="bg-primary flex items-center gap-3 rounded-md px-4 py-2 font-bold text-white shadow-lg"
                onClick={handleKick(player.id)}
              >
                <GameAvatar
                  seed={player.avatar || player.username}
                  animated
                  animationStates={WAITING_ANIMATION_STATES}
                  className="h-11 w-11 rounded-full border-2 border-white/50"
                  style={{
                    animationDelay: `${(playerList.indexOf(player) % 6) * 0.2}s`,
                  }}
                />
                <span className="cursor-pointer text-2xl drop-shadow-sm hover:line-through">
                  {player.username}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

export default Room
