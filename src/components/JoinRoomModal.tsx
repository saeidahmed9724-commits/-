import React, { useState } from 'react';
import { KeyRound, ArrowRight, X, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface JoinRoomModalProps {
  isOpen: boolean;
  initialCode?: string;
  onJoin: (code: string, playerName: string) => Promise<void>;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  initialCode = '',
  onJoin,
  onClose,
  lang,
}) => {
  const [code, setCode] = useState<string>(initialCode);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    setError(null);
    setLoading(true);
    sound.playTurnChime();

    try {
      await onJoin(code.trim().toUpperCase(), name.trim());
    } catch {
      setError(
        lang === 'ar'
          ? 'تعذر الاتصال بالغرفة. تأكد من صحة الكود.'
          : 'Could not connect to room. Check code.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border-2 border-[#171717] rounded-3xl max-w-md w-full p-6 sm:p-7 game-card-shadow-lg space-y-5 animate-scale-up">
        <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#6C5CE7]" />
            <h3 className="text-xl font-black text-[#171717]">
              {lang === 'ar' ? 'ادخل كود الغرفة' : 'Join Game Room'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-[#171717] p-1 font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
              {lang === 'ar' ? 'كود الغرفة' : 'Room Code'}
            </label>
            <input
              type="text"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A7K92"
              maxLength={7}
              className="w-full bg-[#F5F3EE] border-2 border-[#171717] rounded-2xl px-4 py-3 text-2xl font-black font-mono tracking-widest text-[#171717] focus:outline-none text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
              {lang === 'ar' ? 'اسمك' : 'Your Name'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب اسمك...' : 'Enter your name...'}
              className="w-full bg-[#F5F3EE] border-2 border-[#E5E1D8] focus:border-[#171717] rounded-xl px-4 py-2.5 text-base font-bold text-[#171717] focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-[#171717]"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={loading || !code.trim() || !name.trim()}
              className="px-6 py-2.5 bg-[#6C5CE7] hover:bg-[#5b4bc4] disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <span>{loading ? (lang === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...') : (lang === 'ar' ? 'دخول الغرفة →' : 'JOIN ROOM →')}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
