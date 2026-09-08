"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";

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
  // Track the last announced call so that even a re-call ("Panggil Ulang")
  // of the same queue number is announced again (key includes updatedAt).
  const lastAnnouncedRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Reference to the local chime sound used as an HTML5 audio fallback path.
  const chimeAudioRef = useRef<HTMLAudioElement | null>(null);
  // True while Chrome's autoplay policy is blocking audio (no user gesture yet).
  // Shown as a small diagnostic banner so the operator can SEE whetherthe
  // TV was started WITHOUT --autoplay-policy=no-user-gesture-required. Under
  // normal working conditions this stays false so the banner never shows.

  const [soundBlocked, setSoundBlocked] = useState(false);
  const [uploadedVideoIndex, setUploadedVideoIndex] = useState<number>(0);

  // The browser may block speech until a user gesture ("not-allowed"). For an
  // unattended display we auto-retry the announcement instead of showing a
  // button. lastPendingAnnounceRef stores the latest blocked announcement and
  // pendingAttemptCountRef limits the auto-retries.
  const lastPendingAnnounceRef = useRef<{
    queueNumber: string;
    loket: string;
  } | null>(null);
  const pendingAttemptCountRef = useRef(0);
  // Self-rescheduling timer that keeps retrying a blocked announcement until
  // the browser allows speech (works with --autoplay-policy=no-user-gesture-required).
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Announcement queue: if speech is still playing when another loket calls,
  // the new announcement waits its turn so a number is never interrupted mid-say.

  const announceQueueRef = useRef<{ queueNumber: string; loket: string }[]>([]);
  const speakingRef = useRef(false);
  // Holds a stable reference to the queue-drainer so speakQueue call advance
  // the queue when the current announcement ends. We assign it our after each render.
  const processNextAnnouncementRef = useRef<(() => void) | null>(null);
  // Once audio has been unlocked by a user gesture we never touch/cancel live
  // speech on subsequent clicks, so a click during an announcement will NOT
  // interrupt the current sound.
  const audioUnlockedRef = useRef(false);

  // YouTube playlist state
  const [playlist, setPlaylist] = useState<YouTubePlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentVideoId, setCurrentVideoId] = useState<string>("");
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);
  // Dedicated volume control for the VIDEO PLAYER ONLY (in percent 0-100). It
  // does NOT affect the queue-announcement speech/chime, which stay at their
  // own levels.
  const [videoVolume, setVideoVolume] = useState<number>(20);
  // Whether the video volume is muted (separate from the slider level so the
  // last non-zero volume is remembered when toggling mute on/off).
  const [videoMuted, setVideoMuted] = useState(false);
  // Controls whether the volume slider panel is expanded (hidden by default;
  // toggled by clicking the speaker icon).
  const [showVideoVolume, setShowVideoVolume] = useState(false);
  // Stores the last non-zero volume so unmuting restores the previous level.
  const lastVolumeRef = useRef<number>(20);
  // Mirror for imperative access (avoids stale closure in event handlers).
  const videoVolumeRef = useRef<number>(20);
  // Holds the active YouTube player instance so we can change its volume.
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  // Container <div> that the YouTube IFrame player (API) renders into.
  const ytContainerRef = useRef<HTMLDivElement>(null);
  // Imperatively-created inner host that is handed to YT.Player. YT.Player
  // REPLACES the element you give it, so it must never be a DOM node React
  // manages (that detaches it and makes React's insertBefore/removeChild fail).
  const ytInnerContainerRef = useRef<HTMLDivElement | null>(null);
  // Holds the newest playNextVideo so the persistent YouTube player's one-time
  // onStateChange handler never closes over stale playlist/index values.
  const playNextVideoRef = useRef<(() => void) | null>(null);
  // Full list of uploaded videos (filename + url) so the <video> element can
  // auto-advance when one finishes.
  const uploadedVideosRef = useRef<{ url: string; filename: string }[]>([]);
  // Current uploaded-video index (mirror for the 'ended' event handler).
  const uploadedIndexRef = useRef<number>(0);

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

        // Use activeSource to determine what to play — activeSource is the single
        // source of truth (null = stopped/no playback; youtube/upload = on).
        const sourceToPlay = data.video?.activeSource === "youtube" || data.video?.activeSource === "upload"
          ? data.video.activeSource
          : null;
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
        } else if (
          sourceToPlay === "upload" &&
          data.video?.uploadedVideos?.length > 0
        ) {
          console.log(
            "[TV] Switching to uploaded video:",
            data.video.uploadedVideos,
            "Current index:",
            uploadedVideoIndex,
          );

          // Find active video
          const activeVideo = data.video.uploadedVideos.find(
            (v: any) => v.isActive,
          );
          if (activeVideo) {
            const videoIdx = activeVideo.index;
            const currentUrl = `/videos/${activeVideo.filename}`;

            // Remember the full uploaded list + index so the <video> element
            // can auto-advance to the next one when the current video ends.
            uploadedVideosRef.current = data.video.uploadedVideos.map(
              (v: any) => ({
                url: `/videos/${v.filename}`,
                filename: v.filename,
              }),
            );

            // Always update uploaded video if source changed or URL different
            if (currentUrl !== videoUrl || videoType !== "upload") {
              console.log("[TV] Loading uploaded video:", currentUrl);
              setVideoType("upload");
              setVideoUrl(currentUrl);
              setUploadedVideoIndex(videoIdx);
              uploadedIndexRef.current = videoIdx;
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
          // Stop: tidak ada sumber aktif (activeSource null atau tidak valid) — jadi
          // hentikan pemutaran di TV (clear semua state player) sehingga layar kembali
          // ke tampilan default dan tidak lagi merender video yang kemarin.
          setVideoType(null);
          setVideoUrl("");
          setCurrentVideoId("");
          setPlaylist([]);
          setIsVideoLoading(false);
          setVideoError(false);
          // Hancurkan player YouTube yang persisten beserta inner host and-nya,
          // jika nanti di-play ulang, sebuah player baru akan dibuat di dalam
          // container yang fresh. Jika dibiarkan, player lama masih menunjuk ke
          // node yang sudah terlepas (detached) sehingga layar jadi hitam/gelap.
          try {
            ytPlayerRef.current?.destroy?.();
          } catch (e) {
            /* ignore */
          }
          ytPlayerRef.current = null;
          if (ytInnerContainerRef.current && ytContainerRef.current) {
            try {
              ytContainerRef.current.removeChild(ytInnerContainerRef.current);
            } catch (e) {
              /* ignore */
            }
          }
          ytInnerContainerRef.current = null;
          const videoEl = uploadedVideoRef.current;
          if (videoEl) {
            try {
              videoEl.pause();
              videoEl.src = "";
              videoEl.load();
            } catch (e) {
              /* ignore */
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching video:", error);
    }
  }, [extractVideoId, videoType, videoUrl, currentVideoId, uploadedVideoIndex]);

  // Load the next video in the playlist (auto-advance). Loops: after the last
  // video it wraps back to the first; a single-video playlist replays itself.
  const playNextVideo = useCallback(async () => {
    if (videoType !== "youtube" || playlist.length === 0) return;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextVideo = playlist[nextIndex];

    // Single-video playlist: the "next" video is the same one, so currentVideoId
    // wouldn't change and nothing would reload. Just restart playback.
    if (nextVideo?.videoId === currentVideoId) {
      try {
        ytPlayerRef.current?.seekTo?.(0, true);
        ytPlayerRef.current?.playVideo?.();
      } catch (e) {
        /* ignore */
      }
      return;
    }

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
    if (nextVideo?.videoId) {
      setIsVideoLoading(true);
      setCurrentVideoId(nextVideo.videoId);
    }
  }, [playlist, currentIndex, videoType, currentVideoId]);

  // Keep the ref fresh so the persistent YouTube player's onStateChange handler
  // (created once) always calls the newest playNextVideo.
  useEffect(() => {
    playNextVideoRef.current = playNextVideo;
  }, [playNextVideo]);

  // Change the volume of the VIDEO PLAYER ONLY (uploaded HTML5 video or the
  // YouTube player). Announcements/chime are unaffected.
  const handleVideoVolumeChange = useCallback((value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    videoVolumeRef.current = v;
    if (v > 0) {
      lastVolumeRef.current = v;
      setVideoMuted(false);
    }
    setVideoVolume(v);
    // Uploaded video element.
    if (uploadedVideoRef.current) {
      uploadedVideoRef.current.volume = v / 100;
      uploadedVideoRef.current.muted = v === 0;
    }
    // YouTube player (if the IFrame API finished loading).
    try {
      ytPlayerRef.current?.setVolume?.(v);
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Mute/unmute the video player. Unmuting restores the last non-zero volume.
  const toggleVideoMute = useCallback(() => {
    setVideoMuted((prev) => {
      const next = !prev;
      const level = next ? 0 : lastVolumeRef.current || 20;
      videoVolumeRef.current = level;
      setVideoVolume(level);
      if (uploadedVideoRef.current) {
        uploadedVideoRef.current.volume = level / 100;
        uploadedVideoRef.current.muted = level === 0;
      }
      try {
        ytPlayerRef.current?.setVolume?.(level);
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Load the YouTube IFrame API exactly once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadYT = () => {
      if (window.YT && window.YT.Player) {
        ytReadyRef.current = true;
        return;
      }
      if (document.getElementById("yt-iframe-api")) return;
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onload = () => {
        ytReadyRef.current = !!(window.YT && window.YT.Player);
      };
      document.head.appendChild(tag);
    };
    window.onYouTubeIframeAPIReady = () => {
      ytReadyRef.current = true;
    };
    loadYT();
  }, []);

  // Manage a SINGLE persistent YouTube player inside an imperatively-created
  // inner host. YT.Player(element) REPLACES the element it is given, so that
  // element must never be a DOM node React manages (otherwise React's
  // reconciliation would later try to insertBefore/removeChild it after it was
  // detached by the player -> the "not a child of this node" errors).
  //
  // The React-rendered div (ytContainerRef) stays stable and is never replaced.
  // Inside it we append a throwaway <div> (ytInnerContainerRef) once, hand THAT
  // to YT.Player, and reuse the player across videos via loadVideoById().
  //
  // Auto-advance: onStateChange fires when a video ends (state 0) and calls
  // playNextVideo, which loads the next video or loops back to the first.
  useEffect(() => {
    if (videoType !== "youtube" || !currentVideoId) return;
    const host = ytContainerRef.current;
    if (!host) return;

    const ensureInnerContainer = (): HTMLDivElement | null => {
      if (ytInnerContainerRef.current) return ytInnerContainerRef.current;
      if (!host.isConnected) return null;
      const inner = document.createElement("div");
      inner.style.width = "100%";
      inner.style.height = "100%";
      host.appendChild(inner);
      ytInnerContainerRef.current = inner;
      return inner;
    };

    const applyVideo = () => {
      if (!window.YT || !window.YT.Player) return;

      // Reuse the persistent player for a later video if it already exists.
      if (
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.loadVideoById === "function"
      ) {
        try {
          ytPlayerRef.current.loadVideoById(currentVideoId);
          ytPlayerRef.current.setVolume(videoVolumeRef.current);
        } catch (e) {
          /* ignore */
        }
        return;
      }

      const inner = ensureInnerContainer();
      if (!inner) return;

      // First time: build the player inside the throwaway inner host.
      ytPlayerRef.current = new window.YT.Player(inner, {
        videoId: currentVideoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 0,
          disablekb: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (event: any) => {
            try {
              event.target.setVolume(videoVolumeRef.current);
            } catch (e) {
              /* ignore */
            }
            setIsVideoLoading(false);
            setVideoError(false);
          },
          // YouTube player states: -1 unstarted, 0 ended, 1 playing,
          // 2 paused, 3 buffering, 5 cued.
          onStateChange: (event: any) => {
            // Clear the loading overlay as soon as the video actually plays so
            // it doesn't stay on screen while the audio is already running.
            if (event?.data === 1) {
              setIsVideoLoading(false);
              setVideoError(false);
            } else if (event?.data === 0) {
              // Auto-advance: when a video ends (ENDED === 0) load the next one.
              playNextVideoRef.current?.();
            }
          },
        },
      });
    };

    if (ytReadyRef.current) {
      applyVideo();
    } else {
      // The API script may still be loading; retry briefly.
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if (ytReadyRef.current || tries > 20) {
          clearInterval(timer);
          applyVideo();
        }
      }, 250);
      return () => clearInterval(timer);
    }
  }, [videoType, currentVideoId]);

  // Destroy the YouTube player and throwaway inner host when the component
  // unmounts so there are no leaked iframes.
  useEffect(() => {
    return () => {
      try {
        ytPlayerRef.current?.destroy?.();
      } catch (e) {
        /* ignore */
      }
      ytPlayerRef.current = null;
      if (ytInnerContainerRef.current && ytContainerRef.current) {
        try {
          ytContainerRef.current.removeChild(ytInnerContainerRef.current);
        } catch (e) {
          /* ignore */
        }
      }
      ytInnerContainerRef.current = null;
    };
  }, []);

  // Keep the uploaded `<video>` element in sync with the volume slider/mute.
  useEffect(() => {
    if (uploadedVideoRef.current) {
      const level = videoVolumeRef.current;
      uploadedVideoRef.current.volume = level / 100;
      uploadedVideoRef.current.muted = videoMuted || level === 0;
    }
  }, [videoVolume, videoMuted]);

  // Perform the text-to-speech announcement.
  const speakQueue = useCallback((queueNumber: string, loket: string) => {
    if (!queueNumber || !loket) return;

    // Use Web Speech API for text-to-speech
    if ("speechSynthesis" in window) {
      // Only cancel if there is actually speech running or queued. Calling
      // cancel() on every announcement — even when nothing is playing —
      // triggers a spurious "canceled"/empty error on the utterance.
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }

      // Create announcement text
      const loketName = loket.replace("_", " ");
      const announcement = `Nomor antrian ${queueNumber}, silakan menuju ${loketName}. Nomor antrian ${queueNumber}, ${loketName}.`;

      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.lang = "id-ID";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // When the engine actually allows & starts speaking, clear the pending
      // announcement so the auto-retry loop stops.
      utterance.onstart = () => {
        lastPendingAnnounceRef.current = null;
        pendingAttemptCountRef.current = 0;
      };

      // Try to find Indonesian voice
      const voices = window.speechSynthesis.getVoices();
      const indonesianVoice = voices.find(
        (voice) => voice.lang.includes("id") || voice.lang.includes("ind"),
      );
      if (indonesianVoice) {
        utterance.voice = indonesianVoice;
      }

      // Ignore benign errors caused by cancel()/interruption. These come back
      // as error === 'canceled'/'interrupted' OR as an empty {} with no
      // meaningful code property.
      utterance.onerror = (event: any) => {
        const code = typeof event?.error === "string" ? event.error : "";
        if (!code || code === "canceled" || code === "interrupted") {
          // Release the slot so the next queued call can proceed — onend may not
          // fire on cancellation, so release here explicitly.oot
          speakingRef.current = false;
          processNextAnnouncementRef.current?.();
          return;
        }

        // 'not-allowed' = browser blocked speech until a user gesture.
        // For an unattended display, auto-retry instead of showing a button.
        if (code === "not-allowed") {
          console.warn(
            "[TV] Speech blocked by autoplay policy (not-allowed). Auto-retrying. If this persists, run Chrome with --autoplay-policy=no-user-gesture-required.",
          );
          lastPendingAnnounceRef.current = { queueNumber, loket };
          scheduleRetry();
          // Release the slot too so the queue keeps advancing.

          speakingRef.current = false;
          processNextAnnouncementRef.current?.();
          return;
        }

        // DIAGNOSTICS: log every other distinct error code so the root cause is
        // visible (e.g. 'audio-capture', 'synthesis-failed', etc.).
        console.warn("[TV] Speech error code:", code || "(no code / empty {})");
        if (code === "synthesis-failed") {
          console.error("[TV] Speech error:", code);
        }
      };

      window.speechSynthesis.speak(utterance);
      // When this announcement finishes, release the slot and play the next
      // queued number — so calls from different loket play bergantian(one after
      // another) instead of cutting in.
      utterance.onend = () => {
        speakingRef.current = false;
        processNextAnnouncementRef.current?.();
      };
    } else {
      console.warn("[TV] Speech Synthesis not supported");
    }
  }, []);

  // Play a short local chime as an HTML5-audio reliability layer. The element
  // is created & "primed" muted on mount so that playback with sound is allowed
  // once audio is unlocked (autoplay policy or --autoplay-policy=no-user-gesture-required).
  const playChime = useCallback(() => {
    const el = chimeAudioRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      const p = el.play();
      if (p) {
        p.catch((err) => {
          // If blocked, the speechSynthesis path will still attempt the number.
          console.warn("[TV] Chime play blocked (autoplay policy):", err.name);
        });
      }
    } catch (e) {
      console.warn("[TV] Chime play error:", e);
    }
  }, []);

  // Announce a queue number (public entry point).
  const announceQueue = useCallback(
    (queueNumber: string, loket: string) => {
      if (!queueNumber || !loket) return;
      console.log("[TV] Announcing queue:", queueNumber, "at", loket);
      playChime();

      // Enqueue so calls from multiple loket play bergantian: the next one waits
      // until the ongoing announcement finishes instead of cutting it off.

      const alreadyQueued = announceQueueRef.current.some(
        (q) => q.queueNumber === queueNumber && q.loket === loket,
      );
      if (!alreadyQueued) {
        announceQueueRef.current.push({ queueNumber, loket });
      }
      processNextAnnouncementRef.current?.();
    },
    [speakQueue, playChime],
  );
  // Drain the queue one-by-one: only one announcement speaks at a time; the
  // next starts when the current one finishes (see speakQueue done()).
  const processAnnouncementQueue = useCallback(() => {
    if (speakingRef.current) return;
    const next = announceQueueRef.current.shift();
    if (!next) return;
    speakingRef.current = true;
    setTimeout(() => speakQueue(next.queueNumber, next.loket), 120);
  }, [speakQueue]);

  processNextAnnouncementRef.current = processAnnouncementQueue;

  // Unlock speech/audio. Some browsers require a user gesture before speech is
  // allowed. We only need to do this ONCE: afterwards we never cancel live
  // speech, so a click during an announcement does not interrupt the sound.
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return; // already unlocked -> do nothing
    audioUnlockedRef.current = true;
    setSoundBlocked(false); // a gesture arrived -> audio now allowed

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      // Prime the engine so subsequent announcements are allowed.
      try {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
      } catch (e) {
        console.warn("[TV] Failed to prime speech:", e);
      }
    }
    // Speak whatever was blocked (the latest announcement).
    const pending = lastPendingAnnounceRef.current;
    lastPendingAnnounceRef.current = null;
    pendingAttemptCountRef.current = 0;
    if (pending) {
      setTimeout(() => speakQueue(pending.queueNumber, pending.loket), 100);
    }
  }, [speakQueue]);

  // Auto-retry a blocked announcement. Keeps retrying every 2s while there is
  // a pending announcement; stops as soon as speech actually starts (see
  // utterance.onstart). Combined with Chrome's
  // --autoplay-policy=no-user-gesture-required, speech becomes allowed and the
  // next retry succeeds automatically — no click needed.
  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) return; // already retrying

    const tick = () => {
      const pending = lastPendingAnnounceRef.current;
      if (!pending) {
        retryTimerRef.current = null;
        return;
      }
      retryTimerRef.current = setTimeout(() => {
        const current = lastPendingAnnounceRef.current;
        if (current) {
          speakQueue(current.queueNumber, current.loket);
        }
        tick(); // keep retrying until one succeeds
      }, 2000);
    };

    tick();
  }, [speakQueue]);

  // Fetch queue data for TV display
  const fetchQueues = useCallback(async () => {
    try {
      const response = await fetch("/api/tv/queues");
      if (response.ok) {
        const data = await response.json();

        // Reset tampilan setelah melewati jam 00:00: buang antrian dari hari
        // sebelumnya sehingga nomor yang tampil otomatis mulai dari awal lagi.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = (q: any) => {
          const created = new Date(q.createdAt || q.created_at || 0);
          return created.getTime() >= today.getTime();
        };

        const rawCurrent = data.queues?.current || null;
        const current = rawCurrent && isToday(rawCurrent) ? rawCurrent : null;

        const rawLokets = data.queues?.lokets || {
          LOKET_1: null,
          LOKET_2: null,
          LOKET_3: null,
          LOKET_4: null,
        };
        const filteredLokets: any = {};
        for (const [key, value] of Object.entries(rawLokets)) {
          filteredLokets[key] = value && isToday(value) ? value : null;
        }

        // Always update the current displayed queue
        setCurrentQueue(current);

        // Update loket data
        setLokets(filteredLokets);

        // Announce whenever the current call changes — including a "Panggil
        // Ulang" (re-call of the same number), detected via updatedAt.
        if (current) {
          const announceKey = `${
            current.queueNumber || current.queue_number
          }|${current.updatedAt || current.updated_at || ""}`;

          if (announceKey !== lastAnnouncedRef.current) {
            lastAnnouncedRef.current = announceKey;
            // A brand-new call: reset any prior pending/retry state so this
            // announcement gets a fresh attempt.
            pendingAttemptCountRef.current = 0;
            lastPendingAnnounceRef.current = null;
            setTimeout(() => {
              announceQueue(
                current.queueNumber || current.queue_number,
                current.loket || "LOKET_1",
              );
            }, 800);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching queue data:", error);
    }
  }, [announceQueue]);

  // Poll for playlist changes, queue updates, and update clock
  useEffect(() => {
    fetchPlaylist();
    fetchQueues();

    // Poll queues every ~1s for fast response to loket calls.
    const queueInterval = setInterval(() => {
      fetchQueues();
    }, 1000);

    // Poll video/playlist every 5s (no need to hit that endpoint every second).
    const playlistInterval = setInterval(() => {
      fetchPlaylist();
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
      clearInterval(queueInterval);
      clearInterval(playlistInterval);
      clearInterval(clockInterval);
    };
  }, [fetchPlaylist, fetchQueues]);

  // Try to unlock speech/audio automatically on page load — no click required.
  // Browsers block speech synthesis until a user gesture. We attempt to prime
  // it right away. Note: if the browser still blocks it (Chrome autoplay policy
  // without the flag), launch the kiosk browser with:
  //   --autoplay-policy=no-user-gesture-required
  useEffect(() => {
    // DIAGNOSTICS: log whether speech synthesis is available, how many voices,
    // and the state of audio autoplay. Use these logs to confirm the root cause
    // (Chrome autoplay policy) on the actual TV console.
    console.info(
      "[TV] SpeechSynthesis supported:",
      "speechSynthesis" in window,
    );
    if ("speechSynthesis" in window) {
      const v = window.speechSynthesis.getVoices();
      console.info(
        "[TV] speechSynthesis voices loaded:",
        Array.isArray(v) ? v.length : "not-array",
      );
      // Reload-voices (some browsers load them asynchronously).
      const onVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.info("[TV] speechSynthesis voices now:", voices.length);
      };
      window.speechSynthesis.addEventListener
        ? window.speechSynthesis.addEventListener("voiceschanged", onVoices)
        : null;
      try {
        const probe = new SpeechSynthesisUtterance(" ");
        probe.onstart = () =>
          console.info("[TV] Probe speak STARTED (autoplay allowed)");
        probe.onerror = (e: any) =>
          console.warn("[TV] Probe speak ERROR:", e?.error ?? "unknown");
        window.speechSynthesis.speak(probe);
      } catch (e) {
        console.warn("[TV] Probe speak threw:", e);
      }
    }

    // Create + prime the HTML5 chime audio element: start it muted (allowed by
    // autoplay policy) then stop, so later unmuted playback is permitted once
    // audio is unlocked. Also probe an UNMUTED play to DETECT whether Chrome's
    // autoplay policy is blocking audio (used for the diagnostic banner. If the
    // Chrome flag is set, the unmuted probe succeeds with sound too.
    try {
      const a = new Audio("/sounds/ding.wav");
      a.preload = "auto";
      a.volume = 1;
      a.loop = false;
      a.muted = true; // priming muted is allowed by the autoplay policy
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          console.info("[TV] Chime audio primed muted OK.");
          // Now test an un-muted play to detect autoplay policy blocking.

          const q = a.play();
          if (q && typeof q.then === "function") {
            q.then(() => {
              a.pause();
              a.currentTime = 0;
              console.info("[TV] Audio autoplay ALLOWED (Chrome flag active).");
              setSoundBlocked(false);
            }).catch((err: any) => {
              console.warn(
                "[TV] Audio autoplay BLOCKED by Chrome policy. Root cause: TV Chrome not started with --autoplay-policy=no-user-gesture-required.",
                err && err.name,
              );
              setSoundBlocked(true);
            });
          }
        }).catch((err: any) => {
          console.warn("[TV] Chime prime (muted) failed:", err && err.name);
          setSoundBlocked(true);
        });
      }
      chimeAudioRef.current = a;
    } catch (e) {
      console.warn("[TV] Failed to init chime audio:", e);
    }

    unlockAudio();
  }, [unlockAudio]);

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
        // Apply the chosen video volume and unmute so sound can actually play
        // (autoplay blockage is handled below as a fallback).
        videoEl.volume = videoVolumeRef.current / 100;
        videoEl.muted = videoVolumeRef.current === 0;
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

      // Auto-advance: when an uploaded video finishes, play the next one,
      // wrapping back to the first after the last (loop).
      const handleEnded = () => {
        const list = uploadedVideosRef.current;
        if (list.length === 0) return;
        const next = (uploadedIndexRef.current + 1) % list.length;
        uploadedIndexRef.current = next;
        setUploadedVideoIndex(next);
        setVideoUrl(list[next].url);
      };

      // Attach event listeners
      videoEl.addEventListener("canplay", handleCanPlay);
      videoEl.addEventListener("error", handleError);
      videoEl.addEventListener("loadedmetadata", handleLoadedMetadata);
      videoEl.addEventListener("ended", handleEnded);

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
        videoEl.removeEventListener("ended", handleEnded);
      };
    }
  }, [videoUrl, videoType]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/20 px-6 py-4 shrink-0 shadow-xl">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          {/* SISI KIRI: Logo & Nama RS */}
          <div className="flex items-center gap-3">
            <img
              src="/img/sistem.png"
              alt="Logo RS PKU"
              className="w-15 h-15 object-contain"
            />
            <div>
              <h1 className="text-white font-extrabold text-2xl md:text-3xl tracking-wide uppercase">
                RS PKU Muhammadiyah Gombong
              </h1>
              <p className="text-slate-400 text-xs md:text-sm font-medium tracking-wider">
                Sistem Display Antrian Pelayanan
              </p>
            </div>
          </div>

          {/* SISI KANAN: Tanggal & Jam Digital */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-5 py-2 text-right shadow-inner">
            <div className="text-slate-300 font-medium text-xs md:text-sm">
              {currentDate?.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }) || "Loading..."}
            </div>
            <div className="text-emerald-400 font-black text-2xl md:text-3xl tracking-widest font-mono drop-shadow">
              {currentTime
                ?.toLocaleTimeString("id-ID", { hour12: false })
                .replace(/\./g, ":") || "00:00:00"}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-6 py-2 flex flex-col gap-2 overflow-hidden">
        {/* Video + Queue */}
        <div className="grid grid-cols-2 gap-4 w-full items-start">
          {/* Left: Video Area */}
          <div className="relative bg-black shadow-2xl overflow-hidden rounded-lg aspect-video w-full">
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
                  muted={videoMuted || videoVolume === 0}
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
              // YouTube video - rendered via the YouTube IFrame API so the
              // volume control can reach it (ytPlayerRef).
              <div className="relative w-full h-full">
                {isVideoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-white text-lg">Memuat video...</p>
                    </div>
                  </div>
                )}
                <div ref={ytContainerRef} className="w-full h-full" />
                {/* Transparent hover-blocker over the YouTube iframe. It
                    swallows mouse events so YouTube never renders its own
                    title/Share overlay (share & watch-history UI). Our volume
                    control is stacked above (z-30) and stays clickable. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 z-20 cursor-default"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="text-center space-y-4 p-8">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl">
                    <span className="text-5xl">🎬</span>
                  </div>
                  <h3 className="text-3xl font-bold text-white">
                    RS PKU Muhammadiyah Gombong
                  </h3>
                  <p className="text-lg text-gray-400">Informasi Rumah Sakit</p>
                </div>
              </div>
            )}

            {/* Video volume control — VIDEO PLAYER ONLY. Does not affect the
                queue-announcement speech/chime. A compact speaker icon toggles
                the volume panel so it is only shown while adjusting. */}
            {(videoType === "upload" || videoType === "youtube") && (
              <div className="absolute bottom-3 left-3 z-30 flex flex-col items-start gap-2">
                {/* Volume panel — only visible when the speaker icon is clicked */}
                {showVideoVolume && (
                  <div className="flex items-center gap-3 rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-4 py-2.5 shadow-2xl">
                    {/* Mute toggle */}
                    <button
                      onClick={toggleVideoMute}
                      type="button"
                      aria-label={
                        videoVolume === 0 ? "Nyalakan suara" : "Bisukan suara"
                      }
                      className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70 transition-colors"
                    >
                      <span className="text-lg leading-none" aria-hidden="true">
                        {videoVolume === 0
                          ? "🔇"
                          : videoVolume < 50
                            ? "🔉"
                            : "🔊"}
                      </span>
                    </button>

                    {/* Volume slider */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={videoMuted ? 0 : videoVolume}
                      onChange={(e) =>
                        handleVideoVolumeChange(Number(e.target.value))
                      }
                      style={
                        {
                          "--fill": `${videoMuted ? 0 : videoVolume}%`,
                        } as CSSProperties
                      }
                      className="tv-volume-slider w-40 h-1.5 cursor-pointer appearance-none rounded-full focus:outline-none"
                      aria-label="Volume Video"
                    />

                    {/* Level label */}
                    <span className="text-white text-sm font-medium tabular-nums shrink-0 w-11 text-right select-none">
                      {videoMuted || videoVolume === 0
                        ? "Mute"
                        : `${videoVolume}%`}
                    </span>
                  </div>
                )}

                {/* Speaker icon — click to open/close the volume settings */}
                <button
                  onClick={() => setShowVideoVolume((v) => !v)}
                  type="button"
                  aria-label={
                    showVideoVolume
                      ? "Tutup pengaturan suara"
                      : "Atur volume video"
                  }
                  aria-expanded={showVideoVolume}
                  className="flex items-center justify-center w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/20 hover:bg-black/70 active:bg-black/80 shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70"
                >
                  <span className="text-xl leading-none" aria-hidden="true">
                    {videoMuted || videoVolume === 0
                      ? "🔇"
                      : videoVolume < 50
                        ? "🔉"
                        : "🔊"}
                  </span>
                </button>
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
            <div className="text-center flex-1 flex flex-col justify-start items-center p-0 -mt-20">
              {currentQueue ? (
                <div className="flex flex-col justify-start items-center gap-1 w-full">
                  {/* Nomor Antrian */}
                  <div className="text-[8rem] xl:text-[10rem] font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent leading-none animate-pulse tracking-tight mt-18">
                    {currentQueue.queueNumber || currentQueue.queue_number}
                  </div>

                  {/* Label Jenis Pasien & Loket */}
                  <div className="flex justify-center gap-4">
                    <div className="text-3xl font-bold px-8 py-2 bg-blue-600 text-white rounded-xl shadow-md">
                      {currentQueue.patientType ||
                      currentQueue.patient_type === "BPJS"
                        ? "🏥 BPJS"
                        : "👤 UMUM"}
                    </div>
                    {currentQueue.loket && (
                      <div className="text-3xl font-bold px-8 py-2 bg-orange-500 text-white rounded-xl shadow-md">
                        🖥️ {(currentQueue.loket || "").replace("_", " ")}
                      </div>
                    )}
                  </div>

                  {/* Pesan Arahan */}
                  <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200 shadow-sm w-full">
                    <p className="text-4xl font-extrabold text-green-800 tracking-wide">
                      Silakan menuju{" "}
                      {(currentQueue.loket || "meja pendaftaran").replace(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-30">
                  <div className="text-8xl text-gray-400 mb-4">⏳</div>
                  <div className="text-4xl text-gray-500 font-semibold">
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
          <div className="grid grid-cols-4 gap-6 mt-4">
            {["LOKET_1", "LOKET_2", "LOKET_3", "LOKET_4"].map(
              (loket, index) => {
                const loketQueue = lokets[loket];
                return (
                  <div
                    key={loket}
                    className="bg-white/95 shadow-xl border-2 border-gray-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    {/* Header Loket */}
                    <div className="text-center py-4 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                      <h3 className="text-3xl font-extrabold tracking-wide">
                        LOKET {index + 1}
                      </h3>
                    </div>

                    {/* Isi Kartu */}
                    <div className="text-center py-10 px-4 flex-1 flex flex-col justify-center">
                      {loketQueue ? (
                        <div className="space-y-3">
                          <div className="text-6xl font-black text-green-600 tracking-tight">
                            {loketQueue.queueNumber || loketQueue.queue_number}
                          </div>
                          <div className="text-xl font-bold text-gray-700 mt-2">
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

      {/* {/* Diagnostic banner — ONLY shown while Chrome autoplay policy is blocking
          audio (i.e. no user gesture / Chrome started WITHOUT the flag). This helps
          the operator confirm the root cause: with the flag set, this never appears. */}
      {/* {soundBlocked && (
        <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="bg-red-600/95 text-white text-lg font-bold px-8 py-3 rounded-xl shadow-2xl border-2 border-red-300 max-w-3xl text-center">
            🔇 Suara diblokir browser. Jalankan TV dengan Chrome:
            <code className="bg-black/40 px-2 py-1 rounded ml-1 font-mono text-base">
              --autoplay-policy=no-user-gesture-required
            </code>
          </div>
        </div>
      )} */}
    </div>
  );
}
