import { useState, useEffect, useRef, useCallback } from "react"
import {
  X,
  Search,
  Upload,
  Image as ImageIcon,
  Film,
  Loader2,
  Check,
  Crop,
  FolderOpen,
  HardDrive,
  Trash2,
} from "lucide-react"
import toast from "react-hot-toast"

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

type TabType = "library" | "upload" | "unsplash" | "giphy" | "gdrive"

type MediaItem = {
  id: string
  url: string
  thumb: string
  author?: string
  authorUrl?: string
  title?: string
  size?: number
  modifiedAt?: number
}

/** Formate la taille d'un fichier en texte lisible. */
const formatSize = (bytes?: number): string => {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const MediaSearchModal = ({ open, onClose, onSelect }: Props) => {
  const [tab, setTab] = useState<TabType>("library")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MediaItem[]>([])
  const [libraryItems, setLibraryItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Cropping State
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const [cropRatio, setCropRatio] = useState<"none" | "16:9" | "4:3" | "1:1">(
    "none",
  )
  const [cropOffset, setCropOffset] = useState(50) // Percentage from top or left (0 to 100)
  const [croppingInProgress, setCroppingInProgress] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /** Charge la liste des images du serveur (bibliothèque locale). */
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch("/api/media/library", {
        headers: {
          "x-client-id": localStorage.getItem("client_id") ?? "",
        },
      })
      if (!res.ok) throw new Error("Failed to load library")
      const data = (await res.json()) as { results: MediaItem[] }
      setLibraryItems(data.results)
    } catch (err) {
      console.error("Library load error:", err)
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setTab("library")
      setSelectedImageSrc(null)
      setCropRatio("none")
      setResults([])
      setQuery("")
      setPage(1)
      void loadLibrary()
    }
  }, [open, loadLibrary])

  if (!open) return null

  const handleSearch = async (resetPage = true) => {
    if (!query.trim()) return
    setLoading(true)
    const targetPage = resetPage ? 1 : page
    try {
      const endpoint =
        tab === "unsplash" ? "/api/media/unsplash" : "/api/media/giphy"
      const res = await fetch(
        `${endpoint}?query=${encodeURIComponent(query)}&page=${targetPage}`,
        {
          headers: {
            "x-client-id": localStorage.getItem("client_id") ?? "",
          },
        },
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Erreur de recherche")
      }
      const data = (await res.json()) as { results: MediaItem[] }
      if (resetPage) {
        setResults(data.results)
      } else {
        setResults((prev) => [...prev, ...data.results])
      }
      setHasMore(data.results.length === 24)
      setPage(targetPage + 1)
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la recherche",
      )
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

  const handleSelectLibraryItem = (item: MediaItem) => {
    // Les images de la bibliothèque locale : sélection directe sans crop
    onSelect(item.url)
    onClose()
  }

  const handleDeleteLibraryItem = async (
    item: MediaItem,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    if (
      // eslint-disable-next-line no-alert
      !confirm(`Supprimer l'image "${item.title}" du serveur ?`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/media/library/${item.id}`, {
        method: "DELETE",
        headers: {
          "x-client-id": localStorage.getItem("client_id") ?? "",
        },
      })
      if (!res.ok) throw new Error("Échec de la suppression")
      setLibraryItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success("Image supprimée")
    } catch (err) {
      console.error(err)
      toast.error("Impossible de supprimer l'image")
    }
  }

  const handleGoogleDrivePick = () => {
    // Ouvre une nouvelle fenêtre pour sélectionner un fichier Google Drive
    // On utilise un input URL simple pour coller le lien de partage Google Drive
    const url = prompt(
      "Collez le lien de partage Google Drive de l'image :\n\n(Assurez-vous que l'image est en accès public ou via lien)",
    )
    if (!url?.trim()) return

    // Extraire l'ID de fichier Google Drive et construire l'URL directe
    const match = url.match(
      /(?:\/d\/|id=|\/file\/d\/)([a-zA-Z0-9_-]+)/,
    )
    if (match?.[1]) {
      const directUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`
      onSelect(directUrl)
      onClose()
    } else {
      // Tenter d'utiliser le lien tel quel
      onSelect(url.trim())
      onClose()
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

      const data = (await res.json()) as { url: string }
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
          canvas.height,
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

  // Onglets de la modale
  const tabs = [
    { id: "library" as const, label: "Bibliothèque", icon: FolderOpen },
    { id: "upload" as const, label: "Uploader", icon: Upload },
    { id: "unsplash" as const, label: "Unsplash", icon: ImageIcon },
    { id: "giphy" as const, label: "GIFs Giphy", icon: Film },
    { id: "gdrive" as const, label: "Google Drive", icon: HardDrive },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-panel border-border animate-in fade-in zoom-in-95 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl duration-200">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="text-primary flex items-center gap-2">
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
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
              <img
                src={selectedImageSrc}
                alt="To crop"
                className="max-h-[50vh] max-w-full rounded border border-zinc-800 object-contain shadow-lg"
              />
              {/* Dynamic Crop Overlay Guidelines */}
              {cropRatio !== "none" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="border-primary relative border-2 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                    style={{
                      aspectRatio:
                        cropRatio === "16:9"
                          ? "16/9"
                          : cropRatio === "4:3"
                            ? "4/3"
                            : "1/1",
                      maxHeight: "45vh",
                      maxWidth: "85%",
                      width: "100%",
                      height: "auto",
                    }}
                  >
                    <div className="bg-primary text-secondary absolute right-2 bottom-2 rounded px-1.5 py-0.5 text-[10px] font-bold shadow">
                      Zone de découpe ({cropRatio})
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Crop Settings Footer */}
            <div className="bg-panel border-border flex flex-col gap-4 border-t px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-ink mr-2 flex items-center gap-1 text-sm font-semibold">
                    <Crop className="size-4" /> Recadrer :
                  </span>
                  {(["none", "16:9", "4:3", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setCropRatio(ratio)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
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
                  <div className="flex min-w-[240px] items-center gap-3">
                    <span className="text-ink-subtle text-xs whitespace-nowrap">
                      Ajustement :
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cropOffset}
                      onChange={(e) => setCropOffset(Number(e.target.value))}
                      className="accent-primary bg-border h-1.5 flex-1 cursor-pointer appearance-none rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="border-border flex items-center justify-between border-t pt-4">
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
              {tabs.map((tItem) => {
                const Icon = tItem.icon
                const isActive = tab === tItem.id
                return (
                  <button
                    key={tItem.id}
                    onClick={() => {
                      setTab(tItem.id)
                      setResults([])
                    }}
                    className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-primary text-primary"
                        : "text-ink-subtle hover:text-ink border-transparent"
                    }`}
                  >
                    <Icon className="size-4" />
                    {tItem.label}
                  </button>
                )
              })}
            </div>

            {/* Search Input (For Unsplash / Giphy) */}
            {(tab === "unsplash" || tab === "giphy") && (
              <div className="border-border flex gap-2 border-b px-6 py-4">
                <div className="relative flex-1">
                  <Search className="text-ink-subtle absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Rechercher des ${tab === "unsplash" ? "images libres de droits" : "GIFs animés"}...`}
                    className="border-border text-ink focus:border-primary w-full rounded-lg border bg-transparent py-2 pr-4 pl-9 text-sm transition-colors outline-none"
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
            <div className="scrollbar-light flex-1 overflow-y-auto p-6">
              {/* ─── BIBLIOTHÈQUE ─── */}
              {tab === "library" && (
                <div className="space-y-4">
                  {libraryLoading ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="text-primary size-8 animate-spin" />
                    </div>
                  ) : libraryItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {libraryItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectLibraryItem(item)}
                          className="group border-border bg-border/20 hover:border-primary relative aspect-square cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow"
                        >
                          <img
                            src={item.thumb}
                            alt={item.title || "media"}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/75 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="truncate text-[9px] text-zinc-300">
                              {formatSize(item.size)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteLibraryItem(item, e)}
                              className="text-red-400 transition-colors hover:text-red-300"
                              title="Supprimer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-ink-subtle flex h-48 flex-col items-center justify-center gap-2 text-center">
                      <FolderOpen className="size-8 opacity-40" />
                      <p className="text-sm">
                        Aucune image sur le serveur pour le moment.
                      </p>
                      <p className="text-xs opacity-60">
                        Uploadez des images via l'onglet &quot;Uploader&quot;.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── UPLOAD ─── */}
              {tab === "upload" && (
                <div className="flex h-full flex-col items-center justify-center py-10">
                  <div
                    onClick={handleFileUploadClick}
                    className="border-border-strong hover:border-primary group ease-out-soft flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-12 py-16 transition-colors duration-150"
                  >
                    <div className="bg-primary-soft text-primary ease-out-soft rounded-full p-4 transition-transform group-hover:scale-110">
                      <Upload className="size-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-ink text-sm font-bold">
                        Sélectionner un fichier local
                      </p>
                      <p className="text-ink-subtle mt-1 text-xs">
                        Glissez-déposez ou cliquez pour parcourir
                      </p>
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
              )}

              {/* ─── GOOGLE DRIVE ─── */}
              {tab === "gdrive" && (
                <div className="flex h-full flex-col items-center justify-center py-10">
                  <div
                    onClick={handleGoogleDrivePick}
                    className="border-border-strong hover:border-primary group ease-out-soft flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-12 py-16 transition-colors duration-150"
                  >
                    <div className="bg-primary-soft text-primary ease-out-soft rounded-full p-4 transition-transform group-hover:scale-110">
                      <HardDrive className="size-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-ink text-sm font-bold">
                        Importer depuis Google Drive
                      </p>
                      <p className="text-ink-subtle mt-1 max-w-xs text-xs">
                        Collez le lien de partage d'une image Google Drive
                        (accessible en lien public)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── UNSPLASH / GIPHY RESULTS ─── */}
              {(tab === "unsplash" || tab === "giphy") && (
                <div className="space-y-6">
                  {results.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {results.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectMedia(item)}
                          className="group border-border bg-border/20 hover:border-primary relative aspect-square cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow"
                        >
                          <img
                            src={item.thumb}
                            alt={item.title || "media"}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          {item.author && (
                            <div className="absolute inset-x-0 bottom-0 truncate bg-black/75 p-1 px-2 text-[9px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                              Photo : {item.author}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-ink-subtle flex h-48 flex-col items-center justify-center gap-2 text-center">
                      {loading ? (
                        <Loader2 className="text-primary size-8 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="size-8 opacity-40" />
                          <p className="text-sm">
                            Saisissez un mot-clé ci-dessus pour lancer la
                            recherche.
                          </p>
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
