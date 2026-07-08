import { useState, useEffect, useRef } from "react"
import { X, Search, Upload, Image as ImageIcon, Film, Loader2, Check, Crop } from "lucide-react"
import toast from "react-hot-toast"

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

type TabType = "upload" | "unsplash" | "giphy"

type MediaItem = {
  id: string
  url: string
  thumb: string
  author?: string
  authorUrl?: string
  title?: string
}

const MediaSearchModal = ({ open, onClose, onSelect }: Props) => {
  const [tab, setTab] = useState<TabType>("upload")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Cropping State
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const [cropRatio, setCropRatio] = useState<"none" | "16:9" | "4:3" | "1:1">("none")
  const [cropOffset, setCropOffset] = useState(50) // Percentage from top or left (0 to 100)
  const [croppingInProgress, setCroppingInProgress] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!open) {
      // Reset state
      setResults([])
      setQuery("")
      setPage(1)
      setSelectedImageSrc(null)
      setCropRatio("none")
    }
  }, [open])

  if (!open) return null

  const handleSearch = async (resetPage = true) => {
    if (!query.trim()) return
    setLoading(true)
    const targetPage = resetPage ? 1 : page
    try {
      const endpoint = tab === "unsplash" ? "/api/media/unsplash" : "/api/media/giphy"
      const res = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&page=${targetPage}`, {
        headers: {
          "x-client-id": localStorage.getItem("client_id") ?? "",
        },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur de recherche")
      }
      const data = await res.json() as { results: MediaItem[] }
      if (resetPage) {
        setResults(data.results)
      } else {
        setResults((prev) => [...prev, ...data.results])
      }
      setHasMore(data.results.length === 24)
      setPage(targetPage + 1)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Erreur lors de la recherche")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(true)
    }
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImageSrc(event.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSelectMedia = (item: MediaItem) => {
    // If it's a GIF, don't crop it (cropping animated GIFs destroys animation on canvas)
    if (tab === "giphy" || item.url.toLowerCase().endsWith(".gif")) {
      onSelect(item.url)
      onClose()
    } else {
      setSelectedImageSrc(item.url)
    }
  }

  const handleApplyCrop = async () => {
    if (!selectedImageSrc) return
    if (cropRatio === "none") {
      // Direct upload / selection without crop
      if (selectedImageSrc.startsWith("data:")) {
        // Upload base64
        await uploadBase64(selectedImageSrc)
      } else {
        onSelect(selectedImageSrc)
        onClose()
      }
      return
    }

    setCroppingInProgress(true)
    try {
      const croppedBase64 = await executeCanvasCrop()
      if (croppedBase64) {
        await uploadBase64(croppedBase64)
      }
    } catch (err) {
      console.error(err)
      toast.error("Erreur lors du recadrage de l'image.")
    } finally {
      setCroppingInProgress(false)
    }
  }

  const uploadBase64 = async (base64Data: string) => {
    const loadingToast = toast.loading("Upload de l'image...")
    try {
      // Convert base64 to Blob
      const response = await fetch(base64Data)
      const blob = await response.blob()
      
      const formData = new FormData()
      formData.append("image", blob, `cropped-${Date.now()}.png`)

      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
        headers: {
          "x-client-id": localStorage.getItem("client_id") ?? "",
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await res.json() as { url: string }
      toast.success("Image importée !", { id: loadingToast })
      onSelect(data.url)
      onClose()
    } catch (err) {
      console.error(err)
      toast.error("Échec de l'upload de l'image.", { id: loadingToast })
    }
  }

  const executeCanvasCrop = (): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "Anonymous"
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) {
          reject(new Error("Canvas not available"))
          return
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Failed to get 2d context"))
          return
        }

        let cropWidth = img.naturalWidth
        let cropHeight = img.naturalHeight
        let startX = 0
        let startY = 0

        // Calculate aspect ratios
        if (cropRatio === "16:9") {
          const expectedHeight = (img.naturalWidth * 9) / 16
          if (expectedHeight <= img.naturalHeight) {
            cropHeight = expectedHeight
            // Adjust vertical offset
            startY = (img.naturalHeight - cropHeight) * (cropOffset / 100)
          } else {
            cropWidth = (img.naturalHeight * 16) / 9
            // Adjust horizontal offset
            startX = (img.naturalWidth - cropWidth) * (cropOffset / 100)
          }
          canvas.width = 1280
          canvas.height = 720
        } else if (cropRatio === "4:3") {
          const expectedHeight = (img.naturalWidth * 3) / 4
          if (expectedHeight <= img.naturalHeight) {
            cropHeight = expectedHeight
            startY = (img.naturalHeight - cropHeight) * (cropOffset / 100)
          } else {
            cropWidth = (img.naturalHeight * 4) / 3
            startX = (img.naturalWidth - cropWidth) * (cropOffset / 100)
          }
          canvas.width = 1024
          canvas.height = 768
        } else if (cropRatio === "1:1") {
          const size = Math.min(img.naturalWidth, img.naturalHeight)
          cropWidth = size
          cropHeight = size
          startX = (img.naturalWidth - size) * (cropOffset / 100)
          startY = (img.naturalHeight - size) * (cropOffset / 100)
          canvas.width = 800
          canvas.height = 800
        }

        ctx.drawImage(
          img,
          startX,
          startY,
          cropWidth,
          cropHeight,
          0,
          0,
          canvas.width,
          canvas.height
        )

        // Return base64 URL
        try {
          const dataUrl = canvas.toDataURL("image/webp", 0.85)
          resolve(dataUrl)
        } catch {
          // Fallback to png if webp conversion fails
          const dataUrl = canvas.toDataURL("image/png")
          resolve(dataUrl)
        }
      }
      img.onerror = () => reject(new Error("Failed to load image for cropping"))
      img.src = selectedImageSrc!
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-panel border-border flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2 text-primary">
            <ImageIcon className="size-5" />
            <h2 className="text-ink text-lg font-bold">
              {selectedImageSrc ? "Recadrer l'image" : "Bibliothèque de Médias"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-subtle hover:text-ink hover:bg-border/40 rounded-lg p-1 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {selectedImageSrc ? (
          /* CROP WORKSPACE */
          <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
            <div className="flex flex-1 items-center justify-center overflow-hidden p-6 relative">
              <img
                src={selectedImageSrc}
                alt="To crop"
                className="max-h-[50vh] max-w-full rounded border border-zinc-800 object-contain shadow-lg"
              />
              {/* Dynamic Crop Overlay Guidelines */}
              {cropRatio !== "none" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div 
                    className="border-2 border-primary border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] relative"
                    style={{
                      aspectRatio: cropRatio === "16:9" ? "16/9" : cropRatio === "4:3" ? "4/3" : "1/1",
                      maxHeight: "45vh",
                      maxWidth: "85%",
                      width: "100%",
                      height: "auto"
                    }}
                  >
                    <div className="absolute bottom-2 right-2 bg-primary text-secondary text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                      Zone de découpe ({cropRatio})
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Crop Settings Footer */}
            <div className="bg-panel border-border border-t px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-ink text-sm font-semibold mr-2 flex items-center gap-1">
                    <Crop className="size-4" /> Recadrer :
                  </span>
                  {(["none", "16:9", "4:3", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setCropRatio(ratio)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        cropRatio === ratio
                          ? "bg-primary text-secondary border-primary"
                          : "border-border text-ink-muted hover:bg-border/20"
                      }`}
                    >
                      {ratio === "none" ? "Original" : ratio}
                    </button>
                  ))}
                </div>

                {cropRatio !== "none" && (
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <span className="text-ink-subtle text-xs whitespace-nowrap">Ajustement :</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cropOffset}
                      onChange={(e) => setCropOffset(Number(e.target.value))}
                      className="accent-primary flex-1 h-1.5 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedImageSrc(null)}
                  disabled={croppingInProgress}
                  className="focus-ring border-border text-ink-muted hover:bg-border/30 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-30"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={croppingInProgress}
                  className="focus-ring bg-primary text-secondary flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-[0.97] active:scale-[0.98] disabled:opacity-40"
                >
                  {croppingInProgress ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Valider l'image
                    </>
                  )}
                </button>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          /* SEARCH / BROWSE WORKSPACE */
          <>
            {/* Tabs */}
            <div className="border-border bg-border/5 flex border-b px-6">
              {[
                { id: "upload", label: "Uploader", icon: Upload },
                { id: "unsplash", label: "Unsplash", icon: ImageIcon },
                { id: "giphy", label: "GIFs Giphy", icon: Film },
              ].map((tItem) => {
                const Icon = tItem.icon
                const isActive = tab === tItem.id
                return (
                  <button
                    key={tItem.id}
                    onClick={() => {
                      setTab(tItem.id as TabType)
                      setResults([])
                    }}
                    className={`border-b-2 px-4 py-3 text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-ink-subtle hover:text-ink"
                    }`}
                  >
                    <Icon className="size-4" />
                    {tItem.label}
                  </button>
                )
              })}
            </div>

            {/* Search Input (For Unsplash / Giphy) */}
            {tab !== "upload" && (
              <div className="px-6 py-4 border-b border-border flex gap-2">
                <div className="relative flex-1">
                  <Search className="text-ink-subtle absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Rechercher des ${tab === "unsplash" ? "images libres de droits" : "GIFs animés"}...`}
                    className="border-border text-ink bg-transparent focus:border-primary w-full rounded-lg border py-2 pl-9 pr-4 text-sm outline-none transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearch(true)}
                  disabled={loading || !query.trim()}
                  className="focus-ring bg-primary text-secondary rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Chercher
                </button>
              </div>
            )}

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-light">
              {tab === "upload" ? (
                <div className="flex h-full flex-col items-center justify-center py-10">
                  <div
                    onClick={handleFileUploadClick}
                    className="border-border-strong hover:border-primary group ease-out-soft flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-12 py-16 transition-colors duration-150"
                  >
                    <div className="bg-primary-soft text-primary group-hover:scale-110 ease-out-soft rounded-full p-4 transition-transform">
                      <Upload className="size-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-ink text-sm font-bold">Sélectionner un fichier local</p>
                      <p className="text-ink-subtle text-xs mt-1">Glissez-déposez ou cliquez pour parcourir</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                /* Results grid */
                <div className="space-y-6">
                  {results.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {results.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectMedia(item)}
                          className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-border bg-border/20 transition-all hover:border-primary hover:shadow"
                        >
                          <img
                            src={item.thumb}
                            alt={item.title || "media"}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          {item.author && (
                            <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1 px-2 text-[9px] text-zinc-300 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                              Photo : {item.author}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-ink-subtle flex h-48 flex-col items-center justify-center gap-2 text-center">
                      {loading ? (
                        <Loader2 className="size-8 animate-spin text-primary" />
                      ) : (
                        <>
                          <ImageIcon className="size-8 opacity-40" />
                          <p className="text-sm">Saisissez un mot-clé ci-dessus pour lancer la recherche.</p>
                        </>
                      )}
                    </div>
                  )}

                  {results.length > 0 && hasMore && (
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        onClick={() => handleSearch(false)}
                        disabled={loading}
                        className="focus-ring border-border text-ink-muted hover:bg-border/20 rounded-lg border px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-40"
                      >
                        {loading ? "Chargement..." : "Afficher plus"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MediaSearchModal
