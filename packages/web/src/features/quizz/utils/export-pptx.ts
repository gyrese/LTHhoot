/* eslint-disable */
import pptxgen from "pptxgenjs"
import type {
  Question,
  McqQuestion,
  TrueFalseQuestion,
  OpenQuestion,
  DateQuestion,
  SliderQuestion,
  PuzzleQuestion,
  DropPinQuestion,
  GridQuestion,
  TitleQuestion,
  Quizz,
  SlideBackground,
  SlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
} from "@rahoot/common/types/game"

// ─── Dimensions LAYOUT_WIDE (13.33" × 7.5") ──────────────────────────────────

const SLIDE_W = 13.33
const SLIDE_H = 7.5
const CANVAS_W = 1920
const CANVAS_H = 1080

// ─── Couleurs réponses style Kahoot ───────────────────────────────────────────

const ANSWER_COLORS = ["e21b3c", "1368ce", "26890c", "ffa602"]
const ANSWER_SHAPES = ["▲", "●", "♦", "■"]

const TYPE_LABELS: Record<string, string> = {
  mcq: "QCM",
  true_false: "Vrai / Faux",
  open: "Question ouverte",
  date: "Année",
  slider: "Curseur",
  puzzle: "Puzzle",
  drop_pin: "Carte interactive",
  grid: "Grille",
  title: "Titre",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDataUrl = async (url: string): Promise<string | null> => {
  if (!url) {
    return null
  }

  if (url.startsWith("data:")) {
    return url
  }

  try {
    const res = await fetch(url)
    const blob = await res.blob()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const cssColorToHex = (color: string): string | null => {
  if (!color) {
    return null
  }

  const clean = color.trim()

  if (/^#[0-9a-f]{3,8}$/i.test(clean)) {
    let hex = clean.slice(1)

    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("")
    }

    return hex.slice(0, 6).toUpperCase()
  }

  return null
}

const cx = (x: number) => (x / CANVAS_W) * SLIDE_W
const cy = (y: number) => (y / CANVAS_H) * SLIDE_H
const cw = (w: number) => (w / CANVAS_W) * SLIDE_W
const ch = (h: number) => (h / CANVAS_H) * SLIDE_H

// ─── Fond de slide ────────────────────────────────────────────────────────────

const applyBackground = async (
  slide: pptxgen.Slide,
  bg?: SlideBackground,
  opacity?: number,
  fallbackColor = "1a1a2e",
) => {
  if (!bg) {
    slide.background = { color: fallbackColor }

    return
  }

  if (bg.type === "color") {
    slide.background = { color: cssColorToHex(bg.value) ?? fallbackColor }

    return
  }

  if (bg.type === "image") {
    const data = await toDataUrl(bg.value)

    if (data) {
      slide.addImage({
        data,
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
        transparency: Math.round((1 - (opacity ?? 1)) * 100),
      })
    } else {
      slide.background = { color: fallbackColor }
    }
  }
}

const addDarkOverlay = (slide: pptxgen.Slide, transparency = 35) => {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: "000000", transparency },
    line: { width: 0 },
  })
}

// ─── Éléments canvas ──────────────────────────────────────────────────────────

