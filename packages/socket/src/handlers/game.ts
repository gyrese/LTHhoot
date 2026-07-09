import { EVENTS } from "@rahoot/common/constants"
import { inviteCodeValidator } from "@rahoot/common/validators/auth"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import Game from "@rahoot/socket/services/game"
import Manager from "@rahoot/socket/services/manager"
import Registry from "@rahoot/socket/services/registry"
import { withGame, withManagerGame } from "@rahoot/socket/utils/game"

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()

  // Sonde de vivacité du watchdog client (retour d'arrière-plan mobile) : on
  // acquitte immédiatement pour prouver que le lien est réellement vivant.
  socket.on(EVENTS.CONNECTION.PING, (ack) => {
    if (typeof ack === "function") {
      ack()
    }
  })

  socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  socket.on(EVENTS.MANAGER.RECONNECT, ({ gameId }) => {
    // Socket authentifié manager (manager principal ou télécommande)
    if (Manager.isLogged(socket)) {
      const game = registry.getGameById(gameId)

      if (game) {
        // Manager principal (même clientId) → reconnectManager (met à jour _manager.id)
        // Télécommande (clientId différent) → reconnectRemote (ne touche pas _manager.id)
        if (game.manager.clientId === socket.handshake.auth.clientId) {
          game.reconnect(socket)
        } else {
          game.reconnectRemote(socket)
        }

        return
      }

      socket.emit(EVENTS.GAME.RESET, "game.expired")

      return
    }

    // Reconnexion standard par clientId (même navigateur, sans mot de passe)
    const game = registry.getManagerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "game.expired")
  })

  socket.on(EVENTS.GAME.CREATE, (payload) => {
    if (!Manager.isLogged(socket)) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    let quizzId = ""
    let powerUpsEnabled = false
    let disabledPowerUps: string[] = []

    if (typeof payload === "string") {
      quizzId = payload
    } else if (payload && typeof payload === "object") {
      quizzId = payload.quizId
      powerUpsEnabled = Boolean(payload.powerUpsEnabled)
      disabledPowerUps = Array.isArray(payload.disabledPowerUps)
        ? payload.disabledPowerUps
        : []
    } else {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "quizz.notFound")

      return
    }

    const quizzList = Config.quizz()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "quizz.notFound")

      return
    }

    const game = new Game(io, socket, quizz, {
      powerUpsEnabled,
      disabledPowerUps,
    })
    registry.addGame(game)
  })

  socket.on(EVENTS.PLAYER.JOIN, (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(inviteCode)

    if (!game) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

      return
    }

    socket.emit(EVENTS.GAME.SUCCESS_ROOM, game.gameId)
  })

  socket.on(EVENTS.PLAYER.LOGIN, ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.join(socket, data.username, data.avatar),
    ),
  )

  socket.on(EVENTS.MANAGER.KICK_PLAYER, ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on(EVENTS.MANAGER.START_GAME, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on(EVENTS.MANAGER.START_DEMO, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.startDemo(socket)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, ({ gameId, data }, ack) => {
    // On répond TOUJOURS un accusé : le client n'affiche « répondu » que sur
    // confirmation et réessaie tant qu'il n'a rien reçu (cf. Answers.tsx).
    const game = gameId ? registry.getGameById(gameId) : undefined

    if (!game) {
      ack({ status: "not_found" })

      return
    }

    const status = game.selectAnswer(socket, {
      answerId: data.answerId,
      textAnswer: data.textAnswer,
      numberAnswer: data.numberAnswer,
      orderAnswer: data.orderAnswer,
    })

    ack({ status })
  })

  socket.on(EVENTS.PLAYER.TIE_BREAK_ANSWER, ({ answerId }, ack) => {
    // Résolu via le socket joueur uniquement, même pattern que POWER_UP.USE :
    // un duel ne peut être répondu que par un joueur réellement inscrit.
    // L'ack est TOUJOURS appelé (même contrat que SELECTED_ANSWER) : le client
    // ne verrouille sa saisie que sur confirmation et retente sinon.
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      if (typeof ack === "function") {
        ack({ status: "no_player" })
      }

      return
    }

    const status = game.submitTieBreakAnswer(socket, answerId)

    if (typeof ack === "function") {
      ack({ status })
    }
  })

  socket.on(EVENTS.MANAGER.ABORT_QUIZ, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on(EVENTS.MANAGER.NEXT_QUESTION, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on(EVENTS.MANAGER.SHOW_LEADERBOARD, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.showLeaderboard()),
  )

  socket.on(EVENTS.MANAGER.VALIDATE_OPEN_ANSWER, ({ gameId, data }) =>
    withManagerGame(gameId, socket, (game) =>
      game.validateOpenAnswer(data.text),
    ),
  )

  socket.on(EVENTS.MANAGER.INVALIDATE_OPEN_ANSWER, ({ gameId, data }) =>
    withManagerGame(gameId, socket, (game) =>
      game.invalidateOpenAnswer(data.text),
    ),
  )

  socket.on(EVENTS.MANAGER.FINALIZE_OPEN_ANSWERS, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.finalizeOpenAnswers()),
  )

  socket.on(EVENTS.MANAGER.END_GAME, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.endGame()),
  )

  socket.on(EVENTS.MANAGER.PAUSE_GAME, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.pauseGame()),
  )

  socket.on(EVENTS.MANAGER.RESUME_GAME, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.resumeGame()),
  )

  socket.on(
    EVENTS.EVENING.START,
    ({ quizIds, powerUpsEnabled, disabledPowerUps }) => {
      if (!Manager.isLogged(socket)) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      if (!Array.isArray(quizIds) || quizIds.length < 2) {
        socket.emit(
          EVENTS.GAME.ERROR_MESSAGE,
          "errors:evening.notEnoughQuizzes",
        )

        return
      }

      const quizzList = Config.quizz()
      const firstQuizz = quizzList.find((q) => q.id === quizIds[0])

      if (!firstQuizz) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "quizz.notFound")

        return
      }

      const game = new Game(io, socket, firstQuizz)
      game.initEveningMode(
        quizIds,
        powerUpsEnabled ?? true,
        Array.isArray(disabledPowerUps) ? disabledPowerUps : [],
      )
      registry.addGame(game)
    },
  )

  socket.on(EVENTS.EVENING.NEXT, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.startNextEveningQuiz()),
  )

  socket.on(EVENTS.POWER_UP.USE, ({ powerUpId, targetIds }) => {
    // On résout la partie via le socket joueur uniquement : un power-up ne peut
    // être joué que par un joueur réellement inscrit dans la partie. Le fallback
    // par gameId client a été retiré (un gameId est connu de tous les joueurs).
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      return
    }

    game.handlePowerUpUsed(socket.id, powerUpId, targetIds)
  })

  socket.on(EVENTS.POWER_UP.GET_INVENTORY, () => {
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      return
    }

    game.sendPlayerInventory(socket.id)
  })

  socket.on(EVENTS.PLAYER.BUY_POWER_UP, ({ data }, ack) => {
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      ack({ success: false, error: "errors:game.notFound" })

      return
    }

    ack(game.handleBuyPowerUp(socket.id, data.powerUpType))
  })

  socket.on(EVENTS.MANAGER.GET_LOGS, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => {
      for (const entry of game.getLogs()) {
        socket.emit(EVENTS.MANAGER.LOG_ENTRY, entry)
      }
    }),
  )

  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] socket=${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      managerGame.setManagerDisconnected()
      registry.markGameAsEmpty(managerGame)

      if (!managerGame.started) {
        console.log(
          `[DISCONNECT] Manager game=${managerGame.inviteCode} → partie non démarrée, grace period 30s`,
        )
        managerGame.scheduleManagerReset()
      } else {
        console.log(
          `[DISCONNECT] Manager game=${managerGame.inviteCode} → partie en cours, reconnexion possible`,
        )
      }

      return
    }

    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      return
    }

    if (!game.started) {
      // Grace period : le joueur a 30s pour reconnecter avant d'être supprimé
      game.schedulePlayerRemoval(socket.id)

      return
    }

    game.setPlayerDisconnected(socket.id)
  })
}
