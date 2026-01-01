import { create } from "zustand";
import { socketManager } from "@/lib/socket";

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: "audio" | "video";
}

interface CurrentCall {
  callId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  callType: "audio" | "video";
  status: "initiating" | "ringing" | "connecting" | "connected" | "ended";
  startTime?: Date;
}

interface PendingOffer {
  callId: string;
  callerId: string;
  offer: RTCSessionDescriptionInit;
}

interface CallState {
  currentCall: CurrentCall | null;
  incomingCall: IncomingCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isMinimized: boolean;
  callDuration: number;
  iceServers: RTCIceServer[];
  pendingIceCandidates: RTCIceCandidateInit[];
  pendingOffer: PendingOffer | null;

  // Actions
  setIncomingCall: (call: IncomingCall | null) => void;
  initiateCall: (
    callId: string,
    recipientId: string,
    recipientName: string,
    recipientAvatar: string | undefined,
    callType: "audio" | "video"
  ) => void;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleMinimize: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setCallDuration: (duration: number) => void;
  handleOffer: (data: { callId: string; callerId: string; offer: RTCSessionDescriptionInit }) => void;
  handleAnswer: (data: { callId: string; answer: RTCSessionDescriptionInit }) => void;
  handleIceCandidate: (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
  initializePeerConnection: (iceServers: RTCIceServer[]) => Promise<void>;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswer: () => Promise<RTCSessionDescriptionInit>;
  cleanup: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  currentCall: null,
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  isVideoOff: false,
  isMinimized: false,
  callDuration: 0,
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  pendingIceCandidates: [],
  pendingOffer: null,

  setIncomingCall: (call) => set({ incomingCall: call }),

  initiateCall: (callId, recipientId, recipientName, recipientAvatar, callType) => {
    console.log("📞 Initiating call:", { callId, recipientId, recipientName, callType });
    set({
      currentCall: {
        callId,
        recipientId,
        recipientName,
        recipientAvatar,
        callType,
        status: "initiating",
      },
      incomingCall: null,
    });
    console.log("📞 Current call set:", get().currentCall);
  },

  acceptCall: async () => {
    const { incomingCall, initializePeerConnection, iceServers } = get();
    if (!incomingCall) return;

    console.log("📞 Accepting call:", incomingCall);
    try {
      const response = await socketManager.acceptCall(incomingCall.callId) as { iceServers?: RTCIceServer[] };
      const servers = response.iceServers || iceServers;

      set({
        currentCall: {
          callId: incomingCall.callId,
          recipientId: incomingCall.callerId,
          recipientName: incomingCall.callerName,
          recipientAvatar: incomingCall.callerAvatar,
          callType: incomingCall.callType,
          status: "connecting",
        },
        incomingCall: null,
        iceServers: servers,
      });
      console.log("📞 Current call set after accept:", get().currentCall);

      await initializePeerConnection(servers);
    } catch {
      set({ incomingCall: null });
    }
  },

  rejectCall: (reason) => {
    const { incomingCall } = get();
    if (incomingCall) {
      socketManager.rejectCall(incomingCall.callId, reason);
    }
    set({ incomingCall: null });
  },

  endCall: () => {
    const { currentCall, cleanup } = get();
    if (currentCall) {
      socketManager.endCall(currentCall.callId);
    }
    cleanup();
    set({
      currentCall: null,
      incomingCall: null,
      callDuration: 0,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    set({ isMuted: !isMuted });
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
    }
    set({ isVideoOff: !isVideoOff });
  },

  toggleMinimize: () => {
    const { isMinimized } = get();
    set({ isMinimized: !isMinimized });
  },

  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setCallDuration: (duration) => set({ callDuration: duration }),

  // Xử lý offer - Queue nếu chưa có peer connection
  handleOffer: async (data) => {
    const { peerConnection, currentCall } = get();
    
    if (!peerConnection) {
      // Queue offer để xử lý sau khi accept call
      set({ pendingOffer: data });
      return;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await get().createAnswer();
      if (currentCall) {
        socketManager.sendAnswer(data.callId, data.callerId, answer);
      }
    } catch {
      // Silent fail - WebRTC errors are expected during negotiation
    }
  },

  // Xử lý answer
  handleAnswer: async (data) => {
    const { peerConnection } = get();
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch {
      // Silent fail
    }
  },

  // Xử lý ICE candidate - Queue nếu chưa có peer connection
  handleIceCandidate: async (data) => {
    const { peerConnection, pendingIceCandidates } = get();
    
    if (!peerConnection) {
      // Queue candidate để xử lý sau khi có peer connection
      set({ pendingIceCandidates: [...pendingIceCandidates, data.candidate] });
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch {
      // Silent fail - ICE candidate errors are common and expected
    }
  },

  initializePeerConnection: async (iceServers) => {
    const { currentCall } = get();

    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all",
    });

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && currentCall) {
        socketManager.sendIceCandidate(
          currentCall.callId,
          currentCall.recipientId,
          event.candidate.toJSON()
        );
      }
    };

    // Remote stream handler
    pc.ontrack = (event) => {
      console.log("🎥 Remote track received:", event.track.kind, event.streams[0]);
      console.log("🎥 Track enabled:", event.track.enabled, "Track readyState:", event.track.readyState);
      console.log("🎥 Stream tracks:", event.streams[0]?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
      
      // ✅ Ensure audio tracks are enabled
      if (event.track.kind === "audio") {
        event.track.enabled = true;
        console.log("🔊 Audio track enabled:", event.track.id);
      }
      
      set({ remoteStream: event.streams[0] });
    };

    // Connection state handler
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected") {
        set((state) => ({
          currentCall: state.currentCall
            ? { ...state.currentCall, status: "connected", startTime: new Date() }
            : null,
        }));
      } else if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        get().endCall();
      }
    };

    // Get local media
    try {
      const callType = currentCall?.callType || "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { width: 1280, height: 720, frameRate: 30 } : false,
      });

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log("🎥 Added local track:", track.kind, "enabled:", track.enabled);
      });

      console.log("🎥 Local stream obtained:", stream, "Tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
      set({ localStream: stream, peerConnection: pc });

      // Process pending offer (when receiving call)
      const pendingOffer = get().pendingOffer;
      if (pendingOffer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          const updatedCall = get().currentCall;
          if (updatedCall) {
            socketManager.sendAnswer(pendingOffer.callId, pendingOffer.callerId, answer);
          }
          set({ pendingOffer: null });
        } catch {
          // Silent fail
        }
      }

      // Process pending ICE candidates
      const pendingCandidates = get().pendingIceCandidates;
      if (pendingCandidates.length > 0) {
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // Silent fail
          }
        }
        set({ pendingIceCandidates: [] });
      }
    } catch {
      throw new Error("Failed to get media devices");
    }
  },

  createOffer: async () => {
    const { peerConnection, currentCall } = get();
    if (!peerConnection) {
      throw new Error("No peer connection");
    }

    const isVideoCall = currentCall?.callType === "video";
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideoCall,
    });

    await peerConnection.setLocalDescription(offer);
    return offer;
  },

  createAnswer: async () => {
    const { peerConnection } = get();
    if (!peerConnection) {
      throw new Error("No peer connection");
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  },

  cleanup: () => {
    const { localStream, peerConnection } = get();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection) {
      peerConnection.close();
    }

    set({
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoOff: false,
      isMinimized: false,
      pendingIceCandidates: [],
      pendingOffer: null,
    });
  },
}));
// Force rebuild
