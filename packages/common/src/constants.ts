export const EVENTS = {
  GAME: {
    STATUS: "game:status",
    SUCCESS_ROOM: "game:successRoom",
    SUCCESS_JOIN: "game:successJoin",
    TOTAL_PLAYERS: "game:totalPlayers",
    ERROR_MESSAGE: "game:errorMessage",
    START_COOLDOWN: "game:startCooldown",
    COOLDOWN: "game:cooldown",
    RESET: "game:reset",
    UPDATE_QUESTION: "game:updateQuestion",
    PLAYER_ANSWER: "game:playerAnswer",
    CREATE: "game:create",
    NEW_PLAYER: "game:newPlayer",
    REMOVE_PLAYER: "game:removePlayer",
  },
  PLAYER: {
    SUCCESS_RECONNECT: "player:successReconnect",
    UPDATE_LEADERBOARD: "player:updateLeaderboard",
    JOIN: "player:join",
    LOGIN: "player:login",
    RECONNECT: "player:reconnect",
    SELECTED_ANSWER: "player:selectedAnswer",
    JOIN_TEAM: "player:joinTeam",
    BUY_POWER_UP: "player:buyPowerUp",
    TIE_BREAK_ANSWER: "player:tieBreakAnswer",
  },
  MANAGER: {
    SUCCESS_RECONNECT: "manager:successReconnect",
    LOG_ENTRY: "manager:logEntry",
    GET_LOGS: "manager:getLogs",
    CONFIG: "manager:config",
    GAME_CREATED: "manager:gameCreated",
    STATUS_UPDATE: "manager:statusUpdate",
    NEW_PLAYER: "manager:newPlayer",
    REMOVE_PLAYER: "manager:removePlayer",
    ERROR_MESSAGE: "manager:errorMessage",
    PLAYER_KICKED: "manager:playerKicked",
    AUTH: "manager:auth",
    RECONNECT: "manager:reconnect",
    KICK_PLAYER: "manager:kickPlayer",
    START_GAME: "manager:startGame",
    ABORT_QUIZ: "manager:abortQuiz",
    NEXT_QUESTION: "manager:nextQuestion",
    SHOW_LEADERBOARD: "manager:showLeaderboard",
    GET_CONFIG: "manager:getConfig",
    LOGOUT: "manager:logout",
    UNAUTHORIZED: "manager:unauthorized",
    VALIDATE_OPEN_ANSWER: "manager:validateOpenAnswer",
    INVALIDATE_OPEN_ANSWER: "manager:invalidateOpenAnswer",
    FINALIZE_OPEN_ANSWERS: "manager:finalizeOpenAnswers",
    START_DEMO: "manager:startDemo",
    END_GAME: "manager:endGame",
    PAUSE_GAME: "manager:pauseGame",
    RESUME_GAME: "manager:resumeGame",
    GUEST_AUTH: "manager:guestAuth",
    GUEST_CREATE: "manager:guestCreate",
    GUEST_DELETE: "manager:guestDelete",
  },
  QUIZZ: {
    GET: "quizz:get",
    DATA: "quizz:data",
    SAVE: "quizz:save",
    SAVE_SUCCESS: "quizz:saveSuccess",
    UPDATE: "quizz:update",
    UPDATE_SUCCESS: "quizz:updateSuccess",
    DELETE: "quizz:delete",
    MOVE_FOLDER: "quizz:moveFolder",
    ERROR: "quizz:error",
    AI_GENERATE: "quizz:aiGenerate",
    AI_GENERATE_SUCCESS: "quizz:aiGenerateSuccess",
    AI_REPHRASE: "quizz:aiRephrase",
    AI_REPHRASE_SUCCESS: "quizz:aiRephraseSuccess",
    AI_SUGGEST_WRONG_ANSWERS: "quizz:aiSuggestWrongAnswers",
    AI_SUGGEST_WRONG_ANSWERS_SUCCESS: "quizz:aiSuggestWrongAnswersSuccess",
    // Canal d'erreur DÉDIÉ aux actions IA : QUIZZ.ERROR est partagé avec la
    // sauvegarde (6 listeners côté éditeur) → une erreur IA déclenchait aussi
    // le toast/reset de sauvegarde, et inversement.
    AI_ERROR: "quizz:aiError",
  },
  RESULTS: {
    GET: "results:get",
    DATA: "results:data",
    DELETE: "results:delete",
  },
  EVENING: {
    START: "evening:start",
    QUIZ_COMPLETE: "evening:quizComplete",
    COMPLETE: "evening:complete",
    NEXT: "evening:next",
  },
  POWER_UP: {
    EARNED: "powerup:earned",
    USE: "powerup:use",
    EFFECT: "powerup:effect",
    BLOCKED: "powerup:blocked",
    GET_INVENTORY: "powerup:get_inventory",
    INVENTORY: "powerup:inventory",
    COINS: "powerup:coins",
  },
  CONNECTION: {
    // Sonde de vivacité applicative : après un retour d'arrière-plan mobile, le
    // client peut se croire connecté alors que le lien est mort (détection
    // Engine.IO en dizaines de secondes). Un ping/ack prouve que le lien vit.
    PING: "connection:ping",
  },
} as const

export const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
} as const

// Univers visuels du podium de fin de partie (maquettes .stitch, + 2 univers
// dessinés en CSS/SVG) — pool du tirage au sort quand le quiz est réglé sur
// "random".
export const PODIUM_THEMES = [
  "espace",
  "jurassic",
  "manga",
  "science",
  "heros",
  "disney",
  "harrypotter",
] as const

// Thème par défaut (réglage absent) : podium sobre qui reprend l'image de
// couverture du quiz en fond.
export const PODIUM_THEME_NEUTRAL = "neutre" as const

export const EXAMPLE_QUIZZ = {
  subject: "Example Quizz",
  questions: [
    {
      type: "mcq" as const,
      question: "What is good answer ?",
      answers: ["No", "Good answer", "No", "No"],
      solutions: [1],
      cooldown: 5,
      time: 15,
    },
    {
      type: "mcq" as const,
      question: "What is good answer with image ?",
      answers: ["No", "No", "No", "Good answer"],
      media: {
        type: MEDIA_TYPES.IMAGE,
        url: "https://placehold.co/600x400.png",
      },
      solutions: [3],
      cooldown: 5,
      time: 20,
    },
    {
      type: "mcq" as const,
      question: "What is good answer with two answers ?",
      answers: ["Good answer", "No"],
      media: {
        type: MEDIA_TYPES.IMAGE,
        url: "https://placehold.co/600x400.png",
      },
      solutions: [0],
      cooldown: 5,
      time: 20,
    },
    {
      type: "mcq" as const,
      question: "Which of these are primary colors ?",
      answers: ["Red", "Green", "Blue", "Yellow"],
      solutions: [0, 2, 3],
      cooldown: 5,
      time: 20,
    },
  ],
} as const
