import { EVENTS } from "@rahoot/common/constants"
import type { PowerUpType } from "@rahoot/common/types/powerup"
import { isRoundEventType } from "@rahoot/common/types/round-event"
import { inviteCodeValidator } from "@rahoot/common/validators/auth"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import Game from "@rahoot/socket/services/game"
import Manager from "@rahoot/socket/services/manager"
import Registry from "@rahoot/socket/services/registry"
import {
  buyPowerUpSchema,
  createGameSchema,
  eveningStartSchema,
  gameIdSchema,
  kickPlayerSchema,
  loginSchema,
  openAnswerSchema,
  powerUpUseSchema,
  selectedAnswerSchema,
  tieBreakAnswerSchema,
  videoDurationSchema,
} from "@rahoot/socket/handlers/game.schemas"
import { getClientIp } from "@rahoot/socket/utils/client-ip"
import { withGame, withManagerGame } from "@rahoot/socket/utils/game"
import { RateLimiter } from "@rahoot/socket/utils/rate-limit"
import { parsePayload, replyAck } from "@rahoot/socket/utils/validate"

// Anti-énumération des codes d'invitation : seuls les ÉCHECS (code inconnu)
// sont comptés. Généreux par IP (toute une salle peut sortir par la même IP
// publique), plus strict par socket.
const joinFailuresByIp = new RateLimiter(30, 60_000)
const joinFailuresBySocket = new RateLimiter(10, 60_000)

// Supprime les parties abandonnées d'un hôte avant qu'il en crée une nouvelle
// (tests depuis l'éditeur, double clic sur « Démarrer », relances) : sans
// joueur et sans soirée entamée, elles ne servent plus à rien et restaient en
// mémoire (et dans l'instantané disque). Une vraie partie avec des joueurs, ou
// une soirée en cours, est conservée.
// Id de partie d'un payload de pilotage, sans faire confiance à sa forme.
const gameIdOf = (payload: unknown): string | undefined =>
  parsePayload(gameIdSchema, payload)?.gameId

