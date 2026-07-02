import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Helper to get dir paths in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths setup (robust check to support running from scripts folder or directly in config folder)
let configDir;
if (__dirname.endsWith("config") || __dirname.endsWith("config/")) {
  configDir = __dirname;
} else {
  const rootDir = path.resolve(__dirname, "../../..");
  configDir = path.resolve(rootDir, "config");
}
const quizzDir = path.resolve(configDir, "quizz");
const uploadsDir = path.resolve(configDir, "uploads");

console.log("=== MIGRATION DES IMAGES BASE64 EN FICHIERS PHYSIQUES ===");
console.log(`Dossier quiz : ${quizzDir}`);
console.log(`Dossier uploads : ${uploadsDir}`);

if (!fs.existsSync(quizzDir)) {
  console.error("Dossier de quiz introuvable !");
  process.exit(1);
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Création d'une sauvegarde automatique du dossier quizz avant migration
const backupDir = path.resolve(configDir, `quizz-backup-${Date.now()}`);
try {
  console.log(`Création d'une sauvegarde de sécurité dans : ${backupDir}`);
  fs.cpSync(quizzDir, backupDir, { recursive: true });
  console.log("Sauvegarde créée avec succès !");
} catch (err) {
  console.error("Échec de la création de la sauvegarde. Migration annulée par sécurité :", err.message);
  process.exit(1);
}

// Check if sharp is available for optimization
let sharp = null;
try {
  const { default: sharpLib } = await import("sharp");
  sharp = sharpLib;
  console.log("Sharp est disponible et sera utilisé pour convertir en WebP.");
} catch {
  console.log("Sharp non disponible. Conservation du format d'origine (PNG/JPG).");
}

const quizFiles = fs.readdirSync(quizzDir).filter(f => f.endsWith(".json"));

let totalMigrated = 0;
let totalSavedBytes = 0;

for (const file of quizFiles) {
  const filePath = path.join(quizzDir, file);
  let content = fs.readFileSync(filePath, "utf-8");
  
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error(`Erreur de lecture JSON pour ${file} :`, e.message);
    continue;
  }

  let fileChanged = false;
  let fileMigratedCount = 0;
  let fileSavedBytes = 0;

  // Recursive traverser to find and replace base64 URLs
  const traverseAndMigrate = async (obj) => {
    if (!obj || typeof obj !== "object") return;

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string" && val.startsWith("data:image/")) {
        const matches = val.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, "base64");
          const originalSize = buffer.length;

          const baseName = `img-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          
          let relativeUrl = "";
          
          if (sharp) {
            const outName = `${baseName}.webp`;
            const outPath = path.join(uploadsDir, outName);
            try {
              await sharp(buffer).webp({ quality: 82 }).toFile(outPath);
              relativeUrl = `/uploads/${outName}`;
              const newSize = fs.statSync(outPath).size;
              fileSavedBytes += (originalSize - newSize);
            } catch (err) {
              console.error(`[Sharp Error] Échec conversion WebP pour ${file}, fallback direct :`, err.message);
            }
          }

          // Fallback if sharp is not available or failed
          if (!relativeUrl) {
            const outName = `${baseName}.${ext}`;
            const outPath = path.join(uploadsDir, outName);
            fs.writeFileSync(outPath, buffer);
            relativeUrl = `/uploads/${outName}`;
          }

          obj[key] = relativeUrl;
          fileChanged = true;
          fileMigratedCount++;
          totalMigrated++;
        }
      } else {
        await traverseAndMigrate(val);
      }
    }
  };

  await traverseAndMigrate(json);

  if (fileChanged) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf-8");
    const mbSaved = (fileSavedBytes / (1024 * 1024)).toFixed(2);
    console.log(`✅ ${file} : ${fileMigratedCount} image(s) migrée(s). Gain estimé : ~${mbSaved} Mo.`);
    totalSavedBytes += fileSavedBytes;
  }
}

console.log("=========================================");
console.log(`Migration terminée !`);
console.log(`Total d'images migrées : ${totalMigrated}`);
console.log(`Espace disque / RAM libéré : ~ ${(totalSavedBytes / (1024 * 1024)).toFixed(2)} Mo`);
console.log("=========================================");
