import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { quizzValidator } from "../../common/src/validators/quizz";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const quizzDir = path.resolve(__dirname, "../../../config/quizz");

console.log("=== VÉRIFICATION DU FORMAT DES QUIZ APRÈS MIGRATION ===");

if (!fs.existsSync(quizzDir)) {
  console.error("Dossier de quiz introuvable !");
  process.exit(1);
}

const quizFiles = fs.readdirSync(quizzDir).filter(f => f.endsWith(".json"));
let hasError = false;

for (const file of quizFiles) {
  const filePath = path.join(quizzDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  
  try {
    const data = JSON.parse(content);
    // Validate with Zod quizzValidator
    const result = quizzValidator.safeParse(data);
    
    if (result.success) {
      console.log(`✅ ${file} : Validé avec succès.`);
    } else {
      console.error(`❌ ${file} : Erreur de validation Zod !`);
      console.error(JSON.stringify(result.error.format(), null, 2));
      hasError = true;
    }
  } catch (e: any) {
    console.error(`❌ ${file} : Erreur de lecture/JSON parse - ${e.message}`);
    hasError = true;
  }
}

if (!hasError) {
  console.log("🎉 Tous les quiz sont 100% valides et conformes au schéma de l'application !");
} else {
  console.error("⚠️ Des erreurs de validation ont été détectées.");
  process.exit(1);
}
