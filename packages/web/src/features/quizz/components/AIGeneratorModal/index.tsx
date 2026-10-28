import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import {
  Check,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import EditorDialog from "../EditorDialog"
import GeneratorForm from "./GeneratorForm"
import WorkshopQuestionEditor from "./WorkshopQuestionEditor"
import useWorkshop from "./useWorkshop"

type Props = { open: boolean; onClose: () => void }
const smallButton =
  "focus-ring text-ink-muted hover:bg-panel hover:text-ink flex size-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40"

// The editor provider is remounted for each quiz. Keep this instance alive
// through the first save so its conversation and pending reply survive.
export default function AIGeneratorModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const workshop = useWorkshop(onClose)
  const {
    session,
    setSession,
    settings,
    setSettings,
    subject,
    loading,
    error,
    storageError,
    previous,
    setPrevious,
    mobileTab,
    setMobileTab,
    send,
    update,
    selected,
    importDraft,
    remove,
    undo,
    reset,
    retry,
  } = workshop
  const [confirmReset, setConfirmReset] = useState(false)
  const conversationRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const area = conversationRef.current
    if (area) {
      area.scrollTop = area.scrollHeight
    }
  }, [session.messages.length, loading, open])

  if (!open) {
    return null
  }
  return (
    <EditorDialog label="Atelier IA" onClose={onClose} wide>
      <div className="flex h-full min-h-0 flex-col">
        <header className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-ink text-lg font-bold">Atelier IA</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={smallButton}
              title="Nouvelle conversation"
              aria-label="Nouvelle conversation"
              disabled={loading}
              onClick={() => setConfirmReset((v) => !v)}
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              className={smallButton}
              title="Fermer"
              aria-label="Fermer"
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>
        </header>
        {confirmReset && (
          <div className="bg-panel border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm">
            <span>Effacer la conversation et les questions proposées ?</span>
            <div className="flex gap-3">
              <button
                type="button"
                className="focus-ring rounded px-2 py-1"
                onClick={() => setConfirmReset(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                className="focus-ring text-danger rounded px-2 py-1 font-semibold disabled:opacity-40"
                onClick={() => {
                  reset()
                  setConfirmReset(false)
                }}
              >
                Effacer
              </button>
            </div>
          </div>
        )}
        {storageError && (
          <p
            role="status"
            className="bg-danger-soft text-danger px-4 py-2 text-sm"
          >
            Le navigateur ne peut pas enregistrer ce brouillon. Gardez cette
            page ouverte jusqu’à l’ajout au quiz.
          </p>
        )}
        <div
          className="border-border flex shrink-0 border-b md:hidden"
          aria-label="Vue de l’atelier"
        >
          {(["chat", "questions"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={mobileTab === tab}
              className={`focus-ring flex-1 px-3 py-3 text-sm font-semibold ${mobileTab === tab ? "bg-primary-soft text-primary-ink" : "text-ink-muted"}`}
              onClick={() => setMobileTab(tab)}
            >
              {tab === "chat"
                ? "Conversation"
                : `Questions (${session.questions.length})`}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <section
            aria-label="Conversation"
            className={`${mobileTab === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex md:max-w-[44%]`}
          >
            <div
              ref={conversationRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
              aria-live="polite"
              aria-relevant="additions"
            >
              {!session.messages.length && (
                <div className="py-3">
                  <h3 className="text-ink text-base font-semibold">
                    Quel quiz veux-tu créer ?
                  </h3>
                  <p className="text-ink-muted mt-2 text-sm">
                    Décris ton idée, puis ajuste les propositions au fil de la
                    conversation.
                  </p>
                  <button
                    type="button"
                    className="focus-ring border-border text-ink-muted hover:bg-panel mt-4 rounded-lg border px-3 py-2 text-left text-sm"
                    onClick={() =>
                      setSession((prev) => ({
                        ...prev,
                        input: `Crée ${settings.count} questions sur ${subject || "Disney"} pour une soirée entre adultes, avec une difficulté progressive.`,
                      }))
                    }
                  >
                    Par exemple : un quiz {subject || "Disney"} pour une soirée
                  </button>
                </div>
              )}
              {session.messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? "bg-primary-soft text-ink ml-6 rounded-lg px-3 py-2.5"
                      : "text-ink mr-2 py-1"
                  }
                >
                  <span className="text-ink-muted mb-1 block text-xs font-semibold">
                    {message.role === "user" ? "Vous" : "Assistant"}
                  </span>
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                </div>
              ))}
              {loading && (
                <div
                  role="status"
                  className="text-ink-muted flex items-center gap-2 text-sm"
                >
                  <Loader2 className="size-4 motion-safe:animate-spin" />
                  L’IA prépare sa proposition…
                </div>
              )}
            </div>
            <div className="border-border shrink-0 space-y-3 border-t px-4 py-3">
              {error && (
                <div role="alert" className="text-danger space-y-2 text-sm">
                  <p>{error}</p>
                  {retry && (
                    <button
                      type="button"
                      disabled={loading}
                      className="focus-ring rounded font-semibold underline disabled:opacity-40"
                      onClick={retry}
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              )}
              <details>
                <summary className="focus-ring text-ink-muted flex cursor-pointer list-none items-center gap-2 rounded text-xs font-semibold">
                  <Settings className="size-3.5" />
                  Réglages
                </summary>
                <div className="mt-3 max-h-[35dvh] space-y-4 overflow-y-auto pr-1">
                  <label className="text-ink block space-y-1 text-sm font-semibold">
                    <span>Public visé</span>
                    <input
                      className="focus-ring border-border bg-surface w-full rounded-md border px-3 py-2 font-normal"
                      maxLength={150}
                      placeholder="Famille, adultes, passionnés…"
                      value={session.audience}
                      disabled={loading}
                      onChange={(e) =>
                        setSession((prev) => ({
                          ...prev,
                          audience: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <GeneratorForm
                    hidePrompt
                    prompt=""
                    onPromptChange={() => undefined}
                    settings={settings}
                    onSettingsChange={(patch) =>
                      setSettings((prev) => ({ ...prev, ...patch }))
                    }
                    loading={loading}
                  />
                </div>
              </details>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  send(session.input)
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  aria-label="Message à l’IA"
                  placeholder={
                    session.questions.length
                      ? "Plus difficile, remplace la question 3…"
                      : "Décris le quiz à créer…"
                  }
                  value={session.input}
                  maxLength={2000}
                  rows={2}
                  disabled={loading}
                  onChange={(e) =>
                    setSession((prev) => ({ ...prev, input: e.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      send(session.input)
                    }
                  }}
                  className="focus-ring border-border bg-surface text-ink min-w-0 flex-1 resize-none rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                />
                <button
                  type="submit"
                  title="Envoyer"
                  aria-label="Envoyer"
                  disabled={loading || !session.input.trim()}
                  className="focus-ring bg-primary text-secondary flex size-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
                >
                  <Send className="size-4" />
                </button>
              </form>
            </div>
          </section>
          <section
            aria-label="Questions proposées"
            className={`${mobileTab === "questions" ? "flex" : "hidden"} border-border bg-panel min-h-0 min-w-0 flex-1 flex-col md:flex md:border-l`}
          >
            <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-bold">
                Questions proposées ({session.questions.length})
              </h3>
              <div className="flex items-center gap-2">
                {previous && (
                  <button
                    type="button"
                    className={smallButton}
                    title="Annuler la dernière modification"
                    aria-label="Annuler la dernière modification"
                    disabled={loading}
                    onClick={undo}
                  >
                    <Undo2 className="size-4" />
                  </button>
                )}
                {session.questions.length > 0 && (
                  <button
                    type="button"
                    disabled={loading}
                    className="focus-ring text-ink-muted rounded px-1 py-1 text-xs font-semibold disabled:opacity-40"
                    onClick={() =>
                      setSession((prev) => ({
                        ...prev,
                        questions: prev.questions.map((q) => ({
                          ...q,
                          selected: selected.length !== prev.questions.length,
                        })),
                      }))
                    }
                  >
                    {selected.length === session.questions.length
                      ? "Tout décocher"
                      : "Tout cocher"}
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {!session.questions.length && (
                <p className="text-ink-muted py-6 text-center text-sm">
                  Les propositions apparaîtront ici.
                </p>
              )}
              <ol className="divide-border divide-y">
                {session.questions.map((item, index) => (
                  <li key={item.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        aria-label={`Ajouter la question ${index + 1}`}
                        disabled={loading}
                        onChange={() =>
                          update(item.id, { selected: !item.selected })
                        }
                        className="accent-primary focus-ring mt-2 size-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-ink-muted text-xs">
                          {index + 1} ·{" "}
                          {t(`quizz:questionType.${item.question.type}`)}
                        </span>
                        <p className="text-ink mt-1 text-sm font-semibold">
                          {item.question.question}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={smallButton}
                        disabled={loading}
                        aria-label={`${item.locked ? "Déprotéger" : "Protéger"} la question ${index + 1}`}
                        title={
                          item.locked
                            ? "Protégée des modifications IA"
                            : "Protéger des modifications IA"
                        }
                        onClick={() =>
                          update(item.id, { locked: !item.locked })
                        }
                      >
                        {item.locked ? (
                          <Lock className="text-primary-ink size-4" />
                        ) : (
                          <LockOpen className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={smallButton}
                        disabled={loading || item.locked}
                        aria-label={`Remplacer la question ${index + 1}`}
                        title="Proposer une autre question"
                        onClick={() =>
                          send(
                            `Remplace uniquement la question ${index + 1} par une autre sur le même thème et du même niveau.`,
                            [item.id],
                          )
                        }
                      >
                        <RefreshCw className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={smallButton}
                        disabled={loading}
                        aria-label={`Retirer la question ${index + 1}`}
                        title="Retirer du brouillon"
                        onClick={() => remove(item.id)}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <details className="mt-2 ml-6">
                      <summary className="focus-ring text-ink-muted cursor-pointer rounded text-xs font-semibold">
                        Réponses · Modifier
                      </summary>
                      <WorkshopQuestionEditor
                        key={JSON.stringify(item.question)}
                        question={item.question}
                        disabled={loading}
                        onSave={(question) => {
                          setPrevious(session.questions)
                          update(item.id, { question })
                          toast.success("Question modifiée")
                        }}
                      />
                    </details>
                  </li>
                ))}
              </ol>
            </div>
            <footer className="border-border bg-surface flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
              <span className="text-ink-muted text-xs">
                {selected.length} sélectionnée(s)
              </span>
              <button
                type="button"
                disabled={loading || !selected.length}
                onClick={importDraft}
                className="focus-ring bg-primary text-secondary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                <Check className="size-4" />
                Ajouter au quiz ({selected.length})
              </button>
            </footer>
          </section>
        </div>
      </div>
    </EditorDialog>
  )
}