const renderElements = async (
  slide: pptxgen.Slide,
  elements: SlideElement[],
) => {
  for (const el of elements) {
    const transp = Math.round((1 - el.opacity) * 100)

    if (el.type === "text") {
      const te = el as TextElement
      slide.addText(te.text, {
        x: cx(te.x),
        y: cy(te.y),
        w: cw(te.width),
        h: ch(te.height),
        fontSize: Math.round(te.fontSize * (SLIDE_W / CANVAS_W) * 72),
        bold: te.fontStyle?.includes("bold"),
        italic: te.fontStyle?.includes("italic"),
        color: cssColorToHex(te.fill) ?? "FFFFFF",
        align: te.align,
        transparency: transp,
        rotate: el.rotation,
        wrap: true,
      })
    } else if (el.type === "image") {
      const ie = el as ImageElement
      const data = await toDataUrl(ie.url)

      if (data) {
        slide.addImage({
          data,
          x: cx(ie.x),
          y: cy(ie.y),
          w: cw(ie.width),
          h: ch(ie.height),
          transparency: transp,
          rotate: el.rotation,
        })
      }
    } else if (el.type === "shape") {
      const se = el as ShapeElement
      const shapeMap: Record<string, pptxgen.SHAPE_NAME> = {
        rect: "rect",
        circle: "ellipse",
        triangle: "triangle",
        star: "star5",
      }
      slide.addShape((shapeMap[se.shapeType] ?? "rect") as pptxgen.SHAPE_NAME, {
        x: cx(se.x),
        y: cy(se.y),
        w: cw(se.width),
        h: ch(se.height),
        fill: {
          color: cssColorToHex(se.fill) ?? "888888",
          transparency: transp,
        },
        line: { width: 0 },
        rotate: el.rotation,
      })
    }
  }
}

// ─── Badge type + numéro + timer ──────────────────────────────────────────────

const addBadge = (
  slide: pptxgen.Slide,
  question: Question,
  index: number,
  total: number,
) => {
  slide.addShape("roundRect", {
    x: 0.4,
    y: 0.2,
    w: 2.4,
    h: 0.45,
    fill: { color: "ff6b35" },
    line: { width: 0 },
    rectRadius: 0.1,
  })
  slide.addText(
    `${TYPE_LABELS[question.type] ?? question.type}  ·  ${index} / ${total}`,
    {
      x: 0.4,
      y: 0.2,
      w: 2.4,
      h: 0.45,
      fontSize: 13,
      color: "FFFFFF",
      bold: true,
      align: "center",
    },
  )
  slide.addText(`⏱ ${question.time}s`, {
    x: SLIDE_W - 2,
    y: 0.2,
    w: 1.6,
    h: 0.45,
    fontSize: 13,
    color: "DDDDDD",
    align: "right",
  })
}

// ─── Slide 1 : question seule ─────────────────────────────────────────────────

const addQuestionSlide = async (
  prs: pptxgen,
  question: Question,
  index: number,
  total: number,
): Promise<void> => {
  const slide = prs.addSlide()
  await applyBackground(slide, question.background, question.backgroundOpacity)
  addDarkOverlay(slide, 30)

  if (question.elements?.length) {
    await renderElements(slide, question.elements)
  }

  addBadge(slide, question, index, total)

  // Média image
  let hasMedia = false

  if (question.media?.url && question.media.type === "image") {
    const data = await toDataUrl(question.media.url)

    if (data) {
      hasMedia = true
      slide.addImage({
        data,
        x: SLIDE_W / 2,
        y: 1.0,
        w: SLIDE_W / 2 - 0.5,
        h: SLIDE_H - 1.5,
        sizing: { type: "contain", w: SLIDE_W / 2 - 0.5, h: SLIDE_H - 1.5 },
      })
    }
  }

  // Texte question centré
  if (question.question) {
    slide.addText(question.question, {
      x: 0.5,
      y: hasMedia ? 1.0 : SLIDE_H / 2 - 0.8,
      w: hasMedia ? SLIDE_W / 2 - 0.8 : SLIDE_W - 1,
      h: hasMedia ? SLIDE_H - 1.5 : 1.6,
      fontSize: 32,
      bold: true,
      color: "FFFFFF",
      align: hasMedia ? "left" : "center",
      valign: "middle",
      wrap: true,
      shadow: { type: "outer", blur: 6, offset: 2, color: "000000" },
    })
  }
}

// ─── Slide 2 : réponses ───────────────────────────────────────────────────────

