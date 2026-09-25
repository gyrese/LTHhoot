# Audit technique, sécurité et ergonomie de l’éditeur de quiz

Date : 17 septembre 2026. Périmètre : état local du dépôt LTNHoot, éditeur React/Konva, validation commune, persistance et événements Socket.IO, médias HTTP, import/export, test de partie.

## Verdict

L’éditeur possède une base fonctionnelle riche, mais la priorité est la **fiabilité du travail enregistré**, suivie de la **sécurité des médias**. Plusieurs chemins donnent une impression de réussite alors que le contenu courant n’est pas celui enregistré, testé ou exporté.

24 constats sont détaillés : **12 P1 et 12 P2**. Aucun P0 déclaré : aucune exploitation distante non authentifiée ou perte de données en production n’a été démontrée pendant cet audit.

- **P1** : correction prioritaire avant exposition à des comptes non fiables ou usage intensif.
- **P2** : correction planifiée, avec impact réel mais dépendant du parcours ou de la volumétrie.
- **Preuve code** : chemin et conditions établis par lecture ; pas une exploitation réalisée contre le serveur.
- **Reproduit** : sondes exécutées localement sur les fonctions concernées.
- **À mesurer** : hypothèse de performance ou de confort issue de la structure, sans mesure navigateur.

L’audit est fondé sur le code et des tests locaux. Il ne constitue pas un pentest du déploiement ni une certification d’accessibilité. Aucun test visuel, lecteur d’écran ou réseau hostile n’a été exécuté. Les constats responsive concernent les contraintes CSS ; les contrastes et performances réels restent à mesurer. Aucune correction applicative n’a été effectuée. Les modifications préexistantes dans SoloQuizView.tsx et element-factory.ts ont été conservées.

## Vérifications effectuées

| Contrôle | Résultat |
|---|---|
| Suite serveur existante | 12 fichiers, **121 tests réussis** |
| TypeScript frontend | `node ../../node_modules/typescript/bin/tsc -b --noEmit` depuis packages/web : **réussi** |
| Sondes de diagnostic ajoutées | **8/8 réussies**, c’est-à-dire que les défauts attendus ont été reproduits |
| Lecture du flux de sauvegarde | création, mise à jour, accusés serveur, sauvegarde locale, conflit, historique |
| Sécurité | gardes admin/invités, upload, import URL, bibliothèque, quotas, sessions |
| Interface | structure, états, actions, clavier, panneaux, miniature, modales |
| Tests non effectués | E2E navigateur, exploitation HTTP, benchmark volumétrique, audit CVE exhaustif |

Les sondes sont dans [tasks/quiz-editor-audit.test.ts](../../tasks/quiz-editor-audit.test.ts). Commande depuis la racine :

```text
pnpm.cmd --filter @rahoot/socket test --root ../.. --config packages/socket/vitest.config.ts tasks/quiz-editor-audit.test.ts
```

Ces sondes documentent le comportement actuel ; elles ne doivent pas être interprétées comme des tests de conformité. Lors de la correction, les convertir en assertions du comportement attendu.

## Sécurité

### 01 — P1 — Upload : conservation de contenu non image sur la même origine

**Preuve code.** `packages/socket/src/index.ts:118`, `:188`, `:195`, `:131`.

Le filtre accepte le MIME déclaré par le client (`image/*`). Si Sharp refuse le contenu, le fallback copie le fichier original et conserve son extension. Le répertoire est servi par express.static. Un client authentifié, y compris invité, peut donc soumettre un contenu HTML sous un MIME image avec un nom finissant en `.html` : l’échec de conversion déclenche sa conservation et sa mise à disposition.

**Impact :** hébergement de contenu actif sur l’origine de l’application ; risque de XSS stockée lors de l’ouverture du lien. Le risque ne signifie pas qu’un simple affichage via `<img>` exécute le script. L’effet complet dépend des en-têtes du déploiement ; la configuration nginx fournie n’établit pas de CSP bloquant ce scénario. Un script de même origine pourrait accéder au `client_id` du navigateur, utilisé comme preuve de session.

