import { z } from "zod"

// Paramètres d'URL de la page de connexion joueur (`/?pin=…`, lien du QR
// code). Le routeur décode la query string en JSON : un PIN tout en chiffres
// arrive en NOMBRE. Le parent `(auth)` et la page partagent ce schéma — une
// version `z.string()` dans l'un d'eux faisait échouer la validation et
// affichait l'écran d'erreur du routeur au scan du QR code.
export const joinSearchSchema = z.object({
  pin: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v === null || v === undefined ? v : String(v))),
})
