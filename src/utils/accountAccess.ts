import { Account, Employee, UserRole } from '../types';

/**
 * Akun medsos yang menjadi tanggung jawab seorang karyawan.
 * Sumber utama: employee.assignedAccountIds (relasi data, bukan hardcode nama).
 * Fallback legacy: permissions.canViewSpecificAccounts (bisa berisi ID atau nama akun).
 */
export function getAssignedAccountKeys(employee?: Employee | null): string[] {
  if (!employee) return [];
  const primary = employee.assignedAccountIds || [];
  if (primary.length > 0) return primary;
  return employee.permissions?.canViewSpecificAccounts || [];
}

/**
 * Memfilter daftar akun sesuai hak akses user.
 * OWNER & MANAGER: semua akun. EMPLOYEE: hanya akun yang di-assign.
 * INVESTOR: hanya akun scope SHARING.
 */
export function filterAccountsForUser(
  accounts: Account[],
  role: UserRole,
  employee?: Employee | null
): Account[] {
  if (role === 'INVESTOR') {
    return accounts.filter((a) => a.scope === 'SHARING');
  }
  if (role !== 'EMPLOYEE') return accounts;

  const keys = getAssignedAccountKeys(employee);
  if (keys.length === 0) return [];

  const upperKeys = keys.map((k) => k.toUpperCase());
  return accounts.filter(
    (a) =>
      keys.includes(a.id || '') ||
      upperKeys.includes((a.accountName || '').toUpperCase()) ||
      upperKeys.some((k) => (a.accountName || '').toUpperCase().includes(k))
  );
}
