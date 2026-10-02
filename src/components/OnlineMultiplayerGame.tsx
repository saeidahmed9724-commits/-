import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, Copy, Crown, Link2, Lock, Search, Send } from 'lucide-react';
import { AnswerType, CategoryPresetItem, MpPlayerView, MpRoomState } from '../types/game';
import { onlineService } from '../services/onlineGame';
import { sound } from '../utils/audio';
import { VoiceChatBar, useJoinVoice } from './VoiceChatBar';

/**
 * 3 / 4 players ONLINE. Every player is on their own device and joins the same room with a
 * room code / invite link. The server keeps the game state; this component only renders it and
 * sends the player's own actions. The voice chat (VoiceChatBar) is separate from all of it.
 */
interface Props {
  room: MpRoomState | null;
  onLeave: () => void;
  lang: 'ar' | 'en';
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

export const OnlineMultiplayerGame: React.FC<Props> = ({ room, onLeave, lang }) => {
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

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-3 pb-6 select-none animate-scale-up">
      <VoiceChatBar
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
  const [selected, setSelected] = useState<CategoryPresetItem | null>(null);
  const [query, setQuery] = useState('');

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

  const q = query.toLowerCase().trim();
  const items = room.category.presetItems.filter((i) => !q || i.nameAr.toLowerCase().includes(q) || i.nameEn.toLowerCase().includes(q));
  const title = (i: CategoryPresetItem) => (ar ? i.nameAr : i.nameEn);

  return (
    <div className="space-y-3">
      <div className="game-card-surface p-3 border border-purple-500/40 space-y-2">
        <p className="text-xs text-amber-300 font-bold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-center">
          {ar ? `اختر صورتك السرية من (${room.category.nameAr}) — محدش هيشوفها غيرك!` : `Pick your secret picture from (${room.category.nameEn}) — only you can see it!`}
        </p>
        <div className="relative">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? 'بحث...' : 'Search...'} className="w-full h-10 bg-[#0F172A] border border-slate-700 focus:border-purple-500 rounded-xl ps-9 pe-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none" />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 max-h-[48vh] overflow-y-auto pe-1">
        {items.map((item) => {
          const on = selected?.id === item.id;
          return (
            <button key={item.id} type="button" onClick={() => { sound.playCardFlip(); setSelected(item); }} className={`p-2.5 rounded-2xl border-2 flex flex-col items-center gap-2 cursor-pointer active:scale-95 relative ${on ? 'bg-purple-600/25 border-purple-500 ring-2 ring-purple-400' : 'bg-[#0F172A] border-slate-800 text-slate-300'}`}>
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900/60 p-2 flex items-center justify-center relative">
                <img src={item.imageUrl} alt={title(item)} className="w-full h-full object-contain rounded-lg" loading="lazy" />
                {on && <div className="absolute top-1 end-1 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>}
              </div>
              <div className="text-xs font-black text-white truncate w-full px-1">{title(item)}</div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          sound.playCardFlip();
          onlineService.mpSubmitPicture(selected.imageUrl, title(selected));
        }}
        className="w-full h-13 btn-premium-purple rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer active:scale-95"
      >
        <Lock className="w-4 h-4" />
        <span>{ar ? 'قفل صورتي السرية 🔒' : 'Lock my secret picture 🔒'}</span>
      </button>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// The table
// ----------------------------------------------------------------------------------------
const Arena: React.FC<{ room: MpRoomState; me: MpPlayerView; lang: 'ar' | 'en' }> = ({ room, me, lang }) => {
  const ar = lang === 'ar';
  const [target, setTarget] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [showMine, setShowMine] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const pq = room.pendingQuestion;
  const active = room.players.find((p) => p.id === room.activePlayerId);
  const myTurn = room.activePlayerId === me.id;
  const iAmTarget = pq?.targetOwnerId === me.id;
  const targets = room.players.filter((p) => p.id !== me.id && p.hasPicked);
  const free = targets.filter((p) => !me.solved[p.id] && p.connected);

  // Default / keep a valid target selected.
  useEffect(() => {
    if (myTurn && !free.some((p) => p.id === target)) setTarget(free[0]?.id ?? null);
  }, [myTurn, free.map((p) => p.id).join(','), target]);

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
    if (!target || !text.trim()) return;
    sound.playTurnChime();
    onlineService.mpAsk(target, text.trim());
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
      {/* scores */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {room.players.map((p) => (
          <div key={p.id} className={`px-3 py-1.5 rounded-2xl border text-xs font-black flex items-center gap-2 shrink-0 ${p.id === room.activePlayerId ? 'bg-purple-600/30 border-purple-500 text-white ring-2 ring-purple-400' : 'bg-[#0F172A] border-slate-800 text-slate-300'} ${!p.connected ? 'opacity-50' : ''}`}>
            <span className="truncate max-w-[80px]">{p.name}{p.id === me.id && (ar ? ' (أنت)' : ' (you)')}{!p.connected && ' 📴'}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-amber-400 font-mono text-[11px]">{p.score}/{totalTargets}</span>
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
        <div className="game-card-surface p-4 border border-amber-500/50 space-y-3">
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

      {/* 2) my turn: choose a target and ask */}
      {!pq && myTurn && (
        <div className="game-card-surface p-4 border border-purple-500/50 space-y-3">
          <div className="text-sm font-black text-white">{ar ? 'دورك الآن 🎯' : 'Your turn 🎯'}</div>
          <div className="grid grid-cols-2 gap-2">
            {targets.map((p) => {
              const solved = me.solved[p.id];
              const on = target === p.id;
              return (
                <button key={p.id} type="button" disabled={Boolean(solved) || !p.connected} onClick={() => { sound.playCardFlip(); setTarget(p.id); }} className={`p-2.5 rounded-2xl border-2 text-start text-xs font-black cursor-pointer ${solved ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300' : on ? 'bg-purple-600/25 border-purple-500 ring-2 ring-purple-400 text-white' : 'bg-[#0F172A] border-slate-800 text-slate-300'} ${!p.connected && !solved ? 'opacity-40' : ''}`}>
                  <div>{p.name}{!p.connected && ' 📴'}</div>
                  {solved ? (
                    <div className="flex items-center gap-1.5 mt-1"><img src={solved.imageUrl} alt="" className="w-7 h-7 object-contain" /><span className="truncate">{solved.title}</span></div>
                  ) : (
                    <div className="text-[10px] text-slate-400 mt-1">{ar ? 'صورة سرية ❓' : 'Secret picture ❓'}</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={ar ? 'اكتب سؤالك عن الصورة...' : 'Type your question...'} className="flex-1 h-12 bg-[#070D1E] border border-slate-700 focus:border-blue-500 rounded-xl px-3 text-sm text-white font-bold placeholder-slate-500 focus:outline-none" />
            <button type="button" disabled={!target || !text.trim()} onClick={send} className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 3) someone else's turn */}
      {!pq && !myTurn && (
        <div className="game-card-surface p-4 border border-slate-700 text-center text-sm font-black text-slate-300">
          {ar ? `دور ${active?.name ?? '...'} 🎯` : `${active?.name ?? '...'}'s turn 🎯`}
          <div className="text-[11px] font-bold text-slate-500 mt-1">{ar ? 'تقدر تتكلم وتسمع الكل في أي وقت 🎙️' : 'You can talk and listen any time 🎙️'}</div>
        </div>
      )}

      {/* my own picture (private) */}
      {room.mySecret && (
        <button type="button" onClick={() => setShowMine((v) => !v)} className="w-full p-2 rounded-xl bg-[#0F172A] border border-slate-800 text-[11px] font-bold text-slate-400 cursor-pointer text-center">
          {showMine ? (
            <span className="inline-flex items-center gap-2 text-slate-200"><img src={room.mySecret.imageUrl} alt="" className="w-8 h-8 object-contain" />{room.mySecret.title}</span>
          ) : (
            ar ? '👁️ اعرض صورتي السرية' : '👁️ Show my secret picture'
          )}
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
