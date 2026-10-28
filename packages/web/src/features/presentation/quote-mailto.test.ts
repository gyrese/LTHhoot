import { expect, it } from "vitest"
import { buildQuoteMailto, QUOTE_EMAIL, type QuoteFields } from "./quote-mailto"

const fields: QuoteFields = {
  name: "Léa & Jo",
  email: "lea@example.test",
  event: "Soirée privée",
  date: "",
  location: "Saint-Denis",
  participants: "40",
  message: "Une soirée quiz ?\nMerci ! #musique & cinéma",
}
const labels: Record<keyof QuoteFields, string> = {
  name: "Nom",
  email: "E-mail",
  event: "Événement",
  date: "Date",
  location: "Lieu",
  participants: "Participants",
  message: "Message",
}

it("prepares the confirmed recipient and preserves Unicode, newlines and reserved characters", () => {
  const subject = "Devis — LTNHoot & soirée ?"
  const link = buildQuoteMailto(fields, subject, labels)
  const [recipient, query] = link.split("?")
  expect(recipient).toBe(`mailto:${QUOTE_EMAIL}`)
  const params = new URLSearchParams(query)
  expect(params.get("subject")).toBe(subject)
  expect(params.get("body")).toContain("Nom : Léa & Jo")
  expect(params.get("body")).toContain(fields.message)
  expect(params.get("body")).toContain("Date : —")
  expect([...params.keys()]).toEqual(["subject", "body"])
})

it("trims accidental whitespace without changing the form data", () => {
  const padded = { ...fields, name: "  Léa  " }
  const link = buildQuoteMailto(padded, "Devis", labels)
  expect(new URLSearchParams(link.split("?")[1]).get("body")).toContain(
    "Nom : Léa\n",
  )
  expect(padded.name).toBe("  Léa  ")
})
