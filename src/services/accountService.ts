import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
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

export interface MergeAccountResult {
  success: boolean;
  targetAccount: Account;
  dailyPerformanceUpdated: number;
  dailyPerformanceMerged: number;
  transactionsUpdated: number;
  expensesUpdated: number;
  productsUpdated: number;
  samplesUpdated: number;
  tasksUpdated: number;
  contentsUpdated: number;
  employeesUpdated: number;
  weeklyCommissionsUpdated: number;
  obsoleteAccountDeleted: boolean;
  message: string;
}

/**
 * Menggabungkan 2 akun (misalnya XzInVZv3DZfIJoQqSF7m dan nisagrosir88) menjadi 1 akun resmi.
 * Mentransfer dan menyatukan seluruh relasi data (dailyPerformance, transactions, expenses,
 * products, samples, dailyTasks, contentCalendar, employees, weeklyCommissions).
 */
export async function gabungAkun(
  sourceIdOrKey: string,
  targetIdOrKey: string,
  currentUserId: string,
  currentUserName: string
): Promise<MergeAccountResult> {
  try {
    const accountsSnap = await getDocs(collection(db, 'accounts'));
    const allAccounts = accountsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Account[];

    const cleanSource = sourceIdOrKey.trim();
    const cleanTarget = targetIdOrKey.trim();

    // Cari target account
    let targetAcc = allAccounts.find(
      (a) =>
        a.id === cleanTarget ||
        (a.username && a.username.toLowerCase() === cleanTarget.toLowerCase()) ||
        (a.accountName && a.accountName.toLowerCase() === cleanTarget.toLowerCase())
    );

    // Cari source account
    let sourceAcc = allAccounts.find(
      (a) =>
        a.id === cleanSource ||
        (a.username && a.username.toLowerCase() === cleanSource.toLowerCase()) ||
        (a.accountName && a.accountName.toLowerCase() === cleanSource.toLowerCase())
    );

    // Jika target tidak ditemukan tapi source ditemukan dan targetnya adalah string nisagrosir88,
    // maka sourceAcc sendiri dijadikan targetAcc dengan memperbarui username & namanya.
    if (!targetAcc && sourceAcc) {
      targetAcc = sourceAcc;
      const targetName = cleanTarget.toLowerCase().includes('nisa') ? 'NISA GROSIR88' : cleanTarget;
      const targetUsername = cleanTarget.replace(/^@/, '');
      await updateDoc(doc(db, 'accounts', sourceAcc.id!), {
        accountName: targetName,
        username: targetUsername,
        updatedAt: serverTimestamp(),
      });
      targetAcc.accountName = targetName;
      targetAcc.username = targetUsername;
    } else if (!targetAcc && !sourceAcc) {
      // Jika keduanya belum ada di dokumen accounts, buat akun target baru
      const targetName = cleanTarget.toLowerCase().includes('nisa') ? 'NISA GROSIR88' : cleanTarget;
      const targetUsername = cleanTarget.replace(/^@/, '');
      const newRef = await addDoc(collection(db, 'accounts'), {
        accountName: targetName,
        username: targetUsername,
        platform: 'TikTok',
        scope: 'SHARING',
        managerName: 'Melinda',
        active: true,
        startDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUserId,
      });
      targetAcc = {
        id: newRef.id,
        accountName: targetName,
        username: targetUsername,
        platform: 'TikTok',
        scope: 'SHARING',
        managerName: 'Melinda',
        active: true,
        startDate: new Date().toISOString().split('T')[0],
      };
    } else if (targetAcc && !sourceAcc) {
      // source hanya berupa ID/string lama yang mungkin tersebar di performa/transaksi
    }

    const targetId = targetAcc!.id!;
    const targetName = targetAcc!.accountName || cleanTarget;
    const targetScope = targetAcc!.scope || 'SHARING';

    // Kumpulan identifier yang dianggap sebagai "source" yang harus dilebur
    const sourceKeys = new Set<string>();
    sourceKeys.add(cleanSource);
    sourceKeys.add(cleanSource.toLowerCase());
    if (sourceAcc?.id) sourceKeys.add(sourceAcc.id);
    if (sourceAcc?.username) {
      sourceKeys.add(sourceAcc.username);
      sourceKeys.add(sourceAcc.username.toLowerCase());
    }
    if (sourceAcc?.accountName) {
      sourceKeys.add(sourceAcc.accountName);
      sourceKeys.add(sourceAcc.accountName.toLowerCase());
    }

    // Jangan masukkan targetId ke sourceKeys
    sourceKeys.delete(targetId);

    let dailyPerformanceUpdated = 0;
    let dailyPerformanceMerged = 0;
    let transactionsUpdated = 0;
    let expensesUpdated = 0;
    let productsUpdated = 0;
    let samplesUpdated = 0;
    let tasksUpdated = 0;
    let contentsUpdated = 0;
    let employeesUpdated = 0;
    let weeklyCommissionsUpdated = 0;
    let obsoleteAccountDeleted = false;

    // 1. MIGRATION: dailyPerformance
    try {
      const perfSnap = await getDocs(collection(db, 'dailyPerformance'));
      const allPerfDocs = perfSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      // Index target docs by date
      const targetDocsByDate = new Map<string, any>();
      for (const d of allPerfDocs) {
        if (d.accountId === targetId) {
          targetDocsByDate.set(d.date, d);
        }
      }

      for (const p of allPerfDocs) {
        if (p.accountId === targetId) continue;

        const isMatch =
          sourceKeys.has(p.accountId) ||
          (p.accountName && sourceKeys.has(p.accountName)) ||
          (p.accountName && sourceKeys.has(p.accountName.toLowerCase()));

        if (isMatch) {
          const existingTarget = targetDocsByDate.get(p.date);
          if (existingTarget && existingTarget.id !== p.id) {
            // Merge into existingTarget document
            const mergedGmv = (existingTarget.gmv || 0) + (p.gmv || 0);
            const mergedEst = (existingTarget.estimatedCommission || 0) + (p.estimatedCommission || 0);
            const mergedReal = (existingTarget.realCommission || 0) + (p.realCommission || 0);
            const mergedCommissionReal = (existingTarget.commissionReal || existingTarget.realCommission || 0) + (p.commissionReal || p.realCommission || 0);
            const mergedItemSold = (existingTarget.itemSold || 0) + (p.itemSold || 0);
            const mergedImpression = (existingTarget.productImpression || 0) + (p.productImpression || 0);
            const combinedNotes = [existingTarget.notes, p.notes].filter(Boolean).join(' | ');
            const combinedCommNotes = [existingTarget.commissionNotes, p.commissionNotes].filter(Boolean).join(' | ');

            await updateDoc(doc(db, 'dailyPerformance', existingTarget.id), {
              gmv: mergedGmv,
              estimatedCommission: mergedEst,
              realCommission: mergedReal,
              commissionReal: mergedCommissionReal,
              itemSold: mergedItemSold,
              productImpression: mergedImpression,
              notes: combinedNotes || undefined,
              commissionNotes: combinedCommNotes || undefined,
              updatedAt: serverTimestamp(),
            });

            // Delete redundant source doc
            await deleteDoc(doc(db, 'dailyPerformance', p.id));
            dailyPerformanceMerged++;
          } else {
            // Simple update to point to target account
            await updateDoc(doc(db, 'dailyPerformance', p.id), {
              accountId: targetId,
              accountName: targetName,
              scope: targetScope,
              updatedAt: serverTimestamp(),
            });
            targetDocsByDate.set(p.date, { ...p, accountId: targetId, accountName: targetName });
            dailyPerformanceUpdated++;
          }
        }
      }
    } catch (err) {
      console.warn('Error migrating dailyPerformance during account merge:', err);
    }

    // 2. MIGRATION: transactions
    try {
      const txSnap = await getDocs(collection(db, 'transactions'));
      for (const d of txSnap.docs) {
        const data = d.data();
        if (
          (data.accountId && sourceKeys.has(data.accountId)) ||
          (data.accountName && sourceKeys.has(data.accountName)) ||
          (data.accountName && sourceKeys.has(data.accountName.toLowerCase()))
        ) {
          await updateDoc(doc(db, 'transactions', d.id), {
            accountId: targetId,
            accountName: targetName,
            updatedAt: serverTimestamp(),
          });
          transactionsUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating transactions during account merge:', err);
    }

    // 3. MIGRATION: expenses
    try {
      const expSnap = await getDocs(collection(db, 'expenses'));
      for (const d of expSnap.docs) {
        const data = d.data();
        if (
          (data.accountId && sourceKeys.has(data.accountId)) ||
          (data.accountName && sourceKeys.has(data.accountName)) ||
          (data.accountName && sourceKeys.has(data.accountName.toLowerCase()))
        ) {
          await updateDoc(doc(db, 'expenses', d.id), {
            accountId: targetId,
            accountName: targetName,
            updatedAt: serverTimestamp(),
          });
          expensesUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating expenses during account merge:', err);
    }

    // 4. MIGRATION: products
    try {
      const prodSnap = await getDocs(collection(db, 'products'));
      for (const d of prodSnap.docs) {
        const data = d.data();
        let changed = false;
        const updates: any = {};

        if (data.accountId && sourceKeys.has(data.accountId)) {
          updates.accountId = targetId;
          updates.accountName = targetName;
          changed = true;
        }

        if (Array.isArray(data.accountIds)) {
          const newAccountIds = Array.from(
            new Set(data.accountIds.map((id: string) => (sourceKeys.has(id) ? targetId : id)))
          );
          if (JSON.stringify(newAccountIds) !== JSON.stringify(data.accountIds)) {
            updates.accountIds = newAccountIds;
            changed = true;
          }
        }

        if (changed) {
          updates.updatedAt = serverTimestamp();
          await updateDoc(doc(db, 'products', d.id), updates);
          productsUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating products during account merge:', err);
    }

    // 5. MIGRATION: samples
    try {
      const sampleSnap = await getDocs(collection(db, 'samples'));
      for (const d of sampleSnap.docs) {
        const data = d.data();
        let changed = false;
        const updates: any = {};

        if (data.accountId && sourceKeys.has(data.accountId)) {
          updates.accountId = targetId;
          updates.accountName = targetName;
          changed = true;
        }

        if (Array.isArray(data.accountIds)) {
          const newAccountIds = Array.from(
            new Set(data.accountIds.map((id: string) => (sourceKeys.has(id) ? targetId : id)))
          );
          if (JSON.stringify(newAccountIds) !== JSON.stringify(data.accountIds)) {
            updates.accountIds = newAccountIds;
            changed = true;
          }
        }

        if (changed) {
          updates.updatedAt = serverTimestamp();
          await updateDoc(doc(db, 'samples', d.id), updates);
          samplesUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating samples during account merge:', err);
    }

    // 6. MIGRATION: dailyTasks
    try {
      const taskSnap = await getDocs(collection(db, 'dailyTasks'));
      for (const d of taskSnap.docs) {
        const data = d.data();
        if (data.accountId && sourceKeys.has(data.accountId)) {
          await updateDoc(doc(db, 'dailyTasks', d.id), {
            accountId: targetId,
            accountName: targetName,
            updatedAt: serverTimestamp(),
          });
          tasksUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating dailyTasks during account merge:', err);
    }

    // 7. MIGRATION: contentCalendar
    try {
      const calSnap = await getDocs(collection(db, 'contentCalendar'));
      for (const d of calSnap.docs) {
        const data = d.data();
        if (data.accountId && sourceKeys.has(data.accountId)) {
          await updateDoc(doc(db, 'contentCalendar', d.id), {
            accountId: targetId,
            accountName: targetName,
            updatedAt: serverTimestamp(),
          });
          contentsUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating contentCalendar during account merge:', err);
    }

    // 8. MIGRATION: employees
    try {
      const empSnap = await getDocs(collection(db, 'employees'));
      for (const d of empSnap.docs) {
        const data = d.data();
        if (Array.isArray(data.assignedAccountIds)) {
          const newAssigned = Array.from(
            new Set(data.assignedAccountIds.map((id: string) => (sourceKeys.has(id) ? targetId : id)))
          );
          if (JSON.stringify(newAssigned) !== JSON.stringify(data.assignedAccountIds)) {
            await updateDoc(doc(db, 'employees', d.id), {
              assignedAccountIds: newAssigned,
              updatedAt: serverTimestamp(),
            });
            employeesUpdated++;
          }
        }
      }
    } catch (err) {
      console.warn('Error migrating employees during account merge:', err);
    }

    // 9. MIGRATION: weeklyCommissions
    try {
      const wkSnap = await getDocs(collection(db, 'weeklyCommissions'));
      for (const d of wkSnap.docs) {
        const data = d.data();
        if (
          (data.accountId && sourceKeys.has(data.accountId)) ||
          (data.accountName && sourceKeys.has(data.accountName)) ||
          (data.accountName && sourceKeys.has(data.accountName.toLowerCase()))
        ) {
          await updateDoc(doc(db, 'weeklyCommissions', d.id), {
            accountId: targetId,
            accountName: targetName,
            updatedAt: serverTimestamp(),
          });
          weeklyCommissionsUpdated++;
        }
      }
    } catch (err) {
      console.warn('Error migrating weeklyCommissions during account merge:', err);
    }

    // 10. Hapus akun duplikat lama di collection 'accounts' jika ada dokumen terpisah
    if (sourceAcc && sourceAcc.id && sourceAcc.id !== targetId) {
      await deleteDoc(doc(db, 'accounts', sourceAcc.id));
      obsoleteAccountDeleted = true;
    }

    // 11. Catat Audit Log
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'GABUNG_AKUN',
      targetName,
      `Penggabungan akun ${cleanSource} ke akun utama ${targetName} (${targetAcc.username || targetId}). Performa updated: ${dailyPerformanceUpdated}, Performa merged: ${dailyPerformanceMerged}, Transaksi: ${transactionsUpdated}, Produk: ${productsUpdated}, Sampel: ${samplesUpdated}`
    );

    return {
      success: true,
      targetAccount: targetAcc,
      dailyPerformanceUpdated,
      dailyPerformanceMerged,
      transactionsUpdated,
      expensesUpdated,
      productsUpdated,
      samplesUpdated,
      tasksUpdated,
      contentsUpdated,
      employeesUpdated,
      weeklyCommissionsUpdated,
      obsoleteAccountDeleted,
      message: `Akun berhasil digabungkan menjadi 1 ke "${targetName}" (@${targetAcc.username || ''}).`,
    };
  } catch (error: any) {
    console.error('Failed to merge accounts:', error);
    handleFirestoreError(error, OperationType.WRITE, 'accounts/merge');
    throw error;
  }
}

