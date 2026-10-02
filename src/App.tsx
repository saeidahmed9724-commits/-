/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  GameMode,
  GamePhase,
  CategoryDefinition,
  Player,
  PlayerChoice,
  QuestionRecord,
  AnswerType,
  PendingQuestionData,
  PlayerCount,
  MultiplayerPlayer,
  MultiplayerSecretImage,
} from './types/game';
import { CATEGORIES } from './data/categories';
import { sound } from './utils/audio';
import { onlineService, OnlineRoomData } from './services/onlineGame';
import { liveVoiceManager } from './utils/webrtcAudio';

import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { CreateGameScreen } from './components/CreateGameScreen';
import { RoomLobbyScreen } from './components/RoomLobbyScreen';
import { JoinRoomModal } from './components/JoinRoomModal';
import { JoinGameScreen } from './components/JoinGameScreen';
import { ChoosePictureScreen } from './components/ChoosePictureScreen';
import { PassAndPlayTransition } from './components/PassAndPlayTransition';
import { PicturesLockedCountdown } from './components/PicturesLockedCountdown';
import { BattleArena } from './components/BattleArena';
import { RevealScreen } from './components/RevealScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { RulesModal } from './components/RulesModal';
import { PlayerCountModal, SelectedGameSetupMode } from './components/PlayerCountModal';
import { MultiplayerSetupScreen } from './components/MultiplayerSetupScreen';
import { MultiplayerChoosePictureScreen } from './components/MultiplayerChoosePictureScreen';
import { MultiplayerArena } from './components/MultiplayerArena';

