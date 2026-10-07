import React, { useEffect, useState } from 'react';
import { InviteView, social, socialErrorText, useSocial } from '../../services/social';
import { sound } from '../../utils/audio';
import { Avatar } from './Avatar';

interface Props {
  lang: 'ar' | 'en';
  /** Called when the player taps "accept". Must join the room (and throw if that fails). */
  onAccept: (invite: InviteView) => Promise<void>;
}

/** "🎮 سعيد دعاك للعب" — shown on top of ANY screen while an invitation is waiting. */
export const InviteOverlay: React.FC<Props> = ({ lang, onAccept }) => {
  const ar = lang === 'ar';
  const { invites } = useSocial();
  const inv = invites[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setError(''), [inv?.id]);

  if (!inv || !inv.from) return null;

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await onAccept(inv);
    } catch (err) {
      sound.playWrongBuzzer();
      setError(socialErrorText(err, ar));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="alertdialog" aria-label={ar ? 'دعوة للعب' : 'Game invitation'} className="fixed top-3 inset-x-3 z-[60] mx-auto max-w-[420px] animate-scale-up">
      <div className="rounded-3xl border-2 border-amber-300/60 bg-[#141a45]/95 backdrop-blur-md shadow-[0_0_34px_rgba(251,191,36,0.35)] p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar emoji={inv.from.avatar} size={48} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-white leading-snug">
              🎮 {ar ? <><span className="text-amber-300">{inv.from.name}</span> دعاك للعب</> : <><span className="text-amber-300">{inv.from.name}</span> invited you to play</>}
            </div>
            <div className="text-[11px] font-bold text-slate-300">
              {ar ? `«إيه اللي معايا؟» · ${inv.maxPlayers} لاعبين` : `"What Do I Have?" · ${inv.maxPlayers} players`}
              {invites.length > 1 && <span className="text-amber-300"> · {ar ? `+${invites.length - 1} دعوات أخرى` : `+${invites.length - 1} more`}</span>}
            </div>
          </div>
        </div>
        {error && <div role="alert" className="text-xs font-bold text-rose-300 text-center">{error}</div>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={accept} className="h-11 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 border border-emerald-200/40 text-white text-sm font-black cursor-pointer active:scale-95 disabled:opacity-60">
            {busy ? (ar ? 'جاري الدخول...' : 'Joining...') : ar ? 'قبول' : 'Accept'}
          </button>
          <button type="button" disabled={busy} onClick={() => { sound.playCardFlip(); social.declineInvite(inv.id); }} className="h-11 rounded-2xl bg-slate-800 border border-slate-600 text-slate-200 text-sm font-black cursor-pointer active:scale-95 disabled:opacity-60">
            {ar ? 'رفض' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
};
