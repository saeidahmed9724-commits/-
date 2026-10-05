import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, ChevronDown, ChevronLeft, Copy, Crown, Eye, HelpCircle, Info, Link2, Send, Volume2, VolumeX } from 'lucide-react';
import { GameLogoBanner } from './GameLogoBanner';
import { AnswerType, MpPlayerView, MpRoomState } from '../types/game';
import { onlineService } from '../services/onlineGame';
import { sound } from '../utils/audio';
import { VoiceChatBar, useJoinVoice } from './VoiceChatBar';
import { ChoosePictureScreen } from './ChoosePictureScreen';
import { prepareSecretImage } from '../utils/image';

/**
 * 3 / 4 players ONLINE. Every player is on their own device and joins the same room with a
 * room code / invite link. The server keeps the game state; this component only renders it and
 * sends the player's own actions. The voice chat (VoiceChatBar) is separate from all of it.
 */
interface Props {
  room: MpRoomState | null;
  onLeave: () => void;
  lang: 'ar' | 'en';
  onOpenRules?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

const ANSWERS: { id: AnswerType; ar: string; en: string; cls: string }[] = [
  { id: 'YES', ar: 'نعم ✅', en: 'Yes ✅', cls: 'bg-emerald-600 border-emerald-400' },
  { id: 'NO', ar: 'لا ❌', en: 'No ❌', cls: 'bg-rose-600 border-rose-400' },
  { id: 'SOMETIMES', ar: 'أحيانًا 🤔', en: 'Sometimes 🤔', cls: 'bg-amber-600 border-amber-400' },
  { id: 'NOT_SURE', ar: 'مش متأكد ❓', en: 'Not sure ❓', cls: 'bg-slate-600 border-slate-400' },
];
const answerLabel = (a: AnswerType, lang: 'ar' | 'en') => {
  const x = ANSWERS.find((v) => v.id === a)!;
  return lang === 'ar' ? x.ar : x.en;
};

export const OnlineMultiplayerGame: React.FC<Props> = ({ room, onLeave, lang, onOpenRules, soundEnabled = true, onToggleSound }) => {
  const ar = lang === 'ar';
  const meId = room?.meId ?? onlineService.mpPlayerId;
  const me = room?.players.find((p) => p.id === room.meId);

  // Voice: join the room's channel as soon as we are in the room (lobby included).
  useJoinVoice(meId, room ? room.players.map((p) => p.id) : []);

  if (!room || !me) {
    return (
      <div className="w-full max-w-md mx-auto py-16 text-center text-slate-300 font-bold animate-pulse">
        {ar ? 'جاري الاتصال بالغرفة...' : 'Connecting to the room...'}
      </div>
    );
  }

  const neon = room.phase === 'PLAYING';
  return (
    <div style={neon ? NEON_BG_STYLE : undefined} className={`w-full max-w-md mx-auto flex flex-col gap-3 pb-6 select-none animate-scale-up ${neon ? NEON_BG + ' p-3 rounded-[28px]' : ''}`}>
      {neon && (
        <NeonTopBar
          round={Math.floor(room.questions.length / Math.max(1, room.players.length)) + 1}
          ar={ar}
          soundEnabled={soundEnabled}
          onOpenRules={onOpenRules}
          onToggleSound={onToggleSound}
        />
      )}
      <VoiceChatBar
        neon={neon}
        lang={lang}
        selfId={room.meId}
        selfName={me.name}
        players={room.players.map((p) => ({ id: p.id, name: p.name }))}
      />
      {room.phase === 'LOBBY' && <Lobby room={room} lang={lang} onLeave={onLeave} />}
      {room.phase === 'CHOOSING' && <ChoosePicture room={room} me={me} lang={lang} />}
      {room.phase === 'PLAYING' && <Arena room={room} me={me} lang={lang} />}
      {room.phase === 'GAMEOVER' && <GameOver room={room} lang={lang} onLeave={onLeave} />}
    </div>
  );
};


// ----------------------------------------------------------------------------------------
// Neon look (the playing screen)
// ----------------------------------------------------------------------------------------
const NEON_BG = 'min-h-[calc(100dvh-1rem)] bg-cover bg-center bg-[#0b1030]';
const NEON_BG_STYLE: React.CSSProperties = {
  // dark veil keeps the text readable; the gradient underneath is the fallback if the image fails to load
  backgroundImage:
    'linear-gradient(rgba(8,10,32,0.28), rgba(10,8,34,0.50)), url(/art/bg-living-room.webp), linear-gradient(180deg,#0b1030,#140d33 55%,#1a1030)',
};
const GLASS = 'rounded-[26px] border border-indigo-400/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)]';

const NeonTopBar: React.FC<{ round: number; ar: boolean; soundEnabled: boolean; onOpenRules?: () => void; onToggleSound?: () => void }> = ({ round, ar, soundEnabled, onOpenRules, onToggleSound }) => (
  <div dir="ltr" className={`${GLASS} px-3 py-2 flex items-center justify-between gap-2`}>
    <GameLogoBanner size="sm" className="shrink-0" />
    <div className="px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-300/30 text-sm font-black text-white flex items-center gap-2">
      <span className="w-3 h-3 rounded-full bg-amber-400" />
      {ar ? `الجولة ${round}` : `Round ${round}`}
    </div>
    <div className="flex items-center gap-2">
      <button type="button" aria-label={ar ? 'القواعد' : 'Rules'} onClick={onOpenRules} className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-300/40 text-white flex items-center justify-center cursor-pointer active:scale-95"><HelpCircle className="w-5 h-5" /></button>
      <button type="button" aria-label={ar ? 'الصوت' : 'Sound'} onClick={onToggleSound} className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-300/40 text-white flex items-center justify-center cursor-pointer active:scale-95">{soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</button>
    </div>
  </div>
);

// ----------------------------------------------------------------------------------------
// Lobby
// ----------------------------------------------------------------------------------------
const Lobby: React.FC<{ room: MpRoomState; lang: 'ar' | 'en'; onLeave: () => void }> = ({ room, lang, onLeave }) => {
  const ar = lang === 'ar';
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const isHost = room.hostId === room.meId;
  const full = room.players.length === room.maxPlayers;
  const link = `${window.location.origin}/?room=${room.code}`;

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? room.code : link);
      setCopied(what);
      sound.playYesSound();
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  };

  return (
    <div className="game-card-surface p-4 border border-purple-500/40 space-y-3 shadow-xl">
      <div className="text-center space-y-1">
        <div className="text-[11px] font-black text-purple-300">
          {ar ? `👥 ${room.maxPlayers} لاعبين أونلاين — كل لاعب من جهازه` : `👥 ${room.maxPlayers} Players Online — each on their own device`}
        </div>
        <div className="text-4xl font-black tracking-[0.3em] text-white font-mono">{room.code}</div>
        <div className="flex gap-2 justify-center pt-1">
          <button type="button" onClick={() => copy('code')} className="px-3 py-2 rounded-xl text-xs font-black bg-slate-800 border border-slate-600 text-slate-200 flex items-center gap-1.5 cursor-pointer active:scale-95">
            {copied === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {ar ? 'نسخ الكود' : 'Copy code'}
          </button>
          <button type="button" onClick={() => copy('link')} className="px-3 py-2 rounded-xl text-xs font-black bg-slate-800 border border-slate-600 text-slate-200 flex items-center gap-1.5 cursor-pointer active:scale-95">
            {copied === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
            {ar ? 'نسخ رابط الدعوة' : 'Copy invite link'}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-black text-slate-400">
          <span>{ar ? 'اللاعبون' : 'Players'}</span>
          <span className="text-amber-400">
            {room.players.length}/{room.maxPlayers}
          </span>
        </div>
        {Array.from({ length: room.maxPlayers }).map((_, i) => {
          const p = room.players[i];
          return (
            <div key={i} className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-between ${p ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-transparent border-dashed border-slate-700 text-slate-500'}`}>
              {p ? (
                <>
                  <span className="flex items-center gap-1.5">
                    {p.id === room.hostId && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {p.name}
                    {p.id === room.meId && <span className="text-[10px] text-purple-300">({ar ? 'أنت' : 'you'})</span>}
                  </span>
                  <span className="text-emerald-400">✅</span>
                </>
              ) : (
                <span>{ar ? `في انتظار اللاعب ${i + 1}...` : `Waiting for player ${i + 1}...`}</span>
              )}
            </div>
          );
        })}
      </div>

      {isHost ? (
        <button
          type="button"
          disabled={!full}
          onClick={() => {
            sound.playTurnChime();
            onlineService.mpStart();
          }}
          className="w-full h-13 btn-premium-purple rounded-2xl font-black text-sm disabled:opacity-40 cursor-pointer active:scale-95"
        >
          {full ? (ar ? 'ابدأ اللعبة 🚀' : 'Start game 🚀') : ar ? `استنى اكتمال اللاعبين (${room.players.length}/${room.maxPlayers})` : `Waiting for players (${room.players.length}/${room.maxPlayers})`}
        </button>
      ) : (
        <div className="text-center text-xs font-bold text-slate-400 py-2">
          {ar ? 'في انتظار صاحب الغرفة ليبدأ اللعبة...' : 'Waiting for the host to start...'}
        </div>
      )}
      <button type="button" onClick={onLeave} className="w-full h-10 btn-premium-surface text-slate-300 font-bold rounded-2xl text-xs cursor-pointer active:scale-95">
        {ar ? 'خروج' : 'Leave'}
      </button>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// Everyone picks their own secret picture (privately, on their own device)
// ----------------------------------------------------------------------------------------
const ChoosePicture: React.FC<{ room: MpRoomState; me: MpPlayerView; lang: 'ar' | 'en' }> = ({ room, me, lang }) => {
  const ar = lang === 'ar';
  if (me.hasPicked) {
    return (
      <div className="game-card-surface p-4 border border-emerald-500/40 space-y-3 text-center">
        <div className="text-sm font-black text-emerald-300">{ar ? 'تم قفل صورتك السرية 🔒' : 'Your secret picture is locked 🔒'}</div>
        {room.mySecret && <img src={room.mySecret.imageUrl} alt={room.mySecret.title} className="w-28 h-28 object-contain mx-auto rounded-xl bg-slate-900/60 p-2" />}
        <div className="text-xs font-bold text-slate-300">{room.mySecret?.title}</div>
        <div className="space-y-1 pt-1">
          <div className="text-[11px] font-black text-slate-400">{ar ? 'في انتظار باقي اللاعبين...' : 'Waiting for the others...'}</div>
          {room.players.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs font-bold bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200">
              <span>{p.name}{!p.connected && ' 📴'}</span>
              <span>{p.hasPicked ? '✅' : '⏳'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Same picture picker as the 2-player mode: live search, upload from the phone, or paste.
  // No suggested items: pick anything you like.
  return (
    <ChoosePictureScreen
      chooserName={me.name}
      opponentName=""
      category={room.category}
      ownPicture
      lang={lang}
      onConfirmPicture={async (choice) => {
        const imageUrl = await prepareSecretImage(choice.imageUrl);
        onlineService.mpSubmitPicture(imageUrl, choice.title);
      }}
    />
  );
};

// ----------------------------------------------------------------------------------------
// The table
// ----------------------------------------------------------------------------------------
const Arena: React.FC<{ room: MpRoomState; me: MpPlayerView; lang: 'ar' | 'en' }> = ({ room, me, lang }) => {
  const ar = lang === 'ar';
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [showMine, setShowMine] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const pq = room.pendingQuestion;
  const active = room.players.find((p) => p.id === room.activePlayerId);
  const myTurn = room.activePlayerId === me.id;
  const iAmTarget = pq?.targetOwnerId === me.id;
  // Mandatory organisation: the server decides who asks whom. Nobody picks a target.
  const turn = room.turn;
  const myTarget = turn && turn.askerId === me.id ? room.players.find((p) => p.id === turn.targetId) : undefined;
  const nextName = (t: { askerName?: string; targetName?: string }) => `${t.askerName} ← ${t.targetName}`;

  // Sounds / celebration on shared events (these never touch the microphone).
  const lastTurn = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (myTurn && lastTurn.current !== me.id) sound.playTurnChime();
    lastTurn.current = room.activePlayerId;
  }, [room.activePlayerId]);
  const lastQ = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (pq && iAmTarget && lastQ.current !== pq.id) sound.playTurnChime();
    lastQ.current = pq?.id;
  }, [pq?.id]);
  const lastSolvedId = useRef<string | undefined>(room.lastSolved?.id);
  useEffect(() => {
    if (room.lastSolved && room.lastSolved.id !== lastSolvedId.current) {
      sound.playVictoryFanfare();
      try { confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } }); } catch {}
    }
    lastSolvedId.current = room.lastSolved?.id;
  }, [room.lastSolved?.id]);

  const send = () => {
    if (!myTarget || !text.trim()) return;
    sound.playTurnChime();
    onlineService.mpAsk(text.trim());
    setText('');
  };
  const answer = (a: AnswerType) => {
    if (a === 'YES') sound.playYesSound();
    else if (a === 'NO') sound.playNoSound();
    else sound.playMaybeSound();
    onlineService.mpAnswer(a, note.trim() || undefined);
    setNote('');
  };

  const totalTargets = room.players.length - 1;
  const showBanner = room.lastSolved && room.lastSolved.id !== dismissed;

  return (
    <div className="space-y-3">
      {/* players: avatar, name, score bar (the active player is highlighted) */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${room.players.length}, minmax(0, 1fr))` }}>
        {[...room.players.slice(room.players.findIndex((x) => x.id === me.id)), ...room.players.slice(0, room.players.findIndex((x) => x.id === me.id))].map((p) => (
          <div key={p.id} className={`p-2 rounded-2xl border flex items-center gap-2 min-w-0 backdrop-blur-md ${p.id === room.activePlayerId ? 'bg-indigo-500/25 border-violet-400 ring-2 ring-violet-500/70 shadow-[0_0_18px_rgba(139,92,246,0.55)]' : 'bg-[#1b2150]/60 border-indigo-300/20'} ${!p.connected ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-b from-sky-100 to-indigo-200 flex items-center justify-center border-2 border-white/80 shadow-md overflow-hidden">
              <img src="/art/avatar.webp" alt="" aria-hidden width={32} height={32} className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] leading-tight font-black text-white break-words">{p.name}{p.id === me.id && (ar ? ' (أنت)' : ' (you)')}{!p.connected && ' 📴'}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-black text-amber-300 font-mono">{p.score}/{totalTargets}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-900/70 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600" style={{ width: `${Math.max(6, (p.score / Math.max(1, totalTargets)) * 100)}%` }} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showBanner && room.lastSolved && (
        <div className="p-3 bg-emerald-950/70 border-2 border-emerald-500 rounded-3xl text-center space-y-1 relative">
          <button type="button" onClick={() => setDismissed(room.lastSolved!.id)} className="absolute top-2 end-2.5 text-emerald-400 text-xs">✕</button>
          <div className="text-xs font-black text-emerald-300">
            🎉 {ar ? `${room.lastSolved.askerName} اكتشف صورة ${room.lastSolved.ownerName}! (+1)` : `${room.lastSolved.askerName} solved ${room.lastSolved.ownerName}'s picture! (+1)`}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/40 rounded-xl text-white text-xs font-bold">
            <img src={room.lastSolved.imageUrl} alt="" className="w-6 h-6 object-contain" />
            <span>«{room.lastSolved.title}»</span>
          </div>
        </div>
      )}

      {/* 1) a question is waiting for its owner */}
      {pq && (
        <div className="backdrop-blur-md rounded-[26px] bg-[#1b2150]/60 shadow-[0_0_28px_rgba(99,102,241,0.22)] p-4 border border-amber-500/50 space-y-3">
          <div className="text-[11px] font-black text-amber-300">
            {ar ? `${pq.askerName} بيسأل ${pq.targetOwnerName}:` : `${pq.askerName} asks ${pq.targetOwnerName}:`}
          </div>
          <div className="text-base font-black text-white">«{pq.question}»</div>
          {iAmTarget ? (
            <>
              {room.mySecret && (
                <div className="flex items-center gap-2 p-2 bg-[#0F172A] rounded-xl border border-slate-700">
                  <img src={room.mySecret.imageUrl} alt="" className="w-12 h-12 object-contain" />
                  <div className="text-[11px] font-bold text-slate-300">{ar ? 'صورتك السرية:' : 'Your secret picture:'} <strong className="text-white">{room.mySecret.title}</strong></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {ANSWERS.map((a) => (
                  <button key={a.id} type="button" onClick={() => answer(a.id)} className={`h-11 rounded-xl border text-white text-xs font-black cursor-pointer active:scale-95 ${a.cls}`}>
                    {ar ? a.ar : a.en}
                  </button>
                ))}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? 'ملاحظة اختيارية...' : 'Optional note...'} className="w-full h-10 bg-[#1E293B] border border-slate-700 rounded-xl px-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none" />
              <button type="button" onClick={() => { onlineService.mpDeclareWin(); setNote(''); }} className="w-full h-12 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 cursor-pointer active:scale-95">
                {ar ? '🏆 أيوه، كسبت! (خمّن صورتي صح)' : '🏆 Yes, you got it! (guessed my picture)'}
              </button>
            </>
          ) : (
            <div className="text-xs font-bold text-slate-400 text-center animate-pulse">
              {ar ? `في انتظار إجابة ${pq.targetOwnerName}...` : `Waiting for ${pq.targetOwnerName} to answer...`}
            </div>
          )}
        </div>
      )}

      {/* The person being asked: a clear call to answer */}
      {pq && iAmTarget && (
        <div role="alert" data-testid="target-alert" className="rounded-2xl p-3 text-center bg-purple-600 text-white text-sm font-black animate-pulse">
          🔔 {ar ? `${pq.askerName} سألك — المطلوب منك الرد أنت بس` : `${pq.askerName} asked you — only you can answer`}
        </div>
      )}

      {/* 2) my turn: the game tells me whom to ask (no choice) */}
      {!pq && myTurn && myTarget && (
        <div data-testid="ask-panel" className="p-4 border border-indigo-300/30 space-y-4 backdrop-blur-md rounded-[26px] bg-[#1b2150]/60 shadow-[0_0_28px_rgba(99,102,241,0.22)]">
          <div className="text-center text-2xl font-black text-white">{ar ? 'دورك الآن 🎯' : 'Your turn 🎯'}</div>
          <div data-testid="assigned-target" className="p-3 rounded-3xl bg-violet-600/20 border border-violet-400/60 flex items-center gap-4">
            <img src="/art/cards-question.webp" alt="" aria-hidden width={96} height={78} className="w-24 h-auto shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="min-w-0 flex-1 text-center">
              <div className="text-sm font-bold text-violet-200">{ar ? 'اللعبة حددت لك تسأل:' : 'The game assigned you to ask:'}</div>
              <div className="text-3xl font-black text-amber-400 truncate">{myTarget.name}</div>
            </div>
          </div>
          <div className="flex gap-2 p-2 rounded-2xl bg-slate-950/40 border border-indigo-300/20">
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={ar ? `اكتب سؤالك لـ ${myTarget.name}...` : `Type your question for ${myTarget.name}...`} className="flex-1 min-w-0 h-14 bg-[#0a1030] border-2 border-blue-500/70 focus:border-blue-400 rounded-xl px-3 text-base text-white font-bold placeholder-slate-400 focus:outline-none" />
            <button type="button" aria-label={ar ? 'إرسال' : 'Send'} disabled={!text.trim()} onClick={send} className="w-16 h-14 rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 flex items-center justify-center disabled:opacity-60 cursor-pointer active:scale-95 shadow-lg"><Send className="w-7 h-7" /></button>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-300">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            {ar ? 'اللاعب المستهدف بيتحدد تلقائيًا من اللعبة' : 'The target player is chosen automatically by the game'}
          </div>
        </div>
      )}

      {/* 3) everybody else only watches the current turn */}
      {!pq && !myTurn && (
        <div data-testid="watch-turn" className="backdrop-blur-md rounded-[26px] bg-[#1b2150]/60 shadow-[0_0_28px_rgba(99,102,241,0.22)] p-4 border border-slate-700 text-center text-sm font-black text-slate-300">
          {turn
            ? (turn.targetId === me.id
                ? (ar ? `${turn.askerName} هيسألك دلوقتي — جهّز نفسك 🔔` : `${turn.askerName} is about to ask you 🔔`)
                : (ar ? `${turn.askerName} بيسأل ${turn.targetName} 🎯` : `${turn.askerName} asks ${turn.targetName} 🎯`))
            : (ar ? `دور ${active?.name ?? '...'} 🎯` : `${active?.name ?? '...'}'s turn 🎯`)}
          <div className="text-[11px] font-bold text-slate-500 mt-1">{ar ? 'تقدر تتكلم وتسمع الكل في أي وقت 🎙️' : 'You can talk and listen any time 🎙️'}</div>
        </div>
      )}
      {pq && !iAmTarget && pq.askerId !== me.id && (
        <div className="text-center text-[11px] font-bold text-slate-400">
          {ar ? '👀 إنت بتتفرج على الدور الحالي — الرد من اللاعب المستهدف بس' : '👀 You are watching this turn — only the asked player can answer'}
        </div>
      )}

      {/* up next + fairness */}
      {room.upcoming && room.upcoming.length > 0 && (
        <div data-testid="upcoming" className="text-center text-[10px] font-bold text-slate-400">
          {ar ? 'بعد كده: ' : 'Next: '}{room.upcoming.map(nextName).join('  •  ')}
          <div className="text-slate-500 mt-0.5">
            {ar ? 'اتسأل: ' : 'Asked: '}{room.players.map((p) => `${p.name} ${room.askedCounts?.[p.id] ?? 0}×`).join(' · ')}
          </div>
        </div>
      )}

      {/* my own picture (private) */}
      {room.mySecret && (
        <button type="button" onClick={() => setShowMine((v) => !v)} className="w-full px-4 py-3.5 rounded-2xl backdrop-blur-md bg-[#1b2150]/60 border border-indigo-300/30 text-base font-black text-indigo-100 cursor-pointer flex items-center justify-between gap-3">
          {showMine ? (
            <span className="inline-flex items-center gap-2 text-white"><img src={room.mySecret.imageUrl} alt="" className="w-9 h-9 object-contain" />{room.mySecret.title}</span>
          ) : (
            <span className="inline-flex items-center gap-3"><Eye className="w-6 h-6" />{ar ? 'اعرض صورتي السرية' : 'Show my secret picture'}</span>
          )}
          {showMine ? <ChevronDown className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
        </button>
      )}

      {/* history */}
      {room.questions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-black text-slate-400">{ar ? 'سجل الأسئلة' : 'History'}</div>
          {room.questions.slice(0, 12).map((q) => (
            <div key={q.id} className={`p-2.5 rounded-xl border text-xs ${q.wasWinningGuess ? 'bg-emerald-950/40 border-emerald-600/50' : 'bg-[#0F172A] border-slate-800'}`}>
              <div className="text-[10px] font-bold text-slate-500">{q.askerName} → {q.targetOwnerName}</div>
              <div className="font-black text-white">{q.question}</div>
              <div className="font-bold text-amber-300">{q.wasWinningGuess ? (ar ? '🏆 تخمين صحيح!' : '🏆 Correct!') : answerLabel(q.answer, lang)}{q.note && q.note !== '🏆' && ` — ${q.note}`}</div>
            </div>
          ))}
        </div>
      )}

      {room.hostId === me.id && (
        <button type="button" onClick={() => { if (window.confirm(ar ? 'إنهاء اللعبة للجميع؟' : 'End the game for everyone?')) onlineService.mpEndGame(); }} className="w-full h-9 text-[11px] font-bold text-slate-500 cursor-pointer">
          {ar ? 'إنهاء اللعبة' : 'End game'}
        </button>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// Results
// ----------------------------------------------------------------------------------------
const GameOver: React.FC<{ room: MpRoomState; lang: 'ar' | 'en'; onLeave: () => void }> = ({ room, lang, onLeave }) => {
  const ar = lang === 'ar';
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const isHost = room.hostId === room.meId;
  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl">🏆</div>
      <h2 className="text-2xl font-black text-white">{ar ? `${sorted[0].name} بطل اللعبة! 🎉` : `${sorted[0].name} wins! 🎉`}</h2>
      <div className="game-card-surface p-3 border border-slate-700 space-y-2">
        {sorted.map((p, i) => (
          <div key={p.id} className={`p-2.5 rounded-xl flex items-center justify-between border text-sm font-black ${i === 0 ? 'bg-amber-500/20 border-amber-400/60 text-white' : 'bg-[#0F172A] border-slate-800 text-slate-300'}`}>
            <span>{['🥇', '🥈', '🥉', '4️⃣'][i]} {p.name}{!p.connected && ' 📴'}</span>
            <span className="text-amber-400">{p.score} {ar ? 'نقاط' : 'pts'}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {room.players.map((p) => p.secret && (
          <div key={p.id} className="p-2 bg-[#0F172A] rounded-xl border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-purple-300 truncate">{p.name}</div>
            <img src={p.secret.imageUrl} alt="" className="w-full aspect-square object-contain rounded-lg bg-slate-900/60 p-1" />
            <div className="text-[11px] font-black text-white truncate">{p.secret.title}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {isHost ? (
          <button type="button" onClick={() => onlineService.mpPlayAgain()} className="flex-1 h-12 btn-premium-purple rounded-2xl font-black text-sm cursor-pointer active:scale-95">
            {ar ? 'العب مرة أخرى' : 'Play again'}
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[11px] font-bold text-slate-400">{ar ? 'صاحب الغرفة يقرر الجولة الجاية' : 'The host starts the next game'}</div>
        )}
        <button type="button" onClick={onLeave} className="px-5 h-12 btn-premium-surface text-slate-300 font-bold rounded-2xl text-sm cursor-pointer active:scale-95">
          {ar ? 'الرئيسية' : 'Home'}
        </button>
      </div>
    </div>
  );
};
