import { EVENTS } from "@rahoot/common/constants"
import {
  EXPLANATIONS_BATCH_MAX,
  type ExplanationsReply,
} from "@rahoot/common/validators/ai-explanations"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { getSolutionText } from "@rahoot/web/features/quizz/utils/solution-text"
import { Loader2, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"

// Un lot de 25 explications peut prendre un moment : marge au-delà du délai
// IA du serveur (90 s) pour recevoir son message d'erreur plutôt qu'un timeout.
const BATCH_TIMEOUT_MS = 100_000

// Section « Explications des réponses » des réglages du quiz : une fois les
// questions écrites, l'IA remplit d'un coup la carte réponse de celles qui
// n'en ont pas, puis l'auteur relit et retouche chaque texte. Les textes sont
// appliqués directement aux questions (comme dans l'éditeur de question).
const QuizzExplanationsSection = () => {
  const { questions, updateQuestion } = useQuizzEditor()
  const { socket, isConnected } = useSocket()
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  // Les réponses IA arrivent après coup : on relit toujours la liste à jour
  // (l'auteur a pu taper une explication pendant la génération).
  const questionsRef = useRef(questions)

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const eligible = questions.filter(
    (q) => q.type !== "title" && q.question.trim(),
  )
  const missing = eligible.filter((q) => !q.answerReveal?.text?.trim())
  const generating = progress !== undefined

  let buttonLabel = `Compléter par IA (${missing.length} manquante${missing.length > 1 ? "s" : ""})`

  if (progress) {
    buttonLabel = `Génération… ${progress.done}/${progress.total}`
  } else if (missing.length === 0) {
    buttonLabel = "Toutes les questions ont une explication"
  }

  const applyExplanation = (id: string, text: string) => {
    const index = questionsRef.current.findIndex((q) => q.id === id)
    const target = questionsRef.current[index]

    if (!target || !text || target.answerReveal?.text?.trim()) {
      return
    }

    updateQuestion(index, {
      answerReveal: { ...target.answerReveal, enabled: true, text },
    })
  }

  const requestBatch = (batch: typeof missing) =>
    new Promise<ExplanationsReply>((resolve) => {
      socket?.timeout(BATCH_TIMEOUT_MS).emit(
        EVENTS.QUIZZ.AI_GENERATE_EXPLANATIONS,
        {
          items: batch.map((q) => ({
            question: q.question.trim().slice(0, 500),
            solutionText: getSolutionText(q)?.slice(0, 500) || undefined,
          })),
        },
        (error, reply) =>
          resolve(
            error ? { error: "L’IA met trop de temps à répondre." } : reply,
          ),
      )
    })

  const handleGenerate = async () => {
    if (!socket || generating || missing.length === 0) {
      return
    }

    const targets = [...missing]
    setProgress({ done: 0, total: targets.length })

    try {
      for (let i = 0; i < targets.length; i += EXPLANATIONS_BATCH_MAX) {
        const batch = targets.slice(i, i + EXPLANATIONS_BATCH_MAX)
        // Lots volontairement successifs : le serveur refuse deux appels IA
        // simultanés pour un même compte.
        // eslint-disable-next-line no-await-in-loop
        const reply = await requestBatch(batch)

        if ("error" in reply) {
          toast.error(reply.error)

          return
        }

        batch.forEach((q, j) => {
          applyExplanation(q.id, reply.explanations[j])
        })
        setProgress({ done: i + batch.length, total: targets.length })
      }

      toast.success("Explications ajoutées. Relisez-les ci-dessous.")
    } finally {
      setProgress(undefined)
    }
  }

  const handleTextChange = (id: string, text: string) => {
    const index = questions.findIndex((q) => q.id === id)
    const target = questions[index]

    if (!target) {
      return
    }

    updateQuestion(index, {
      answerReveal: {
        ...target.answerReveal,
        // Écrire une explication active la carte ; l'effacer ne la coupe pas
        // (elle peut encore porter une image ou une vidéo).
        enabled:
          Boolean(text.trim()) || (target.answerReveal?.enabled ?? false),
        text,
      },
    })
  }

  return (
    <section aria-labelledby="quizz-explanations-title">
      <h2
        id="quizz-explanations-title"
        className="text-ink mb-1 block text-sm font-bold"
      >
        Explications des réponses
      </h2>
      <p className="text-ink-subtle mb-3 text-xs">
        Affichées sur la carte réponse après chaque question.{" "}
        {eligible.length - missing.length}/{eligible.length} question
        {eligible.length > 1 ? "s ont" : " a"} une explication.
      </p>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={generating || missing.length === 0 || !isConnected}
        className="focus-ring border-primary/40 text-primary-ink hover:border-primary hover:bg-primary-soft flex items-center gap-2 rounded-lg border-2 border-dashed px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {generating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {buttonLabel}
      </button>

      {eligible.length > 0 && (
        <ol className="mt-4 flex flex-col gap-3">
          {eligible.map((q) => {
            const solution = getSolutionText(q)

            return (
              <li
                key={q.id}
                className="border-border flex flex-col gap-1.5 rounded-lg border p-3"
              >
                <span className="text-ink text-sm font-semibold">
                  {questions.indexOf(q) + 1}. {q.question}
                </span>
                {solution && (
                  <span className="text-ink-subtle text-xs">
                    Réponse : {solution}
                  </span>
                )}
                <textarea
                  value={q.answerReveal?.text ?? ""}
                  onChange={(e) => handleTextChange(q.id, e.target.value)}
                  rows={2}
                  aria-label={`Explication de la question ${questions.indexOf(q) + 1}`}
                  placeholder="Explication, anecdote, détail de la réponse..."
                  className="border-border text-ink focus:border-primary focus:ring-primary/30 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                />
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export default QuizzExplanationsSection