**Correction :** supprimer ce fallback pour les formats non validés, vérifier le contenu réel, réencoder les images acceptées, générer un nom et une extension serveur. Servir les originaux éventuellement autorisés depuis une origine distincte, avec téléchargement forcé et politique restrictive. Ajouter un test local : contenu HTML déclaré image → rejet, aucun fichier publié.

### 02 — P1 — Import URL : protection SSRF contournable

**Preuve code.** `packages/socket/src/index.ts:307`, `:360`, `:367`.

Le contrôle porte sur le nom d’hôte initial. Il ne résout pas les adresses DNS et `redirect: "follow"` accepte les redirections sans revalidation. Un domaine peut donc résoudre vers une adresse privée, ou une URL publique rediriger vers le réseau interne. Certaines représentations IPv6 ne sont pas couvertes par les tests de préfixe.

**Impact :** requêtes effectuées par le serveur vers son propre réseau. Le contrôle de Content-Type intervient après la requête et ne bloque pas cet accès. Une extraction complète de réponse dépend du type renvoyé ; les requêtes aveugles restent un risque.

**Correction :** contrôler toutes les adresses A/AAAA, empêcher la résolution vers une destination non publique lors de la connexion, désactiver les redirections ou revalider chaque saut ; appliquer aussi une politique de sortie réseau. Ne pas tester contre des services internes réels : utiliser un serveur de test isolé.

### 03 — P1 — Un invité peut supprimer les médias partagés

**Preuve code.** `packages/socket/src/services/manager.ts:54` ; `packages/socket/src/index.ts:428`, `:474`, `:509`.

`requireManager` accepte toute session authentifiée. La liste retourne tous les médias et la suppression exécute `unlink` sans contrôle de propriétaire, de rôle ou de références. Le même garde protège la purge globale.

**Impact :** un invité peut lister les médias communs et supprimer une image utilisée par un quiz admin ou un autre invité. Même un admin peut casser accidentellement plusieurs quiz en supprimant une image encore utilisée. L’isolation correcte des JSON de quiz ne couvre donc pas les médias.

**Correction :** attacher un propriétaire aux médias, séparer lecture/utilisation/suppression, réserver la purge à l’admin, bloquer les suppressions référencées et proposer une corbeille. Afficher « utilisé dans X quiz » avant suppression.

### 04 — P1 — Coûts et ressources insuffisamment bornés

**Preuve code.** `packages/socket/src/index.ts:391`, `:117`, `:175` ; `packages/socket/src/handlers/quizz.ts` pour les événements IA.

L’import URL lit tout le corps en mémoire avant de vérifier le plafond de 25 Mo. Les uploads ont un plafond individuel, mais aucune file globale de traitement ou quota par compte n’est visible sur ces chemins. `sharp.concurrency(1)` ne limite pas le nombre de requêtes simultanées. Les événements IA acceptés pour les invités ne disposent pas ici de quota de coût ou de concurrence.

**Impact :** saturation mémoire/CPU/disque, dégradation des parties en cours, consommation de budget IA par un compte authentifié. L’existence d’une limite Socket.IO de 5 Mo ne protège pas ces chemins HTTP/IA.

**Correction :** couper la lecture du flux dès dépassement, borner dimensions et animations, ajouter queue et concurrence globale, limites par compte et budget IA. Retourner une erreur exploitable et une durée de réessai. Mesurer avec données synthétiques en environnement isolé.

### 22 — P2 — Le client_id est aussi un secret de session durable

**Preuve code.** `packages/socket/src/services/manager.ts:6`, `:36`, `:54`, `:120`, `:138` ; `packages/web/src/features/quizz/utils/upload.ts:39`.

Le serveur associe les droits à un identifiant choisi côté client, conservé dans localStorage et transmis par socket/header HTTP. La Map de sessions n’a pas de date d’expiration dans cette classe. La déconnexion explicite supprime l’entrée ; la rotation d’un jeton après authentification n’apparaît pas ici.

