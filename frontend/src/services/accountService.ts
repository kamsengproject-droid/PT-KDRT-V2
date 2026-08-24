import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Account, ScopeType } from '../types';
import { catatAuditLog } from './auditService';

export function subscribeAccounts(
  scope?: ScopeType,
  callback?: (accounts: Account[]) => void
) {
  const colRef = collection(db, 'accounts');
  const q = scope
    ? query(colRef, where('scope', '==', scope))
    : colRef;

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Account[];
      list.sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''));
      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'accounts');
    }
  );
}

export async function tambahAkun(
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const docRef = await addDoc(collection(db, 'accounts'), {
      ...account,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUserId,
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TAMBAH_AKUN',
      account.accountName,
      `Username: @${account.username}, Platform: ${account.platform}, Scope: ${account.scope}`
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'accounts');
  }
}

export async function updateAkun(
  id: string,
  account: Partial<Account>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const ref = doc(db, 'accounts', id);
    const prevSnap = await getDoc(ref);
    const before = prevSnap.exists() ? prevSnap.data() : null;

    await updateDoc(ref, {
      ...account,
      updatedAt: serverTimestamp(),
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'EDIT_AKUN',
      account.accountName || id,
      `Update akun TikTok/Medsos`,
      before,
      account
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `accounts/${id}`);
  }
}

export async function hapusAkun(
  id: string,
  accountName: string,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'accounts', id));
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'HAPUS_AKUN',
      accountName,
      `Akun ${accountName} dihapus.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `accounts/${id}`);
  }
}
