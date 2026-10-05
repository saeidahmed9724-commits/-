import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerChoice, QuestionRecord, CategoryDefinition, AnswerType, PendingQuestionData } from '../types/game';
import { sound } from '../utils/audio';
import { isCorrectGuess } from '../utils/normalize';
import { VoiceChatBar, useJoinVoice } from './VoiceChatBar';
import { HiddenCard } from './HiddenCard';
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

  // Voice chat (Online rooms only): the same engine as 3/4-player rooms, separate from the game.
  const myVoiceId = onlineRole === 'host' ? 'host' : 'guest';
  const otherVoiceId = onlineRole === 'host' ? 'guest' : 'host';
  useJoinVoice(isOnlineMatch && onlineRole ? myVoiceId : null, [otherVoiceId]);

  // Is it my turn to ask right now? (Only when no question is pending!)
  const isMyTurnToAsk = isOnlineMatch
    ? (onlineRole === 'host' ? activePlayerId === player1.id : activePlayerId === player2.id) && !pendingQuestionRemote
    : viewerId === activePlayerId && !pendingQuestionLocal;

  // When a question arrives for ME to answer, bring the answer panel into view (the duel stage is tall on phones).
  const actionZoneRef = useRef<HTMLDivElement | null>(null);
  const pendingForMeKey = activeQuestionText && isReceiverOfPendingQuestion ? activeQuestionText : '';
  useEffect(() => {
    if (!pendingForMeKey) return;
    const t = window.setTimeout(() => {
      actionZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(t);
  }, [pendingForMeKey]);

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
          : (lang === 'ar' ? 'هل هو كائن حي؟' : 'Is it a living thing?');
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

  // Ask Question Handler (text only)
  const handleAsk = (qText: string) => {
    const textToSend = qText.trim();
    if (!textToSend || !isMyTurnToAsk) return;
    sound.playTurnChime();
    const isVoice = false;

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

    const wasVoice = false;

    if (isOnlineMatch && onOnlineAnswer) {
      onOnlineAnswer(selectedAnswer, activeQuestionText, note, wasVoice);
      setSelectedAnswer(null);
      setAnswerNote('');
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

      {/* 1. MATCH BAR: round + category */}
      <div className="flex items-center justify-between px-1">
        <div className="px-3 py-1 bg-[#0F172A] border border-slate-700/80 rounded-full text-[11px] font-bold text-slate-300 font-mono">
          {lang === 'ar' ? `جولة ${roundNumber}` : `Round ${roundNumber}`}
        </div>
        {category?.icon && (
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <span>{category.icon}</span>
            <span>{lang === 'ar' ? category.nameAr : category.nameEn}</span>
          </div>
        )}
      </div>

      {/* 2. THE DUEL STAGE: you (hidden card) VS your opponent (visible card), scores under the names */}
      <div data-testid="duel-stage" className="relative rounded-3xl border border-slate-700/60 bg-gradient-to-b from-[#121B36] to-[#0A1124] p-3 sm:p-4 shadow-xl">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* YOU */}
          <div className="flex flex-col items-center gap-2 min-w-0">
            <div className="w-full flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <div className="text-xs font-black text-white truncate">{viewerName}</div>
                <div className="text-[10px] font-bold text-blue-300">{lang === 'ar' ? 'أنت' : 'You'}</div>
              </div>
              <div data-testid="score-me" className="shrink-0 min-w-9 h-9 px-2 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black font-mono text-base shadow">
                {viewerIsP1 ? player1.score : player2.score}
              </div>
            </div>

            <HiddenCard
              label={lang === 'ar' ? 'صورتك المخفية' : 'Your hidden picture'}
              active={viewerId === activePlayerId}
            />

            <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              <span>{lang === 'ar' ? 'صورتك المخفية' : 'YOUR HIDDEN CARD'}</span>
              <span className="text-[10px]">🔒</span>
            </div>
          </div>

          {/* OPPONENT */}
          <div className="flex flex-col items-center gap-2 min-w-0">
            <div className="w-full flex items-center justify-between gap-2 px-1">
              <div data-testid="score-foe" className="shrink-0 min-w-9 h-9 px-2 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black font-mono text-base shadow">
                {viewerIsP1 ? player2.score : player1.score}
              </div>
              <div className="min-w-0 text-end">
                <div className="text-xs font-black text-white truncate">{opponentName}</div>
                <div className="text-[10px] font-bold text-purple-300">{lang === 'ar' ? 'الخصم' : 'Opponent'}</div>
              </div>
            </div>

            <div
              className={`relative w-full aspect-[2/3] rounded-[22px] p-[3px] bg-gradient-to-br from-blue-500 via-purple-500 to-orange-400 transition-all duration-300 ${
                viewerId !== activePlayerId
                  ? 'ring-4 ring-amber-300/80 shadow-[0_0_30px_rgba(251,191,36,0.45)] scale-[1.02]'
                  : 'shadow-[0_0_22px_rgba(139,92,246,0.35)]'
              }`}
            >
              <div className="w-full h-full rounded-[19px] bg-[#0F172A] flex items-center justify-center p-2 overflow-hidden">
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

            <div className="text-[11px] font-bold text-blue-300 flex items-center gap-1 max-w-full">
              <span className="truncate">{lang === 'ar' ? `صورة ${opponentName}` : `${opponentName}'s card`}</span>
              {!isOnlineMatch && (
                <button
                  type="button"
                  onClick={() => setHideOpponentCard(!hideOpponentCard)}
                  title="Privacy Shield"
                  className="p-0.5 text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
                >
                  {hideOpponentCard ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* VS badge between the two cards */}
        <div className="absolute top-1/2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-[#0F172A] border-2 border-amber-400/70 text-amber-300 font-black flex items-center justify-center shadow-lg shadow-black/50">
            <span className="font-mono tracking-tight text-[12px]">VS</span>
          </div>
        </div>
      </div>

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

      {/* 1B. ONLINE VOICE CHAT BAR — the only microphone in the game. Independent from turns. */}
      {isOnlineMatch && onlineRole && (
        <VoiceChatBar
          lang={lang}
          selfId={myVoiceId}
          selfName={viewerName}
          players={[
            { id: myVoiceId, name: viewerName },
            { id: otherVoiceId, name: opponentName },
          ]}
        />
      )}

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
      <div ref={actionZoneRef} className="game-card-surface p-4 border border-slate-700/60 space-y-3 scroll-mt-3">
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

              {/* Optional Note */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-400 px-1">
                  {lang === 'ar' ? 'ملاحظة اختيارية:' : 'Optional note:'}
                </div>
                <input
                  type="text"
                  value={answerNote}
                  onChange={(e) => setAnswerNote(e.target.value)}
                  placeholder={lang === 'ar' ? 'إضافة ملاحظة (مثلاً: غالبًا أيوه)...' : 'Add a note (optional)...'}
                  className="w-full h-11 bg-[#1E293B] border border-slate-700 focus:border-purple-500 rounded-xl px-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all"
                />
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

              {/* Question input (text only) */}
              <div className="space-y-2.5">
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
                        handleAsk(questionInput);
                      }
                    }}
                  />
                </div>

                {/* Primary Send Button */}
                <button
                  type="button"
                  disabled={!questionInput.trim()}
                  onClick={() => handleAsk(questionInput)}
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
