import { useState, type FormEvent } from "react"
import { ArrowUpRight, Mail } from "lucide-react"
import { useTranslation } from "react-i18next"
import { buildQuoteMailto, QUOTE_EMAIL, type QuoteFields } from "./quote-mailto"

export default function QuoteForm() {
  const { t } = useTranslation("presentation")
  const [prepared, setPrepared] = useState(false)
  const labels: Record<keyof QuoteFields, string> = {
    name: t("form.name"),
    email: t("form.email"),
    event: t("form.event"),
    date: t("form.date"),
    location: t("form.location"),
    participants: t("form.participants"),
    message: t("form.message"),
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const fields = Object.fromEntries(
      Object.keys(labels).map((key) => [key, String(data.get(key) ?? "")]),
    ) as QuoteFields
    window.location.href = buildQuoteMailto(fields, t("form.subject"), labels)
    setPrepared(true)
  }
  return (
    <form className="presentation-quote-form" onSubmit={submit}>
      <div className="presentation-form-pair">
        <label>
          {labels.name}
          <input name="name" autoComplete="name" required maxLength={160} />
        </label>
        <label>
          {labels.email}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      </div>
      <div className="presentation-form-pair">
        <label>
          {labels.event}
          <select name="event" required defaultValue="">
            <option value="" disabled>
              {t("form.choose")}
            </option>
            {["business", "bar", "private", "association", "other"].map(
              (kind) => (
                <option key={kind} value={t(`form.events.${kind}`)}>
                  {t(`form.events.${kind}`)}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {labels.date}
          <span className="presentation-field-hint">{t("form.optional")}</span>
          <input name="date" type="date" />
        </label>
      </div>
      <div className="presentation-form-pair">
        <label>
          {labels.location}
          <input
            name="location"
            autoComplete="address-level2"
            required
            maxLength={240}
          />
        </label>
        <label>
          {labels.participants}
          <input name="participants" type="number" min="1" step="1" required />
        </label>
      </div>
      <label>
        {labels.message}
        <textarea
          name="message"
          rows={4}
          maxLength={5000}
          placeholder={t("form.messagePlaceholder")}
        />
      </label>
      <p className="presentation-form-note">{t("form.notice")}</p>
      <button
        type="submit"
        className="presentation-button presentation-button-primary"
      >
        {t("form.submit")}
        <ArrowUpRight size={18} aria-hidden="true" />
      </button>
      <p className="presentation-form-status" role="status">
        {prepared ? t("form.prepared") : ""}
      </p>
      <a className="presentation-email" href={`mailto:${QUOTE_EMAIL}`}>
        <Mail size={17} aria-hidden="true" />
        {QUOTE_EMAIL}
      </a>
    </form>
  )
}
