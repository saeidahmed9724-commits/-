import React, { useState } from 'react';
import { social, socialErrorText, useSocial, SentStatus } from '../../services/social';
import { sound } from '../../utils/audio';
import { Avatar, presenceRank } from './Avatar';

/** Inside a lobby: invite more friends into THIS room, and see who accepted / declined. */
export const FriendInvitePanel: React.FC<{ code: string; lang: 'ar' | 'en' }> = ({ code, lang }) => {
  const ar = lang === 'ar';
  const s = useSocial();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!s.account || s.friends.length === 0) return null;
  const sent = s.sent[code.toUpperCase()] ?? {};
  const friends = [...s.friends].sort((a, b) => presenceRank(a.status) - presenceRank(b.status) || a.name.localeCompare(b.name));

  const invite = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await social.invite(code, [id]);
      sound.playTurnChime();
    } catch (err) {
      setError(socialErrorText(err, ar));
    } finally {
      setBusyId(null);
    }
  };

  const label = (st: SentStatus | undefined, offline: boolean) => {
    if (st === 'accepted') return <span className="text-emerald-300">✅ {ar ? 'انضم' : 'Joined'}</span>;
    if (st === 'sent') return <span className="text-amber-300">⏳ {ar ? 'اتبعتله الدعوة' : 'Invitation sent'}</span>;
    if (st === 'declined') return <span className="text-rose-300">❌ {ar ? 'رفض الدعوة' : 'Declined'}</span>;
    if (st === 'expired') return <span className="text-slate-400">{ar ? 'الدعوة انتهت' : 'Expired'}</span>;
    return offline ? <span className="text-slate-400">{ar ? 'هتوصله لما يرجع' : 'Gets it when back'}</span> : null;
  };

  return (
    <div className="rounded-2xl bg-[#1b2150]/60 border border-indigo-300/30 p-3 space-y-2 text-start">
      <div className="text-xs font-black text-white px-1">{ar ? '👥 ادعُ أصدقاءك للغرفة دي' : '👥 Invite friends to this room'}</div>
      {friends.slice(0, 8).map((f) => {
        const st = sent[f.id];
        return (
          <div key={f.id} className="flex items-center gap-2.5 p-1.5 rounded-xl bg-[#0a1030]/50">
            <Avatar emoji={f.avatar} status={f.status} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-white truncate">{f.name}</div>
              <div className="text-[10px] font-bold">{label(st, f.status === 'offline')}</div>
            </div>
            {st !== 'accepted' && (
              <button type="button" disabled={busyId === f.id} onClick={() => invite(f.id)} className="px-3 h-8 rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-[11px] font-black cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap">
                {st === 'sent' ? (ar ? 'إعادة إرسال' : 'Resend') : ar ? 'دعوة' : 'Invite'}
              </button>
            )}
          </div>
        );
      })}
      {error && <div role="alert" className="text-[11px] font-bold text-rose-300 px-1">{error}</div>}
    </div>
  );
};
