const toBase64 = async (url: string): Promise<string> => {
  if (url.startsWith("data:")) {
    return url
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) {
    throw new Error(`Media unavailable: ${response.status}`)
  }
  const blob = await response.blob()
  if (!/^(image|audio|video)\//u.test(blob.type)) {
    throw new Error("Invalid media response")
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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

  if (updated.images) {
    const images = []
    for (const url of updated.images) {
      // eslint-disable-next-line no-await-in-loop
      images.push(await toBase64(url))
    }
    updated.images = images
  }
  if (updated.cells) {
    const cells = []
    for (const cell of updated.cells) {
      // eslint-disable-next-line no-await-in-loop -- encodage séquentiel volontaire : évite de saturer le réseau
      const image = cell.image ? await toBase64(cell.image) : ""
      cells.push({ ...cell, image })
    }
    updated.cells = cells
  }
  if (updated.answerReveal?.image) {
    updated.answerReveal = {
      ...updated.answerReveal,
      image: await toBase64(updated.answerReveal.image),
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

  const questions = []
  for (const question of exported.questions) {
    // eslint-disable-next-line no-await-in-loop -- encodage séquentiel volontaire : évite de saturer le réseau
    questions.push(await convertQuestion(question))
  }
  exported.questions = questions

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
