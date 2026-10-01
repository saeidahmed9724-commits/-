import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { liveVoiceManager } from '../utils/webrtcAudio';
import { onlineService } from '../services/onlineGame';

export interface PlayerMicStatus {
  isMuted: boolean;
  isSpeaking: boolean;
}

interface RoomVoiceContextValue {
  isAvailable: boolean;
  isMyMicMuted: boolean;
  isMySpeaking: boolean;
  playersMicState: Record<string, PlayerMicStatus>;
  permissionState: 'prompt' | 'granted' | 'denied';
  errorMessage: string | null;
  toggleMyMic: (playerId?: string) => Promise<void>;
  togglePlayerMic: (playerId: string) => void;
  setPlayerMute: (playerId: string, muted: boolean) => void;
  getPlayerMicStatus: (playerId: string) => PlayerMicStatus;
  leaveRoom: () => void;
  initRoomVoice: (isOnline?: boolean, role?: 'host' | 'guest') => Promise<void>;
}

const RoomVoiceContext = createContext<RoomVoiceContextValue | null>(null);

interface RoomVoiceProviderProps {
  children: React.ReactNode;
  isRoomActive: boolean;
  localPlayerId?: string;
  isOnlineMatch?: boolean;
  onlineRole?: 'host' | 'guest';
}