const addAnswersSlide = async (
  prs: pptxgen,
  question: Question,
  index: number,
  total: number,
): Promise<void> => {
  const slide = prs.addSlide()
  await applyBackground(slide, question.background, question.backgroundOpacity)
  addDarkOverlay(slide, 50)

  addBadge(slide, question, index, total)

  // Question (petite en haut)
  if (question.question) {
    slide.addText(question.question, {
      x: 0.5,
      y: 0.85,
      w: SLIDE_W - 1,
      h: 0.9,
      fontSize: 20,
      bold: true,
      color: "FFFFFF",
      wrap: true,
      shadow: { type: "outer", blur: 4, offset: 1, color: "000000" },
    })
  }

  const contentY = 2.0
  const contentH = SLIDE_H - contentY - 0.3

  switch (question.type) {
    case "mcq":
      await addMcqAnswers(slide, question, contentY, contentH)

      break

    case "true_false":
      addTrueFalseAnswers(slide, question, contentY, contentH)

      break

    case "open":
      addOpenAnswers(slide, question, contentY, contentH)

      break

    case "date":
      addDateAnswer(slide, question, contentY, contentH)

      break

    case "slider":
      addSliderAnswer(slide, question, contentY, contentH)

      break

    case "puzzle":
      addPuzzleAnswers(slide, question, contentY, contentH)

      break

    case "drop_pin":
      await addDropPinAnswer(slide, question, contentY, contentH)

      break

    case "grid":
      await addGridAnswers(slide, question, contentY, contentH)

      break

    default:
      break
  }
}

// ─── Blocs réponses par type ──────────────────────────────────────────────────

const addMcqAnswers = async (
  slide: pptxgen.Slide,
  q: McqQuestion,
  y: number,
  h: number,
) => {
  const cols = Math.min(q.answers.length, 2)
  const rows = Math.ceil(q.answers.length / cols)
  const boxW = (SLIDE_W - 0.8) / cols - 0.25
  const boxH = h / rows - 0.2

  q.answers.forEach((answer, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 0.4 + col * (boxW + 0.25)
    const boxY = y + row * (boxH + 0.2)
    const color = ANSWER_COLORS[i] ?? "555555"
    const isCorrect = q.solutions.includes(i)

    slide.addShape("roundRect", {
      x,
      y: boxY,
      w: boxW,
      h: boxH,
      fill: { color },
      line: isCorrect ? { color: "FFFFFF", width: 3 } : { width: 0 },
      rectRadius: 0.15,
    })

    if (isCorrect) {
      slide.addText("✓", {
        x: x + boxW - 0.7,
        y: boxY + 0.05,
        w: 0.6,
        h: 0.5,
        fontSize: 18,
        color: "FFFFFF",
        align: "center",
        bold: true,
      })
    }

    slide.addText(`${ANSWER_SHAPES[i]}  ${answer}`, {
      x: x + 0.2,
      y: boxY,
      w: boxW - 0.9,
      h: boxH,
      fontSize: 18,
      color: "FFFFFF",
      bold: true,
      wrap: true,
      valign: "middle",
    })
  })
}

const addTrueFalseAnswers = (
  slide: pptxgen.Slide,
  q: TrueFalseQuestion,
  y: number,
  h: number,
) => {
  const options = [
    { label: "▲  Vrai", color: "26890c", correct: q.solution === 1 },
    { label: "●  Faux", color: "e21b3c", correct: q.solution === 0 },
  ]
  const boxW = (SLIDE_W - 0.8) / 2 - 0.2

  options.forEach(({ label, color, correct }, i) => {
    const x = 0.4 + i * (boxW + 0.2)
    slide.addShape("roundRect", {
      x,
      y,
      w: boxW,
      h,
      fill: { color },
      line: correct ? { color: "FFFFFF", width: 3 } : { width: 0 },
      rectRadius: 0.2,
    })

    if (correct) {
      slide.addText("✓", {
        x: x + boxW - 0.7,
        y: y + 0.1,
        w: 0.6,
        h: 0.5,
        fontSize: 20,
        color: "FFFFFF",
        align: "center",
        bold: true,
      })
    }

    slide.addText(label, {
      x,
      y,
      w: boxW,
      h,
      fontSize: 28,
      color: "FFFFFF",
      bold: true,
      align: "center",
      valign: "middle",
    })
  })
}

