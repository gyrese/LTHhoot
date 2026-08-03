// Nom du quiz montré aux joueurs : le nom public s'il est renseigné, sinon le
// titre interne. Un seul point de vérité, partagé par le serveur (salon,
// podium, quiz solo) et le web (page solo, modale de diffusion).
export const quizzDisplayName = (quizz: {
  subject: string
  publicName?: string
}): string => quizz.publicName?.trim() || quizz.subject
