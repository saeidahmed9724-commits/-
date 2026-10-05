import React, { useRef, useState } from 'react';
import { ArrowLeft, ClipboardPaste, HelpCircle, KeyRound, Link2, Play, User, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../utils/audio';
import { GameLogoBanner } from './GameLogoBanner';

interface JoinGameScreenProps {
  initialCode?: string;
  onJoinRoom: (code: string, playerName: string) => Promise<void>;
  onCreateNewGame: () => void;
  onBack: () => void;
  lang: 'ar' | 'en';
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenRules?: () => void;
}

/** Room codes are always 5 characters (the server and the app both generate 5). */
const CODE_LEN = 5;

export const JoinGameScreen: React.FC<JoinGameScreenProps> = ({
  initialCode = '',
  onJoinRoom,
  onCreateNewGame,
  onBack,
  lang,
  soundEnabled = true,
  onToggleSound,
  onOpenRules,
}) => {
  const [code, setCode] = useState<string>(initialCode.toUpperCase());
  const [playerName, setPlayerName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
        if (cleaned) {
          setCode(cleaned);
          sound.playCardFlip();
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
    setCode(val);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = playerName.trim() || (lang === 'ar' ? 'اللاعب 2' : 'Player 2');

    if (!cleanCode) {
      setErrorMessage(lang === 'ar' ? 'من فضلك أدخل كود الغرفة' : 'Please enter room code');
      sound.playWrongBuzzer();
      return;
    }

    if (cleanCode.length < 4) {
      setErrorMessage(lang === 'ar' ? 'كود الغرفة غير مكتمل' : 'Room code is incomplete');
      sound.playWrongBuzzer();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    sound.playTurnChime();

    try {
      await onJoinRoom(cleanCode, cleanName);
    } catch (err) {
      sound.playWrongBuzzer();
      const reason = err instanceof Error ? err.message : '';
      const known: Record<string, [string, string]> = {
        'Room is full': ['الغرفة ممتلئة بالفعل', 'The room is full'],
        'Game already started': ['اللعبة بدأت بالفعل ولا يمكن الانضمام الآن', 'The game has already started'],
        'Name already taken in this room': ['الاسم مستخدم في الغرفة، اختر اسمًا آخر', 'That name is taken in this room, pick another'],
      };
      const hit = known[reason];
      setErrorMessage(
        hit
          ? (lang === 'ar' ? hit[0] : hit[1])
          : lang === 'ar'
            ? 'تعذر العثور على الغرفة أو الاتصال بها. تأكد من صحة الكود.'
            : 'Could not find or connect to room. Please check the code.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const ar = lang === 'ar';
  const slots = code.padEnd(CODE_LEN, ' ').slice(0, CODE_LEN).split('');
  const nextEmpty = Math.min(code.length, CODE_LEN - 1);
  const roundBtn = 'w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-300/40 text-white flex items-center justify-center cursor-pointer active:scale-95';

  return (
    <div className="w-full max-w-[440px] mx-auto px-3 py-3 space-y-3 animate-fade-in">
      {/* top bar */}
      <div dir="ltr" className="rounded-[26px] border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)] px-3 py-2 flex items-center justify-between gap-2">
        <GameLogoBanner size="sm" className="shrink-0" />
        <div className="flex items-center gap-2">
          <button type="button" aria-label={ar ? 'القواعد' : 'Rules'} onClick={() => { sound.playCardFlip(); onOpenRules?.(); }} className={roundBtn}><HelpCircle className="w-5 h-5" /></button>
          <button type="button" aria-label={ar ? 'الصوت' : 'Sound'} onClick={() => { onToggleSound?.(); sound.playTurnChime(); }} className={roundBtn}>{soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</button>
        </div>
      </div>

      {/* back */}
      <button type="button" onClick={() => { sound.playCardFlip(); onBack(); }} className="px-5 h-11 rounded-full border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md text-white text-sm font-black flex items-center gap-2 cursor-pointer active:scale-95">
        <ArrowLeft className={`w-4 h-4 ${ar ? 'rotate-180' : ''}`} />
        {ar ? 'رجوع' : 'Back'}
      </button>

      <form onSubmit={handleSubmit} className="rounded-[26px] border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)] p-5 space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 border border-white/30 shadow-lg flex items-center justify-center rotate-6"><Link2 className="w-9 h-9 text-white" /></div>
          <h1 className="text-3xl font-black text-white">{ar ? <>انضمام <span className="text-amber-400">بكود الغرفة</span></> : <>Join <span className="text-amber-400">with a room code</span></>}</h1>
          <p className="text-sm font-bold text-slate-300">{ar ? 'أدخل كود الغرفة الذي أرسله لك صديقك' : 'Enter the room code your friend sent you'}</p>
        </div>

        {/* name */}
        <label className="block space-y-1.5">
          <span className="block text-sm font-black text-white">{ar ? 'اسمك' : 'Your name'}</span>
          <div className="flex items-center gap-2 h-12 px-3 rounded-2xl bg-[#0a1030]/80 border border-indigo-300/30 focus-within:border-blue-400">
            <User className="w-5 h-5 text-slate-400 shrink-0" />
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={24} autoComplete="off" placeholder={ar ? 'اكتب اسمك هنا...' : 'Enter your name...'} className="flex-1 min-w-0 bg-transparent text-white font-bold text-base outline-none border-none placeholder:text-slate-500" />
          </div>
        </label>

        {/* code */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-white">{ar ? 'كود الغرفة' : 'Room code'}</span>
            <button type="button" onClick={handlePasteCode} className="px-3 h-9 rounded-xl bg-blue-500/20 border border-blue-400/50 text-blue-200 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95"><ClipboardPaste className="w-4 h-4" />{ar ? 'لصق الكود' : 'Paste code'}</button>
          </div>
          <div dir="ltr" className="relative" onClick={() => codeInputRef.current?.focus()}>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${CODE_LEN}, minmax(0, 1fr))` }}>
              {slots.map((ch, i) => (
                <div key={i} className={`h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black text-white bg-[#0a1030]/80 ${i === nextEmpty && code.length < CODE_LEN ? 'border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]' : 'border-indigo-300/30'}`}>
                  {ch.trim() || <span className="text-slate-600 text-base">•</span>}
                </div>
              ))}
            </div>
            <input ref={codeInputRef} value={code} onChange={handleCodeChange} maxLength={CODE_LEN} aria-label={ar ? 'كود الغرفة' : 'Room code'} autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <p className="text-xs font-bold text-slate-400 text-center">{ar ? `الكود يتكون من ${CODE_LEN} أرقام أو أحرف` : `The code is ${CODE_LEN} letters or digits`}</p>
        </div>

        {errorMessage && <div role="alert" className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-sm font-bold text-center">{errorMessage}</div>}

        <button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-lg font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 disabled:opacity-60">
          {isLoading ? (ar ? 'جاري الانضمام...' : 'Joining...') : (<><Play className="w-5 h-5 fill-current" />{ar ? 'انضم إلى اللعبة' : 'Join the game'}</>)}
        </button>

        <div className="text-center text-sm font-bold text-slate-300 flex items-center justify-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-400" />
          {ar ? 'ليس لديك كود؟' : "Don't have a code?"}
          <button type="button" onClick={() => { sound.playCardFlip(); onCreateNewGame(); }} className="text-amber-400 font-black underline cursor-pointer">{ar ? 'إنشاء لعبة جديدة' : 'Create a new game'}</button>
        </div>
      </form>
    </div>
  );
};
