# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commandes

```bash
# Installer les dépendances (depuis la racine)
pnpm install

# Dev (démarre web + socket en parallèle)
pnpm dev

# Dev package individuel
pnpm dev:web      # Vite frontend sur :3000
pnpm dev:socket   # tsx watch socket server sur :3001

# Build production
pnpm build
pnpm start

# Lint / format
pnpm lint
pnpm format
pnpm format:fix
```

Aucune suite de tests n'existe pour l'instant.

## Architecture

### Structure monorepo

Trois packages via pnpm workspaces :

- `packages/common` — types partagés, validators Zod, constantes d'événements Socket.IO, quiz exemple. Pas de build ; consommé via alias de chemins à la compilation.
- `packages/socket` — serveur Node.js Socket.IO (port 3001). Lit/écrit les fichiers JSON sous `config/`.
- `packages/web` — SPA React 19 + Vite (port 3000). Proxie `/ws` → socket server.

En dev, le proxy Vite fait que le navigateur ne touche que `:3000`. En production (Docker), nginx gère le même routage devant les deux serveurs.

### Flux des événements Socket.IO

Toute la communication passe par des événements Socket.IO typés, définis dans `packages/common/src/constants.ts` (objet `EVENTS`) et typés dans `packages/common/src/types/game/socket.ts`.

La machine d'état du jeu utilise un enum `Status` (`packages/common/src/types/game/status.ts`). Chaque changement d'état émet `game:status` avec `{ name, data }`. Le frontend switche sur `status.name` pour afficher le bon composant.

### State frontend

Deux stores Zustand :
- `usePlayerStore` — identité du joueur, points, status courant
- `useManagerStore` — auth manager, liste des joueurs, status courant, config quiz

`SocketContext` (`features/game/contexts/socket-context.tsx`) contient l'instance socket unique. `useEvent()` est le hook pour enregistrer des listeners typés.

### Éditeur de quiz

`QuizzEditorContext` (`features/quizz/contexts/quizz-editor-context.tsx`) est la source de vérité unique de l'éditeur. Expose `addQuestion`, `removeQuestion`, `reorderQuestions`, `updateQuestion`. La sidebar utilise `@hello-pangea/dnd` pour le drag-and-drop.

### Config / persistance

Toute la persistance est en fichiers JSON plats sous `config/` (monté en volume dans Docker) :
- `config/game.json` — mot de passe manager
- `config/quizz/*.json` — un fichier par quiz
- `config/results/*.json` — un fichier par partie terminée

`packages/socket/src/services/config.ts` est le seul code qui lit/écrit ces fichiers. La variable d'env `CONFIG_PATH` surcharge le chemin relatif par défaut `../../config` (utilisé dans Docker).

### Ajouter un nouveau type de question

1. Ajouter un discriminant de type dans `packages/common/src/types/game/` et mettre à jour le validator Zod dans `packages/common/src/validators/quizz.ts`.
2. Mettre à jour `StatusDataMap` si le nouveau type nécessite un événement de soumission différent.
3. Ajouter la logique de score côté serveur dans `packages/socket/src/services/game.ts`.
4. Ajouter un composant UI éditeur sous `packages/web/src/features/quizz/components/QuestionEditor/`.
5. Ajouter un composant côté joueur sous `packages/web/src/features/game/components/states/`.

### i18n

Toutes les chaînes visibles passent par `react-i18next`. Les fichiers de locale sont dans `packages/web/src/locales/{lang}/{namespace}.json`. Namespaces : `common`, `errors`, `game`, `manager`, `quizz`. Les messages d'erreur émis depuis le socket server sont des clés i18n (ex. `"errors:game.notFound"`) résolus côté client.

### Alias de chemins

`@rahoot/web/*` → `packages/web/src/*`, `@rahoot/common/*` → `packages/common/src/*`, `@rahoot/socket/*` → `packages/socket/src/*`. Résolus par Vite (web) et `tsconfig.json` + `tsx` (socket).

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes -- don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -- then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how


## Task Management

1. Plan First: Write plan to tasks/todo.md with checkable items
2. Verify Plan: Check in before starting implementation
3. Track Progress: Mark items complete as you go
4. Explain Changes: High-level summary at each step
5. Document Results: Add review section to tasks/todo.md
6. Capture Lessons: Update tasks/lessons.md after corrections


## Core Principles

- Simplicity First: Make every change as simple as possible. Impact minimal code.
- No Laziness: Find root causes. No temporary fixes. Senior developer standards.
- Minimal Impact: Only touch what's necessary. No side effects with new bugs.


## Language

- All outputs, explanations, comments, and documentation MUST be written in French
- Do not mix languages unless explicitly requested by the user

