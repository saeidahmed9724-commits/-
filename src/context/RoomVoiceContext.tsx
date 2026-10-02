import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { unifiedVoiceEngine, PeerVoiceState } from '../services/voiceEngine';

interface RoomVoiceContextValue {
  isOnlineActive: boolean;
  isMicOn: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  error: string | null;
  peers: Record<string, PeerVoiceState>;
  toggleMic: () => Promise<boolean>;
  setRoomActive: (active: boolean, myPlayerId?: string, roomCode?: string) => void;
}

const RoomVoiceContext = createContext<RoomVoiceContextValue>({
  isOnlineActive: false,
  isMicOn: false,
  isSpeaking: false,
  isConnecting: false,
  error: null,
  peers: {},
  toggleMic: async () => false,
  setRoomActive: () => {},
});

export const RoomVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnlineActive, setIsOnlineActive] = useState<boolean>(false);
  const [isMicOn, setIsMicOn] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, PeerVoiceState>>({});

  const activeRef = useRef({ active: false, playerId: '', roomCode: '' });

  useEffect(() => {
    const initial = unifiedVoiceEngine.getSnapshot();
    setIsMicOn(initial.isMicOn);
    setIsSpeaking(initial.isSpeaking);
    setIsConnecting(initial.isConnecting);
    setError(initial.error);
    setPeers(initial.peers);

    const unsubscribe = unifiedVoiceEngine.subscribe((state) => {
      setIsMicOn((prev) => (prev !== state.isMicOn ? state.isMicOn : prev));
      setIsSpeaking((prev) => (prev !== state.isSpeaking ? state.isSpeaking : prev));
      setIsConnecting((prev) => (prev !== state.isConnecting ? state.isConnecting : prev));
      setError((prev) => (prev !== state.error ? state.error : prev));
      setPeers((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(state.peers);
        if (prevKeys.length !== nextKeys.length) return state.peers;
        for (const k of nextKeys) {
          if (
            !prev[k] ||
            prev[k].isMuted !== state.peers[k].isMuted ||
            prev[k].isSpeaking !== state.peers[k].isSpeaking
          ) {
            return state.peers;
          }
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const setRoomActive = useCallback((active: boolean, myPlayerId?: string, roomCode?: string) => {
    const pid = myPlayerId || '';
    const rcode = roomCode || '';

    // If both current and target are inactive, do nothing
    if (!active && !activeRef.current.active) {
      return;
    }

    if (
      activeRef.current.active === active &&
      activeRef.current.playerId === pid &&
      activeRef.current.roomCode === rcode
    ) {
      return;
    }

    activeRef.current = { active, playerId: pid, roomCode: rcode };
    setIsOnlineActive(active);

    if (active && pid && rcode) {
      unifiedVoiceEngine.initRoom(pid, rcode);
    } else if (!active) {
      unifiedVoiceEngine.destroy();
    }
  }, []);

  const toggleMic = useCallback(async () => {
    return await unifiedVoiceEngine.toggleMic();
  }, []);

  const value = useMemo(
    () => ({
      isOnlineActive,
      isMicOn,
      isSpeaking,
      isConnecting,
      error,
      peers,
      toggleMic,
      setRoomActive,
    }),
    [isOnlineActive, isMicOn, isSpeaking, isConnecting, error, peers, toggleMic, setRoomActive]
  );

  return (
    <RoomVoiceContext.Provider value={value}>
      {children}
    </RoomVoiceContext.Provider>
  );
};

export const useRoomVoice = () => useContext(RoomVoiceContext);
