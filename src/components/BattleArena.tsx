import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerChoice, QuestionRecord, CategoryDefinition, AnswerType, PendingQuestionData } from '../types/game';
import { sound } from '../utils/audio';
import { isCorrectGuess } from '../utils/normalize';
import { useRoomVoice } from '../context/RoomVoiceContext';
import { PlayerMicBadge } from './PlayerMicBadge';
import {
  Send,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Smartphone,
  BookOpen,
  Mic,
  MicOff,
  Keyboard,
  Trophy,
} from 'lucide-react';

interface BattleArenaProps {
  player1: Player;
  player2: Player;
  p1Card: PlayerChoice; // Held by P1 (chosen by P2)
  p2Card: PlayerChoice; // Held by P2 (chosen by P1)
  category: CategoryDefinition;
  roundNumber: number;
  activePlayerId: string;
  questions: QuestionRecord[];
  onAddQuestionAndAnswer: (
    question: string,
    answer: AnswerType,
    note?: string,
    isVoice?: boolean,
    audioData?: string,
    isVoiceAnswer?: boolean
  ) => void;
  onCorrectGuess: (winnerId: string, guess: string) => void;
  onWrongGuess: (guesserId: string, guess: string) => void;
  isBotMatch: boolean;
  isOnlineMatch?: boolean;
  onlineRole?: 'host' | 'guest';
  onOnlineAsk?: (question: string, isVoice?: boolean, audioData?: string) => void;
  onOnlineAnswer?: (
    answer: AnswerType,
    question: string,
    note?: string,
    isVoiceAnswer?: boolean
  ) => void;
  onOnlineGuess?: (guess: string) => void;
  onOnlineDeclareWin?: (question?: string) => void;
  onOnlineResolveGuess?: (isCorrect: boolean) => void;
  pendingQuestionRemote?: PendingQuestionData | null;
  pendingGuessRemote?: {
    guesserRole: 'host' | 'guest';
    guesserName: string;
    guessText: string;
  } | null;
  lang: 'ar' | 'en';
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  player1,
  player2,
  p1Card,
  p2Card,
  category,
  roundNumber,
  activePlayerId,
  questions,
  onAddQuestionAndAnswer,
  onCorrectGuess,
  onWrongGuess,
  isBotMatch,
  isOnlineMatch = false,
  onlineRole = 'host',
  onOnlineAsk,
  onOnlineAnswer,
  onOnlineGuess,
  onOnlineDeclareWin,
  onOnlineResolveGuess,
  pendingQuestionRemote,
  pendingGuessRemote,
  lang,
}) => {
  const defaultViewer = isOnlineMatch ? (onlineRole === 'host' ? player1.id : player2.id) : activePlayerId;
  const [viewerId, setViewerId] = useState<string>(defaultViewer);

  // Question drafting
  const [questionInput, setQuestionInput] = useState<string>('');

  // Local pending question for offline / pass-and-play / bot:
  const [pendingQuestionLocal, setPendingQuestionLocal] = useState<{
    id: string;
    question: string;
    isVoice?: boolean;
    audioData?: string;
    askedById: string;
    answeredById: string;
  } | null>(null);

  // Answering controls: selected answer choice + optional note
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerType | null>(null);
  const [answerNote, setAnswerNote] = useState<string>('');

  // Pass and Play Handover Interstitial
  const [passAndPlayHandoff, setPassAndPlayHandoff] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Question History Bottom Sheet & Tabs
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<'MY_CLUES' | 'OPPONENT_CLUES' | 'ALL'>('MY_CLUES');

  // Privacy hide toggle for opponent card when sitting side-by-side
  const [hideOpponentCard, setHideOpponentCard] = useState<boolean>(false);

  // Determine current active question
  const activeQuestionText = isOnlineMatch
    ? pendingQuestionRemote?.question || null
    : pendingQuestionLocal?.question || null;

  const isVoiceActiveQuestion = isOnlineMatch
    ? Boolean(pendingQuestionRemote?.isVoice)
    : Boolean(pendingQuestionLocal?.isVoice);

  const activeQuestionAudioData = isOnlineMatch
    ? pendingQuestionRemote?.audioData || null
    : pendingQuestionLocal?.audioData || null;

  const isAskerOfPendingQuestion = isOnlineMatch
    ? pendingQuestionRemote?.askedByRole === onlineRole
    : pendingQuestionLocal?.askedById === viewerId;

  const isReceiverOfPendingQuestion = isOnlineMatch
    ? pendingQuestionRemote?.answeredByRole === onlineRole
    : pendingQuestionLocal?.answeredById === viewerId;

  const activePlayer = activePlayerId === player1.id ? player1 : player2;
  const opponentPlayer = activePlayerId === player1.id ? player2 : player1;

  // Single Unified Question Composer Mode: 'VOICE' or 'TEXT'
  const [composerMode, setComposerMode] = useState<'VOICE' | 'TEXT'>('VOICE');
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef<boolean>(false);

  // Answering Voice Support (Opponent can answer/dictate by mic too)
  const [isAnswerListening, setIsAnswerListening] = useState<boolean>(false);
  const [isVoiceAnswerUsed, setIsVoiceAnswerUsed] = useState<boolean>(false);
  const answerRecognitionRef = useRef<any>(null);
  const shouldAnswerBeListeningRef = useRef<boolean>(false);

  // Independent Room Voice System (Always available to all players regardless of turn)
  const {
    isMyMicMuted,
    isMySpeaking,
    toggleMyMic,
    togglePlayerMic,
    getPlayerMicStatus,
    errorMessage: voiceError,
  } = useRoomVoice();

  // Setup Web Speech Recognition for voice question input and answer dictation (Continuous tap-to-toggle)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang === 'ar' ? 'ar-EG' : 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setQuestionInput(transcript.trim());
          }
        };

        recognition.onend = () => {
          if (shouldBeListeningRef.current) {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
              shouldBeListeningRef.current = false;
            }
          } else {
            setIsListening(false);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            shouldBeListeningRef.current = false;
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;

        // Opponent Answer Recognition (Continuous tap-to-toggle)
        const ansRecognition = new SpeechRecognition();
        ansRecognition.continuous = true;
        ansRecognition.interimResults = true;
        ansRecognition.lang = lang === 'ar' ? 'ar-EG' : 'en-US';

        ansRecognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            const lower = transcript.toLowerCase();
            setIsVoiceAnswerUsed(true);
            if (lower.includes('نعم') || lower.includes('اه') || lower.includes('ايوة') || lower.includes('yes') || lower.includes('صح')) {
              setSelectedAnswer('YES');
              sound.playYesSound();
            } else if (lower.includes('لا') || lower.includes('لأ') || lower.includes('no') || lower.includes('مش')) {
              setSelectedAnswer('NO');
              sound.playNoSound();
            } else if (lower.includes('أحيان') || lower.includes('احيان') || lower.includes('sometimes')) {
              setSelectedAnswer('SOMETIMES');
              sound.playMaybeSound();
            } else if (lower.includes('مش متأكد') || lower.includes('مش عارف') || lower.includes('not sure')) {
              setSelectedAnswer('NOT_SURE');
              sound.playMaybeSound();
            }
            setAnswerNote(transcript.trim());
          }
        };

        ansRecognition.onend = () => {
          if (shouldAnswerBeListeningRef.current) {
            try {
              ansRecognition.start();
            } catch {
              setIsAnswerListening(false);
              shouldAnswerBeListeningRef.current = false;
            }
          } else {
            setIsAnswerListening(false);
          }
        };

        ansRecognition.onerror = (e: any) => {
          console.warn('AnsRecognition error:', e);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            shouldAnswerBeListeningRef.current = false;
            setIsAnswerListening(false);
          }
        };

        answerRecognitionRef.current = ansRecognition;
      } catch (e) {
        console.warn('SpeechRecognition init error:', e);
      }
    }
  }, [lang]);

  // Click once to start listening, click again to stop (No hold required!)
  const toggleListening = () => {
    if (isListening) {
      shouldBeListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
    } else {
      shouldBeListeningRef.current = true;
      setIsListening(true);
      sound.playTurnChime();
      if (!recognitionRef.current) {
        if (!questionInput.trim()) {
          setQuestionInput(lang === 'ar' ? '🎙️ سؤال بالمايك' : '🎙️ Mic Question');
        }
      } else {
        try {
          recognitionRef.current.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
          recognitionRef.current.start();
        } catch (err) {
          console.warn('Speech recognition start error:', err);
        }
      }
    }
  };

  // Click once to start answer dictation, click again to stop (No hold required!)
  const toggleAnswerListening = () => {
    setIsVoiceAnswerUsed(true);
    if (isAnswerListening) {
      shouldAnswerBeListeningRef.current = false;
      setIsAnswerListening(false);
      try {
        answerRecognitionRef.current?.stop();
      } catch {}
    } else {
      shouldAnswerBeListeningRef.current = true;
      setIsAnswerListening(true);
      sound.playTurnChime();
      if (!answerRecognitionRef.current) {
        if (!selectedAnswer) setSelectedAnswer('YES');
      } else {
        try {
          answerRecognitionRef.current.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
          answerRecognitionRef.current.start();
        } catch (err) {
          console.warn('Answer speech recognition error:', err);
        }
      }
    }
  };

  // Is it my turn to ask right now? (Only when no question is pending!)
  const isMyTurnToAsk = isOnlineMatch
    ? (onlineRole === 'host' ? activePlayerId === player1.id : activePlayerId === player2.id) && !pendingQuestionRemote
    : viewerId === activePlayerId && !pendingQuestionLocal;

  const viewerIsP1 = viewerId === player1.id;
  const viewerName = viewerIsP1 ? player1.name : player2.name;
  const opponentName = viewerIsP1 ? player2.name : player1.name;
  const visibleOpponentCard = viewerIsP1 ? p2Card : p1Card;

  // Latest Question & Answer in the round
  const latestQuestionRecord = questions.length > 0 ? questions[0] : null;
  const latestRespondentName = latestQuestionRecord
    ? latestQuestionRecord.answeredByPlayerId === player1.id
      ? player1.name
      : player2.name
    : '';
  const latestAskerName = latestQuestionRecord
    ? latestQuestionRecord.askedByPlayerId === player1.id
      ? player1.name
      : player2.name
    : '';
  const isLatestAskedByMe = latestQuestionRecord?.askedByPlayerId === viewerId;

  // Separate Deduction Tracks for History
  const myClues = questions.filter((q) => q.askedByPlayerId === viewerId);
  const opponentClues = questions.filter((q) => q.askedByPlayerId !== viewerId);

  // Bot Turn Simulation: When active player is Bot, Bot drafts a question after a brief typing delay
  useEffect(() => {
    if (isBotMatch && activePlayerId === player2.id && !pendingQuestionLocal) {
      const timer = setTimeout(() => {
        const pool = lang === 'ar' ? category.suggestedQuestionsAr : category.suggestedQuestionsEn;
        const randomQ = pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : (lang === 'ar' ? 'هل صورتي حاجة بتتاكل؟' : 'Is my item edible?');
        sound.playTurnChime();
        setPendingQuestionLocal({
          id: 'q-' + Date.now(),
          question: randomQ,
          askedById: player2.id,
          answeredById: player1.id,
        });
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [isBotMatch, activePlayerId, pendingQuestionLocal, category, lang, player1.id, player2.id]);

  // Ask Question Handler (Unified Composer: Voice or Text)
  const handleAsk = (qText: string, isVoice: boolean = false) => {
    const textToSend = qText.trim() || (isVoice ? (lang === 'ar' ? '🎙️ سؤال بالمايك' : '🎙️ Mic Question') : '');
    if (!textToSend || !isMyTurnToAsk) return;
    sound.playTurnChime();

    shouldBeListeningRef.current = false;
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    if (isOnlineMatch && onOnlineAsk) {
      onOnlineAsk(textToSend, isVoice);
      setQuestionInput('');
      return;
    }

    const respondentId = activePlayerId === player1.id ? player2.id : player1.id;
    setPendingQuestionLocal({
      id: 'q-' + Date.now(),
      question: textToSend,
      isVoice,
      askedById: activePlayerId,
      answeredById: respondentId,
    });
    setQuestionInput('');
    setSelectedAnswer(null);
    setAnswerNote('');

    // In Pass & Play: prompt phone handoff to opponent to answer
    if (!isOnlineMatch && !isBotMatch) {
      setPassAndPlayHandoff(true);
      return;
    }

    // In Bot Match: Human asked, Bot answers after brief realistic delay
    if (isBotMatch && activePlayerId === player1.id) {
      setTimeout(() => {
        const target = p1Card.title.toLowerCase();
        const q = textToSend.toLowerCase();
        // In Bot Match: Bot checks if human asked the winning guess
        if (isCorrectGuess(textToSend, p1Card.title)) {
          sound.playVictoryFanfare();
          onCorrectGuess(player1.id, textToSend);
          setPendingQuestionLocal(null);
          return;
        }

        let botAns: AnswerType = 'YES';
        let botNote = '';

        if (q.includes('حلو') || q.includes('sweet') || q.includes('سكر') || q.includes('dessert')) {
          const isSweet = ['كيك', 'دونات', 'تفاحة', 'آيس', 'شوكولاتة', 'cake', 'donut', 'apple'].some((w) => target.includes(w));
          botAns = isSweet ? 'YES' : 'NO';
          botNote = isSweet ? 'حلوة ومسكرة جداً!' : 'مش حاجة حلوة';
        } else if (q.includes('حار') || q.includes('ساخن') || q.includes('hot')) {
          const isHot = ['بيتزا', 'برجر', 'فراخ', 'شاورما', 'باستا', 'taco', 'burger', 'pizza'].some((w) => target.includes(w));
          botAns = isHot ? 'YES' : 'NO';
          botNote = isHot ? 'بتتاكل سخنة وطازة' : 'مش شرط تكون سخنة';
        } else if (q.includes('حيوان') || q.includes('animal')) {
          const isAnimal = ['أسد', 'نمر', 'فيل', 'قطة', 'كلب', 'lion', 'cat'].some((w) => target.includes(w));
          botAns = isAnimal ? 'YES' : 'NO';
        } else {
          botAns = Math.random() > 0.4 ? 'YES' : 'NO';
        }

        if (botAns === 'YES') sound.playYesSound();
        else sound.playNoSound();

        onAddQuestionAndAnswer(textToSend, botAns, botNote, isVoice);
        setPendingQuestionLocal(null);
      }, 800);
    }
  };

  // Submit Answer to Question
  const handleSubmitAnswer = () => {
    if (!activeQuestionText || !selectedAnswer) return;

    if (selectedAnswer === 'YES') sound.playYesSound();
    else if (selectedAnswer === 'NO') sound.playNoSound();
    else sound.playMaybeSound();

    const note = answerNote.trim() || undefined;

    const wasVoice = isLiveMicOn || isVoiceAnswerUsed;

    shouldAnswerBeListeningRef.current = false;
    if (isAnswerListening && answerRecognitionRef.current) {
      try {
        answerRecognitionRef.current.stop();
      } catch {}
      setIsAnswerListening(false);
    }

    if (isOnlineMatch && onOnlineAnswer) {
      onOnlineAnswer(selectedAnswer, activeQuestionText, note, wasVoice);
      setSelectedAnswer(null);
      setAnswerNote('');
      setIsVoiceAnswerUsed(false);
      return;
    }

    // Offline / Pass & Play / Bot Match:
    onAddQuestionAndAnswer(
      activeQuestionText,
      selectedAnswer,
      note,
      isVoiceActiveQuestion,
      activeQuestionAudioData || undefined,
      wasVoice
    );
    setPendingQuestionLocal(null);
    setSelectedAnswer(null);
    setAnswerNote('');
    setIsVoiceAnswerUsed(false);

    // In Pass & Play: The respondent (who holds phone) now becomes the active player to ask!
    if (!isOnlineMatch && !isBotMatch) {
      const nextActiveId = activePlayerId === player1.id ? player2.id : player1.id;
      setViewerId(nextActiveId);
      setPassAndPlayHandoff(false);
    }
  };

  // Win Action: The secret card owner manually declares that the asker's question was the winning guess!
  const handleDeclareWinner = () => {
    if (!activeQuestionText) return;
    shouldBeListeningRef.current = false;
    shouldAnswerBeListeningRef.current = false;
    setIsListening(false);
    setIsAnswerListening(false);
    try { recognitionRef.current?.stop(); } catch {}
    try { answerRecognitionRef.current?.stop(); } catch {}
    sound.playVictoryFanfare();

    // The asker is the winner!
    const winnerId = isOnlineMatch
      ? (onlineRole === 'host' ? player2.id : player1.id)
      : (activePlayerId === player1.id ? player1.id : player2.id);

    if (isOnlineMatch && onOnlineDeclareWin) {
      onOnlineDeclareWin(activeQuestionText);
      return;
    }

    onCorrectGuess(winnerId, activeQuestionText);
    setPendingQuestionLocal(null);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col space-y-3 sm:space-y-4 animate-scale-up pb-4">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-2xl text-xs font-black text-center shadow-md animate-shake">
          {toastMessage}
        </div>
      )}

      {/* 1. TOP MOBILE MATCH HEADER */}
      <div className="game-card-surface p-3 border border-slate-700/60 flex items-center justify-between">
        {/* P1 Score Badge & Mic Status */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
            1
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200 truncate max-w-[65px]">{player1.name}</span>
              <PlayerMicBadge
                isMuted={getPlayerMicStatus(player1.id).isMuted}
                isSpeaking={getPlayerMicStatus(player1.id).isSpeaking}
                onToggle={() => togglePlayerMic(player1.id)}
                size="xs"
                lang={lang}
              />
            </div>
            <div className="text-sm font-black font-mono text-blue-400 leading-none">{player1.score}</div>
          </div>
        </div>

        {/* Center Round & Category Pill */}
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 bg-[#0F172A] border border-slate-700/80 rounded-full text-[11px] font-bold text-slate-300 font-mono">
            {lang === 'ar' ? `جولة ${roundNumber}` : `Round ${roundNumber}`}
          </div>
          <span className="text-[10px] font-medium text-slate-400 mt-0.5">
            {category.icon} {lang === 'ar' ? category.nameAr : category.nameEn}
          </span>
        </div>

        {/* P2 Score Badge & Mic Status */}
        <div className="flex items-center gap-2">
          <div className="text-end">
            <div className="flex items-center justify-end gap-1.5">
              <PlayerMicBadge
                isMuted={getPlayerMicStatus(player2.id).isMuted}
                isSpeaking={getPlayerMicStatus(player2.id).isSpeaking}
                onToggle={() => togglePlayerMic(player2.id)}
                size="xs"
                lang={lang}
              />
              <span className="text-xs font-bold text-slate-200 truncate max-w-[65px]">{player2.name}</span>
            </div>
            <div className="text-sm font-black font-mono text-purple-400 leading-none">{player2.score}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
            2
          </div>
        </div>
      </div>

      {/* 1B. UNIFIED ROOM VOICE CHAT BAR (PERMANENT, INDEPENDENT OF TURNS / QUESTIONS) */}
      <div className="p-3 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border-2 border-slate-700/90 rounded-2xl shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PlayerMicBadge
              isMuted={isMyMicMuted}
              isSpeaking={isMySpeaking}
              onToggle={() => toggleMyMic()}
              size="md"
              lang={lang}
            />
            <div>
              <div className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                <span>{isMyMicMuted ? (lang === 'ar' ? 'مايك الغرفة: مقفول 🔇' : 'Room Voice: Muted 🔇') : (lang === 'ar' ? 'مايك الغرفة: شغال لايف 🎙️' : 'Room Voice: Active 🎙️')}</span>
                {isMySpeaking && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                    {lang === 'ar' ? 'صوتك مسموع الآن •••' : 'Speaking •••'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-bold">
                {lang === 'ar'
                  ? 'متاح للطرفين دائماً — اضغط للفتح أو الكتم في أي وقت'
                  : 'Available to all players — Independent of turns'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleMyMic()}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md ${
              !isMyMicMuted
                ? 'bg-rose-600 text-white hover:bg-rose-500 border border-rose-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-400'
            }`}
          >
            {!isMyMicMuted ? (
              <>
                <MicOff className="w-4 h-4 text-white" />
                <span>{lang === 'ar' ? 'كتم المايك 🔇' : 'Mute Mic 🔇'}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-white" />
                <span>{lang === 'ar' ? 'فتح المايك 🎙️' : 'Unmute Mic 🎙️'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {voiceError && (
        <div className="px-3 py-1.5 bg-rose-950/70 border border-rose-600/50 rounded-xl text-[11px] font-bold text-rose-300 text-center animate-shake">
          {voiceError}
        </div>
      )}

      {/* 2. TURN CALLOUT BANNER (Clearly stating whose turn it is to ask about their card) */}
      <div
        className={`rounded-2xl p-2.5 text-center text-xs font-black flex items-center justify-center gap-2 border transition-all ${
          isMyTurnToAsk
            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-xs'
            : 'bg-slate-800/80 text-slate-300 border-slate-700/70'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${isMyTurnToAsk ? 'bg-blue-400 animate-ping' : 'bg-amber-400'}`} />
        <span>
          {isMyTurnToAsk
            ? (lang === 'ar'
                ? `دورك يا ${viewerName} 🎯 (اطرح سؤالك أو خمّن بطاقتك)`
                : `Your turn, ${viewerName} 🎯 (Ask or guess)`)
            : activeQuestionText
            ? (lang === 'ar'
                ? `سؤال مطروح وبانتظار الإجابة 💬`
                : `Question asked, waiting for answer 💬`)
            : (lang === 'ar'
                ? `دور ${activePlayer.name} ✍️ (يكتب سؤاله عن صورته)`
                : `${activePlayer.name}'s turn ✍️`)}
        </span>
      </div>

      {/* 3. HERO SECTION: THE TWO DISTINCT DEDUCTION CARDS */}
      <div className="game-card-surface p-4 sm:p-5 border border-slate-700/60 relative">
        <div className="grid grid-cols-2 gap-3 items-center relative">
          {/* CARD 1: صورتك المخفية */}
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-bold text-amber-400 mb-1.5 flex items-center gap-1">
              <span>{lang === 'ar' ? 'صورتك المخفية' : 'YOUR CARD'}</span>
              <span className="text-[10px]">🔒</span>
            </div>

            <div className="w-full aspect-[3/4] rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617] border border-amber-500/40 text-white flex flex-col items-center justify-center shadow-xl p-3 relative group transition-transform active:scale-98">
              <span className="font-mono font-black text-5xl sm:text-6xl text-amber-400 drop-shadow-md">
                ?
              </span>
              <span className="absolute bottom-2 text-[9px] font-mono tracking-widest text-slate-400 font-bold uppercase">
                {lang === 'ar' ? 'مخفية عنك' : 'HIDDEN'}
              </span>
            </div>
          </div>

          {/* CENTER "VS" BADGE */}
          <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full bg-[#0F172A] border border-slate-700 text-slate-300 font-black text-xs flex items-center justify-center shadow-lg">
              <span className="font-mono tracking-tight text-[11px]">VS</span>
            </div>
          </div>

          {/* CARD 2: صورة الخصم */}
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-bold text-blue-400 mb-1.5 flex items-center gap-1 justify-center w-full">
              <span className="truncate max-w-[100px]">
                {lang === 'ar' ? `صورة ${opponentName}` : `${opponentName}'s Card`}
              </span>
              {!isOnlineMatch && (
                <button
                  type="button"
                  onClick={() => setHideOpponentCard(!hideOpponentCard)}
                  title="Privacy Shield"
                  className="p-0.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {hideOpponentCard ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="w-full aspect-[3/4] rounded-2xl bg-[#0F172A] border border-blue-500/40 flex items-center justify-center shadow-xl p-3 overflow-hidden relative group transition-transform active:scale-98">
              {hideOpponentCard ? (
                <div className="text-center p-3 text-slate-400 font-bold text-xs">
                  <EyeOff className="w-7 h-7 mx-auto mb-1 text-slate-500" />
                  <span className="text-[10px]">{lang === 'ar' ? 'محجوبة مؤقتاً' : 'Hidden'}</span>
                </div>
              ) : (
                <img
                  src={visibleOpponentCard.imageUrl}
                  alt={visibleOpponentCard.title}
                  className="w-full h-full object-contain drop-shadow-md rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. PRIMARY LATEST ANSWER BANNER (Prominent part of the active gameplay view) */}
      {latestQuestionRecord && !activeQuestionText && (
        <div className="bg-[#0F172A] border-2 border-emerald-500/40 rounded-3xl p-4 shadow-xl space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-300">
              <span className="text-base">💬</span>
              <span>
                {lang === 'ar'
                  ? `إجابة ${latestRespondentName}:`
                  : `${latestRespondentName}'s Answer:`}
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              {lang === 'ar' ? 'آخر إجابة في اللعبة' : 'Latest Answer'}
            </span>
          </div>

          {/* Outcome badge + note */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            {latestQuestionRecord.answer === 'YES' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 font-black text-base shadow-sm">
                <Check className="w-5 h-5 text-emerald-300 stroke-[3]" />
                <span>{lang === 'ar' ? '🟢 نعم (اه)' : 'YES 🟢'}</span>
                {latestQuestionRecord.isVoiceAnswer && (
                  <span className="text-[10px] bg-emerald-500/30 px-1.5 py-0.5 rounded-md font-bold text-emerald-200">
                    🎙️ بالمايك
                  </span>
                )}
              </div>
            )}
            {latestQuestionRecord.answer === 'NO' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/25 border-2 border-rose-400 text-rose-300 font-black text-base shadow-sm">
                <X className="w-5 h-5 text-rose-300 stroke-[3]" />
                <span>{lang === 'ar' ? '🔴 لا' : 'NO 🔴'}</span>
                {latestQuestionRecord.isVoiceAnswer && (
                  <span className="text-[10px] bg-rose-500/30 px-1.5 py-0.5 rounded-md font-bold text-rose-200">
                    🎙️ بالمايك
                  </span>
                )}
              </div>
            )}
            {latestQuestionRecord.answer === 'SOMETIMES' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/25 border-2 border-amber-400 text-amber-300 font-black text-base shadow-sm">
                <AlertCircle className="w-5 h-5 text-amber-300" />
                <span>{lang === 'ar' ? '🟡 أحيانًا' : 'SOMETIMES 🟡'}</span>
              </div>
            )}
            {latestQuestionRecord.answer === 'NOT_SURE' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-700/60 border-2 border-slate-500 text-slate-200 font-black text-base shadow-sm">
                <HelpCircle className="w-5 h-5 text-slate-400" />
                <span>{lang === 'ar' ? '⚪ مش متأكد' : 'NOT SURE ⚪'}</span>
              </div>
            )}

            {/* Note if present */}
            {latestQuestionRecord.note && (
              <div className="text-xs font-bold text-purple-200 bg-purple-950/60 border border-purple-500/40 px-3 py-2 rounded-2xl shadow-xs">
                «{latestQuestionRecord.note}»
              </div>
            )}
          </div>

          {/* Context: Question text */}
          <div className="text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-800">
            <span>{lang === 'ar' ? `على سؤال ${isLatestAskedByMe ? 'صورتك' : latestAskerName}: ` : `Regarding question: `}</span>
            <span className="text-white font-bold">«{latestQuestionRecord.question}»</span>
          </div>
        </div>
      )}

      {/* 5. CURRENT ACTION ZONE */}
      <div className="game-card-surface p-4 border border-slate-700/60 space-y-3">
        {/* PASS & PLAY HANDOFF INTERSTITIAL */}
        {!isOnlineMatch && !isBotMatch && passAndPlayHandoff && activeQuestionText && (
          <div className="p-4 bg-[#0F172A] border border-purple-500/40 rounded-2xl text-center space-y-3 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto text-2xl">
              <Smartphone className="w-6 h-6 text-purple-400" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                {lang === 'ar' ? 'حان وقت الإجابة!' : 'Time to Answer!'}
              </div>
              <h4 className="text-base font-black text-white">
                {lang === 'ar'
                  ? `مرر الجهاز لـ ${opponentName} ليجيب عن سؤالك!`
                  : `Hand the phone to ${opponentName} to answer!`}
              </h4>
              <p className="text-xs text-slate-300 font-medium bg-[#1E293B] p-2.5 rounded-xl border border-slate-700 shadow-inner">
                "{activeQuestionText}"
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const opponentId = viewerIsP1 ? player2.id : player1.id;
                setViewerId(opponentId);
                setPassAndPlayHandoff(false);
                sound.playTurnChime();
              }}
              className="w-full h-12 btn-premium-purple rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <span>{lang === 'ar' ? `أنا ${opponentName}، معي الهاتف وجاهز للإجابة ←` : `I am ${opponentName}, ready ←`}</span>
            </button>
          </div>
        )}

        {/* STATE 2: A QUESTION HAS BEEN SENT (ANSWERING STATE) */}
        {activeQuestionText && !passAndPlayHandoff ? (
          /* 2A: The Asker (Waiting for opponent answer) */
          isAskerOfPendingQuestion ? (
            <div className="p-5 bg-[#0F172A] border border-purple-500/40 rounded-3xl text-center space-y-3 animate-fade-in shadow-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-full text-xs font-bold">
                <span>💬</span>
                <span>{lang === 'ar' ? 'سؤالك أُرسل بنجاح:' : 'Your question was sent:'}</span>
              </div>
              <div className="text-base sm:text-lg font-black text-white bg-[#1E293B] p-3.5 rounded-2xl border border-slate-700 shadow-inner">
                «{activeQuestionText}»
              </div>
              <div className="text-xs font-black text-purple-300 animate-pulse flex items-center justify-center gap-2 pt-1">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span>{lang === 'ar' ? `في انتظار إجابة ${opponentName}...` : `Waiting for ${opponentName}'s answer...`}</span>
              </div>

              {/* Live Mic Quick Talk while waiting */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 px-1">
                <div className="text-start">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    {lang === 'ar' ? 'المايك متاح للتحدث مع خصمك 🎙️:' : 'Mic available to talk 🎙️:'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block">
                    {lang === 'ar' ? 'اضغط يفتح / اضغط يقفل' : 'Tap to open / Tap to close'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLiveMic}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer active:scale-95 shadow-sm ${
                    isLiveMicOn
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isLiveMicOn
                    ? (lang === 'ar' ? 'المايك شغال 🟢 (إيقاف)' : 'Mic ON 🟢 (Mute)')
                    : (lang === 'ar' ? 'فتح المايك 🎙️' : 'Open Mic 🎙️')}
                </button>
              </div>
            </div>
          ) : (
            /* 2B: The Receiver Player (Point 2 - Direct, bold answering card) */
            <div className="bg-[#0F172A] border-2 border-purple-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 animate-scale-up">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-xs font-black text-purple-300">
                  <span>{isVoiceActiveQuestion ? '🎙️ سؤال صوتي' : '💬 سؤال جديد'}</span>
                  <span>•</span>
                  <span>{lang === 'ar' ? `${activePlayer.name} بيسألك:` : `${activePlayer.name} asks you:`}</span>
                </div>

                <div className="text-base sm:text-xl font-black text-white bg-[#1E293B] p-4 rounded-2xl border border-slate-700 shadow-inner leading-relaxed">
                  «{activeQuestionText}»
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 mt-1">
                  <span>💡</span>
                  <span>{lang === 'ar' ? `(أنت اخترت له: ${visibleOpponentCard.title})` : `(You chose for them: ${visibleOpponentCard.title})`}</span>
                </div>
              </div>

              {/* 4 Clear High-Contrast Answer Buttons */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider text-center">
                  {lang === 'ar' ? 'اختر إجابتك على سؤاله:' : 'Choose your answer:'}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAnswer('YES');
                      sound.playYesSound();
                    }}
                    className={`h-14 rounded-2xl text-base font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                      selectedAnswer === 'YES'
                        ? 'btn-ans-yes ring-4 ring-emerald-300 scale-102'
                        : 'btn-ans-yes opacity-85 hover:opacity-100'
                    }`}
                  >
                    <Check className="w-5 h-5 stroke-[3] text-white" />
                    <span>{lang === 'ar' ? 'نعم 🟢' : 'YES 🟢'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAnswer('NO');
                      sound.playNoSound();
                    }}
                    className={`h-14 rounded-2xl text-base font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                      selectedAnswer === 'NO'
                        ? 'btn-ans-no ring-4 ring-rose-300 scale-102'
                        : 'btn-ans-no opacity-85 hover:opacity-100'
                    }`}
                  >
                    <X className="w-5 h-5 stroke-[3] text-white" />
                    <span>{lang === 'ar' ? 'لا 🔴' : 'NO 🔴'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAnswer('SOMETIMES');
                      sound.playMaybeSound();
                    }}
                    className={`h-12 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      selectedAnswer === 'SOMETIMES'
                        ? 'btn-ans-sometimes ring-3 ring-amber-300 scale-102'
                        : 'btn-ans-sometimes opacity-85 hover:opacity-100'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-slate-900" />
                    <span>{lang === 'ar' ? 'أحيانًا 🟡' : 'SOMETIMES 🟡'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAnswer('NOT_SURE');
                      sound.playMaybeSound();
                    }}
                    className={`h-12 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      selectedAnswer === 'NOT_SURE'
                        ? 'btn-ans-not-sure ring-3 ring-slate-300 scale-102'
                        : 'btn-ans-not-sure opacity-85 hover:opacity-100'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span>{lang === 'ar' ? 'مش متأكد ⚪' : 'NOT SURE ⚪'}</span>
                  </button>
                </div>
              </div>

              {/* WIN ACTION: 🏆 أيوه، كسبت! (صاحب الصورة يقرر يدويًا أن السؤال كان التخمين الصحيح) */}
              <div className="pt-2 border-t border-slate-700/80 space-y-1">
                <button
                  type="button"
                  onClick={handleDeclareWinner}
                  className="w-full h-13 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98 border-2 border-amber-300"
                >
                  <Trophy className="w-5 h-5 fill-slate-950 text-slate-950" />
                  <span>{lang === 'ar' ? '🏆 أيوه، كسبت!' : '🏆 Yes, You Won!'}</span>
                </button>
                <p className="text-[10px] text-amber-300/80 text-center font-bold">
                  {lang === 'ar'
                    ? `اضغط هنا إذا كان سؤال ${activePlayer.name} هو التخمين الصحيح لصورته!`
                    : `Tap here if ${activePlayer.name}'s question correctly guessed their picture!`}
                </p>
              </div>

              {/* Optional Note & Voice Mic Dictation */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                  <span>{lang === 'ar' ? 'ملاحظة اختيارية أو تحدث بالمايك:' : 'Optional note or speak via mic:'}</span>
                  {isVoiceAnswerUsed && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold">
                      <Mic className="w-3 h-3" />
                      {lang === 'ar' ? 'إجابة صوتية مفعلة' : 'Voice answer enabled'}
                    </span>
                  )}
                </div>

                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={answerNote}
                      onChange={(e) => setAnswerNote(e.target.value)}
                      placeholder={
                        isAnswerListening
                          ? (lang === 'ar' ? 'جاري الاستماع... تكلم الآن 🔴' : 'Listening... Speak now 🔴')
                          : (lang === 'ar' ? 'إضافة ملاحظة (مثلاً: غالبًا أيوه)...' : 'Add a note (optional)...')
                      }
                      className={`w-full h-11 bg-[#1E293B] border rounded-xl px-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all ${
                        isAnswerListening
                          ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/10'
                          : 'border-slate-700 focus:border-purple-500'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={toggleAnswerListening}
                    title={lang === 'ar' ? 'تحدث في المايك' : 'Speak via mic'}
                    className={`h-11 px-3.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-sm ${
                      isAnswerListening
                        ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                        : isVoiceAnswerUsed
                        ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                        : 'bg-[#1E293B] hover:bg-[#28384f] text-slate-300 border-slate-700'
                    }`}
                  >
                    <Mic className="w-4 h-4 text-purple-300" />
                    <span className="text-[11px]">{lang === 'ar' ? 'مايك 🎙️' : 'Mic 🎙️'}</span>
                  </button>
                </div>
              </div>

              {/* Submit Answer CTA */}
              <button
                type="button"
                disabled={!selectedAnswer}
                onClick={handleSubmitAnswer}
                className="w-full h-14 btn-premium-purple rounded-2xl font-black text-base shadow-lg transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span>{lang === 'ar' ? `إرسال الإجابة لـ ${activePlayer.name} ←` : `Send Answer to ${activePlayer.name} →`}</span>
              </button>
            </div>
          )
        ) : !activeQuestionText && !passAndPlayHandoff ? (
          /* STATE 1: ASKING STATE (NO QUESTION PENDING) */
          isMyTurnToAsk ? (
            /* 1A: ACTIVE PLAYER'S TURN TO ASK — SINGLE UNIFIED QUESTION COMPOSER */
            <div className="bg-[#0F172A] border border-blue-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 animate-scale-up">
              {/* Header: Turn announcement */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span className="text-xs sm:text-sm font-black text-white">
                  {lang === 'ar' ? `دورك يا ${viewerName} 🎯 (اطرح سؤالك عن صورتك)` : `Your turn, ${viewerName} 🎯`}
                </span>
              </div>

              {/* Segmented Mode Switch inside the composer: [ 🎙️ بالمايك ] vs [ ⌨️ كتابة السؤال ] */}
              <div className="flex bg-[#070D1E] p-1 rounded-2xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => {
                    sound.playCardFlip();
                    setComposerMode('VOICE');
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    composerMode === 'VOICE'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Mic className="w-4 h-4 text-purple-200" />
                  <span>{lang === 'ar' ? '🎙️ بالمايك' : '🎙️ By Mic'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playCardFlip();
                    setComposerMode('TEXT');
                    if (isListening && recognitionRef.current) {
                      try {
                        recognitionRef.current.stop();
                      } catch {}
                      setIsListening(false);
                    }
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    composerMode === 'TEXT'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Keyboard className="w-4 h-4 text-blue-200" />
                  <span>{lang === 'ar' ? '⌨️ كتابة السؤال' : '⌨️ Type Question'}</span>
                </button>
              </div>

              {/* The Single Unified Question Composer Box */}
              <div className="space-y-2.5">
                {composerMode === 'VOICE' ? (
                  /* VOICE MODE: Mic Button + Real-time Preview */
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`w-full py-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-md ${
                        isListening
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/40 animate-pulse'
                          : 'bg-[#1E293B] hover:bg-[#28384f] border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                        isListening ? 'bg-rose-600 scale-110 shadow-rose-600/50' : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                      }`}>
                        <Mic className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-xs font-black">
                        {isListening
                          ? (lang === 'ar' ? 'المايك شغال ومفتوح 🟢 (تكلم، واضغط هنا لقفله)' : 'Mic is OPEN 🟢 (Speak, tap to stop)')
                          : (lang === 'ar' ? 'اضغط لفتح المايك والتحدث 🎙️' : 'Tap to open mic and speak 🎙️')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {isListening
                          ? (lang === 'ar' ? '⚡ المايك مستمر في الاستماع (مش لازم تفضل ضاغط)' : '⚡ Listening continuously without holding')
                          : (lang === 'ar' ? 'اضغط يفتح / اضغط يقفل — مش لازم تفضل ضاغط عليه' : 'Tap to open / Tap to close — No need to hold')}
                      </div>
                    </button>

                    <div className="relative">
                      <input
                        type="text"
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        placeholder={
                          lang === 'ar'
                            ? 'سيظهر كلامك هنا، ويمكنك تعديله يدويًا...'
                            : 'Your spoken question will appear here...'
                        }
                        className="w-full h-12 bg-[#070D1E] border border-slate-700 focus:border-purple-500 rounded-xl px-4 text-sm text-white font-bold placeholder-slate-500 focus:outline-none shadow-inner"
                      />
                    </div>
                  </div>
                ) : (
                  /* TEXT MODE: Exact same text field */
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder={
                        lang === 'ar'
                          ? 'اكتب سؤالك عن صورتك المخفية (مثال: هل صورتي بتتاكل؟)...'
                          : 'Type your question about your card...'
                      }
                      className="w-full h-13 bg-[#070D1E] border border-slate-700 focus:border-blue-500 rounded-xl px-4 text-sm text-white font-bold placeholder-slate-500 focus:outline-none shadow-inner"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && questionInput.trim()) {
                          e.preventDefault();
                          handleAsk(questionInput, false);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Primary Send Button */}
                <button
                  type="button"
                  disabled={!questionInput.trim() && !isListening}
                  onClick={() => {
                    if (isListening && recognitionRef.current) {
                      try {
                        recognitionRef.current.stop();
                      } catch {}
                      setIsListening(false);
                    }
                    handleAsk(questionInput, composerMode === 'VOICE');
                  }}
                  className="w-full h-13 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:brightness-110 disabled:opacity-40 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 transition-all"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                  <span>{lang === 'ar' ? 'إرسال السؤال 🚀' : 'Send Question 🚀'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* 1B: WAITING OPPONENT (Clean, minimal status card with live mic talk access) */
            <div className="p-5 bg-[#0F172A] border border-slate-700/80 rounded-3xl text-center space-y-3 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto text-xl animate-pulse">
                ⏳
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-black text-white">
                  {lang === 'ar' ? `دور ${activePlayer.name} 🎯 يطرح سؤاله عن صورته...` : `${activePlayer.name}'s turn 🎯 asking about their card...`}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  {lang === 'ar' ? 'سيظهر لك سؤاله هنا فوراً لتجيب عليه.' : 'Their question will appear here for you to answer.'}
                </p>
              </div>

              {/* Live Mic Quick Talk while waiting */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 px-1">
                <div className="text-start">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    {lang === 'ar' ? 'المايك متاح للتحدث مع خصمك 🎙️:' : 'Mic available to talk 🎙️:'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block">
                    {lang === 'ar' ? 'اضغط يفتح / اضغط يقفل' : 'Tap to open / Tap to close'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLiveMic}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer active:scale-95 shadow-sm ${
                    isLiveMicOn
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isLiveMicOn
                    ? (lang === 'ar' ? 'المايك شغال 🟢 (إيقاف)' : 'Mic ON 🟢 (Mute)')
                    : (lang === 'ar' ? 'فتح المايك 🎙️' : 'Open Mic 🎙️')}
                </button>
              </div>
            </div>
          )
        ) : null}

        {/* 5. QUESTION HISTORY BOTTOM DRAWER TRIGGER & PERSPECTIVE TOGGLE */}
        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sound.playCardFlip();
              setIsHistoryOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span>
              {lang === 'ar' ? `سجل الأدلة والملاحظات (${questions.length})` : `Clues & Notes Log (${questions.length})`}
            </span>
          </button>

          {!isOnlineMatch && !isBotMatch && (
            <button
              type="button"
              onClick={() => {
                const nextId = viewerId === player1.id ? player2.id : player1.id;
                setViewerId(nextId);
                sound.playTurnChime();
              }}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              {lang === 'ar' ? `عرض الهاتف لـ ${viewerIsP1 ? player2.name : player1.name} 🔄` : 'Switch view 🔄'}
            </button>
          )}
        </div>
      </div>

      {/* 6. QUESTION HISTORY MODAL (WITH TABS FOR INDEPENDENT DEDUCTION TRACKS) */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#0F172A] rounded-t-[32px] sm:rounded-3xl p-5 border border-slate-700/80 shadow-2xl space-y-4 max-h-[82vh] flex flex-col animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-lg text-white">
                  {lang === 'ar' ? 'سجل الأدلة والاستنتاج' : 'Deduction & Clues Log'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Clear Tabs for Independent Deductions */}
            <div className="grid grid-cols-3 gap-1 bg-[#1E293B] p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setHistoryTab('MY_CLUES')}
                className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
                  historyTab === 'MY_CLUES'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? `صورتك (${myClues.length})` : `My Card (${myClues.length})`}
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab('OPPONENT_CLUES')}
                className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
                  historyTab === 'OPPONENT_CLUES'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? `صورة الخصم (${opponentClues.length})` : `Opponent (${opponentClues.length})`}
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab('ALL')}
                className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
                  historyTab === 'ALL'
                    ? 'bg-slate-700 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? `الكل (${questions.length})` : `All (${questions.length})`}
              </button>
            </div>

            {/* Clue Records List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pe-1">
              {(() => {
                const list =
                  historyTab === 'MY_CLUES'
                    ? myClues
                    : historyTab === 'OPPONENT_CLUES'
                    ? opponentClues
                    : questions;

                if (list.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-500 font-medium text-xs space-y-1">
                      <div>{lang === 'ar' ? 'لا توجد أدلة مسجلة هنا بعد.' : 'No clues recorded here yet.'}</div>
                      <div className="text-[11px] text-slate-500">
                        {lang === 'ar'
                          ? 'كل لاعب يجمع أدلته الخاصة بشكل مستقل عن الآخر!'
                          : 'Each player gathers their own independent clues!'}
                      </div>
                    </div>
                  );
                }

                return list.map((rec) => {
                  const isViewerQuestion = rec.askedByPlayerId === viewerId;
                  const respondentName = rec.answeredByPlayerId === player1.id ? player1.name : player2.name;

                  return (
                    <div
                      key={rec.id}
                      className="p-3 bg-[#1E293B] rounded-xl border border-slate-700/70 text-xs space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
                          isViewerQuestion ? 'bg-purple-600' : 'bg-blue-600'
                        }`}>
                          {isViewerQuestion
                            ? (lang === 'ar' ? 'عن صورتك 🔒' : 'Your Card')
                            : (lang === 'ar' ? `عن صورة ${opponentName} 👤` : `${opponentName}'s Card`)}
                        </span>
                        {rec.isVoice ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-purple-300 font-bold flex items-center gap-1">
                              <Mic className="w-3.5 h-3.5 text-purple-400" />
                              <span>{lang === 'ar' ? 'سؤال بالمايك لايف' : 'Live Mic Question'}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-white font-bold truncate">
                            "{rec.question}"
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-0.5 ps-2 text-[11px]">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <span>{lang === 'ar' ? `إجابة ${respondentName}:` : `Answer by ${respondentName}:`}</span>
                          {rec.isVoiceAnswer && (
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Mic className="w-2.5 h-2.5" />
                              <span>{lang === 'ar' ? 'بالمايك' : 'via Mic'}</span>
                            </span>
                          )}
                        </span>
                        {rec.answer === 'YES' && (
                          <span className="text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full font-bold">
                            {lang === 'ar' ? 'نعم 🟢' : 'YES 🟢'}
                          </span>
                        )}
                        {rec.answer === 'NO' && (
                          <span className="text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full font-bold">
                            {lang === 'ar' ? 'لا 🔴' : 'NO 🔴'}
                          </span>
                        )}
                        {rec.answer === 'SOMETIMES' && (
                          <span className="text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full font-bold">
                            {lang === 'ar' ? 'أحيانًا 🟡' : 'SOMETIMES 🟡'}
                          </span>
                        )}
                        {rec.answer === 'NOT_SURE' && (
                          <span className="text-slate-400 bg-slate-700/50 px-2.5 py-0.5 rounded-full font-medium">
                            {lang === 'ar' ? 'مش متأكد ⚪' : 'NOT SURE ⚪'}
                          </span>
                        )}
                      </div>

                      {/* Display note if provided by opponent */}
                      {rec.note && (
                        <div className="ps-2 text-[11px] text-slate-300 bg-[#0F172A] p-2 rounded-xl border border-slate-700/80 flex items-start gap-1.5 mt-1">
                          <span className="shrink-0">📝</span>
                          <span className="font-medium italic">"{rec.note}"</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="w-full py-3 btn-premium-surface text-slate-200 font-bold rounded-xl text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق السجل' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
