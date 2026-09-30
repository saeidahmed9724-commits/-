import React from 'react';
import { HelpCircle, X, Check, X as WrongIcon } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="game-card-surface border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">
                {lang === 'ar' ? 'طريقة اللعب: إيه اللي معايا؟ 🎮' : 'How to Play: What Do I Have? 🎮'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3.5 text-xs sm:text-sm">
          {/* Step 1 */}
          <div className="p-3.5 bg-[#0F172A] rounded-2xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-mono">1</span>
              <span>{lang === 'ar' ? 'تصنيف موحد للجولة 🍔 🐾' : 'One Category Per Round'}</span>
            </div>
            <p className="text-slate-400 ps-7 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'يتم اختيار تصنيف واحد للجولة (أكل، حيوانات، سيارات...). الصورتان يجب أن تكونا من نفس التصنيف!'
                : 'Both secret pictures must belong to the chosen category (Food, Animals, Cars...).'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 bg-[#0F172A] rounded-2xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-mono">2</span>
              <span>{lang === 'ar' ? 'أنت تختار صورة لخصمك 🤫' : 'Pick a Secret Picture for Opponent'}</span>
            </div>
            <p className="text-slate-400 ps-7 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'كل لاعب يختار أو يبحث عن صورة سرية للخصم. لا أحد يعرف الصورة التي في يده!'
                : 'Each player selects a secret picture for the opponent. Neither knows their own.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 bg-[#0F172A] rounded-2xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-mono">3</span>
              <span>{lang === 'ar' ? 'الخصم يجاوب يدويًا + ملاحظة اختيارية 📝' : 'Opponent Answers Manually + Note'}</span>
            </div>
            <p className="text-slate-400 ps-7 font-medium leading-relaxed">
              {lang === 'ar'
                ? 'الخصم هو من يرى صورتك ويحدد الإجابة (نعم / لا / أحيانًا / مش متأكد) مع إمكانية كتابة ملاحظة تظهر لك في سجل الأسئلة.'
                : 'The opponent sees your card and chooses the answer (Yes / No / Sometimes / Not Sure) with an optional note.'}
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 bg-[#0F172A] rounded-2xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs font-mono">4</span>
              <span>{lang === 'ar' ? 'التخمين وتحكيم الخصم ⚖️' : 'Guessing & Opponent Verdict'}</span>
            </div>
            <div className="ps-7 space-y-1 font-medium text-slate-300">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'الخصم يضغط «صح، دي الصورة»: تنتهي الجولة فوراً مع كشف الصورتين ونقطة!' : 'Opponent confirms: round ends with +1 point and reveal!'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-xs">🔄</span>
                <span>{lang === 'ar' ? 'لو الخصم ضغط «لا، تخمين غلط»: لا توجد خسارة، وتستمر اللعبة عادي ويمكنك التخمين لاحقاً.' : 'Wrong guess has no penalty; game continues normally.'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 btn-premium-gold text-slate-950 font-black rounded-2xl text-sm transition-all cursor-pointer active:scale-98"
        >
          {lang === 'ar' ? 'فهمت، فلنبدأ اللعب! 🚀' : 'Got it, let us play! 🚀'}
        </button>
      </div>
    </div>
  );
};
