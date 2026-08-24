# PRD — KANTOR PT.KDRT Management Portal

## 1. Problem Statement (original)
Bangun ulang web app **PT-KDRT Management** dari ZIP yang diupload user (source of truth),
tanpa menyederhanakan fitur, mempertahankan seluruh business logic dan collection Firestore.

Revisi arahan dari user setelah audit ZIP:
1. ZIP dipakai sebagai **blueprint fungsi & business logic**, tetapi **seluruh UI/UX diredesign**
   dengan design system modern (dark mode premium).
2. Logo memakai asset PNG yang diupload user (full logo di Login, wordmark `PT.KDRT` di sidebar/header).
3. Firebase config baru: `appId 1:519782586291:web:bb3db3520edce381ffddc6`.
4. **Input Komisi Real tidak boleh jadi menu sidebar terpisah** — digabung menjadi tab ke-2
   di dalam menu **Data Omset**.
5. Tab 1 **Data GMV**: Tanggal, Akun Medsos, GMV, Estimasi Komisi, Item Sold, Product Impression.
   Tab 2 **Komisi Real**: Tanggal, Akun Medsos, Komisi Real, Catatan (tanpa GMV / Item Sold /
   Impression / scope manual — scope otomatis dari akun).
6. Karyawan punya relasi `employee → assignedAccounts` (bukan hardcode nama).
7. Sampel mendapat field `size` (free text, opsional).

## 2. Arsitektur
- **Frontend-only** (React 19 + TypeScript + Vite 6 + Tailwind v4 + lucide-react + motion),
  dijalankan supervisor di port 3000 via `yarn start` → `tsx server.ts` (Express + Vite middleware).
- **Database**: Firebase Firestore (project `pt-kdrt`) langsung dari client. MongoDB tidak dipakai.
- **Auth**: Firebase Authentication (email/password).
- **FastAPI backend (port 8001)** hanya menampung 3 endpoint pendukung, karena ingress Kubernetes
  mengarahkan semua `/api/*` ke backend:
  - `GET /api/health`
  - `GET /api/auth/client-ip` (whitelist IP kantor untuk absensi)
  - `POST /api/scan-product` & `/api/scan-product-image` (AI scan screenshot produk,
    Gemini 2.5 Flash via EMERGENT_LLM_KEY)

## 3. User Personas
| Persona | Kebutuhan |
|---|---|
| OWNER | Akses penuh: keuangan, payroll, profit sharing, input manual, pengaturan & audit |
| MANAGER | Operasional bisnis & keuangan, tanpa payroll dan pengaturan sistem |
| EMPLOYEE (Talent/Editor) | Absensi, kerjaan harian, produk sampel, Data Omset **hanya untuk akun yang di-assign** |
| INVESTOR | Dashboard sharing, akun sharing, database produk, laporan sharing (read-only) |

## 4. Core Requirements (static)
- Upsert deterministik `dailyPerformance/PERFORMANCE_<accountId>_<YYYY-MM-DD>`: 1 akun + 1 tanggal = 1 record.
- Simpan Data GMV **tidak menghapus** Komisi Real. Simpan Komisi Real **tidak menghapus**
  GMV / Estimasi Komisi / Item Sold / Product Impression.
- Komisi Real > 0 membuat transaksi `INCOME` deterministik `COMMISSION_REAL_<perfId>`.
- Sampel berbayar → 1 transaksi `EXPENSE` / `category: SAMPEL` / `sourceType: SAMPLE`,
  dengan proteksi anti-double-entry (`isExpenseRecorded` + query `expenses.sampleId`).
- RBAC dari `users/{uid}.role` + `permissions`, akses akun karyawan dari data (`assignedAccountIds`).
- Collection yang dipakai (tidak ada yang diganti nama): `users`, `employees`, `accounts`,
  `dailyPerformance`, `transactions`, `expenses`, `samples`, `sampleLocations`, `products`,
  `inventory`, `tasks`, `dailyTasks`, `attendance`, `attendanceBonuses`, `payroll`,
  `profitSharingSettlements`, `investorWithdrawals`, `contentSchedules`, `auditLogs`,
  `settings`, `workplaceSettings`, `monthlyClosings`, `weeklyCommissions`, `employeeCommissions`.

## 5. Implemented (2026-06)
- Seluruh source ZIP dipasang utuh: 39 halaman, 24 service, 40+ komponen, `types.ts` lengkap.
- Design system dark premium: `src/index.css` (`@theme` tokens + compatibility layer yang
  memetakan utilitas light warisan ke token gelap, sehingga 39 halaman konsisten sekali jalan).
- Redesign tangan: `LoginPage`, `Navbar`, `Sidebar`, `PtKdrtLogo`, `PerformaHarianPage`, shell `App`.
- Data Omset satu halaman dua tab (Data GMV / Komisi Real) + KPI cards + rekap bulanan.
- `itemSold` & `productImpression` ditambahkan ke model + service upsert (field-preserving).
- `employee.assignedAccountIds` + UI checkbox "Akun Medsos yang Ditangani" di Data Karyawan,
  helper `utils/accountAccess.ts`, semua hardcode nama Desta/Melinda dihapus dari routing & menu.
- Field `size` pada sampel (form, detail, edit, backward-compatible untuk data lama).
- Perbaikan bug login: error Firebase kini terlihat & dipetakan ke pesan Bahasa Indonesia.
- `firestore.rules` dilengkapi `weeklyCommissions`, `employeeCommissions`, `expenses`,
  `dailyTasks`, `monthlyClosings`.
- Verifikasi: `npx tsc --noEmit` bersih, `npx vite build` sukses, QA iterasi 2 lulus
  (backend 100%, frontend 90% → sisa temuan sudah difix).

## 6. Backlog
### P0
- Deploy `firestore.rules` yang sudah diperbarui ke project `pt-kdrt`
  (`sampleLocations` list, `weeklyCommissions`, `employeeCommissions` masih permission-denied di server).
### P1
- `runTransaction` untuk `saveOmsetData` / `saveKomisiReal` (anti race condition dua penyimpanan bersamaan).
- Banner error UI saat Firestore listener ditolak (sekarang hanya console + list kosong).
- Akun uji MANAGER / EMPLOYEE / INVESTOR agar RBAC dapat diuji runtime.
### P2
- Pecah `DatabaseSampelPage.tsx` (2.2k baris) & `KaryawanPage.tsx` (1.5k baris) jadi sub-komponen.
- Format Rupiah pada input "Gaji Pokok Bulanan".
- Code-splitting bundle (2.6 MB single chunk).

## 7. Next Tasks
1. Deploy Firestore rules + verifikasi Penataan Lokasi & Input Manual Owner.
2. Buat akun karyawan, assign akun medsos, uji pembatasan Data Omset per karyawan.
3. Redesign detail lanjutan untuk halaman laporan & payroll (saat ini memakai layer kompatibilitas).
