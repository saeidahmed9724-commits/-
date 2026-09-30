import React, { useState, useEffect } from 'react';
import { Player, PlayerChoice, QuestionRecord, CategoryDefinition, AnswerType } from '../types/game';
import { sound } from '../utils/audio';
import { isCorrectGuess } from '../utils/normalize';
import {
  Send,
  Lightbulb,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff,
  History,
  ChevronDown,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Smartphone,
  ArrowRight,
  BookOpen,
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
  onAddQuestionAndAnswer: (question: string, answer: AnswerType, note?: string) => void;
  onCorrectGuess: (winnerId: string, guess: string) => void;
  onWrongGuess: (guesserId: string, guess: string) => void;
  isBotMatch: boolean;
  isOnlineMatch?: boolean;
  onlineRole?: 'host' | 'guest';
  onOnlineAsk?: (question: string) => void;
  onOnlineAnswer?: (answer: AnswerType, question: string, note?: string) => void;
  onOnlineGuess?: (guess: string) => void;
  onOnlineResolveGuess?: (isCorrect: boolean) => void;
  pendingQuestionRemote?: string | null;
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
  onOnlineResolveGuess,
  pendingQuestionRemote,
  pendingGuessRemote,
  lang,
}) => {
  const defaultViewer = isOnlineMatch ? (onlineRole === 'host' ? player1.id : player2.id) : activePlayerId;
  const [viewerId, setViewerId] = useState<string>(defaultViewer);

  // Question drafting
  const [questionInput, setQuestionInput] = useState<string>('');
  const [pendingQuestionLocal, setPendingQuestionLocal] = useState<string | null>(null);

  // Answering controls: selected answer choice + optional note
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerType | null>(null);
  const [answerNote, setAnswerNote] = useState<string>('');

  // Pass and Play Handover Interstitial State:
  // 'NONE' | 'OPPONENT_TO_ANSWER' | 'NEXT_PLAYER_TO_ASK'
  const [passAndPlayHandoff, setPassAndPlayHandoff] = useState<'NONE' | 'OPPONENT_TO_ANSWER' | 'NEXT_PLAYER_TO_ASK'>('NONE');

  // Guess Modal State
  const [isGuessModalOpen, setIsGuessModalOpen] = useState<boolean>(false);
  const [guessInput, setGuessInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Local pending guess for Pass & Play handover
  const [pendingGuessLocal, setPendingGuessLocal] = useState<{
    guesserId: string;
    guesserName: string;
    guessText: string;
    targetCard: PlayerChoice;
  } | null>(null);

  // Question History Bottom Sheet & Tabs
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<'MY_CLUES' | 'OPPONENT_CLUES' | 'ALL'>('MY_CLUES');

  // Privacy hide toggle for opponent card when sitting side-by-side
  const [hideOpponentCard, setHideOpponentCard] = useState<boolean>(false);

  const currentPendingQuestion = isOnlineMatch ? pendingQuestionRemote : pendingQuestionLocal;

  const activePlayer = activePlayerId === player1.id ? player1 : player2;
  const opponentPlayer = activePlayerId === player1.id ? player2 : player1;

  // Is it the viewer's turn to ask or guess?
  const isMyTurn = isOnlineMatch
    ? (onlineRole === 'host' ? activePlayerId === player1.id : activePlayerId === player2.id)
    : viewerId === activePlayerId;

  const viewerIsP1 = viewerId === player1.id;
  const viewerName = viewerIsP1 ? player1.name : player2.name;
  const opponentName = viewerIsP1 ? player2.name : player1.name;
  const visibleOpponentCard = viewerIsP1 ? p2Card : p1Card;

  // Separate Deduction Tracks:
  // 1. My Clues: questions asked by viewer about viewer's own hidden picture
  const myClues = questions.filter((q) => q.askedByPlayerId === viewerId);
  const latestMyClue = myClues.length > 0 ? myClues[0] : null;

  // 2. Opponent Clues: questions asked by opponent about opponent's own hidden picture
  const opponentClues = questions.filter((q) => q.askedByPlayerId !== viewerId);
  const latestOpponentClue = opponentClues.length > 0 ? opponentClues[0] : null;

  // Bot Turn Simulation: When active player is Bot, Bot asks a question about Bot's picture
  useEffect(() => {
    if (isBotMatch && activePlayerId === player2.id && !currentPendingQuestion) {
      const timer = setTimeout(() => {
        const pool = lang === 'ar' ? category.suggestedQuestionsAr : category.suggestedQuestionsEn;
        const randomQ = pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : (lang === 'ar' ? 'هل صورتي حاجة بتتاكل؟' : 'Is my item food?');
        sound.playTurnChime();
        setPendingQuestionLocal(randomQ);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isBotMatch, activePlayerId, currentPendingQuestion, category, lang]);

  // Ask Question Handler
  const handleAsk = (qText: string) => {
    if (!qText.trim()) return;
    sound.playTurnChime();

    if (isOnlineMatch && onOnlineAsk) {
      onOnlineAsk(qText.trim());
      setQuestionInput('');
      return;
    }

    setPendingQuestionLocal(qText.trim());
    setQuestionInput('');
    setSelectedAnswer(null);
    setAnswerNote('');

    // If Pass & Play: Trigger phone handoff so opponent can answer
    if (!isOnlineMatch && !isBotMatch) {
      setPassAndPlayHandoff('OPPONENT_TO_ANSWER');
      return;
    }

    // If Bot Match & Human asked: Bot answers automatically with realistic answer + optional fun note
    if (isBotMatch && activePlayerId === player1.id) {
      setTimeout(() => {
        const target = p1Card.title.toLowerCase();
        const q = qText.toLowerCase();
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

        onAddQuestionAndAnswer(qText.trim(), botAns, botNote);
        setPendingQuestionLocal(null);
      }, 700);
    }
  };

  // Submit Answer to Question
  const handleSubmitAnswer = () => {
    if (!currentPendingQuestion || !selectedAnswer) return;

    if (selectedAnswer === 'YES') sound.playYesSound();
    else if (selectedAnswer === 'NO') sound.playNoSound();
    else sound.playMaybeSound();

    const note = answerNote.trim() || undefined;

    if (isOnlineMatch && onOnlineAnswer) {
      onOnlineAnswer(selectedAnswer, currentPendingQuestion, note);
      setSelectedAnswer(null);
      setAnswerNote('');
      return;
    }

    // Offline / Pass & Play / Bot Match:
    onAddQuestionAndAnswer(currentPendingQuestion, selectedAnswer, note);
    setPendingQuestionLocal(null);
    setSelectedAnswer(null);
    setAnswerNote('');

    // In Pass & Play: The respondent (who is holding the phone) now becomes the active player to ask!
    if (!isOnlineMatch && !isBotMatch) {
      const nextActiveId = activePlayerId === player1.id ? player2.id : player1.id;
      setViewerId(nextActiveId);
      setPassAndPlayHandoff('NONE');
    }
  };

  // Submit Guess: Player guesses their own card
  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGuess = guessInput.trim();
    if (!cleanGuess) return;

    setIsGuessModalOpen(false);

    if (isOnlineMatch && onOnlineGuess) {
      onOnlineGuess(cleanGuess);
      return;
    }

    // Bot Match: Bot verifies
    if (isBotMatch) {
      const targetCard = p1Card;
      const isCorrect = isCorrectGuess(cleanGuess, targetCard.title);
      if (isCorrect) {
        sound.playVictoryFanfare();
        onCorrectGuess(player1.id, cleanGuess);
      } else {
        sound.playWrongBuzzer();
        setToastMessage(lang === 'ar' ? `❌ البوت يقول: التخمين غير صحيح ("${cleanGuess}"). تستمر اللعبة!` : `❌ Bot says: Incorrect guess ("${cleanGuess}"). Game continues!`);
        setTimeout(() => setToastMessage(null), 3000);
        onWrongGuess(player1.id, cleanGuess);
      }
      return;
    }

    // Pass and Play: Prompt the opponent who chose the card to judge
    const targetCard = activePlayerId === player1.id ? p1Card : p2Card;
    setPendingGuessLocal({
      guesserId: activePlayerId,
      guesserName: activePlayer.name,
      guessText: cleanGuess,
      targetCard,
    });
  };

  // Resolve Guess locally in Pass & Play
  const handleResolveLocalGuess = (isCorrect: boolean) => {
    if (!pendingGuessLocal) return;

    const { guesserId, guessText, guesserName } = pendingGuessLocal;

    if (isCorrect) {
      sound.playVictoryFanfare();
      setPendingGuessLocal(null);
      onCorrectGuess(guesserId, guessText);
    } else {
      sound.playWrongBuzzer();
      setPendingGuessLocal(null);
      setToastMessage(
        lang === 'ar'
          ? `❌ التخمين غير صحيح ("${guessText}"). تستمر اللعبة وبإمكان ${guesserName} التخمين لاحقاً!`
          : `❌ Incorrect guess ("${guessText}"). Game continues!`
      );
      setTimeout(() => setToastMessage(null), 3500);
      onWrongGuess(guesserId, guessText);
      // Turn passes to opponent
      const nextId = guesserId === player1.id ? player2.id : player1.id;
      setViewerId(nextId);
    }
  };

  // Check if I am judging an online opponent's guess
  const amIOnlineJudge = isOnlineMatch && pendingGuessRemote && (
    (onlineRole === 'host' && pendingGuessRemote.guesserRole === 'guest') ||
    (onlineRole === 'guest' && pendingGuessRemote.guesserRole === 'host')
  );

  return (
    <div className="w-full max-w-md mx-auto flex flex-col space-y-3 sm:space-y-4 animate-scale-up pb-4">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-2xl text-xs font-black text-center shadow-md animate-shake">
          {toastMessage}
        </div>
      )}

      {/* 1. TOP MOBILE MATCH HEADER */}
      <div className="bg-white rounded-2xl p-3 border border-[#E8E4DA] game-card-shadow flex items-center justify-between">
        {/* P1 Score Badge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#6C5CE7] text-white flex items-center justify-center font-black text-xs shadow-xs">
            1
          </div>
          <div>
            <div className="text-xs font-black text-[#171717] truncate max-w-[65px]">{player1.name}</div>
            <div className="text-sm font-black font-mono text-[#6C5CE7] leading-none">{player1.score}</div>
          </div>
        </div>

        {/* Center Round & Category Pill */}
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 bg-[#F5F3EE] border border-[#E8E4DA] rounded-full text-[11px] font-black text-slate-700 font-mono">
            {lang === 'ar' ? `جولة ${roundNumber}` : `Round ${roundNumber}`}
          </div>
          <span className="text-[10px] font-bold text-slate-500 mt-0.5">
            {category.icon} {lang === 'ar' ? category.nameAr : category.nameEn}
          </span>
        </div>

        {/* P2 Score Badge */}
        <div className="flex items-center gap-2">
          <div className="text-end">
            <div className="text-xs font-black text-[#171717] truncate max-w-[65px]">{player2.name}</div>
            <div className="text-sm font-black font-mono text-[#FF5C8A] leading-none">{player2.score}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-[#FF5C8A] text-white flex items-center justify-center font-black text-xs shadow-xs">
            2
          </div>
        </div>
      </div>

      {/* 2. TURN CALLOUT BANNER (Clearly stating whose turn it is to ask about their card) */}
      <div
        className={`rounded-2xl p-2.5 text-center text-xs font-black flex items-center justify-center gap-2 border transition-all ${
          isMyTurn
            ? 'bg-[#4ED7B0]/15 text-[#0F6F54] border-[#4ED7B0]/40 shadow-xs'
            : 'bg-[#FFD166]/20 text-[#8C6200] border-[#FFD166]/40'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-[#4ED7B0] animate-ping' : 'bg-[#FFD166]'}`} />
        <span>
          {isMyTurn
            ? (lang === 'ar'
                ? `دورك يا ${activePlayer.name} 🎯 (اسأل عن صورتك المخفية أو خمّنها)`
                : `Your turn, ${activePlayer.name} 🎯 (Ask about your card or guess)`)
            : (lang === 'ar'
                ? `دور ${activePlayer.name} ⏳ (يسأل عن صورته المخفية)`
                : `${activePlayer.name}'s turn ⏳`)}
        </span>
      </div>

      {/* 3. HERO SECTION: THE TWO DISTINCT DEDUCTION CARDS */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E8E4DA] game-card-shadow-lg space-y-3 relative">
        <div className="grid grid-cols-2 gap-3 items-start relative">
          {/* CARD 1: صورتك المخفية (Mystery Card + My Deduction Track) */}
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-black text-[#6C5CE7] mb-1.5 flex items-center gap-1">
              <span>{lang === 'ar' ? 'صورتك المخفية' : 'YOUR CARD'}</span>
              <span className="text-[10px]">🔒</span>
            </div>

            <div className="w-full aspect-[3/4] rounded-2xl bg-gradient-to-br from-[#1E1B4B] via-[#2E1065] to-[#171717] border-2 border-white text-white flex flex-col items-center justify-center shadow-xl p-3 relative group transition-transform active:scale-98">
              <span className="font-mono font-black text-5xl sm:text-6xl text-[#FFD166] drop-shadow-md animate-pulse">
                ?
              </span>
              <span className="absolute bottom-2 text-[9px] font-mono tracking-widest text-slate-300 font-bold uppercase">
                {lang === 'ar' ? 'ممنوع تشوفها' : 'HIDDEN'}
              </span>
            </div>

            {/* Micro Deduction Track Pill for My Card */}
            <div className="mt-2 w-full p-2 bg-[#F5F3EE] rounded-xl border border-[#E8E4DA] text-[10px] space-y-0.5 text-start">
              <div className="font-black text-[#6C5CE7] flex items-center justify-between">
                <span>{lang === 'ar' ? 'مسار استنتاجك:' : 'Your deduction:'}</span>
                <span className="font-mono font-bold text-slate-500">{myClues.length} أدلة</span>
              </div>
              {latestMyClue ? (
                <div className="text-slate-700 font-bold truncate">
                  💡 "{latestMyClue.question}" ←{' '}
                  <span className="font-black text-[#0F6F54]">
                    {latestMyClue.answer === 'YES' ? 'نعم ✓' : latestMyClue.answer === 'NO' ? 'لا ✕' : latestMyClue.answer === 'SOMETIMES' ? 'أحيانًا ~' : 'مش متأكد ?'}
                  </span>
                </div>
              ) : (
                <div className="text-slate-400 font-medium italic">
                  {lang === 'ar' ? 'لم تسأل أي سؤال بعد' : 'No clues yet'}
                </div>
              )}
            </div>
          </div>

          {/* CENTER "VS" BADGE */}
          <div className="absolute top-[35%] start-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-[#171717] text-[#171717] font-black text-xs flex items-center justify-center shadow-md">
              <span className="font-mono tracking-tight text-[11px]">VS</span>
            </div>
          </div>

          {/* CARD 2: صورة الخصم (Visible Card + Opponent Deduction Track) */}
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-black text-[#FF5C8A] mb-1.5 flex items-center gap-1 justify-center w-full">
              <span className="truncate max-w-[100px]">
                {lang === 'ar' ? `صورة ${opponentName}` : `${opponentName}'s Card`}
              </span>
              {!isOnlineMatch && (
                <button
                  type="button"
                  onClick={() => setHideOpponentCard(!hideOpponentCard)}
                  title="Privacy Shield"
                  className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {hideOpponentCard ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="w-full aspect-[3/4] rounded-2xl bg-[#FFF8E7] border-2 border-[#E8E4DA] flex items-center justify-center shadow-xl p-3 overflow-hidden relative group transition-transform active:scale-98">
              {hideOpponentCard ? (
                <div className="text-center p-3 text-slate-400 font-bold text-xs">
                  <EyeOff className="w-7 h-7 mx-auto mb-1 text-slate-400" />
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

            {/* Micro Deduction Track Pill for Opponent's Card */}
            <div className="mt-2 w-full p-2 bg-[#FAF8F5] rounded-xl border border-[#E8E4DA] text-[10px] space-y-0.5 text-start">
              <div className="font-black text-[#FF5C8A] flex items-center justify-between">
                <span>{lang === 'ar' ? `استنتاج ${opponentName}:` : `${opponentName}'s deduction:`}</span>
                <span className="font-mono font-bold text-slate-500">{opponentClues.length} أسئلة</span>
              </div>
              {latestOpponentClue ? (
                <div className="text-slate-700 font-bold truncate">
                  💡 "{latestOpponentClue.question}" ←{' '}
                  <span className="font-black text-slate-900">
                    {latestOpponentClue.answer === 'YES' ? 'نعم ✓' : latestOpponentClue.answer === 'NO' ? 'لا ✕' : latestOpponentClue.answer === 'SOMETIMES' ? 'أحيانًا ~' : 'مش متأكد ?'}
                  </span>
                </div>
              ) : (
                <div className="text-slate-400 font-medium italic">
                  {lang === 'ar' ? 'لم يسأل خصمك بعد' : 'No clues yet'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. TURN ACTION ZONE (BOTTOM FOR 1-HAND MOBILE USABILITY) */}
      <div className="bg-white rounded-3xl p-4 border border-[#E8E4DA] game-card-shadow space-y-3">
        {/* PASS & PLAY HANDOFF INTERSTITIAL (Hand phone to opponent to answer) */}
        {!isOnlineMatch && !isBotMatch && passAndPlayHandoff === 'OPPONENT_TO_ANSWER' && currentPendingQuestion && (
          <div className="p-4 bg-[#FFF8E7] border-2 border-[#171717] rounded-2xl text-center space-y-3 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-[#6C5CE7]/15 text-[#6C5CE7] flex items-center justify-center mx-auto text-2xl">
              <Smartphone className="w-6 h-6 text-[#6C5CE7]" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-black text-[#6C5CE7] uppercase">
                {lang === 'ar' ? 'حان وقت الإجابة!' : 'Time to Answer!'}
              </div>
              <h4 className="text-base font-black text-[#171717]">
                {lang === 'ar'
                  ? `اعطِ الهاتف لـ ${opponentName} ليجيب عن سؤالك!`
                  : `Hand the phone to ${opponentName} to answer!`}
              </h4>
              <p className="text-xs text-slate-500 font-bold">
                {lang === 'ar'
                  ? `${viewerName} سأل سؤالاً عن صورته المخفية. ${opponentName} هو من يعرف الإجابة.`
                  : `${viewerName} asked a question about their card.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const opponentId = viewerIsP1 ? player2.id : player1.id;
                setViewerId(opponentId);
                setPassAndPlayHandoff('NONE');
                sound.playTurnChime();
              }}
              className="w-full h-12 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-xl text-sm shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <span>{lang === 'ar' ? `أنا ${opponentName}، معي الهاتف وجاهز للإجابة ←` : `I am ${opponentName}, ready ←`}</span>
            </button>
          </div>
        )}

        {/* CASE A: PENDING QUESTION (Opponent must answer) */}
        {currentPendingQuestion && passAndPlayHandoff === 'NONE' ? (
          <div className="p-3.5 bg-[#FFF8E7] border-2 border-[#171717] rounded-2xl space-y-3 animate-fade-in">
            {/* If I am the one who asked and waiting for opponent in online mode */}
            {isOnlineMatch && isMyTurn ? (
              <div className="text-center py-4 space-y-2">
                <div className="text-sm font-black text-[#171717]">
                  "{currentPendingQuestion}"
                </div>
                <div className="text-xs font-black text-[#6C5CE7] animate-pulse">
                  ⏳ {lang === 'ar' ? `في انتظار إجابة ${opponentName} عن صورتك...` : `Waiting for ${opponentName}'s answer...`}
                </div>
              </div>
            ) : (
              /* Answering Controls for Opponent */
              <>
                <div className="text-xs font-black text-[#171717] flex items-center justify-between">
                  <span>
                    {lang === 'ar'
                      ? `سؤال من ${activePlayer.name} عن صورته المخفية:`
                      : `Question from ${activePlayer.name} about their card:`}
                  </span>
                  <span className="text-[#6C5CE7] font-black text-[11px] bg-white px-2 py-0.5 rounded-full border border-[#E8E4DA]">
                    {lang === 'ar' ? `أجب يا ${opponentName}` : `${opponentName} answers`}
                  </span>
                </div>

                <div className="text-base font-black text-[#171717] bg-white p-3 rounded-xl border border-[#E8E4DA] text-center shadow-2xs">
                  "{currentPendingQuestion}"
                </div>

                {/* Reminder of Secret Card chosen for the asker */}
                <div className="flex items-center justify-center gap-2 p-1.5 bg-amber-100/60 rounded-xl text-[11px] font-bold text-amber-900 border border-amber-200">
                  <span className="shrink-0">💡</span>
                  <span>
                    {lang === 'ar'
                      ? `أنت اخترت لـ ${activePlayer.name}: (${visibleOpponentCard.title})`
                      : `You picked for them: (${visibleOpponentCard.title})`}
                  </span>
                </div>

                {/* 4 High-contrast answer buttons with clear selected state */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('YES')}
                    className={`h-12 rounded-xl text-sm font-black border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      selectedAnswer === 'YES'
                        ? 'bg-[#4ED7B0] text-[#171717] border-[#171717] ring-3 ring-[#4ED7B0]/50 shadow-md'
                        : 'bg-white text-[#171717] border-[#E8E4DA] hover:border-[#4ED7B0]'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3] text-[#0F6F54]" />
                    <span>{lang === 'ar' ? 'نعم 🟢' : 'YES 🟢'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('NO')}
                    className={`h-12 rounded-xl text-sm font-black border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      selectedAnswer === 'NO'
                        ? 'bg-[#FF5C8A] text-white border-[#171717] ring-3 ring-[#FF5C8A]/50 shadow-md'
                        : 'bg-white text-[#171717] border-[#E8E4DA] hover:border-[#FF5C8A]'
                    }`}
                  >
                    <X className="w-4 h-4 stroke-[3] text-rose-600" />
                    <span>{lang === 'ar' ? 'لا 🔴' : 'NO 🔴'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('SOMETIMES')}
                    className={`h-12 rounded-xl text-sm font-black border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      selectedAnswer === 'SOMETIMES'
                        ? 'bg-[#FFD166] text-[#171717] border-[#171717] ring-3 ring-[#FFD166]/50 shadow-md'
                        : 'bg-white text-[#171717] border-[#E8E4DA] hover:border-[#FFD166]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>{lang === 'ar' ? 'أحيانًا 🟡' : 'SOMETIMES 🟡'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('NOT_SURE')}
                    className={`h-12 rounded-xl text-sm font-black border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                      selectedAnswer === 'NOT_SURE'
                        ? 'bg-slate-200 text-[#171717] border-[#171717] ring-3 ring-slate-300 shadow-md'
                        : 'bg-white text-slate-700 border-[#E8E4DA] hover:border-slate-400'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    <span>{lang === 'ar' ? 'مش متأكد ⚪' : 'NOT SURE ⚪'}</span>
                  </button>
                </div>

                {/* Optional Note Input */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-black text-slate-600 flex items-center gap-1">
                    <span>📝</span>
                    <span>{lang === 'ar' ? 'إضافة ملاحظة — اختياري' : 'Add a note — optional'}</span>
                  </label>
                  <input
                    type="text"
                    value={answerNote}
                    onChange={(e) => setAnswerNote(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثلاً: "بس مش كل الناس بتحبها سخنة"...' : 'e.g. "Only when fresh"...'}
                    className="w-full bg-white border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* Submit Answer CTA */}
                <button
                  type="button"
                  disabled={!selectedAnswer}
                  onClick={handleSubmitAnswer}
                  className="w-full h-12 bg-[#6C5CE7] hover:bg-[#5b4bc4] disabled:opacity-40 text-white font-black rounded-xl text-sm shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>{lang === 'ar' ? `إرسال الإجابة لـ ${activePlayer.name} ←` : `Send Answer to ${activePlayer.name} →`}</span>
                </button>
              </>
            )}
          </div>
        ) : passAndPlayHandoff === 'NONE' ? (
          /* CASE B: ACTIVE PLAYER'S TURN TO ASK OR GUESS */
          isMyTurn ? (
            <div className="space-y-3">
              {/* Primary Action Buttons (Thumb Reachable) */}
              <div className="flex flex-col gap-2.5">
                {/* BIG GOLD GUESS BUTTON: "أنا عرفت! 🎯" */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playTurnChime();
                    setGuessInput('');
                    setIsGuessModalOpen(true);
                  }}
                  className="w-full h-14 bg-[#FFD166] hover:bg-[#f5c754] text-[#171717] font-black rounded-2xl border-2 border-[#171717] text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                >
                  <Lightbulb className="w-5 h-5 fill-[#171717] text-[#171717]" />
                  <span className="text-lg">{lang === 'ar' ? 'أنا عرفت صورتي! 🎯' : 'I Know My Picture! 🎯'}</span>
                </button>

                {/* QUESTION INPUT + ASK BUTTON */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAsk(questionInput);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسأل عن صورتك (مثال: هل صورتي بتتاكل؟)...' : 'Ask about your card...'}
                    className="flex-1 bg-[#FAF8F5] border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-2xl px-4 py-3.5 text-sm text-[#171717] font-bold placeholder-slate-400 focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={!questionInput.trim()}
                    className="h-12 px-5 bg-[#6C5CE7] hover:bg-[#5b4bc4] disabled:opacity-40 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-1.5 shadow-md shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    <span>{lang === 'ar' ? 'إرسال' : 'Ask'}</span>
                    <Send className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </form>
              </div>

              {/* Quick Question Suggestions Pills */}
              {category.suggestedQuestionsAr.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FFD166]" />
                    <span>{lang === 'ar' ? 'اقتراحات سريعة لأسئلة صورتك:' : 'Suggestions for your card:'}</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(lang === 'ar' ? category.suggestedQuestionsAr : category.suggestedQuestionsEn).map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAsk(q)}
                        className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FFD166] text-[#171717] text-xs font-bold rounded-full border border-[#E8E4DA] hover:border-[#171717] whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Opponent's turn to ask: Waiting banner */
            <div className="p-4 bg-slate-50 border border-[#E8E4DA] rounded-2xl text-center space-y-2">
              <div className="text-xs font-black text-slate-500">
                ⏳ {lang === 'ar' ? `دور ${activePlayer.name} الآن ليطرح سؤالاً عن صورته المخفية...` : `${activePlayer.name} is thinking of a question...`}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {lang === 'ar'
                  ? 'بمجرد أن يسأل سؤاله، سيظهر لك لتجيب عنه من خلال صورتك التي اخترتها له.'
                  : 'Once they ask, you will answer based on their secret card.'}
              </p>
            </div>
          )
        ) : null}

        {/* 5. QUESTION HISTORY BOTTOM DRAWER TRIGGER & PERSPECTIVE TOGGLE */}
        <div className="pt-2 border-t border-[#E8E4DA] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sound.playCardFlip();
              setIsHistoryOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700 hover:text-[#171717] cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#6C5CE7]" />
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
              className="text-[11px] font-bold text-[#6C5CE7] hover:underline cursor-pointer"
            >
              {lang === 'ar' ? `عرض الهاتف لـ ${viewerIsP1 ? player2.name : player1.name} 🔄` : 'Switch view 🔄'}
            </button>
          )}
        </div>
      </div>

      {/* 6. QUESTION HISTORY MODAL (WITH TABS FOR INDEPENDENT DEDUCTION TRACKS) */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-2xs p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl p-5 border-2 border-[#171717] shadow-2xl space-y-4 max-h-[82vh] flex flex-col animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#6C5CE7]" />
                <h3 className="font-black text-lg text-[#171717]">
                  {lang === 'ar' ? 'سجل الأدلة والاستنتاج' : 'Deduction & Clues Log'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Clear Tabs for Independent Deductions */}
            <div className="grid grid-cols-3 gap-1 bg-[#F5F3EE] p-1 rounded-xl text-xs font-black">
              <button
                type="button"
                onClick={() => setHistoryTab('MY_CLUES')}
                className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
                  historyTab === 'MY_CLUES'
                    ? 'bg-white text-[#6C5CE7] shadow-xs'
                    : 'text-slate-600 hover:text-[#171717]'
                }`}
              >
                {lang === 'ar' ? `صورتك (${myClues.length})` : `My Card (${myClues.length})`}
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab('OPPONENT_CLUES')}
                className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
                  historyTab === 'OPPONENT_CLUES'
                    ? 'bg-white text-[#FF5C8A] shadow-xs'
                    : 'text-slate-600 hover:text-[#171717]'
                }`}
              >
                {lang === 'ar' ? `صورة الخصم (${opponentClues.length})` : `Opponent (${opponentClues.length})`}
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab('ALL')}
                className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
                  historyTab === 'ALL'
                    ? 'bg-white text-[#171717] shadow-xs'
                    : 'text-slate-600 hover:text-[#171717]'
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
                    <div className="text-center py-10 text-slate-400 font-bold text-xs space-y-1">
                      <div>{lang === 'ar' ? 'لا توجد أدلة مسجلة هنا بعد.' : 'No clues recorded here yet.'}</div>
                      <div className="text-[11px] text-slate-400">
                        {lang === 'ar'
                          ? 'كل لاعب يجمع أدلته الخاصة بشكل مستقل عن الآخر!'
                          : 'Each player gathers their own independent clues!'}
                      </div>
                    </div>
                  );
                }

                return list.map((rec) => {
                  const isViewerQuestion = rec.askedByPlayerId === viewerId;
                  const askerName = rec.askedByPlayerId === player1.id ? player1.name : player2.name;
                  const respondentName = rec.answeredByPlayerId === player1.id ? player1.name : player2.name;

                  return (
                    <div
                      key={rec.id}
                      className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E8E4DA] text-xs space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 font-black">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
                          isViewerQuestion ? 'bg-[#6C5CE7]' : 'bg-[#FF5C8A]'
                        }`}>
                          {isViewerQuestion
                            ? (lang === 'ar' ? 'عن صورتك 🔒' : 'Your Card')
                            : (lang === 'ar' ? `عن صورة ${opponentName} 👤` : `${opponentName}'s Card`)}
                        </span>
                        <span className="text-[#171717] font-black truncate">
                          "{rec.question}"
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5 ps-2 text-[11px]">
                        <span className="text-slate-500 font-bold">
                          {lang === 'ar' ? `إجابة ${respondentName}:` : `Answer by ${respondentName}:`}
                        </span>
                        {rec.answer === 'YES' && (
                          <span className="text-[#0F6F54] bg-[#4ED7B0]/20 px-2.5 py-0.5 rounded-full font-black">
                            {lang === 'ar' ? 'نعم 🟢' : 'YES 🟢'}
                          </span>
                        )}
                        {rec.answer === 'NO' && (
                          <span className="text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full font-black">
                            {lang === 'ar' ? 'لا 🔴' : 'NO 🔴'}
                          </span>
                        )}
                        {rec.answer === 'SOMETIMES' && (
                          <span className="text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-black">
                            {lang === 'ar' ? 'أحيانًا 🟡' : 'SOMETIMES 🟡'}
                          </span>
                        )}
                        {rec.answer === 'NOT_SURE' && (
                          <span className="text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-bold">
                            {lang === 'ar' ? 'مش متأكد ⚪' : 'NOT SURE ⚪'}
                          </span>
                        )}
                      </div>

                      {/* Display note if provided by opponent */}
                      {rec.note && (
                        <div className="ps-2 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-[#E8E4DA] flex items-start gap-1.5 mt-1">
                          <span className="shrink-0">📝</span>
                          <span className="font-bold italic">"{rec.note}"</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-3 border-t border-[#E8E4DA]">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="w-full py-3 bg-[#171717] text-white font-black rounded-xl text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق السجل' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. "أنا عرفت!" GUESS SUBMISSION MODAL */}
      {isGuessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl p-6 border-2 border-[#171717] shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <h3 className="font-black text-xl text-[#171717]">
                  {lang === 'ar' ? 'أنا عرفت صورتي!' : 'I Know My Picture!'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGuessModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-bold">
              {lang === 'ar'
                ? `اكتب تخمينك لعنصرك السري من تصنيف (${category.nameAr}). خصمك الذي اختار لك الصورة هو من سيحكم على التخمين!`
                : `Enter your guess for your secret (${category.nameEn}). Your opponent will verify!`}
            </p>

            <form onSubmit={handleSubmitGuess} className="space-y-4 pt-1">
              <div>
                <input
                  type="text"
                  autoFocus
                  required
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'تخميني هو: بيتزا 🍕...' : 'My guess is: Pizza...'}
                  className="w-full h-14 bg-[#FAF8F5] border-2 border-[#171717] focus:border-[#6C5CE7] rounded-2xl px-4 text-base font-black text-[#171717] focus:outline-none text-center"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsGuessModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-sm cursor-pointer transition-colors"
                >
                  {lang === 'ar' ? 'تراجع' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={!guessInput.trim()}
                  className="flex-2 py-3.5 bg-[#FFD166] hover:bg-[#f5c754] text-[#171717] font-black rounded-xl border-2 border-[#171717] text-base shadow-md cursor-pointer transition-all active:scale-95"
                >
                  {lang === 'ar' ? 'إرسال التخمين 🚀' : 'Submit Guess 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. PASS & PLAY: OPPONENT JUDGMENT MODAL (Manual Confirmation by Opponent) */}
      {pendingGuessLocal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 border-3 border-[#171717] shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD166]/30 text-2xl flex items-center justify-center mx-auto">
              ⚖️
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-black text-[#6C5CE7] uppercase tracking-wider">
                {lang === 'ar' ? 'دور الخصم للتحكيم' : 'Opponent Verification'}
              </span>
              <h3 className="font-black text-xl text-[#171717]">
                {lang === 'ar'
                  ? `هل ${pendingGuessLocal.guesserName} خمن الصورة بشكل صحيح؟`
                  : `Did ${pendingGuessLocal.guesserName} guess correctly?`}
              </h3>
            </div>

            {/* The Guess Submitted */}
            <div className="p-3.5 bg-[#FAF8F5] border-2 border-[#171717] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400">
                {lang === 'ar' ? 'تخمين اللاعب:' : "Player's guess:"}
              </span>
              <div className="text-xl font-black text-[#171717] tracking-tight">
                "{pendingGuessLocal.guessText}"
              </div>
            </div>

            {/* Secret Picture Reminder for Opponent */}
            <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 border border-[#E8E4DA] rounded-xl text-xs font-bold text-slate-600">
              <img
                src={pendingGuessLocal.targetCard.imageUrl}
                alt={pendingGuessLocal.targetCard.title}
                className="w-7 h-7 object-contain rounded-md"
              />
              <span>
                {lang === 'ar'
                  ? `الصورة التي اخترتها له: ${pendingGuessLocal.targetCard.title}`
                  : `You picked for them: ${pendingGuessLocal.targetCard.title}`}
              </span>
            </div>

            {/* The 2 Judgment Decision Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleResolveLocalGuess(true)}
                className="w-full h-14 bg-[#4ED7B0] hover:bg-[#3ec49e] text-[#171717] font-black rounded-2xl border-2 border-[#171717] text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-5 h-5 fill-[#171717]" />
                <span>{lang === 'ar' ? 'صح، دي الصورة 🟢' : "Correct, that's it! 🟢"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleResolveLocalGuess(false)}
                className="w-full h-12 bg-white hover:bg-rose-50 text-rose-700 font-black rounded-2xl border-2 border-rose-300 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <ThumbsDown className="w-4 h-4" />
                <span>{lang === 'ar' ? 'لا، تخمين غلط 🔴' : 'No, incorrect 🔴'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-bold">
              {lang === 'ar' ? 'لا توجد خسارة إذا كان التخمين غلط، وتستمر اللعبة بالتبادل!' : 'No penalty for incorrect guess, game continues!'}
            </p>
          </div>
        </div>
      )}

      {/* 9. ONLINE: OPPONENT JUDGMENT MODAL */}
      {amIOnlineJudge && pendingGuessRemote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 border-3 border-[#171717] shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD166]/30 text-2xl flex items-center justify-center mx-auto">
              ⚖️
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-black text-[#6C5CE7] uppercase tracking-wider">
                {lang === 'ar' ? 'أنت الحكم الآن!' : 'You are the judge!'}
              </span>
              <h3 className="font-black text-xl text-[#171717]">
                {lang === 'ar'
                  ? `هل ${pendingGuessRemote.guesserName} خمن الصورة بشكل صحيح؟`
                  : `Did ${pendingGuessRemote.guesserName} guess correctly?`}
              </h3>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] border-2 border-[#171717] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400">
                {lang === 'ar' ? 'تخمينه هو:' : "Their guess:"}
              </span>
              <div className="text-xl font-black text-[#171717] tracking-tight">
                "{pendingGuessRemote.guessText}"
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onOnlineResolveGuess) onOnlineResolveGuess(true);
                }}
                className="w-full h-14 bg-[#4ED7B0] hover:bg-[#3ec49e] text-[#171717] font-black rounded-2xl border-2 border-[#171717] text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-5 h-5 fill-[#171717]" />
                <span>{lang === 'ar' ? 'صح، دي الصورة 🟢' : "Correct! 🟢"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOnlineResolveGuess) onOnlineResolveGuess(false);
                }}
                className="w-full h-12 bg-white hover:bg-rose-50 text-rose-700 font-black rounded-2xl border-2 border-rose-300 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <ThumbsDown className="w-4 h-4" />
                <span>{lang === 'ar' ? 'لا، تخمين غلط 🔴' : 'No, wrong guess 🔴'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONLINE: WAITING FOR OPPONENT JUDGMENT BANNER */}
      {isOnlineMatch && pendingGuessRemote && !amIOnlineJudge && (
        <div className="p-3 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-2xl text-xs font-black text-center shadow-md animate-pulse">
          ⏳ {lang === 'ar' ? 'في انتظار قرار الخصم للتأكيد على التخمين...' : 'Waiting for opponent to verify your guess...'}
        </div>
      )}
    </div>
  );
};
