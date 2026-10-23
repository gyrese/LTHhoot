import type {
  ShapeElement,
  SlideElement,
  TextElement,
} from "@rahoot/common/types/game"
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@rahoot/common/utils/question-layout"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Lock,
  Unlock,
  Trash2,
  Underline,
  Strikethrough,
  RefreshCw,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { AVAILABLE_FONTS } from "../../utils/fonts"
import {
  ColorControl,
  NumberControl,
  ToolButton,
  ToolbarPopover,
  toolbarInputClass,
} from "./ToolbarControls"

type Update = (_patch: Partial<SlideElement>) => void

export function toggleTextToken(value: string, token: string, empty: string) {
  const tokens = value
    .split(" ")
    .filter((item) => item !== empty && item !== "")
  return (
    (tokens.includes(token)
      ? tokens.filter((item) => item !== token)
      : [...tokens, token]
    ).join(" ") || empty
  )
}

function TextControls({
  element,
  update,
}: {
  element: TextElement
  update: Update
}) {
  const { t } = useTranslation()
  const toggleStyle = (token: string) =>
    update({ fontStyle: toggleTextToken(element.fontStyle, token, "normal") })
  return (
    <>
      <select
        aria-label={t("quizz:editorToolbar.font")}
        className={`${toolbarInputClass} max-w-36`}
        value={element.fontFamily}
        onChange={(event) => update({ fontFamily: event.target.value })}
      >
        {!AVAILABLE_FONTS.includes(element.fontFamily) && (
          <option value={element.fontFamily}>{element.fontFamily}</option>
        )}
        {AVAILABLE_FONTS.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      <NumberControl
        label={t("quizz:editorToolbar.size")}
        value={element.fontSize}
        min={8}
        max={300}
        onChange={(fontSize) => update({ fontSize })}
      />
      <ToolButton
        label={t("quizz:editorToolbar.bold")}
        icon={<Bold className="size-4" />}
        iconOnly
        active={element.fontStyle.includes("bold")}
        onClick={() => toggleStyle("bold")}
      />
      <ToolButton
        label={t("quizz:editorToolbar.italic")}
        icon={<Italic className="size-4" />}
        iconOnly
        active={element.fontStyle.includes("italic")}
        onClick={() => toggleStyle("italic")}
      />
      <ColorControl
        label={t("quizz:editorToolbar.color")}
        value={element.fill}
        onChange={(fill) => update({ fill })}
      />
      <ToolbarPopover label={t("quizz:editorToolbar.textStyle")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            {t("quizz:editorToolbar.content")}
            <textarea
              aria-label={t("quizz:editorToolbar.content")}
              rows={3}
              className={`${toolbarInputClass} h-auto py-2`}
              value={element.text}
              onChange={(event) => update({ text: event.target.value })}
            />
          </label>
          <div className="flex gap-1">
            <ToolButton
              label={t("quizz:editorToolbar.underline")}
              icon={<Underline className="size-4" />}
              active={element.textDecoration.includes("underline")}
              onClick={() =>
                update({
                  textDecoration: toggleTextToken(
                    element.textDecoration,
                    "underline",
                    "none",
                  ),
                })
              }
            />
            <ToolButton
              label={t("quizz:editorToolbar.strike")}
              icon={<Strikethrough className="size-4" />}
              active={element.textDecoration.includes("line-through")}
              onClick={() =>
                update({
                  textDecoration: toggleTextToken(
                    element.textDecoration,
                    "line-through",
                    "none",
                  ),
                })
              }
            />
          </div>
          <div role="group" aria-label={t("quizz:editorToolbar.textAlignment")}>
            <p className="text-ink-muted mb-1 text-sm">
              {t("quizz:editorToolbar.alignInside")}
            </p>
            <div className="flex gap-1">
              <ToolButton
                label={t("quizz:editorToolbar.textLeft")}
                icon={<AlignLeft className="size-4" />}
                iconOnly
                active={element.align === "left"}
                onClick={() => update({ align: "left" })}
              />
              <ToolButton
                label={t("quizz:editorToolbar.textCenter")}
                icon={<AlignCenter className="size-4" />}
                iconOnly
                active={element.align === "center"}
                onClick={() => update({ align: "center" })}
              />
              <ToolButton
                label={t("quizz:editorToolbar.textRight")}
                icon={<AlignRight className="size-4" />}
                iconOnly
                active={element.align === "right"}
                onClick={() => update({ align: "right" })}
              />
            </div>
          </div>
          <ColorControl
            label={t("quizz:editorToolbar.highlight")}
            value={element.textBackground || "#ffff00"}
            onChange={(textBackground) => update({ textBackground })}
          />
          {element.textBackground && (
            <ToolButton
              label={t("quizz:editorToolbar.removeHighlight")}
              onClick={() => update({ textBackground: undefined })}
            />
          )}
          <OutlineControls element={element} update={update} />
        </div>
      </ToolbarPopover>
    </>
  )
}

function OutlineControls({
  element,
  update,
}: {
  element: TextElement | ShapeElement
  update: Update
}) {
  const { t } = useTranslation()
  return (
    <div className="border-border flex flex-col gap-2 border-t pt-3">
      <ColorControl
        label={
          element.type === "text"
            ? t("quizz:editorToolbar.textOutline")
            : t("quizz:editorToolbar.border")
        }
        value={element.stroke || "#000000"}
        onChange={(stroke) =>
          update({ stroke, strokeWidth: element.strokeWidth || 1 })
        }
      />
      <NumberControl
        label={t("quizz:editorToolbar.thickness")}
        value={element.strokeWidth || 0}
        min={0}
        max={element.type === "text" ? 10 : 20}
        onChange={(strokeWidth) =>
          update({ strokeWidth, stroke: element.stroke || "#000000" })
        }
      />
      <ToolButton
        label={t("quizz:editorToolbar.removeOutline")}
        disabled={!element.strokeWidth}
        onClick={() => update({ stroke: undefined, strokeWidth: 0 })}
      />
    </div>
  )
}

function ShapeControls({
  element,
  update,
}: {
  element: ShapeElement
  update: Update
}) {
  const { t } = useTranslation()
  return (
    <>
      <ColorControl
        label={t("quizz:editorToolbar.fill")}
        value={element.fill}
        onChange={(fill) => update({ fill })}
      />
      <ToolbarPopover label={t("quizz:editorToolbar.shapeStyle")}>
        <div className="flex flex-col gap-3">
          {element.shapeType === "rect" && (
            <NumberControl
              label={t("quizz:editorToolbar.radius")}
              value={element.cornerRadius || 0}
              min={0}
              max={Math.min(element.width, element.height) / 2}
              onChange={(cornerRadius) => update({ cornerRadius })}
            />
          )}
          <OutlineControls element={element} update={update} />
        </div>
      </ToolbarPopover>
    </>
  )
}

function PositionControls({
  element,
  update,
  bringToFront,
  sendToBack,
}: {
  element: SlideElement
  update: Update
  bringToFront: () => void
  sendToBack: () => void
}) {
  const { t } = useTranslation()
  const alignments: [string, Partial<SlideElement>][] = [
    [t("quizz:editorToolbar.blockLeft"), { x: 0 }],
    [
      t("quizz:editorToolbar.blockCenterX"),
      { x: Math.round((SLIDE_WIDTH - element.width) / 2) },
    ],
    [t("quizz:editorToolbar.blockRight"), { x: SLIDE_WIDTH - element.width }],
    [t("quizz:editorToolbar.blockTop"), { y: 0 }],
    [
      t("quizz:editorToolbar.blockCenterY"),
      { y: Math.round((SLIDE_HEIGHT - element.height) / 2) },
    ],
    [
      t("quizz:editorToolbar.blockBottom"),
      { y: SLIDE_HEIGHT - element.height },
    ],
  ]
  return (
    <ToolbarPopover label={t("quizz:editorToolbar.position")}>
      <div className="flex flex-col gap-3">
        <p className="text-ink-muted text-sm">
          {t("quizz:editorToolbar.positionHint")}
        </p>
        <div className="grid grid-cols-2 gap-1">
          {alignments.map(([label, patch]) => (
            <ToolButton
              key={label}
              label={label}
              onClick={() => update(patch)}
            />
          ))}
        </div>
        <div className="border-border flex flex-col gap-1 border-t pt-3">
          <ToolButton
            label={t("quizz:editorToolbar.front")}
            onClick={bringToFront}
          />
          <ToolButton
            label={t("quizz:editorToolbar.back")}
            onClick={sendToBack}
          />
        </div>
      </div>
    </ToolbarPopover>
  )
}

export default function ElementToolbar({
  element,
  update,
  remove,
  replaceImage,
  openInspector,
  bringToFront,
  sendToBack,
}: {
  element: SlideElement
  update: Update
  remove: () => void
  replaceImage: () => void
  openInspector: () => void
  bringToFront: () => void
  sendToBack: () => void
}) {
  const { t } = useTranslation()
  const typeName = t(`quizz:editorToolbar.${element.type}`)
  return (
    <div
      role="group"
      aria-label={t("quizz:editorToolbar.tools", { type: typeName })}
      className="flex min-h-11 flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1"
    >
      <span
        className="text-ink max-w-44 truncate text-sm font-semibold"
        title={element.name}
      >
        {element.name || typeName}
      </span>
      <span aria-hidden="true" className="bg-border mx-1 h-5 w-px" />
      {element.isLocked ? (
        <span className="text-ink-muted text-sm">
          {t("quizz:editorToolbar.lockedHint")}
        </span>
      ) : (
        <>
          {element.type === "text" && (
            <TextControls element={element} update={update} />
          )}
          {element.type === "shape" && (
            <ShapeControls element={element} update={update} />
          )}
          {element.type === "image" && (
            <ToolButton
              label={t("quizz:editorToolbar.replaceImage")}
              icon={<RefreshCw className="size-4" />}
              onClick={replaceImage}
            />
          )}
          {element.type === "youtube" && (
            <ToolButton
              label={t("quizz:editorToolbar.videoSettings")}
              onClick={openInspector}
            />
          )}
          <PositionControls
            element={element}
            update={update}
            bringToFront={bringToFront}
            sendToBack={sendToBack}
          />
          <ToolbarPopover label={t("quizz:editorToolbar.opacity")}>
            <NumberControl
              label={t("quizz:editorToolbar.opacityPercent")}
              value={Math.round((element.opacity ?? 1) * 100)}
              min={0}
              max={100}
              onChange={(value) => update({ opacity: value / 100 })}
            />
          </ToolbarPopover>
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        <ToolButton
          label={
            element.isLocked
              ? t("quizz:editorToolbar.unlock")
              : t("quizz:editorToolbar.lock")
          }
          icon={
            element.isLocked ? (
              <Lock className="size-4" />
            ) : (
              <Unlock className="size-4" />
            )
          }
          iconOnly
          active={Boolean(element.isLocked)}
          onClick={() => update({ isLocked: !element.isLocked })}
        />
        <ToolButton
          label={t("quizz:editorToolbar.deleteElement")}
          icon={<Trash2 className="size-4" />}
          iconOnly
          className="text-danger hover:bg-danger-soft"
          onClick={remove}
        />
      </div>
    </div>
  )
}
