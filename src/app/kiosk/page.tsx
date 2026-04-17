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
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import Image from "next/image";

type PatientType = "BPJS" | "UMUM" | null;
type Shift = "PAGI" | "SIANG" | null;
type Step = "shift" | "patient";

export default function KioskPage() {
  const [step, setStep] = useState<Step>("shift");
  const [patientType, setPatientType] = useState<PatientType>(null);
  const [shift, setShift] = useState<Shift>(null);
  const [queueNumber, setQueueNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShiftSelect = (selectedShift: Shift) => {
    setShift(selectedShift);
    setStep("patient");
  };

  const handlePatientTypeSelect = async (selectedType: PatientType) => {
    if (!shift) return;

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
          shift,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal membuat nomor antrian");
      }

      const data = await response.json();
      setQueueNumber(data.queueNumber);
      // Keep isLoading true so ticket stays visible
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

  // Called after print and reset
  const finishPrintCycle = () => {
    handleReset();
  };

  // Auto-print and reset when ticket is ready
  useEffect(() => {
    if (queueNumber) {
      // Auto-print after ticket appears
      const printTimeout = setTimeout(() => {
        window.print();
      }, 500);

      // Reset after print dialog
      const resetTimeout = setTimeout(() => {
        finishPrintCycle();
      }, 3000);

      return () => {
        clearTimeout(printTimeout);
        clearTimeout(resetTimeout);
      };
    }
  }, [queueNumber]);

  const handleBack = () => {
    if (step === "patient") {
      setStep("shift");
      setShift(null);
    } else {
      handleReset();
    }
  };

  const handleReset = () => {
    setStep("shift");
    setPatientType(null);
    setShift(null);
    setQueueNumber(null);
    setError(null);
    setIsLoading(false);
  };

  // Step 1: Shift Selection (Pagi/Siang)
  if (step === "shift") {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* Background Image - Fixed/Static */}
        <div className="fixed inset-0 z-0">
          <Image
            src="/img/backgroundPKUGOMBONG.jpg"
            alt="RS PKU Muhammadiyah Gombong"
            fill
            className="object-cover"
            priority
            sizes="100vw"
            quality={100}
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-5xl">
          {/* Header with hospital branding */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-4 bg-white/95 backdrop-blur-md rounded-2xl px-8 py-5 shadow-xl border border-white/50">
              <div className="w-16 h-16 relative">
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl">🏥</span>
                </div>
              </div>
              <div className="text-left">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                  RS PKU MUHAMMADIYAH GOMBONG
                </h2>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-lg rounded-3xl overflow-hidden">
            <CardHeader className="text-center space-y-4 pb-6">
              <CardTitle className="text-5xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Sistem Antrian
              </CardTitle>
              <CardDescription className="text-xl text-gray-600 font-medium">
                Pilih jadwal kunjungan Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Button
                  onClick={() => handleShiftSelect("PAGI")}
                  size="lg"
                  className="h-52 text-3xl font-bold bg-gradient-to-br from-white to-yellow-50 hover:from-yellow-50 hover:to-orange-50 border-2 border-yellow-200 hover:border-yellow-400 transition-all duration-300 flex flex-col gap-4 shadow-lg hover:shadow-2xl hover:-translate-y-1 rounded-2xl group"
                  variant="outline"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 flex items-center justify-center bg-yellow-100 rounded-full mb-4 group-hover:bg-yellow-200 transition-colors">
                      <Sun className="w-12 h-12 text-yellow-600" />
                    </div>
                    <span className="text-gray-800 font-bold">PAGI</span>
                    <span className="text-base font-normal text-gray-500 mt-2">
                      06:00 - 12:00
                    </span>
                    <span className="text-xs text-yellow-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Pilih Jadwal ↗
                    </span>
                  </div>
                </Button>
                <Button
                  onClick={() => handleShiftSelect("SIANG")}
                  size="lg"
                  className="h-52 text-3xl font-bold bg-gradient-to-br from-white to-orange-50 hover:from-orange-50 hover:to-amber-50 border-2 border-orange-200 hover:border-orange-400 transition-all duration-300 flex flex-col gap-4 shadow-lg hover:shadow-2xl hover:-translate-y-1 rounded-2xl group"
                  variant="outline"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 flex items-center justify-center bg-orange-100 rounded-full mb-4 group-hover:bg-orange-200 transition-colors">
                      <Moon className="w-12 h-12 text-orange-600" />
                    </div>
                    <span className="text-gray-800 font-bold">SIANG</span>
                    <span className="text-base font-normal text-gray-500 mt-2">
                      13:00 - 20:00
                    </span>
                    <span className="text-xs text-orange-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Pilih Jadwal ↗
                    </span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-md border border-white/50">
              <span className="text-2xl">👆</span>
              <p className="text-base text-gray-700 font-medium">
                Sentuh pilihan Anda untuk melanjutkan
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Patient Type Selection (BPJS/Umum)
  if (step === "patient") {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* Background Image - Fixed/Static */}
        <div className="fixed inset-0 z-0">
          <Image
            src="/img/backgroundPKUGOMBONG.jpg"
            alt="RS PKU Muhammadiyah Gombong"
            fill
            className="object-cover"
            priority
            sizes="100vw"
            quality={100}
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-5xl">
          {/* Header with hospital branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-xl px-6 py-3 shadow-lg border border-white/50">
              <div className="w-12 h-12 relative">
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                  <span className="text-white text-2xl">🏥</span>
                </div>
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                  RS PKU MUHAMMADIYAH GOMBONG
                </h2>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-lg rounded-3xl overflow-hidden">
            <CardHeader className="text-center space-y-4 pb-6 relative">
              <Button
                onClick={() => {
                  setStep("shift");
                  setShift(null);
                }}
                variant="ghost"
                size="sm"
                className="absolute left-4 top-4 text-gray-600 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Kembali
              </Button>
              <div className="inline-flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full">
                <span className="text-4xl">👤</span>
              </div>
              <CardTitle className="text-5xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Pilih Tipe Pasien
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 font-medium">
                Jadwal:{" "}
                {shift === "PAGI"
                  ? "☀️ Pagi (08:00 - 12:00)"
                  : "🌙 Siang (13:00 - 16:00)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Button
                  onClick={() => handlePatientTypeSelect("BPJS")}
                  size="lg"
                  disabled={isLoading}
                  className="h-52 text-3xl font-bold bg-gradient-to-br from-white to-green-50 hover:from-green-50 hover:to-emerald-50 border-2 border-green-200 hover:border-green-400 transition-all duration-300 flex flex-col gap-4 shadow-lg hover:shadow-2xl hover:-translate-y-1 rounded-2xl group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  variant="outline"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 flex items-center justify-center bg-green-100 rounded-full mb-4 group-hover:bg-green-200 transition-colors">
                      <span className="text-4xl">🏥</span>
                    </div>
                    <span className="text-green-700 font-bold">BPJS</span>
                    <span className="text-xs text-green-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Pilih Tipe ↗
                    </span>
                  </div>
                </Button>
                <Button
                  onClick={() => handlePatientTypeSelect("UMUM")}
                  size="lg"
                  disabled={isLoading}
                  className="h-52 text-3xl font-bold bg-gradient-to-br from-white to-blue-50 hover:from-blue-50 hover:to-indigo-50 border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 flex flex-col gap-4 shadow-lg hover:shadow-2xl hover:-translate-y-1 rounded-2xl group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  variant="outline"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 flex items-center justify-center bg-blue-100 rounded-full mb-4 group-hover:bg-blue-200 transition-colors">
                      <span className="text-4xl">👤</span>
                    </div>
                    <span className="text-blue-700 font-bold">UMUM</span>
                    <span className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Pilih Tipe ↗
                    </span>
                  </div>
                </Button>
              </div>

              {queueNumber && (
                <div id="ticket-print">
                  {/* Header */}
                  <div className="logo-rs">🏥</div>
                  <div className="nama-rs">RS PKU MUHAMMADIYAH GOMBONG</div>
                  <div className="sub-header">Sistem Antrian Klinik</div>

                  <div className="divider"></div>

                  {/* Nomor Antrian */}
                  <div className="label">NOMOR ANTRIAN</div>
                  <div className="nomor-antrian">{queueNumber}</div>

                  <div className="divider"></div>

                  {/* Info Badges */}
                  <div className="info-row">
                    <span className="badge">
                      {patientType === "BPJS" ? "🏥 BPJS" : "👤 UMUM"}
                    </span>
                    <span className="badge">
                      {shift === "PAGI" ? "☀️ Pagi" : "🌙 Siang"}
                    </span>
                  </div>

                  <div className="divider"></div>

                  {/* Tanggal & Waktu */}
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

                  {/* Footer */}
                  <div className="footer">
                    ✨ Silakan menunggu panggilan ✨
                    <br />
                    <span className="footer-small">
                      di ruang tunggu yang tersedia
                    </span>
                  </div>
                </div>
              )}

              {!queueNumber && isLoading && (
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
                  <p className="mt-4 text-lg text-gray-600">
                    Memproses nomor antrian...
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-md border border-white/50">
              <span className="text-2xl">👆</span>
              <p className="text-base text-gray-700 font-medium">
                Sentuh pilihan Anda untuk melanjutkan
              </p>
            </div>
          </div>
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            @page {
              size: 80mm 100mm;
              margin: 0mm;
            }

            html,
            body {
              width: 76.5mm;
              height: 100mm;
              margin: 0;
              padding: 0;
              background: white;
              font-family: monospace;
            }

            /* Sembunyikan semua */

            body * {
              visibility: hidden;
            }

            /* Tampilkan hanya tiket */

            #ticket-print,
            #ticket-print * {
              visibility: visible;
            }

            /* Area tiket */

            #ticket-print {
              position: fixed;
              top: 40mm;
              left: 3mm;
              right: 0;
              width: 60mm;
              height: auto;
              margin: 0 auto;
              padding: 3mm;
              border: 2px solid black;
              box-sizing: border-box;
              text-align: center;
            }
            #ticket-print * {
              display: block;
            }

            /* Logo RS */

            .logo-rs {
              font-size: 12pt;
              margin-bottom: 0.5mm;
            }

            /* HEADER */

            .nama-rs {
              font-size: 9pt;
              font-weight: bold;
              line-height: 1.1;
            }

            .sub-header {
              font-size: 7pt;
              margin-top: 0.5mm;
            }

            /* GARIS */

            .divider {
              border-top: 1px dashed black;
              margin: 1mm 0;
            }

            /* LABEL */

            .label {
              font-size: 8pt;
              font-weight: bold;
            }

            /* NOMOR BESAR */

            .nomor-antrian {
              font-size: 32pt;
              font-weight: bold;
              margin: 1.5mm 0;
              letter-spacing: 2px;
            }

            /* Info Row */

            .info-row {
              margin: 1mm 0;
            }

            /* BADGE */

            .badge {
              display: inline-block;
              padding: 0.5mm 2mm;
              font-size: 7pt;
              margin: 0.5mm;
            }

            /* TANGGAL */

            .tanggal {
              font-size: 7pt;
              margin-top: 1mm;
              line-height: 1.3;
            }

            /* FOOTER */

            .footer {
              font-size: 7pt;
              margin-top: 1.5mm;
              line-height: 1.2;
            }

            .footer-small {
              font-size: 6pt;
            }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
