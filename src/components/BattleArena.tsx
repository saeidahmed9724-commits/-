import React, { useState, useEffect } from 'react';
import { Player, PlayerChoice, QuestionRecord, CategoryDefinition, AnswerType, PendingQuestionData } from '../types/game';
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
  ChevronDown,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Smartphone,
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
  // { id, question, askedById, answeredById }
  const [pendingQuestionLocal, setPendingQuestionLocal] = useState<{
    id: string;
    question: string;
    askedById: string;
    answeredById: string;
  } | null>(null);

  // Answering controls: selected answer choice + optional note
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerType | null>(null);
  const [answerNote, setAnswerNote] = useState<string>('');

  // Pass and Play Handover Interstitial
  const [passAndPlayHandoff, setPassAndPlayHandoff] = useState<boolean>(false);

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

  // Determine current active question
  const activeQuestionText = isOnlineMatch
    ? pendingQuestionRemote?.question || null
    : pendingQuestionLocal?.question || null;

  const isAskerOfPendingQuestion = isOnlineMatch
    ? pendingQuestionRemote?.askedByRole === onlineRole
    : pendingQuestionLocal?.askedById === viewerId;

  const isReceiverOfPendingQuestion = isOnlineMatch
    ? pendingQuestionRemote?.answeredByRole === onlineRole
    : pendingQuestionLocal?.answeredById === viewerId;

  const activePlayer = activePlayerId === player1.id ? player1 : player2;
  const opponentPlayer = activePlayerId === player1.id ? player2 : player1;

  // Is it my turn to ask right now? (Only when no question is pending!)
  const isMyTurnToAsk = isOnlineMatch
    ? (onlineRole === 'host' ? activePlayerId === player1.id : activePlayerId === player2.id) && !pendingQuestionRemote
    : viewerId === activePlayerId && !pendingQuestionLocal;

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

  // Ask Question Handler (Strictly only callable by the active player whose turn it is)
  const handleAsk = (qText: string) => {
    if (!qText.trim() || !isMyTurnToAsk) return;
    sound.playTurnChime();

    if (isOnlineMatch && onOnlineAsk) {
      onOnlineAsk(qText.trim());
      setQuestionInput('');
      return;
    }

    const respondentId = activePlayerId === player1.id ? player2.id : player1.id;
    setPendingQuestionLocal({
      id: 'q-' + Date.now(),
      question: qText.trim(),
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

    if (isOnlineMatch && onOnlineAnswer) {
      onOnlineAnswer(selectedAnswer, activeQuestionText, note);
      setSelectedAnswer(null);
      setAnswerNote('');
      return;
    }

    // Offline / Pass & Play / Bot Match:
    onAddQuestionAndAnswer(activeQuestionText, selectedAnswer, note);
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

  // Submit Guess: Player guesses their own card
  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGuess = guessInput.trim();
    if (!cleanGuess || !isMyTurnToAsk) return;

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
      <div className="game-card-surface p-3 border border-slate-700/60 flex items-center justify-between">
        {/* P1 Score Badge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
            1
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 truncate max-w-[65px]">{player1.name}</div>
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

        {/* P2 Score Badge */}
        <div className="flex items-center gap-2">
          <div className="text-end">
            <div className="text-xs font-bold text-slate-200 truncate max-w-[65px]">{player2.name}</div>
            <div className="text-sm font-black font-mono text-purple-400 leading-none">{player2.score}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
            2
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

      {/* 3. HERO SECTION: THE TWO DISTINCT DEDUCTION CARDS */}
      <div className="game-card-surface p-4 sm:p-5 border border-slate-700/60 space-y-3 relative">
        <div className="grid grid-cols-2 gap-3 items-start relative">
          {/* CARD 1: صورتك المخفية (Mystery Card + My Deduction Track) */}
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

            {/* Micro Deduction Track Pill for My Card */}
            <div className="mt-2 w-full p-2 bg-[#0F172A] rounded-xl border border-slate-700/80 text-[10px] space-y-0.5 text-start">
              <div className="font-bold text-amber-400 flex items-center justify-between">
                <span>{lang === 'ar' ? 'مسار استنتاجك:' : 'Your clues:'}</span>
                <span className="font-mono font-bold text-slate-400">{myClues.length} أدلة</span>
              </div>
              {latestMyClue ? (
                <div className="text-slate-300 font-medium truncate">
                  💡 "{latestMyClue.question}" ←{' '}
                  <span className="font-bold text-emerald-400">
                    {latestMyClue.answer === 'YES' ? 'نعم ✓' : latestMyClue.answer === 'NO' ? 'لا ✕' : latestMyClue.answer === 'SOMETIMES' ? 'أحيانًا ~' : 'مش متأكد ?'}
                  </span>
                </div>
              ) : (
                <div className="text-slate-500 font-medium italic">
                  {lang === 'ar' ? 'لم تسأل أي سؤال بعد' : 'No clues yet'}
                </div>
              )}
            </div>
          </div>

          {/* CENTER "VS" BADGE */}
          <div className="absolute top-[35%] start-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full bg-[#0F172A] border border-slate-700 text-slate-300 font-black text-xs flex items-center justify-center shadow-lg">
              <span className="font-mono tracking-tight text-[11px]">VS</span>
            </div>
          </div>

          {/* CARD 2: صورة الخصم (Visible Card + Opponent Deduction Track) */}
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

            {/* Micro Deduction Track Pill for Opponent's Card */}
            <div className="mt-2 w-full p-2 bg-[#0F172A] rounded-xl border border-slate-700/80 text-[10px] space-y-0.5 text-start">
              <div className="font-bold text-blue-400 flex items-center justify-between">
                <span>{lang === 'ar' ? `استنتاج ${opponentName}:` : `${opponentName}'s clues:`}</span>
                <span className="font-mono font-bold text-slate-400">{opponentClues.length} أسئلة</span>
              </div>
              {latestOpponentClue ? (
                <div className="text-slate-300 font-medium truncate">
                  💡 "{latestOpponentClue.question}" ←{' '}
                  <span className="font-bold text-slate-200">
                    {latestOpponentClue.answer === 'YES' ? 'نعم ✓' : latestOpponentClue.answer === 'NO' ? 'لا ✕' : latestOpponentClue.answer === 'SOMETIMES' ? 'أحيانًا ~' : 'مش متأكد ?'}
                  </span>
                </div>
              ) : (
                <div className="text-slate-500 font-medium italic">
                  {lang === 'ar' ? 'لم يسأل خصمك بعد' : 'No clues yet'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. TURN ACTION ZONE */}
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
          <div className="p-3.5 bg-[#0F172A] border border-slate-700/80 rounded-2xl space-y-3 animate-fade-in">
            {/* 2A: The Player who asked the question (Waiting for opponent answer) */}
            {isAskerOfPendingQuestion ? (
              <div className="text-center py-4 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-bold text-purple-300">
                  <span>💬</span>
                  <span>{lang === 'ar' ? 'سؤالك أُرسل بنجاح:' : 'Your question was sent:'}</span>
                </div>
                <div className="text-base font-black text-white bg-[#1E293B] p-3 rounded-xl border border-slate-700 shadow-inner">
                  "{activeQuestionText}"
                </div>
                <div className="text-xs font-bold text-purple-400 animate-pulse flex items-center justify-center gap-1.5 pt-1">
                  <span>⏳</span>
                  <span>{lang === 'ar' ? `في انتظار إجابة ${opponentName} عن صورتك...` : `Waiting for ${opponentName}'s answer...`}</span>
                </div>
              </div>
            ) : (
              /* 2B: The Receiver Player (Prompted with the Answering Card) */
              <>
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>
                    {lang === 'ar'
                      ? `${activePlayer.name} يسألك:`
                      : `${activePlayer.name} asks you:`}
                  </span>
                  <span className="text-purple-400 text-[11px] bg-[#1E293B] px-2 py-0.5 rounded-full border border-slate-700 font-bold">
                    {lang === 'ar' ? `أجب يا ${viewerName}` : `${viewerName} answers`}
                  </span>
                </div>

                <div className="text-base font-black text-white bg-[#1E293B] p-3.5 rounded-xl border border-slate-700 text-center shadow-sm">
                  «{activeQuestionText}»
                </div>

                {/* Reminder of Secret Card chosen for the asker */}
                <div className="flex items-center justify-center gap-2 p-2 bg-amber-500/10 rounded-xl text-[11px] font-bold text-amber-300 border border-amber-500/20">
                  <span className="shrink-0 text-sm">💡</span>
                  <span>
                    {lang === 'ar'
                      ? `(أنت اخترت له: ${visibleOpponentCard.title})`
                      : `(You picked for them: ${visibleOpponentCard.title})`}
                  </span>
                </div>

                {/* 4 High-contrast answer buttons with tactile feedback */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('YES')}
                    className={`h-12 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedAnswer === 'YES'
                        ? 'btn-ans-yes ring-2 ring-emerald-300 scale-102'
                        : 'btn-ans-yes opacity-90 hover:opacity-100'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3] text-white" />
                    <span>{lang === 'ar' ? 'نعم 🟢' : 'YES 🟢'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('NO')}
                    className={`h-12 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedAnswer === 'NO'
                        ? 'btn-ans-no ring-2 ring-rose-300 scale-102'
                        : 'btn-ans-no opacity-90 hover:opacity-100'
                    }`}
                  >
                    <X className="w-4 h-4 stroke-[3] text-white" />
                    <span>{lang === 'ar' ? 'لا 🔴' : 'NO 🔴'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('SOMETIMES')}
                    className={`h-12 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedAnswer === 'SOMETIMES'
                        ? 'btn-ans-sometimes ring-2 ring-amber-300 scale-102'
                        : 'btn-ans-sometimes opacity-90 hover:opacity-100'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-slate-900" />
                    <span>{lang === 'ar' ? 'أحيانًا 🟡' : 'SOMETIMES 🟡'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAnswer('NOT_SURE')}
                    className={`h-12 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedAnswer === 'NOT_SURE'
                        ? 'btn-ans-not-sure ring-2 ring-slate-300 scale-102'
                        : 'btn-ans-not-sure'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span>{lang === 'ar' ? 'مش متأكد ⚪' : 'NOT SURE ⚪'}</span>
                  </button>
                </div>

                {/* Optional Note Input */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <span>📝</span>
                    <span>{lang === 'ar' ? 'إضافة ملاحظة — اختياري' : 'Add a note — optional'}</span>
                  </label>
                  <input
                    type="text"
                    value={answerNote}
                    onChange={(e) => setAnswerNote(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثلاً: "بس مش دايماً سخنة"...' : 'e.g. "Only when fresh"...'}
                    className="w-full bg-[#1E293B] border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Submit Answer CTA */}
                <button
                  type="button"
                  disabled={!selectedAnswer}
                  onClick={handleSubmitAnswer}
                  className="w-full h-13 btn-premium-purple rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <span>{lang === 'ar' ? `إرسال الإجابة لـ ${activePlayer.name} ←` : `Send Answer to ${activePlayer.name} →`}</span>
                </button>
              </>
            )}
          </div>
        ) : !activeQuestionText && !passAndPlayHandoff ? (
          /* STATE 1: ASKING STATE (NO QUESTION PENDING) */
          isMyTurnToAsk ? (
            /* 1A: ACTIVE PLAYER'S TURN TO ASK (Input & Keyboard Visible) */
            <div className="space-y-3">
              {/* Primary Action Buttons (Thumb Reachable) */}
              <div className="flex flex-col gap-2.5">
                {/* BIG MODERN GOLD GUESS BUTTON: "أنا عرفت! 🎯" */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playTurnChime();
                    setGuessInput('');
                    setIsGuessModalOpen(true);
                  }}
                  className="w-full h-14 btn-premium-gold rounded-2xl font-black text-base flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-98"
                >
                  <Lightbulb className="w-5 h-5 fill-slate-900 text-slate-900" />
                  <span>{lang === 'ar' ? 'أنا عرفت صورتي! 🎯' : 'I Know My Picture! 🎯'}</span>
                </button>

                {/* QUESTION INPUT + SEND BUTTON (ONLY VISIBLE & INTERACTIVE FOR ACTIVE PLAYER) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAsk(questionInput);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder={lang === 'ar' ? 'اكتب سؤالك عن صورتك المخفية...' : 'Ask about your hidden card...'}
                    className="flex-1 h-12 bg-[#0F172A] border border-slate-700 focus:border-blue-500 rounded-xl px-4 text-sm text-white font-bold placeholder-slate-500 focus:outline-none shadow-inner"
                  />

                  <button
                    type="submit"
                    disabled={!questionInput.trim()}
                    className="h-12 px-5 btn-premium-blue disabled:opacity-40 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                  >
                    <span>{lang === 'ar' ? 'إرسال' : 'Send'}</span>
                    <Send className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </form>
              </div>

              {/* Quick Question Suggestions Pills */}
              {category.suggestedQuestionsAr.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{lang === 'ar' ? 'اقتراحات سريعة لأسئلة صورتك:' : 'Suggestions for your card:'}</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(lang === 'ar' ? category.suggestedQuestionsAr : category.suggestedQuestionsEn).map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAsk(q)}
                        className="px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-full border border-slate-700/80 hover:border-blue-400 whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 1B: WAITING OPPONENT (NO INPUT, NO KEYBOARD, NO SEND BUTTON - SHOWS WRITING STATE) */
            <div className="p-6 bg-[#0F172A] border border-slate-700/80 rounded-2xl text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 text-2xl animate-bounce">
                ✍️
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-white">
                  {lang === 'ar' ? `${activePlayer.name} يكتب سؤاله... ✍️` : `${activePlayer.name} is writing a question... ✍️`}
                </h4>
                <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                  {lang === 'ar'
                    ? `بمجرد أن يرسل سؤاله، سيظهر لك فوراً هنا لتجيب عنه بنعم أو لا.`
                    : `Once sent, the question will appear here for you to answer.`}
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
                        <span className="text-white font-bold truncate">
                          "{rec.question}"
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5 ps-2 text-[11px]">
                        <span className="text-slate-400 font-medium">
                          {lang === 'ar' ? `إجابة ${respondentName}:` : `Answer by ${respondentName}:`}
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

      {/* 7. "أنا عرفت!" GUESS SUBMISSION MODAL */}
      {isGuessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#0F172A] rounded-t-[32px] sm:rounded-3xl p-6 border border-slate-700/80 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <h3 className="font-black text-xl text-white">
                  {lang === 'ar' ? 'أنا عرفت صورتي!' : 'I Know My Picture!'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGuessModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-medium leading-relaxed">
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
                  placeholder={lang === 'ar' ? 'تخميني هو: بيتزا...' : 'My guess is: Pizza...'}
                  className="w-full h-14 bg-[#1E293B] border border-slate-700 focus:border-amber-400 rounded-2xl px-4 text-base font-black text-white focus:outline-none text-center placeholder-slate-500"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsGuessModalOpen(false)}
                  className="flex-1 py-3.5 btn-premium-surface text-slate-300 font-bold rounded-xl text-sm cursor-pointer transition-colors"
                >
                  {lang === 'ar' ? 'تراجع' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={!guessInput.trim()}
                  className="flex-2 py-3.5 btn-premium-gold text-slate-900 font-black rounded-xl text-base shadow-md cursor-pointer transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#0F172A] rounded-3xl p-6 border border-slate-700 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-2xl flex items-center justify-center mx-auto text-amber-400">
              ⚖️
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                {lang === 'ar' ? 'دور الخصم للتحكيم' : 'Opponent Verification'}
              </span>
              <h3 className="font-black text-xl text-white">
                {lang === 'ar'
                  ? `هل ${pendingGuessLocal.guesserName} خمن الصورة بشكل صحيح؟`
                  : `Did ${pendingGuessLocal.guesserName} guess correctly?`}
              </h3>
            </div>

            {/* The Guess Submitted */}
            <div className="p-3.5 bg-[#1E293B] border border-slate-700 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400">
                {lang === 'ar' ? 'تخمين اللاعب:' : "Player's guess:"}
              </span>
              <div className="text-xl font-black text-amber-400 tracking-tight">
                "{pendingGuessLocal.guessText}"
              </div>
            </div>

            {/* Secret Picture Reminder for Opponent */}
            <div className="flex items-center justify-center gap-2 p-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs font-bold text-slate-300">
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
                className="w-full h-14 btn-ans-yes font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-5 h-5 fill-white text-white" />
                <span>{lang === 'ar' ? 'صح، دي الصورة 🟢' : "Correct, that's it! 🟢"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleResolveLocalGuess(false)}
                className="w-full h-12 btn-premium-surface text-rose-400 border-rose-500/30 hover:bg-rose-500/10 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <ThumbsDown className="w-4 h-4" />
                <span>{lang === 'ar' ? 'لا، تخمين غلط 🔴' : 'No, incorrect 🔴'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {lang === 'ar' ? 'لا توجد خسارة إذا كان التخمين غلط، وتستمر اللعبة بالتبادل!' : 'No penalty for incorrect guess, game continues!'}
            </p>
          </div>
        </div>
      )}

      {/* 9. ONLINE: OPPONENT JUDGMENT MODAL */}
      {amIOnlineJudge && pendingGuessRemote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#0F172A] rounded-3xl p-6 border border-slate-700 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-2xl flex items-center justify-center mx-auto text-amber-400">
              ⚖️
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                {lang === 'ar' ? 'أنت الحكم الآن!' : 'You are the judge!'}
              </span>
              <h3 className="font-black text-xl text-white">
                {lang === 'ar'
                  ? `هل ${pendingGuessRemote.guesserName} خمن الصورة بشكل صحيح؟`
                  : `Did ${pendingGuessRemote.guesserName} guess correctly?`}
              </h3>
            </div>

            <div className="p-3.5 bg-[#1E293B] border border-slate-700 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400">
                {lang === 'ar' ? 'تخمينه هو:' : "Their guess:"}
              </span>
              <div className="text-xl font-black text-amber-400 tracking-tight">
                "{pendingGuessRemote.guessText}"
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onOnlineResolveGuess) onOnlineResolveGuess(true);
                }}
                className="w-full h-14 btn-ans-yes font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-5 h-5 fill-white text-white" />
                <span>{lang === 'ar' ? 'صح، دي الصورة 🟢' : "Correct! 🟢"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOnlineResolveGuess) onOnlineResolveGuess(false);
                }}
                className="w-full h-12 btn-premium-surface text-rose-400 border-rose-500/30 hover:bg-rose-500/10 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
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
        <div className="p-3 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-2xl text-xs font-bold text-center shadow-md animate-pulse">
          ⏳ {lang === 'ar' ? 'في انتظار قرار الخصم للتأكيد على التخمين...' : 'Waiting for opponent to verify your guess...'}
        </div>
      )}
    </div>
  );
};