**Impact :** une fuite de cet identifiant permet sa réutilisation tant que la session existe. Cela n’est pas une preuve qu’on puisse deviner l’identifiant ou s’authentifier avec une valeur aléatoire. Le problème devient particulièrement important avec le constat 01.

**Correction :** séparer identité d’appareil et secret de session, émettre un jeton serveur après login, durée de vie limitée, rotation/révocation, suppression des droits aux changements de compte ; préférer une session inaccessible au JavaScript lorsque l’architecture le permet.

Les recommandations upload/SSRF sont cohérentes avec les guides officiels [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) et [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Fiabilité et intégrité des quiz

### 05 — P1 — Une sauvegarde ancienne peut déclarer le contenu courant enregistré

**Preuve code.** `packages/web/src/features/quizz/contexts/quizz-editor-context.tsx:765`, `:866`, `:880`.

Les handlers de réussite mettent `isDirty=false` et suppriment le backup sans comparer la version locale actuelle à celle envoyée. L’UPDATE_SUCCESS ne contrôle même pas l’id du quiz reçu. Il n’y a pas de requestId ou de révision locale attachée au traitement.

**Scénario :** envoyer la version A, saisir B avant la réponse, recevoir l’accusé de A. B reste affiché, mais l’éditeur annonce un état enregistré et peut naviguer hors de la page si la sauvegarde demandait une sortie. Le serveur ne possède que A.

**Correction :** compteur de révision locale, requête identifiée, une sauvegarde en vol par document ; confirmer uniquement la révision envoyée. Si une nouvelle révision existe, garder dirty et programmer le prochain envoi. Ne supprimer que le backup confirmé. Test avec accusé volontairement retardé.

### 06 — P1 — Brouillons non protégés et sauvegarde différable indéfiniment

**Preuve code.** Même contexte `:287`, `:991`, `:1038` ; header pour la confirmation de sortie. Aucune utilisation de `beforeunload` ou `useBlocker` trouvée dans les fichiers TS/TSX du frontend.

Le backup local exige déjà un quizzId : un nouveau quiz incomplet n’est pas protégé avant sa première sauvegarde serveur. Le timer local redémarre à chaque modification. L’intervalle serveur dépend de `saveQuizz`, qui change à chaque saisie : des modifications continues à moins de dix secondes d’intervalle repoussent son exécution. Les états invalides sont ignorés silencieusement par l’autosave.

Au montage, tous les backups contenant `data:image/` sont supprimés sans proposer une restauration/export préalable. Une sauvegarde locale volumineuse qui échoue ne produit qu’un warning console.

**Impact :** fermeture, rafraîchissement ou retour navigateur peuvent perdre un brouillon, malgré l’existence d’un mécanisme de sauvegarde automatique. La confirmation du logo ne protège pas tous les moyens de quitter.

**Correction :** identifiant de brouillon créé immédiatement, stockage local versionné (IndexedDB), debounce avec délai maximal garanti, flush au changement de visibilité, garde de navigation, état « sauvegarde locale indisponible ». Migrer les anciens backups au lieu de les supprimer silencieusement.

### 07 — P1 — Sauvegarde manuelle et automatique appliquent des règles différentes

**Reproduit.** `packages/web/src/features/quizz/utils/validation.ts:28`, `:89` ; contexte `:781` ; validateur commun `:160`, `:204`.

- Puzzle à deux éléments : accepté par Zod/serveur et proposé par l’éditeur, refusé en sauvegarde manuelle qui exige « exactement 4 » ; ce contrôle accepte cependant cinq éléments.
- Slide de titre sans texte de question : acceptée par Zod et cohérente avec un titre composé dans le canvas, refusée par le contrôle manuel commun à toutes les questions. Le champ de question est caché pour ce type dans QuestionEditor.
- Grille avec images absentes : rejetée manuellement, acceptée par le schéma utilisé par l’autosave.

**Impact :** un même document peut être déclaré invalide au clic Enregistrer mais avoir déjà été enregistré automatiquement. Une présentation visuelle peut empêcher d’enregistrer manuellement l’ensemble du quiz.

**Correction :** un contrat partagé, avec deux niveaux explicites : brouillon enregistrable et quiz jouable. Les messages doivent provenir des mêmes règles et pointer vers les champs concernés.

### 08 — P1 — Validation structurelle sans invariants métier suffisants

**Reproduit.** `packages/common/src/validators/quizz.ts:112`, `:144`, `:152`, `:186`, `:197`.

Le serveur accepte : solution QCM index 99 avec deux réponses, index correct hors grille, bornes slider inversées, réponse numérique/date hors intervalle, drop_pin sans aucune zone correcte. Les chaînes composées d’espaces passent aussi les `.min(1)` non trimées.

**Impact :** quiz sauvegardé mais impossible ou incohérent pour les joueurs. Ce sont des défauts de validation et d’intégrité ; pas des preuves d’exécution de code arbitraire.

**Correction :** affinements métier par type : indices dans le tableau et dédupliqués, bornes ordonnées, réponse dans l’intervalle, zone correcte exploitable, chaînes trimées. Ajouter des limites de longueur/quantité aux questions, éléments et textes pour protéger le navigateur.

### 09 — P1 — Cliquer sur le type déjà sélectionné réinitialise les réponses

**Preuve code.** `QuestionEditorTypeSelector.tsx:45` ; contexte `:736`, `:149`.

Le bouton du type actif appelle le même changement que les autres. `changeQuestionType` reconstruit la question sans garde `q.type === type`. Cliquer « QCM » sur un QCM rempli réinitialise donc réponses et solutions. Changer de type perd également des propriétés communes non reprises dans base : pointsMultiplier, suddenDeath, paramètres de révélation et difficulty.

**Correction :** no-op sur le type actif, conversion explicite entre types, conservation complète des champs communs et avertissement lorsque du contenu va disparaître. Créer une étape d’historique immédiate pour l’opération, sans la fusionner avec une autre saisie.

### 10 — P1 — « Tester » lance la version enregistrée, pas celle affichée

**Preuve code.** `packages/web/src/features/quizz/hooks/useTestDrive.ts:36`.

Le hook transmet quizId et questionIndex sans attendre de sauvegarde ni transmettre le snapshot courant. Le bouton reste disponible lorsque isDirty est vrai. Après un réordonnancement local, le même index peut même désigner une autre question dans le fichier serveur.

**Impact :** résultat trompeur au moment où l’utilisateur vérifie sa création, et navigation hors de l’éditeur avec modifications non enregistrées.

**Correction :** soit lancer un snapshot isolé du brouillon, soit sauvegarder/valider la révision exacte puis démarrer le test. Prévoir un retour à la même question et restaurer la sélection.

### 11 — P2 — Le contrôle de concurrence ignore certains changements

**Preuve code.** `packages/socket/src/services/config.ts:284`, `:311`, `:336`.

`moveToFolder` et `setPublicInfo` modifient le fichier sans incrémenter updatedAt. Une session d’éditeur ouverte avant cette modification peut enregistrer son ancien dossier/nom public/description sans conflit et annuler la modification externe.

**Correction :** révision monotone de document sur chaque mutation, ou versions séparées par domaine avec merge explicite. Ne pas prendre Date.now comme garantie d’unicité absolue. L’option de forçage doit être explicite, tracée et distincte d’un oubli de révision.

### 12 — P1 — L’export n’est pas une sauvegarde portable complète

**Reproduit pour les médias ; preuve code pour les métadonnées.** `packages/web/src/features/quizz/utils/export.ts:29` ; `QuizzEditorHeader.tsx:114`.

Les images de `image_sequence.images`, `grid.cells[].image` et `answerReveal.image` ne sont pas embarquées. Le payload du header omet publicName et podiumTheme. Enfin, toBase64 ne vérifie pas response.ok : une réponse HTTP d’erreur peut devenir une donnée embarquée ; en erreur réseau, l’URL originale est conservée sans bilan d’export incomplet.

**Impact :** export annoncé réussi mais quiz dégradé sur une autre installation ou après disparition des médias source.

**Correction :** sérialiseur unique et typé pour tous les champs, parcours exhaustif des références médias, déduplication, vérification HTTP, rapport des fichiers manquants ; test aller-retour export/import pour chaque type.

### 13 — P2 — Requêtes longues sans protocole de terminaison fiable

**Preuve code.** Contexte `:836` ; `QuizzEditorHeader.tsx:314` ; `useTestDrive.ts:21` ; événements IA frontend.

Le bouton de sauvegarde n’est pas désactivé par isSaving, et saveQuizz ne bloque pas un deuxième envoi. Aucun délai d’expiration de l’accusé n’apparaît. Le test de partie attend GAME_CREATED sans gérer ici les erreurs ou une absence de réponse. Les requêtes IA ont leurs propres états mais pas un protocole commun d’identification/expiration.

**Impact :** création en double possible avant réception du nouvel id, états de chargement persistants, réponses concurrentes difficiles à attribuer. Une déconnexion est partiellement gérée pour la sauvegarde, mais pas tous les échecs.

**Correction :** requestId, timeout, réponse structurée, annulation et idempotence des créations ; file d’envoi pour les mises à jour. Désactiver le double clic ne suffit pas à lui seul.

### 14 — P2 — L’historique mélange navigation et contenu

**Preuve code.** Contexte `:394`, `:480`, `:516`.

currentIndex et selectedQuestionIds déclenchent des snapshots au même titre que la saisie. applySnapshot marque toujours le quiz modifié. Avec 50 entrées et un debounce de 400 ms, une navigation soutenue peut consommer l’historique et « Annuler » peut d’abord revenir à une sélection sans annuler la dernière modification de contenu.

**Correction :** distinguer historique documentaire et état de navigation ; enregistrer des opérations éditoriales cohérentes, regrouper la frappe, conserver la sélection comme métadonnée de restauration.

### 21 — P2 — Une reformulation IA peut écraser une saisie plus récente

**Preuve code.** `QuestionEditorTitle.tsx:30`, `:40`.

La réponse IA est correctement attachée à l’index/id de départ, ce qui protège contre certains changements de slide. Mais aucune comparaison du texte ou de sa version n’est faite : l’utilisateur peut continuer à écrire dans la même question, puis recevoir une reformulation basée sur l’ancien texte qui remplace sa saisie.

**Correction :** capturer la version du champ ; si elle a changé, afficher la suggestion à accepter au lieu de l’appliquer. Résoudre la question par id stable plutôt que d’abandonner silencieusement après réordonnancement.

### 23 — P2 — Les limites de saisie et de transfert ne sont pas cohérentes

**Preuve code.** `QuestionEditorConfig/panels/SettingsPanel.tsx:72`, `:99` ; validateur commun `:98` ; `docker/nginx.conf:12` ; `packages/socket/src/index.ts:117`.

Les champs de minutage ne passent pas les maxima du schéma. Le serveur autorise un cooldown de 15 secondes pour une question, 120 pour un titre, et un time de 600 ; le contrôle d’interface ne reflète pas explicitement ces plafonds. Pour les images, nginx limite le corps à 25 Mo et Multer le fichier à 50 Mo.

**Impact :** valeurs éditables refusées plus tard ; comportement upload différent entre accès direct et Docker, parfois erreur HTML 413 difficile à expliquer à l’utilisateur.

**Correction :** constantes partagées, contraintes visibles près des champs et erreurs inline ; une limite de fichier uniforme avec marge pour le multipart côté proxy, message HTTP normalisé.

## Ergonomie, accessibilité et performance

### 15 — P2 — Mise en page rigide sur petit écran

**Preuve code ; essai visuel restant.** `QuizzEditorSidebar.tsx:112` ; `QuestionEditorConfig/index.tsx:53` ; `InspectorRail.tsx:44` ; `QuizzSettingsModal.tsx:229`.

L’éditeur réserve environ 572 px aux panneaux latéraux seuls : 288 + 240 + 44, avec shrink-0 et sans repli responsive. Le parent masque le débordement. À 768 px, il reste moins de 200 px avant les espacements du canvas ; à 390 px, les panneaux dépassent déjà la largeur disponible. Les réglages ajoutent une sidebar de 208 px et une colonne médias de 288 px.

**Correction :** panneau droit repliable et liste de slides escamotable sur ordinateur compact ; drawers exclusifs sur tablette ; parcours mobile spécifique ou restriction clairement annoncée. Vérifier 390, 768, 1024, 1366 px, zoom navigateur 200 % et clavier virtuel. Si le téléphone fait partie des usages promis, ce point devient P1.

### 16 — P1 — Modales de restauration/conflit sans gestion accessible du focus

**Preuve code.** Contexte `:1217`, `:1253` ; `QuizzSettingsModal.tsx:200`.

Les dialogues de récupération et de conflit sont des div superposées : pas de rôle dialog, aria-modal, nom accessible relié, focus initial/contenu, restitution de focus ou neutralisation de l’arrière-plan. Les réglages utilisent également une surcouche personnalisée. AIGeneratorModal possède déjà une partie de la sémantique, mais ce n’est pas mutualisé.

**Impact :** parcours incertain au clavier et au lecteur d’écran précisément lors d’une décision risquant de perdre du travail. Le fond peut rester atteignable.

**Correction :** composant de dialogue commun, idéalement basé sur une primitive accessible ; tester ouverture, tabulation, fermeture, retour de focus, annonce de titre et description. Pour un conflit, privilégier une action sûre et proposer l’export local avant écrasement/rechargement.

### 17 — P2 — Actions sans nom accessible et petites cibles

**Preuve code.** `QuizzEditorHeader.tsx:265`, `:301` ; `QuestionEditorPuzzle.tsx:43` ; `LayersPanel.tsx:114`.

Plusieurs actions du header ne gardent qu’une icône sous md, leurs libellés étant display:none, sans aria-label de remplacement. Les boutons ajout/suppression du puzzle n’ont pas de nom accessible. Les lignes de calques cliquables sont des div sans interaction clavier équivalente pour la sélection. Plusieurs cibles font 24–32 px.

**Impact :** compréhension et action difficiles au lecteur d’écran et au tactile. Une cible inférieure à 44 px est un risque ergonomique ; ce seuil seul ne prouve pas une violation WCAG AA.

**Correction :** nom accessible permanent, vrais boutons de sélection, focus visible, état sélectionné annoncé, zones tactiles plus grandes. Tester les commandes sans souris et avec lecteur d’écran.

### 18 — P2 — L’état de sauvegarde n’explique pas assez ce qui se passe

**Preuve code.** `QuizzEditorHeader.tsx:201`, `:318` ; contexte `:890`.

L’indicateur est absent tant que lastSaved est null ; son texte reste masqué sous 2xl après une sauvegarde. Le clic « Enregistrer » quitte l’éditeur, comportement non annoncé par le libellé. Même une sauvegarde silencieuse affiche ensuite un toast de réussite. Il manque des états visibles distincts : hors connexion, brouillon invalide, sauvegarde locale seulement, erreur de synchronisation.

**Correction :** statut textuel persistant, Enregistrer séparé de Enregistrer et quitter, autosave discret, erreurs durables avec action Réessayer. Afficher la première erreur inline et proposer « Aller à la question concernée », plutôt qu’un toast seul.

### 19 — P2 — Raccourcis globaux insuffisamment contextualisés

**Preuve code.** Contexte `:1062`.

Le handler clavier exclut input/textarea/contenteditable, mais ne suspend pas les commandes quand une modale/menu est ouverte ou quand un contrôle autre qu’un champ texte a le focus. Les flèches peuvent alors modifier la sélection de slide sous une surcouche. Le raccourci global et les interactions propres au canvas constituent deux systèmes à coordonner.

**Correction :** gestionnaire de commandes avec contextes explicites document/canvas/dialogue, respect de defaultPrevented, vérification du focus, suspension pendant les dialogues ; aide aux raccourcis et contrôle cohérent sur macOS/Windows.

### 20 — P2 — La structure multiplie le coût des miniatures

**Preuve structurelle ; coût réel à mesurer.** Contexte `:1166` ; `QuizzEditorSidebar.tsx:136` ; `QuizzEditorCard.tsx:117` ; `SlideEditor/PreviewPresenterView.tsx:45`, `:180`.

Un contexte unique transmet tout le document et son UI à chaque changement. La sidebar rend toutes les questions ; chaque carte contient un aperçu riche, pouvant inclure un canvas Konva et une séquence d’images. Les aperçus consomment eux-mêmes le contexte. Aucun fenêtrage de liste n’est visible.

**Impact attendu :** coût croissant pendant la frappe, le déplacement et le chargement de gros quiz. Aucune latence chiffrée n’a été mesurée ; il serait abusif d’annoncer un gain sans profilage.

**Correction :** mesurer 10/50/200 questions ; séparer document, sélection et synchronisation ; abonnements ciblés, miniatures statiques invalidées par question, virtualisation au-delà d’un seuil mesuré, pause des animations hors écran. Ne pas réduire toutes les fonctionnalités pour optimiser un cas non mesuré.

### 24 — P2 — Traductions et messages métier dispersés

**Preuve code.** `utils/validation.ts` ; `QuestionEditorConfig/index.tsx:12` ; dialogues du contexte ; header IA et MediaSearchModal.

L’application dispose de plusieurs locales, mais des labels, erreurs, actions et messages importants sont codés directement en français. Les erreurs de schéma peuvent exposer un chemin technique tel que questions.0.answers.1, alors que d’autres erreurs utilisent un numéro humain.

**Correction :** codes d’erreur stables avec paramètres, traduction au rendu, index humains, pluralisation ; mêmes termes pour quiz/question/diapositive, et description claire des actions destructives.

## Ce qui fonctionne déjà bien

- **Isolation des bibliothèques de quiz** : scope obtenu à partir de la session serveur, dossiers physiques distincts, restrictions d’écriture admin sur les quiz invités. Les tests existants couvrent cette séparation.
- **Validation à l’entrée de save/update**, malgré les invariants manquants : le backend ne se repose pas uniquement sur l’interface.
- **Écritures atomiques** et invalidation du cache après modification : bonnes bases à conserver.
- **Gestion de conflit existante** : un mécanisme utile, à compléter plutôt qu’à supprimer.
- **Authentification avant Multer** : les uploads non authentifiés sont refusés avant écriture.
- **Rate limit du login** par appareil et IP : protection présente, distincte des quotas manquants sur les opérations coûteuses.
- **Historique borné, récupération locale et sélection multiple** : les fonctions essentielles existent, leurs contrats doivent être fiabilisés.
- **Tokens sémantiques CSS**, anneaux de focus et réduction de mouvement dans plusieurs composants : aucune nécessité démontrée de refonte graphique générale.
- **Réutilisation du rendu de jeu dans l’aperçu** : favorable à la fidélité, à adapter pour les miniatures.
- **Réponses IA attachées à un id de question** dans plusieurs composants : protection déjà présente contre le mauvais slide, à compléter avec la version du champ.

## Architecture cible recommandée

La refonte complète n’est pas nécessaire. Extraire progressivement quatre responsabilités actuellement mélangées :

1. **Document** : quiz typé, ids persistants de question, commandes d’édition, historique des modifications.
2. **Validation** : fonctions communes pour brouillon et jouabilité, erreurs structurées et exhaustives par type.
3. **Synchronisation** : révision locale/serveur, backup, file de sauvegarde, idempotence, conflits et état de connexion.
4. **Interface** : sélection, panneaux, zoom, dialogues, raccourcis et état d’interaction sans modifier la révision documentaire.

Une mutation de contenu devrait suivre ce contrat : commande → nouvelle révision locale → backup → envoi de la révision → accusé identifié → confirmation de cette révision seulement. Le test de partie et l’export doivent consommer un snapshot explicite du même document.

## Améliorations de parcours

- À la création, choisir le type ou partir d’un modèle compréhensible ; le brouillon est protégé dès la première saisie.
- Séparer **contenu/réponses**, **comportement de jeu**, **apparence** ; conserver les réglages avancés repliés, avec résumé des valeurs actives.
- Un clic sur une erreur ouvre la bonne question, le bon panneau et le bon champ ; proposer une liste de vérification avant lancement.
- Toujours différencier sauvegarde locale, synchronisation serveur et document jouable.
- Le test ouvre exactement la révision courante et permet de revenir au même endroit.
- Les conflits proposent comparaison ou copie de secours ; ne pas limiter le choix à perdre ses modifications ou écraser celles d’un autre.
- Les médias indiquent propriétaire, usages et poids ; supprimer dans une corbeille au lieu d’un unlink immédiat.
- L’import CSV propose un bilan persistant avec lignes rejetées ; l’export indique explicitement si certains médias ne sont pas embarqués.

## Ordre de correction proposé

| Lot | Résultat attendu | Constats | Critère d’acceptation |
|---|---|---|---|
| 1 — Médias | Fermer les chemins de contenu actif, accès inter-comptes et requêtes internes | 01–04, 22 | fichier non image rejeté ; invité incapable de supprimer le média d’autrui ; redirection/DNS privée refusés ; flux surdimensionné coupé avant allocation complète |
| 2 — Sauvegarde | Protéger chaque révision et chaque brouillon | 05–06, 11, 13 | saisie pendant ACK conservée dirty ; nouveau brouillon récupérable ; pas de création doublonnée ; modification externe détectée |
| 3 — Cohérence | Même document valide, testé et exporté | 07–10, 12, 21, 23 | règles partagées ; type actif sans effet ; test du snapshot courant ; aller-retour export complet |
| 4 — Parcours | Clavier, erreurs et petits écrans utilisables | 14–19, 24 | dialogues accessibles ; actions nommées ; Enregistrer reste dans l’éditeur ; panneaux repliables ; historique indépendant de la navigation |
| 5 — Volume | Fluidité vérifiée sur gros quiz | 20 | mesures avant/après à 10/50/200 questions et absence de régression de rendu |

Pour la partie interface, une fois le contexte produit confirmé : `$impeccable harden` pour erreurs/états, `$impeccable adapt` pour panneaux et écrans, `$impeccable clarify` pour libellés, `$impeccable optimize` après profilage, puis `$impeccable polish`. Les correctifs sécurité et synchronisation demandent leur propre implémentation et leurs tests métier.

## Couverture de tests à ajouter lors des correctifs

Les tests existants réussissent mais aucun test dédié du provider de l’éditeur n’a été identifié. Couvrir en priorité :

1. Frappe pendant sauvegarde, ACK retardé/dupliqué/hors ordre, déconnexion pendant l’envoi, expiration.
2. Brouillon sans id serveur, fermeture/reprise, quota local saturé, ancien backup, conflit avec édition externe.
3. Chaque type : brouillon incomplet, version jouable, bornes, solutions inexistantes, conversion de type, no-op du type actif.
4. Tester pendant isDirty, après réordonnancement et pendant un upload.
5. Export/import de chaque média et métadonnée ; HTTP 404, CORS, média manquant, export partiel annoncé.
6. Matrice admin/invité/anonyme sur les endpoints médias ; suppression d’un fichier référencé.
7. Upload MIME falsifié ; import URL avec DNS privé, redirection privée, réponse trop volumineuse.
8. Clavier seul, lecteur d’écran, focus modal, zoom 200 %, ordinateur compact/tablette et mobile si supporté.

Ne pas considérer le contrôle TypeScript ou les 121 tests serveur réussis comme une preuve de couverture de ces scénarios.
