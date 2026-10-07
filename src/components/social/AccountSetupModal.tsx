import React, { useEffect, useRef, useState } from 'react';
import { X, User, AtSign } from 'lucide-react';
import { AVATARS, USERNAME_RE } from '../../../social/shared';
import { social, socialErrorText, SocialProfile, useSocial } from '../../services/social';
import { sound } from '../../utils/audio';
import { Avatar } from './Avatar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDone: (profile: SocialProfile) => void;
  lang: 'ar' | 'en';
  /** 'create' = first time (name + @ID + avatar); 'edit' = change name/avatar (the ID never changes) */
  mode?: 'create' | 'edit';
}

/** One-time profile: a name, a friend ID (@username) and an avatar. No e-mail, no password. */
export const AccountSetupModal: React.FC<Props> = ({ isOpen, onClose, onDone, lang, mode = 'create' }) => {
  const ar = lang === 'ar';
  const { account } = useSocial();
  const editing = mode === 'edit' && account;
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [avail, setAvail] = useState<'unknown' | 'ok' | 'taken' | 'invalid'>('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checkSeq = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setAvail('unknown');
    if (editing) {
      setName(account!.name);
      setAvatar(account!.avatar);
      setUsername(account!.username);
    } else {
      setName('');
      setUsername('');
      setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    }
  }, [isOpen]);

  // live "is this ID free?" check (debounced)
  useEffect(() => {
    if (editing || !username) return setAvail('unknown');
    if (!USERNAME_RE.test(username)) return setAvail('invalid');
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      const ok = await social.checkUsername(username);
      if (seq === checkSeq.current) setAvail(ok ? 'ok' : 'taken');
    }, 350);
    return () => clearTimeout(t);
  }, [username, editing]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(ar ? 'اكتب اسمك' : 'Enter your name');
    if (!editing && username && !USERNAME_RE.test(username)) return setError(socialErrorText(new Error('INVALID_USERNAME'), ar));
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await social.updateProfile(name.trim(), avatar);
        onDone({ ...account!, name: name.trim(), avatar });
      } else {
        onDone(await social.register(name.trim(), username || undefined, avatar));
      }
      sound.playYesSound();
    } catch (err) {
      sound.playWrongBuzzer();
      setError(socialErrorText(err, ar));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 animate-fade-in">
      <form onSubmit={submit} className="w-full max-w-sm bg-[#141a45]/95 border-2 border-indigo-300/30 rounded-3xl p-5 shadow-2xl space-y-4 relative max-h-[92vh] overflow-y-auto animate-scale-up">
        <button type="button" aria-label={ar ? 'إغلاق' : 'Close'} onClick={onClose} className="absolute top-4 end-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1 pt-1">
          <div className="flex justify-center">
            <Avatar emoji={avatar} size={64} />
          </div>
          <h3 className="text-xl font-black text-white">
            {editing ? (ar ? 'تعديل ملفك' : 'Edit your profile') : ar ? 'اعمل ملفك مرة واحدة 👋' : 'Create your profile (once) 👋'}
          </h3>
          {!editing && (
            <p className="text-xs font-bold text-slate-300 px-2 leading-relaxed">
              {ar ? 'صحابك هيضيفوك بالـ ID ده، وبعدها تلعبوا مع بعض من غير أكواد ولا واتساب.' : 'Friends add you with this ID, then you play together with no codes and no chat apps.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {AVATARS.map((a) => (
            <button key={a} type="button" onClick={() => setAvatar(a)} className={`h-10 rounded-xl text-xl flex items-center justify-center cursor-pointer active:scale-95 border ${a === avatar ? 'border-amber-400 bg-amber-400/15' : 'border-indigo-300/20 bg-[#0a1030]/60'}`}>
              {a}
            </button>
          ))}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-black text-white">{ar ? 'اسمك' : 'Your name'}</span>
          <div className="flex items-center gap-2 h-12 px-3 rounded-2xl bg-[#0a1030]/80 border border-indigo-300/30 focus-within:border-blue-400">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="off" placeholder={ar ? 'اكتب اسمك هنا...' : 'Enter your name...'} className="flex-1 min-w-0 bg-transparent text-white font-bold text-base outline-none placeholder:text-slate-500" />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-black text-white">{ar ? 'الـ ID بتاعك (اللي صحابك هيدوروا بيه)' : 'Your friend ID'}</span>
          <div dir="ltr" className={`flex items-center gap-2 h-12 px-3 rounded-2xl bg-[#0a1030]/80 border focus-within:border-blue-400 ${editing ? 'opacity-60 border-indigo-300/20' : 'border-indigo-300/30'}`}>
            <AtSign className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={username}
              readOnly={Boolean(editing)}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="saeed123"
              className="flex-1 min-w-0 bg-transparent text-white font-bold text-base outline-none placeholder:text-slate-600"
            />
            {avail === 'ok' && <span className="text-emerald-400 text-xs font-black">✓</span>}
            {avail === 'taken' && <span className="text-rose-400 text-xs font-black">✗</span>}
          </div>
          <p className="text-[11px] font-bold text-slate-400">
            {editing
              ? ar ? 'الـ ID مبيتغيرش' : 'The ID cannot be changed'
              : avail === 'taken' ? (ar ? 'الـ ID ده واخده حد' : 'That ID is taken')
              : avail === 'invalid' ? (ar ? '3–20 حرف إنجليزي صغير أو رقم أو _' : '3–20 lowercase letters, digits or _')
              : ar ? 'اختياري — لو سبته فاضي هنختارلك واحد' : 'Optional — leave empty and we pick one'}
          </p>
        </label>

        {error && <div role="alert" className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-bold text-center">{error}</div>}

        <button type="submit" disabled={busy || avail === 'taken'} className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-base font-black shadow-lg cursor-pointer active:scale-95 disabled:opacity-50">
          {busy ? (ar ? 'ثواني...' : 'One moment...') : editing ? (ar ? 'حفظ' : 'Save') : ar ? 'يلا نبدأ' : "Let's go"}
        </button>
      </form>
    </div>
  );
};
