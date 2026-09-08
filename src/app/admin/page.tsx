"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import VideoManager from "@/components/video-manager";
import {
  LogOut,
  LayoutDashboard,
  Monitor,
  PhoneCall,
  Users,
  Clock,
  ChevronDown,
  KeyRound,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
interface Queue {
  id: number;
  queueNumber: string;
  patientType: "BPJS" | "UMUM";
  shift: "PAGI" | "SIANG";
  status: "MENUNGGU" | "DIPANGGIL" | "SELESAI" | "DILEWATI";
  loket?: string;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userImage, setUserImage] = useState("");
  const [userRole, setUserRole] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  // Ubah password modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [waitingQueues, setWaitingQueues] = useState<Queue[]>([]);
  const [calledQueues, setCalledQueues] = useState<Queue[]>([]);
  // Track in-flight calls per queue id (Set so multiple loket can call
  // concurrently), plus a ref that synchronously reserves a queue id the
  // moment a loket clicks "panggil" — before the async request runs — so
  // that two loket calling at the same time never pick the same number.
  const [callingQueues, setCallingQueues] = useState<Set<number>>(new Set());
  const takenIdsRef = useRef<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // A queue id is "busy" if it was just reserved or is currently being called
  const isBusy = (id: number) =>
    callingQueues.has(id) || takenIdsRef.current.has(id);

  // Ambil nilai angka dari nomor antrian ("B-003" -> 3) untuk memilih nomor
  // terkecil yang masih menunggu.
  const queueNumberValue = (q: Queue): number => {
    const part = q.queueNumber ? q.queueNumber.split("-").pop() : "";
    return parseInt(part || "", 10) || 0;
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load profil user yang sedang login (data diambil langsung dari tabel `user`
  // melalui endpoint GET /api/auth/user) sehingga profil login dapat ditampilkan
  // di pojok kanan atas, di sebelah tombol Keluar.
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/user");
        if (response.ok) {
          const data = await response.json();
          const user = data?.user;
          if (user) {
            setUserName(user.name || user.username || "");
            setUserImage(user.image || "");
            setUserRole(
              typeof user.role === "string" && user.role
                ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                : "",
            );
          }
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
      }
    };
    loadUser();
  }, []);

  // Tutup dropdown profil ketika mengklik di luar area profil.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch queues
      const queuesResponse = await fetch("/api/loket/queues");
      if (queuesResponse.ok) {
        const data = await queuesResponse.json();
        // Sort called queues by updatedAt DESC (most recent first)
        const sortedCalled = (data.queues.called || []).sort(
          (a: any, b: any) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime(),
        );

        // Reset antrian menunggu: jika sudah lewat jam 00:00 (hari berganti),
        // antrian hari sebelumnya dibuang sehingga nomor antrian yang ditampilkan
        // mulai dari nomor awal lagi (A-001 / B-001).
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Filter hanya antrian yang dibuat hari ini (setelah jam 00:00).
        // Berlaku untuk antrian menunggu DAN antrian yang sudah dipanggil loket,
        // sehingga setelah lewat jam 00:00 keduanya mulai dari nomor awal lagi.
        const filterToday = (q: any) => {
          const created = new Date(q.createdAt || q.created_at || 0);
          return created.getTime() >= startOfToday.getTime();
        };

        const waitingToday = (data.queues.waiting || []).filter(filterToday);
        const calledToday = sortedCalled.filter(filterToday);

        // Clean up reservations for queues that are no longer waiting
        // (e.g. already pulled into a loket after a successful call).
        const remainingIds = new Set(waitingToday.map((q: any) => q.id));
        takenIdsRef.current = new Set(
          [...takenIdsRef.current].filter((id) => remainingIds.has(id)),
        );

        setWaitingQueues(waitingToday);
        setCalledQueues(calledToday);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/login";
    }
  };

  // Ubah password user yang sedang login.
  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak cocok");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setPasswordSuccess(data.message || "Password berhasil diubah");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordError(data.error || "Terjadi kesalahan saat ubah password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("Terjadi kesalahan server");
    } finally {
      setPasswordLoading(false);
    }
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordError("");
    setPasswordSuccess("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleCallNextQueue = async (
    loket: string,
    patientType: "BPJS" | "UMUM",
  ) => {
    // Find the next waiting queue for this specific patient type, skipping
    // any that are already reserved/being called by another loket so that
    // simultaneous calls always get different numbers. Picks the SMALLEST
    // (lowest) queue number that is still waiting.
    const nextQueue = waitingQueues
      .filter(
        (q) =>
          q.patientType === patientType &&
          !takenIdsRef.current.has(q.id) &&
          !callingQueues.has(q.id),
      )
      .sort((a, b) => queueNumberValue(a) - queueNumberValue(b))[0];

    if (!nextQueue) {
      alert(`Tidak ada antrian ${patientType} yang menunggu`);
      return;
    }

    // Reserve synchronously so a concurrent click on another loket skips it.
    takenIdsRef.current.add(nextQueue.id);
    setCallingQueues((prev) => new Set(prev).add(nextQueue.id));

    try {
      const response = await fetch(`/api/loket/${nextQueue.id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loket }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${data.message}`);
        // Refresh data
        setTimeout(fetchData, 500);
      } else {
        const errorData = await response.json();
        console.error("❌ Failed to call queue:", errorData);
        alert(`Gagal memanggil antrian: ${errorData.error || "Unknown error"}`);
        // Call failed -> free the reservation so it can be tried again
        takenIdsRef.current.delete(nextQueue.id);
      }
    } catch (error) {
      console.error("❌ Error calling queue:", error);
      alert("Terjadi kesalahan saat memanggil antrian");
      takenIdsRef.current.delete(nextQueue.id);
    } finally {
      setCallingQueues((prev) => {
        const next = new Set(prev);
        next.delete(nextQueue.id);
        return next;
      });
    }
  };

  // Panggil ulang nomor yang sedang/telah dipanggil terakhir oleh loket tertentu
  const handleRecallQueue = async (
    loket: string,
    queueId: number,
    queueNumber: string,
  ) => {
    setCallingQueues((prev) => new Set(prev).add(queueId));

    try {
      const response = await fetch(`/api/loket/${queueId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loket }),
      });

      if (response.ok) {
        console.log(`✅ ${loket} memanggil ulang ${queueNumber}`);
        // Refresh data
        setTimeout(fetchData, 500);
      } else {
        const errorData = await response.json();
        console.error("❌ Failed to recall queue:", errorData);
        alert(`Gagal memanggil ulang: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("❌ Error recalling queue:", error);
      alert("Terjadi kesalahan saat memanggil ulang");
    } finally {
      setCallingQueues((prev) => {
        const next = new Set(prev);
        next.delete(queueId);
        return next;
      });
    }
  };

  const LoketCard = ({
    loket,
    loketNumber,
  }: {
    loket: string;
    loketNumber: number;
  }) => {
    const currentQueue = calledQueues.find((q) => q.loket === loket);
    // Next (smallest) available queue for this patient type, skipping any that
    // are already reserved/being called by another loket.
    const pickSmallest = (patientType: "BPJS" | "UMUM") =>
      waitingQueues
        .filter((q) => q.patientType === patientType && !isBusy(q.id))
        .sort((a, b) => queueNumberValue(a) - queueNumberValue(b))[0];
    const nextBPJS = pickSmallest("BPJS");
    const nextUMUM = pickSmallest("UMUM");

    return (
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-2 border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-400" />
              {loket.replace("_", " ")}
            </CardTitle>
            {currentQueue && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                <PhoneCall className="w-3 h-3 mr-1" />
                Dipanggil
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Queue Display */}
          <div className="min-h-[100px] p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            {currentQueue ? (
              <div className="space-y-3 text-center">
                <div className="text-4xl font-bold text-blue-400 text-center">
                  {currentQueue.queueNumber}
                </div>
                <div className="flex gap-2 justify-center">
                  <Badge
                    variant={
                      currentQueue.patientType === "BPJS"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {currentQueue.patientType === "BPJS"
                      ? "🏥 BPJS"
                      : "👤 UMUM"}
                  </Badge>
                  <Badge className="bg-black text-white hover:bg-neutral-800">
                    {currentQueue.shift === "PAGI" ? "☀️ Pagi" : "🌙 Siang"}
                  </Badge>
                </div>
                <Button
                  onClick={() =>
                    handleRecallQueue(
                      loket,
                      currentQueue.id,
                      currentQueue.queueNumber,
                    )
                  }
                  disabled={callingQueues.has(currentQueue.id)}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:opacity-50 text-white border-2 border-amber-500 hover:border-amber-400 transition-all duration-200"
                >
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Panggil Ulang {currentQueue.queueNumber}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Menunggu...</p>
                </div>
              </div>
            )}
          </div>

          {/* Call Buttons - BPJS and UMUM */}
          <div className="space-y-3">
            <p className="text-sm text-slate-400 font-medium">
              Panggil antrian berikutnya:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleCallNextQueue(loket, "BPJS")}
                disabled={!nextBPJS}
                className="h-auto py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white border-2 border-blue-500 hover:border-blue-400 transition-all duration-200"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">🏥</span>
                  <span className="font-semibold text-sm">BPJS</span>
                  {nextBPJS && (
                    <span className="text-xs opacity-80">
                      {nextBPJS.queueNumber}
                    </span>
                  )}
                </div>
              </Button>

              {/* UMUM Button */}
              <Button
                onClick={() => handleCallNextQueue(loket, "UMUM")}
                disabled={!nextUMUM}
                className="h-auto py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:opacity-50 text-white border-2 border-green-500 hover:border-green-400 transition-all duration-200"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">👤</span>
                  <span className="font-semibold text-sm">UMUM</span>
                  {nextUMUM && (
                    <span className="text-xs opacity-80">
                      {nextUMUM.queueNumber}
                    </span>
                  )}
                </div>
              </Button>
            </div>

            {/* Queue count info */}
            <div className="flex gap-2 text-xs text-slate-400 justify-center">
              <span>
                BPJS:{" "}
                {waitingQueues.filter((q) => q.patientType === "BPJS").length}{" "}
                menunggu
              </span>
              <span>•</span>
              <span>
                UMUM:{" "}
                {waitingQueues.filter((q) => q.patientType === "UMUM").length}{" "}
                menunggu
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/img/sistem.png"
              alt="Logo RS PKU"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-white">
                Dashboard Antrian
              </h1>
              <p className="text-xs text-slate-400">
                RS PKU Muhammadiyah Gombong
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(userName || userImage) && (
              <div ref={profileRef} className="relative">
                {/* Tombol profil — klik untuk membuka menu (berisi info & keluar) */}
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  aria-haspopup="true"
                  aria-expanded={profileOpen}
                  className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shrink-0 overflow-hidden">
                    {userImage ? (
                      <img
                        src={userImage}
                        alt={userName}
                        className="w-10 h-10 object-cover"
                      />
                    ) : (
                      <span className="text-lg">
                        {(userName || "U")
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase() ?? "")
                          .join("") || "U"}
                      </span>
                    )}
                  </div>
                  <div className="text-left leading-tight min-w-0 hidden sm:block">
                    <p className="text-sm font-semibold text-white whitespace-nowrap">
                      {userName || "User"}
                    </p>
                    {userRole && (
                      <p className="text-xs text-slate-400 whitespace-nowrap">
                        {userRole}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown profil */}
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-3 z-50">
                    <div className="flex items-center gap-3 border-b border-slate-700 pb-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shrink-0 overflow-hidden">
                        {userImage ? (
                          <img
                            src={userImage}
                            alt={userName}
                            className="w-12 h-12 object-cover"
                          />
                        ) : (
                          <span className="text-lg">
                            {(userName || "U")
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0]?.toUpperCase() ?? "")
                              .join("") || "U"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {userName || "User"}
                        </p>
                        {userRole && (
                          <p className="text-xs text-slate-400">{userRole}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setPasswordModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 mt-2 py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:text-blue-300 transition-all cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span className="font-semibold">Ubah Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 mt-2 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-semibold">Keluar</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-6 pt-2 pb-8 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Antrian Menunggu BPJS */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-400 mb-1">
                    Antrian Menunggu BPJS
                  </p>
                  <p className="text-4xl font-bold text-white">
                    {
                      waitingQueues.filter((q) => q.patientType === "BPJS")
                        .length
                    }
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <span className="text-3xl">🏥</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-300">
                Menunggu panggilan
              </div>
            </CardContent>
          </Card>

          {/* Antrian Menunggu UMUM */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-400 mb-1">
                    Antrian Menunggu UMUM
                  </p>
                  <p className="text-4xl font-bold text-white">
                    {
                      waitingQueues.filter((q) => q.patientType === "UMUM")
                        .length
                    }
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <span className="text-3xl">👤</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-green-300">
                Menunggu panggilan
              </div>
            </CardContent>
          </Card>

          {/* Sedang Dipanggil - Last Called */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <PhoneCall className="w-5 h-5 text-purple-400" />
                <p className="text-sm text-purple-400 font-medium">
                  Loket Sedang Memanggil
                </p>
              </div>
              {calledQueues.length > 0 ? (
                <div className="flex items-center gap-3 bg-purple-500/20 rounded-lg p-4 border border-purple-500/30">
                  <span className="text-lg font-bold text-white">
                    {calledQueues[0].loket
                      ? calledQueues[0].loket.replace("_", " ")
                      : "LOKET"}
                  </span>
                  <span className="text-2xl text-purple-300">→</span>
                  <span className="text-3xl font-bold text-blue-400">
                    {calledQueues[0].queueNumber}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <span className="text-purple-300 text-sm">
                    Belum ada antrian dipanggil
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Antrian Dipanggil ke Loket */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-400 mb-1">
                    Total Dipanggil ke Loket
                  </p>
                  <p className="text-4xl font-bold text-white">
                    {calledQueues.length}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Users className="w-7 h-7 text-orange-400" />
                </div>
              </div>
              <div className="mt-2 text-xs text-orange-300">
                Jumlah nomor yang sudah dipanggil ke loket
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loket Call Buttons Section */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-blue-400" />
            Panggil Antrian per Loket
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 -mt-4">
            <LoketCard loket="LOKET_1" loketNumber={1} />
            <LoketCard loket="LOKET_2" loketNumber={2} />
            <LoketCard loket="LOKET_3" loketNumber={3} />
            <LoketCard loket="LOKET_4" loketNumber={4} />
          </div>
        </div>

        {/* Video Manager Component */}
        <VideoManager />

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-800">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} RS PKU Muhammadiyah Gombong
          </p>
        </div>
      </main>

      {/* Modal Ubah Password */}
      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closePasswordModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 m-4"
            role="dialog"
            aria-modal="true"
            aria-label="Ubah Password"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                Ubah Password
              </h3>
              <button
                type="button"
                onClick={closePasswordModal}
                aria-label="Tutup"
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message success */}
            {passwordSuccess && (
              <div className="flex items-center gap-3 mb-4 rounded-lg bg-green-500/15 border border-green-500/40 p-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <p className="text-sm text-green-300">{passwordSuccess}</p>
              </div>
            )}
            {/* Message error */}
            {passwordError && (
              <div className="flex items-center gap-3 mb-4 rounded-lg bg-red-500/15 border border-red-500/40 p-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{passwordError}</p>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Password lama */}
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-sm text-slate-300 mb-1"
                >
                  Password Lama
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full bg-slate-800/50 border-slate-700 text-slate-100 pr-10 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-lg py-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    aria-label={
                      showCurrent ? "Barikari password" : "Tampil password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCurrent ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password baru */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm text-slate-300 mb-1"
                >
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-slate-800/50 border-slate-700 text-slate-100 pr-10 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-lg py-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    aria-label={
                      showNew ? "Barikari password" : "Tampil password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showNew ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Konfirmasi password baru */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm text-slate-300 mb-1"
                >
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-slate-800/50 border-slate-700 text-slate-100 pr-10 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-lg py-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={
                      showConfirm ? "Barikari password" : "Tampil password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Button submit */}
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-60 text-white border-2 border-blue-500 hover:border-blue-400 transition-all cursor-pointer"
              >
                {passwordLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    Ubah sedang...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Ubah Password
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
