# WALUH FAMILY — Deployment & Security Guide

## 1. Environment Variables
Salin `.env.example` menjadi `.env`:
- `JWT_SECRET`: Secret kriptografis 64+ karakter acak untuk penandatanganan token sesi HTTP-only.
- `DATABASE_PATH`: Lokasi database SQLite untuk runtime Express (`./waluh_family.db`).
- `BOOTSTRAP_CAPSU_EMAIL` & `BOOTSTRAP_CAPSU_PASSWORD`: Kredensial awal akun **CAPSU / Kepala Suku** perdana saat database kosong pertama kali diinisialisasi.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Digunakan apabila menghubungkan ke instance PostgreSQL Supabase eksternal.

## 2. Menghubungkan ke Supabase PostgreSQL (Opsional / Produksi Cloud)
1. Buat project baru di **Supabase**.
2. Buka **SQL Editor** dan jalankan seluruh isi file `supabase/migrations/001_waluh_family_schema.sql` untuk membuat 12+ tabel relasional beserta **Row Level Security (RLS)** dan fungsi `current_user_has_permission()`.
3. Aktifkan **Email Auth** di Supabase Authentication.
4. Masukkan URL dan Anon/Service keys ke Environment Variables.

## 3. Membuat Akun CAPSU Pertama Secara Aman
- Pada runtime Express lokal/VPS: Atur `BOOTSTRAP_CAPSU_EMAIL` dan `BOOTSTRAP_CAPSU_PASSWORD` di environment sebelum boot perdana, lalu **segera ubah password** dari menu *Settings -> Ubah Password* setelah login pertama.
- Pada Supabase SQL: Daftarkan user pertama melalui Auth, lalu jalankan perintah SQL berikut di Supabase SQL Editor (hanya sekali saat bootstrap):
  ```sql
  UPDATE public.profiles
  SET role_code = 'CAPSU', jabatan = 'CAPSU / Kepala Suku', status = 'APPROVED', joined_at = NOW()
  WHERE email = 'email-capsu-anda@domain.com';
  ```

## 4. Panduan Deployment Vercel
1. Push repository ke GitHub.
2. Import project di dashboard **Vercel** (`vercel.json` sudah dikonfigurasi dengan SPA rewrite & security headers).
3. Tambahkan Environment Variables produksi (`JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dll).
4. Klik **Deploy** — Vercel menjalankan `npm run build` dan menerbitkan folder `dist`.
5. Catatan: Untuk backend Express dengan SQLite persisten (`server.ts`), gunakan platform container/VM persisten (Cloud Run / Railway / Fly.io / VPS) atau migrasikan handler API ke Serverless Functions + Supabase PostgreSQL.
