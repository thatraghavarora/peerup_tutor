import { useState, useEffect, useRef } from 'react';
import {
  PhoneOff, Mic, MicOff, Camera, CameraOff,
  MonitorUp, MessageSquare, Clock, RefreshCcw, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface VideoCallScreenProps {
  doubtId?: string;
  currentUserId?: string;
  onEnd: () => void;
  remoteName: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
];

// Tutor = ANSWERER
export function VideoCallScreen({ doubtId, currentUserId, onEnd, remoteName }: VideoCallScreenProps) {
  const [isMicOn, setIsMicOn]             = useState(true);
  const [isCamOn, setIsCamOn]             = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [time, setTime]                   = useState(0);
  const [status, setStatus]               = useState('Starting camera...');
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [retryCount, setRetryCount]       = useState(0);

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStream    = useRef<MediaStream | null>(null);
  const screenStream   = useRef<MediaStream | null>(null);
  const sigChannel     = useRef<any>(null);

  // Queue remote ICE until remoteDescription is set
  const pendingIce     = useRef<RTCIceCandidateInit[]>([]);
  // Prevent double-answering the same offer
  const isAnswering    = useRef(false);

  const roomId = `webrtc_${(doubtId || 'default').toLowerCase()}`;

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Main setup / tear-down ─────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    init(alive);
    return () => { alive = false; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doubtId, retryCount]);

  // ── Init ───────────────────────────────────────────────────────────────────
  const init = async (alive: boolean) => {
    pendingIce.current  = [];
    isAnswering.current = false;
    setRemoteStreamActive(false);
    setStatus('Starting camera...');

    // 1. Acquire local media
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus('Audio only — no camera found');
      } catch {
        setStatus('❌ Camera/mic blocked. Allow permissions & retry.');
        return;
      }
    }
    if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

    localStream.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    // 2. Create PeerConnection
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      sigChannel.current?.send({
        type: 'broadcast', event: 'ice',
        payload: { candidate: candidate.toJSON(), from: currentUserId },
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[Tutor] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setStatus('✅ Connected');
      } else if (pc.iceConnectionState === 'failed') {
        setStatus('Retrying ICE...');
        pc.restartIce();
      } else if (pc.iceConnectionState === 'checking') {
        setStatus('Connecting...');
      }
    };

    pc.ontrack = ({ streams }) => {
      console.log('[Tutor] Remote track received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = streams[0];
        remoteVideoRef.current.play().catch(console.warn);
      }
      setRemoteStreamActive(true);
      setStatus('✅ Connected');
    };

    // 3. Signaling channel
    const ch = supabase.channel(roomId);
    sigChannel.current = ch;

    ch
      // ── Offer from student ────────────────────────────────────────────────
      .on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;

        // Guard: ignore if currently processing another offer
        if (isAnswering.current) {
          console.log('[Tutor] Already answering, ignoring duplicate offer');
          return;
        }
        isAnswering.current = true;

        console.log('[Tutor] Got offer, sigState:', pc.signalingState);
        setStatus('Student found! Connecting...');

        try {
          // If a previous answer was already set, reset for fresh negotiation
          if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
            // Unexpected state — rollback if supported
            if (pc.signalingState === 'have-local-offer') {
              await (pc as any).setLocalDescription({ type: 'rollback' }).catch(() => {});
            }
          }

          // Add local tracks (only do this once)
          if (pc.getSenders().filter(s => s.track).length === 0) {
            localStream.current!.getTracks().forEach(track => {
              pc.addTrack(track, localStream.current!);
            });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          // Flush queued ICE candidates
          for (const c of pendingIce.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
          }
          pendingIce.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log('[Tutor] Sending answer...');
          await ch.send({
            type: 'broadcast', event: 'answer',
            payload: { sdp: pc.localDescription, from: currentUserId },
          });
          setStatus('Answer sent — establishing link...');
        } catch (e) {
          console.error('[Tutor] Offer handling error:', e);
          setStatus('❌ Connection error — retry');
        } finally {
          isAnswering.current = false;
        }
      })

      // ── Remote ICE ────────────────────────────────────────────────────────
      .on('broadcast', { event: 'ice' }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.warn);
        } else {
          pendingIce.current.push(payload.candidate);
        }
      })

      // ── Channel subscribed: signal student to send offer ──────────────────
      .subscribe(async (subStatus: string) => {
        if (subStatus !== 'SUBSCRIBED' || !alive) return;
        console.log('[Tutor] Subscribed — requesting offer from student');
        setStatus('Waiting for student...');

        // ✅ Send request-offer so student replays its localDescription + ICE
        await ch.send({
          type: 'broadcast', event: 'request-offer',
          payload: { from: currentUserId },
        });
      });
  };

  // ── Teardown ───────────────────────────────────────────────────────────────
  const cleanup = () => {
    screenStream.current?.getTracks().forEach(t => t.stop());
    screenStream.current = null;
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (sigChannel.current) { supabase.removeChannel(sigChannel.current); sigChannel.current = null; }
  };

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleMic = () => {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMicOn(p => !p);
  };

  const toggleCam = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOn(prev => {
      const next = !prev;
      if (!isScreenSharing && localVideoRef.current) {
        localVideoRef.current.srcObject = next ? localStream.current : null;
      }
      return next;
    });
  };

  const handleScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      try {
        const camTrack = localStream.current?.getVideoTracks()[0];
        const sender   = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && camTrack) await sender.replaceTrack(camTrack);
        screenStream.current?.getTracks().forEach(t => t.stop());
        screenStream.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream.current;
        setIsScreenSharing(false);
      } catch (e) { console.error('[Tutor] Stop screen share error:', e); }
    } else {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: { cursor: 'always' }, audio: true });
        screenStream.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        setIsScreenSharing(true);
        screenTrack.onended = () => handleScreenShare();
      } catch (e) { console.error('[Tutor] Screen share error:', e); }
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col overflow-hidden text-white z-[100]">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-4 flex justify-between items-center pointer-events-none">
        <div className="bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 rounded-2xl pointer-events-auto max-w-[60%]">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/70 truncate block">{status}</span>
        </div>
        <div className="bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 rounded-2xl flex items-center gap-1.5 pointer-events-auto">
          <Clock className="w-3 h-3 text-emerald-400" />
          <span className="font-mono text-xs font-black">{fmt(time)}</span>
        </div>
      </div>

      {/* Remote video */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"
          onClick={() => remoteVideoRef.current?.play()} />

        {!remoteStreamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
            <div className="w-20 h-20 rounded-full bg-emerald-600/20 border-2 border-emerald-400/30 flex items-center justify-center text-3xl font-black mb-6 animate-pulse">
              {(remoteName || 'S').charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-black mb-2">{remoteName || 'Student'}</p>
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs uppercase tracking-widest">{status}</span>
            </div>
            <button onClick={() => setRetryCount(c => c + 1)}
              className="mt-8 bg-emerald-600 px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 active:scale-95">
              <RefreshCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Local PiP */}
        <div className="absolute bottom-4 right-4 w-24 h-36 rounded-2xl overflow-hidden border border-white/10 bg-slate-800 shadow-2xl z-20">
          <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${!isCamOn && !isScreenSharing && 'opacity-0'}`} />
          {!isCamOn && !isScreenSharing && <div className="absolute inset-0 flex items-center justify-center"><CameraOff className="w-5 h-5 text-white/20" /></div>}
          {isScreenSharing && <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-black text-emerald-300 bg-emerald-950/80 py-0.5">SCREEN</div>}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/60 backdrop-blur-xl px-6 py-6 flex justify-center items-center gap-3 border-t border-white/5">
        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl">
          <button onClick={toggleMic} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isMicOn ? 'bg-white/10' : 'bg-red-600'}`}>
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button onClick={toggleCam} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isCamOn ? 'bg-white/10' : 'bg-red-600'}`}>
            {isCamOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </button>
        </div>
        <button onClick={onEnd} className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all">
          <PhoneOff className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl">
          <button onClick={handleScreenShare} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isScreenSharing ? 'bg-emerald-600' : 'bg-white/10'}`}>
            <MonitorUp className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 transition-all active:scale-90">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
