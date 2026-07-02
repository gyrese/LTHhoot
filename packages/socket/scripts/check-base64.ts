import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.resolve(__dirname, "../../../config");
const quizzDir = path.resolve(configDir, "quizz");

console.log("=== INSPECTION DES CHAÎNES BASE64 RESTANTES ===");

if (!fs.existsSync(quizzDir)) {
  console.error("Dossier quizz introuvable");
  process.exit(1);
}

const quizFiles = fs.readdirSync(quizzDir).filter(f => f.endsWith(".json"));

for (const file of quizFiles) {
  const filePath = path.join(quizzDir, file);
  const size = fs.statSync(filePath).size;
  const sizeKb = (size / 1024).toFixed(1);
  
  if (size > 1024 * 100) { // Plus de 100 Ko
    console.log(`⚠️ ${file} est anormalement lourd : ${sizeKb} Ko`);
    
    try {
      const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      
      const inspect = (obj, path = "") => {
        if (!obj || typeof obj !== "object") return;
        
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof val === "string" && val.startsWith("data:")) {
            const preview = val.substring(0, 50);
            const valSize = (val.length / 1024).toFixed(1);
            console.log(`  -> Trouvé ${currentPath} (${valSize} Ko) : "${preview}..."`);
          } else {
            inspect(val, currentPath);
          }
        }
      };
      
      inspect(json);
    } catch (e: any) {
      console.error(`  Erreur lecture JSON : ${e.message}`);
    }
  } else {
    console.log(`✅ ${file} : Taille normale (${sizeKb} Ko)`);
  }
}
