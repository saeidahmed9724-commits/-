export type GameMode = 'PASS_AND_PLAY' | 'VS_BOT' | 'ROOM_CODE';

export type GamePhase =
  | 'HOME'
  | 'CREATE_GAME'
  | 'JOIN_GAME'
  | 'ROOM_LOBBY'
  | 'CHOOSE_PICTURE_P1'
  | 'CHOOSE_PICTURE_P2'
  | 'PICTURES_LOCKED_COUNTDOWN'
  | 'PLAYING'
  | 'ROUND_REVEAL'
  | 'GAME_OVER';

export type AnswerType = 'YES' | 'NO' | 'SOMETIMES' | 'NOT_SURE';

export interface CategoryPresetItem {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  imageUrl: string;
  hint?: string;
}

export interface CategoryDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  descriptionAr: string;
  descriptionEn: string;
  presetItems: CategoryPresetItem[];
  suggestedQuestionsAr: string[];
  suggestedQuestionsEn: string[];
}

export interface PlayerChoice {
  imageUrl: string;
  title: string;
  category: string;
  chosenByPlayerId: string; // The player who selected this image FOR the opponent
  heldByPlayerId: string;   // The player who holds this image (needs to guess it)
}

export interface QuestionRecord {
  id: string;
  question: string;
  isVoice?: boolean;
  isVoiceAnswer?: boolean;
  audioData?: string;
  askedByPlayerId: string;
  answeredByPlayerId: string;
  answer: AnswerType;
  note?: string;
  timestamp: number;
}

export interface PendingGuess {
  guesserId: string;
  guesserName: string;
  guessText: string;
  targetCardTitle: string;
  targetCardImageUrl: string;
}

export interface PendingQuestionData {
  id: string;
  question: string;
  isVoice?: boolean;
  audioData?: string;
  askedByRole: 'host' | 'guest';
  answeredByRole: 'host' | 'guest';
}

export interface Player {
  id: string;
  name: string;
  score: number;
  avatarColor: string;
  isReady?: boolean;
}

export interface RoomState {
  roomCode: string;
  hostName: string;
  guestName: string;
  category: CategoryDefinition;
  targetScore: number;
  isGuestJoined: boolean;
}
