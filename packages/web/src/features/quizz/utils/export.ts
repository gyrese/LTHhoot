const toBase64 = async (url: string): Promise<string> => {
  if (url.startsWith("data:")) {
    return url
  }
  
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error(`Failed to convert ${url} to base64:`, error)
    return url // Return original URL if failed
  }
}

export const exportQuizzWithMedia = async (quizz: any) => {
  const exported = JSON.parse(JSON.stringify(quizz)) // Deep clone

  // 1. Convert cover images
  if (exported.salonImage) {
    exported.salonImage = await toBase64(exported.salonImage)
  }
  if (exported.listingImage) {
    exported.listingImage = await toBase64(exported.listingImage)
  }

  // 2. Convert question media and slide elements
  for (const question of exported.questions) {
    // Main question media
    if (question.media?.url) {
      question.media.url = await toBase64(question.media.url)
    }
    
    // Background
    if (question.background?.type === "image" && question.background.value) {
      question.background.value = await toBase64(question.background.value)
    }

    // Audio
    if (question.audio) {
      question.audio = await toBase64(question.audio)
    }

    // Pin Image (Drop Pin)
    if (question.pinImage) {
      question.pinImage = await toBase64(question.pinImage)
    }

    // Slide Elements
    if (question.elements) {
      for (const el of question.elements) {
        if (el.type === "image" && el.url) {
          el.url = await toBase64(el.url)
        }
      }
    }
  }

  return exported
}

export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
