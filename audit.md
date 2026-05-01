# Audit global — testrahoot

> Audit réalisé le 2026-04-26. Périmètre : monorepo complet (`packages/common`, `packages/socket`, `packages/web`, infrastructure Docker/nginx).

---

## Résumé exécutif

L'application est un clone de Kahoot fonctionnel couvrant le flux complet d'une partie : création de quiz, salle d'attente, enchaînement de questions (5 types), affichage des résultats et classement final. L'architecture est claire, le typage TypeScript est globalement cohérent, et la séparation des responsabilités est respectée entre les trois packages.

Cependant, plusieurs problèmes bloquants existent en production :

- **Sécurité** : mot de passe manager stocké en clair, pas d'authentification vérifiable côté serveur, path traversal possible sur les IDs de fichiers, CORS non configuré, upload sans filtre MIME.
- **Bugs fonctionnels** : race condition sur l'enchaînement des questions, `startTime` initialisé trop tard (scores corrompus), `useEvent` React non stabilisé (listeners en boucle), clés i18n incorrectes.
- **Internationalisation incomplète** : allemand, espagnol et italien ne couvrent que le namespace `common` — l'interface est illisible pour ces langues.
- **Aucun test** : zéro couverture automatisée sur l'ensemble du projet.

---

## Ce qui fonctionne

### Backend Socket.IO (`packages/socket`)

