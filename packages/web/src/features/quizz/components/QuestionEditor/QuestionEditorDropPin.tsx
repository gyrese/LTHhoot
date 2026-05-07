import type { DropPinQuestion, DropPinZone } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Crosshair, ImagePlus, MapPin, Trash2, UploadCloud } from "lucide-react"
import React, { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type DropPinWithId = DropPinQuestion & { id: string }

const QuestionEditorDropPin = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as DropPinWithId

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileUpload = async (file: File) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", { method: "POST", body: formData })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = (await res.json()) as { url: string }
      updateQuestion(currentIndex, { pinImage: data.url, zones: [] })
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
    }
  }

  const imgRef = useRef<HTMLImageElement>(null)

  const handleImageClick = (
    e: React.MouseEvent | React.TouchEvent | React.PointerEvent,
  ) => {
    e.preventDefault()

    if (!imgRef.current) {
      return
    }

    // Support both mouse and touch events
    const clientX =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientX
        : (e as React.MouseEvent).clientX
    const clientY =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientY
        : (e as React.MouseEvent).clientY

    const rect = imgRef.current.getBoundingClientRect()

    // Clamp to 0-100%
    const xPct = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    )
    const yPct = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100),
    )

    if (isNaN(xPct) || isNaN(yPct)) {
      toast.error("Erreur: Impossible de calculer la position.")

      return
    }

    const newZone: DropPinZone = {
      id: q.zones?.[0]?.id || Math.random().toString(36).substring(2, 10),
      x: parseFloat(xPct.toFixed(1)),
      y: parseFloat(yPct.toFixed(1)),
      width: 5,
      height: 5,
      label: "Cible Exacte",
      isCorrect: true,
    }

    updateQuestion(currentIndex, { zones: [newZone] })
  }

  const removePin = () => {
    updateQuestion(currentIndex, { zones: [] })
  }

  const pin = q.zones?.[0]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 w-full flex-1 flex-col gap-6 duration-500">
      {/* 🚀 PRO MAX UX: Giant Empty State Drag & Drop Zone */}
      {!q.pinImage && (
        <div
          className={clsx(
            "group flex min-h-[50vh] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300",
            isDragging
              ? "scale-[0.98] border-purple-500 bg-purple-500/10"
              : "border-white/20 bg-black/20 hover:border-white/40 hover:bg-black/40",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files?.[0]

            if (file) {
              void handleFileUpload(file)
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]

              if (file) {
                void handleFileUpload(file)
              }

              e.target.value = ""
            }}
          />
          <div className="z-10 flex flex-col items-center gap-6 p-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500 opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
                <UploadCloud
                  className={clsx(
                    "h-12 w-12 transition-colors duration-500",
                    isDragging
                      ? "text-purple-400"
                      : "text-white/60 group-hover:text-white",
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-white">
                {uploading
                  ? "Création de la magie..."
                  : "Glissez l'image cible ici"}
              </h3>
              <p className="mx-auto max-w-md text-base text-white/50">
                Ou cliquez pour parcourir. Choisissez une image sur laquelle vos
                joueurs devront placer leur épingle.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 PRO MAX UX: Image & Pin Placement Layout */}
      {q.pinImage && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Glassmorphic Top Toolbar */}
          <div className="flex shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20">
                <Crosshair className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h4 className="text-base leading-tight font-bold text-white">
                  Définir la cible
                </h4>
                <p className="mt-0.5 text-xs text-white/60">
                  Cliquez n'importe où sur l'image pour positionner l'épingle.
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-white/15"
            >
              <ImagePlus className="h-4 w-4" />
              Changer l'image
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]

              if (file) {
                void handleFileUpload(file)
              }

              e.target.value = ""
            }}
          />

          {/* Interactive Canvas Container */}
          <div
            className="relative flex min-h-0 w-full flex-1 cursor-crosshair touch-none items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-black/40 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] select-none"
            onPointerDown={handleImageClick}
          >
            {/* Hint Overlay (Disappears once pinned) */}
            {!pin && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-500">
                <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-6 py-4 text-lg font-bold text-white shadow-2xl backdrop-blur-xl">
                  <MapPin className="h-6 w-6 text-blue-400" />
                  Cliquez pour placer l'épingle cible
                </div>
              </div>
            )}

            <div className="pointer-events-none relative inline-block max-h-full max-w-full">
              <img
                ref={imgRef}
                src={q.pinImage}
                alt="Target"
                className="block h-auto max-h-[60vh] w-auto max-w-full rounded-xl object-contain select-none"
                draggable={false}
              />

              {/* The Map Pin */}
              {pin && (
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    // Align pin tip exactly on coordinate
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div className="animate-in zoom-in-50 relative origin-bottom duration-300">
                    {/* Pulsing ring underneath */}
                    <div className="absolute -bottom-1 left-1/2 h-6 w-6 -translate-x-1/2 animate-ping rounded-full bg-red-500/40" />

                    {/* Physical Pin Icon */}
                    <MapPin className="h-12 w-12 fill-red-500 text-red-500 drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)]" />

                    {/* Sleek Tooltip */}
                    <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-white/10 bg-black/90 px-4 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-2xl backdrop-blur-xl">
                      Cible Enregistrée
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Success / Info Panel */}
          <div
            className={clsx(
              "shrink-0 overflow-hidden transition-all duration-500",
              pin ? "h-[76px] opacity-100" : "h-0 opacity-0",
            )}
          >
            <div className="flex h-full items-center justify-between rounded-2xl border border-green-500/20 bg-gradient-to-r from-green-500/10 to-blue-500/10 px-5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-500/40 bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                  <MapPin className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Zone Validée Automatiquement
                  </h4>
                  <p className="mt-0.5 text-xs text-white/60">
                    La cible est positionnée à {pin?.x}% sur l'axe horizontal.
                  </p>
                </div>
              </div>

              <button
                onClick={removePin}
                className="flex items-center gap-2 rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionEditorDropPin
