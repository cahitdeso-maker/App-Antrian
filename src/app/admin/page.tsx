'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import VideoManager from '@/components/video-manager';
import {
  LogOut,
  LayoutDashboard,
  Monitor,
  PhoneCall,
  Users,
  Clock,
} from 'lucide-react';

interface Queue {
  id: number;
  queueNumber: string;
  patientType: 'BPJS' | 'UMUM';
  shift: 'PAGI' | 'SIANG';
  status: 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI' | 'DILEWATI';
  loket?: string;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [waitingQueues, setWaitingQueues] = useState<Queue[]>([]);
  const [calledQueues, setCalledQueues] = useState<Queue[]>([]);
  const [callingQueue, setCallingQueue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch queues
      const queuesResponse = await fetch('/api/loket/queues');
      if (queuesResponse.ok) {
        const data = await queuesResponse.json();
        // Sort called queues by updatedAt DESC (most recent first)
        const sortedCalled = (data.queues.called || []).sort(
          (a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
        );
        setWaitingQueues(data.queues.waiting || []);
        setCalledQueues(sortedCalled);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/login';
    }
  };

  const handleCallNextQueue = async (loket: string, patientType: 'BPJS' | 'UMUM') => {
    // Find the next waiting queue for this specific patient type
    const nextQueue = waitingQueues.find(q => q.patientType === patientType);

    if (!nextQueue) {
      alert(`Tidak ada antrian ${patientType} yang menunggu`);
      return;
    }

    try {
      setCallingQueue(nextQueue.id);
      const response = await fetch(`/api/loket/${nextQueue.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loket }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${data.message}`);
        // Refresh data
        setTimeout(fetchData, 500);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to call queue:', errorData);
        alert(`Gagal memanggil antrian: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error calling queue:', error);
      alert('Terjadi kesalahan saat memanggil antrian');
    } finally {
      setCallingQueue(null);
    }
  };

  const LoketCard = ({
    loket,
    loketNumber
  }: {
    loket: string;
    loketNumber: number;
  }) => {
    const currentQueue = calledQueues.find(q => q.loket === loket);
    const nextBPJS = waitingQueues.find(q => q.patientType === 'BPJS');
    const nextUMUM = waitingQueues.find(q => q.patientType === 'UMUM');

    return (
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-2 border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-400" />
              {loket.replace('_', ' ')}
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
              <div className="space-y-2">
                <div className="text-4xl font-bold text-blue-400">
                  {currentQueue.queueNumber}
                </div>
                <div className="flex gap-2">
                  <Badge variant={currentQueue.patientType === 'BPJS' ? 'default' : 'secondary'}>
                    {currentQueue.patientType === 'BPJS' ? '🏥 BPJS' : '👤 UMUM'}
                  </Badge>
                  <Badge variant="outline">
                    {currentQueue.shift === 'PAGI' ? '☀️ Pagi' : '🌙 Siang'}
                  </Badge>
                </div>
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
            <p className="text-sm text-slate-400 font-medium">Panggil antrian berikutnya:</p>
            <div className="grid grid-cols-2 gap-3">
              {/* BPJS Button */}
              <Button
                onClick={() => handleCallNextQueue(loket, 'BPJS')}
                disabled={callingQueue !== null || !nextBPJS}
                className="h-auto py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white border-2 border-blue-500 hover:border-blue-400 transition-all duration-200"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">🏥</span>
                  <span className="font-semibold text-sm">BPJS</span>
                  {nextBPJS && (
                    <span className="text-xs opacity-80">{nextBPJS.queueNumber}</span>
                  )}
                </div>
              </Button>

              {/* UMUM Button */}
              <Button
                onClick={() => handleCallNextQueue(loket, 'UMUM')}
                disabled={callingQueue !== null || !nextUMUM}
                className="h-auto py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:opacity-50 text-white border-2 border-green-500 hover:border-green-400 transition-all duration-200"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">👤</span>
                  <span className="font-semibold text-sm">UMUM</span>
                  {nextUMUM && (
                    <span className="text-xs opacity-80">{nextUMUM.queueNumber}</span>
                  )}
                </div>
              </Button>
            </div>
            
            {/* Queue count info */}
            <div className="flex gap-2 text-xs text-slate-400 justify-center">
              <span>BPJS: {waitingQueues.filter(q => q.patientType === 'BPJS').length} menunggu</span>
              <span>•</span>
              <span>UMUM: {waitingQueues.filter(q => q.patientType === 'UMUM').length} menunggu</span>
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-xs text-slate-400">RS PKU Muhammadiyah Gombong</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userName && (
              <span className="text-sm text-slate-400">👋 Halo, {userName}</span>
            )}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-6 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Antrian Menunggu BPJS */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-400 mb-1">Antrian Menunggu BPJS</p>
                  <p className="text-4xl font-bold text-white">{waitingQueues.filter(q => q.patientType === 'BPJS').length}</p>
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
                  <p className="text-sm text-green-400 mb-1">Antrian Menunggu UMUM</p>
                  <p className="text-4xl font-bold text-white">{waitingQueues.filter(q => q.patientType === 'UMUM').length}</p>
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
                <p className="text-sm text-purple-400 font-medium">Loket Sedang Memanggil</p>
              </div>
              {calledQueues.length > 0 ? (
                <div className="flex items-center gap-3 bg-purple-500/20 rounded-lg p-4 border border-purple-500/30">
                  <span className="text-lg font-bold text-white">
                    {calledQueues[0].loket ? calledQueues[0].loket.replace('_', ' ') : 'LOKET'}
                  </span>
                  <span className="text-2xl text-purple-300">→</span>
                  <span className="text-3xl font-bold text-blue-400">
                    {calledQueues[0].queueNumber}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <span className="text-purple-300 text-sm">Belum ada antrian dipanggil</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Antrian Hari Ini */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-400 mb-1">Total Antrian Hari Ini</p>
                  <p className="text-4xl font-bold text-white">{waitingQueues.length + calledQueues.length}</p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Users className="w-7 h-7 text-orange-400" />
                </div>
              </div>
              <div className="mt-2 text-xs text-orange-300">
                BPJS + UMUM
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            © {new Date().getFullYear()} RS PKU Muhammadiyah Gombong - Sistem Antrian Digital
          </p>
        </div>
      </main>
    </div>
  );
}
