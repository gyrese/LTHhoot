<p align="center">
  <img src=".github/logo.svg" width="420" alt="LTNHoot">
</p>

<h1 align="center">LTNHoot</h1>
<p align="center">Des quiz sur grand écran, des joueurs sur téléphone et un classement pour toute la soirée.</p>
<p align="center">
  <a href="#installation">Installer</a> ·
  <a href="#animer-une-partie">Jouer</a> ·
  <a href="#classement-de-soirée">Organiser une soirée</a> ·
  <a href="#développement">Contribuer</a>
</p>

LTNHoot est une application de quiz multijoueur **libre et auto-hébergée**. L’animateur prépare ses contenus, affiche la partie sur un écran et la pilote depuis son ordinateur ou son téléphone. Les joueurs participent dans leur navigateur, sans application à installer.

## Ce que permet LTNHoot

- **Créer ses quiz** dans un éditeur visuel : questions, images, audio, vidéos et mise en page des diapositives.
- **Organiser sa bibliothèque** avec des dossiers, des favoris, des tags, une recherche et une archive.
- **Animer une partie en direct** avec code d’invitation, avatars, chronomètre, classement et podium.
- **Choisir son rythme** : progression manuelle, mode rapide ou score sans bonus de rapidité.
- **Cumuler les scores d’une soirée**, même lorsque les quiz sont lancés séparément.
- **Activer des power-ups et une boutique** pour ajouter une dimension stratégique aux parties.
- **Partager des quiz solo** accessibles par lien et consulter leurs résultats.
- **Créer des comptes invités** disposant de leur propre bibliothèque et d’un mode de test solo.
- **Importer et exporter ses contenus**, notamment en JSON, avec import de questions CSV et export PowerPoint.
- **Utiliser les aides IA et la recherche de médias**, si leurs clés d’API sont configurées.

L’interface est disponible en français, anglais, allemand, espagnol et italien.

### Questions et diapositives

| Format            | Utilisation                                                  |
| ----------------- | ------------------------------------------------------------ |
| QCM               | Une ou plusieurs bonnes réponses parmi les choix proposés.   |
| Vrai / Faux       | Deux réponses possibles.                                     |
| Réponse libre     | Saisir une réponse textuelle.                                |
| Séquence d’images | Découvrir une succession d’images.                           |
| Date              | Répondre avec une date.                                      |
| Curseur           | Estimer une valeur numérique.                                |
| Puzzle            | Remettre des éléments dans le bon ordre.                     |
| Épingle           | Placer un repère sur une image.                              |
| Grille            | Répondre à partir d’une grille de cases.                     |
| Titre             | Insérer une diapositive de présentation entre les questions. |

## Pr�sentation et demandes de devis

La page publique `/presentation` pr�sente LTNHoot, propose une d�monstration interactive et distingue deux usages : organiser une animation avec Les Toiles Noires ou utiliser l�application soi-m�me. Elle est accessible depuis l��cran o� les joueurs rejoignent une partie.

Les demandes de devis sont pr�par�es pour **contact@lestoilesnoires.re**. Le formulaire ouvre le logiciel de messagerie du visiteur avec les informations de son �v�nement ; il n�envoie aucun message automatiquement et ne n�cessite pas de service d�envoi d�e-mails c�t� serveur.

## Installation

### Avec Docker

Docker et Docker Compose doivent être installés. Pour une installation locale indépendante, crée un fichier `compose.local.yml` :

```yaml
services:
  ltnhoot:
    image: gyrese/lthoot:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
```

Dans le même dossier, démarre l’application :

```bash
docker compose -f compose.local.yml up -d
```

