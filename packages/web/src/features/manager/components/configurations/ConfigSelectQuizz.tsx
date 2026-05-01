import { EVENTS } from "@rahoot/common/constants"
import Button from "@rahoot/web/components/Button"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigSelectQuizz = () => {
  const { socket } = useSocket()
  const { quizz: quizzList } = useConfig()
  const [selected, setSelected] = useState<string | null>(null)
  const { t } = useTranslation()

  const handleSelect = (id: string) => () => {
    if (selected === id) {
      setSelected(null)
    } else {
      setSelected(id)
    }
  }

  const handleSubmit = () => {
    if (!selected) {
      toast.error(t("manager:quizz.pleaseSelect"))

      return
    }

    socket?.emit(EVENTS.GAME.CREATE, selected)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {quizzList.length > 0 && (
        <Button className="mb-4 shrink-0" onClick={handleSubmit}>
          {t("manager:quizz.startGame")}
        </Button>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {quizzList.map((quizz) => (
          <button
            key={quizz.id}
            className={clsx(
              "flex w-full items-center justify-between rounded-md p-3 outline outline-gray-300",
              quizz.listingImage && "h-32 bg-cover bg-center bg-no-repeat relative overflow-hidden"
            )}
            style={quizz.listingImage ? { backgroundImage: `url(${quizz.listingImage})` } : undefined}
            onClick={handleSelect(quizz.id)}
          >
            {quizz.listingImage && <div className="absolute inset-0 bg-black/40" />}
            
            <span className={clsx("relative z-10 font-bold", quizz.listingImage ? "text-white drop-shadow-md text-xl" : "")}>
              {quizz.subject}
            </span>

            <div
              className={clsx(
                "relative z-10 size-5 rounded p-0.5 outline outline-offset-3",
                quizz.listingImage ? "outline-white/50 bg-black/20" : "outline-gray-300",
                selected === quizz.id && (quizz.listingImage ? "bg-primary border-primary/80 outline-primary" : "bg-primary border-primary/80"),
              )}
            >
              {selected === quizz.id && (
                <Check className="size-full stroke-2 text-white" />
              )}
            </div>
          </button>
        ))}
        {!quizzList.length && (
          <div className="my-8 text-center text-gray-500">
            <p>{t("manager:quizz.notFound")}</p>
            <p className="text-sm">{t("pleaseCreateQuizz")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfigSelectQuizz
