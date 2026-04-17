# Sistem Antrian Pendaftaran Poli Klinik

Aplikasi manajemen antrian pendaftaran poli klinik yang memungkinkan pasien mengambil nomor antrian secara mandiri melalui kiosk, admin dapat memanggil antrian, dan layar TV menampilkan antrian yang sedang dipanggil secara real-time.

## 🚀 Fitur Utama

### 1. **Kiosk Pasien** (`/kiosk`)
- Antarmuka layar sentuh yang ramah pengguna
- Pilihan tipe pasien: **BPJS** atau **UMUM**
- Pilihan jadwal: **Pagi** (08:00-12:00) atau **Sore** (13:00-16:00)
- Cetak nomor antrian otomatis
- Format nomor: 
  - `A-001, A-002, ...` untuk UMUM
  - `B-001, B-002, ...` untuk BPJS

### 2. **Dashboard Admin** (`/admin`)
- Kontrol penuh untuk memanggil antrian
- Tombol: **Panggil Selanjutnya**, **Panggil Ulang**, **Lewati**
- Filter antrian berdasarkan tipe pasien dan shift
- Statistik antrian real-time
- Tabel daftar antrian dengan status

### 3. **Layar TV** (`/tv`)
- Tampilan full-screen untuk ruang tunggu
- Nomor antrian yang sedang dipanggil dengan ukuran besar
- Riwayat 5 antrian terakhir yang sudah dipanggil
- Notifikasi suara **ting-tong** otomatis saat ada panggilan baru
- Auto-update setiap 3 detik

### 4. **Auto-Reset Nomor Antrian**
- Nomor antrian otomatis reset setiap pergantian hari
- Reset berdasarkan tanggal saat ini

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Database**: MySQL
- **ORM**: Drizzle ORM
- **Authentication**: Better Auth

## 📋 Prerequisites

Sebelum menjalankan aplikasi, pastikan Anda sudah menginstall:

- **Node.js** (versi 18 atau lebih baru)
- **MySQL** (versi 5.7 atau lebih baru)
- **npm** atau **yarn**

## ⚙️ Setup & Installation

### 1. Clone atau Navigate ke Project Directory

```bash
cd D:\antrian\antrian-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Database MySQL

Jankan MySQL dan buat database:

```bash
mysql -u root -p
```

Kemudian jalankan file SQL yang sudah disediakan:

```bash
mysql -u root -p < init-db.sql
```

Atau secara manual:

```sql
CREATE DATABASE IF NOT EXISTS db_antrian;
```

Kemudian jalankan isi dari file `init-db.sql` untuk membuat tabel-tabel yang diperlukan.

### 4. Konfigurasi Environment Variables

File `.env.local` sudah ada dengan konfigurasi default:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_antrian
BETTER_AUTH_SECRET=your-secret-key-change-this-in-production-12345
BETTER_AUTH_URL=http://localhost:3000
```

**PENTING**: Ganti `BETTER_AUTH_SECRET` dengan string random yang aman untuk production.

### 5. Jalankan Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di: **http://localhost:3000**

## 📱 Cara Menggunakan

### Untuk Pasien (Kiosk):
1. Buka **http://localhost:3000/kiosk**
2. Pilih tipe pasien (BPJS/UMUM)
3. Pilih jadwal (Pagi/Sore)
4. Klik **Cetak Nomor Antrian**
5. Struk akan tercetak dengan nomor antrian

### Untuk Admin:
1. Buka **http://localhost:3000/login**
2. Login dengan kredensial admin
3. Setelah masuk ke dashboard, klik **Panggil Selanjutnya** untuk memanggil antrian berikutnya
4. Gunakan **Panggil Ulang** untuk mengulang panggilan
5. Gunakan **Lewati** atau **Selesai** untuk menyelesaikan antrian

### Untuk Layar TV:
1. Buka **http://localhost:3000/tv**
2. Tekan **F11** untuk mode full-screen
3. Layar akan otomatis update setiap 3 detik
4. Suara ting-tong akan berbunyi saat ada antrian baru dipanggil

## 🏗️ Struktur Project

```
antrian-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...all]/       # Better Auth API
│   │   │   └── queue/              # Queue API routes
│   │   ├── admin/                  # Admin Dashboard page
│   │   ├── kiosk/                  # Kiosk page
│   │   ├── tv/                     # TV Display page
│   │   ├── login/                  # Login page
│   │   └── page.tsx                # Homepage
│   ├── components/ui/              # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts                   # Database connection
│   │   ├── queue.ts                # Queue business logic
│   │   ├── schema.ts               # Drizzle schema
│   │   └── auth.ts                 # Better Auth config
│   └── types/
│       └── queue.ts                # TypeScript types
├── drizzle.config.ts               # Drizzle configuration
├── init-db.sql                     # Database initialization SQL
├── .env.local                      # Environment variables
└── package.json
```

## 🔌 API Endpoints

### Queue API
- `POST /api/queue` - Buat antrian baru
- `GET /api/queue?patientType=&shift=&status=&limit=` - Ambil daftar antrian
- `POST /api/queue/[id]/call` - Panggil antrian
- `POST /api/queue/[id]/skip` - Lewati antrian
- `POST /api/queue/[id]/complete` - Selesaikan antrian

### Auth API
- `GET/POST /api/auth/*` - Better Auth endpoints

## 🗄️ Database Schema

### Tabel `users`
- `id` (INT, PK)
- `username` (VARCHAR, UNIQUE)
- `password_hash` (VARCHAR)
- `role` (VARCHAR, default: 'admin')
- `email` (VARCHAR, UNIQUE)
- `name` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

### Tabel `queues`
- `id` (INT, PK)
- `queue_number` (VARCHAR) - Format: A-001, B-001
- `patient_type` (ENUM: 'BPJS', 'UMUM')
- `shift` (ENUM: 'PAGI', 'SORE')
- `status` (ENUM: 'MENUNGGU', 'DIPANGGIL', 'SELESAI', 'DILEWATI')
- `created_at`, `updated_at` (DATETIME/TIMESTAMP)

## 📦 Available Scripts

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Database commands
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## 🎨 UI Components

Aplikasi ini menggunakan **shadcn/ui** untuk komponen antarmuka yang modern dan responsif:
- Button
- Card
- Input
- Label
- Table
- Badge
- Dialog
- Alert

## 🔐 Keamanan

- Password hashing menggunakan Better Auth
- Session management otomatis
- CSRF protection
- Rate limiting (bisa ditambahkan)

## 🐛 Troubleshooting

### Database Connection Error
Pastikan MySQL sudah berjalan dan kredensial di `.env.local` sudah benar.

### Build Error
Jalankan `npm install` ulang dan pastikan semua dependencies terinstall.

### TV Display Tidak Update
Pastikan browser tidak dalam mode offline dan JavaScript diaktifkan.

## 📝 Development Notes

- Database connection dibuat lazy (hanya saat dibutuhkan)
- Queue number auto-increment berdasarkan tanggal dan tipe
- Tidak ada reset manual, reset otomatis berdasarkan tanggal

## 🤝 Contributing

Untuk menambahkan fitur baru:
1. Buat branch baru
2. Implementasikan fitur
3. Test thoroughly
4. Submit pull request

## 📄 License

Project ini dibuat untuk kebutuhan manajemen antrian fasilitas kesehatan.

## 👨‍💻 Author

Dikembangkan untuk memenuhi kebutuhan sistem antrian poli klinik yang efisien dan modern.

---

**© 2026 Sistem Antrian Poli Klinik**. All rights reserved.
