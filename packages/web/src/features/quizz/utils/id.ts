export const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/gu, (c) => {
    const r = Math.trunc(Math.random() * 16)
    const v = c === "x" ? r : (r % 4) + 8

    return v.toString(16)
  })
}

export const generateElementId = (): string => `el_${generateId()}`