const addOpenAnswers = (
  slide: pptxgen.Slide,
  q: OpenQuestion,
  y: number,
  h: number,
) => {
  slide.addShape("roundRect", {
    x: 0.4,
    y,
    w: SLIDE_W - 0.8,
    h,
    fill: { color: "FFFFFF", transparency: 88 },
    line: { color: "FFFFFF", transparency: 70, width: 1 },
    rectRadius: 0.15,
  })
  slide.addText("Réponses acceptées :", {
    x: 0.8,
    y: y + 0.2,
    w: 8,
    h: 0.4,
    fontSize: 14,
    color: "BBBBBB",
    italic: true,
  })
  slide.addText(q.correctAnswers.join("  /  "), {
    x: 0.8,
    y: y + 0.7,
    w: SLIDE_W - 1.6,
    h: h - 1,
    fontSize: 22,
    color: "7ed56f",
    bold: true,
    wrap: true,
  })
}

const addDateAnswer = (
  slide: pptxgen.Slide,
  q: DateQuestion,
  y: number,
  h: number,
) => {
  const boxW = 4
  const x = (SLIDE_W - boxW) / 2
  slide.addShape("roundRect", {
    x,
    y,
    w: boxW,
    h,
    fill: { color: "1368ce" },
    line: { width: 0 },
    rectRadius: 0.2,
  })
  slide.addText("Année correcte", {
    x,
    y: y + 0.2,
    w: boxW,
    h: 0.5,
    fontSize: 14,
    color: "CCDDFF",
    align: "center",
    italic: true,
  })
  slide.addText(String(q.correctYear), {
    x,
    y: y + 0.7,
    w: boxW,
    h: h - 1.2,
    fontSize: 52,
    color: "FFFFFF",
    bold: true,
    align: "center",
    valign: "middle",
  })

  if (q.tolerance > 0) {
    slide.addText(`± ${q.tolerance} an${q.tolerance > 1 ? "s" : ""}`, {
      x,
      y: y + h - 0.55,
      w: boxW,
      h: 0.4,
      fontSize: 14,
      color: "AAAAAA",
      align: "center",
    })
  }
}

const addSliderAnswer = (
  slide: pptxgen.Slide,
  q: SliderQuestion,
  y: number,
  _h: number,
) => {
  const barX = 0.8
  const barY = y + 0.6
  const barW = SLIDE_W - 1.6
  const barH = 0.4
  slide.addShape("roundRect", {
    x: barX,
    y: barY,
    w: barW,
    h: barH,
    fill: { color: "444444" },
    line: { width: 0 },
    rectRadius: 0.1,
  })

  const ratio = Math.max(
    0,
    Math.min(1, (q.correctValue - q.min) / (q.max - q.min || 1)),
  )
  const fillW = barW * ratio

  if (fillW > 0) {
    slide.addShape("roundRect", {
      x: barX,
      y: barY,
      w: fillW,
      h: barH,
      fill: { color: "ff6b35" },
      line: { width: 0 },
      rectRadius: 0.1,
    })
  }

  slide.addShape("ellipse", {
    x: barX + fillW - 0.25,
    y: barY - 0.15,
    w: 0.5,
    h: 0.5,
    fill: { color: "FFFFFF" },
    line: { width: 0 },
  })

  slide.addText(String(q.min), {
    x: barX,
    y: barY + 0.55,
    w: 1.5,
    h: 0.4,
    fontSize: 14,
    color: "AAAAAA",
  })
  slide.addText(String(q.max), {
    x: barX + barW - 1.5,
    y: barY + 0.55,
    w: 1.5,
    h: 0.4,
    fontSize: 14,
    color: "AAAAAA",
    align: "right",
  })
  slide.addText(
    `Valeur : ${q.correctValue}${q.tolerance > 0 ? ` ± ${q.tolerance}` : ""}`,
    {
      x: 0,
      y: barY + 1.1,
      w: SLIDE_W,
      h: 0.5,
      fontSize: 18,
      color: "7ed56f",
      bold: true,
      align: "center",
    },
  )
}

