## Plan — Refonte Interface Manager

### Objectif
Remplacer la Card modale centrée (`max-w-md`) par un dashboard plein écran en CSS Grid, sans scroll, avec gestion de dossiers intégrée.

### Layout cible
```
┌─────────────────────────────────────────────────────────┐
│  [Logo ~h-20 centré]              [🌐 Lang] [⎋ Logout]  │  ← Header glassmorphism
├──────────────┬──────────────────────────────────────────┤
│              │  [🔍 Recherche]                [+ ] [↑]  │
│  📁 Tous     │  ┌──────┐ ┌──────┐ ┌──────┐            │
│  📁 Maths    │  │Image │ │Image │ │Image │  CSS Grid   │
│  📁 Science  │  │Titre │ │Titre │ │Titre │  auto-fill  │
│  📁 Culture  │  └──────┘ └──────┘ └──────┘            │
│  ──────────  │  ┌──────┐ ┌──────┐                      │
│  🏷 Histoire │  │Image │ │Image │                      │
│  🏷 Fun      │  │Titre │ │Titre │                      │
│  ──────────  │  └──────┘ └──────┘                      │
│  📊 Résultats│                                          │
├──────────────┴──────────────────────────────────────────┤
│  Quiz sélectionné : [Nom]      [▶ Démarrer la partie]   │  ← Footer action
└─────────────────────────────────────────────────────────┘
```

### Fichiers à modifier / créer
1. `components/Background.tsx` — opacité image fond : 0.5 → 0.65 ✅
2. `pages/manager/config.tsx` — remplacer `<Background>` par layout custom plein écran ✅
3. `features/manager/components/ManagerDashboard/index.tsx` — nouveau composant principal ✅
4. `features/manager/components/ManagerDashboard/DashboardSidebar.tsx` — sidebar dossiers/tags/résultats ✅
5. `features/manager/components/ManagerDashboard/QuizzPanel.tsx` — grille cartes quiz ✅
6. `features/manager/components/ManagerDashboard/ResultsPanel.tsx` — liste résultats ✅

### Règles visuelles
- Fond : image + overlay sombre, `backdrop-blur` sur les panneaux
- Panneaux : `bg-black/30 backdrop-blur-md border border-white/10` (glass)
- Cartes quiz : image cover 100%, gradient bas, titre blanc en bas, hover scale+shadow
- Dossiers sidebar : pill cliquable avec badge count, actif = orange
- Sélection quiz : ring orange sur la carte, nom affiché dans le footer
- Démarrer : bouton orange désactivé si rien sélectionné

---

## Plan — Refonte Présentation (jeu)

### Problèmes identifiés
- Fond garage (`fixed`) empilé visuellement avec fond de la slide → remplacé par `absolute`, uniquement SHOW_ROOM
- Barre blanche du haut (compteur question) coupait l'image → transformée en overlay `absolute` glassmorphism
- Barre blanche joueur en bas → overlay `absolute` glassmorphism
- `h-full` sur enfants flex sans hauteur fixe du parent → section passe à `h-dvh`
- `slideBg` (image marron) comme fond par défaut → remplacé par dégradé bleu nuit
- `CSSProperties` non importé dans `Question.tsx` → corrigé
- `elements?: SlideElement[]` présent dans les données SHOW_QUESTION / SELECT_ANSWER mais jamais rendu → à faire

### Fichiers modifiés
1. `features/game/components/GameWrapper.tsx` — fond `absolute`, overlay compteur/joueur, `h-dvh` ✅
2. `features/game/components/states/Question.tsx` — import CSSProperties, fond dégradé ✅
3. `features/game/components/states/Answers.tsx` — fond dégradé, layout flex ✅
4. `features/game/components/states/Responses.tsx` — layout flex ✅

### À faire
5. `features/game/components/states/Question.tsx` — rendu des `elements` (SlideCanvas read-only) 🔲
6. `features/game/components/states/Answers.tsx` — rendu des `elements` (SlideCanvas read-only) 🔲
7. Vérifier `Start.tsx`, `Podium.tsx`, `PlayerFinished.tsx` — cohérence visuelle 🔲

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

