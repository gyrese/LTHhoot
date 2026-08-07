# Audit global — LTNhout (Rahoot)

> **Audit mis à jour le 3 août 2026.**
> Périmètre : Monorepo complet (`packages/common`, `packages/socket`, `packages/web`, `ltnhoot-tests`, infrastructure CI/Docker).

---

## 1. Résumé exécutif

L'application **LTNhout** (ex-Rahoot) est une plateforme complète d'animation interactive de quiz inspirée de Kahoot, enrichie de fonctionnalités modernes :
- **Mode multijoueur temps réel** via WebSockets (Socket.IO).
- **Mode Solo public** (`/solo/:id`) sécurisé par Captcha anti-robot, honeypot et temporisation de règles.
- **Génération automatique de cartes Open Graph** (`/og/:id.png`) dynamicisées avec Sharp pour les réseaux sociaux.
- **Génération de quiz assistée par IA** (`@google/genai`).
- **Gestionnaire de comptes invités** avec hachage de sécurité.
- **Éditeur graphique interactif de diapositives** (Konva).

### Score de Santé du Projet
| Domaine | Note | État |
| :--- | :---: | :--- |
| **Fonctionnalités & UX** | 9/10 | 🟢 Trè élevé (Mode solo, 5 types de questions, Powerups, OpenGraph, Design 3D) |
| **Backend & Stabilité** | 8.5/10 | 🟢 Solide (75 tests unitaires backend passés, nettoyage d'orphelins, suite crash-recovery) |
| **Build Production** | 8/10 | 🟡 Fonctionnel avec avertissement (Taille bundle Web > 2.15 Mo) |
| **Sécurité** | 7.5/10 | 🟡 En nette progression (Mots de passe hachés, Captcha anti-bot sur Solo, CORS à affiner) |
| **Qualité CI & Intégration** | 5/10 | 🔴 Bloquant (`main` en échec sur `pnpm lint` et `pnpm format`) |

---

## 2. Bloqueurs immédiats (CI & Qualité Code)

### 🔴 1. Échec du workflow CI sur `main` (`pnpm lint`)
- **Problème** : Erreur TypeScript `TS2345` dans `packages/socket/src/services/ai-prompt.test.ts` (l. 94, 95, 103, 112, 113, 120, 127, 131, 138, 143).
- **Cause** : Type-mismatch entre `difficulties: readonly ["medium"]` (inféré comme tuple en lecture seule) et le type mutable attendu `QuestionDifficulty[]`.
- **Impact** : Le workflow GitHub Actions (`.github/workflows/ci.yml`) échoue sur l'étape `pnpm lint`.

### 🔴 2. Échec du contrôle de formattage Prettier (`pnpm format`)
- **Problème** : 12 fichiers hors des standards Prettier dans `packages/common` et `packages/socket` (`status.ts`, `manager.ts`, `round-event.ts`, `difficulty.ts`, `game.ts`, `folders.ts`, `guest.ts`, `ai-prompt.ts`, etc.).
- **Impact** : L'étape `Check formatting` du CI échoue.
- **Solution** : Exécuter `pnpm format:fix`.

---

## 3. Ce qui fonctionne & Évolutions récentes

### Backend & Socket.IO (`packages/socket`)
- **Suite de tests unitaires (75 tests Vitest)** : 100% passés (`ai-prompt`, `powerup-manager`, `open-answers`, `collect-media-refs`, `game`, `config.guests`, `config.prune`).
- **Générateur Open Graph (`/og/:id.png`)** : Composition d'images 1200x630 via `sharp` avec vignette, voile sombre, logo centré et cache en mémoire de 10 min.
- **Sécurisation des comptes invités (`config.guests.ts`)** : Mots de passe hachés (aucune donnée d'authentification stockée en clair).
- **Service de nettoyage des uploads orphelins (`config.prune.ts`)** : Détection et suppression automatique des médias non référencés.

### Frontend React (`packages/web`)
- **Mode Solo Public (`/solo/:id`)** : Vue dédiée avec Captcha anti-robot, honeypot invisible et écran de règles de 3 secondes avant la première question.
- **Design & UI Premium** : Intégration de style verre translucide (*frosted glass*), encarts 3D cristal, mascotte animée et gestionnaires de particules/confettis.
- **Support des métadonnées sociales** : Injection dynamique de `og:title`, `og:description` et `og:image` pour le rendu par les crawlers.

### Infrastructure & CI/CD
- **Suite E2E Playwright Crash-Recovery** (`ltnhoot-tests`) : Tests automatisés de reprise après coupure réseau et interruption brutale du serveur (SIGKILL).
- **Workflow CI consolidé** (`.github/workflows/ci.yml`) sur branche `main`.

---

## 4. Analyse détaillée & Points d'attention

### ⚡ 1. Performance & Bundle Web (Front-End)
- **Constat** : Le fichier principal généré `dist/assets/index-B-RlXExe.js` pèse **2 155.05 kB** (652 kB gzip).
- **Causes** : Import monolithique de bibliothèques lourdes (`konva`, `pptxgenjs`, `howler`, `lucide-react`, `motion`, `@tanstack/react-router`) sans découpage par route (*code splitting*).
- **Recommandation** : Activer le chargement différé (*lazy loading*) des routes TanStack Router (notamment l'éditeur de quiz Konva et l'import PPTX).

### 🔒 2. Sécurité & Anti-Abus
- **Captcha Solo** : Bon garde-fou côté serveur avec vérification du temps minimum et honeypot.
- **Auth Manager & Socket** : Vérifier que le rate limiting est actif sur `MANAGER.AUTH` et la création de partie `GAME.CREATE`.
- **En-têtes CORS** : S'assurer de la présence d'une restriction explicite d'origine dans Socket.IO en environnement de production.

### 🧪 3. Couverture de Tests
- **Backend (`@rahoot/socket`)** : Excellente couverture unitaire sur les modules critiques.
- **Frontend (`@rahoot/web`)** : Aucune suite de tests unitaires/composants (React Testing Library / Vitest).

---

## 5. Plan d'action recommandé (Priorisé)

### 🔴 P0 — Corrections urgentes (Rétablir la CI sur `main`)
1. **Fixer le type TypeScript dans `ai-prompt.test.ts`** :
   Changer `difficulties: ["medium"] as QuestionDifficulty[]` pour lever l'incompatibilité avec `readonly`.
2. **Exécuter `pnpm format:fix`** pour harmoniser le code style sur tout le monorepo et valider `pnpm format`.

### 🟡 P1 — Optimisation du Bundle Web & Performance
3. **Mettre en place le Code-Splitting Vite / TanStack Router** :
   - Isoler Konva et PPTXGenJS dans des sous-chunks chargés à la demande lors de l'ouverture de l'éditeur de quiz.
   - Ramener le bundle principal sous la barre des 500 kB.

### 🟢 P2 — Consolidation Sécurité & Qualité
4. **Ajouter un Rate Limiting sur les endpoints publics** (`MANAGER.AUTH`, soumissions de réponses Solo).
5. **Introduire des tests unitaires Frontend** sur les composants de jeu (`SoloQuizView`, `Answers`, `Question`).
