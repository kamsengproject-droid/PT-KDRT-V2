import React, { useState } from 'react';
import { Mail, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email atau kata sandi tidak sesuai.',
  'auth/invalid-email': 'Format alamat email tidak valid.',
  'auth/wrong-password': 'Kata sandi salah. Silakan coba lagi.',
  'auth/user-not-found': 'Akun dengan email tersebut tidak ditemukan.',
  'auth/user-disabled': 'Akun ini dinonaktifkan. Hubungi Owner PT.KDRT.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
  'auth/network-request-failed': 'Koneksi ke server gagal. Periksa jaringan internet Anda.',
};

export const LoginPage: React.FC = () => {
  const { loginWithEmail } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Harap isi alamat email dan kata sandi.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithEmail(cleanEmail, password);
    } catch (err: any) {
      const code = String(err?.code || '');
      setErrorMessage(AUTH_ERROR_MESSAGES[code] || 'Email atau kata sandi tidak sesuai.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#070B14] px-4 py-10 sm:px-6"
      data-testid="login-page"
    >
      {/* Ambient depth layers — solid dark base, no muddy gradients */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-cyan-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-52 -right-32 h-[520px] w-[520px] rounded-full bg-blue-700/10 blur-[130px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 78%)',
        }}
      />

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* Brand panel — the client logo asset, used exactly as provided */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
        >
          <div className="relative w-full max-w-[340px] overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#050A14]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,229,255,0.16),transparent_72%)]" />
            <img
              src="/assets/logo-pt-kdrt.png"
              alt="PT KDRT"
              className="relative block h-auto w-full object-contain"
              width={971}
              height={971}
              loading="eager"
              decoding="async"
              data-testid="login-logo"
            />
          </div>

          <p className="mt-7 max-w-sm text-sm leading-relaxed text-slate-400">
            Ora Et Labora
          </p>

        
        </motion.div>

        {/* Auth panel */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          className="w-full"
        >
          <div className="rounded-2xl border border-white/10 bg-[#111623]/90 p-6 backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300/80">
                Akses Terbatas
              </span>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Masuk Akun
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Gunakan email kantor yang terdaftar di sistem.
              </p>
            </div>

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-300"
                data-testid="login-error-message"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-relaxed">{errorMessage}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"
                >
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@kdrt.com"
                    className="kdrt-input pl-10"
                    data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="kdrt-input pr-11"
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 transition-colors hover:text-cyan-300"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    data-testid="login-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="kdrt-btn-primary group flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="login-submit-button"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 flex items-center gap-2 border-t border-white/10 pt-5 text-[11px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400/70" />
              <span>Sesi diamankan Firebase Authentication</span>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] tracking-wide text-slate-500">
            PT. KDRT MANAGEMENT · Designed by Ko Kamseng
          </p>
        </motion.div>
      </div>
    </div>
  );
};
