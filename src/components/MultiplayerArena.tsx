import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  CategoryDefinition,
  MultiplayerPlayer,
  MultiplayerQuestionRecord,
  AnswerType,
} from '../types/game';
import { sound } from '../utils/audio';
import {
  Send,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Smartphone,
  BookOpen,
  Mic,
  MicOff,
  Keyboard,
  Trophy,
  Sparkles,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

interface MultiplayerArenaProps {
  initialPlayers: MultiplayerPlayer[];
  category: CategoryDefinition;
  onPlayAgain: () => void;
  onBackToHome: () => void;
  lang: 'ar' | 'en';
}

export const MultiplayerArena: React.FC<MultiplayerArenaProps> = ({
  initialPlayers,
  category,
  onPlayAgain,
  onBackToHome,
  lang,
}) => {
  const [players, setPlayers] = useState<MultiplayerPlayer[]>(initialPlayers);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);

  // Selected Target Owner ID for the current active player
  const [selectedTargetOwnerId, setSelectedTargetOwnerId] = useState<string>('');

  // Question composer states
  const [composerMode, setComposerMode] = useState<'VOICE' | 'TEXT'>('VOICE');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef<boolean>(false);

  // Pending question active in round (waiting for target owner to answer)
  const [pendingQuestion, setPendingQuestion] = useState<{
    id: string;
    question: string;
    isVoice?: boolean;
    askerId: string;
    askerName: string;
    targetOwnerId: string;
    targetOwnerName: string;
  } | null>(null);

  // Answering controls for the target owner
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerType | null>(null);
  const [answerNote, setAnswerNote] = useState<string>('');
  const [isAnswerListening, setIsAnswerListening] = useState<boolean>(false);
  const [isVoiceAnswerUsed, setIsVoiceAnswerUsed] = useState<boolean>(false);
  const answerRecognitionRef = useRef<any>(null);
  const shouldAnswerBeListeningRef = useRef<boolean>(false);

  // Live Mic available to all players anytime during match
  const [isLiveMicOn, setIsLiveMicOn] = useState<boolean>(false);
  const [liveMicError, setLiveMicError] = useState<string | null>(null);

  // Pass & Play Handoff State
  const [passAndPlayHandoff, setPassAndPlayHandoff] = useState<boolean>(false);

  // Questions History Log
  const [questions, setQuestions] = useState<MultiplayerQuestionRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Celebratory Success Banner for Solved Target
  const [solvedBanner, setSolvedBanner] = useState<{
    askerName: string;
    targetOwnerName: string;
    cardTitle: string;
    cardImageUrl: string;
  } | null>(null);

  // Active Player
  const activePlayer = players[activePlayerIndex];

  // Maximum possible points per player = total players - 1
  const maxPointsPerPlayer = players.length - 1;

  // Unsolved targets for active player
  const activePlayerUnsolvedTargets = activePlayer.targets.filter((t) => !t.isSolved);

  // Automatically sync selectedTargetOwnerId if not set or if current target became solved
  useEffect(() => {
    if (!selectedTargetOwnerId || !activePlayerUnsolvedTargets.some((t) => t.ownerId === selectedTargetOwnerId)) {
      if (activePlayerUnsolvedTargets.length > 0) {
        setSelectedTargetOwnerId(activePlayerUnsolvedTargets[0].ownerId);
      } else {
        setSelectedTargetOwnerId('');
      }
    }
  }, [activePlayerIndex, activePlayer.targets, selectedTargetOwnerId]);

  // Current Target being investigated
  const currentTargetProgress = activePlayer.targets.find(
    (t) => t.ownerId === selectedTargetOwnerId
  );
  const currentTargetOwner = players.find((p) => p.id === selectedTargetOwnerId);

  // Setup Web Speech Recognition (Continuous tap-to-toggle)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = lang === 'ar' ? 'ar-EG' : 'en-US';

        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setQuestionInput(transcript.trim());
          }
        };
        rec.onend = () => {
          if (shouldBeListeningRef.current) {
            try {
              rec.start();
            } catch {
              setIsListening(false);
              shouldBeListeningRef.current = false;
            }
          } else {
            setIsListening(false);
          }
        };
        rec.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            shouldBeListeningRef.current = false;
            setIsListening(false);
          }
        };
        recognitionRef.current = rec;

        // Answer speech recognition (Continuous tap-to-toggle)
        const ansRec = new SpeechRecognition();
        ansRec.continuous = true;
        ansRec.interimResults = true;
        ansRec.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
        ansRec.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            const lower = transcript.toLowerCase();
            setIsVoiceAnswerUsed(true);
            if (lower.includes('نعم') || lower.includes('اه') || lower.includes('yes')) {
              setSelectedAnswer('YES');
              sound.playYesSound();
            } else if (lower.includes('لا') || lower.includes('no')) {
              setSelectedAnswer('NO');
              sound.playNoSound();
            } else if (lower.includes('أحيان') || lower.includes('sometimes')) {
              setSelectedAnswer('SOMETIMES');
              sound.playMaybeSound();
            } else if (lower.includes('مش متأكد') || lower.includes('not sure')) {
              setSelectedAnswer('NOT_SURE');
              sound.playMaybeSound();
            }
            setAnswerNote(transcript.trim());
          }
        };
        ansRec.onend = () => {
          if (shouldAnswerBeListeningRef.current) {
            try {
              ansRec.start();
            } catch {
              setIsAnswerListening(false);
              shouldAnswerBeListeningRef.current = false;
            }
          } else {
            setIsAnswerListening(false);
          }
        };
        ansRec.onerror = (e: any) => {
          console.warn('AnsRecognition error:', e);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            shouldAnswerBeListeningRef.current = false;
            setIsAnswerListening(false);
          }
        };
        answerRecognitionRef.current = ansRec;
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
      try { recognitionRef.current?.stop(); } catch {}
    } else {
      shouldBeListeningRef.current = true;
      setIsListening(true);
      sound.playTurnChime();
      if (!recognitionRef.current) {
        if (!questionInput.trim()) setQuestionInput(lang === 'ar' ? '🎙️ سؤال بالمايك' : '🎙️ Mic Question');
      } else {
        try {
          recognitionRef.current.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
          recognitionRef.current.start();
        } catch {
          setIsListening(false);
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
      try { answerRecognitionRef.current?.stop(); } catch {}
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
        } catch {
          setIsAnswerListening(false);
        }
      }
    }
  };

  // Toggle Live Voice Mic on/off anytime throughout match
  const handleToggleLiveMic = async () => {
    sound.playCardFlip();
    if (!isLiveMicOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        (window as any).__multiLiveStream = stream;
        setIsLiveMicOn(true);
        setLiveMicError(null);
      } catch (err) {
        console.warn('Live mic error:', err);
        setLiveMicError(lang === 'ar' ? 'يرجى منح إذن المايك في المتصفح' : 'Mic permission needed');
      }
    } else {
      const stream = (window as any).__multiLiveStream as MediaStream;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        (window as any).__multiLiveStream = null;
      }
      setIsLiveMicOn(false);
    }
  };

  // SEND QUESTION: Active Player sends question to Target Owner
  const handleSendQuestion = () => {
    const textToSend = questionInput.trim() || (composerMode === 'VOICE' ? (lang === 'ar' ? '🎙️ سؤال بالمايك' : '🎙️ Mic Question') : '');
    if (!textToSend || !currentTargetOwner) return;

    sound.playTurnChime();
    shouldBeListeningRef.current = false;
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }

    setPendingQuestion({
      id: 'mq-' + Date.now(),
      question: textToSend,
      isVoice: composerMode === 'VOICE',
      askerId: activePlayer.id,
      askerName: activePlayer.name,
      targetOwnerId: currentTargetOwner.id,
      targetOwnerName: currentTargetOwner.name,
    });

    setQuestionInput('');
    setSelectedAnswer(null);
    setAnswerNote('');
    setIsVoiceAnswerUsed(false);

    // Prompt phone handoff to Target Owner
    setPassAndPlayHandoff(true);
  };

  // SUBMIT STANDARD ANSWER ( نعم / لا / أحيانًا / مش متأكد )
  const handleSubmitAnswer = () => {
    if (!pendingQuestion || !selectedAnswer) return;

    if (selectedAnswer === 'YES') sound.playYesSound();
    else if (selectedAnswer === 'NO') sound.playNoSound();
    else sound.playMaybeSound();

    const newRecord: MultiplayerQuestionRecord = {
      id: pendingQuestion.id,
      question: pendingQuestion.question,
      isVoice: pendingQuestion.isVoice,
      isVoiceAnswer: isVoiceAnswerUsed,
      askerId: pendingQuestion.askerId,
      askerName: pendingQuestion.askerName,
      targetOwnerId: pendingQuestion.targetOwnerId,
      targetOwnerName: pendingQuestion.targetOwnerName,
      answer: selectedAnswer,
      note: answerNote.trim() || undefined,
      timestamp: Date.now(),
      wasWinningGuess: false,
    };

    setQuestions((prev) => [newRecord, ...prev]);
    shouldAnswerBeListeningRef.current = false;
    if (isAnswerListening && answerRecognitionRef.current) {
      try { answerRecognitionRef.current.stop(); } catch {}
      setIsAnswerListening(false);
    }
    setPendingQuestion(null);
    setSelectedAnswer(null);
    setAnswerNote('');
    setIsVoiceAnswerUsed(false);

    // Advance turn to the next player
    advanceTurn();
  };

  // WIN ACTION: Target Owner clicks "🏆 أيوه، كسبت!"
  const handleDeclareWinner = () => {
    if (!pendingQuestion || !currentTargetOwner || !currentTargetOwner.secretImage) return;

    shouldBeListeningRef.current = false;
    shouldAnswerBeListeningRef.current = false;
    setIsListening(false);
    setIsAnswerListening(false);
    try { recognitionRef.current?.stop(); } catch {}
    try { answerRecognitionRef.current?.stop(); } catch {}

    sound.playVictoryFanfare();
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#6C5CE7', '#FFD166', '#00B894', '#FF7675'],
      });
    } catch {}

    const secretImg = currentTargetOwner.secretImage;
    const askerId = pendingQuestion.askerId;
    const targetOwnerId = pendingQuestion.targetOwnerId;

    // Update players state: +1 score for asker & mark target as solved
    setPlayers((prevPlayers) =>
      prevPlayers.map((p) => {
        if (p.id === askerId) {
          const updatedTargets = p.targets.map((t) => {
            if (t.ownerId === targetOwnerId) {
              return {
                ...t,
                isSolved: true,
                solvedAtTimestamp: Date.now(),
                revealedImage: secretImg,
              };
            }
            return t;
          });
          return {
            ...p,
            score: p.score + 1,
            targets: updatedTargets,
          };
        }
        return p;
      })
    );

    // Record in history log
    const winRecord: MultiplayerQuestionRecord = {
      id: pendingQuestion.id,
      question: pendingQuestion.question,
      isVoice: pendingQuestion.isVoice,
      isVoiceAnswer: true,
      askerId: pendingQuestion.askerId,
      askerName: pendingQuestion.askerName,
      targetOwnerId: pendingQuestion.targetOwnerId,
      targetOwnerName: pendingQuestion.targetOwnerName,
      answer: 'YES',
      note: lang === 'ar' ? '🏆 تخمين صحيح واكتشاف الصورة!' : '🏆 Correct Winning Guess!',
      timestamp: Date.now(),
      wasWinningGuess: true,
    };
    setQuestions((prev) => [winRecord, ...prev]);

    // Show temporary celebratory reveal banner
    setSolvedBanner({
      askerName: pendingQuestion.askerName,
      targetOwnerName: pendingQuestion.targetOwnerName,
      cardTitle: secretImg.title,
      cardImageUrl: secretImg.imageUrl,
    });

    setPendingQuestion(null);
    setSelectedAnswer(null);
    setAnswerNote('');

    // Turn moves to next player
    advanceTurn();
  };

  // Advance turn to the next player with unsolved targets, or loop fairly
  const advanceTurn = () => {
    let nextIdx = (activePlayerIndex + 1) % players.length;
    let attempts = 0;
    // Find next player who still has unsolved targets
    while (attempts < players.length) {
      const candidate = players[nextIdx];
      const hasUnsolved = candidate.targets.some((t) => !t.isSolved);
      if (hasUnsolved) break;
      nextIdx = (nextIdx + 1) % players.length;
      attempts++;
    }

    setActivePlayerIndex(nextIdx);
    setPassAndPlayHandoff(false);
  };

  // CHECK MATCH COMPLETION: Have all players solved all their targets?
  const isMatchComplete = players.every((p) =>
    p.targets.every((t) => t.isSolved)
  );

  // Latest Question & Answer across the match
  const latestRecord = questions.length > 0 ? questions[0] : null;

  // Sorted leaderboard for match completion or top bar
  const sortedLeaderboard = [...players].sort((a, b) => b.score - a.score);

  // =========================================================================
  // MATCH COMPLETED: FINAL LEADERBOARD & PODIUM
  // =========================================================================
  if (isMatchComplete) {
    const winner = sortedLeaderboard[0];

    return (
      <div className="w-full max-w-md mx-auto py-6 px-4 text-center animate-scale-up space-y-5 select-none">
        <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto text-4xl shadow-xl animate-bounce">
          🏆
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-full shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'نهاية اللعبة!' : 'GAME FINISHED!'}</span>
          </div>
          <h2 className="text-3xl font-black text-white">
            {lang === 'ar' ? `${winner.name} بطل الجولة! 🎉` : `${winner.name} Wins! 🎉`}
          </h2>
          <p className="text-xs text-slate-300 font-bold">
            {lang === 'ar'
              ? 'تم اكتشاف جميع الصور السرية بنجاح!'
              : 'All secret pictures have been discovered!'}
          </p>
        </div>

        {/* Podium / Leaderboard Table */}
        <div className="game-card-surface p-4 border border-slate-700 space-y-2.5 shadow-2xl">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider text-start">
            {lang === 'ar' ? 'الترتيب النهائي للنقاط:' : 'Final Standings:'}
          </h4>

          {sortedLeaderboard.map((player, idx) => (
            <div
              key={player.id}
              className={`p-3 rounded-2xl flex items-center justify-between border ${
                idx === 0
                  ? 'bg-amber-500/20 border-amber-400/60 text-white shadow-md'
                  : 'bg-[#0F172A] border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-black text-base w-6 text-center text-amber-400">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '4️⃣'}
                </span>
                <span className="text-sm font-black">{player.name}</span>
              </div>
              <div className="flex items-center gap-1 text-sm font-black">
                <span className="text-amber-400">{player.score}</span>
                <span className="text-xs text-slate-400">{lang === 'ar' ? 'نقاط' : 'pts'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Secret Photos Gallery */}
        <div className="game-card-surface p-4 border border-slate-700 space-y-2 shadow-xl">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider text-start">
            {lang === 'ar' ? 'الصور السرية للجميع:' : 'Secret Photos Revealed:'}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {players.map((p) => {
              const img = p.secretImage;
              if (!img) return null;
              return (
                <div key={p.id} className="p-2 bg-[#0F172A] rounded-xl border border-slate-800 text-center space-y-1">
                  <div className="text-[10px] font-bold text-purple-300 truncate">
                    {p.name}
                  </div>
                  <img
                    src={img.imageUrl}
                    alt={img.title}
                    className="w-full aspect-square object-contain rounded-lg bg-slate-900/60 p-1"
                  />
                  <div className="text-[11px] font-black text-white truncate">
                    {img.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 h-13 btn-premium-purple rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{lang === 'ar' ? 'العب مرة أخرى' : 'Play Again'}</span>
          </button>
          <button
            type="button"
            onClick={onBackToHome}
            className="px-5 h-13 btn-premium-surface text-slate-300 font-bold rounded-2xl text-sm cursor-pointer active:scale-95"
          >
            <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col space-y-3 sm:space-y-4 animate-scale-up pb-6 select-none">
      {/* 1. TOP BAR: LEADERBOARD CHIPS */}
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 px-1">
        {players.map((p, idx) => {
          const isActive = idx === activePlayerIndex;
          const isComplete = p.targets.every((t) => t.isSolved);

          return (
            <div
              key={p.id}
              className={`px-3 py-1.5 rounded-2xl border text-xs font-black flex items-center gap-2 shrink-0 transition-all ${
                isActive
                  ? 'bg-purple-600/30 border-purple-500 text-white ring-2 ring-purple-400 shadow-md scale-102'
                  : isComplete
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-[#0F172A] border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate max-w-[80px]">{p.name}</span>
                {isComplete && <span className="text-[10px]">👑</span>}
              </div>
              <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-amber-400 font-mono font-black text-[11px]">
                {p.score}/{maxPointsPerPlayer}
              </span>
            </div>
          );
        })}
      </div>

      {/* 1B. LIVE MIC STATUS & TOGGLE BAR (ALWAYS AVAILABLE TO ALL PLAYERS THROUGHOUT GAME) */}
      <div className="p-3 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border-2 border-slate-700/90 rounded-2xl shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              {isLiveMicOn && (
                <span className="absolute w-5 h-5 rounded-full bg-emerald-400 animate-ping opacity-75" />
              )}
              <span className={`w-3.5 h-3.5 rounded-full ${isLiveMicOn ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 'bg-slate-600'}`} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                <span>{isLiveMicOn ? (lang === 'ar' ? 'المايك شغال ومفتوح لايف 🟢' : 'Live Mic is Active 🟢') : (lang === 'ar' ? 'المايك الصوتي المباشر 🎙️' : 'Live Voice Mic 🎙️')}</span>
                <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full border ${
                  isLiveMicOn
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {lang === 'ar' ? 'متاح للجميع دائماً' : 'Available anytime'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">
                {lang === 'ar'
                  ? 'اضغط يفتح / اضغط يقفل — مش لازم تفضل ضاغط عليه'
                  : 'Tap to open / Tap to close — No need to hold'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleLiveMic}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md ${
              isLiveMicOn
                ? 'bg-rose-600 text-white hover:bg-rose-500 border border-rose-400 animate-pulse'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-400'
            }`}
          >
            {isLiveMicOn ? (
              <>
                <MicOff className="w-4 h-4 text-white" />
                <span>{lang === 'ar' ? 'كتم المايك 🔴' : 'Mute Mic 🔴'}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-white" />
                <span>{lang === 'ar' ? 'فتح المايك 🎙️' : 'Open Mic 🎙️'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {liveMicError && (
        <div className="px-3 py-1.5 bg-rose-950/70 border border-rose-600/50 rounded-xl text-[11px] font-bold text-rose-300 text-center animate-shake">
          {liveMicError}
        </div>
      )}

      {/* 2. SOLVED NOTIFICATION BANNER IF JUST SOLVED */}
      {solvedBanner && (
        <div className="p-3 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-2 border-emerald-500 rounded-3xl text-center space-y-1 animate-fade-in shadow-xl relative">
          <button
            type="button"
            onClick={() => setSolvedBanner(null)}
            className="absolute top-2.5 end-2.5 w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center text-xs"
          >
            ✕
          </button>
          <div className="text-xs font-black text-emerald-300 flex items-center justify-center gap-1.5">
            <span>🎉</span>
            <span>
              {lang === 'ar'
                ? `${solvedBanner.askerName} اكتشف صورة ${solvedBanner.targetOwnerName} بنجاح! (+1 نقطة)`
                : `${solvedBanner.askerName} solved ${solvedBanner.targetOwnerName}'s photo! (+1 pt)`}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/40 rounded-xl border border-emerald-500/30 text-white text-xs font-bold mt-1">
            <img src={solvedBanner.cardImageUrl} alt={solvedBanner.cardTitle} className="w-5 h-5 object-contain" />
            <span>«{solvedBanner.cardTitle}»</span>
          </div>
        </div>
      )}

      {/* 3. TURN BANNER & TARGET SELECTION */}
      <div className="game-card-surface p-4 border border-purple-500/40 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
            <h3 className="text-sm sm:text-base font-black text-white">
              {lang === 'ar' ? `دورك الآن: ${activePlayer.name} 🎯` : `Your Turn: ${activePlayer.name} 🎯`}
            </h3>
          </div>
          <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
            {lang === 'ar' ? `باقي لك ${activePlayerUnsolvedTargets.length} صور` : `${activePlayerUnsolvedTargets.length} targets left`}
          </span>
        </div>

        {/* TARGET CARDS LIST (The photos of the other players) */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
            {lang === 'ar' ? 'الأهداف المطلوب اكتشافها:' : 'Opponent Targets:'}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activePlayer.targets.map((target) => {
              const isSelected = target.ownerId === selectedTargetOwnerId;
              const isSolved = target.isSolved;

              return (
                <button
                  key={target.ownerId}
                  type="button"
                  disabled={isSolved}
                  onClick={() => {
                    if (!isSolved) {
                      sound.playCardFlip();
                      setSelectedTargetOwnerId(target.ownerId);
                    }
                  }}
                  className={`p-2.5 rounded-2xl border-2 text-start transition-all cursor-pointer relative ${
                    isSolved
                      ? 'bg-emerald-950/40 border-emerald-500/40 opacity-70 cursor-default'
                      : isSelected
                      ? 'bg-purple-600/30 border-purple-400 ring-2 ring-purple-300 shadow-md scale-102'
                      : 'bg-[#0F172A] border-slate-700/80 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-white truncate max-w-[90px]">
                      {target.ownerName}
                    </span>
                    {isSolved ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                        ✓ {lang === 'ar' ? 'محلولة' : 'Solved'}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-bold">
                        🔒 {lang === 'ar' ? 'مخفية' : 'Hidden'}
                      </span>
                    )}
                  </div>

                  <div className="w-full aspect-[4/3] rounded-xl bg-slate-900/80 flex items-center justify-center overflow-hidden p-1">
                    {isSolved && target.revealedImage ? (
                      <img
                        src={target.revealedImage.imageUrl}
                        alt={target.revealedImage.title}
                        className="w-full h-full object-contain drop-shadow"
                      />
                    ) : (
                      <span className="font-mono font-black text-2xl text-amber-400">
                        ?
                      </span>
                    )}
                  </div>

                  {isSolved && target.revealedImage && (
                    <div className="text-[10px] font-black text-emerald-300 text-center truncate pt-1">
                      {target.revealedImage.title}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ACTIVE TARGET PROMPT (Rule 5) */}
        {currentTargetOwner && (
          <div className="p-3 bg-[#0F172A] border-2 border-purple-500/50 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
              {lang === 'ar' ? 'الهدف المختار للتحقيق 🎯' : 'Active Investigation 🎯'}
            </span>
            <div className="text-xs sm:text-sm font-black text-white">
              {lang === 'ar'
                ? `أنت الآن بتحاول تعرف الصورة اللي اختارها: ${currentTargetOwner.name}`
                : `You are investigating the photo chosen by: ${currentTargetOwner.name}`}
            </div>
          </div>
        )}
      </div>

      {/* 4. PRIMARY LATEST ANSWER BANNER */}
      {latestRecord && !pendingQuestion && (
        <div className="bg-[#0F172A] border-2 border-emerald-500/40 rounded-3xl p-4 shadow-xl space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>
              {lang === 'ar'
                ? `💬 إجابة ${latestRecord.targetOwnerName} لـ ${latestRecord.askerName}:`
                : `💬 ${latestRecord.targetOwnerName}'s answer to ${latestRecord.askerName}:`}
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-bold">
              {lang === 'ar' ? 'آخر إجابة' : 'Latest'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {latestRecord.answer === 'YES' && (
              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-black text-sm">
                🟢 {lang === 'ar' ? 'نعم (اه)' : 'YES'}
              </span>
            )}
            {latestRecord.answer === 'NO' && (
              <span className="px-3.5 py-1.5 rounded-xl bg-rose-500/25 border border-rose-400 text-rose-300 font-black text-sm">
                🔴 {lang === 'ar' ? 'لا' : 'NO'}
              </span>
            )}
            {latestRecord.answer === 'SOMETIMES' && (
              <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/25 border border-amber-400 text-amber-300 font-black text-sm">
                🟡 {lang === 'ar' ? 'أحيانًا' : 'SOMETIMES'}
              </span>
            )}
            {latestRecord.answer === 'NOT_SURE' && (
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-700/60 border border-slate-500 text-slate-200 font-black text-sm">
                ⚪ {lang === 'ar' ? 'مش متأكد' : 'NOT SURE'}
              </span>
            )}

            {latestRecord.note && (
              <span className="text-xs font-bold text-purple-200 bg-purple-950/60 px-3 py-1.5 rounded-xl border border-purple-500/30">
                «{latestRecord.note}»
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>{lang === 'ar' ? 'السؤال: ' : 'Question: '}</span>
            <span className="text-white font-bold">«{latestRecord.question}»</span>
          </div>
        </div>
      )}

      {/* 5. CURRENT ACTION ZONE */}
      <div className="game-card-surface p-4 border border-slate-700/60 space-y-3">
        {/* PASS & PLAY HANDOFF INTERSTITIAL */}
        {passAndPlayHandoff && pendingQuestion && (
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
                  ? `مرر الجهاز لـ ${pendingQuestion.targetOwnerName} ليجيب عن سؤالك!`
                  : `Hand the phone to ${pendingQuestion.targetOwnerName} to answer!`}
              </h4>
              <p className="text-xs text-slate-300 font-medium bg-[#1E293B] p-2.5 rounded-xl border border-slate-700 shadow-inner">
                "{pendingQuestion.question}"
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPassAndPlayHandoff(false);
                sound.playTurnChime();
              }}
              className="w-full h-12 btn-premium-purple rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <span>
                {lang === 'ar'
                  ? `أنا ${pendingQuestion.targetOwnerName}، معي الهاتف وجاهز للإجابة ←`
                  : `I am ${pendingQuestion.targetOwnerName}, ready ←`}
              </span>
            </button>
          </div>
        )}

        {/* STATE 2: A QUESTION IS PENDING -> TARGET OWNER ANSWERS */}
        {pendingQuestion && !passAndPlayHandoff ? (
          <div className="bg-[#0F172A] border-2 border-purple-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-xs font-black text-purple-300">
                <span>{pendingQuestion.isVoice ? '🎙️ سؤال صوتي' : '💬 سؤال جديد'}</span>
                <span>•</span>
                <span>
                  {lang === 'ar'
                    ? `${pendingQuestion.askerName} بيسألك عن صورتك:`
                    : `${pendingQuestion.askerName} asks about your photo:`}
                </span>
              </div>

              <div className="text-base sm:text-xl font-black text-white bg-[#1E293B] p-4 rounded-2xl border border-slate-700 shadow-inner leading-relaxed">
                «{pendingQuestion.question}»
              </div>

              {/* Secret Photo Reminder for Owner */}
              {currentTargetOwner?.secretImage && (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 mt-1">
                  <img
                    src={currentTargetOwner.secretImage.imageUrl}
                    alt={currentTargetOwner.secretImage.title}
                    className="w-5 h-5 object-contain rounded"
                  />
                  <span>
                    {lang === 'ar'
                      ? `(صورتك السرية: ${currentTargetOwner.secretImage.title})`
                      : `(Your Secret Photo: ${currentTargetOwner.secretImage.title})`}
                  </span>
                </div>
              )}
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

            {/* WIN ACTION: 🏆 أيوه، كسبت! */}
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
                  ? `اضغط هنا إذا كان سؤال ${pendingQuestion.askerName} هو التخمين الصحيح لصورتك!`
                  : `Tap here if ${pendingQuestion.askerName}'s question was the correct guess for your photo!`}
              </p>
            </div>

            {/* Optional Note & Voice Mic Dictation */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                <span>{lang === 'ar' ? 'ملاحظة اختيارية أو تحدث بالمايك:' : 'Optional note or speak via mic:'}</span>
                {isVoiceAnswerUsed && (
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold">
                    <Mic className="w-3 h-3" />
                    {lang === 'ar' ? 'إجابة صوتية' : 'Voice answer'}
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
                  title={lang === 'ar' ? 'اضغط يفتح / اضغط يقفل' : 'Tap to toggle mic'}
                  className={`h-11 px-3.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-sm ${
                    isAnswerListening
                      ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                      : isVoiceAnswerUsed
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                      : 'bg-[#1E293B] hover:bg-[#28384f] text-slate-300 border-slate-700'
                  }`}
                >
                  <Mic className="w-4 h-4 text-purple-300" />
                  <span className="text-[11px]">
                    {isAnswerListening
                      ? (lang === 'ar' ? 'المايك شغال 🟢 (اضغط للقفل)' : 'Mic ON 🟢')
                      : (lang === 'ar' ? 'مايك 🎙️ (اضغط يفتح/يقفل)' : 'Mic 🎙️')}
                  </span>
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
              <span>
                {lang === 'ar'
                  ? `إرسال الإجابة لـ ${pendingQuestion.askerName} ←`
                  : `Send Answer to ${pendingQuestion.askerName} →`}
              </span>
            </button>
          </div>
        ) : !pendingQuestion && !passAndPlayHandoff ? (
          /* STATE 1: ASKING STATE -> ACTIVE PLAYER TYPES OR SPEAKS QUESTION */
          <div className="bg-[#0F172A] border border-blue-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span className="text-xs sm:text-sm font-black text-white">
                  {lang === 'ar'
                    ? `دورك يا ${activePlayer.name} 🎯 (اطرح سؤالك على ${currentTargetOwner?.name || ''})`
                    : `Your turn, ${activePlayer.name} 🎯`}
                </span>
              </div>
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
                    try { recognitionRef.current.stop(); } catch {}
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

            {/* The Unified Question Composer */}
            <div className="space-y-2.5">
              {composerMode === 'VOICE' ? (
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
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? `اكتب سؤالك عن صورة ${currentTargetOwner?.name || ''} (مثال: هل هو لاعب كرة قدم؟)...`
                        : `Ask about ${currentTargetOwner?.name || ''}'s photo...`
                    }
                    className="w-full h-13 bg-[#070D1E] border border-slate-700 focus:border-blue-500 rounded-xl px-4 text-sm text-white font-bold placeholder-slate-500 focus:outline-none shadow-inner"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && questionInput.trim()) {
                        e.preventDefault();
                        handleSendQuestion();
                      }
                    }}
                  />
                </div>
              )}

              {/* Primary Send Button */}
              <button
                type="button"
                disabled={!questionInput.trim() && !isListening}
                onClick={handleSendQuestion}
                className="w-full h-13 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:brightness-110 disabled:opacity-40 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 transition-all"
              >
                <Send className="w-4 h-4 rtl:rotate-180" />
                <span>
                  {lang === 'ar'
                    ? `إرسال السؤال لـ ${currentTargetOwner?.name || ''} 🚀`
                    : `Send Question to ${currentTargetOwner?.name || ''} 🚀`}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {/* 6. HISTORY BOTTOM DRAWER TRIGGER */}
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
              {lang === 'ar'
                ? `سجل الأسئلة والأدلة (${questions.length})`
                : `Questions & Clues Log (${questions.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* 7. QUESTION HISTORY MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-fade-in select-none">
          <div className="w-full max-w-md bg-[#0F172A] rounded-t-[32px] sm:rounded-3xl p-5 border border-slate-700/80 shadow-2xl space-y-4 max-h-[82vh] flex flex-col animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-lg text-white">
                  {lang === 'ar' ? 'سجل أسئلة الجولة' : 'Match Clues Log'}
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

            <div className="flex-1 overflow-y-auto space-y-2.5 pe-1">
              {questions.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-medium text-xs">
                  {lang === 'ar' ? 'لا توجد أسئلة مسجلة بعد.' : 'No questions recorded yet.'}
                </div>
              ) : (
                questions.map((q) => (
                  <div
                    key={q.id}
                    className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                      q.wasWinningGuess
                        ? 'bg-amber-500/15 border-amber-400/60 shadow-sm'
                        : 'bg-[#1E293B] border-slate-700/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span className="text-purple-300">
                        {q.askerName} ➔ {q.targetOwnerName}
                      </span>
                      {q.wasWinningGuess && (
                        <span className="text-amber-400 font-black flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {lang === 'ar' ? 'تخمين رابح!' : 'Winner!'}
                        </span>
                      )}
                    </div>

                    <div className="text-white font-bold">
                      «{q.question}»
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400 font-bold">
                        {lang === 'ar' ? `إجابة ${q.targetOwnerName}:` : `${q.targetOwnerName}'s answer:`}
                      </span>
                      {q.answer === 'YES' && <span className="text-emerald-400 font-bold">🟢 نعم</span>}
                      {q.answer === 'NO' && <span className="text-rose-400 font-bold">🔴 لا</span>}
                      {q.answer === 'SOMETIMES' && <span className="text-amber-400 font-bold">🟡 أحيانًا</span>}
                      {q.answer === 'NOT_SURE' && <span className="text-slate-400 font-bold">⚪ مش متأكد</span>}
                    </div>

                    {q.note && (
                      <div className="text-[10px] text-slate-300 bg-slate-900/60 p-1.5 rounded-lg italic">
                        "{q.note}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
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
