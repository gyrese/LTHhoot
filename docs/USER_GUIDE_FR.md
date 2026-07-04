# 🎮 Guide Utilisateur Exhaustif — LTNHoot

Bienvenue dans le guide utilisateur de **LTNHoot**, une plateforme de quiz open-source, auto-hébergée et interactive, inspirée de Kahoot et dérivée de Rahoot. Ce document explique en détail comment installer, configurer, administrer et animer des parties sur LTNHoot, ainsi que l'utilisation de ses fonctionnalités avancées (éditeur de quiz complet, boutique en ligne, 16 power-ups et le Mode Soirée).

---

## 🗺️ Sommaire
1. [Introduction & Concept](#1-introduction--concept)
2. [Installation et Déploiement](#2-installation-et-déploiement)
3. [Configuration & Administration](#3-configuration--administration)
4. [L'Interface Manager (Tableau de Bord)](#4-linterface-manager-tableau-de-bord)
5. [L'Éditeur de Quiz](#5-léditeur-de-quiz)
6. [Les 9 Types de Questions en Détail](#6-les-9-types-de-questions-en-détail)
7. [Expérience Joueur & Déroulement d'une Partie](#7-expérience-joueur--déroulement-dune-partie)
8. [Le Mode Soirée (Multi-Quiz Cumulatif)](#8-le-mode-soirée-multi-quiz-cumulatif)
9. [Boutique & Catalogue des Power-Ups](#9-boutique--catalogue-des-power-ups)
10. [Résilience et Tolérance aux Pannes Réseau](#10-résilience-et-tolérance-aux-pannes-réseau)
11. [FAQ et Résolution des Problèmes](#11-faq-et-résolution-des-problèmes)

---

## 1. Introduction & Concept

**LTNHoot** réinvente l'animation de quiz en présentiel ou en ligne. Conçu pour offrir une expérience fluide, dynamique et hautement interactive, il propose des améliorations majeures par rapport aux plateformes classiques :

*   🎨 **Interface Manager Moderne** : Un tableau de bord plein écran avec barre latérale pour la gestion des dossiers/tags, recherche rapide, et pied de page d'action pour le contrôle des parties.
*   🏆 **Podium & Classement Animés** : Des transitions fluides et festives à chaque fin de manche pour maintenir le suspense.
*   🧑‍🤝‍🧑 **Générateur d'Avatars** : Chaque joueur se voit attribuer un avatar unique lors de sa connexion, renforçant l'identité visuelle de sa session.
*   📂 **Organisation par Dossiers & Tags** : Classez et filtrez vos quiz facilement dans le manager pour retrouver vos contenus en un clin d'œil.
*   🌐 **Support Multilingue** : Interface intégralement traduite (Français, Anglais, Allemand, Espagnol, Italien).
*   🃏 **9 Types de Questions** : Du QCM classique à la sélection sur carte (Drop Pin), en passant par les séquences d'images et les puzzles.
*   ⚡ **Système de Boutique & Power-ups** : Une dimension stratégique où les bonnes réponses rapportent des pièces d'or permettant d'acheter des bonus ou des malus dans une boutique intégrée.
*   🛡️ **Tolérance aux pannes réseau** : Capacité de reconnexion transparente pour les joueurs et sauvegarde automatique de l'état du serveur en cas de crash.

---

## 2. Installation et Déploiement

LTNHoot fonctionne sur une architecture monorepo moderne (pnpm workspaces) combinant un serveur backend en Node.js (Socket.IO) et un frontend React (Vite).

### A. Déploiement recommandé (Docker Compose)

C'est la méthode la plus rapide et la plus stable pour la production. Un fichier [compose.yml](file:///c:/ai/LTNhout/compose.yml) est mis à disposition à la racine du projet.

1.  **Démarrage rapide** :
    ```bash
    docker compose up -d
    ```
2.  L'application est immédiatement accessible à l'adresse suivante : **http://localhost:3000**
3.  Le dossier `config/` est créé automatiquement à la racine de l'hôte lors du premier démarrage pour stocker vos données persistantes.

### B. Déploiement manuel (Sans Docker)

Pour les développeurs ou pour des besoins d'hébergement personnalisés :

*   **Prérequis** : Node.js version 22+ et le gestionnaire de paquets `pnpm`.
*   **Étapes** :
    1.  Cloner le dépôt Git :
        ```bash
        git clone https://github.com/gyrese/LTHhoot.git
        cd LTHhoot
        ```
    2.  Installer les dépendances du monorepo :
        ```bash
        pnpm install
        ```
    3.  **Mode Développement** (démarre le serveur socket sur `:3001` et le client Vite sur `:3000` avec proxying automatique) :
        ```bash
        pnpm dev
        ```
    4.  **Mode Production** (compile le code et démarre les serveurs assemblés) :
        ```bash
        pnpm build
        pnpm start
        ```

---

## 3. Configuration & Administration

Toute la persistance de l'application repose sur des fichiers JSON structurés au sein du dossier `config/` (monté en volume sous Docker).

### A. Configuration générale (`config/game.json`)

Le fichier principal de configuration définit l'accès à l'interface d'administration :

```json
{
  "managerPassword": "VOTRE_MOT_DE_PASSE_SECURISE"
}
```

> [!WARNING]
> Par défaut, le mot de passe est `"PASSWORD"`. Vous devez impérativement le modifier avant la première session publique, sous peine de voir l'accès à votre console d'administration verrouillé ou piraté.

### B. Structure des dossiers de persistance

*   `config/quizz/` : Contient un fichier JSON par quiz créé. C'est ici que l'éditeur écrit les questions, slides et configurations de média.
*   `config/results/` : Conserve l'historique complet de chaque partie terminée avec le détail des points des joueurs.
*   `config/state/` : Dossier système contenant `games.json`, utilisé pour la persistance à chaud de l'état du jeu (checkpoints de sauvegarde pour la reprise sur crash).

---

## 4. L'Interface Manager (Tableau de Bord)

L'accès à l'interface d'administration s'effectue en naviguant sur **http://localhost:3000/manager** et en saisissant le mot de passe configuré.

L'interface se présente sous la forme d'un tableau de bord plein écran ultra-fluide :

*   **Barre Latérale (Sidebar)** :
    *   **📁 Dossiers** : Permet de filtrer la liste des quiz selon leur catégorie d'organisation.
    *   **🏷️ Tags** : Filtre rapide par mots-clés associés aux quiz.
    *   **📊 Résultats** : Accès direct à l'historique des anciennes parties avec visualisation des classements et détails des joueurs.
*   **Panneau Principal (Grille)** :
    *   Présente les quiz sous forme de cartes visuelles avec leurs images de couverture, titre et tags.
    *   Un champ de **Recherche** en haut permet de filtrer instantanément par titre ou description.
    *   Boutons d'action rapide en haut à droite : **[+ Créer]** un quiz, **[↑ Importer]** un quiz JSON ou CSV, et **[🎉 Soirée]** pour activer le mode multi-quiz.
*   **Pied de page d'Action** :
    *   Lorsqu'un quiz est sélectionné (clic sur sa carte, matérialisé par une bordure orange), le pied de page affiche les détails du quiz et le bouton **▶ Démarrer la partie**.
    *   Si le Mode Soirée est actif, le footer récapitule la file d'attente des quiz sélectionnés dans l'ordre, affiche la durée estimée et propose le bouton **▶ Démarrer la soirée**.

---

## 5. L'Éditeur de Quiz

L'éditeur intégré offre une flexibilité totale pour concevoir des diapos et questions interactives complexes.

### A. Paramètres généraux du quiz
En cliquant sur l'icône de rouage **[Paramètres]** dans l'éditeur, vous accédez à :
*   Le **Titre** et la **Description** du quiz.
*   L'**Image du Salon** (affichée aux joueurs dans la salle d'attente) et l'**Image de Liste** (vignette du manager).
*   L'affectation à un **Dossier** et l'ajout de **Tags** de recherche.

### B. Outils d'import et d'export
*   **Export JSON** : Sauvegarde le quiz complet dans un fichier JSON réutilisable ou partageable.
*   **Import CSV** : Permet d'intégrer des questions en masse à partir d'un tableur. Un modèle type CSV est téléchargeable directement depuis l'interface d'import en cas de besoin.
*   **Générateur IA** : Un bouton **[Générer avec l'IA]** (si connecté à une API de modèle) permet de créer des questions automatiquement à partir d'un thème ou d'un texte fourni.

### C. Le Canvas de Diapoisitive (Slide Canvas)
Pour chaque question ou titre, un éditeur visuel complet vous permet d'ajouter des éléments superposés :
*   **Zones de texte** : Taille, couleur (palette HSL), police, styles (gras, souligné) et alignement configurables.
*   **Formes géométriques** : Rectangles (avec arrondis optionnels), cercles, triangles, étoiles, avec choix de couleurs.
*   **Images personnalisées** : Possibilité de téléverser ses propres fichiers ou d'utiliser le moteur de recherche média intégré.
*   **Vidéos YouTube** : Intégration par identifiant de vidéo avec réglage précis des temps de début et de fin de lecture (start/end offsets), mise en sourdine ou lecture automatique.
*   **Verrouillage** : Chaque élément peut être verrouillé sur la grille pour éviter les déplacements accidentels lors de l'édition.

### D. Paramétrage des Questions
Dans la barre latérale droite de l'éditeur de questions, vous configurez :
1.  **Chronomètre (Time Limit)** : Durée de réponse accordée aux joueurs (entre 5 et 120 secondes).
2.  **Délai d'attente (Cooldown)** : Temps d'affichage de la question sur l'écran principal avant que le chronomètre ne démarre pour les joueurs (entre 3 et 15 secondes). Utile pour laisser le temps de lire l'énoncé.
3.  **Mort Subite (Sudden Death)** : Si activé, la manche prend fin immédiatement dès que le premier joueur fournit la bonne réponse.
4.  **Révélation progressive (Answer Reveal)** : Pour masquer ou dévoiler progressivement l'image ou la vidéo de réponse, ou afficher un texte explicatif à la fin de la question.

---

## 6. Les 9 Types de Questions en Détail

Chaque type de question propose une mécanique de réponse et de point unique pour s'adapter à toutes les formes d'apprentissage ou de divertissement.

### 1. QCM (mcq)
*   **Description** : Question à choix multiples classique comportant 2, 3 ou 4 options de réponse textuelles.
*   **Configuration** : Remplissez les libellés des réponses et cochez la ou les cases de solution correcte. Plus d'une réponse peut être valide.
*   **Côté Joueur** : Le joueur voit 2 à 4 boutons colorés ornés de formes géométriques correspondant aux réponses de l'écran hôte.

### 2. Vrai / Faux (true_false)
*   **Description** : Question binaire rapide.
*   **Configuration** : Indiquez simplement si l'affirmation est Vraie ou Fausse.
*   **Côté Joueur** : Deux larges boutons (Bleu pour Vrai, Rouge pour Faux).

### 3. Question Ouverte (open)
*   **Description** : Demande aux joueurs de saisir du texte libre au clavier.
*   **Configuration** : Saisissez une liste de réponses textuelles acceptées (insensible à la casse et aux espaces superflus).
*   **Côté Joueur** : Un champ de saisie texte avec bouton de validation.

### 4. Séquence d'Images (image_sequence)
*   **Description** : Un défilement d'images est présenté aux joueurs sur l'écran hôte à un intervalle défini. Les joueurs doivent saisir la bonne réponse textuelle correspondante.
*   **Configuration** : Téléversez ou sélectionnez la liste des images de la séquence, réglez l'intervalle de défilement (en secondes) et listez les réponses textuelles admises.
*   **Côté Joueur** : Un champ de texte pour taper la réponse pendant le défilement.

### 5. Date avec Tolérance (date)
*   **Description** : Les joueurs doivent deviner une année ou une date historique précise.
*   **Configuration** : Saisissez l'année correcte (de -9999 à 2200) ainsi qu'une marge de tolérance en années.
    *   *Exemple* : Année 1789, tolérance ±5 ans. Les joueurs tapant entre 1784 et 1794 obtiennent des points.
*   **Côté Joueur** : Une interface de pavé numérique pour saisir l'année.

### 6. Slider Numérique (slider)
*   **Description** : Question nécessitant l'estimation d'une valeur chiffrée sur une échelle définie.
*   **Configuration** : Renseignez la valeur correcte, les valeurs minimale et maximale de l'échelle, et la tolérance admise.
*   **Côté Joueur** : Un curseur à glisser horizontalement pour sélectionner et valider le nombre choisi.

### 7. Puzzle (puzzle)
*   **Description** : Les joueurs doivent ordonner une liste d'éléments.
*   **Configuration** : Saisissez les éléments (2 ou plus) dans le **bon ordre** dans l'éditeur. L'application se charge de les mélanger pour les joueurs.
*   **Côté Joueur** : Une interface de type Glisser-Déposer (Drag and Drop) permettant de réordonner les blocs d'éléments avant de valider.

### 8. Zone Cliquable — Drop Pin (drop_pin)
*   **Description** : Les joueurs doivent placer un repère visuel (un pin) sur une image de fond.
*   **Configuration** : Fournissez l'image de fond et dessinez une ou plusieurs zones rectangulaires sur l'image en spécifiant lesquelles sont "correctes" et leur label associé.
*   **Côté Joueur** : L'image s'affiche sur le smartphone ou l'ordinateur du joueur. Il lui suffit de cliquer/taper directement à l'emplacement souhaité sur l'image pour y déposer son repère.

### 9. Titre / Diapositive (title)
*   **Description** : Un écran purement informatif sans question ni score.
*   **Configuration** : Éléments libres sur le canvas (texte, vidéo d'introduction, règles du jeu).
*   **Côté Joueur** : Écran d'attente avec rappel du titre ou visuels, invitant à regarder l'écran hôte.

---

## 7. Expérience Joueur & Déroulement d'une Partie

### Étape 1 : Connexion
1.  L'animateur lance le quiz depuis le Manager. L'écran de projection s'ouvre, affichant le **Code de Partie** à 6 chiffres et l'adresse IP / URL de connexion.
2.  Les joueurs se rendent sur l'adresse fournie avec leur smartphone, tablette ou ordinateur.
3.  Ils saisissent le code de la partie, puis leur pseudonyme.
4.  L'application leur attribue un **avatar unique** généré à la volée. Le joueur peut modifier les caractéristiques de son avatar jusqu'au lancement de la partie.

### Étape 2 : Le Round de Question
Chaque question suit un cycle automatisé contrôlé par l'hôte :
1.  **Lancement (Phase Cooldown)** : La question et son média d'illustration s'affichent sur l'écran de projection pour lecture.
2.  **Phase Réponse (Chronomètre)** : Le décompte démarre. Les joueurs peuvent soumettre leur réponse. L'écran hôte affiche en temps réel le nombre de réponses reçues.
3.  **Calcul et Révélation** : Une fois le temps écoulé ou toutes les réponses validées, l'écran hôte dévoile la ou les bonnes réponses, ainsi qu'un graphique de répartition des votes des joueurs.
4.  **Classement** : L'hôte affiche le classement temporaire (Top 5) avec les scores mis à jour et les séries de bonnes réponses consécutives (streaks).

---

## 8. Le Mode Soirée (Multi-Quiz Cumulatif)

Le **Mode Soirée** permet de compiler plusieurs quiz pour animer un événement complet sans avoir à déconnecter et reconnecter les joueurs à chaque partie. Les points s'accumulent au fil des quiz pour un classement final unifié.

```
┌────────────────────────────────────────────────────────┐
│                      MODE SOIRÉE                       │
│                                                        │
│   Quiz 1/3 (Terminé)  ➡  Quiz 2/3 (En cours)  ➡  ...  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Comment l'utiliser :
1.  Dans le manager, cliquez sur le bouton **[🎉 Mode Soirée]** en haut à droite.
2.  Sélectionnez les quiz un par un. Une pastille numérique orange apparaît sur chaque carte pour indiquer l'ordre de passage.
3.  Le pied de page récapitule la file d'attente. Vous pouvez cliquer sur la croix `×` d'un quiz dans le footer pour le retirer de la sélection.
4.  Cliquez sur **[▶ Démarrer la soirée]**.
5.  Les joueurs se connectent une seule fois en entrant dans le lobby.
6.  **Interstitiel de fin de quiz** : À la fin de chaque quiz de la soirée, l'écran de projection affiche le classement cumulatif de la soirée en surbrillance, avec le delta de points gagnés lors du dernier quiz (ex: `Alice : 4520 pts (+620 pts)`), accompagné d'une transition animée.
7.  Le podium final couronne le vainqueur de la soirée complète sous une pluie de confettis.

---

## 9. Boutique & Catalogue des Power-Ups

Pour pimenter les parties, LTNHoot intègre un système optionnel d'économie en jeu. L'hôte peut l'activer ou le désactiver lors du lancement du lobby.

### A. L'Économie des Pièces d'Or
*   **Solde de départ** : Chaque joueur commence la partie avec **300 pièces d'or**.
*   **Gain par réponse** : Les joueurs gagnent des pièces d'or à chaque bonne réponse. La formule est de `round(points de la manche × 0.5)`. Ainsi, répondre rapidement rapporte plus de points et donc plus de pièces.
*   **Bonus Soirée** : À la fin d'un quiz intermédiaire en mode soirée, les joueurs reçoivent des bonus :
    *   Victoire du quiz : **+500 pièces**.
    *   Quiz parfait (sans faute) : **+1000 pièces**.
*   **Limite d'inventaire** : Un joueur peut stocker au maximum **3 power-ups** à la fois dans son inventaire.

### B. Utilisation de la Boutique
Pendant les phases de question et de sélection de réponse, un bouton boutique (matérialisé par une icône de pièces d'or) apparaît sur l'écran du joueur. En cliquant dessus, le tiroir de la boutique (**Shop Drawer**) s'ouvre, classant les power-ups par niveau de rareté et affichant leur tarif :

*   🟢 **Commun** : 150 Pièces
*   🔵 **Rare** : 400 Pièces
*   🟣 **Légendaire** : 800 Pièces

Un clic sur "Acheter" débite le solde du joueur et ajoute l'objet à son inventaire (si l'emplacement est libre).

### C. Catalogue des 16 Power-Ups

| Rareté | Power-up | Cible | Coût | Effet détaillé |
| :--- | :--- | :--- | :--- | :--- |
| 🟢 **Commun** | **SHIELD** (Bouclier) | Soi-même | 150 | Protège des attaques ciblées ennemies (Bomb, Steal, Swap, Poison, Sniper, Apocalypse). Se consomme à l'impact. *N'arrête pas la Méga-Bombe.* |
| 🟢 **Commun** | **FREEZE** (Gel) | Tous les adversaires | 150 | Gèle et bloque l'affichage de l'écran de tous les adversaires pendant 3 secondes au début de la prochaine question. |
| 🟢 **Commun** | **SAFETY_NET** (Filet) | Soi-même | 150 | Garantit un score minimal de 50 points sur la question suivante en cas de mauvaise réponse. |
| 🟢 **Commun** | **SCRAMBLE** (Confusion) | Un adversaire | 150 | Mélange de façon anarchique l'ordre des réponses affichées sur l'écran de la cible lors du prochain tour. |
| 🟢 **Commun** | **SPARK** (Étincelle) | Soi-même | 150 | Confère un bonus fixe de +25 points à la prochaine question si la réponse fournie est correcte. |
| 🔵 **Rare** | **DOUBLE_POINTS** | Soi-même | 400 | Multiplie par 2 les points obtenus à la prochaine question (uniquement si la réponse est correcte). |
| 🔵 **Rare** | **STEAL_POINTS** (Vol) | Le Leader actuel | 400 | Dérobe automatiquement 200 points au leader actuel de la partie pour les ajouter à votre score. Bloqué par un bouclier. |
| 🔵 **Rare** | **BOMB** (Bombe) | Un adversaire au choix | 400 | Inflige une pénalité fixe de -150 points à l'adversaire ciblé. Respecte le Bouclier et le Miroir. |
| 🔵 **Rare** | **SWAP** (Échange) | Un adversaire au choix | 400 | Échange instantanément votre total de points avec celui de la cible choisie. Bloqué par un bouclier. |
| 🔵 **Rare** | **SNIPER** | Deux adversaires | 400 | Tire sur deux cibles désignées et leur inflige une pénalité de -100 points chacune. Respecte le bouclier. |
| 🔵 **Rare** | **MIRROR** (Miroir) | Soi-même | 400 | Renvoie la prochaine attaque ciblée reçue directement à l'expéditeur (ex: Bombe, Méga-Bombe). Se consomme à l'activation. |
| 🔵 **Rare** | **POISONED_GIFT** (Cadeau empoisonné) | Un adversaire au choix | 400 | Empoisonne la cible. Ses points obtenus à la question suivante seront divisés par 2 (s'il répond correctement). Bloqué par un bouclier. |
| 🟣 **Légendaire** | **TRIPLE_POINTS** | Soi-même | 800 | Multiplie par 3 les points obtenus à la prochaine question (uniquement si la réponse est correcte). |
| 🟣 **Légendaire** | **APOCALYPSE** | Tous les adversaires | 800 | Déclenche un cataclysme retirant 300 points à tous les autres joueurs de la session. Consomme les boucliers actifs au lieu de pénaliser en points. |
| 🟣 **Légendaire** | **MEGA_BOMB** | Un adversaire au choix | 800 | Inflige une lourde pénalité de -500 points à la cible. **Ignore les boucliers**, mais peut être renvoyée par un Miroir. |
| 🟣 **Légendaire** | **ROYAL_THEFT** (Vol Royal) | Le Leader actuel | 800 | Dérobe 50 % du total des points du leader actuel pour les ajouter à votre propre score. Bloqué par un bouclier. |

---

## 10. Résilience et Tolérance aux Pannes Réseau

LTNHoot a été fiabilisé pour résister aux aléas réseau fréquemment rencontrés lors de grands événements (Wi-Fi instables, redémarrages de serveurs, etc.).

### A. Reconnaissance de Réception & Retries (Acks)
Auparavant, les réponses des joueurs étaient émises sans confirmation. Désormais, le client utilise des événements avec accusé de réception (**Socket Acks**) :
1.  Lorsqu'un joueur valide une réponse, l'application envoie la donnée et attend un retour du serveur (`ok`, `duplicate` ou `closed`).
2.  Si la connexion faiblit, le client retente automatiquement l'envoi (jusqu'à 2 essais avec délai d'attente).
3.  En cas d'échec de transmission définitif, l'interface du joueur affiche une bannière explicative **"Échec de l'envoi de la réponse"** et lui propose de **Réessayer** manuellement. L'UI ne se bloque plus à tort.

### B. Reconnexion par Client ID
Chaque navigateur de joueur stocke un identifiant unique persistant (`clientId`). Si le joueur perd temporairement sa connexion Wi-Fi ou recharge sa page :
*   Le client se reconnecte silencieusement et transmet son `clientId`.
*   Le serveur réassocie automatiquement le nouveau canal de communication au profil du joueur.
*   **Les scores, le streak et l'inventaire complet de ses power-ups sont préservés.**

### C. Sauvegarde sur Crash (Point de Contrôle)
Le serveur effectue des sauvegardes asynchrones à intervalles réguliers (toutes les 3 secondes en cas de changement) dans le fichier `config/state/games.json`.
*   Si le serveur subit une coupure de courant, un crash ou un redémarrage planifié à la volée : au redémarrage, il recharge l'état complet des salons actifs.
*   Les écrans hôtes et joueurs se reconnectent automatiquement.
*   La partie reprend précisément au début de la question en cours, garantissant qu'aucun point accumulé historiquement ne soit perdu et évitant les double-comptages.

---

## 11. FAQ et Résolution des Problèmes

#### ❓ J'ai lancé l'application en Docker mais le manager me demande un mot de passe et refuse le mien.
Vérifiez que vous avez bien configuré le paramètre `managerPassword` dans le fichier `config/game.json` de votre volume Docker et redémarré le conteneur. Par défaut, le mot de passe est `"PASSWORD"`.

#### ❓ Les joueurs n'arrivent pas à se connecter à l'adresse de mon ordinateur.
Assurez-vous que l'ordinateur qui héberge LTNHoot est accessible sur le même réseau Wi-Fi que les joueurs, et que le pare-feu de votre système autorise les connexions entrantes sur le port `3000`. Si vous utilisez Docker, assurez-vous que les ports `3000` et `3001` (si socket séparé) sont correctement redirigés.

#### ❓ Qu'advient-il des pièces d'or d'un joueur s'il se déconnecte ?
Les pièces d'or sont rattachées directement à l'objet joueur persistant en mémoire. Elles survivent donc intégralement à une déconnexion ou un rechargement de page.

#### ❓ Peut-on désactiver complètement la boutique de power-ups ?
Oui. Lors de la création de la partie sur l'écran du manager, l'hôte peut décocher la case d'activation des Power-ups. Dans ce cas, les joueurs ne recevront pas de pièces d'or et la boutique en jeu sera totalement masquée.

---

*Ce document fait office de référence officielle pour l'utilisation de LTNHoot. Pour des détails sur la contribution au code source ou le signalement de bogues, veuillez consulter le fichier [README.md](file:///c:/ai/LTNhout/README.md) et [CLAUDE.md](file:///c:/ai/LTNhout/CLAUDE.md) à la racine du projet.*
