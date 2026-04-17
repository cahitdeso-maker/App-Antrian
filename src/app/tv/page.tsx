"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlaylistItem {
  id: number;
  url: string;
  videoId: string;
}

export default function TVDisplay() {
  const [currentQueue, setCurrentQueue] = useState<any>(null);
  const [lokets, setLokets] = useState<any>({
    LOKET_1: null,
    LOKET_2: null,
    LOKET_3: null,
    LOKET_4: null,
  });

  // Video states
  const [videoType, setVideoType] = useState<"youtube" | "upload" | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [previousQueue, setPreviousQueue] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [uploadedVideoIndex, setUploadedVideoIndex] = useState<number>(0);

  // YouTube playlist state
  const [playlist, setPlaylist] = useState<YouTubePlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentVideoId, setCurrentVideoId] = useState<string>("");
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);

  // Extract YouTube video ID from URL
  const extractVideoId = useCallback((url: string): string => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return "";
  }, []);

  // Load video/playlist from server
  const fetchPlaylist = useCallback(async () => {
    try {
      const response = await fetch("/api/video");
      if (response.ok) {
        const data = await response.json();
        console.log("[TV] Video data received:", data.video);

        // Use activeSource to determine what to play
        const sourceToPlay = data.video?.activeSource || data.video?.type;
        console.log(
          "[TV] Source to play:",
          sourceToPlay,
          "Current type:",
          videoType,
        );

        if (sourceToPlay === "youtube" && data.video?.youtubeUrls?.length > 0) {
          console.log("[TV] Switching to YouTube playlist");
          // Always update YouTube jika source berubah atau data baru
          setVideoType("youtube");
          const newPlaylist: YouTubePlaylistItem[] = data.video.youtubeUrls
            .map((url: string, index: number) => ({
              id: index,
              url,
              videoId: extractVideoId(url),
            }))
            .filter((item: YouTubePlaylistItem) => item.videoId);

          setPlaylist(newPlaylist);
          const serverIndex = data.video.currentUrlIndex || 0;
          setCurrentIndex(serverIndex);

          // Load video if playlist changed or current video different
          const currentVideo = newPlaylist[serverIndex];
          if (
            currentVideo?.videoId &&
            currentVideo.videoId !== currentVideoId
          ) {
            console.log("[TV] Loading YouTube video:", currentVideo.videoId);
            setVideoError(false);
            setIsVideoLoading(true);
            setCurrentVideoId(currentVideo.videoId);
            // Reset loading after iframe mounts
            setTimeout(() => {
              setIsVideoLoading(false);
            }, 3000);
          } else if (currentVideo?.videoId && !currentVideoId) {
            // First load
            console.log("[TV] First load YouTube video:", currentVideo.videoId);
            setVideoError(false);
            setIsVideoLoading(true);
            setCurrentVideoId(currentVideo.videoId);
            // Reset loading after iframe mounts
            setTimeout(() => {
              setIsVideoLoading(false);
            }, 3000);
          }
        } else if (sourceToPlay === "upload" && data.video?.uploadedVideos?.length > 0) {
          console.log(
            "[TV] Switching to uploaded video:",
            data.video.uploadedVideos,
            "Current index:",
            uploadedVideoIndex,
          );
          
          // Find active video
          const activeVideo = data.video.uploadedVideos.find((v: any) => v.isActive);
          if (activeVideo) {
            const videoIdx = activeVideo.index;
            const currentUrl = `/videos/${activeVideo.filename}`;
            
            // Always update uploaded video if source changed or URL different
            if (currentUrl !== videoUrl || videoType !== "upload") {
              console.log("[TV] Loading uploaded video:", currentUrl);
              setVideoType("upload");
              setVideoUrl(currentUrl);
              setUploadedVideoIndex(videoIdx);
              setIsVideoLoading(true);
              setPlaylist([]);
              setCurrentVideoId("");
            }
          }
        } else {
          console.log("[TV] No valid source found:", {
            sourceToPlay,
            hasUploadUrl: !!data.video?.url,
            hasYoutubeUrls: data.video?.youtubeUrls?.length > 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching video:", error);
    }
  }, [extractVideoId, videoType, videoUrl, currentVideoId, uploadedVideoIndex]);

  // Load next video in playlist (YouTube only)
  const playNextVideo = useCallback(async () => {
    if (videoType !== "youtube" || playlist.length === 0) return;

    const nextIndex = (currentIndex + 1) % playlist.length;

    // Update server
    try {
      const formData = new FormData();
      formData.append("action", "nextVideo");
      formData.append("index", String(nextIndex));

      await fetch("/api/video", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error("Error updating playlist:", error);
    }

    // Load next video
    setCurrentIndex(nextIndex);
    if (playlist[nextIndex]?.videoId) {
      setIsVideoLoading(true);
      setCurrentVideoId(playlist[nextIndex].videoId);
    }
  }, [playlist, currentIndex, videoType]);

  // Function to announce queue number with speech
  const announceQueue = useCallback(
    (queueNumber: string, loket: string) => {
      if (!queueNumber || !loket) return;

      // Skip if same queue was already announced
      if (previousQueue === queueNumber) return;

      console.log("[TV] Announcing queue:", queueNumber, "at", loket);
      setPreviousQueue(queueNumber);

      // Use Web Speech API for text-to-speech
      if ("speechSynthesis" in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Create announcement text
        const loketName = loket.replace("_", " ");
        const announcement = `Nomor antrian ${queueNumber}, silakan menuju ${loketName}. Nomor antrian ${queueNumber}, ${loketName}.`;

        const utterance = new SpeechSynthesisUtterance(announcement);
        utterance.lang = "id-ID";
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to find Indonesian voice
        const voices = window.speechSynthesis.getVoices();
        const indonesianVoice = voices.find(
          (voice) => voice.lang.includes("id") || voice.lang.includes("ind"),
        );
        if (indonesianVoice) {
          utterance.voice = indonesianVoice;
        }

        utterance.onerror = (event) => {
          console.error("[TV] Speech error:", event);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        console.warn("[TV] Speech Synthesis not supported");
      }
    },
    [previousQueue],
  );

  // Fetch queue data for TV display
  const fetchQueues = useCallback(async () => {
    try {
      const response = await fetch("/api/tv/queues");
      if (response.ok) {
        const data = await response.json();
        console.log("[TV] Queue data received:", data.queues);

        // Update current queue (most recently called)
        if (data.queues.current) {
          const oldQueue = currentQueue?.queueNumber;
          setCurrentQueue(data.queues.current);

          // Announce if queue changed
          if (oldQueue !== data.queues.current.queueNumber) {
            setTimeout(() => {
              announceQueue(
                data.queues.current.queueNumber,
                data.queues.current.loket || "LOKET_1",
              );
            }, 1000);
          }
        } else {
          setCurrentQueue(null);
        }

        // Update loket data
        setLokets(
          data.queues.lokets || {
            LOKET_1: null,
            LOKET_2: null,
            LOKET_3: null,
            LOKET_4: null,
          },
        );
      }
    } catch (error) {
      console.error("Error fetching queue data:", error);
    }
  }, [currentQueue, announceQueue]);

  // Poll for playlist changes, queue updates, and update clock
  useEffect(() => {
    fetchPlaylist();
    fetchQueues();

    // Poll every 5 seconds for video and queue updates
    pollIntervalRef.current = setInterval(() => {
      fetchPlaylist();
      fetchQueues();
    }, 5000);

    // Initialize clock
    setCurrentTime(new Date());
    setCurrentDate(new Date());

    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
      setCurrentDate(new Date());
    }, 1000);

    // Load voices when available
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      clearInterval(clockInterval);
    };
  }, [fetchPlaylist, fetchQueues]);

  // Handle uploaded video playback - with direct event handlers
  useEffect(() => {
    if (videoType === "upload" && videoUrl) {
      console.log("[TV] Uploaded video effect triggered:", videoUrl);
      setIsVideoLoading(true);
      setVideoError(false);

      const videoEl = uploadedVideoRef.current;
      if (!videoEl) {
        console.error("[TV] Video element not found");
        setIsVideoLoading(false);
        setVideoError(true);
        return;
      }

      // Reset video element
      videoEl.pause();
      videoEl.src = "";
      videoEl.load();

      // Set event handlers BEFORE setting src
      const handleCanPlay = () => {
        console.log("[TV] Video canplay event fired");
        videoEl
          .play()
          .then(() => {
            console.log("[TV] Video playing");
            setIsVideoLoading(false);
            setVideoError(false);
          })
          .catch((err) => {
            console.warn("[TV] Play error:", err.name);
            if (err.name === "NotAllowedError" || err.name === "AbortError") {
              videoEl.muted = true;
              videoEl
                .play()
                .then(() => {
                  console.log("[TV] Playing muted");
                  setIsVideoLoading(false);
                })
                .catch((e) => {
                  console.error("[TV] Still failed:", e);
                  setIsVideoLoading(false);
                  setVideoError(true);
                });
            } else {
              setIsVideoLoading(false);
              setVideoError(true);
            }
          });
      };

      const handleError = (e: Event) => {
        console.error("[TV] Video error event:", e);
        console.error(
          "[TV] Video error code:",
          videoEl.error?.code,
          videoEl.error?.message,
        );
        setIsVideoLoading(false);
        setVideoError(true);
      };

      const handleLoadedMetadata = () => {
        console.log("[TV] Video metadata loaded:", {
          duration: videoEl.duration,
          width: videoEl.videoWidth,
          height: videoEl.videoHeight,
        });
      };

      // Attach event listeners
      videoEl.addEventListener("canplay", handleCanPlay);
      videoEl.addEventListener("error", handleError);
      videoEl.addEventListener("loadedmetadata", handleLoadedMetadata);

      console.log("[TV] Setting video src:", videoUrl);
      videoEl.src = videoUrl;
      videoEl.load();

      // Timeout fallback
      const timeout = setTimeout(() => {
        console.log("[TV] Timeout - video not loaded");
        if (isVideoLoading) {
          setIsVideoLoading(false);
          setVideoError(true);
        }
      }, 30000); // Increased to 30 seconds for larger videos

      return () => {
        clearTimeout(timeout);
        videoEl.removeEventListener("canplay", handleCanPlay);
        videoEl.removeEventListener("error", handleError);
        videoEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    }
  }, [videoUrl, videoType]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20 shrink-0">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl">🏥</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  RS PKU MUHAMMADIYAH GOMBONG
                </h1>
                <p className="text-lg text-white/80">Sistem Antrian Terpadu</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">
                {currentDate?.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }) || "Loading..."}
              </div>
              <div className="text-4xl font-bold mt-1">
                {currentTime?.toLocaleTimeString("id-ID") || "--:--:--"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-4 flex flex-col gap-4 overflow-hidden">
        {/* Video + Queue */}
        <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Left: Video Area */}
          <div className="bg-black shadow-2xl overflow-hidden h-full rounded-lg">
            {videoType === "upload" && videoUrl ? (
              // Uploaded video
              <div
                key={`upload-${videoUrl}`}
                className="relative w-full h-full bg-black"
              >
                {isVideoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-white text-lg">Memuat video...</p>
                      <p className="text-slate-400 text-sm mt-2">
                        Jika terlalu lama, video mungkin belum di-upload
                      </p>
                    </div>
                  </div>
                )}
                <video
                  ref={uploadedVideoRef}
                  className="w-full h-full"
                  style={{ objectFit: "contain" }}
                  muted
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                />
                {/* Error state - video not found */}
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 z-10">
                    <div className="text-center space-y-4 p-8">
                      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-2xl">
                        <span className="text-5xl">❌</span>
                      </div>
                      <h3 className="text-3xl font-bold text-white">
                        Video Tidak Ditemukan
                      </h3>
                      <p className="text-lg text-gray-400 max-w-md">
                        File video belum di-upload atau sudah dihapus. Silakan
                        upload video terlebih dahulu di halaman Admin.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : videoType === "youtube" && currentVideoId ? (
              // YouTube video - Simple iframe
              <div className="relative w-full h-full">
                {isVideoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-white text-lg">Memuat video...</p>
                    </div>
                  </div>
                )}
                <iframe
                  key={currentVideoId}
                  src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&fs=0&disablekb=1&iv_load_policy=3`}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen={false}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="text-center space-y-4 p-8">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl">
                    <span className="text-5xl">🎬</span>
                  </div>
                  <h3 className="text-3xl font-bold text-white">
                    Informasi & Promosi RS
                  </h3>
                  <p className="text-lg text-gray-400">
                    Area pemutaran video iklan & informasi rumah sakit
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Current Queue */}
          <div className="bg-gradient-to-br from-white to-gray-50 text-gray-900 shadow-2xl border-4 border-green-500 h-full flex flex-col rounded-lg">
            <div className="text-center py-4 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white shrink-0">
              <h2 className="text-3xl font-bold">
                📢 NOMOR ANTRIAN SEDANG DIPANGGIL
              </h2>
            </div>
            <div className="text-center flex-1 flex flex-col justify-center items-center p-8">
              {currentQueue ? (
                <div className="space-y-6 w-full">
                  <div className="text-[8rem] font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent leading-none animate-pulse">
                    {currentQueue.queueNumber || currentQueue.queue_number}
                  </div>
                  <div className="flex justify-center gap-4">
                    <div className="text-2xl px-8 py-3 bg-blue-500 text-white rounded-lg">
                      {currentQueue.patientType ||
                      currentQueue.patient_type === "BPJS"
                        ? "🏥 BPJS"
                        : "👤 UMUM"}
                    </div>
                    {currentQueue.loket && (
                      <div className="text-2xl px-8 py-3 bg-orange-500 text-white rounded-lg">
                        🖥️ {(currentQueue.loket || "").replace("_", " ")}
                      </div>
                    )}
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                    <p className="text-2xl font-bold text-green-800">
                      Silakan menuju{" "}
                      {(currentQueue.loket || "meja pendaftaran").replace(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-12">
                  <div className="text-6xl text-gray-400 mb-4">⏳</div>
                  <div className="text-3xl text-gray-500 font-semibold">
                    Menunggu antrian...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loket 1-4 */}
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-center mb-4">
            Antrian Terakhir yang Sudah Dipanggil
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {["LOKET_1", "LOKET_2", "LOKET_3", "LOKET_4"].map(
              (loket, index) => {
                const loketQueue = lokets[loket];
                return (
                  <div
                    key={loket}
                    className="bg-white/95 shadow-lg border-2 border-gray-200 rounded-lg overflow-hidden"
                  >
                    <div className="text-center py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                      <h3 className="text-2xl font-bold">LOKET {index + 1}</h3>
                    </div>
                    <div className="text-center py-6">
                      {loketQueue ? (
                        <div className="space-y-2">
                          <div className="text-5xl font-bold text-green-600">
                            {loketQueue.queueNumber || loketQueue.queue_number}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            {(loketQueue.patientType ||
                              loketQueue.patient_type) === "BPJS"
                              ? "🏥 BPJS"
                              : "👤 UMUM"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-lg">Menunggu...</div>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
