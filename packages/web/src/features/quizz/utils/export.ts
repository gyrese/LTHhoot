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

    // Return original URL if failed
    return url
  }
}

const convertElement = async (el: any): Promise<any> => {
  if (el.type === "image" && el.url) {
    return { ...el, url: await toBase64(el.url) }
  }

  return el
}

const convertQuestion = async (question: any): Promise<any> => {
  const updated = { ...question }

  if (updated.media?.url) {
    updated.media = { ...updated.media, url: await toBase64(updated.media.url) }
  }

  if (updated.background?.type === "image" && updated.background.value) {
    updated.background = {
      ...updated.background,
      value: await toBase64(updated.background.value),
    }
  }

  updated.audio &&= await toBase64(updated.audio)
  updated.pinImage &&= await toBase64(updated.pinImage)

  updated.elements &&= await Promise.all(updated.elements.map(convertElement))

  return updated
}

export const exportQuizzWithMedia = async (quizz: any) => {
  // Deep clone
  const exported = JSON.parse(JSON.stringify(quizz))

  exported.salonImage &&= await toBase64(exported.salonImage)
  exported.listingImage &&= await toBase64(exported.listingImage)

  exported.questions = await Promise.all(
    exported.questions.map(convertQuestion),
  )

  return exported
}

export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