export default function App() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [initialJoinCode, setInitialJoinCode] = useState<string>('');

  // Core Game State
  const [gamePhase, setGamePhase] = useState<GamePhase>('HOME');
  const [gameMode, setGameMode] = useState<GameMode>('PASS_AND_PLAY');
  const [roomCode, setRoomCode] = useState<string>('A7K92');
  const [currentCategory, setCurrentCategory] = useState<CategoryDefinition>(CATEGORIES[0]);
  const [targetScore, setTargetScore] = useState<number>(3);
  const [roundNumber, setRoundNumber] = useState<number>(1);

  // Player Count & Multiplayer Mode (3–4 Players)
  const [isPlayerCountModalOpen, setIsPlayerCountModalOpen] = useState<boolean>(false);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [pendingPlayerCountAction, setPendingPlayerCountAction] = useState<'OFFLINE' | 'ONLINE'>('OFFLINE');
  const [multiplayerNames, setMultiplayerNames] = useState<string[]>([]);
  const [multiplayerPlayers, setMultiplayerPlayers] = useState<MultiplayerPlayer[]>([]);

  // Online Specific State
  const [onlineRole, setOnlineRole] = useState<'host' | 'guest'>('host');
  const [onlineRoomData, setOnlineRoomData] = useState<OnlineRoomData | null>(null);
  const [isWaitingForRemoteOpponent, setIsWaitingForRemoteOpponent] = useState<boolean>(false);
  const [pendingQuestionRemote, setPendingQuestionRemote] = useState<PendingQuestionData | null>(null);
  const [pendingGuessRemote, setPendingGuessRemote] = useState<{
    guesserRole: 'host' | 'guest';
    guesserName: string;
    guessText: string;
  } | null>(null);

  // Players (Dynamic - populated upon entering/creating game)
  const [player1, setPlayer1] = useState<Player>({
    id: 'p1',
    name: '',
    score: 0,
    avatarColor: 'from-emerald-500 to-emerald-700',
  });
  const [player2, setPlayer2] = useState<Player>({
    id: 'p2',
    name: '',
    score: 0,
    avatarColor: 'from-sky-500 to-sky-700',
  });

  // Cards
  const [p1Card, setP1Card] = useState<PlayerChoice | null>(null); // held by P1 (chosen by P2)
  const [p2Card, setP2Card] = useState<PlayerChoice | null>(null); // held by P2 (chosen by P1)

  // Arena Turn & History
  const [activePlayerId, setActivePlayerId] = useState<string>('p1');
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);

  // Reveal Data
  const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);
  const [correctGuessWord, setCorrectGuessWord] = useState<string>('');

  // Pass and play privacy interstitial
  const [showHandoffToP2, setShowHandoffToP2] = useState<boolean>(false);

  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Check URL query for ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      setInitialJoinCode(urlRoom.toUpperCase());
      setGamePhase('JOIN_GAME');
    }
  }, []);

  // Subscribe to Online WebSocket events
  useEffect(() => {
    const unsubscribe = onlineService.subscribe((event) => {
      if (event.type === 'ROOM_UPDATE' && event.room) {
        const room = event.room;
        setOnlineRoomData(room);
        setCurrentCategory(room.category);
        setTargetScore(room.targetScore);
        setRoundNumber(room.roundNumber);

        // Update player names & scores
        if (room.host) {
          setPlayer1({
            id: 'p1',
            name: room.host.name,
            score: room.host.score,
            avatarColor: 'from-emerald-500 to-emerald-700',
          });
        }

        if (room.guest) {
          setPlayer2({
            id: 'p2',
            name: room.guest.name,
            score: room.guest.score,
            avatarColor: 'from-sky-500 to-sky-700',
          });
        }

        // Active turn
        setActivePlayerId(room.activePlayerRole === 'host' ? 'p1' : 'p2');

        // Questions log
        if (room.questions) {
          setQuestions(
            room.questions.map((q) => ({
              id: q.id,
              question: q.question,
              isVoice: q.isVoice,
              isVoiceAnswer: (q as any).isVoiceAnswer,
              audioData: q.audioData,
              askedByPlayerId: q.askedByRole === 'host' ? 'p1' : 'p2',
              answeredByPlayerId: q.answeredByRole === 'host' ? 'p1' : 'p2',
              answer: q.answer,
              note: q.note,
              timestamp: q.timestamp,
            }))
          );
        }

        // Pending Guess from opponent
        if (room.pendingGuess) {
          setPendingGuessRemote(room.pendingGuess);
        } else {
          setPendingGuessRemote(null);
        }

        // Pending Question
        if (room.pendingQuestion) {
          setPendingQuestionRemote(room.pendingQuestion);
        } else {
          setPendingQuestionRemote(null);
        }

        // Handle cards for online perspective
        const role = onlineService.userRole;
        if (role === 'host' && room.host) {
          // Host held card is secret unless reveal
          setP1Card({
            imageUrl: room.mySecretCard?.imageUrl || '',
            title: room.mySecretCard?.title || '',
            category: room.category.id,
            chosenByPlayerId: room.guest?.name || 'Guest',
            heldByPlayerId: room.host.name,
          });
          // Opponent card held by guest
          if (room.opponentVisibleCard) {
            setP2Card({
              imageUrl: room.opponentVisibleCard.imageUrl,
              title: room.opponentVisibleCard.title,
              category: room.category.id,
              chosenByPlayerId: room.host.name,
              heldByPlayerId: room.guest?.name || 'Guest',
            });
          }
        } else if (role === 'guest' && room.host) {
          // Guest held card is secret unless reveal
          setP2Card({
            imageUrl: room.mySecretCard?.imageUrl || '',
            title: room.mySecretCard?.title || '',
            category: room.category.id,
            chosenByPlayerId: room.host.name,
            heldByPlayerId: room.guest?.name || 'Guest',
          });
          // Opponent card held by host
          if (room.opponentVisibleCard) {
            setP1Card({
              imageUrl: room.opponentVisibleCard.imageUrl,
              title: room.opponentVisibleCard.title,
              category: room.category.id,
              chosenByPlayerId: room.guest?.name || 'Guest',
              heldByPlayerId: room.host.name,
            });
          }
        }

        // Phase transitions
        if (room.phase === 'LOBBY') {
          setGamePhase('ROOM_LOBBY');
        } else if (room.phase === 'CHOOSING') {
          setIsWaitingForRemoteOpponent(false);
          setGamePhase('CHOOSE_PICTURE_P1');
        } else if (room.phase === 'COUNTDOWN') {
          setIsWaitingForRemoteOpponent(false);
          setGamePhase('PICTURES_LOCKED_COUNTDOWN');
        } else if (room.phase === 'PLAYING') {
          setGamePhase('PLAYING');
        } else if (room.phase === 'REVEAL') {
          setRoundWinnerId(room.winnerRole === 'host' ? 'p1' : 'p2');
          setCorrectGuessWord(room.correctGuess || '');
          setGamePhase('ROUND_REVEAL');
        } else if (room.phase === 'GAMEOVER') {
          setGamePhase('GAME_OVER');
        }
      } else if (event.type === 'QUESTION_PENDING' && event.questionRecord) {
        setPendingQuestionRemote(event.questionRecord);
      } else if (event.type === 'GUESS_REJECTED' || event.type === 'WRONG_GUESS') {
        sound.playWrongBuzzer();
        setPendingGuessRemote(null);
      } else if (event.type === 'VOICE_SIGNAL' && (event as any).signal) {
        liveVoiceManager.handleSignal((event as any).signal);
      }
    });

    liveVoiceManager.setSignalCallback((signal) => {
      onlineService.sendVoiceSignal(signal);
    });

    return () => {
      unsubscribe();
      liveVoiceManager.stop();
    };
  }, []);

  // Close the live mic when the player leaves the match (it stays on between rounds).
  useEffect(() => {
    if (gamePhase === 'HOME' || gamePhase === 'JOIN_GAME' || gamePhase === 'GAME_OVER') {
      if (liveVoiceManager.isActive()) liveVoiceManager.stop();
    }
  }, [gamePhase]);

  // Home Screen Navigators
  const handleOpenPlayerCountModal = (action: 'OFFLINE' | 'ONLINE') => {
    setPendingPlayerCountAction(action);
    setIsPlayerCountModalOpen(true);
  };

  const handleSelectGameMode = (mode: SelectedGameSetupMode) => {
    setIsPlayerCountModalOpen(false);

    if (mode === 'ONLINE_2') {
      // 🎮 2 Players Online
      handlePlayOnline();
    } else if (mode === 'ONLINE_3') {
      // 👥 3 Players Online
      setPlayerCount(3);
      setGameMode('ROOM_CODE');
      setGamePhase('MULTIPLAYER_SETUP');
    } else if (mode === 'ONLINE_4') {
      // 👥 4 Players Online
      setPlayerCount(4);
      setGameMode('ROOM_CODE');
      setGamePhase('MULTIPLAYER_SETUP');
    } else if (mode === 'PASS_AND_PLAY_2') {
      // 📱 2 Players — Same Device
      handlePlayOffline();
    }
  };

  const handleSelectPlayerCount = (count: PlayerCount) => {
    setPlayerCount(count);
    setIsPlayerCountModalOpen(false);

    if (count === 2) {
      // Classic 2 Players head-to-head mode (100% intact)
      if (pendingPlayerCountAction === 'ONLINE') {
        handlePlayOnline();
      } else {
        handlePlayOffline();
      }
    } else {
      // 3 or 4 Players Multiplayer mode
      setGamePhase('MULTIPLAYER_SETUP');
    }
  };

  const handleConfirmMultiplayerSetup = ({
    playerNames,
    category,
  }: {
    playerNames: string[];
    category: CategoryDefinition;
  }) => {
    setCurrentCategory(category);
    setMultiplayerNames(playerNames);
    setGamePhase('MULTIPLAYER_CHOOSE_PICTURES');
  };

  const handleAllMultiplayerPicturesChosen = (secretImages: MultiplayerSecretImage[]) => {
    const DEFAULT_COLORS = [
      'from-emerald-500 to-emerald-700',
      'from-purple-500 to-indigo-700',
      'from-amber-500 to-orange-700',
      'from-rose-500 to-pink-700',
    ];

    const initialMultiPlayers: MultiplayerPlayer[] = multiplayerNames.map((name, i) => {
      const pId = `p-${i + 1}`;
      const mySecret = secretImages.find((img) => img.ownerId === pId);

      // targets = all other players' images
      const targets = multiplayerNames
        .map((otherName, otherIdx) => {
          const otherId = `p-${otherIdx + 1}`;
          if (otherId === pId) return null; // do NOT include self!

          return {
            ownerId: otherId,
            ownerName: otherName,
            isSolved: false,
          };
        })
        .filter(Boolean) as any[];

      return {
        id: pId,
        name,
        score: 0,
        avatarColor: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        secretImage: mySecret,
        targets,
      };
    });

    setMultiplayerPlayers(initialMultiPlayers);
    setGamePhase('MULTIPLAYER_PLAYING');
  };

  const handlePlayOnline = () => {
    setGameMode('ROOM_CODE');
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(code);
    setGamePhase('CREATE_GAME');
  };

  const handlePlayOffline = () => {
    setGameMode('PASS_AND_PLAY');
    setGamePhase('CREATE_GAME');
  };

  const handlePlayWithAI = () => {
    setGameMode('VS_BOT');
    setPlayer2((p) => ({ ...p, name: lang === 'ar' ? 'الروبوت الذكي 🤖' : 'Smart Bot 🤖' }));
    setGamePhase('CREATE_GAME');
  };

  // Join online room
  const handleJoinOnlineRoom = async (code: string, playerName: string) => {
    setGameMode('ROOM_CODE');
    setRoomCode(code);
    setOnlineRole('guest');
    setPlayer2((p) => ({ ...p, name: playerName }));
    await onlineService.joinRoom(code, playerName);
    setIsJoinModalOpen(false);
    setGamePhase('ROOM_LOBBY');
  };

  // Confirm Create Game (both Online and Offline)
  const handleConfirmCreateGame = async (data: {
    playerName: string;
    opponentName: string;
    category: CategoryDefinition;
    targetScore: number;
  }) => {
    setPlayer1({ id: 'p1', name: data.playerName, score: 0, avatarColor: 'from-emerald-500 to-emerald-700' });
    setPlayer2({ id: 'p2', name: data.opponentName, score: 0, avatarColor: 'from-sky-500 to-sky-700' });
    setCurrentCategory(data.category);
    setTargetScore(data.targetScore);
    setRoundNumber(1);
    setQuestions([]);
    setP1Card(null);
    setP2Card(null);

    if (gameMode === 'ROOM_CODE') {
      setOnlineRole('host');
      await onlineService.createRoom(roomCode, data.playerName, data.category, data.targetScore);
      setGamePhase('ROOM_LOBBY');
    } else {
      setGamePhase('CHOOSE_PICTURE_P1');
    }
  };

  // Picture chosen by user for opponent
  const handleConfirmPicture = (choice: PlayerChoice) => {
    if (gameMode === 'ROOM_CODE') {
      // Send secretly to server
      onlineService.submitPicture(choice.imageUrl, choice.title);
      setIsWaitingForRemoteOpponent(true);
    } else if (gameMode === 'PASS_AND_PLAY') {
      // First chooser was P1
      if (!p2Card) {
        setP2Card(choice);
        setShowHandoffToP2(true);
      } else {
        // Second chooser was P2
        setP1Card(choice);
        setGamePhase('PICTURES_LOCKED_COUNTDOWN');
      }
    } else if (gameMode === 'VS_BOT') {
      setP2Card(choice);
      // Bot picks an image for P1
      let botPick = currentCategory.presetItems.find((p) => p.nameAr !== choice.title);
      if (!botPick && currentCategory.presetItems.length > 0) {
        botPick = currentCategory.presetItems[0];
      }
      setP1Card({
        imageUrl: botPick?.imageUrl || '',
        title: botPick ? (lang === 'ar' ? botPick.nameAr : botPick.nameEn) : 'عنصر سري',
        category: currentCategory.id,
        chosenByPlayerId: player2.name,
        heldByPlayerId: player1.name,
      });
      setGamePhase('PICTURES_LOCKED_COUNTDOWN');
    }
  };

  // Online Real-time Actions
  const handleOnlineAsk = (question: string, isVoice?: boolean, audioData?: string) => {
    onlineService.askQuestion(question, isVoice, audioData);
  };

  const handleOnlineAnswer = (
    answer: AnswerType,
    question: string,
    note?: string,
    isVoiceAnswer?: boolean
  ) => {
    onlineService.answerQuestion(question, answer, note, undefined, isVoiceAnswer);
    setPendingQuestionRemote(null);
  };

  const handleOnlineGuess = (guess: string) => {
    onlineService.makeGuess(guess);
  };

  const handleOnlineDeclareWin = (question?: string) => {
    onlineService.declareWin(question);
    setPendingQuestionRemote(null);
  };

  const handleOnlineResolveGuess = (isCorrect: boolean) => {
    onlineService.resolveGuess(isCorrect);
    setPendingGuessRemote(null);
  };

  // Offline Question flow
  const handleAddQuestionAndAnswer = (
    question: string,
    answer: AnswerType,
    note?: string,
    isVoice?: boolean,
    audioData?: string,
    isVoiceAnswer?: boolean
  ) => {
    const respondentId = activePlayerId === player1.id ? player2.id : player1.id;
    const newRecord: QuestionRecord = {
      id: 'q-' + Date.now(),
      question,
      isVoice,
      isVoiceAnswer,
      audioData,
      askedByPlayerId: activePlayerId,
      answeredByPlayerId: respondentId,
      answer,
      note: note ? note.trim() : undefined,
      timestamp: Date.now(),
    };

    setQuestions((prev) => [newRecord, ...prev]);
    const nextPlayerId = activePlayerId === player1.id ? player2.id : player1.id;
    setActivePlayerId(nextPlayerId);
  };

  // Offline Correct Guess
  const handleCorrectGuess = (winnerId: string, guess: string) => {
    setRoundWinnerId(winnerId);
    setCorrectGuessWord(guess);

    if (winnerId === player1.id) {
      setPlayer1((p) => ({ ...p, score: p.score + 1 }));
    } else {
      setPlayer2((p) => ({ ...p, score: p.score + 1 }));
    }

    setGamePhase('ROUND_REVEAL');
  };

  const handleWrongGuess = () => {
    const nextPlayerId = activePlayerId === player1.id ? player2.id : player1.id;
    setActivePlayerId(nextPlayerId);
  };

  // Next round transition
  const handleNextRound = () => {
    if (gameMode === 'ROOM_CODE') {
      onlineService.nextRound();
      return;
    }

    const p1Won = player1.score >= targetScore;
    const p2Won = player2.score >= targetScore;

    if (p1Won || p2Won) {
      setGamePhase('GAME_OVER');
      return;
    }

    setRoundNumber((r) => r + 1);
    setQuestions([]);
    setP1Card(null);
    setP2Card(null);
    setRoundWinnerId(null);
    setCorrectGuessWord('');
    setActivePlayerId(roundNumber % 2 === 0 ? 'p1' : 'p2');
    setGamePhase('CHOOSE_PICTURE_P1');
  };

  // Restart match
  const handlePlayAgain = () => {
    if (gameMode === 'ROOM_CODE') {
      onlineService.nextRound();
      return;
    }

    setPlayer1((p) => ({ ...p, score: 0 }));
    setPlayer2((p) => ({ ...p, score: 0 }));
    setRoundNumber(1);
    setQuestions([]);
    setP1Card(null);
    setP2Card(null);
    setRoundWinnerId(null);
    setCorrectGuessWord('');
    setGamePhase('CHOOSE_PICTURE_P1');
  };

  const handleBackToHome = () => {
    if (gameMode === 'ROOM_CODE') {
      onlineService.disconnect();
    }
    setPlayer1((p) => ({ ...p, score: 0 }));
    setPlayer2((p) => ({ ...p, score: 0 }));
    setRoundNumber(1);
    setQuestions([]);
    setP1Card(null);
    setP2Card(null);
    setGamePhase('HOME');
  };

  const winnerPlayer = roundWinnerId === player1.id ? player1 : player2;

  const isMatchActive =
    (gamePhase === 'PLAYING' ||
      gamePhase === 'ROUND_REVEAL' ||
      gamePhase === 'PICTURES_LOCKED_COUNTDOWN' ||
      gamePhase === 'GAME_OVER') &&
    Boolean(player1.name) &&
    Boolean(player2.name);

  return (
    <div className="min-h-screen bg-[#070D1E] text-slate-100 flex justify-center items-start sm:py-6 selection:bg-amber-400 selection:text-slate-900 font-['Cairo',sans-serif] relative overflow-x-hidden">
      {/* Subtle Atmospheric Ambient Glow (Deep Blue & Purple) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-gradient-to-b from-blue-600/10 via-purple-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* Main Mobile App Container */}
      <div className="w-full max-w-[440px] min-h-screen sm:min-h-[860px] bg-[#0F172A] sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-slate-800/80 overflow-y-auto flex flex-col relative z-10">
        {/* Top Header (shown on gameplay, lobby, setup, and reveal screens) */}
        {gamePhase !== 'HOME' && gamePhase !== 'JOIN_GAME' && (
          <Header
            scoreP1={player1.score}
            scoreP2={player2.score}
            nameP1={player1.name}
            nameP2={player2.name}
            roundNumber={roundNumber}
            categoryName={gamePhase === 'PLAYING' || gamePhase === 'ROUND_REVEAL' ? (lang === 'ar' ? currentCategory.nameAr : currentCategory.nameEn) : undefined}
            categoryIcon={gamePhase === 'PLAYING' || gamePhase === 'ROUND_REVEAL' ? currentCategory.icon : undefined}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onOpenRules={() => setIsRulesOpen(true)}
            onRestartMatch={handleBackToHome}
            lang={lang}
            onToggleLang={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            showScore={isMatchActive && !gamePhase.startsWith('MULTIPLAYER')}
          />
        )}

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col justify-start items-center w-full ${gamePhase === 'HOME' || gamePhase === 'JOIN_GAME' ? 'p-0' : 'py-2 px-3'}`}>
        {/* 1. HOME SCREEN */}
        {gamePhase === 'HOME' && (
          <HomeScreen
            onCreateOnlineGame={() => handleOpenPlayerCountModal('ONLINE')}
            onJoinRoom={() => {
              setInitialJoinCode('');
              setGamePhase('JOIN_GAME');
            }}
            onPlayOffline={() => handleOpenPlayerCountModal('OFFLINE')}
            onPlayWithAI={handlePlayWithAI}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenMultiplayer={() => handleOpenPlayerCountModal('OFFLINE')}
            lang={lang}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
          />
        )}

        {/* 1B. JOIN GAME SCREEN */}
        {gamePhase === 'JOIN_GAME' && (
          <JoinGameScreen
            initialCode={initialJoinCode}
            onJoinRoom={handleJoinOnlineRoom}
            onCreateNewGame={handlePlayOnline}
            onBack={() => setGamePhase('HOME')}
            lang={lang}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onOpenRules={() => setIsRulesOpen(true)}
          />
        )}

        {/* 2. CREATE GAME SCREEN */}
        {gamePhase === 'CREATE_GAME' && (
          <CreateGameScreen
            mode={gameMode}
            onConfirmCreate={handleConfirmCreateGame}
            onBack={() => setGamePhase('HOME')}
            lang={lang}
          />
        )}

        {/* 3. ROOM LOBBY (Online Mode) */}
        {gamePhase === 'ROOM_LOBBY' && (
          <RoomLobbyScreen
            roomCode={roomCode}
            isHost={onlineRole === 'host'}
            playerName={onlineRole === 'host' ? player1.name : player2.name}
            category={currentCategory}
            targetScore={targetScore}
            onStartSecretSelection={() => setGamePhase('CHOOSE_PICTURE_P1')}
            onBack={handleBackToHome}
            lang={lang}
          />
        )}

        {/* 4A. PICTURE SELECTION (Player 1 or Online Player) */}
        {gamePhase === 'CHOOSE_PICTURE_P1' && !showHandoffToP2 && (
          <ChoosePictureScreen
            chooserName={gameMode === 'ROOM_CODE' ? (onlineRole === 'host' ? player1.name : player2.name) : player1.name}
            opponentName={gameMode === 'ROOM_CODE' ? (onlineRole === 'host' ? player2.name : player1.name) : player2.name}
            category={currentCategory}
            onConfirmPicture={handleConfirmPicture}
            isWaitingForRemoteOpponent={isWaitingForRemoteOpponent}
            lang={lang}
          />
        )}

        {/* OFFLINE HANDOFF PRIVACY INTERSTITIAL */}
        {gamePhase === 'CHOOSE_PICTURE_P1' && showHandoffToP2 && (
          <PassAndPlayTransition
            fromPlayer={player1.name}
            toPlayer={player2.name}
            stageTitle={
              lang === 'ar'
                ? `دور ${player2.name} لاختيار صورة سرية لـ ${player1.name}`
                : `${player2.name}'s turn to pick a secret picture for ${player1.name}`
            }
            onProceed={() => {
              setShowHandoffToP2(false);
              setGamePhase('CHOOSE_PICTURE_P2');
            }}
            lang={lang}
          />
        )}

        {/* 4B. OFFLINE P2 CHOOSES FOR P1 */}
        {gamePhase === 'CHOOSE_PICTURE_P2' && (
          <ChoosePictureScreen
            chooserName={player2.name}
            opponentName={player1.name}
            category={currentCategory}
            onConfirmPicture={handleConfirmPicture}
            lang={lang}
          />
        )}

        {/* 5. PICTURES LOCKED & COUNTDOWN */}
        {gamePhase === 'PICTURES_LOCKED_COUNTDOWN' && (
          <PicturesLockedCountdown
            onCountdownComplete={() => setGamePhase('PLAYING')}
            lang={lang}
          />
        )}

        {/* 6. BATTLE ARENA (MAIN PLAYING TABLE) */}
        {gamePhase === 'PLAYING' && p1Card && p2Card && (
          <BattleArena
            player1={player1}
            player2={player2}
            p1Card={p1Card}
            p2Card={p2Card}
            category={currentCategory}
            roundNumber={roundNumber}
            activePlayerId={activePlayerId}
            questions={questions}
            onAddQuestionAndAnswer={handleAddQuestionAndAnswer}
            onCorrectGuess={handleCorrectGuess}
            onWrongGuess={handleWrongGuess}
            isBotMatch={gameMode === 'VS_BOT'}
            isOnlineMatch={gameMode === 'ROOM_CODE'}
            onlineRole={onlineRole}
            onOnlineAsk={handleOnlineAsk}
            onOnlineAnswer={handleOnlineAnswer}
            onOnlineGuess={handleOnlineGuess}
            onOnlineDeclareWin={handleOnlineDeclareWin}
            pendingQuestionRemote={pendingQuestionRemote}
            pendingGuessRemote={pendingGuessRemote}
            onOnlineResolveGuess={handleOnlineResolveGuess}
            lang={lang}
          />
        )}

        {/* 7. THE REVEAL SCREEN */}
        {gamePhase === 'ROUND_REVEAL' && p1Card && p2Card && (
          <RevealScreen
            winner={winnerPlayer}
            p1={player1}
            p2={player2}
            p1Card={p1Card}
            p2Card={p2Card}
            category={currentCategory}
            correctGuess={correctGuessWord}
            onNextRound={handleNextRound}
            lang={lang}
          />
        )}

        {/* 8. GAME OVER SCREEN */}
        {gamePhase === 'GAME_OVER' && (
          <GameOverScreen
            player1={player1}
            player2={player2}
            onPlayAgain={handlePlayAgain}
            onBackToHome={handleBackToHome}
            lang={lang}
          />
        )}

        {/* 9A. MULTIPLAYER SETUP SCREEN (3–4 PLAYERS) */}
        {gamePhase === 'MULTIPLAYER_SETUP' && (
          <MultiplayerSetupScreen
            playerCount={playerCount}
            onConfirmSetup={handleConfirmMultiplayerSetup}
            onBack={() => setGamePhase('HOME')}
            lang={lang}
          />
        )}

        {/* 9B. MULTIPLAYER CHOOSE SECRET PICTURES */}
        {gamePhase === 'MULTIPLAYER_CHOOSE_PICTURES' && (
          <MultiplayerChoosePictureScreen
            playerNames={multiplayerNames}
            category={currentCategory}
            onAllPicturesChosen={handleAllMultiplayerPicturesChosen}
            lang={lang}
          />
        )}

        {/* 9C. MULTIPLAYER ARENA (MAIN PLAYING TABLE) */}
        {gamePhase === 'MULTIPLAYER_PLAYING' && multiplayerPlayers.length > 0 && (
          <MultiplayerArena
            initialPlayers={multiplayerPlayers}
            category={currentCategory}
            onPlayAgain={() => setGamePhase('MULTIPLAYER_CHOOSE_PICTURES')}
            onBackToHome={() => setGamePhase('HOME')}
            lang={lang}
          />
        )}
      </main>

      {/* Player Count Selector Modal (2 Players, 3 Players, 4 Players) */}
      <PlayerCountModal
        isOpen={isPlayerCountModalOpen}
        onClose={() => setIsPlayerCountModalOpen(false)}
        onSelectMode={handleSelectGameMode}
        onSelectCount={handleSelectPlayerCount}
        lang={lang}
      />

      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        initialCode={initialJoinCode}
        onJoin={handleJoinOnlineRoom}
        onClose={() => setIsJoinModalOpen(false)}
        lang={lang}
      />

      {/* Rules Walkthrough Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} lang={lang} />
      </div>
    </div>
  );
}
