"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";

type PatientType = "BPJS" | "UMUM" | null;
type Shift = "PAGI" | "SIANG" | null;

export default function KioskPage() {
  const [patientType, setPatientType] = useState<PatientType>(null);
  const [shift, setShift] = useState<Shift>(null);
  const [queueNumber, setQueueNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Jadwal tidak dipilih pengunjung lagi, melainkan otomatis mengikuti jam saat
  // nomor dicetak. Ini hanya untuk tampilan; nilai resmi ditentukan server.
  const getCurrentShift = (): Shift => {
    const hour = new Date().getHours();
    return hour < 12 ? "PAGI" : "SIANG";
  };

  const handlePatientTypeSelect = async (selectedType: PatientType) => {
    setPatientType(selectedType);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientType: selectedType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal membuat nomor antrian");
      }

      const data = await response.json();
      setQueueNumber(data.queueNumber);
      setShift(data.shift || getCurrentShift());
    } catch (err) {
      console.error("Error creating queue:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membuat antrian",
      );
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPatientType(null);
    setShift(null);
    setQueueNumber(null);
    setError(null);
    setIsLoading(false);
  };

  // Auto-print and reset
  useEffect(() => {
    if (queueNumber) {
      const printTimeout = setTimeout(() => {
        window.print();
      }, 300);

      const resetTimeout = setTimeout(() => {
        handleReset();
      }, 3000);

      return () => {
        clearTimeout(printTimeout);
        clearTimeout(resetTimeout);
      };
    }
  }, [queueNumber]);

  return (
    <>
      {/* ==================================================
          1. UI KIOSK (OTOMATIS HIDE SAAT PRINT SEHINGGA KERTAS TIDAK TERBUANG)
         ================================================== */}
      <div className="no-print relative w-screen h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0 w-full h-full">
          <Image
            src="/img/backgroundPKUGOMBONG.jpg"
            alt="RS PKU Muhammadiyah Gombong"
            fill
            className="object-fill w-full h-full"
            priority
            sizes="100vw"
            quality={100}
          />
        </div>

        <div className="relative z-10 w-full max-w-5xl px-4">
          {/* <div className="text-center mb-8"></div> */}

          {/* Main Card */}
          <div className="w-full max-w-5xl mx-auto space-y-8">
            {/* Header Judul Langsung */}
            <div className="text-center space-y-3">
              <h2 className="text-5xl font-black text-[#00A859] tracking-tight">
                Pilih Tipe Pasien
              </h2>
              <p className="text-xl text-[#00A859] font-bold">
                Jadwal Pendaftaran:{" "}
                <span className="text-[#00A859] font-extrabold decoration-2">
                  {getCurrentShift() === "PAGI"
                    ? "☀️ Pagi (06:00 - 12:00)"
                    : "🌙 Siang (12:00 - 20:00)"}
                </span>
              </p>
            </div>

            {/* Grid Tombol Pilihan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Tombol BPJS */}
              <Button
                onClick={() => handlePatientTypeSelect("BPJS")}
                disabled={isLoading}
                className="h-64 bg-gradient-to-br from-green-500 via-emerald-600 to-green-700 hover:from-green-600 hover:to-emerald-800 text-white border-4 border-green-300/40 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 rounded-3xl flex flex-col justify-center items-center gap-3 group relative overflow-hidden"
              >
                <div className="w-24 h-24 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-2xl shadow-lg border border-white/30 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-5xl">🏥</span>
                </div>
                <div className="text-center">
                  <span className="text-5xl font-black tracking-wider block text-white drop-shadow-md">
                    PASIEN BPJS
                  </span>
                  <span className="text-lg font-medium text-green-100 mt-1 block">
                    Pendaftaran dengan Kartu BPJS / JKN
                  </span>
                </div>
              </Button>

              {/* Tombol UMUM */}
              <Button
                onClick={() => handlePatientTypeSelect("UMUM")}
                disabled={isLoading}
                className="h-64 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 hover:from-blue-700 hover:to-indigo-900 text-white border-4 border-blue-300/40 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 rounded-3xl flex flex-col justify-center items-center gap-3 group relative overflow-hidden"
              >
                <div className="w-24 h-24 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-2xl shadow-lg border border-white/30 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-5xl">👤</span>
                </div>
                <div className="text-center">
                  <span className="text-5xl font-black tracking-wider block text-white drop-shadow-md">
                    PASIEN UMUM
                  </span>
                  <span className="text-lg font-medium text-blue-100 mt-1 block">
                    Pendaftaran Non-BPJS / Penjamin lain
                  </span>
                </div>
              </Button>
            </div>

            {/* Status Loading & Error */}
            {isLoading && !queueNumber && (
              <div className="text-center pt-6">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent"></div>
                <p className="mt-3 text-xl text-white font-bold animate-pulse drop-shadow-md">
                  Mencetak tiket antrian...
                </p>
              </div>
            )}

            {error && !queueNumber && (
              <div className="bg-red-600 text-white border-2 border-red-400 px-6 py-4 rounded-2xl text-center text-xl font-bold shadow-2xl mt-6">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-md border border-white/50">
              <span className="text-2xl">👆</span>
              <p className="text-base text-board text-black-700 font-bold">
                Sentuh pilihan Anda untuk melanjutkan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          2. DOKUMEN KHUSUS TIKET PRINT (DILUAR WRAPPER UTAMA)
         ================================================== */}
      {queueNumber && (
        <div id="ticket-print">
          <div className="nama-rs">RS PKU MUHAMMADIYAH GOMBONG</div>
          <div className="divider"></div>
          <div className="label">NOMOR ANTRIAN</div>
          <div className="nomor-antrian">{queueNumber}</div>
          <div className="divider"></div>
          <div className="info-row">
            <span className="badge">
              {patientType === "BPJS" ? "🏥 BPJS" : "👤 UMUM"}
            </span>
            <span className="badge">
              {shift === "PAGI" ? "☀️ Pagi" : "🌙 Siang"}
            </span>
          </div>
          <div className="divider"></div>
          <div className="tanggal">
            📅{" "}
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            <br />
            🕐{" "}
            {new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div className="divider"></div>
          <div className="footer">
            Silakan menunggu panggilan
            <br />
            <span className="footer-small">di ruang tunggu yang tersedia</span>
          </div>
        </div>
      )}

      {/* ==================================================
          3. PRINT STYLES
         ================================================== */}
      <style jsx global>{`
        /* Sembunyikan tiket di layar Kiosk biasa */
        #ticket-print {
          display: none;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: auto;
          }

          /* Sembunyikan seluruh UI web/Kiosk saat mencetak */
          html,
          body {
            width: 80mm;
            margin-top: auto;
            height: auto;
            margin: 0;
            padding: 2mm;
            background: #fff;
            overflow: hidden;
          }

          .no-print {
            display: none;
          }

          /* Tampilkan HANYA tiket */
          #ticket-print {
            display: block;
            position: relative;
            width: 72mm;
            max-width: 72mm;
            margin: auto auto;
            padding: auto;
            border: 1px solid black;
            box-sizing: border-box;
            text-align: center;
            font-family: monospace;
          }

          #ticket-print * {
            visibility: visible;
          }

          .nama-rs {
            font-size: 9pt;
            font-weight: bold;
            line-height: 1.1;
            margin: 1.5mm;
          }
          .divider {
            border-top: 1px dashed black;
            margin: 1.5mm 0;
          }
          .label {
            font-size: 8pt;
            font-weight: bold;
            margin: 0;
          }
          .nomor-antrian {
            font-size: 32pt;
            font-weight: bold;
            margin: 1mm 0;
            line-height: 1;
            letter-spacing: 1px;
          }
          .info-row {
            margin: 1mm 0;
          }
          .badge {
            display: inline-block;
            padding: 0.5mm 1.5mm;
            font-size: 7pt;
            margin: 0 1mm;
          }
          .tanggal {
            font-size: 7pt;
            line-height: 1.2;
          }
          .footer {
            font-size: 7pt;
            line-height: 1.2;
          }
          .footer-small {
            font-size: 6pt;
          }
        }
      `}</style>
    </>
  );
}
