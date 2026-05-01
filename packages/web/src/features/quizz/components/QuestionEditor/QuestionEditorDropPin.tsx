import type { DropPinQuestion, DropPinZone } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Crosshair, ImagePlus, MapPin, Trash2, UploadCloud } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type DropPinWithId = DropPinQuestion & { id: string }

const QuestionEditorDropPin = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as DropPinWithId

  const fileInputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", { method: "POST", body: formData })
      if (!res.ok) { throw new Error("Upload failed") }
      const data = (await res.json()) as { url: string }
      updateQuestion(currentIndex, { pinImage: data.url, zones: [] })
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
    }
  }

  const imgRef = useRef<HTMLImageElement>(null)

  const handleImageClick = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault()
    
    if (!imgRef.current) return

    // Support both mouse and touch events
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY

    const rect = imgRef.current.getBoundingClientRect()
    
    // Clamp to 0-100%
    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

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
    <div className="flex flex-col gap-6 flex-1 min-h-0 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🚀 PRO MAX UX: Giant Empty State Drag & Drop Zone */}
      {!q.pinImage && (
        <div 
          className={clsx(
            "flex flex-col items-center justify-center flex-1 rounded-3xl border-2 border-dashed transition-all duration-300 group cursor-pointer overflow-hidden min-h-[50vh]",
            isDragging ? "border-purple-500 bg-purple-500/10 scale-[0.98]" : "border-white/20 bg-black/20 hover:bg-black/40 hover:border-white/40"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFileUpload(file)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) { void handleFileUpload(file) }
              e.target.value = ""
            }}
          />
          <div className="flex flex-col items-center gap-6 text-center p-8 z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full" />
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-2xl backdrop-blur-sm relative">
                <UploadCloud className={clsx("w-12 h-12 transition-colors duration-500", isDragging ? "text-purple-400" : "text-white/60 group-hover:text-white")} />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">
                {uploading ? "Création de la magie..." : "Glissez l'image cible ici"}
              </h3>
              <p className="text-white/50 text-base max-w-md mx-auto">
                Ou cliquez pour parcourir. Choisissez une image sur laquelle vos joueurs devront placer leur épingle.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 PRO MAX UX: Image & Pin Placement Layout */}
      {q.pinImage && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          
          {/* Glassmorphic Top Toolbar */}
          <div className="flex items-center justify-between shrink-0 bg-black/30 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <Crosshair className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white leading-tight">Définir la cible</h4>
                <p className="text-xs text-white/60 mt-0.5">Cliquez n'importe où sur l'image pour positionner l'épingle.</p>
              </div>
            </div>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/15 border border-white/10 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg"
            >
              <ImagePlus className="w-4 h-4" />
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
              if (file) { void handleFileUpload(file) }
              e.target.value = ""
            }}
          />

          {/* Interactive Canvas Container */}
          <div 
            className="relative flex-1 min-h-0 w-full rounded-3xl overflow-hidden bg-black/40 border border-white/5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-crosshair touch-none select-none"
            onPointerDown={handleImageClick}
          >
            
            {/* Hint Overlay (Disappears once pinned) */}
            {!pin && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10 transition-opacity duration-500">
                <div className="px-6 py-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white font-bold text-lg flex items-center gap-3 shadow-2xl animate-pulse">
                  <MapPin className="w-6 h-6 text-blue-400" />
                  Cliquez pour placer l'épingle cible
                </div>
              </div>
            )}

            <div className="relative inline-block max-w-full max-h-full pointer-events-none">
              <img 
                ref={imgRef}
                src={q.pinImage} 
                alt="Target" 
                className="block max-h-[60vh] max-w-full w-auto h-auto object-contain select-none rounded-xl"
                draggable={false}
              />

              {/* The Map Pin */}
              {pin && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: 'translate(-50%, -100%)', // Align pin tip exactly on coordinate
                  }}
                >
                  <div className="relative animate-in zoom-in-50 duration-300 origin-bottom">
                    {/* Pulsing ring underneath */}
                    <div className="absolute -bottom-1 -translate-x-1/2 left-1/2 w-6 h-6 bg-red-500/40 rounded-full animate-ping" />
                    
                    {/* Physical Pin Icon */}
                    <MapPin className="w-12 h-12 text-red-500 fill-red-500 drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)]" />
                    
                    {/* Sleek Tooltip */}
                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl px-4 py-1.5 rounded-xl border border-white/10 text-xs font-bold text-white whitespace-nowrap shadow-2xl">
                      Cible Enregistrée
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Success / Info Panel */}
          <div className={clsx(
            "shrink-0 transition-all duration-500 overflow-hidden",
            pin ? "h-[76px] opacity-100" : "h-0 opacity-0"
          )}>
            <div className="h-full bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-2xl px-5 flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                  <MapPin className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Zone Validée Automatiquement</h4>
                  <p className="text-white/60 text-xs mt-0.5">La cible est positionnée à {pin?.x}% sur l'axe horizontal.</p>
                </div>
              </div>

              <button
                onClick={removePin}
                className="px-4 py-2 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-transparent hover:border-red-500/30"
              >
                <Trash2 className="w-4 h-4" />
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
