import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { Employee, ScopeType } from '../types';
import { catatAuditLog } from './auditService';

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function subscribeEmployees(
  scope?: ScopeType,
  callback?: (employees: Employee[]) => void
) {
  const colRef = collection(db, 'employees');
  const q = scope
    ? query(colRef, where('scope', '==', scope))
    : colRef;

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Employee[];
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'employees');
    }
  );
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  try {
    const snap = await getDoc(doc(db, 'employees', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Employee;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `employees/${id}`);
    return null;
  }
}

export async function getEmployeeByUserId(userId: string): Promise<Employee | null> {
  try {
    const q = query(collection(db, 'employees'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const emp = { id: snap.docs[0].id, ...snap.docs[0].data() } as Employee;
      
      // Inject hardcoded granular permissions based on name/position if not set
      if (!emp.permissions) {
        const lowerName = (emp.name || '').toLowerCase();
        const lowerPos = (emp.position || '').toLowerCase();

        if (lowerName.includes('desta') || lowerPos.includes('editor')) {
          emp.permissions = {
            canViewAttendance: true,
            canManageOwnProfile: true,
            canChangeOwnPassword: true,
            canViewSampleProducts: true,
            canCreateSampleProduct: true,
            canInputCommissionReal: true,
            canViewOmset: true,
            canViewSharingOmset: true,
            canViewSpecificAccounts: ['NISAGROSIR88']
          };
        } else if (lowerName.includes('melinda') || lowerPos.includes('talent')) {
          emp.permissions = {
            canViewAttendance: true,
            canManageOwnProfile: true,
            canChangeOwnPassword: true,
            canViewSampleProducts: true,
            canCreateSampleProduct: true,
            canInputCommissionReal: false,
            canViewOmset: true,
            canViewSharingOmset: true,
            canViewSpecificAccounts: []
          };
        } else {
          // default safe employee
          emp.permissions = {
            canViewAttendance: true,
            canManageOwnProfile: true,
            canChangeOwnPassword: true,
            canViewSampleProducts: true,
            canCreateSampleProduct: true,
            canInputCommissionReal: false,
            canViewOmset: false,
            canViewSharingOmset: false,
            canViewSpecificAccounts: []
          };
        }
      }
      return emp;
    }
    return null;
  } catch (err) {
    console.warn('Gagal mencari employee by userId:', err);
    return null;
  }
}

export async function tambahKaryawan(
  employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const docRef = await addDoc(collection(db, 'employees'), {
      ...employee,
      baseSalary: Number(employee.baseSalary) || 0,
      active: employee.active !== undefined ? employee.active : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUserId,
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TAMBAH_KARYAWAN',
      employee.name,
      `Jabatan: ${employee.position}, Scope: ${employee.scope}, Gaji Pokok: Rp ${Number(employee.baseSalary).toLocaleString('id-ID')}`
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'employees');
  }
}

export async function updateKaryawan(
  id: string,
  employee: Partial<Employee>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const ref = doc(db, 'employees', id);
    const prevSnap = await getDoc(ref);
    const before = prevSnap.exists() ? prevSnap.data() : null;

    const payload: any = {
      ...employee,
      updatedAt: serverTimestamp(),
    };
    if (employee.baseSalary !== undefined) {
      payload.baseSalary = Number(employee.baseSalary) || 0;
    }

    await updateDoc(ref, payload);

    const isGajiChanged = before && employee.baseSalary !== undefined && before.baseSalary !== employee.baseSalary;
    const actionName = isGajiChanged ? 'EDIT_GAJI_KARYAWAN' : 'EDIT_KARYAWAN';

    await catatAuditLog(
      currentUserId,
      currentUserName,
      actionName,
      employee.name || (before ? before.name : id),
      isGajiChanged
        ? `Gaji Pokok diubah dari Rp ${Number(before?.baseSalary).toLocaleString('id-ID')} menjadi Rp ${Number(employee.baseSalary).toLocaleString('id-ID')}`
        : `Update data karyawan ${employee.name || id}`,
      before,
      employee
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
  }
}

export async function toggleStatusKaryawan(
  id: string,
  newActive: boolean,
  employeeName: string,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const ref = doc(db, 'employees', id);
    await updateDoc(ref, {
      active: newActive,
      updatedAt: serverTimestamp(),
    });

    const actionName = newActive ? 'AKTIFKAN_KARYAWAN' : 'NONAKTIFKAN_KARYAWAN';
    await catatAuditLog(
      currentUserId,
      currentUserName,
      actionName,
      employeeName,
      `Status karyawan diubah menjadi ${newActive ? 'Aktif' : 'Nonaktif'}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
  }
}

/**
 * Upload foto profil karyawan ke Firebase Storage
 */
export async function uploadEmployeePhoto(
  employeeId: string,
  file: File
): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `employeePhotos/${employeeId}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.error('Gagal upload foto karyawan:', err);
    throw err;
  }
}

/**
 * Update Profil Mandiri Karyawan (Foto, Nama Tampilan, Nama Panggilan, Telepon)
 */
export async function updateEmployeeOwnProfile(
  employeeId: string,
  uid: string,
  data: {
    name?: string;
    nickname?: string;
    phone?: string;
    photoUrl?: string;
  }
): Promise<void> {
  try {
    const payload = cleanUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    });

    // 1. Update document in employees collection if employeeId exists
    if (employeeId) {
      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, payload);
    }

    // 2. Update user profile document in users collection
    if (uid) {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, payload, { merge: true });
    }

    await catatAuditLog(
      uid,
      data.name || 'Karyawan',
      'EDIT_PROFIL_MANDIRI',
      data.name || employeeId,
      `Karyawan memperbarui profil mandiri (Nama/Panggilan/Telepon/Foto)`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${employeeId}`);
    throw error;
  }
}

/**
 * Update Rekening Bank Mandiri Karyawan
 */
export async function updateEmployeeBankAccount(
  employeeId: string,
  uid: string,
  currentUserName: string,
  bankData: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
  }
): Promise<void> {
  try {
    const payload = cleanUndefined({
      bankName: bankData.bankName.trim(),
      bankAccountNumber: bankData.bankAccountNumber.trim(),
      bankAccountHolder: bankData.bankAccountHolder.trim(),
      updatedAt: serverTimestamp(),
    });

    // 1. Update in employees collection
    if (employeeId) {
      const empRef = doc(db, 'employees', employeeId);
      await updateDoc(empRef, payload);
    }

    // 2. Update in users collection
    if (uid) {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, payload, { merge: true });
    }

    await catatAuditLog(
      uid,
      currentUserName,
      'EDIT_REKENING_BANK',
      bankData.bankName,
      `Karyawan memperbarui data rekening bank: ${bankData.bankName} - ${bankData.bankAccountNumber} a/n ${bankData.bankAccountHolder}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${employeeId}`);
    throw error;
  }
}

