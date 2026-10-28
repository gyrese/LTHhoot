export const QUOTE_EMAIL = "contact@lestoilesnoires.re"

export type QuoteFields = {
  name: string
  email: string
  event: string
  date: string
  location: string
  participants: string
  message: string
}

export function buildQuoteMailto(
  fields: QuoteFields,
  subject: string,
  labels: Record<keyof QuoteFields, string>,
): string {
  const body = (Object.keys(fields) as (keyof QuoteFields)[])
    .map((key) => `${labels[key]} : ${fields[key].trim() || "—"}`)
    .join("\n\n")
  return `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