Ouvre ensuite [http://localhost:3000](http://localhost:3000). Le dossier `config/` est initialisé au premier démarrage avec la configuration et un quiz d’exemple. Configure le mot de passe administrateur avant de te connecter, comme indiqué ci-dessous.

**Le fichier [compose.yml](compose.yml) du dépôt correspond à un autre déploiement** : il utilise le réseau externe `nginx-proxy-network`, ne publie aucun port sur l’hôte et monte aussi le dossier des avatars. Il nécessite donc un réseau et un reverse proxy déjà configurés. Pour un accès local direct, utilise l’exemple ci-dessus.

Pour construire une image depuis ta copie du code :

```bash
docker build -t ltnhoot:local .
```

Remplace alors `gyrese/lthoot:latest` par `ltnhoot:local` dans ton fichier Compose. L’image publiée contient la version distribuée ; une compilation locale inclut tes modifications.

### Avec Node.js

Utilise **Node.js 24** et **pnpm 10**, comme dans la CI du projet.

```bash
git clone https://github.com/gyrese/LTHhoot.git
cd LTHhoot
pnpm install --frozen-lockfile
```

Crée un fichier `.env` à la racine, même vide si tu n’utilises aucune intégration, puis lance :

```bash
pnpm dev
```

- Application : [http://localhost:3000](http://localhost:3000).
- Serveur temps réel : port `3001`, joint à travers le proxy du client.
- Les modifications du client et du serveur sont rechargées automatiquement.

Les téléphones doivent accéder à **l’adresse réseau de l’ordinateur**, par exemple `http://192.168.1.20:3000`, et être sur un réseau permettant de le joindre. Sur un téléphone, `localhost` désigne le téléphone lui-même.

## Configuration

### Mot de passe administrateur

Au premier démarrage, `config/game.json` contient la valeur `PASSWORD`. **Cette valeur bloque volontairement la connexion au manager.**

Pour une installation neuve, remplace-la par ton propre mot de passe avant la première connexion :

```json
{
  "managerPassword": "REMPLACER_PAR_UN_MOT_DE_PASSE_PERSONNEL"
}
```

À la première authentification réussie, le serveur remplace automatiquement le mot de passe en clair par un hash dans `managerPasswordHash`. Ce fichier contient des données d’authentification et doit rester privé.

### Variables d’environnement

Les intégrations sont facultatives : les parties et l’éditeur fonctionnent sans clé d’API.

| Variable               | Rôle                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONFIG_PATH`          | Chemin du dossier de données. Par défaut, `config/` à la racine lorsque le serveur est lancé par les commandes du projet ; `/app/config` dans l’image Docker. |
| `WS_PORT`              | Port du serveur Socket.IO, `3001` par défaut. Adapter aussi le proxy si ce port change.                                                                       |
| `ALLOWED_ORIGIN`       | Origine autorisée pour le temps réel, par exemple `https://quiz.example.com`. En production, sans valeur, seules les requêtes de même origine sont acceptées. |
| `REMOTE_PIN`           | PIN facultatif de session limitée de pilotage, d’au moins quatre caractères. Le parcours direct `/remote` utilise le code de partie.                          |
| `GEMINI_API_KEY`       | Clé commune pour les fonctions IA de texte et d’image.                                                                                                        |
| `GEMINI_TEXT_API_KEY`  | Clé dédiée au texte, prioritaire sur la clé commune.                                                                                                          |
| `GEMINI_IMAGE_API_KEY` | Clé dédiée aux images, prioritaire sur la clé commune.                                                                                                        |
| `GEMINI_TEXT_MODEL`    | Surcharge du modèle utilisé pour la génération de texte.                                                                                                      |
| `UNSPLASH_ACCESS_KEY`  | Recherche d’images Unsplash.                                                                                                                                  |
| `GIPHY_API_KEY`        | Recherche de GIF Giphy.                                                                                                                                       |
| `WS_PROXY_TARGET`      | Cible du proxy Vite en développement et en aperçu, `http://localhost:3001` par défaut.                                                                        |

En développement, `pnpm dev` charge `.env`. Avec Docker, ajoute les variables voulues dans la section `environment` du service : un fichier `.env` seul ne les transmet pas automatiquement au conteneur. Le [compose.yml du dépôt](compose.yml) transmet déjà les principales clés d’intégration.

Pour un hébergement public, configure HTTPS et le transfert des connexions WebSocket sur `/ws`. Le conteneur inclut nginx ; sa configuration se trouve dans [docker/nginx.conf](docker/nginx.conf).

## Animer une partie

1. Ouvre `/manager` sur l’écran de l’animateur et connecte-toi.
2. Crée ou importe un quiz, puis sélectionne-le dans la bibliothèque.
3. Clique sur **Démarrer**, ou choisis une **Partie personnalisée** pour régler les options.
4. Affiche le salon sur le grand écran et partage l’adresse de l’application, le code ou le QR d’invitation.
5. Les joueurs rejoignent depuis leur téléphone et choisissent leur pseudo et leur avatar.
6. Lance la partie lorsque les joueurs sont prêts, puis avance jusqu’au podium.

Pour piloter depuis un autre appareil, ouvre `/remote` et saisis le code de la partie. La télécommande donne accès aux commandes d’animation et à la gestion des joueurs. Le parcours actuel permet de la rejoindre avec le code : partage-le dans le cadre de l’événement.

Lorsqu’une explication de réponse contient une vidéo YouTube activée, le bouton **Agrandir la vidéo** apparaît sur la télécommande. Il affiche la vidéo dans un cadre TV d’environ trois quarts de l’écran du salon ; **Réduire la vidéo** rétablit la présentation normale sans relancer la lecture. **Suivant** reste accessible sur le salon et la télécommande et poursuit le quiz normalement. Le mode agrandi est conservé lors d’une reconnexion, puis abandonné en quittant cette réponse.

Les résultats des parties terminées sont disponibles dans la rubrique **Résultats** du manager.

## Classement de soirée

Le mode soirée suit les scores de plusieurs quiz **sans imposer une liste de quiz à préparer**.

1. Clique sur **Démarrer la soirée** dans la bibliothèque.
2. Lance les quiz de ton choix, un par un, comme des parties normales.
3. À la fin de chaque quiz, les points des joueurs sont sauvegardés et ajoutés à leur total.
4. En fin de soirée, clique sur **Terminer la soirée** pour consulter le classement provisoire.
5. Confirme avec **Terminer et afficher le gagnant** pour figer et archiver le classement général.

Les points sont **additionnés**, sans conversion en points de placement ni normalisation selon le nombre de questions. Les quiz conservent chacun leur propre score et leur propre podium.

- Un joueur absent d’un quiz garde ses points précédents.
- L’identité enregistrée dans le navigateur du téléphone relie les participations ; le pseudo seul ne sert pas à fusionner les scores.
- Deux joueurs portant le même pseudo restent distincts. Changer de navigateur, effacer ses données ou changer d’appareil crée une autre identité, sauf récupération de l’identité existante.
- En cas d’égalité au total, les joueurs partagent le même rang et plusieurs vainqueurs peuvent être affichés.
- La clôture est refusée tant qu’une partie liée est en cours ou qu’un salon lié contient des joueurs connectés.
- Le suivi appartient au navigateur de l’animateur qui l’a démarré. Reviens sur ce même navigateur pour le retrouver.

Le dernier classement reste accessible via **Revoir le classement**, et le résultat final est conservé dans **Résultats**. Démarrer une nouvelle soirée crée un nouveau cumul.

## Données et sauvegardes

LTNHoot stocke ses données dans des fichiers JSON et des médias locaux, sans base de données externe.

```text
config/
├── game.json          # Authentification du manager et comptes invit�s
├── quizz/             # Bibliothèque administrateur
├── guests/            # Comptes invités et bibliothèques associées
├── results/           # Résultats des parties et classements archivés
├── uploads/           # Médias importés
└── state/
    ├── games.json     # Instantanés de reprise des parties
    └── evenings.json  # Suivi persistant des soirées
```

Sauvegarde **l’ensemble du dossier `config/`**, de préférence lorsque le service est arrêté, pour conserver un état cohérent. Avec Docker, ce dossier doit rester monté dans un volume persistant.

Les mécanismes de reconnexion et les instantanés permettent de reprendre une partie après une coupure. Ils ne remplacent pas une sauvegarde externe ; après une interruption, vérifie l’état de la partie avant de poursuivre.

### Mettre à jour

Après avoir sauvegardé les données, pour l’installation Docker locale décrite plus haut :

```bash
docker compose -f compose.local.yml pull
docker compose -f compose.local.yml up -d
```

Pour suivre les journaux :

```bash
docker compose -f compose.local.yml logs -f ltnhoot
```

Un déploiement utilisant le fichier du dépôt emploie les mêmes commandes sans `-f compose.local.yml`.

## Développement

### Structure du dépôt

```text
packages/
├── common/       # Types, constantes et validations partagés
├── socket/       # Serveur Node.js et Socket.IO
└── web/          # Interface React et Vite
ltnhoot-tests/    # Scénarios d’intégration et tests Playwright
docker/          # nginx et supervision des processus
docs/            # Documentation complémentaire
```

Le client utilise React, TypeScript, TanStack Router, Zustand et Tailwind CSS. Les échanges de jeu passent par Socket.IO et les payloads sont validés avec Zod.

### Commandes utiles

À exécuter depuis la racine, sauf indication contraire :

| Commande          | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Démarrer le client et le serveur en développement.                |
| `pnpm dev:web`    | Démarrer uniquement le client.                                    |
| `pnpm dev:socket` | Démarrer uniquement le serveur avec surveillance des changements. |
| `pnpm build`      | Compiler le client et le serveur.                                 |
| `pnpm start`      | Lancer le serveur compilé et l’aperçu Vite.                       |
| `pnpm lint`       | Vérifier TypeScript et ESLint.                                    |
| `pnpm format`     | Vérifier la mise en forme.                                        |
| `pnpm format:fix` | Appliquer la mise en forme.                                       |
| `pnpm i18n:check` | Vérifier la présence des traductions.                             |
| `pnpm -r test`    | Exécuter les suites Vitest des paquets.                           |

`pnpm start` sert notamment à vérifier un build local ; pour l’hébergement, l’image Docker fournit nginx et la supervision des processus. Contrairement aux commandes de développement, `pnpm start` ne charge pas automatiquement le fichier `.env` : l’environnement doit être fourni au processus.

### Tests d’intégration

Après `pnpm build`, installe les dépendances de test :

```bash
cd ltnhoot-tests
npm ci
npx playwright install chromium
npm run test:recovery
```

Le scénario de suivi de soirée vérifie deux quiz, la conservation du cumul après redémarrage et l’archivage final :

```bash
npx playwright test --config playwright.evening.config.ts
```

Les configurations isolées démarrent leurs propres serveurs et utilisent des données de test. Consulte leur configuration avant d’exécuter les autres suites sur une instance existante.

### Exemple de quiz JSON

L’éditeur reste le moyen le plus simple de créer des quiz. Pour une intégration ou un import manuel, voici un exemple minimal :

```json
{
  "subject": "Culture générale",
  "questions": [
    {
      "type": "mcq",
      "question": "Quelle est la capitale de la France ?",
      "answers": ["Paris", "Lyon", "Marseille", "Lille"],
      "solutions": [0],
      "time": 20,
      "cooldown": 5
    }
  ]
}
```

Les indices de réponses commencent à zéro. Chaque format a ses propres champs ; le schéma de référence se trouve dans [packages/common/src/validators/quizz.ts](packages/common/src/validators/quizz.ts).

## Dépannage

| Problème                                                      | À vérifier                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connexion au manager refusée après installation               | Remplacer la valeur initiale `PASSWORD` dans `config/game.json`.                                                                                                    |
| Les téléphones ne trouvent pas l’application                  | Utiliser l’adresse réseau du serveur, vérifier le réseau et l’accès au port exposé.                                                                                 |
| « Le serveur ne répond pas » sur une nouvelle fonction        | Vérifier les journaux, le proxy `/ws` et la version du serveur. Après une modification du code, relancer le serveur si celui-ci ne tourne pas en mode surveillance. |
| Docker Compose ne trouve pas `nginx-proxy-network`            | Le fichier du dépôt attend un réseau externe. Utiliser l’exemple local ou préparer le réseau et son reverse proxy.                                                  |
| Les fonctions IA ou de recherche de médias sont indisponibles | Vérifier les clés correspondantes dans l’environnement du serveur.                                                                                                  |
| Les données disparaissent après recréation d’un conteneur     | Vérifier le montage persistant de `/app/config`.                                                                                                                    |

## Participer au projet

Pour signaler un problème, [ouvre une issue](https://github.com/gyrese/LTHhoot/issues) en indiquant les étapes de reproduction, la version ou le commit utilisé, le navigateur et les journaux utiles, sans mot de passe ni clé d’API.

Pour proposer une modification, crée une branche, limite la pull request à un sujet et exécute les vérifications de format, de lint, de traductions, de compilation et les tests concernés avant de la soumettre. La [CI](.github/workflows/ci.yml) décrit les contrôles automatisés.

## Licence et origine

LTNHoot est distribué sous [licence MIT](LICENSE). Initialement basé sur Rahoot, aujourd’hui [Razzia](https://github.com/Ralex91/Razzia), créé par Ralex91. Les mentions de copyright et de licence du projet d’origine sont conservées.
