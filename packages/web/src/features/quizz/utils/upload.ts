import toast from "react-hot-toast"

/**
 * Uploads a File or base64 Data URL to the server's HTTP /upload endpoint.
 * Returns the URL of the uploaded image (e.g. /uploads/img-xxxxxx.webp).
 */
export const uploadImageToServer = async (
  fileOrBase64: File | string,
  filename?: string,
): Promise<string> => {
  const loadingToast = toast.loading("Upload de l'image...")

  try {
    let blob: Blob | null = null
    let finalFilename = filename || `upload-${Date.now()}.png`

    if (fileOrBase64 instanceof File) {
      blob = fileOrBase64
      finalFilename = fileOrBase64.name
    } else if (
      typeof fileOrBase64 === "string" &&
      fileOrBase64.startsWith("data:")
    ) {
      const response = await fetch(fileOrBase64)
      blob = await response.blob()
    } else {
      throw new Error("Format d'image invalide pour l'upload")
    }

    const formData = new FormData()
    formData.append("image", blob, finalFilename)

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

    return data.url
  } catch (err) {
    console.error("Upload error:", err)
    toast.error("Échec de l'upload de l'image.", { id: loadingToast })
    throw err
  }
}
