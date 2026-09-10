import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
          </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Kiosk Card */}
          <Card className="hover:shadow-2xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-2xl">🖥️ Kiosk Pasien</CardTitle>
              <CardDescription>
                Ambil nomor antrian secara mandiri
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/kiosk">
                <Button className="w-full" size="lg">
                  Buka Kiosk
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Admin Dashboard Card */}
          <Card className="hover:shadow-2xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-2xl">👨‍💼 Dashboard Admin</CardTitle>
              <CardDescription>
                Kelola dan panggil antrian
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full" size="lg" variant="outline">
                  Login Admin
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* TV Display Card */}
          <Card className="hover:shadow-2xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-2xl">📺 Layar TV</CardTitle>
              <CardDescription>
                Tampilan antrian untuk ruang tunggu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tv">
                <Button className="w-full" size="lg" variant="secondary">
                  Buka Layar TV
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>        
      </main>

      {/* Footer */}
      <div className="mt-4 text-center">
            <p className="text-xs text-slate-500">
              IT Pku Muhammadiyah Gombong &copy; {new Date().getFullYear()}
            </p>
          </div>
    </div>
  );
}
