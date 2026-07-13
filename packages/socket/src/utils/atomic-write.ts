import { mkdirSync, renameSync, writeFileSync } from "fs"
import { dirname } from "path"

// Écriture atomique d'un fichier : on écrit d'abord dans un fichier temporaire
// voisin puis on le renomme sur la cible. Le `rename` est atomique sur un même
// système de fichiers, donc un lecteur ne voit JAMAIS un fichier à moitié écrit
// et un crash en plein write ne laisse pas la cible tronquée (au pire un `.tmp`
// résiduel, sans conséquence).
//
// Généralise le motif qui n'existait que dans services/persistence.ts, désormais
// partagé par la persistance d'état ET les écritures de quiz/résultats (config).
export const writeFileAtomic = (
  filePath: string,
  data: string,
): void => {
  const tmpPath = `${filePath}.tmp`

  // Le dossier cible peut ne pas exister encore (premier quiz, dossier results…).
  mkdirSync(dirname(filePath), { recursive: true })

  writeFileSync(tmpPath, data, "utf-8")
  renameSync(tmpPath, filePath)
}
