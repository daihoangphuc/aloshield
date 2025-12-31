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

interface CallState {
  currentCall: CurrentCall | null;
  incomingCall: IncomingCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  iceServers: RTCIceServer[];

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
  callDuration: 0,
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],

  setIncomingCall: (call) => set({ incomingCall: call }),

  initiateCall: (callId, recipientId, recipientName, recipientAvatar, callType) => {
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
  },

  acceptCall: async () => {
    const { incomingCall, initializePeerConnection, iceServers } = get();
    if (!incomingCall) return;

    try {
      // Accept call via socket
      const response = await socketManager.acceptCall(incomingCall.callId) as { iceServers?: RTCIceServer[] };

      // Use TURN servers from response if available
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

      await initializePeerConnection(servers);
    } catch (error) {
      console.error("Failed to accept call:", error);
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
        track.enabled = isMuted; // Toggle
      });
    }
    set({ isMuted: !isMuted });
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff; // Toggle
      });
    }
    set({ isVideoOff: !isVideoOff });
  },

  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setCallDuration: (duration) => set({ callDuration: duration }),

  handleOffer: async (data) => {
    const { peerConnection, createAnswer, currentCall } = get();
    if (!peerConnection) {
      console.error("No peer connection for offer");
      return;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await createAnswer();

      if (currentCall) {
        socketManager.sendAnswer(data.callId, data.callerId, answer);
      }
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  },

  handleAnswer: async (data) => {
    const { peerConnection } = get();
    if (!peerConnection) {
      console.error("No peer connection for answer");
      return;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  },

  handleIceCandidate: async (data) => {
    const { peerConnection } = get();
    if (!peerConnection) {
      console.error("No peer connection for ICE candidate");
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  },

  initializePeerConnection: async (iceServers) => {
    const { currentCall } = get();

    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all", // Use 'relay' for TURN only
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentCall) {
        socketManager.sendIceCandidate(
          currentCall.callId,
          currentCall.recipientId,
          event.candidate.toJSON()
        );
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("Remote track received:", event.streams[0]);
      set({ remoteStream: event.streams[0] });
    };

    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
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

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      set({ localStream: stream, peerConnection: pc });
    } catch (error) {
      console.error("Failed to get local media:", error);
      throw error;
    }
  },

  createOffer: async () => {
    const { peerConnection } = get();
    if (!peerConnection) {
      throw new Error("No peer connection");
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
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

    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }

    set({
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoOff: false,
    });
  },
}));
