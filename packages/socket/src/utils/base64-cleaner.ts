import fs from "fs"
import path from "path"
import sharp from "sharp"
import { writeFileAtomic } from "@rahoot/socket/utils/atomic-write"

/**
 * Traverses a JSON data structure recursively, finds any base64 image data URL
 * (`data:image/...;base64,...`), writes the binary image to `uploadsDir` (converted
 * to WebP if possible), and replaces the base64 string with the relative file URL
 * (`/uploads/img-migrated-XXXX.webp`).
 */
export async function migrateBase64InObject<T>(
  obj: T,
  uploadsDir: string,
): Promise<T> {
  if (!obj || typeof obj !== "object") {
    return obj
  }

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = await migrateBase64InObject(obj[i], uploadsDir)
    }

    return obj
  }

  const record = obj as Record<string, unknown>

  for (const key of Object.keys(record)) {
    const val = record[key]

    if (typeof val === "string" && val.startsWith("data:image/")) {
      const matches = val.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/)

      if (matches) {
        const ext = matches[1] === "jpeg" ? "jpg" : matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, "base64")

        const baseName = `img-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

        let relativeUrl = ""

        try {
          sharp.concurrency(1)
          const outName = `${baseName}.webp`
          const outPath = path.join(uploadsDir, outName)

          await sharp(buffer).webp({ quality: 82 }).toFile(outPath)
          relativeUrl = `/uploads/${outName}`
        } catch (err) {
          console.error(
            "[Base64 Migration] Sharp WebP conversion failed, falling back to direct write:",
            err,
          )
          const outName = `${baseName}.${ext}`
          const outPath = path.join(uploadsDir, outName)

          fs.writeFileSync(outPath, buffer)
          relativeUrl = `/uploads/${outName}`
        }

        record[key] = relativeUrl
      }
    } else if (val && typeof val === "object") {
      record[key] = await migrateBase64InObject(val, uploadsDir)
    }
  }

  return obj
}

/**
 * Scans quiz directories in `configDir` (`quizz/` and `guests/<id>/quizz/`),
 * identifies any `.json` file containing base64 images, extracts them to `uploads/`,
 * and updates the JSON file on disk.
 */
export async function migrateAllQuizzesInConfig(configDir: string): Promise<{
  migratedCount: number
  filesUpdatedCount: number
}> {
  const uploadsDir = path.resolve(configDir, "uploads")
  const mainQuizzDir = path.resolve(configDir, "quizz")
  const guestsDir = path.resolve(configDir, "guests")

  const targetDirs: string[] = []

  if (fs.existsSync(mainQuizzDir)) {
    targetDirs.push(mainQuizzDir)
  }

  if (fs.existsSync(guestsDir)) {
    try {
      const guestEntries = fs.readdirSync(guestsDir)

      for (const entry of guestEntries) {
        const guestQuizzDir = path.resolve(guestsDir, entry, "quizz")

        if (fs.existsSync(guestQuizzDir)) {
          targetDirs.push(guestQuizzDir)
        }
      }
    } catch {
      // Ignore errors reading guests dir
    }
  }

  let migratedCount = 0
  let filesUpdatedCount = 0

  for (const dir of targetDirs) {
    let files: string[] = []

    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
    } catch {
      continue
    }

    for (const file of files) {
      const filePath = path.join(dir, file)

      try {
        const content = fs.readFileSync(filePath, "utf-8")

        if (!content.includes("data:image/")) {
          continue
        }

        const json = JSON.parse(content)
        const initialCount = migratedCount
        const migratedObj = await migrateBase64InObject(json, uploadsDir)

        // Count how many base64 strings were replaced by checking string difference
        const matchesInContent = (content.match(/data:image\//g) || []).length
        migratedCount += matchesInContent

        if (migratedCount > initialCount) {
          writeFileAtomic(filePath, JSON.stringify(migratedObj, null, 2))
          filesUpdatedCount++
          console.log(
            `[Base64 Migration] ✅ ${file} : ${matchesInContent} image(s) base64 convertie(s) en fichiers /uploads/`,
          )
        }
      } catch (err) {
        console.error(
          `[Base64 Migration] Échec de la migration pour ${file} :`,
          err,
        )
      }
    }
  }

  return { migratedCount, filesUpdatedCount }
}
