# Audit global — Fonctionnalités, évolutions & UI/UX

> **Audit refait le 26 septembre 2026** (remplace l'audit du 3 août 2026).
> Périmètre : monorepo complet — `packages/common`, `packages/socket`, `packages/web`.
> Méthode : lecture du code + exécution locale de `pnpm lint`, `pnpm format`, `vitest`, `vite build`.
> Complément : l'audit technique de l'éditeur (`docs/audits/2026-09-17-editeur-quiz.md`), dont les P1 ont été traités (7b2641a, a487829, ceffcc8).

---

## 1. Résumé exécutif

| Domaine | Note | Évolution depuis août | État |
| :--- | :---: | :---: | :--- |
| Richesse fonctionnelle | 9/10 | ↗ | 10 types de questions, soirée, boutique de power-ups, solo, télécommande, IA, révélations |
| Finition UX hôte (manager) | 6/10 | = | Beau sur desktop, **inutilisable sur mobile/tablette**, modales sans clavier |
| Finition UX jeu (joueur/projecteur) | 6.5/10 | ↗ | Reconnexion solide, mais lisibilité projecteur, safe-area et i18n à reprendre |
| Sécurité | 5/10 | ↘ | **PIN admin `1234` codé en dur**, solutions du solo exposées, `clientId` diffusés |
| Qualité / CI | 8.5/10 | ↗↗ | Lint + format verts, **155 tests serveur OK** (vs 75), 0 test front |
| Performance | 6/10 | ↘ | Bundle **2,22 Mo** (vs 2,15), pas de code splitting, re-renders 60 Hz |
| Internationalisation | 4/10 | — | Textes FR affichés en EN/DE/ES/IT, clés brutes visibles sur la télécommande |

**En une phrase :** le produit est très riche, mais l'empilement de fonctionnalités a laissé des trous de sécurité, des fonctions à moitié branchées (soirée, power-ups) et une dette UX (mobile, i18n, accessibilité) qui se voit dès qu'on sort du desktop français.

### État CI vérifié (26/09)

| Contrôle | Résultat |
| :--- | :--- |
| `pnpm format` | ✅ OK (bloqueur P0 d'août corrigé) |
| `pnpm lint` | ✅ 0 erreur (bloqueur TS2345 d'août corrigé), 3 warnings de complexité (`SoloQuizView` 64, `SlideToolbar` 66, `PreviewPresenterView` 44) |
| `vitest` (socket) | ✅ 14 fichiers, 155 tests |
| Tests front | ❌ aucun |
| `vite build` | ⚠️ 1 chunk de **2 222 kB** (671 kB gzip) |

---

## 2. 🔴 Bloqueurs — à corriger avant toute nouvelle fonctionnalité

| # | Problème | Preuve | Impact |
| :-: | :--- | :--- | :--- |
| 1 | **PIN `1234` codé en dur qui ouvre une session admin complète** (quiz, résultats, invités, médias). Combiné à `PLAYER.JOIN` (renvoie le `gameId`) + `MANAGER.RECONNECT`, n'importe qui peut prendre le contrôle d'une partie. | `socket/src/handlers/manager.ts:9,122` | Critique |
| 2 | **Le solo public envoie les solutions au client**, pour n'importe quel quiz (aucun flag « public »). Anti-bot basé sur `startedAt` et `timeMs` fournis par le client. Or ces scores alimentent le tirage au sort. | `socket/src/handlers/async-quiz.ts:23-34, 75-80` ; correction côté client `SoloQuizView.tsx:368` | Élevé |
| 3 | **`clientId` des joueurs diffusés à tous** (top du podium, `EVENING.COMPLETE`) alors qu'il sert de jeton de reconnexion et d'auth HTTP (`x-client-id`). | `round-manager.ts:1256,1270`, `services/game/index.ts:387,408` | Élevé |
| 4 | **Parties fantômes en mémoire** : chaque « test drive » depuis l'éditeur crée une partie jamais terminée ; `getGameByManagerSocketId` ne nettoie que la 1ʳᵉ. `endGame()` n'annule ni le cooldown ni les timers. | `registry.ts:64-66`, `web/.../useTestDrive.ts:72`, `services/game/index.ts:1296-1303` | Élevé (fuite + `games.json` qui grossit) |
| 5 | **Double clic sur « Démarrer » = deux parties** (aucun état `isStarting`). | `ManagerDashboard/index.tsx:92-135` | Moyen |

---

## 3. Fonctionnalités — inventaire et état réel

| Fonctionnalité | État | Commentaire |
| :--- | :---: | :--- |
| Partie live (10 types : mcq, vrai/faux, ouverte, slider, date, puzzle, drop pin, grille, séquence d'images, slide titre) | 🟢 | Complet côté serveur et web |
| Reconnexion / reprise après crash | 🟢 | Très solide (fenêtre silencieuse, horloge NTP, snapshot atomique 3 s). Non persistés : **pièces d'or**, inventaires, `eveningGameResults` |
| Duel de départage, événements de manche (x2, mort subite, scramble) | 🟢 | |
| Dashboard manager (dossiers, tags, recherche, lancement 2 clics, partie personnalisée) | 🟡 | Complet sur desktop ; dossiers vides en localStorage uniquement ; pas de tri / duplication |
| **Mode Soirée** | 🟡 | Voir §3.1 |
| **Power-ups** | 🟡 | Voir §3.2 |
| Solo public `/solo/:id` | 🟡 | Seuls mcq, vrai/faux, ouverte, slider, date sont jouables ; puzzle/drop pin/grille/séquence expirent = comptés faux. Sécurité : §2 |
| Télécommande | 🟡 | Ne gère pas la soirée (impossible de passer l'interstitiel) ; clés i18n brutes affichées |
| Résultats + tirage au sort | 🟡 | Bug pagination après suppression ; texte « tirage parmi les 10 meilleurs » faux (le pool est de 3) |
| Partage social / QR | 🔴 | Modale rognée (pas de portal dans un parent `backdrop-blur`), aucune traduction |
| Génération IA (texte + images) | 🟢 | Quotas OK ; aucun timeout (un appel bloqué verrouille le compte) |
| Import JSON/CSV | 🟡 | Toast de succès avant la réponse serveur ; import toujours à la racine ; CSV limité à mcq/open/slider |
| Comptes invités | 🟡 | Suppression d'un invité ne révoque pas sa session ; retour « Accueil » de l'éditeur bloque l'invité sur l'écran PIN admin |
| **Export PPTX** (954 lignes) | ⚫ code mort | Aucun point d'entrée, mais importé statiquement → alourdit le bundle |
| `manager/components/configurations/*` (~600 lignes) | ⚫ code mort | Jamais importé |
| Events socket morts | ⚫ | `PLAYER.UPDATE_LEADERBOARD`, `PLAYER.JOIN_TEAM`, `MANAGER.STATUS_UPDATE`, `DRAW.PICK_WINNER`, `DRAW.SAVE_WINNER`, `MANAGER.GET_LOGS`, `QUIZZ.SAVE_SUCCESS/UPDATE_SUCCESS` ; `POWER_UP.BLOCKED` émis mais jamais écouté |

### 3.1 Mode Soirée — écarts avec le plan

- **Estimation « ~45 min · 42 questions » toujours vide** : `reduce((acc, _q) => acc, 0)` renvoie 0 (`EveningFooter.tsx:42-44`) ; cause racine : `QuizzMeta` ne contient pas le nombre de questions.
- **Pas de delta par quiz (« +320 pts »)** : `EVENING.QUIZ_COMPLETE` n'envoie que le cumul (`index.ts:419-430`), et les résultats archivés par quiz contiennent les points *cumulés* → statistiques par quiz faussées.
- **Soirée bloquée silencieusement** si un quiz suivant est invalide : seul le 1ᵉʳ id est validé (`handlers/game.ts:326`, `index.ts:450-454`). Un quiz supprimé reste d'ailleurs dans la sélection (`QuizzPanel.tsx:99-107`).
- Pas de barre de progression « Quiz 1/3 » en jeu (uniquement dans l'interstitiel).
- Compte à rebours de l'interstitiel relancé à chaque re-rendu (`onContinue` recréé, `GameWrapper.tsx:490`) ; `emit` dans un updater `setState` (`EveningInterstitiel.tsx:74-80`).
- `PlayerFinished` ignore `isEveningFinale` et `podiumTheme` : pas de « Gagnant de la soirée » côté joueur.
- Power-ups activés par défaut en soirée, désactivés en partie simple (`handlers/game.ts:336`, `ManagerDashboard/index.tsx:56-58`).

### 3.2 Power-ups — le code a dépassé le plan

- **17 types avec raretés + boutique à pièces d'or**, au lieu des 5 power-ups gagnés en jeu décrits dans `CLAUDE.md`.
- Gains automatiques (`grantStartGift`, `evaluateRoundEarnings`, `evaluateQuizEndEarnings`) : **appelés uniquement par les tests** → code mort.
- Retrait optimiste de l'objet sans accusé de réception : si le serveur refuse, le joueur le perd à l'écran sans message (`GameWrapper.tsx:363` / `index.ts:613`).
- `POWER_UP.BLOCKED` jamais écouté : l'attaquant ne sait pas que le bouclier l'a bloqué.
- Pas de contrôle de phase : vol/bombe possibles pendant un duel de départage ; auto-ciblage possible ; type inconnu à `BUY_POWER_UP` → exception, ack jamais appelé.
- FREEZE appliqué **uniquement côté client** (`Answers.tsx:133-137`) → contournable. Indicateur FREEZE sur le timer hôte, état `opacity-40 grayscale` et badge « NOUVEAU ! » absents.

### 3.3 Plans `CLAUDE.md` à mettre à jour

| Item | Marqué | Réalité |
| :--- | :-: | :--- |
| Présentation 5 — `elements` dans Question | 🔲 | **Bug** : `SlideCanvas` rendu seulement si `type === "title"` (`Question.tsx:93`) mais le média est masqué dès qu'il y a des `elements` (`:119`) → écran vide pour une question non-slide avec éléments |
| Présentation 6 — `elements` dans Answers | 🔲 | ✅ Fait (`Answers.tsx:395-407`) |
| Présentation 7 — cohérence Start/Podium/PlayerFinished | 🔲 | Toujours à faire |
| Présentation — « dégradé bleu nuit » | ✅ | ❌ Non fait : `/bg-salon.png` utilisé (`Question.tsx:15-19`, `Answers.tsx:376`) |
| Manager — logo centré, dossier actif orange, badge soirée haut-gauche | ✅ | Écarts : logo à gauche, actif `bg-white/20`, badge en haut à droite |
| Power-ups | — | Plan obsolète (boutique, 17 types) |

---

## 4. UI / UX

### 4.1 Manager et éditeur (écran hôte)

**Responsive — bloquant**
- Sidebar fixe `w-64` sans aucun breakpoint (`DashboardSidebar.tsx:463`) : sur 375 px il reste ~90 px pour la grille.
- Footer soirée : 7 contrôles sur une ligne `h-20`, déborde sous ~1100 px.
- **Actions des cartes et des dossiers visibles seulement au survol** (`opacity-0 group-hover:opacity-100`, `QuizzPanel.tsx:315`) → **impossible de modifier/supprimer un quiz sur tablette**. Cibles de ~26 px (< 44 px exigés par le plan).

**Accessibilité**
- Cartes quiz en `<div onClick>` sans `role`/`tabIndex` : sélection impossible au clavier.
- 6 modales (`LaunchModal`, `PowerUpsSettingsModal`, `GuestAccountsModal`, `ShareSocialModal`, `ResultModal`, `MediaSearchModal`) sans Échap, piège de focus ni focus initial — alors que `EditorDialog.tsx` (dialog natif) existe déjà dans l'éditeur.
- Boutons icône sans `aria-label` ; `peer-focus:outline-none` sur les interrupteurs.

**Cohérence visuelle**
- `ResultModal` en `bg-white` au milieu d'une interface sombre glassmorphism.
- Flash clair `bg-gray-50` au chargement de l'éditeur (`pages/manager/quizz/layout.tsx:39`).
- `bg-primary` vs `bg-orange-500` selon les écrans ; classe `bg-slate-850` inexistante.

**Retour utilisateur**
- Échecs de lancement silencieux (`GAME.ERROR_MESSAGE` → `console.warn` seulement).
- Toasts de succès avant la réponse serveur (suppression, import, infos publiques, invités).
- Suppression de dossier sans confirmation ; dossier « Archive » renommable/supprimable ; renommage sans validation (`/` crée une arborescence, nom existant = fusion silencieuse).
- Page « Quiz introuvable » : attend 30 s au lieu d'écouter `QUIZZ.ERROR` ; « Retour » mène à la création d'un nouveau quiz.
- État vide « Aucun quiz » sans bouton Créer / Importer ; cartes sans nombre de questions ni date.

### 4.2 Jeu — écran projecteur

- Timer et compteur de réponses en `text-lg/xl` dans de petites pastilles, compteur de question en `text-sm` : **illisibles au fond d'une salle**.
- Barres de distribution sans les formes (seulement la couleur) ; texte blanc sur jaune ≈ 2:1 de contraste.
- Pas de coupure du son ni de réglage de volume ; `SFX.ANSWERS.MUSIC` existe mais n'est jamais joué.
- `Wait.tsx:34` affiche « 12 Joueurs connectés : ».

### 4.3 Jeu — téléphone joueur

- **Aucune safe-area** (`viewport-fit=cover` absent, aucune `env(safe-area-inset-*)`) : barre joueur, drawer et boutique collés à l'indicateur d'accueil iOS.
- Barre joueur ~68 px mais `pb-12` (48 px) réservés dans `Answers` → boutons de réponse chevauchés.
- PIN en `type="text"` sans `inputMode="numeric"` ni `maxLength=6` (`join/Room.tsx:93`) ; pas d'anti double-envoi ; logo `h-40` + `autoFocus` pousse le formulaire sous le clavier.
- Avatar uniquement aléatoire, bouton de 32 px sans `aria-label`.
- Timer calculé avec `Date.now()` local alors que `endTime` est en heure serveur (`Answers.tsx:103-112` vs `:298-318`) → faux si le téléphone est décalé ; barre de `Question.tsx` qui repart de zéro après reconnexion.
- Overlay de reconnexion en français en dur, jargon « Mode Ultra-Stable Polling », sans bouton Réessayer/Quitter.
- Carte de score : téléchargement seulement, pas de `navigator.share` (médiocre sur iOS).
- Points forts : `prefers-reduced-motion` respecté (`MotionConfig`), vibrations, formes sur les boutons de réponse.

### 4.4 Internationalisation

Parité des clés mesurée (référence `fr`) :

| Fichier | en | de / es / it |
| :--- | :-: | :-: |
| `game.json` | −10 | −16 |
| `manager.json` | −10 | −12 |
| `errors.json` | −2 | −8 |
| `quizz.json` | −1 | −3 |
| `common.json` | −2 | −2 |

S'y ajoutent des clés **absentes même en français** (41 dans le manager : `manager:evening.*`, `manager:powerups.*`…) et des défauts rédigés en français → **un utilisateur anglophone voit du français**. La télécommande affiche des **clés brutes** (`game:startIn`, `readingTime`, `waitingForGame`…). Composants sans aucune traduction : `ShareSocialModal`, `SoloDrawModal`, `MediaSearchModal`, `ReconnectingOverlay`, `PowerUpConfirmDrawer`, `powerupMeta.ts`, `ResultModal*`.

### 4.5 Performance

- Bundle unique **2,22 Mo** : aucune route lazy ; Konva, pptxgenjs (code mort !), motion chargés pour un joueur qui ne fait que rejoindre.
- `BackgroundRevealer` : `setProgress` toutes les 16 ms → re-rendu React 60 Hz d'un composant de 680 lignes, sur l'hôte **et** chaque téléphone.
- `SocketProvider` : `value` non mémoïsée + abonnement aux stores entiers pour un `console.log` → re-rendu de tous les consommateurs ; `console.log` en production dans `useEvent`.
- **Diffusion N²** : `GET_INVENTORY` à chaque changement de statut → `NEW_PLAYER` renvoyé pour chaque joueur (~2 450 events par phase à 50 joueurs).
- `RECONNECT` émis 2× (joueur) et 3× (manager) par connexion.

---

## 5. Autres points serveur

- **Se ré-inscrire fait perdre ses points** : `PlayerManager.join` supprime l'ancien joueur avant de valider le pseudo (`player-manager.ts:17-48`).
- Arrivée en cours de question : aucun statut reçu, `totalPlayer` faussé.
- Code d'invitation `Math.random` sans test de collision (`utils/game.ts:79-90`) ; expulsion sans effet (retour immédiat possible) ; pas de nombre max de joueurs.
- Payloads socket non validés hors login/pseudo/quiz (`EVENING.START`, `BUY_POWER_UP`, `SELECTED_ANSWER` avec ack non vérifié, avatar sans limite de taille).
- CORS `origin: ALLOWED_ORIGIN ?? "*"` ; pas de rate limit sur `PLAYER.JOIN`, `/og`, `/solo` ; sessions manager sans expiration ; erreur Gemini brute renvoyée par `/ai-image`.
- ✅ Corrigé depuis août : rate limiting auth manager, mot de passe scrypt + `timingSafeEqual`, contrôle de room manager, uploads durcis (auth avant multer, WebP, CSP sandbox, quotas), anti-SSRF sur l'import d'URL, écritures de fichiers atomiques.

---

## 6. Plan d'action priorisé

### 🔴 P0 — Sécurité & intégrité (≈ 1,5 j)
1. Supprimer `REMOTE_PIN = "1234"` → variable d'environnement ou jeton télécommande à usage unique limité à un `gameId`. *(faible)*
2. Solo : ne renvoyer que énoncés + choix, **correction et chronométrage côté serveur**, flag `soloPublic` sur le quiz, rate limit IP. *(moyen)*
3. DTO `PublicPlayer` sans `clientId` dans tous les payloads diffusés. *(faible)*
4. `Game.dispose()` appelé par `removeGame` (cooldown, timers, `socketsLeave`) + nettoyage des parties de test. *(faible)*
5. État `isStarting` sur Démarrer / Démarrer la soirée + toast sur `GAME.ERROR_MESSAGE`. *(faible)*

### 🟠 P1 — Bugs visibles & fonctions à moitié branchées (≈ 3 j)
6. `Question.tsx` : rendre `elements` pour tous les types (ou ne plus masquer le média).
7. Power-ups : ack sur `USE` (restauration + toast si refus), écouter `BLOCKED`, FREEZE côté serveur, contrôle de phase et d'auto-ciblage ; **trancher** : supprimer le code de gain automatique ou l'exposer en option.
8. Soirée : `questionCount` dans `QuizzMeta` (estimation réelle + badge sur cartes), delta par quiz, validation de tous les `quizIds`, nettoyage à la suppression, `onContinue` mémoïsé, support télécommande, finale côté `PlayerFinished`, persistance `goldCoins`.
9. `ShareSocialModal` en portal + « 10 » → `SOLO_DRAW_POOL_SIZE` ; pagination résultats ; Archive protégé ; confirmation de suppression de dossier ; navigation éditeur → `/manager/config`.
10. `PlayerManager.join` : conserver les points en cas de re-login, valider avant de supprimer.
11. Timer joueur sur `getServerTime()` partout ; barre de Question pilotée par `endsAt`.

### 🟡 P2 — UX mobile, accessibilité, i18n (≈ 4 j)
12. **Dashboard responsive** : sidebar en tiroir sous `lg`, footer soirée sur 2 lignes, actions visibles en `focus-within` et `@media (hover: none)`, cibles ≥ 44 px.
13. **Primitive de modale unique** (réutiliser `EditorDialog` ou Radix Dialog) pour les 6 modales manager.
14. **Mobile joueur** : `viewport-fit=cover` + safe-area, marge basse = hauteur réelle de la barre, PIN numérique, anti double-envoi.
15. **Lisibilité projecteur** : timer circulaire géant, compteur de réponses en grand, formes sur les barres de distribution, contraste du jaune.
16. **Passe i18n complète** + script CI de parité des clés (bloquant) ; télécommande en priorité ; overlay de reconnexion traduit avec bouton Quitter ; `aria-live` sur timer et confirmation.

### 🟢 P3 — Performance & dette (≈ 3 j)
17. Code splitting par route (éditeur Konva, remote, solo) → objectif < 600 kB pour la page joueur.
18. Supprimer le code mort (`export-pptx.ts` ou le rebrancher en `import()` dynamique, `configurations/*`, events morts, icônes inutilisées).
19. `BackgroundRevealer` en rAF/CSS sans état React ; `SocketProvider` mémoïsé ; suppression des logs de debug ; dédoublonnage `RECONNECT` et suppression de la diffusion N².
20. Validation Zod par event socket (`validated(schema, handler)`) ; CORS strict par défaut ; sessions manager avec TTL et révocation.
21. Premiers tests front (Vitest + Testing Library) sur `Answers`, `SoloQuizView`, `ManagerDashboard`.

---

## 7. Évolutions produit proposées

| Évolution | Valeur | Effort | Commentaire |
| :--- | :-: | :-: | :--- |
| **Statistiques par question** (taux de réussite, questions trop dures/faciles) après chaque partie | ★★★ | Moyen | Suppose une persistance structurée (SQLite) des réponses |
| **Playlists de soirée** réordonnables et sauvegardées | ★★★ | Faible | Complète le mode Soirée existant |
| **Duplication de quiz**, tri (date/nom), recherche par tag | ★★ | Faible | Frictions quotidiennes de l'hôte |
| **Solo complet** : prise en charge puzzle / grille / drop pin / séquence via `AnswerInputs` | ★★ | Moyen | À faire après la correction serveur (P0-2) |
| **Profils joueurs persistants** (pseudo + avatar choisi, classement saisonnier entre soirées) | ★★ | Élevé | Fidélisation d'un public récurrent |
| **Mode équipes** (`PLAYER.JOIN_TEAM` déjà déclaré) | ★★ | Moyen | Très demandé en soirée/bar |
| Musique d'attente et contrôle du volume hôte | ★★ | Faible | `SFX.ANSWERS.MUSIC` existe déjà |
| Partage natif de la carte de score (`navigator.share`) | ★ | Faible | Viralité |
| Google Drive configuré côté serveur (env) au lieu de clés par hôte | ★ | Faible | |
| Import CSV étendu aux nouveaux types + modèle téléchargeable depuis le dashboard | ★ | Faible | |
