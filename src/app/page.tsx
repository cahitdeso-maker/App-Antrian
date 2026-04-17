import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-primary">
            Sistem Antrian Pendaftaran Poli Klinik
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Solusi terpadu untuk manajemen antrian yang efisien
          </p>
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
              <p className="text-muted-foreground mb-4">
                Pasien memilih jadwal (Pagi/Siang), lalu tipe (BPJS/Umum) untuk mendapatkan nomor antrian
              </p>
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
              <p className="text-muted-foreground mb-4">
                Petugas admin dapat memanggil, mengulang, atau melewati antrian pasien
              </p>
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
              <p className="text-muted-foreground mb-4">
                Menampilkan nomor antrian yang sedang dipanggil dengan notifikasi suara
              </p>
              <Link href="/tv">
                <Button className="w-full" size="lg" variant="secondary">
                  Buka Layar TV
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Fitur Utama</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">✅ Sistem Tiket Mandiri</h3>
              <p className="text-muted-foreground">
                Pasien dapat mengambil nomor antrian secara mandiri melalui kiosk
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">✅ Pengelompokan Antrian</h3>
              <p className="text-muted-foreground">
                Membedakan pasien BPJS/Umum dan jadwal Pagi/Siang
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">✅ Auto-Reset Harian</h3>
              <p className="text-muted-foreground">
                Nomor antrian otomatis reset setiap pergantian hari/shift
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">✅ Notifikasi Real-time</h3>
              <p className="text-muted-foreground">
                Layar TV menampilkan antrian secara real-time dengan suara ting-tong
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 Sistem Antrian Poli Klinik. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
