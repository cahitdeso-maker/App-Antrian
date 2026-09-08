"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Trash2,
  Link,
  CheckCircle,
  Clock,
  Play,
  Square,
  SkipForward,
} from "lucide-react";

interface PlaylistItem {
  url: string;
  videoId: string;
  index: number;
  title: string;
}

interface UploadedVideoItem {
  url: string;
  filename: string;
  name: string;
  size: number;
  index: number;
  isActive: boolean;
}

interface VideoStatus {
  type: "upload" | "youtube" | null;
  activeSource: "upload" | "youtube" | null;
  youtubeUrls: string[];
  url: string | null;
  uploadedVideos: UploadedVideoItem[];
}

export default function VideoManager() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"youtube" | "upload">("youtube");
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideoItem[]>([]);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractVideoId = (url: string): string => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    return "";
  };

  const handleAddToPlaylist = async () => {
    if (!youtubeUrl.trim()) {
      alert("Masukkan URL YouTube");
      return;
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      alert("URL YouTube tidak valid");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("youtubeUrl", youtubeUrl);
      formData.append("youtubeTitle", youtubeTitle);

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylist(
          data.video.youtubeUrls.map((url: string, i: number) => ({
            url,
            videoId: extractVideoId(url),
            title: data.video.youtubeTitles?.[i] || url,
            index: i,
          })),
        );
        setYoutubeUrl("");
        setYoutubeTitle("");
        alert(`✅ Video ditambahkan! Total: ${data.video.totalCount} video`);
      } else {
        const error = await response.json();
        alert(error.error || "Gagal menambahkan video");
      }
    } catch (error) {
      alert("Terjadi kesalahan");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveVideo = async (index: number) => {
    if (!confirm("Hapus video dari playlist?")) return;

    try {
      const response = await fetch(`/api/video?url=${index}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();

        // Update local state
        const newPlaylist = playlist.filter((_, i) => i !== index);
        setPlaylist(newPlaylist);

        if (currentIndex >= newPlaylist.length) {
          setCurrentIndex(0);
        }

        // If playlist is now empty, clear status
        if (data.remainingCount === 0) {
          setVideoStatus((prev) =>
            prev ? { ...prev, activeSource: null, youtubeUrls: [] } : null,
          );
        }

        alert(`✅ Video dihapus! Sisa: ${data.remainingCount} video`);
      } else {
        const error = await response.json();
        alert(error.error || "Gagal menghapus video");
      }
    } catch (error) {
      alert("Gagal menghapus video");
    }
  };

  const handlePlayVideo = async (index: number) => {
    try {
      const formData = new FormData();
      formData.append("action", "nextVideo");
      formData.append("index", String(index));

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setCurrentIndex(index);
        setVideoStatus((prev) =>
          prev ? { ...prev, activeSource: "youtube" } : null,
        );
        alert(`✅ Video #${index + 1} sekarang diputar di TV`);
      } else {
        alert("Gagal memutar video");
      }
    } catch (error) {
      alert("Gagal memutar video");
    }
  };

  const handleUploadVideo = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      alert("File harus berupa video!");
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      alert("Ukuran file maksimal 500MB!");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        // Add to uploaded videos list
        const newVideo: UploadedVideoItem = {
          url: data.video.url,
          filename: data.video.filename,
          name: data.video.name,
          size: data.video.size,
          index: data.video.index,
          isActive: true,
        };

        setUploadedVideos((prev) => [...prev, newVideo]);

        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        alert(
          `✅ Video berhasil diupload! Total: ${uploadedVideos.length + 1} video`,
        );
      } else {
        const error = await response.json();
        alert(error.error || "Gagal upload video");
      }
    } catch (error) {
      alert("Terjadi kesalahan saat upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUploadedVideo = async (index: number) => {
    if (!confirm("Hapus video ini?")) return;

    try {
      const response = await fetch(`/api/video?uploaded=${index}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();

        // Update local state
        const newVideos = uploadedVideos.filter((_, i) => i !== index);
        setUploadedVideos(newVideos);

        // If no videos left, clear status
        if (data.remainingCount === 0) {
          setVideoStatus((prev) =>
            prev ? { ...prev, activeSource: null } : null,
          );
        }

        alert(`✅ Video dihapus! Sisa: ${data.remainingCount} video`);
      } else {
        const error = await response.json();
        alert(error.error || "Gagal menghapus video");
      }
    } catch (error) {
      alert("Gagal menghapus video");
    }
  };

  const handlePlayUploadedVideo = async (index: number) => {
    try {
      const formData = new FormData();
      formData.append("action", "switchSource");
      formData.append("source", "upload");
      formData.append("index", String(index));

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Update local state
        setUploadedVideos((prev) =>
          prev.map((video, i) => ({
            ...video,
            isActive: i === index,
          })),
        );
        setVideoStatus((prev) =>
          prev ? { ...prev, activeSource: "upload" } : null,
        );
        alert(`✅ Video sekarang diputar di TV`);
      } else {
        alert("Gagal memutar video");
      }
    } catch (error) {
      alert("Gagal memutar video");
    }
  };

  const handlePlaySource = async (source: "upload" | "youtube") => {
    try {
      const formData = new FormData();
      formData.append("action", "switchSource");
      formData.append("source", source);

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setVideoStatus((prev) =>
          prev ? { ...prev, activeSource: source } : null,
        );
        alert(
          `✅ ${source === "upload" ? "Video uploaded" : "YouTube playlist"} sekarang diputar di TV`,
        );
      }
    } catch (error) {
      alert("Gagal mengganti sumber video");
    }
  };

  // Stop playback: activeSource = null => TV stops playing current video.
  const handleStopVideo = async () => {
    try {
      const formData = new FormData();
      formData.append("action", "stop");

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setVideoStatus((prev) =>
          prev ? { ...prev, activeSource: null } : null,
        );
        alert("⏹ Video distoped di TV");
      } else {
        alert("Gagal distop video");
      }
    } catch (error) {
      alert("Gagal distop video");
    }
  };

  // Next playing: advance to the next video (YouTube or uploaded).
  const handleNextVideo = async () => {
    try {
      const formData = new FormData();
      formData.append("action", "nextVideo");

      const response = await fetch("/api/video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (videoStatus?.activeSource === "youtube") {
          setCurrentIndex(data.currentIndex || 0);
        } else {
          // uploaded: update the active marker
          setUploadedVideos((prev) =>
            prev.map((v, i) => ({ ...v, isActive: i === data.currentIndex })),
          );
        }
        alert("⏭ Video berikutnya diputar di TV");
      } else {
        alert("Gagal mengganti video");
      }
    } catch (error) {
      alert("Gagal mengganti video");
    }
  };

  // Load current video status on mount
  useEffect(() => {
    const fetchVideoStatus = async () => {
      try {
        const response = await fetch("/api/video");
        if (response.ok) {
          const data = await response.json();
          setVideoStatus(data.video);

          if (
            data.video?.type === "youtube" &&
            data.video?.youtubeUrls?.length > 0
          ) {
            setPlaylist(
              data.video.youtubeUrls.map((url: string, i: number) => ({
                url,
                videoId: extractVideoId(url),
                title: data.video.youtubeTitles?.[i] || url,
                index: i,
              })),
            );
            setCurrentIndex(data.video.currentUrlIndex || 0);
          } else if (
            data.video?.type === "upload" &&
            data.video?.uploadedVideos?.length > 0
          ) {
            setUploadedVideos(
              data.video.uploadedVideos.map((video: any) => ({
                url: video.url,
                filename: video.filename,
                name: video.name,
                size: video.size,
                index: video.index,
                isActive: video.isActive,
              })),
            );
          }
        }
      } catch (error) {
        console.error("Error fetching video status:", error);
      }
    };

    fetchVideoStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "Unknown";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-slate-700 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <Play className="w-6 h-6 text-red-400" />
          Playlist Video TV Display
        </CardTitle>
        <p className="text-sm text-slate-400">
          Kelola video YouTube untuk ditampilkan di TV ruang tunggu
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-slate-700 pb-4">
          <button
            onClick={() => setActiveTab("youtube")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "youtube"
                ? "bg-red-500 text-white shadow-lg"
                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            🎵 YouTube Playlist
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "upload"
                ? "bg-purple-500 text-white shadow-lg"
                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            📁 Upload Video
          </button>
        </div>

        {/* YouTube Playlist Tab */}
        {activeTab === "youtube" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Add Video Form — kolom kiri */}
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Link className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Tambah Video ke Playlist
                  </h3>
                  <p className="text-xs text-slate-400">
                    Masukkan link YouTube dan beri judul untuk video
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    URL Video YouTube
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Link className="w-4 h-4 text-red-400" />
                    </div>
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleAddToPlaylist()
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Judul Video
                    <span className="ml-1 text-xs text-slate-500 font-normal">
                      (opsional — ditampilkan di playlist)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={youtubeTitle}
                    onChange={(e) => setYoutubeTitle(e.target.value)}
                    placeholder="Contoh: Profil Rumah Sakit PKU Gombong"
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleAddToPlaylist()
                    }
                  />
                </div>

                <Button
                  onClick={handleAddToPlaylist}
                  disabled={uploading || !youtubeUrl.trim()}
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white h-12 text-base font-semibold shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {uploading ? (
                    <>
                      <Clock className="w-5 h-5 mr-2 animate-spin" />
                      Menambahkan...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Tambahkan ke Playlist
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Playlist Display — kolom kanan */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Playlist YouTube ({playlist.length} video)
                </h3>
                <div className="flex gap-2">
                  {videoStatus?.activeSource !== "youtube" &&
                    playlist.length > 0 && (
                      <Button
                        onClick={() => handlePlaySource("youtube")}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Play
                      </Button>
                    )}
                  {videoStatus?.activeSource === "youtube" && (
                    <Button
                      onClick={handleStopVideo}
                      className="bg-red-500 hover:bg-red-600 text-white"
                      size="sm"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  )}
                  <Button
                    onClick={handleNextVideo}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Next
                  </Button>
                </div>
              </div>

              {playlist.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {playlist.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                        index === currentIndex &&
                        videoStatus?.activeSource === "youtube"
                          ? "bg-green-500/20 border-green-500/50 shadow-lg"
                          : "bg-slate-700/50 border-slate-600 hover:bg-slate-700"
                      }`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {item.title || item.videoId}
                        </p>
                        {index === currentIndex &&
                          videoStatus?.activeSource === "youtube" && (
                            <p className="text-xs text-green-400 font-medium mt-1">
                              ▶ Sedang diputar
                            </p>
                          )}
                      </div>

                      <div className="flex-shrink-0 flex gap-2">
                        {index !== currentIndex ||
                        videoStatus?.activeSource !== "youtube" ? (
                          <button
                            onClick={() => handlePlayVideo(index)}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-all"
                            title="Putar video ini"
                          >
                            <Play className="w-5 h-5" />
                          </button>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                            <Play className="w-3 h-3 mr-1" />
                            Playing
                          </Badge>
                        )}
                        <button
                          onClick={() => handleRemoveVideo(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all"
                          title="Hapus dari playlist"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-dashed border-slate-600">
                  <Play className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 text-lg mb-2">Belum ada video</p>
                  <p className="text-slate-500 text-sm">
                    Tambahkan URL YouTube di sebelah kiri
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="space-y-6">
            {/* Upload Form */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                Upload Video Manual
              </h3>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleUploadVideo}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white h-12 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Pilih Video dari Komputer
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 mt-3 text-center">
                Format: MP4, WebM, MOV, AVI (Maksimal 500MB)
              </p>
            </div>

            {/* Uploaded Videos List */}
            {uploadedVideos.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Video Uploaded ({uploadedVideos.length} video)
                  </h3>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {uploadedVideos.map((video, index) => (
                    <div
                      key={video.filename}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                        video.isActive && videoStatus?.activeSource === "upload"
                          ? "bg-green-500/20 border-green-500/50 shadow-lg"
                          : "bg-slate-700/50 border-slate-600 hover:bg-slate-700"
                      }`}
                    >
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
                        <Play className="w-6 h-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {video.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(video.size)}
                        </p>
                        {video.isActive &&
                          videoStatus?.activeSource === "upload" && (
                            <p className="text-xs text-green-400 font-medium mt-1">
                              ▶ Sedang diputar
                            </p>
                          )}
                      </div>

                      <div className="flex-shrink-0 flex gap-2">
                        {!video.isActive ||
                        videoStatus?.activeSource !== "upload" ? (
                          <button
                            onClick={() => handlePlayUploadedVideo(index)}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-all"
                            title="Putar video ini"
                          >
                            <Play className="w-5 h-5" />
                          </button>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                            <Play className="w-3 h-3 mr-1" />
                            Playing
                          </Badge>
                        )}
                        <button
                          onClick={() => handleDeleteUploadedVideo(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all"
                          title="Hapus video"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300">
                    💡 Klik tombol Play untuk memutar video di TV. Hanya satu
                    video yang bisa diputar pada satu waktu.
                  </p>
                </div>
              </div>
            )}

            {uploadedVideos.length === 0 && (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-600">
                <Upload className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg mb-2">Belum ada video</p>
                <p className="text-slate-500 text-sm">
                  Upload video dari komputer Anda di atas
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
