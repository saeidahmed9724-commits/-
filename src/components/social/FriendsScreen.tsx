import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, Link2, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { FriendView, social, socialErrorText, useSocial } from '../../services/social';
import { sound } from '../../utils/audio';
import { Avatar, StatusLine, presenceRank } from './Avatar';
import { AccountSetupModal } from './AccountSetupModal';

interface Props {
  lang: 'ar' | 'en';
  onBack: () => void;
  /** one tap: start a 2-player game with this friend */
  onInvite: (friend: FriendView) => void;
  prefillUsername?: string;
}

const GLASS = 'rounded-[26px] border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)]';

export const FriendsScreen: React.FC<Props> = ({ lang, onBack, onInvite, prefillUsername }) => {
  const ar = lang === 'ar';
  const s = useSocial();
  const [value, setValue] = useState(prefillUsername ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<'id' | 'link' | null>(null);
  const [editing, setEditing] = useState(false);
  const [rowError, setRowError] = useState('');

  const me = s.account;
  const friends = [...s.friends].sort((a, b) => presenceRank(a.status) - presenceRank(b.status) || a.name.localeCompare(b.name));
  const onlineCount = friends.filter((f) => f.status !== 'offline').length;

  const copy = async (what: 'id' | 'link') => {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(what === 'id' ? `@${me.username}` : `${window.location.origin}/?add=${me.username}`);
      setCopied(what);
      sound.playYesSound();
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = value.trim();
    if (!u) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await social.addFriend(u);
      sound.playYesSound();
      setValue('');
      setMsg({
        ok: true,
        text:
          r.kind === 'friends'
            ? ar ? `انتوا أصحاب دلوقتي مع ${r.user.name} 🎉` : `You and ${r.user.name} are friends now 🎉`
            : ar ? `اتبعت طلب الصداقة لـ ${r.user.name}` : `Friend request sent to ${r.user.name}`,
      });
    } catch (err) {
      sound.playWrongBuzzer();
      setMsg({ ok: false, text: socialErrorText(err, ar) });
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setRowError('');
    try {
      await fn();
      sound.playCardFlip();
    } catch (err) {
      setRowError(socialErrorText(err, ar));
    }
  };

  const remove = (f: FriendView) => {
    if (window.confirm(ar ? `تشيل ${f.name} من أصدقائك؟` : `Remove ${f.name} from your friends?`)) run(() => social.removeFriend(f.id));
  };

  return (
    <div className="w-full max-w-[440px] mx-auto px-3 py-3 space-y-3 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { sound.playCardFlip(); onBack(); }} className="px-5 h-11 rounded-full border border-indigo-300/30 bg-[#1b2150]/60 text-white text-sm font-black flex items-center gap-2 cursor-pointer active:scale-95">
          <ArrowLeft className={`w-4 h-4 ${ar ? 'rotate-180' : ''}`} />
          {ar ? 'رجوع' : 'Back'}
        </button>
        <h1 className="text-lg font-black text-white">{ar ? '👥 الأصدقاء' : '👥 Friends'}</h1>
      </div>

      {s.connection !== 'online' && (
        <div className="px-3 py-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-bold text-center animate-pulse">
          {s.connection === 'connecting' ? (ar ? 'جاري الاتصال...' : 'Connecting...') : ar ? 'مفيش اتصال — بنحاول نوصّل تاني' : 'Offline — trying to reconnect'}
        </div>
      )}

      {/* my ID */}
      {me && (
        <div className={`${GLASS} p-4 space-y-3`}>
          <div className="flex items-center gap-3">
            <Avatar emoji={me.avatar} status={s.connection === 'online' ? 'online' : 'offline'} size={52} />
            <div className="flex-1 min-w-0">
              <div className="text-base font-black text-white truncate">{me.name}</div>
              <div dir="ltr" className="text-sm font-black text-amber-300 text-start">@{me.username}</div>
            </div>
            <button type="button" aria-label={ar ? 'تعديل' : 'Edit'} onClick={() => setEditing(true)} className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-300/40 text-white flex items-center justify-center cursor-pointer active:scale-95">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => copy('id')} className="h-10 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
              {copied === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {ar ? 'نسخ الـ ID' : 'Copy ID'}
            </button>
            <button type="button" onClick={() => copy('link')} className="h-10 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
              {copied === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
              {ar ? 'نسخ لينك الإضافة' : 'Copy add-link'}
            </button>
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
            {ar ? 'ابعت الـ ID أو اللينك لصاحبك مرة واحدة بس. بعد ما يضيفك مش هتحتاج كود تاني.' : 'Send your ID or link once. After they add you, no more codes.'}
          </p>
        </div>
      )}

      {/* add friend */}
      <form onSubmit={add} className={`${GLASS} p-4 space-y-2`}>
        <div className="text-sm font-black text-white flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-300" />
          {ar ? 'إضافة صديق' : 'Add a friend'}
        </div>
        <div className="flex gap-2">
          <div dir="ltr" className="flex-1 min-w-0 flex items-center gap-1 h-12 px-3 rounded-2xl bg-[#0a1030]/80 border border-indigo-300/30 focus-within:border-blue-400">
            <span className="text-slate-400 font-black">@</span>
            <input value={value} onChange={(e) => { setValue(e.target.value.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)); setMsg(null); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder={ar ? 'ID صاحبك' : "friend's ID"} className="flex-1 min-w-0 bg-transparent text-white font-bold text-base outline-none placeholder:text-slate-600" />
          </div>
          <button type="submit" disabled={busy || value.length < 3} className="px-5 h-12 rounded-2xl bg-gradient-to-b from-blue-500 to-violet-600 border border-white/30 text-white text-sm font-black cursor-pointer active:scale-95 disabled:opacity-40">
            {busy ? '...' : ar ? 'إضافة' : 'Add'}
          </button>
        </div>
        {msg && <div role="status" className={`text-xs font-bold ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</div>}
      </form>

      {rowError && <div role="alert" className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-bold text-center">{rowError}</div>}

      {/* incoming requests */}
      {s.incoming.length > 0 && (
        <div className={`${GLASS} p-3 space-y-2`}>
          <div className="text-xs font-black text-amber-300 px-1">{ar ? `طلبات صداقة (${s.incoming.length})` : `Friend requests (${s.incoming.length})`}</div>
          {s.incoming.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 p-2 rounded-2xl bg-[#0a1030]/50">
              <Avatar emoji={r.user.avatar} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white truncate">{r.user.name}</div>
                <div dir="ltr" className="text-[11px] font-bold text-slate-400 text-start">@{r.user.username}</div>
              </div>
              <button type="button" onClick={() => run(() => social.acceptRequest(r.id))} className="px-3 h-9 rounded-xl bg-emerald-600 border border-emerald-400 text-white text-xs font-black cursor-pointer active:scale-95">{ar ? 'قبول' : 'Accept'}</button>
              <button type="button" aria-label={ar ? 'رفض' : 'Decline'} onClick={() => run(() => social.declineRequest(r.id))} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* friends */}
      <div className={`${GLASS} p-3 space-y-2`}>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-200">{ar ? `أصدقائي (${friends.length})` : `My friends (${friends.length})`}</span>
          {friends.length > 0 && <span className="text-[11px] font-black text-emerald-300">{ar ? `${onlineCount} متصل` : `${onlineCount} online`}</span>}
        </div>

        {friends.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <div className="text-3xl">🫂</div>
            <div className="text-sm font-black text-white">{ar ? 'لسه مفيش أصدقاء' : 'No friends yet'}</div>
            <div className="text-xs font-bold text-slate-400 px-4">{ar ? 'ضيف صاحبك بالـ ID بتاعه، أو ابعتله لينك الإضافة فوق.' : "Add a friend by their ID, or send them your add-link above."}</div>
          </div>
        ) : (
          friends.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 p-2 rounded-2xl bg-[#0a1030]/50">
              <Avatar emoji={f.avatar} status={f.status} size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white truncate">{f.name}</div>
                <div className="flex items-center gap-2">
                  <StatusLine status={f.status} ar={ar} />
                  <span dir="ltr" className="text-[10px] font-bold text-slate-500 truncate">@{f.username}</span>
                </div>
              </div>
              <button type="button" onClick={() => onInvite(f)} className="px-3 h-9 rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-xs font-black cursor-pointer active:scale-95 whitespace-nowrap">
                {ar ? 'دعوة للعب' : 'Invite'}
              </button>
              <button type="button" aria-label={ar ? 'إزالة' : 'Remove'} onClick={() => remove(f)} className="w-8 h-9 text-slate-500 hover:text-rose-400 flex items-center justify-center cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* sent requests */}
      {s.outgoing.length > 0 && (
        <div className={`${GLASS} p-3 space-y-2`}>
          <div className="text-xs font-black text-slate-300 px-1">{ar ? 'طلبات مبعوتة (في الانتظار)' : 'Sent requests (waiting)'}</div>
          {s.outgoing.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 p-2 rounded-2xl bg-[#0a1030]/50">
              <Avatar emoji={r.user.avatar} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white truncate">{r.user.name}</div>
                <div dir="ltr" className="text-[11px] font-bold text-slate-400 text-start">@{r.user.username}</div>
              </div>
              <button type="button" onClick={() => run(() => social.cancelRequest(r.id))} className="px-3 h-8 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-[11px] font-black cursor-pointer active:scale-95">{ar ? 'إلغاء' : 'Cancel'}</button>
            </div>
          ))}
        </div>
      )}

      <AccountSetupModal mode="edit" isOpen={editing} onClose={() => setEditing(false)} onDone={() => setEditing(false)} lang={lang} />
    </div>
  );
};