const addPuzzleAnswers = (
  slide: pptxgen.Slide,
  q: PuzzleQuestion,
  y: number,
  h: number,
) => {
  const itemH = Math.min(0.8, (h - 0.1 * (q.items.length - 1)) / q.items.length)
  q.items.forEach((item, i) => {
    const itemY = y + i * (itemH + 0.15)
    slide.addShape("roundRect", {
      x: 0.4,
      y: itemY,
      w: SLIDE_W - 0.8,
      h: itemH,
      fill: { color: "1368ce" },
      line: { width: 0 },
      rectRadius: 0.1,
    })
    slide.addText(`${i + 1}.  ${item}`, {
      x: 0.8,
      y: itemY,
      w: SLIDE_W - 1.6,
      h: itemH,
      fontSize: 18,
      color: "FFFFFF",
      bold: true,
      valign: "middle",
    })
  })
}

const addDropPinAnswer = async (
  slide: pptxgen.Slide,
  q: DropPinQuestion,
  y: number,
  h: number,
) => {
  if (q.pinImage) {
    const data = await toDataUrl(q.pinImage)

    if (data) {
      slide.addImage({
        data,
        x: 0.4,
        y,
        w: SLIDE_W - 0.8,
        h: h - 0.6,
        sizing: { type: "contain", w: SLIDE_W - 0.8, h: h - 0.6 },
      })
    }
  }

  const correctZones = q.zones.filter((z) => z.isCorrect)
  const labels = correctZones
    .map((z) => z.label)
    .filter(Boolean)
    .join(", ")

  if (labels) {
    slide.addShape("rect", {
      x: 0.4,
      y: y + h - 0.55,
      w: SLIDE_W - 0.8,
      h: 0.5,
      fill: { color: "26890c" },
      line: { width: 0 },
      rectRadius: 0.1,
    })
    slide.addText(`Zone(s) correcte(s) : ${labels}`, {
      x: 0.7,
      y: y + h - 0.55,
      w: SLIDE_W - 1.4,
      h: 0.5,
      fontSize: 14,
      color: "FFFFFF",
      bold: true,
      valign: "middle",
    })
  }
}

const addGridAnswers = async (
  slide: pptxgen.Slide,
  q: GridQuestion,
  y: number,
  h: number,
) => {
  const cells = q.cells ?? []
  const cols = Math.max(1, q.cellsPerRow || 1)
  const rows = Math.max(1, Math.ceil(cells.length / cols))

  const gap = 0.15
  const zoneW = SLIDE_W - 0.8
  const zoneH = h - 0.2
  const cellW = (zoneW - gap * (cols - 1)) / cols
  const cellH = (zoneH - gap * (rows - 1)) / rows

  for (const [index, cell] of cells.entries()) {
    const col = index % cols
    const row = Math.floor(index / cols)
    const cellX = 0.4 + col * (cellW + gap)
    const cellY = y + row * (cellH + gap)
    const isCorrect = q.correctIndexes?.includes(index)

    slide.addShape("roundRect", {
      x: cellX,
      y: cellY,
      w: cellW,
      h: cellH,
      fill: { color: "000000", transparency: 60 },
      line: { color: isCorrect ? "26890c" : "FFFFFF", width: isCorrect ? 3 : 1 },
      rectRadius: 0.08,
    })

    if (cell.image) {
      const data = await toDataUrl(cell.image)

      if (data) {
        slide.addImage({
          data,
          x: cellX + 0.05,
          y: cellY + 0.05,
          w: cellW - 0.1,
          h: cellH - 0.1,
          sizing: { type: "contain", w: cellW - 0.1, h: cellH - 0.1 },
        })
      }
    }

    const caption = cell.label || `${index + 1}`
    slide.addText(isCorrect ? `✓ ${caption}` : caption, {
      x: cellX,
      y: cellY + cellH - 0.35,
      w: cellW,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: isCorrect ? "8ce99a" : "FFFFFF",
      align: "center",
      valign: "middle",
    })
  }
}

