/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";

interface RTCSignalData {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string>("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // Initialize socket connection to our separate signaling server
    socketRef.current = io("https://webrtc-28n5.onrender.com:3002");

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const initializeWebRTC = async () => {
    try {
      // Create RTCPeerConnection
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Request camera and microphone permissions
      console.log("Requesting media permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Attach the stream to the local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        if (peerConnection.current) {
          peerConnection.current.addTrack(track, stream);
        }
      });

      // Handle incoming tracks
      peerConnection.current.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      setMediaError("");
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setMediaError(
        "Failed to access camera or microphone. Please ensure you have granted the necessary permissions."
      );
    }
  };

  const setupSocketListeners = () => {
    if (!socketRef.current || !peerConnection.current) return;

    socketRef.current.on("peer-joined", async () => {
      // Create and send offer when new peer joins
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      socketRef.current!.emit("offer", { roomId, offer });
    });

    socketRef.current.on("offer", async ({ offer }: RTCSignalData) => {
      if (!offer) return;
      await peerConnection.current!.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.current!.createAnswer();
      await peerConnection.current!.setLocalDescription(answer);
      socketRef.current!.emit("answer", { roomId, answer });
    });

    socketRef.current.on("answer", async ({ answer }: RTCSignalData) => {
      if (!answer) return;
      await peerConnection.current!.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socketRef.current.on(
      "ice-candidate",
      async ({ candidate }: RTCSignalData) => {
        if (!candidate) return;
        try {
          await peerConnection.current!.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    );
  };

  const connectToRoom = async () => {
    if (!roomId || !socketRef.current) return;

    setIsConnected(true);
    await initializeWebRTC();

    // Join the room
    socketRef.current.emit("join-room", roomId);
    setupSocketListeners();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-8">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/20">
        {mediaError && (
          <div className="text-red-500 bg-red-100 p-4 rounded-lg mb-4">
            {mediaError}
          </div>
        )}
        {!isConnected ? (
          <div className="flex flex-col gap-4 min-w-[300px]">
            <h1 className="text-white text-2xl font-bold text-center mb-4">
              WebRTC Demo
            </h1>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="px-4 py-3 rounded-lg bg-white/20 border-none text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              onClick={connectToRoom}
              className="px-4 py-3 rounded-lg bg-white text-purple-600 font-semibold hover:-translate-y-0.5 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Join Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
            <div className="relative aspect-video bg-black/20 rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                You
              </span>
            </div>
            <div className="relative aspect-video bg-black/20 rounded-lg overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                Remote User
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
