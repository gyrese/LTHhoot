import { EVENTS } from "@rahoot/common/constants"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import { ANSWERS_ICONS } from "@rahoot/web/features/game/utils/constants"
import {
  HAPTIC_PATTERNS,
  vibrate,
} from "@rahoot/web/features/game/utils/haptics"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { Swords } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_TIE_BREAK"]
}

// Envoi fiabilisé, même contrat que les réponses normales (cf. Answers.tsx) :
// accusé de réception + retry borné. On ne verrouille la saisie que sur
// confirmation serveur — un paquet perdu au moment le plus décisif de la
// soirée ne doit pas faire perdre le duel en silence.
const ANSWER_ACK_TIMEOUT = 3000
const MAX_ANSWER_RETRIES = 2

const TieBreakDuel = ({ data: { statement, opponents } }: Props) => {
  const { socket } = useSocket()
  const { t } = useTranslation()
  const { cooldown } = useQuestionStore()
  const [answered, setAnswered] = useState(false)
  const [sendError, setSendError] = useState(false)
  const sendingRef = useRef(false)

  const sendAnswer = (answerId: number, attempt: number) => {
    if (!socket) {
      sendingRef.current = false
      setAnswered(false)
      setSendError(true)

      return
    }

    socket
      .timeout(ANSWER_ACK_TIMEOUT)
      .emit(EVENTS.PLAYER.TIE_BREAK_ANSWER, { answerId }, (err, _res) => {
        if (err) {
          if (attempt < MAX_ANSWER_RETRIES) {
            sendAnswer(answerId, attempt + 1)

            return
          }

          // Échec définitif : on rouvre la saisie pour un nouvel essai.
          sendingRef.current = false
          setAnswered(false)
          setSendError(true)

          return
        }

        // Accusé reçu (ok / duplicate / closed / no_player) : quel que soit le
        // verdict, il n'y a plus rien à renvoyer — le résultat du duel arrive.
        sendingRef.current = false
        setSendError(false)
      })
  }

  const emit = (answerId: number) => {
    if (answered || sendingRef.current) {
      return
    }

    vibrate(HAPTIC_PATTERNS.TAP)
    sendingRef.current = true
    setSendError(false)
    // Feedback immédiat ; rétabli (answered=false) en cas d'échec définitif.
    setAnswered(true)
    sendAnswer(answerId, 0)
  }

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="anim-pop-in flex items-center gap-2 rounded-full bg-orange-500/20 px-4 py-1.5 text-sm font-bold text-orange-300 ring-1 ring-orange-500/40">
        <Swords className="size-4" />
        {t("game:tieBreak.duelVs", "Duel de départage contre {{names}}", {
          names: opponents.join(", "),
        })}
      </div>

      <h2 className="anim-slide-up text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
        {statement}
      </h2>

      {/* Compte à rebours du duel (events GAME.COOLDOWN déjà diffusés) */}
      {typeof cooldown === "number" && cooldown > 0 && (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-2xl font-black text-white tabular-nums ring-2 ring-orange-500/60 backdrop-blur-sm"
          aria-live="polite"
        >
          {cooldown}
        </div>
      )}

      {sendError && (
        <div className="rounded-xl border border-red-400/40 bg-red-600/30 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-sm">
          {t("game:answerSendFailed")}
        </div>
      )}

      {!answered ? (
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-2 px-2">
          <AnswerButton
            index={0}
            className="bg-red-500"
            icon={ANSWERS_ICONS[0]}
            onClick={() => emit(0)}
          >
            {t("game:false")}
          </AnswerButton>
          <AnswerButton
            index={1}
            className="bg-blue-500"
            icon={ANSWERS_ICONS[1]}
            onClick={() => emit(1)}
          >
            {t("game:true")}
          </AnswerButton>
        </div>
      ) : (
        <div className="anim-pop-in rounded-xl bg-black/40 px-6 py-3 text-lg font-bold text-white">
          {t("game:answerSent")}
        </div>
      )}
    </section>
  )
}

export default TieBreakDuel