// ─── Slide de couverture ──────────────────────────────────────────────────────

const addCoverSlide = async (prs: pptxgen, quizz: Quizz) => {
  const slide = prs.addSlide()
  slide.background = { color: "0f0f1a" }

  if (quizz.salonImage) {
    const data = await toDataUrl(quizz.salonImage)

    if (data) {
      slide.addImage({
        data,
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
        transparency: 40,
      })
    }
  }

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: "000000", transparency: 45 },
    line: { width: 0 },
  })

  slide.addText(quizz.subject, {
    x: 1,
    y: 2,
    w: SLIDE_W - 2,
    h: 2,
    fontSize: 54,
    bold: true,
    color: "FFFFFF",
    align: "center",
    shadow: { type: "outer", blur: 10, offset: 3, color: "000000" },
  })

  if (quizz.description) {
    slide.addText(quizz.description, {
      x: 2,
      y: 4.4,
      w: SLIDE_W - 4,
      h: 1,
      fontSize: 22,
      color: "CCCCCC",
      align: "center",
      italic: true,
    })
  }

  slide.addText(
    `${quizz.questions.length} question${quizz.questions.length > 1 ? "s" : ""}`,
    {
      x: SLIDE_W / 2 - 2,
      y: 5.7,
      w: 4,
      h: 0.6,
      fontSize: 18,
      color: "ff6b35",
      align: "center",
      bold: true,
    },
  )
}

// ─── Export principal ─────────────────────────────────────────────────────────

export const exportQuizzToPptx = async (quizz: Quizz): Promise<void> => {
  const prs = new pptxgen()
  prs.layout = "LAYOUT_WIDE"
  prs.author = "Rahoot"
  prs.title = quizz.subject

  await addCoverSlide(prs, quizz)

  const total = quizz.questions.length

  for (let i = 0; i < total; i++) {
    const q = quizz.questions[i]
    const index = i + 1

    if (q.type === "title") {
      // Slide titre / révélation : une seule slide
      const slide = prs.addSlide()
      await applyBackground(slide, q.background, q.backgroundOpacity, "1a1a2e")
      slide.addShape("rect", {
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
        fill: { color: "000000", transparency: 35 },
        line: { width: 0 },
      })

      if (q.elements?.length) {
        await renderElements(slide, q.elements ?? [])
      }

      if ((q as TitleQuestion).media?.url) {
        const data = await toDataUrl((q as TitleQuestion).media!.url)

        if (data) {
          slide.addImage({
            data,
            x: 0,
            y: 0,
            w: SLIDE_W,
            h: SLIDE_H,
            transparency: 50,
            sizing: { type: "cover", w: SLIDE_W, h: SLIDE_H },
          })
        }
      }

      if (q.question) {
        slide.addText(q.question, {
          x: 1,
          y: SLIDE_H / 2 - 1,
          w: SLIDE_W - 2,
          h: 2,
          fontSize: 44,
          bold: true,
          color: "FFFFFF",
          align: "center",
          valign: "middle",
          shadow: { type: "outer", blur: 10, offset: 2, color: "000000" },
        })
      }

      addBadge(slide, q, index, total)
    } else {
      // Slide 1 : question seule
      await addQuestionSlide(prs, q, index, total)
      // Slide 2 : réponses
      await addAnswersSlide(prs, q, index, total)
    }
  }

  await prs.writeFile({ fileName: `${quizz.subject}.pptx` })
}
