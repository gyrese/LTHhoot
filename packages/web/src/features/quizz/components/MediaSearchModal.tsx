import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
} from "react"
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
  Settings,
} from "lucide-react"
import toast from "react-hot-toast"

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (_url: string, _type: "image" | "video") => void
  allowedTypes?: ("image" | "video")[]
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
  if (!bytes) {
    return ""
  }

  if (bytes < 1024) {
    return `${bytes} o`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/** Détermine si une URL correspond à une image ou une vidéo en fonction de son extension. */
const getMediaTypeFromUrl = (url: string): "image" | "video" => {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase()
  const videoExts = ["mp4", "webm", "mov", "ogg", "mkv", "avi"]

  if (ext && videoExts.includes(ext)) {
    return "video"
  }

  return "image"
}

/** Charge un script tiers de façon asynchrone. */
const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()

      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script ${src}`))
    document.body.appendChild(script)
  })

const MediaSearchModal = ({
  open,
  onClose,
  onSelect,
  allowedTypes = ["image", "video"],
}: Props) => {
  const [tab, setTab] = useState<TabType>("library")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MediaItem[]>([])
  const [libraryItems, setLibraryItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Configuration Google Drive (OAuth / API Keys)
  const [clientIdInput, setClientIdInput] = useState("")
  const [developerKeyInput, setDeveloperKeyInput] = useState("")
  const [isDriveConfigured, setIsDriveConfigured] = useState(false)
  const [showDriveConfigForm, setShowDriveConfigForm] = useState(false)

  // Cropping State
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const [cropRatio, setCropRatio] = useState<"none" | "16:9" | "4:3" | "1:1">(
    "none",
  )
  // Percentage from top or left (0 to 100)
  const [cropOffset, setCropOffset] = useState(50)
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

      if (!res.ok) {
        throw new Error("Failed to load library")
      }

      const data = (await res.json()) as { results: MediaItem[] }
      setLibraryItems(data.results)
    } catch (err) {
      console.error("Library load error:", err)
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    // Charger la configuration Google Drive depuis localStorage
    const savedClientId = localStorage.getItem("gdrive_client_id") || ""
    const savedDevKey = localStorage.getItem("gdrive_developer_key") || ""
    setClientIdInput(savedClientId)
    setDeveloperKeyInput(savedDevKey)
    setIsDriveConfigured(Boolean(savedClientId && savedDevKey))
    setShowDriveConfigForm(!savedClientId || !savedDevKey)
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

  if (!open) {
    return null
  }

  const handleSearch = async (resetPage = true) => {
    if (!query.trim()) {
      return
    }

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(true)
    }
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (file) {
      if (
        file.type.startsWith("video/") ||
        file.name.toLowerCase().endsWith(".gif")
      ) {
        void handleDirectFileUpload(file)
      } else {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelectedImageSrc(event.target.result as string)
          }
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleDirectFileUpload = async (file: File) => {
    const loadingToast = toast.loading("Téléchargement du fichier...")

    try {
      const formData = new FormData()
      formData.append("image", file)

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
      toast.success("Fichier importé !", { id: loadingToast })
      const type = file.type.startsWith("video/") ? "video" : "image"
      onSelect(data.url, type)
      onClose()
    } catch (err) {
      console.error(err)
      toast.error("Échec de l'upload.", { id: loadingToast })
    }
  }

  const handleSelectMedia = (item: MediaItem) => {
    if (tab === "giphy" || item.url.toLowerCase().endsWith(".gif")) {
      onSelect(item.url, "image")
      onClose()
    } else {
      setSelectedImageSrc(item.url)
    }
  }

  const handleSelectLibraryItem = (item: MediaItem) => {
    const type = getMediaTypeFromUrl(item.url)
    onSelect(item.url, type)
    onClose()
  }

  const handleDeleteLibraryItem = async (item: MediaItem, e: MouseEvent) => {
    e.stopPropagation()

    if (
      // eslint-disable-next-line no-alert
      !confirm(`Supprimer le média "${item.title}" du serveur ?`)
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

      if (!res.ok) {
        throw new Error("Échec de la suppression")
      }

      setLibraryItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success("Média supprimé")
    } catch (err) {
      console.error(err)
      toast.error("Impossible de supprimer le média")
    }
  }

  // Configuration Google Drive
  const handleSaveDriveKeys = () => {
    if (!clientIdInput.trim() || !developerKeyInput.trim()) {
      toast.error("Veuillez renseigner toutes les clés d'API.")

      return
    }

    localStorage.setItem("gdrive_client_id", clientIdInput.trim())
    localStorage.setItem("gdrive_developer_key", developerKeyInput.trim())
    setIsDriveConfigured(true)
    setShowDriveConfigForm(false)
    toast.success("Clés Google Drive enregistrées !")
  }

  const handleResetDriveKeys = () => {
    localStorage.removeItem("gdrive_client_id")
    localStorage.removeItem("gdrive_developer_key")
    setClientIdInput("")
    setDeveloperKeyInput("")
    setIsDriveConfigured(false)
    setShowDriveConfigForm(true)
  }

  const handleGoogleDriveBrowse = async () => {
    const { gapi, google } = window as any
    const clientId = localStorage.getItem("gdrive_client_id")
    const developerKey = localStorage.getItem("gdrive_developer_key")

    if (!clientId || !developerKey) {
      toast.error("Clés d'API manquantes")

      return
    }

    const loadingToast = toast.loading("Connexion à Google Drive...")

    try {
      await loadScript("https://apis.google.com/js/api.js")
      await loadScript("https://accounts.google.com/gsi/client")

      await new Promise<void>((resolve, reject) => {
        gapi.load("picker", {
          callback: () => resolve(),
          onerror: () =>
            reject(new Error("Erreur de chargement du Picker Google")),
        })
      })

      /* eslint-disable camelcase */
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (tokenResponse: any) => {
          if (tokenResponse.error !== undefined) {
            toast.dismiss(loadingToast)
            toast.error("Échec d'authentification Google Drive")
            console.error(tokenResponse)

            return
          }

          const accessToken = tokenResponse.access_token
          toast.dismiss(loadingToast)

          const mimeTypesList: string[] = []

          if (allowedTypes.includes("image")) {
            mimeTypesList.push("image/*")
          }

          if (allowedTypes.includes("video")) {
            mimeTypesList.push("video/*")
          }

          const mimeTypes = mimeTypesList.join(",")

          const view = new google.picker.DocsView()
            .setMimeTypes(mimeTypes)
            .setParent("root")

          const picker = new google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(accessToken)
            .setDeveloperKey(developerKey)
            .setCallback(async (data: any) => {
              if (
                data[google.picker.Response.ACTION] ===
                google.picker.Action.PICKED
              ) {
                // eslint-disable-next-line prefer-destructuring
                const doc = data[google.picker.Response.DOCUMENTS][0]
                const fileId = doc[google.picker.Document.ID]
                const fileName = doc[google.picker.Document.NAME]
                const mimeType = doc[google.picker.Document.MIME_TYPE]

                await importGDriveFile(fileId, accessToken, fileName, mimeType)
              }
            })
            .build()

          picker.setVisible(true)
        },
      })
      /* eslint-enable camelcase */

      tokenClient.requestAccessToken({ prompt: "consent" })
    } catch (err) {
      toast.dismiss(loadingToast)
      console.error(err)
      toast.error("Impossible de lancer la connexion Google Drive.")
    }
  }

  const importGDriveFile = async (
    fileId: string,
    accessToken: string,
    fileName: string,
    mimeType: string,
  ) => {
    const importToast = toast.loading(
      "Importation du fichier depuis Google Drive vers le serveur...",
    )

    try {
      const res = await fetch("/api/media/gdrive-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": localStorage.getItem("client_id") ?? "",
        },
        body: JSON.stringify({ fileId, accessToken, fileName, mimeType }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Échec de l'import")
      }

      const data = (await res.json()) as { url: string }
      toast.success("Fichier importé avec succès !", { id: importToast })

      const detectedType = mimeType.startsWith("video/") ? "video" : "image"

      if (
        detectedType === "image" &&
        !fileName.toLowerCase().endsWith(".gif")
      ) {
        setSelectedImageSrc(data.url)
      } else {
        onSelect(data.url, detectedType)
        onClose()
      }
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : "Erreur de téléchargement",
        { id: importToast },
      )
    }
  }

  const handleApplyCrop = async () => {
    if (!selectedImageSrc) {
      return
    }

    if (cropRatio === "none") {
      if (selectedImageSrc.startsWith("data:")) {
        await uploadBase64(selectedImageSrc)
      } else {
        onSelect(selectedImageSrc, "image")
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
      onSelect(data.url, "image")
      onClose()
    } catch (err) {
      console.error(err)
      toast.error("Échec de l'upload de l'image.", { id: loadingToast })
    }
  }

  const executeCanvasCrop = (): Promise<string | null> =>
    new Promise((resolve, reject) => {
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
            startY = (img.naturalHeight - cropHeight) * (cropOffset / 100)
          } else {
            cropWidth = (img.naturalHeight * 16) / 9
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

        try {
          const dataUrl = canvas.toDataURL("image/webp", 0.85)
          resolve(dataUrl)
        } catch {
          const dataUrl = canvas.toDataURL("image/png")
          resolve(dataUrl)
        }
      }
      img.onerror = () => reject(new Error("Failed to load image for cropping"))
      img.src = selectedImageSrc!
    })

  // Filtrer les fichiers de la bibliothèque selon allowedTypes
  const filteredLibraryItems = libraryItems.filter((item) => {
    const type = getMediaTypeFromUrl(item.url)

    return allowedTypes.includes(type)
  })

  // Onglets disponibles
  const tabs = [
    { id: "library" as const, label: "Bibliothèque", icon: FolderOpen },
    { id: "upload" as const, label: "Uploader", icon: Upload },
    { id: "unsplash" as const, label: "Unsplash", icon: ImageIcon },
    { id: "giphy" as const, label: "GIFs Giphy", icon: Film },
    { id: "gdrive" as const, label: "Google Drive", icon: HardDrive },
  ].filter((t) => {
    if (t.id === "unsplash" || t.id === "giphy") {
      return allowedTypes.includes("image")
    }

    return true
  })

  let aspectRatioStr = "1/1"

  if (cropRatio === "16:9") {
    aspectRatioStr = "16/9"
  } else if (cropRatio === "4:3") {
    aspectRatioStr = "4/3"
  }

  const renderLibraryContent = () => {
    if (libraryLoading) {
      return (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="text-primary size-8 animate-spin" />
        </div>
      )
    }

    if (filteredLibraryItems.length > 0) {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filteredLibraryItems.map((item) => {
            const isVideoItem = getMediaTypeFromUrl(item.url) === "video"

            return (
              <div
                key={item.id}
                onClick={() => handleSelectLibraryItem(item)}
                className="group border-border bg-border/20 hover:border-primary relative aspect-square cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow"
              >
                {isVideoItem ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900 text-zinc-400">
                    <Film className="size-8" />
                    <span className="mt-1 max-w-[90%] truncate text-[10px]">
                      {item.title}
                    </span>
                  </div>
                ) : (
                  <img
                    src={item.thumb}
                    alt={item.title || "media"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                )}

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
            )
          })}
        </div>
      )
    }

    return (
      <div className="text-ink-subtle flex h-48 flex-col items-center justify-center gap-2 text-center">
        <FolderOpen className="size-8 opacity-40" />
        <p className="text-sm">Aucun média de ce type sur le serveur.</p>
        <p className="text-xs opacity-60">
          Uploadez des fichiers via l'onglet &quot;Uploader&quot;.
        </p>
      </div>
    )
  }

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
              {cropRatio !== "none" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="border-primary relative border-2 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                    style={{
                      aspectRatio: aspectRatioStr,
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
            <div className="border-border bg-border/5 flex overflow-x-auto border-b px-6">
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
                    className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
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

            {/* Search Input */}
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
                <div className="space-y-4">{renderLibraryContent()}</div>
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
                        Glissez-déposez ou cliquez pour parcourir (Images et
                        Vidéos)
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={allowedTypes.map((t) => `${t}/*`).join(",")}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* ─── GOOGLE DRIVE (API EXPLORER) ─── */}
              {tab === "gdrive" && (
                <div className="flex flex-col items-center justify-center py-6">
                  {showDriveConfigForm ? (
                    <div className="border-border w-full max-w-md rounded-xl border bg-white p-6 shadow-md">
                      <div className="mb-4 flex items-center gap-2 text-zinc-800">
                        <Settings className="text-primary size-5" />
                        <h3 className="font-bold">
                          Configuration Google Drive
                        </h3>
                      </div>
                      <p className="text-ink-subtle mb-4 text-xs leading-relaxed">
                        Pour des raisons de sécurité, vos clés API Google
                        restent stockées localement dans votre propre navigateur
                        et ne sont jamais transmises à des tiers.
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="text-ink-muted mb-1 block text-xs font-semibold">
                            Google Client ID
                          </label>
                          <input
                            type="text"
                            value={clientIdInput}
                            onChange={(e) => setClientIdInput(e.target.value)}
                            placeholder="Ex: 12345-abc.apps.googleusercontent.com"
                            className="border-border text-ink focus:border-primary focus:ring-primary w-full rounded-lg border bg-transparent p-2 text-xs outline-none focus:ring-1"
                          />
                        </div>

                        <div>
                          <label className="text-ink-muted mb-1 block text-xs font-semibold">
                            Clé API (Developer Key)
                          </label>
                          <input
                            type="text"
                            value={developerKeyInput}
                            onChange={(e) =>
                              setDeveloperKeyInput(e.target.value)
                            }
                            placeholder="Ex: AIzaSyD..."
                            className="border-border text-ink focus:border-primary focus:ring-primary w-full rounded-lg border bg-transparent p-2 text-xs outline-none focus:ring-1"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          {isDriveConfigured && (
                            <button
                              type="button"
                              onClick={() => setShowDriveConfigForm(false)}
                              className="border-border hover:bg-border/20 text-ink-muted flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors"
                            >
                              Annuler
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSaveDriveKeys}
                            className="bg-primary text-secondary flex-1 rounded-lg py-2 text-xs font-semibold transition-transform duration-150 hover:brightness-95 active:scale-95"
                          >
                            Enregistrer les clés
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-5 text-center">
                      <div className="bg-primary-soft text-primary rounded-full p-5">
                        <HardDrive className="size-10" />
                      </div>
                      <div>
                        <p className="text-ink text-sm font-bold">
                          Parcourir Google Drive
                        </p>
                        <p className="text-ink-subtle mt-1 max-w-xs text-xs">
                          Connectez-vous et sélectionnez un fichier image ou
                          vidéo directement depuis votre Drive.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleDriveBrowse}
                        className="focus-ring bg-primary text-secondary flex items-center justify-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all hover:brightness-95 active:scale-[0.98]"
                      >
                        <HardDrive className="size-4" />
                        Se connecter & Ouvrir le Drive
                      </button>

                      <button
                        type="button"
                        onClick={handleResetDriveKeys}
                        className="text-ink-subtle hover:text-ink text-xs underline"
                      >
                        Modifier les clés API
                      </button>
                    </div>
                  )}
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