const removeAbandonedGames = (clientId: string) => {
  const registry = Registry.getInstance()

  for (const game of registry.getGamesByManagerClientId(clientId)) {
    if (!game.isWorthKeeping) {
      console.log(
        `[CLEANUP] Partie abandonnée ${game.inviteCode} supprimée (nouvelle partie du même hôte)`,
      )
      registry.removeGame(game.gameId)
    }
  }
}

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()

  // Sonde de vivacité du watchdog client (retour d'arrière-plan mobile) : on
  // acquitte immédiatement pour prouver que le lien est réellement vivant.
  socket.on(EVENTS.CONNECTION.PING, (ack) => {
    if (typeof ack === "function") {
      ack()
    }
  })

  // Synchronisation d'horloge NTP sub-milliseconde (calcul RTT et dérive d'horloge)
  socket.on(EVENTS.CONNECTION.SYNC_TIME, (data, ack) => {
    if (typeof ack === "function") {
      ack({
        clientTime:
          typeof data?.clientTime === "number" ? data.clientTime : Date.now(),
        serverTime: Date.now(),
      })
    }
  })

  socket.on(EVENTS.PLAYER.RECONNECT, (payload) => {
    const parsed = parsePayload(gameIdSchema, payload)
    const game = parsed
      ? registry.getPlayerGame(parsed.gameId, socket.handshake.auth.clientId)
      : undefined

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  // La télécommande rejoint uniquement la partie désignée, sans session admin.
  socket.on(EVENTS.MANAGER.REMOTE_CONNECT, (payload) => {
    const parsed = parsePayload(gameIdSchema, payload)
    const game = parsed ? registry.getGameById(parsed.gameId) : undefined

    if (!game) {
      socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")

      return
    }

    game.reconnectRemote(socket)
  })

  socket.on(EVENTS.MANAGER.RECONNECT, (payload) => {
    const parsed = parsePayload(gameIdSchema, payload)

    if (!parsed) {
      socket.emit(EVENTS.GAME.RESET, "game.expired")

      return
    }

    const { gameId } = parsed

    // Socket authentifié pour piloter : admin (écran principal ou appareil
    // tiers) ou session télécommande (PIN REMOTE_PIN).
    if (Manager.canPilot(socket)) {
      const game = registry.getGameById(gameId)

      if (game) {
        // Manager principal (même clientId, admin) → reconnectManager (met à jour _manager.id)
        // Télécommande (clientId différent, ou session PIN) → reconnectRemote (ne touche pas _manager.id)
        if (
          Manager.isLogged(socket) &&
          game.manager.clientId === socket.handshake.auth.clientId
        ) {
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

  socket.on(EVENTS.GAME.CREATE, (rawPayload) => {
    const session = Manager.getSession(socket)

    // La télécommande pilote une partie existante, elle n'en crée pas.
    if (!session || session.role === "remote") {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    const parsed = parsePayload(createGameSchema, rawPayload)

    if (!parsed) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "quizz.notFound")

      return
    }

    // Forme historique : l'id du quiz seul, sans aucune option.
    const payload = typeof parsed === "string" ? { quizId: parsed } : parsed
    const quizzId = payload.quizId
    const questionIndex = payload.questionIndex ?? -1

    // Un invité ne résout que SA bibliothèque (partie de test uniquement) ;
    // l'admin résout la sienne ou celle d'un invité via un id préfixé `guest:`.
    const resolveQuizz = () => {
      try {
        return session.role === "guest"
          ? Config.quizzById(quizzId, session.guestId)
          : Config.findQuizzByAnyId(quizzId)
      } catch {
        return undefined
      }
    }

    const quizz = resolveQuizz()

    if (!quizz) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "quizz.notFound")

      return
    }

    let finalQuizz = quizz

    if (questionIndex >= 0 && questionIndex < quizz.questions.length) {
      finalQuizz = {
        ...quizz,
        questions: [quizz.questions[questionIndex]],
      }
    }

    removeAbandonedGames(socket.handshake.auth.clientId)

    const game = new Game(io, socket, finalQuizz, {
      powerUpsEnabled: Boolean(payload.powerUpsEnabled),
      disabledPowerUps: payload.disabledPowerUps ?? [],
      noSpeedMode: Boolean(payload.noSpeedMode),
      fastMode: Boolean(payload.fastMode),
      // Intensité : seule la forme objet du payload la porte (l'ancienne forme
      // « id de quiz en chaîne » n'a jamais d'options) → défaut côté Game.
      fastModeIntensity:
        "fastModeIntensity" in payload ? payload.fastModeIntensity : undefined,
      // Partie invité = test solo : seul START_DEMO pourra la démarrer.
      demoOnly: session.role === "guest",
    })
    registry.addGame(game)
  })

  socket.on(EVENTS.PLAYER.JOIN, (inviteCode) => {
    const ip = getClientIp(socket)

    if (
      joinFailuresByIp.isLimited(ip) ||
      joinFailuresBySocket.isLimited(socket.id)
    ) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.tooManyAttempts")

      return
    }

    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(result.data)

    if (!game) {
      joinFailuresByIp.hit(ip)
      joinFailuresBySocket.hit(socket.id)
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

      return
    }

    socket.emit(EVENTS.GAME.SUCCESS_ROOM, game.gameId)
  })

  socket.on(EVENTS.PLAYER.LOGIN, (payload) => {
    const parsed = parsePayload(loginSchema, payload)

    if (!parsed) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.invalidPayload")

      return
    }

    const { gameId, data } = parsed

    withGame(gameId, socket, (game) =>
      game.join(socket, data.username, data.avatar),
    )
  })

  socket.on(EVENTS.MANAGER.KICK_PLAYER, (payload) => {
    const parsed = parsePayload(kickPlayerSchema, payload)

    if (!parsed) {
      return
    }

    withGame(parsed.gameId, socket, (game) =>
      game.kickPlayer(socket, parsed.playerId),
    )
  })

  socket.on(EVENTS.MANAGER.START_GAME, (payload) =>
    withGame(gameIdOf(payload), socket, (game) => {
      // Partie de test d'un invité : seul le mode démo (solo) est autorisé.
      if (game.demoOnly) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.demoOnly")

        return
      }

      game.start(socket)
    }),
  )

  socket.on(EVENTS.MANAGER.START_DEMO, (payload) =>
    withGame(gameIdOf(payload), socket, (game) => game.startDemo(socket)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, (payload, ack) => {
    // On répond TOUJOURS un accusé (si le client en a fourni un) : le client
    // n'affiche « répondu » que sur confirmation et réessaie tant qu'il n'a
    // rien reçu (cf. Answers.tsx).
    const parsed = parsePayload(selectedAnswerSchema, payload)

    if (!parsed) {
      replyAck(ack, { status: "invalid" })

      return
    }

    const { gameId, data } = parsed
    const game = gameId ? registry.getGameById(gameId) : undefined

    if (!game) {
      replyAck(ack, { status: "not_found" })

      return
    }

    replyAck(ack, { status: game.selectAnswer(socket, data) })
  })

  socket.on(EVENTS.PLAYER.TIE_BREAK_ANSWER, (payload, ack) => {
    // Résolu via le socket joueur uniquement, même pattern que POWER_UP.USE :
    // un duel ne peut être répondu que par un joueur réellement inscrit.
    // L'ack est TOUJOURS appelé (même contrat que SELECTED_ANSWER) : le client
    // ne verrouille sa saisie que sur confirmation et retente sinon.
    const parsed = parsePayload(tieBreakAnswerSchema, payload)
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game || !parsed) {
      replyAck(ack, { status: "no_player" })

      return
    }

    replyAck(ack, {
      status: game.submitTieBreakAnswer(socket, parsed.answerId),
    })
  })

  socket.on(EVENTS.MANAGER.ABORT_QUIZ, (payload) =>
    withGame(gameIdOf(payload), socket, (game) => game.abortRound(socket)),
  )

  socket.on(EVENTS.MANAGER.NEXT_QUESTION, (payload) =>
    withGame(gameIdOf(payload), socket, (game) => game.nextRound(socket)),
  )

  socket.on(EVENTS.MANAGER.SHOW_LEADERBOARD, (payload) =>
    withManagerGame(gameIdOf(payload), socket, (game) =>
      game.showLeaderboard(),
    ),
  )

  socket.on(EVENTS.MANAGER.ARM_ROUND_EVENT, (payload) =>
    withManagerGame(gameIdOf(payload), socket, (game) => {
      const eventType: unknown = payload?.eventType ?? null

      if (eventType !== null && !isRoundEventType(eventType)) {
        return
      }

      game.armRoundEvent(eventType)
    }),
  )

  socket.on(EVENTS.MANAGER.VALIDATE_OPEN_ANSWER, (payload) => {
    const parsed = parsePayload(openAnswerSchema, payload)

    if (!parsed) {
      return
    }

    withManagerGame(parsed.gameId, socket, (game) =>
      game.validateOpenAnswer(parsed.data.text),
    )
  })

  socket.on(EVENTS.MANAGER.INVALIDATE_OPEN_ANSWER, (payload) => {
    const parsed = parsePayload(openAnswerSchema, payload)

    if (!parsed) {
      return
    }

    withManagerGame(parsed.gameId, socket, (game) =>
      game.invalidateOpenAnswer(parsed.data.text),
    )
  })

  socket.on(EVENTS.MANAGER.FINALIZE_OPEN_ANSWERS, (payload) =>
    withManagerGame(gameIdOf(payload), socket, (game) =>
      game.finalizeOpenAnswers(),
    ),
  )

  socket.on(EVENTS.MANAGER.END_GAME, (payload) =>
    withManagerGame(gameIdOf(payload), socket, (game) => game.endGame()),
  )

  socket.on(EVENTS.MANAGER.PAUSE_GAME, (payload) =>
    withManagerGame(gameIdOf(payload), socket, (game) => game.pauseGame()),
  )

  socket.on(EVENTS.MANAGER.RESUME_GAME, (payload) =>
    withManagerGame(gameIdOf(payload), socket, (game) => game.resumeGame()),
  )

  socket.on(EVENTS.EVENING.START, (payload) => {
    if (!Manager.isLogged(socket)) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    const parsed = parsePayload(eveningStartSchema, payload)

    if (!parsed || parsed.quizIds.length < 2) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:evening.notEnoughQuizzes")

      return
    }

    // TOUS les quiz sont vérifiés au lancement : un seul id invalide bloquait
    // auparavant la soirée en silence au moment d'enchaîner sur ce quiz.
    const quizzes = parsed.quizIds.map((id) => Config.findQuizzByAnyId(id))
    const [firstQuizz] = quizzes

    if (!firstQuizz || quizzes.some((quizz) => !quizz)) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:evening.quizNotFound")

      return
    }

    removeAbandonedGames(socket.handshake.auth.clientId)

    const game = new Game(io, socket, firstQuizz)
    game.initEveningMode(parsed.quizIds, {
      powerUpsEnabled: parsed.powerUpsEnabled ?? true,
      disabledPowerUps: parsed.disabledPowerUps ?? [],
      noSpeedMode: Boolean(parsed.noSpeedMode),
      fastMode: Boolean(parsed.fastMode),
      fastModeIntensity: parsed.fastModeIntensity,
    })
    registry.addGame(game)
  })

  socket.on(EVENTS.EVENING.NEXT, (payload) => {
    const parsed = parsePayload(gameIdSchema, payload)

    withManagerGame(parsed?.gameId, socket, (game) =>
      game.startNextEveningQuiz(),
    )
  })

  socket.on(EVENTS.POWER_UP.USE, (payload, ack) => {
    const parsed = parsePayload(powerUpUseSchema, payload)

    if (!parsed) {
      replyAck(ack, { ok: false, error: "errors:game.invalidPayload" })

      return
    }

    // On résout la partie via le socket joueur uniquement : un power-up ne peut
    // être joué que par un joueur réellement inscrit dans la partie. Le fallback
    // par gameId client a été retiré (un gameId est connu de tous les joueurs).
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      replyAck(ack, { ok: false, error: "errors:game.notFound" })

      return
    }

    // L'ack permet au client de restaurer l'objet (retiré de façon optimiste)
    // et d'afficher la raison du refus.
    replyAck(
      ack,
      game.handlePowerUpUsed(socket.id, parsed.powerUpId, parsed.targetIds),
    )
  })

  socket.on(EVENTS.POWER_UP.GET_INVENTORY, () => {
    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      return
    }

    game.sendPlayerInventory(socket.id)
  })

  socket.on(EVENTS.PLAYER.BUY_POWER_UP, (payload, ack) => {
    const parsed = parsePayload(buyPowerUpSchema, payload)

    if (!parsed) {
      replyAck(ack, { success: false, error: "errors:shop.unknownItem" })

      return
    }

    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      replyAck(ack, { success: false, error: "errors:game.notFound" })

      return
    }

    replyAck(
      ack,
      game.handleBuyPowerUp(socket.id, parsed.data.powerUpType as PowerUpType),
    )
  })

  socket.on(EVENTS.MANAGER.GET_LOGS, (payload) => {
    const parsed = parsePayload(gameIdSchema, payload)

    withManagerGame(parsed?.gameId, socket, (game) => {
      for (const entry of game.getLogs()) {
        socket.emit(EVENTS.MANAGER.LOG_ENTRY, entry)
      }
    })
  })

  // L'écran principal remonte la durée réelle d'une vidéo dès que son lecteur la
  // connaît. Réservé au manager (withManagerGame vérifie la room `manager-`) :
  // un joueur ne doit pas pouvoir rallonger la manche à volonté.
  socket.on(EVENTS.GAME.VIDEO_DURATION, (payload) => {
    const parsed = parsePayload(videoDurationSchema, payload)

    if (!parsed) {
      return
    }

    withManagerGame(parsed.gameId, socket, (game) => {
      game.extendRoundForMedia(parsed.duration)
    })
  })

  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] socket=${socket.id}`)

    // Un même écran peut piloter plusieurs parties (tests, relances) : TOUTES
    // sont traitées, pas seulement la première trouvée.
    const managerGames = registry.getGamesByManagerSocketId(socket.id)

    for (const managerGame of managerGames) {
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
    }

    if (managerGames.length > 0) {
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
