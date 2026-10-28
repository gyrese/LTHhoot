import { useEffect, useId, useState } from "react"
import clsx from "clsx"
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Monitor,
  QrCode,
  RotateCcw,
  Smartphone,
  Trophy,
  X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import logo from "@rahoot/web/assets/logo.png"
import QuoteForm from "./QuoteForm"
import { QUOTE_EMAIL } from "./quote-mailto"
import "./presentation.css"

const GITHUB = "https://github.com/gyrese/LTHhoot"
const FORMATS = [
  "mcq",
  "true_false",
  "open",
  "image_sequence",
  "date",
  "slider",
  "puzzle",
  "drop_pin",
  "grid",
] as const

function QuizDemo() {
  const { t } = useTranslation("presentation")
  const [answer, setAnswer] = useState<number | null>(null)
  const statusId = useId()
  const answers = ["Saint-Pierre", "Saint-Denis", "Saint-Paul", "Le Tampon"]
  return (
    <figure className="presentation-demo" id="jeu">
      <div className="presentation-demo-top">
        <span>LTNHoot</span>
        <span>
          <span className="presentation-live-dot" />
          {t("demo.label")}
        </span>
      </div>
      <div className="presentation-demo-stage">
        <h2>{t("demo.question")}</h2>
        <p>{t("demo.instruction")}</p>
        <div className="presentation-answers" aria-describedby={statusId}>
          {answers.map((name, index) => {
            const revealed = answer !== null
            const correct = revealed && index === 1
            const incorrect = answer === index && index !== 1
            return (
              <button
                key={name}
                type="button"
                disabled={revealed}
                onClick={() => setAnswer(index)}
                className={clsx(
                  "presentation-answer",
                  `presentation-answer-${index}`,
                  {
                    "is-correct": correct,
                    "is-incorrect": incorrect,
                    "is-muted": revealed && !correct && !incorrect,
                  },
                )}
              >
                <span className="presentation-answer-letter" aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{name}</span>
                {correct && <Check aria-hidden="true" />}
                {incorrect && <X aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <div className="presentation-demo-feedback">
          <p id={statusId} role="status">
            {answer === null
              ? t("demo.ready")
              : t(answer === 1 ? "demo.correct" : "demo.incorrect")}
          </p>
          {answer !== null && (
            <button type="button" onClick={() => setAnswer(null)}>
              <RotateCcw size={16} aria-hidden="true" />
              {t("demo.again")}
            </button>
          )}
        </div>
      </div>
      <figcaption>{t("demo.caption")}</figcaption>
    </figure>
  )
}

function FormatSample({ selected }: { selected: (typeof FORMATS)[number] }) {
  const { t } = useTranslation("presentation")
  if (selected === "mcq" || selected === "true_false") {
    const choices =
      selected === "mcq"
        ? ["A", "B", "C", "D"]
        : [t("formats.true"), t("formats.false")]
    return (
      <div className="presentation-sample-options">
        {choices.map((item, i) => (
          <span className={i === 0 ? "is-highlighted" : ""} key={item}>
            {item}
            {i === 0 && <Check size={17} aria-hidden="true" />}
          </span>
        ))}
      </div>
    )
  }
  if (selected === "slider") {
    return (
      <div className="presentation-sample-range">
        <span>0</span>
        <div>
          <span />
        </div>
        <span>100</span>
      </div>
    )
  }
  if (selected === "grid") {
    return (
      <div className="presentation-sample-grid">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={i === 4 ? "is-highlighted" : ""}>
            {i === 4 ? (
              <Check aria-label={t("formats.selected")} size={20} />
            ) : (
              i + 1
            )}
          </span>
        ))}
      </div>
    )
  }
  if (selected === "image_sequence" || selected === "puzzle") {
    return (
      <div className="presentation-sample-sequence">
        {[1, 2, 3].map((i) => (
          <span key={i}>
            {i}
            <span>
              {t(selected === "puzzle" ? "formats.fragment" : "formats.clue")}
            </span>
          </span>
        ))}
      </div>
    )
  }
  return <p>{t(`formats.items.${selected}.sample`)}</p>
}

function QuestionFormats() {
  const { t } = useTranslation("presentation")
  const [selected, setSelected] = useState<(typeof FORMATS)[number]>("mcq")
  const previewId = useId()
  return (
    <section
      className="presentation-section presentation-formats"
      aria-labelledby="formats-title"
    >
      <div className="presentation-section-heading">
        <h2 id="formats-title">{t("formats.title")}</h2>
        <p>{t("formats.intro")}</p>
      </div>
      <div className="presentation-format-layout">
        <div
          className="presentation-format-controls"
          aria-label={t("formats.choose")}
        >
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              aria-pressed={selected === format}
              aria-controls={previewId}
              onClick={() => setSelected(format)}
            >
              {t(`formats.items.${format}.name`)}
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          className="presentation-format-preview"
          id={previewId}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="presentation-preview-index">
            {t("formats.preview")}
          </span>
          <h3>{t(`formats.items.${selected}.name`)}</h3>
          <p>{t(`formats.items.${selected}.description`)}</p>
          <div
            className={`presentation-format-sample presentation-format-sample-${selected}`}
          >
            <FormatSample selected={selected} />
          </div>
          <p className="presentation-preview-note">{t("formats.note")}</p>
        </div>
      </div>
    </section>
  )
}

export default function PresentationPage() {
  const { t, i18n } = useTranslation("presentation")
  useEffect(() => {
    const previousTitle = document.title
    document.title = t("meta.title")
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    const previousDescription = existing?.content
    const meta = existing ?? document.createElement("meta")
    meta.name = "description"
    meta.content = t("meta.description")
    if (!existing) {
      document.head.appendChild(meta)
    }
    return () => {
      document.title = previousTitle
      if (existing) {
        existing.content = previousDescription ?? ""
      } else {
        meta.remove()
      }
    }
  }, [t, i18n.resolvedLanguage])

  return (
    <div className="presentation-page">
      <a className="presentation-skip" href="#presentation-main">
        {t("nav.skip")}
      </a>
      <header className="presentation-header presentation-container">
        <a
          className="presentation-brand"
          href="#presentation-main"
          aria-label="LTNHoot"
        >
          <img src={logo} alt="" />
          <span>LTNHoot</span>
        </a>
        <nav aria-label={t("nav.label")}>
          <a href="#jeu">{t("nav.game")}</a>
          <a href="#animations">{t("nav.events")}</a>
          <a href="#application">{t("nav.app")}</a>
        </nav>
        <a href="#devis" className="presentation-header-cta">
          {t("nav.quote")}
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </header>
      <main id="presentation-main">
        <section
          className="presentation-hero presentation-container"
          aria-labelledby="hero-title"
        >
          <h1 id="hero-title">
            {t("hero.line1")}
            <br />
            <span>{t("hero.line2")}</span>
          </h1>
          <p>{t("hero.description")}</p>
          <div className="presentation-hero-actions">
            <a
              className="presentation-button presentation-button-primary"
              href="#devis"
            >
              {t("hero.quote")}
              <ArrowUpRight size={19} aria-hidden="true" />
            </a>
            <a
              className="presentation-button presentation-button-secondary"
              href="#jeu"
            >
              {t("hero.discover")}
              <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>
          <QuizDemo />
        </section>
        <section
          className="presentation-section presentation-container presentation-how"
          aria-labelledby="how-title"
        >
          <div className="presentation-section-heading">
            <h2 id="how-title">{t("how.title")}</h2>
            <p>{t("how.intro")}</p>
          </div>
          <ol className="presentation-steps">
            {[
              { key: "join", Icon: QrCode },
              { key: "play", Icon: Smartphone },
              { key: "win", Icon: Trophy },
            ].map(({ key, Icon }, index) => (
              <li key={key}>
                <div className="presentation-step-mark">
                  <Icon size={29} aria-hidden="true" />
                  <span>{index + 1}</span>
                </div>
                <h3>{t(`how.${key}.title`)}</h3>
                <p>{t(`how.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>
        <div className="presentation-container">
          <QuestionFormats />
        </div>
        <section
          className="presentation-section presentation-benefits"
          aria-labelledby="benefits-title"
        >
          <div className="presentation-container presentation-benefits-layout">
            <h2 id="benefits-title">{t("benefits.title")}</h2>
            <div>
              {["scores", "remote", "mobile"].map((key) => (
                <div className="presentation-benefit" key={key}>
                  <CheckCircle2 size={22} aria-hidden="true" />
                  <div>
                    <h3>{t(`benefits.${key}.title`)}</h3>
                    <p>{t(`benefits.${key}.text`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          className="presentation-section presentation-container presentation-paths"
          aria-labelledby="paths-title"
        >
          <div className="presentation-section-heading">
            <h2 id="paths-title">{t("paths.title")}</h2>
            <p>{t("paths.intro")}</p>
          </div>
          <div className="presentation-path-layout">
            <article id="animations" className="presentation-event-path">
              <h3>{t("paths.event.title")}</h3>
              <p>{t("paths.event.text")}</p>
              <ul>
                {["one", "two", "three"].map((key) => (
                  <li key={key}>
                    <Check size={17} aria-hidden="true" />
                    {t(`paths.event.${key}`)}
                  </li>
                ))}
              </ul>
              <a
                className="presentation-button presentation-button-primary"
                href="#devis"
              >
                {t("paths.event.cta")}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <small>{t("paths.event.note")}</small>
            </article>
            <article id="application" className="presentation-app-path">
              <Monitor size={30} aria-hidden="true" />
              <h3>{t("paths.app.title")}</h3>
              <p>{t("paths.app.text")}</p>
              <a href="/manager" className="presentation-app-link">
                {t("paths.app.manager")}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="/" className="presentation-app-link">
                {t("paths.app.join")}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a
                href={`${GITHUB}#installation`}
                className="presentation-app-link"
              >
                <Code2 size={18} aria-hidden="true" />
                {t("paths.app.install")}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <small>{t("paths.app.note")}</small>
            </article>
          </div>
        </section>
        <section
          className="presentation-section presentation-quote"
          id="devis"
          aria-labelledby="quote-title"
        >
          <div className="presentation-container presentation-quote-layout">
            <div className="presentation-quote-intro">
              <h2 id="quote-title">{t("quote.title")}</h2>
              <p>{t("quote.text")}</p>
              <p className="presentation-quote-signature">
                Les Toiles Noires<span>LTNHoot</span>
              </p>
            </div>
            <QuoteForm />
          </div>
        </section>
        <section
          className="presentation-section presentation-container presentation-faq"
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title">{t("faq.title")}</h2>
          <div>
            {["app", "equipment", "scores", "quote", "admin"].map((key) => (
              <details key={key}>
                <summary>
                  {t(`faq.${key}.question`)}
                  <ChevronRight size={20} aria-hidden="true" />
                </summary>
                <p>{t(`faq.${key}.answer`)}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="presentation-footer presentation-container">
        <div>
          <a href="#presentation-main" className="presentation-footer-brand">
            LTNHoot
          </a>
          <p>{t("footer.by")}</p>
        </div>
        <div className="presentation-footer-links">
          <a href={`mailto:${QUOTE_EMAIL}`}>{QUOTE_EMAIL}</a>
          <a href={GITHUB}>
            GitHub
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <a href="https://github.com/Ralex91/Razzia">{t("footer.credits")}</a>
        </div>
      </footer>
    </div>
  )
}