export const RoomVoiceProvider: React.FC<RoomVoiceProviderProps> = ({
  children,
  isRoomActive,
  localPlayerId = 'p1',
  isOnlineMatch = false,
  onlineRole = 'host',
}) => {
  // Independent mic states for all players in the room
  const [playersMicState, setPlayersMicState] = useState<Record<string, PlayerMicStatus>>({
    p1: { isMuted: true, isSpeaking: false },
    p2: { isMuted: true, isSpeaking: false },
    host: { isMuted: true, isSpeaking: false },
    guest: { isMuted: true, isSpeaking: false },
  });

  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References for Web Audio analysis (speaking detection)
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(true);

  // Active key for current user (either localPlayerId or onlineRole)
  const effectiveMyId = isOnlineMatch ? onlineRole : localPlayerId;
  const isMyMicMuted = playersMicState[effectiveMyId]?.isMuted ?? true;
  const isMySpeaking = playersMicState[effectiveMyId]?.isSpeaking ?? false;

  // Keep isMutedRef in sync
  useEffect(() => {
    isMutedRef.current = isMyMicMuted;
  }, [isMyMicMuted]);

  // Handle incoming remote WebSocket MIC_STATE messages in online matches
  useEffect(() => {
    if (!isOnlineMatch) return;

    const unsubscribe = onlineService.subscribe((event) => {
      if (event.type === 'MIC_STATE' && event.fromRole) {
        const remoteRole = event.fromRole as 'host' | 'guest';
        setPlayersMicState((prev) => ({
          ...prev,
          [remoteRole]: {
            isMuted: Boolean(event.isMuted),
            isSpeaking: Boolean(event.isSpeaking),
          },
          [remoteRole === 'host' ? 'p1' : 'p2']: {
            isMuted: Boolean(event.isMuted),
            isSpeaking: Boolean(event.isSpeaking),
          },
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOnlineMatch]);

  // Start speaking detection loop using AnalyserNode
  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        audioContextRef.current = new AudioContextClass();
      }

      const audioCtx = audioContextRef.current;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingHoldCount = 0;
      isAnalyzingRef.current = true;

      const checkVolume = () => {
        if (!isAnalyzingRef.current || !analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // If not muted and volume exceeds speech threshold
        const currentlySpeaking = !isMutedRef.current && avg > 14;

        if (currentlySpeaking) {
          speakingHoldCount = 10; // keep indicator active briefly to avoid flicker
        } else if (speakingHoldCount > 0) {
          speakingHoldCount--;
        }

        const isSpeakingNow = speakingHoldCount > 0;

        setPlayersMicState((prev) => {
          const current = prev[effectiveMyId];
          if (current && current.isSpeaking === isSpeakingNow) return prev;

          const updated = {
            ...prev,
            [effectiveMyId]: {
              isMuted: isMutedRef.current,
              isSpeaking: isSpeakingNow,
            },
          };

          if (isOnlineMatch) {
            onlineService.sendMicState(isMutedRef.current, isSpeakingNow);
          }

          return updated;
        });

        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Audio speaking detection setup warning:', err);
    }
  }, [effectiveMyId, isOnlineMatch]);

  // Request stream once upon first user unmute
  const getOrCreateStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current && streamRef.current.active) {
      return streamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setPermissionState('granted');
      setErrorMessage(null);

      // Start volume/speaking detection
      startSpeakingDetection(stream);

      // If in online match, also connect WebRTC voice peer
      if (isOnlineMatch) {
        liveVoiceManager.start(onlineRole === 'host').catch(() => {});
      }

      return stream;
    } catch (err: any) {
      console.warn('Microphone permission / access error:', err);
      setPermissionState('denied');
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'يرجى السماح بالوصول إلى المايك في إعدادات المتصفح'
          : 'تعذر الوصول إلى المايك'
      );
      return null;
    }
  }, [isOnlineMatch, onlineRole, startSpeakingDetection]);

  // Toggle my local microphone ON / OFF (Manual control, strictly independent of game logic/turn)
  const toggleMyMic = useCallback(async (targetPlayerId?: string) => {
    const idToToggle = targetPlayerId || effectiveMyId;
    const currentMuteStatus = playersMicState[idToToggle]?.isMuted ?? true;
    const nextMuteStatus = !currentMuteStatus;

    if (!nextMuteStatus) {
      // User is turning mic ON: ensure we have microphone permission/stream
      const stream = await getOrCreateStream();
      if (!stream) {
        return;
      }
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    } else {
      // User is muting mic
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
    }

    isMutedRef.current = nextMuteStatus;

    setPlayersMicState((prev) => {
      const updated = {
        ...prev,
        [idToToggle]: {
          isMuted: nextMuteStatus,
          isSpeaking: false,
        },
      };

      if (isOnlineMatch) {
        onlineService.sendMicState(nextMuteStatus, false);
      }

      return updated;
    });
  }, [effectiveMyId, playersMicState, getOrCreateStream, isOnlineMatch]);

  // Toggle specific player mic in Pass & Play or Multiplayer
  const togglePlayerMic = useCallback((playerId: string) => {
    setPlayersMicState((prev) => {
      const current = prev[playerId]?.isMuted ?? true;
      const nextMute = !current;
      return {
        ...prev,
        [playerId]: {
          isMuted: nextMute,
          isSpeaking: false,
        },
      };
    });
  }, []);

  const setPlayerMute = useCallback((playerId: string, muted: boolean) => {
    setPlayersMicState((prev) => ({
      ...prev,
      [playerId]: {
        isMuted: muted,
        isSpeaking: false,
      },
    }));
  }, []);

  const getPlayerMicStatus = useCallback((playerId: string): PlayerMicStatus => {
    return playersMicState[playerId] || { isMuted: true, isSpeaking: false };
  }, [playersMicState]);

  // Initialize room voice if needed
  const initRoomVoice = useCallback(async (isOnline?: boolean, role?: 'host' | 'guest') => {
    if (isOnline) {
      liveVoiceManager.start(role === 'host').catch(() => {});
    }
  }, []);

  // Clean cleanup when user leaves the room completely (Back to Home)
  const leaveRoom = useCallback(() => {
    isAnalyzingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    liveVoiceManager.stop();

    setPlayersMicState({
      p1: { isMuted: true, isSpeaking: false },
      p2: { isMuted: true, isSpeaking: false },
      host: { isMuted: true, isSpeaking: false },
      guest: { isMuted: true, isSpeaking: false },
    });
    setErrorMessage(null);
  }, []);

  // Cleanup on unmount or when room ceases to be active
  useEffect(() => {
    if (!isRoomActive) {
      leaveRoom();
    }
  }, [isRoomActive, leaveRoom]);

  const value: RoomVoiceContextValue = {
    isAvailable: isRoomActive,
    isMyMicMuted,
    isMySpeaking,
    playersMicState,
    permissionState,
    errorMessage,
    toggleMyMic,
    togglePlayerMic,
    setPlayerMute,
    getPlayerMicStatus,
    leaveRoom,
    initRoomVoice,
  };

  return (
    <RoomVoiceContext.Provider value={value}>
      {children}
    </RoomVoiceContext.Provider>
  );
};

export const useRoomVoice = () => {
  const context = useContext(RoomVoiceContext);
  if (!context) {
    throw new Error('useRoomVoice must be used within a RoomVoiceProvider');
  }
  return context;
};
