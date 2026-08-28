import React, { useState, useEffect } from 'react';
import {
  User,
  CreditCard,
  Lock,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Building,
  Phone,
  Mail,
  ShieldCheck,
  Save,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  updateEmployeeOwnProfile,
  updateEmployeeBankAccount,
  uploadEmployeePhoto,
} from '../services/employeeService';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

interface ProfilSayaPageProps {
  onBackToPortal?: () => void;
  initialTab?: 'PROFIL' | 'REKENING' | 'PASSWORD';
}

const BANK_OPTIONS = [
  'BCA (Bank Central Asia)',
  'BRI (Bank Rakyat Indonesia)',
  'BNI (Bank Negara Indonesia)',
  'Mandiri',
  'BSI (Bank Syariah Indonesia)',
  'CIMB Niaga',
  'Bank Jago',
  'SeaBank',
  'Permata Bank',
  'Danamon',
  'BCA Digital (Blu)',
  'DANA / E-Wallet',
  'Lainnya',
];

export const ProfilSayaPage: React.FC<ProfilSayaPageProps> = ({
  onBackToPortal,
  initialTab = 'PROFIL',
}) => {
  const { userProfile, employeeProfile, currentUser, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'PROFIL' | 'REKENING' | 'PASSWORD'>(initialTab);

  // Profile Form States
  const [name, setName] = useState<string>(userProfile?.name || employeeProfile?.name || '');
  const [nickname, setNickname] = useState<string>(
    userProfile?.nickname || employeeProfile?.nickname || ''
  );
  const [phone, setPhone] = useState<string>(
    userProfile?.phone || employeeProfile?.phone || ''
  );
  const [photoUrl, setPhotoUrl] = useState<string>(
    userProfile?.photoUrl || employeeProfile?.photoUrl || ''
  );
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Bank Form States
  const [bankName, setBankName] = useState<string>(
    employeeProfile?.bankName || userProfile?.bankName || 'BCA (Bank Central Asia)'
  );
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(
    employeeProfile?.bankAccountNumber || userProfile?.bankAccountNumber || ''
  );
  const [bankAccountHolder, setBankAccountHolder] = useState<string>(
    employeeProfile?.bankAccountHolder || userProfile?.bankAccountHolder || userProfile?.name || ''
  );

  // Password Form States
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Status & Feedback States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state if context loads
  useEffect(() => {
    if (userProfile || employeeProfile) {
      setName(userProfile?.name || employeeProfile?.name || '');
      setNickname(userProfile?.nickname || employeeProfile?.nickname || '');
      setPhone(userProfile?.phone || employeeProfile?.phone || '');
      setPhotoUrl(userProfile?.photoUrl || employeeProfile?.photoUrl || '');
      if (employeeProfile?.bankName || userProfile?.bankName) {
        setBankName(employeeProfile?.bankName || userProfile?.bankName || '');
      }
      if (employeeProfile?.bankAccountNumber || userProfile?.bankAccountNumber) {
        setBankAccountNumber(
          employeeProfile?.bankAccountNumber || userProfile?.bankAccountNumber || ''
        );
      }
      if (employeeProfile?.bankAccountHolder || userProfile?.bankAccountHolder) {
        setBankAccountHolder(
          employeeProfile?.bankAccountHolder ||
            userProfile?.bankAccountHolder ||
            userProfile?.name ||
            ''
        );
      }
    }
  }, [userProfile, employeeProfile]);

  const activeEmployeeId =
    employeeProfile?.id || (userProfile?.name === 'Desta' ? 'desta-id' : 'melinda-id');
  const userUid = currentUser?.uid || userProfile?.uid || '';

  // Handle Photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 1. SAVE PROFILE
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Nama lengkap / tampilan wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      let finalPhotoUrl = photoUrl;

      // Upload new photo if selected
      if (selectedPhotoFile) {
        finalPhotoUrl = await uploadEmployeePhoto(activeEmployeeId, selectedPhotoFile);
        setPhotoUrl(finalPhotoUrl);
      }

      await updateEmployeeOwnProfile(activeEmployeeId, userUid, {
        name: name.trim(),
        nickname: nickname.trim(),
        phone: phone.trim(),
        photoUrl: finalPhotoUrl,
      });

      await refreshProfile();
      setSuccessMsg('Profil Anda berhasil diperbarui dan tersimpan.');
      setSelectedPhotoFile(null);
      setPhotoPreview(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan profil.');
    } finally {
      setLoading(false);
    }
  };

  // 2. SAVE BANK ACCOUNT
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!bankName.trim()) {
      setErrorMsg('Nama bank wajib dipilih / diisi.');
      return;
    }
    if (!bankAccountNumber.trim()) {
      setErrorMsg('Nomor rekening wajib diisi.');
      return;
    }
    if (!bankAccountHolder.trim()) {
      setErrorMsg('Nama pemilik rekening sesuai buku tabungan wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      await updateEmployeeBankAccount(
        activeEmployeeId,
        userUid,
        name || userProfile?.name || 'Karyawan',
        {
          bankName: bankName.trim(),
          bankAccountNumber: bankAccountNumber.trim(),
          bankAccountHolder: bankAccountHolder.trim(),
        }
      );

      await refreshProfile();
      setSuccessMsg('Rekening bank berhasil disimpan dan diperbarui.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan rekening bank.');
    } finally {
      setLoading(false);
    }
  };

  // 3. CHANGE PASSWORD
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!oldPassword) {
      setErrorMsg('Masukkan password lama Anda.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('Sesi user tidak ditemukan. Silakan login ulang.');
      }

      // Re-authenticate with old password
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password in Firebase Auth
      await updatePassword(user, newPassword);

      setSuccessMsg('Password berhasil diubah! Gunakan password baru untuk login berikutnya.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Password lama salah. Periksa kembali password Anda.');
      } else {
        setErrorMsg(err.message || 'Gagal mengubah password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (n?: string) => {
    if (!n) return 'U';
    return n
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            {onBackToPortal && (
              <button
                onClick={onBackToPortal}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Kembali ke Portal"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
              Karyawan PT.KDRT
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2.5">
            <User className="h-7 w-7 text-emerald-600" />
            Pengaturan Akun &amp; Profil
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola data diri, rekening bank pencairan gaji, dan keamanan password Anda.
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <button
          onClick={() => {
            setActiveTab('PROFIL');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'PROFIL'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="h-4 w-4 text-emerald-600" />
          <span>Profil Saya</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('REKENING');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'REKENING'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="h-4 w-4 text-blue-600" />
          <span>Rekening Bank</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('PASSWORD');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'PASSWORD'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Lock className="h-4 w-4 text-orange-600" />
          <span>Ubah Password</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-start gap-2.5 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* TAB 1: PROFIL SAYA */}
      {activeTab === 'PROFIL' && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
        >
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-100 pb-6">
            <div className="relative group">
              {photoPreview || photoUrl ? (
                <img
                  src={photoPreview || photoUrl}
                  alt={name}
                  className="h-24 w-24 rounded-3xl object-cover border-2 border-emerald-500 shadow-md"
                />
              ) : (
                <div className="h-24 w-24 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-md">
                  {getInitials(name)}
                </div>
              )}

              <label
                htmlFor="upload-photo-input"
                className="absolute -bottom-2 -right-2 rounded-xl bg-emerald-600 p-2 text-white shadow-lg hover:bg-emerald-500 cursor-pointer transition-transform hover:scale-110"
                title="Ganti Foto Profil"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="upload-photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="text-center sm:text-left space-y-1">
              <h3 className="text-base font-black text-slate-900">{name || 'Nama Karyawan'}</h3>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-500">
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  {employeeProfile?.position || 'Talent'}
                </span>
                <span>•</span>
                <span className="font-semibold text-emerald-600">🟢 Akun Aktif</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Klik ikon kamera pada foto untuk mengganti foto profil Anda.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap / Tampilan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Melinda Putri"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Nama Panggilan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Panggilan
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Contoh: Melinda"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Nomor Telepon / WA */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>Nomor WhatsApp / HP</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Email (Readonly) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span>Email Login</span>
              </label>
              <input
                type="email"
                value={userProfile?.email || ''}
                disabled
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-500 bg-slate-100 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Menyimpan...' : 'SIMPAN PROFIL'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: REKENING BANK */}
      {activeTab === 'REKENING' && (
        <form
          onSubmit={handleSaveBank}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
        >
          <div className="flex items-start gap-3 bg-blue-50/70 border border-blue-200 p-4 rounded-2xl">
            <CreditCard className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-xs text-blue-950">
                Informasi Rekening Bank Pribadi
              </h4>
              <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                Rekening ini digunakan untuk keperluan transfer gaji, uang rajin, dan operasional.
                Anda hanya dapat melihat dan mengedit data rekening milik Anda sendiri.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Nama Bank */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Bank / E-Wallet <span className="text-rose-500">*</span>
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Nomor Rekening */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor Rekening <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
                placeholder="Contoh: 1234567890"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:outline-none tracking-wider"
              />
            </div>

            {/* Nama Pemilik Rekening */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Pemilik Rekening (Sesuai Buku Tabungan) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={bankAccountHolder}
                onChange={(e) => setBankAccountHolder(e.target.value)}
                placeholder="Contoh: MELINDA PUTRI"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-black text-white hover:bg-blue-500 shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Menyimpan...' : 'SIMPAN REKENING'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: UBAH PASSWORD */}
      {activeTab === 'PASSWORD' && (
        <form
          onSubmit={handleChangePassword}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5"
        >
          <div className="flex items-start gap-3 bg-orange-50/70 border border-orange-200 p-4 rounded-2xl">
            <Lock className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-xs text-orange-950">Keamanan Akun</h4>
              <p className="text-[11px] text-orange-800 mt-0.5 leading-relaxed">
                Password dienkripsi secara aman oleh Firebase Authentication. Pastikan password baru
                Anda tidak mudah ditebak dan minimal terdiri dari 6 karakter.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Password Lama */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password Saat Ini / Lama <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan password lama"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Password Baru */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password Baru <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Konfirmasi Password Baru */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Konfirmasi Password Baru <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password baru"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-xs font-black text-white hover:bg-orange-500 shadow-md shadow-orange-600/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              <span>{loading ? 'Menyimpan...' : 'SIMPAN PASSWORD BARU'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