- **Flux de jeu complet** : création → rejoindre → démarrage → questions avec cooldown → affichage des réponses → classement intermédiaire → classement final → sauvegarde du résultat.
- **5 types de questions** gérés côté serveur : `mcq`, `true_false`, `open`, `date`, `slider` — logique de score, correction et affichage des résultats pour chacun.
- **Machine d'états typée** via `STATUS` et `broadcastStatus`/`sendStatus`, avec envois distincts manager/joueurs.
- **Reconnexion** manager et joueur : restauration du statut courant (`lastBroadcastStatus`, `playerStatus`) ou statut `WAIT` par défaut.
- **`CooldownTimer`** propre avec `start()`/`abort()` retournant une `Promise<void>` correctement `await`able.
- **Protection des handlers manager** via le pattern `withAuth` uniforme.
- **Upload d'images** multipart + conversion WebP (sharp) avec fallback. Limite 20 Mo.
- **Persistance JSON** via `Config` (seul point d'accès aux fichiers), validation Zod à la lecture des quiz.
- **Nettoyage automatique** des parties abandonnées toutes les 60 s (timeout 5 min), arrêt propre sur SIGINT/SIGTERM.

### Frontend React (`packages/web`)

- **Routage** TanStack Router v1 file-based, génération automatique de `route.gen.ts`.
- **Socket context** instancié une seule fois à la racine, `clientId` persisté en `localStorage` (UUID v7), reconnexion automatique.
- **`useEvent`** typé sur `ServerToClientEvents`, cleanup au démontage.
- **Stores Zustand** bien séparés (`useManagerStore`, `usePlayerStore`, `useQuestionStore`) avec `reset()` aux sorties de partie.
- **5 types de réponses joueur** implémentés : MCQ boutons, Vrai/Faux, Open (texte libre), Date (slider), Slider (min/max).
- **Reconnexion joueur et manager** fonctionnelle.
- **Éditeur de quiz complet** : drag-and-drop sidebar, changement de type de question avec préservation des champs communs, éditeur de slides Konva (texte, formes, images, vidéo YouTube, z-order).
- **Import/export JSON** de quiz, filtres par dossier/tags/recherche, vues grille et liste.
- **Animations** : leaderboard Spring animé, podium séquentiel avec sons, confettis.
- **Sons d'ambiance** avec désactivation automatique si media audio/vidéo présent.
- **QR code** d'invitation généré automatiquement dans la salle d'attente.
- **Modale de résultats** structurée (header, réponses, stats, tableau).

### Package Common (`packages/common`)

- **Types union discriminés** sur `QuestionType` avec `BaseQuestion` factorisée.
- **Validators Zod** cohérents pour les 5 types de questions, avec préprocesseur de rétrocompatibilité pour les anciens fichiers JSON sans champ `type`.
- **`StatusDataMap`** = `PlayerStatusDataMap & ManagerStatusDataMap` : les données enrichies manager sont bien séparées.
- Locales `fr` et `en` **complètes et symétriques** sur les 5 namespaces.
- Clés d'erreur émises par le serveur correspondant exactement aux clés de locale.

### Infrastructure

- **Multi-stage Dockerfile** efficace (`base → builder → runner alpine`), cache pnpm via `--mount=type=cache`.
- **Proxy WebSocket nginx** correctement configuré (headers `Upgrade`/`Connection`, `proxy_read_timeout 3600s`, `try_files` pour SPA).
- **Supervisord** avec redirection stdout/stderr vers le conteneur Docker, `autorestart=true`.

---

## Ce qui manque ou est incomplet

### Sécurité — Priorité critique

| # | Problème | Localisation |
|---|----------|-------------|
| S1 | Mot de passe manager stocké en clair (`admin123` par défaut) | `config/game.json`, `services/config.ts` l. 62 |
| S2 | Authentification manager basée sur `clientId` non signé — forgeable par n'importe quel client | `services/manager.ts` l. 18-20 |
| S3 | Path traversal possible sur les IDs de quiz/résultats (`../../etc/passwd`) | `config.ts` : `quizzById`, `deleteQuizz`, `resultById`, `deleteResult` |
| S4 | Upload sans filtre MIME — fichiers `.js`/`.html` acceptés et servis statiquement | `index.ts` l. 28-33, 65-67 |
| S5 | CORS non configuré sur Socket.IO (toutes origines autorisées) | `index.ts` l. 72-74 |
| S6 | `GAME.CREATE` non protégé — n'importe quel client peut créer une partie | `handlers/game.ts` l. 36-48 |
| S7 | Aucun rate limiting sur `MANAGER.AUTH` (force brute possible) | — |
| S8 | Processus supervisor s'exécutent probablement en root | `supervisord.conf` |

### Bugs fonctionnels — Priorité haute

| # | Problème | Localisation |
|---|----------|-------------|
| B1 | `startTime` initialisé après le broadcast `SELECT_ANSWER` → scores basés sur epoch 0 si réponse immédiate | `round-manager.ts` l. 156, 191 |
| B2 | Race condition sur `newQuestion` (appels `async` sans verrou, `currentQuestion` incrémenté sans garde) | `round-manager.ts` l. 97, 371 |
| B3 | `selectAnswer` accepte des réponses hors-phase (pendant `SHOW_PREPARED`/`SHOW_QUESTION`) | `round-manager.ts` l. 316-355 |
| B4 | `useEvent` non mémorisé → listeners se réenregistrent à chaque re-render | `socket-context.tsx` l. 138-156 |
| B5 | Logique de sons dans `Responses.tsx` — 3 `useEffect` contradictoires, musique jamais jouée | `Responses.tsx` l. 39-53 |
| B6 | `Result.tsx` — clé i18n `"rank.other"` sans namespace (doit être `"game:rank.other"`) | `Result.tsx` l. 24 |
| B7 | `QuizzEditPage` sans état d'erreur — bloquée sur le `Loader` si `QUIZZ.DATA` n'arrive pas | `$quizzId.tsx` l. 30-35 |
| B8 | Quiz avec 0 question : `newQuestion` accède à `questions[0]` → `undefined` propagé | `round-manager.ts` |
| B9 | Erreurs dans `resultsSocketHandlers` non émises au client (uniquement `console.error`) | `handlers/results.ts` l. 13-28 |
| B10 | `Question.tsx` n'affiche que les images — vidéo et audio ignorés pendant `SHOW_QUESTION` | `Question.tsx` l. 37-43 |
| B11 | `window.prompt` bloquant dans `SlideEditor` pour l'ajout d'image par URL | `SlideEditor/index.tsx` l. 65 |

### Internationalisation incomplète — Priorité haute

- Langues **de**, **es**, **it** : seul le namespace `common` est traduit. Les namespaces `errors`, `game`, `manager`, `quizz` sont absents → interface illisible pour ces 3 langues en dehors du menu.

| Namespace | fr | en | de | es | it |
|-----------|:--:|:--:|:--:|:--:|:--:|
| common    | ✅ | ✅ | ✅ | ✅ | ✅ |
| errors    | ✅ | ✅ | ❌ | ❌ | ❌ |
| game      | ✅ | ✅ | ❌ | ❌ | ❌ |
| manager   | ✅ | ✅ | ❌ | ❌ | ❌ |
| quizz     | ✅ | ✅ | ❌ | ❌ | ❌ |

- Clé `errors:quizz.tooFewAnswers` réutilisée pour MCQ (min 2) et Open (min 1) — message incohérent.
- Clé `errors:quizz.invalidMediaUrl` déclarée dans les locales mais jamais déclenchée (pas de validation URL dans Zod).
- Fautes typographiques FR : `"a echoué"` (2 occurrences) dans `locales/fr/errors.json` l. 23, 25.
- Chaîne `"Calques (Slide {n})"` codée en dur dans `QuizzEditorSidebar.tsx` l. 105.

### Fonctionnalités manquantes — Priorité moyenne

| # | Manque | Impact |
|---|--------|--------|
| F1 | Aucune limite de joueurs par partie | Performance/équité |
| F2 | Aucune limite de parties simultanées | Épuisement mémoire |
| F3 | Partie terminée non retirée de `Registry` (reste en mémoire si manager connecté) | Fuite mémoire |
| F4 | `onGameFinished` non appelé si le manager ne clique pas sur "Show Leaderboard" → résultat non sauvegardé | Perte de données |
| F5 | Pas de confirmation "Quitter sans sauvegarder" dans l'éditeur de quiz | Perte de travail silencieuse |
| F6 | Pas de protection de route manager côté routeur (uniquement côté socket) | Rendu bref avant redirection |
| F7 | `DateAnswer` : `min={0}` non configurable — inutilisable pour l'histoire ancienne | UX |
| F8 | Images base64 stockées dans le JSON de quiz → fichiers pouvant dépasser des dizaines de Mo | Performance |
| F9 | Aucun test automatisé (unitaires, intégration, e2e) | Maintenabilité |

### Qualité du code — Priorité basse

- **Faute de frappe** : `gmageId` au lieu de `gameId` dans `Registry.getManagerGame` (`registry.ts` l. 47).
- **Chaîne hardcodée** : `"game:errorMessage"` au lieu de `EVENTS.GAME.ERROR_MESSAGE` dans `withGame` (`utils/game.ts` l. 13, 21).
- **`Config.game()`** retourne `{}` silencieusement en cas d'erreur JSON au lieu de propager l'exception.
- **`resultById`** non validé par Zod (contrairement aux quiz) — données corrompues propagées.
- **`legacyMcqValidator`** déclaré mais non utilisé dans `questionValidator` (`quizz.ts` l. 114-124) — code mort.
- **`socket.io`** en `dependencies` dans `common/package.json` alors que c'est une dépendance de types uniquement.
- **`typescript: ^6.0.3`** (pre-release) dans `common/package.json` — version instable.
- **`pnpm@latest`** dans le Dockerfile — build non reproductible.
- **`console.log`** laissé en production dans `GameWrapper.tsx` l. 41.
- **`Answers.tsx`** dépasse 340 lignes avec 5 sous-composants non extraits.
- **Accessibilité** : boutons d'actions iconiques sans `aria-label`, handler `onClick` sur `<div>` dans `Room.tsx` l. 87-99.
- **Nginx** sans `server_tokens off`, headers de sécurité HTTP, ni `client_max_body_size`.
- **`supervisord.conf`** sans utilisateur dédié (`user=`) — processus en root.
- **`compose.yml`** sans `restart: unless-stopped` ni `healthcheck`.

---

## Recommandations priorisées

### Priorité 1 — Sécurité (à faire avant toute mise en production)

1. **Hasher le mot de passe manager** (bcrypt/argon2) dans `config.ts` et le flux d'authentification.
2. **Remplacer l'authentification par `clientId`** par un token signé (JWT ou cookie `httpOnly`) émis à la connexion manager.
3. **Assainir les IDs de fichiers** : valider `[a-z0-9_-]+` + `path.basename()` dans `Config.quizzById`, `deleteQuizz`, `resultById`, `deleteResult`.
4. **Filtrer les uploads** : restreindre multer aux types `image/*`, supprimer le fallback qui sert le fichier original non converti.
5. **Configurer CORS** : `cors: { origin: process.env.ALLOWED_ORIGIN }` dans le constructeur `ServerIO`.
6. **Protéger `GAME.CREATE`** : vérifier `manager.isLogged(socket)` dans `handlers/game.ts`.
7. **Ajouter un rate limiting** sur `MANAGER.AUTH` (5 tentatives/min par IP).

### Priorité 2 — Bugs bloquants

8. **Déplacer `this.startTime = Date.now()`** juste avant le broadcast `SELECT_ANSWER` dans `round-manager.ts`.
9. **Ajouter un flag `inProgress`** dans `RoundManager` pour empêcher les appels concurrents à `newQuestion`.
10. **Stabiliser `useEvent`** avec un `useRef` sur le callback pour éviter les réabonnements.
11. **Corriger `Result.tsx` l. 24** : `"rank.other"` → `"game:rank.other"`.
12. **Gérer le quiz à 0 question** : vérifier `questions.length > 0` dans `RoundManager.start`.
13. **Corriger `Question.tsx`** : utiliser `<QuestionMedia />` pour afficher tous les types de media.
14. **Ajouter un timeout + état d'erreur** dans `QuizzEditPage` si `QUIZZ.DATA` n'arrive pas.

### Priorité 3 — Internationalisation

15. **Compléter les traductions de**, **es**, **it** pour les 4 namespaces manquants.
16. **Créer `errors:quizz.tooFewCorrectAnswers`** distinct de `tooFewAnswers`.
17. **Corriger les fautes typographiques** : `"a echoué"` → `"a échoué"` (fr/errors.json l. 23, 25).
18. **Passer `"Calques"`** par `react-i18next` dans `QuizzEditorSidebar.tsx`.

### Priorité 4 — Fonctionnalités et UX

19. **Retirer la partie de `Registry`** à la fin de `onGameFinished`.
20. **Ajouter `restart: unless-stopped`** dans `compose.yml` et un `HEALTHCHECK` dans le Dockerfile.
21. **Remplacer `window.prompt`** dans `SlideEditor` par un input inline ou une modale.
22. **Ajouter une confirmation "Quitter sans sauvegarder"** dans `QuizzEditorHeader`.
23. **Extraire les sous-composants de `Answers.tsx`** dans des fichiers séparés.

### Priorité 5 — Qualité et dette technique

24. **Épingler `pnpm@<version-exacte>`** dans le Dockerfile et `typescript` à une version stable.
25. **Ajouter des headers de sécurité HTTP** dans `nginx.conf` (`server_tokens off`, `X-Frame-Options`, `X-Content-Type-Options`, `client_max_body_size`).
26. **Ajouter des validators Zod** sur les bornes de `SliderQuestion` (`min < max`, `min <= correctValue <= max`) et `DateQuestion.correctYear`.
27. **Corriger `gmageId` → `gameId`** dans `registry.ts` l. 47.
28. **Écrire des tests** : `checkAnswer`, `timeToPoint`, `CooldownTimer`, `PlayerManager`, `RoundManager` sont des candidats directs pour Vitest sans infrastructure Socket.IO.

---

*Audit produit par 3 agents parallèles (backend, frontend, common/infra) — synthèse par l'orchestrateur.*
