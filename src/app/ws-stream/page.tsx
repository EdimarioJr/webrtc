"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

interface SocketRef {
  socket: any;
  room: string | null;
}

export default function WSStream() {
  const [roomId, setRoomId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string>("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const socketRef = useRef<SocketRef>({ socket: null, room: null });
  const queueRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    socketRef.current.socket = io("http://localhost:3002");

    socketRef.current.socket.on("connect", () => {
      console.log("Connected to streaming server");
    });

    // Initialize MediaSource
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.src = URL.createObjectURL(mediaSource);
    }

    mediaSource.addEventListener("sourceopen", () => {
      console.log("MediaSource opened");

      sourceBufferRef.current = mediaSource.addSourceBuffer(
        'video/webm; codecs="vp8,opus"'
      );

      // ✅ (Re)assign object URL here
      if (remoteVideoRef.current) {
        remoteVideoRef.current.src = URL.createObjectURL(mediaSource);
      }

      sourceBufferRef.current.addEventListener("updateend", () => {
        if (queueRef.current.length > 0 && !sourceBufferRef.current?.updating) {
          const chunk = queueRef.current.shift();
          if (chunk) {
            try {
              sourceBufferRef.current?.appendBuffer(chunk);
            } catch (e) {
              console.error("Error appending buffer:", e);
            }
          }
        }
      });
    });

    socketRef.current.socket.on("video-chunk", (chunk: ArrayBuffer) => {
      const buffer = new Uint8Array(chunk);

      try {
        if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
          sourceBufferRef.current.appendBuffer(buffer);
        } else {
          queueRef.current.push(buffer);
        }
      } catch (e) {
        console.error("Error handling chunk:", e);
      }
    });

    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      socketRef.current.socket?.disconnect();
    };
  }, []);

  const initializeStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Set up MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs="vp8,opus"',
        videoBitsPerSecond: 1000000, // 1 Mbps
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          e.data.arrayBuffer().then((buffer) => {
            socketRef.current.socket?.emit("video-chunk", {
              roomId: socketRef.current.room,
              chunk: buffer,
            });
          });
        }
      };

      recorder.start(100); // Send chunks more frequently
      mediaRecorderRef.current = recorder;
      setMediaError("");
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setMediaError(
        "Failed to access camera or microphone. Please ensure you have granted the necessary permissions."
      );
    }
  };

  const connectToRoom = async () => {
    if (!roomId) return;

    socketRef.current.room = roomId;
    socketRef.current.socket?.emit("join-stream-room", roomId);
    setIsConnected(true);
    await initializeStream();
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
              WebSocket Streaming Demo
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
                Remote Stream
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
