import React, { useEffect, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { liveVoiceManager, useVoiceChat } from '../utils/webrtcAudio';
import { sound } from '../utils/audio';

/**
 * Joins the room's voice channel (every online mode: 2, 3 or 4 players) and keeps the list of
 * the other players up to date. The microphone stays OFF until the player opens it.
 * Voice is independent from the game: nothing about turns/questions/rounds touches it.
 */
export function useJoinVoice(selfId: string | null, peerIds: string[]) {
  const key = peerIds.join('|');
  useEffect(() => {
    if (!selfId) return;
    liveVoiceManager.join(selfId);
    liveVoiceManager.setPeers(key ? key.split('|') : []);
  }, [selfId, key]);
}

interface VoiceChatBarProps {
  lang: 'ar' | 'en';
  selfId: string;
  selfName: string;
  players: { id: string; name: string }[]; // everyone in the room (including me)
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({ lang, selfId, selfName, players }) => {
  const voice = useVoiceChat();
  const [micError, setMicError] = useState<string | null>(null);
  const ar = lang === 'ar';
  const others = players.filter((p) => p.id !== selfId);

  const toggleMic = async () => {
    sound.playCardFlip();
    if (liveVoiceManager.isMicOn()) {
      liveVoiceManager.stopMic();
      setMicError(null);
      return;
    }
    const result = await liveVoiceManager.startMic();
    if (result === 'ok') setMicError(null);
    else if (result === 'denied')
      setMicError(ar ? 'تم رفض إذن المايك — فعّله من إعدادات المتصفح ثم حاول تاني' : 'Microphone permission denied — enable it in browser settings and try again');
    else if (result === 'unsupported')
      setMicError(ar ? 'مفيش مايك متاح على الجهاز (أو الموقع محتاج HTTPS)' : 'No microphone available (or the site needs HTTPS)');
    else setMicError(ar ? 'تعذر تشغيل المايك' : 'Could not start the microphone');
  };

  const status =
    voice.state === 'connected'
      ? ar ? '🎙️ متصل ✅' : '🎙️ Connected ✅'
      : voice.state === 'reconnecting'
        ? ar ? '⚠️ الصوت انقطع — جاري إعادة الاتصال...' : '⚠️ Voice lost — reconnecting...'
        : voice.state === 'error'
          ? ar ? '❌ تعذر الاتصال الصوتي' : '❌ Voice connection failed'
          : voice.state === 'waiting'
            ? ar ? '🎙️ في انتظار باقي اللاعبين...' : '🎙️ Waiting for the other players...'
            : ar ? '🎙️ بيتم توصيل الصوت...' : '🎙️ Connecting voice...';

  const dot =
    voice.state === 'connected' ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : voice.state === 'error' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse';

  const speakingNow = voice.localSpeaking
    ? ar ? '🎙️ بتتكلم...' : '🎙️ You are speaking...'
    : others.find((p) => voice.peers[p.id]?.speaking)
      ? ar
        ? `🎙️ ${others.find((p) => voice.peers[p.id]?.speaking)!.name} يتكلم...`
        : `🎙️ ${others.find((p) => voice.peers[p.id]?.speaking)!.name} is speaking...`
      : null;

  return (
    <div className="p-3 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border-2 border-slate-700/90 rounded-2xl shadow-md space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${dot}`} />
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-100">{status}</div>
            <div className="text-[10px] text-slate-400 font-bold truncate">
              {speakingNow ??
                (voice.micOn
                  ? ar ? '🎙️ المايك مفتوح' : '🎙️ Mic is on'
                  : ar ? '🔇 المايك مقفول — لسه بتسمع الآخرين' : '🔇 Mic is off — you can still hear others')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {voice.state === 'error' && (
            <button
              type="button"
              onClick={() => liveVoiceManager.retry()}
              className="px-3 py-2.5 rounded-xl text-xs font-black bg-amber-600 text-white border border-amber-400 cursor-pointer active:scale-95"
            >
              {ar ? 'إعادة المحاولة' : 'Retry'}
            </button>
          )}
          <button
            type="button"
            onClick={toggleMic}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md ${
              voice.micOn ? 'bg-rose-600 text-white border border-rose-400' : 'bg-emerald-600 text-white border border-emerald-400'
            }`}
          >
            {voice.micOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{voice.micOn ? (ar ? 'قفل المايك' : 'Mic off') : ar ? 'فتح المايك' : 'Mic on'}</span>
          </button>
        </div>
      </div>

      {/* Everyone's mic state, independent of whose turn it is */}
      <div className="flex flex-wrap gap-1.5">
        {[{ id: selfId, name: selfName }, ...others].map((p) => {
          const isMe = p.id === selfId;
          const peer = voice.peers[p.id];
          const mic = isMe ? voice.micOn : peer?.mic;
          const speaking = isMe ? voice.localSpeaking : peer?.speaking;
          const state = isMe ? 'connected' : peer?.state ?? 'waiting';
          return (
            <span
              key={p.id}
              className={`px-2 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 ${
                speaking ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-900/60 border-slate-700 text-slate-300'
              }`}
            >
              <span>{mic ? '🎙️' : '🔇'}</span>
              <span className="truncate max-w-[84px]">{p.name}</span>
              {!isMe && (
                <span title={state}>
                  {state === 'connected' ? '✅' : state === 'error' ? '❌' : state === 'waiting' ? '⏳' : '🔄'}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {micError && <div className="text-[11px] font-bold text-rose-300 text-center">{micError}</div>}
    </div>
  );
};
