import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { compressImageFile } from '../utils/imageCompressor';
import {
  AffiliateSample,
  SampleStatus,
  ScopeType,
  DailyTask,
  DailyTaskStatus,
  DailyTaskPriority,
  Expense,
} from '../types';
import { catatAuditLog } from './auditService';
import { createFinancialTransaction } from './transactionService';
import { tanggalHariIni } from '../utils/formatters';

export const SAMPLES_COLLECTION = 'samples';

// Upload sample photo to Firebase Storage. Reuses the same compression helper
// (compressImageFile) and upload pattern already used by productService's
// uploadProductPhoto — just a different storage folder, since this is a
// distinct photo (sample condition photo) from the master product photo.
export async function uploadSampleImage(file: File, sampleTempId: string): Promise<string> {
  const compressed = await compressImageFile(file, 1000, 1000, 0.82);
  const timestamp = Date.now();
  const storagePath = `samples/${sampleTempId}_${timestamp}.jpg`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, compressed.blob, {
    contentType: compressed.mimeType,
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      originalFileName: file.name,
    },
  });

  return getDownloadURL(storageRef);
}

/**
 * Deterministic Task Synchronizer
 * 1 Sample = 1 Daily Task (ID: sampleTask_${sampleId})
 * Idempotent, atomic, prevents duplicates.
 */
export async function syncSampleToDailyTask(
  sampleId: string,
  sampleData: Partial<AffiliateSample>,
  actorUid: string,
  actorName: string
): Promise<string | null> {
  const taskId = `sampleTask_${sampleId}`;
  const taskRef = doc(db, 'dailyTasks', taskId);

  // If sample is PRIBADI or has no employee assigned: remove the operational task if present
  if (sampleData.scope === 'PRIBADI' || !sampleData.employeeId) {
    try {
      const snap = await getDoc(taskRef);
      if (snap.exists()) {
        await deleteDoc(taskRef);
      }
    } catch (err) {
      console.warn('Notice removing sample task:', err);
    }
    return null;
  }

  // Only create/update task for SHARING samples with assigned employee
  const target = Number(sampleData.targetContent) || 3;
  const current = Number(sampleData.completedContent) || 0;
  const isDone = current >= target;
  const status: DailyTaskStatus = isDone
    ? 'SELESAI'
    : current > 0
    ? 'SEDANG DIKERJAKAN'
    : 'BELUM DIKERJAKAN';

  const taskPayload: any = {
    id: taskId,
    taskId: taskId,
    tanggal: sampleData.purchaseDate || tanggalHariIni(),
    employeeId: sampleData.employeeId,
    employeeName: sampleData.employeeName || 'Karyawan',
    taskName: `TAKE VIDEO — ${sampleData.productName || 'Produk Sampel'}`,
    targetOutput: target,
    currentOutput: current,
    unitOutput: sampleData.unitContent || 'VT',
    status: status,
    priority: 'NORMAL' as DailyTaskPriority,
    sampleId: sampleId,
    sourceType: 'SAMPLE',
    sourceId: sampleId,
    productId: sampleData.productId || '',
    scope: 'SHARING',
    notes: `Sampel produk ${sampleData.productName || ''}. Target: ${target} VT. Progress: ${current}/${target}.`,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
    updatedByName: actorName,
  };

  if (isDone) {
    taskPayload.completedAt = serverTimestamp();
  }

  await setDoc(
    taskRef,
    {
      ...taskPayload,
      createdAt: serverTimestamp(),
      createdBy: actorUid,
      createdByName: actorName,
    },
    { merge: true }
  );

  return taskId;
}

/**
 * Self-healing helper: Scan and sync all active SHARING samples into daily tasks
 */
export async function syncUnsyncedSharingSamplesToTasks(
  actorUid: string,
  actorName: string
): Promise<number> {
  try {
    const q = query(
      collection(db, SAMPLES_COLLECTION),
      where('scope', '==', 'SHARING')
    );
    const snap = await getDocs(q);
    let count = 0;

    for (const d of snap.docs) {
      const sample = { id: d.id, sampleId: d.id, ...d.data() } as AffiliateSample;
      if (sample.employeeId) {
        await syncSampleToDailyTask(sample.id, sample, actorUid, actorName);
        count++;
      }
    }
    return count;
  } catch (err) {
    console.warn('Auto sync sharing samples notice:', err);
    return 0;
  }
}

// 1. Subscribe to Samples
export function subscribeSamples(
  options?: {
    scope?: ScopeType;
    status?: SampleStatus | 'SEMUA';
    accountId?: string;
    employeeId?: string;
  },
  callback?: (samples: AffiliateSample[]) => void
) {
  let q: any = collection(db, SAMPLES_COLLECTION);

  if (options?.scope) {
    q = query(
      collection(db, SAMPLES_COLLECTION),
      where('scope', '==', options.scope)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let samples = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        sampleId: docSnap.id,
        ...docSnap.data(),
      })) as AffiliateSample[];

      samples.sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));

      if (options?.status && options.status !== 'SEMUA') {
        samples = samples.filter((s) => s.status === options.status);
      }

      if (options?.accountId && options.accountId !== 'SEMUA') {
        samples = samples.filter(
          (s) =>
            s.accountId === options.accountId ||
            (s.accountIds && s.accountIds.includes(options.accountId!))
        );
      }

      if (options?.employeeId && options.employeeId !== 'SEMUA') {
        samples = samples.filter((s) => s.employeeId === options.employeeId);
      }

      if (callback) callback(samples);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, SAMPLES_COLLECTION);
    }
  );
}

// 2. Create Sample Purchase Record
export async function createSample(
  sampleData: Omit<AffiliateSample, 'id' | 'sampleId' | 'createdAt' | 'updatedAt'>,
  autoCreateExpense: boolean,
  autoCreateTask: boolean,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  const samplePrice = Number(sampleData.samplePrice) || 0;
  const quantity = Math.max(1, Number(sampleData.quantity) || 1);
  const totalCost = Number(sampleData.totalCost) || samplePrice * quantity;
  const targetContent = Number(sampleData.targetContent) || 3;
  const completedContent = Number(sampleData.completedContent) || 0;

  const payload: any = {
    ...sampleData,
    samplePrice,
    quantity,
    totalCost,
    targetContent,
    completedContent,
    unitContent: sampleData.unitContent || 'VT',
    status: sampleData.status || 'DITERIMA',
    scope: sampleData.scope || 'SHARING',
    purchaseDate: sampleData.purchaseDate || tanggalHariIni(),
    isExpenseRecorded: false,
    createdBy: currentUserId,
    createdByName: currentUserName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    console.time('[SAMPLE_SAVE_TOTAL]');
    console.log('[SAMPLE_SAVE_START]', { productName: sampleData.productName });

    const docRef = await addDoc(collection(db, SAMPLES_COLLECTION), payload);
    const sampleId = docRef.id;
    console.log('[SAMPLE_SAMPLE_WRITE]', { sampleId });

    // The 3 branches below are independent of each other (different collections,
    // none reads the others' output), so they run in parallel instead of a
    // sequential await chain. Anti-duplicate / deterministic-ID logic inside each
    // branch is untouched — only the *ordering between branches* changed.

    // Branch 1: Audit log for the creation itself
    const auditPromise = catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_CREATED',
      `Sampel: ${sampleData.productName}`,
      `ID: ${sampleId}, Qty: ${quantity}, Biaya: Rp ${totalCost.toLocaleString('id-ID')}, Status: ${payload.status}`
    );

    // Branch 2: Auto Create Financial Expense with anti-double-entry
    // skipDuplicateCheck=true is safe here ONLY because sampleId was just generated
    // by addDoc above — no prior expense could possibly reference an ID that didn't exist yet.
    const expensePromise =
      (autoCreateExpense || true) && totalCost > 0
        ? (async () => {
            console.time('[SAMPLE_EXPENSE_WRITE]');
            try {
              await recordSampleExpense(sampleId, { ...payload, id: sampleId }, currentUserId, currentUserName, true);
            } catch (expErr: any) {
              console.warn('Auto expense recording notice:', expErr.message);
            } finally {
              console.timeEnd('[SAMPLE_EXPENSE_WRITE]');
            }
          })()
        : Promise.resolve();

    // Branch 3: Auto Link & Sync to Daily Task with Deterministic ID: sampleTask_${sampleId}
    const taskPromise =
      sampleData.scope === 'SHARING' && sampleData.employeeId
        ? (async () => {
            console.time('[SAMPLE_TASK_SYNC]');
            try {
              const taskId = await syncSampleToDailyTask(
                sampleId,
                { ...payload, id: sampleId },
                currentUserId,
                currentUserName
              );
              if (taskId) {
                await updateDoc(docRef, { taskId: taskId });
              }
            } catch (taskErr: any) {
              console.warn('Auto task sync notice:', taskErr.message);
            } finally {
              console.timeEnd('[SAMPLE_TASK_SYNC]');
            }
          })()
        : Promise.resolve();

    await Promise.all([auditPromise, expensePromise, taskPromise]);

    console.log('[SAMPLE_SAVE_END]', { sampleId });
    console.timeEnd('[SAMPLE_SAVE_TOTAL]');

    return sampleId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SAMPLES_COLLECTION);
    throw error;
  }
}

// 3. Update Sample Details
export async function updateSample(
  id: string,
  currentSample: AffiliateSample,
  updates: Partial<AffiliateSample>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const samplePrice = updates.samplePrice !== undefined ? Number(updates.samplePrice) : currentSample.samplePrice;
  const quantity = updates.quantity !== undefined ? Number(updates.quantity) : currentSample.quantity;
  const totalCost = samplePrice * quantity;

  const payload: any = {
    ...updates,
    samplePrice,
    quantity,
    totalCost,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
    updatedByName: currentUserName,
  };

  try {
    console.time('[SAMPLE_UPDATE_TOTAL]');
    console.log('[SAMPLE_SAVE_START]', { id, productName: payload.productName });

    const docRef = doc(db, SAMPLES_COLLECTION, id);
    await updateDoc(docRef, payload);
    console.log('[SAMPLE_SAMPLE_WRITE]', { id });

    // If the sample photo was replaced or removed, clean up the old Storage object
    // after the Firestore URL has been updated. A cleanup failure must never roll back
    // an otherwise successful sample update.
    if (currentSample.sampleImage && Object.prototype.hasOwnProperty.call(updates, 'sampleImage') && updates.sampleImage !== currentSample.sampleImage) {
      try {
        await deleteObject(ref(storage, currentSample.sampleImage));
      } catch (cleanupErr) {
        console.warn('[SAMPLE_IMAGE_CLEANUP]', { id, error: cleanupErr });
      }
    }

    // Synchronize linked dailyTask and Buku Kas & Bank deterministically
    const mergedSample = { ...currentSample, ...payload, id };

    // Task sync, financial transaction sync, and audit log
    await Promise.all([
      (async () => {
        console.time('[SAMPLE_TASK_SYNC]');
        try {
          await syncSampleToDailyTask(id, mergedSample, currentUserId, currentUserName);
        } finally {
          console.timeEnd('[SAMPLE_TASK_SYNC]');
        }
      })(),
      (async () => {
        try {
          await syncSampleFinancialTransaction(id, mergedSample, currentUserId, currentUserName);
        } catch (txErr: any) {
          console.warn('[SAMPLE_TX_SYNC_ERROR]', txErr);
        }
      })(),
      catatAuditLog(
        currentUserId,
        currentUserName,
        'SAMPLE_UPDATED',
        `Sampel: ${updates.productName || currentSample.productName}`,
        `Update data sampel ID ${id}. Total Biaya: Rp ${totalCost.toLocaleString('id-ID')}`
      ),
    ]);

    console.log('[SAMPLE_SAVE_END]', { id });
    console.timeEnd('[SAMPLE_UPDATE_TOTAL]');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SAMPLES_COLLECTION}/${id}`);
    throw error;
  }
}

// 4. Update Sample Status (DIPESAN -> DIKIRIM -> DITERIMA -> DIGUNAKAN -> SELESAI)
export async function updateSampleStatus(
  id: string,
  currentSample: AffiliateSample,
  newStatus: SampleStatus,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, SAMPLES_COLLECTION, id);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    });

    const mergedSample = { ...currentSample, status: newStatus, id };
    await syncSampleToDailyTask(id, mergedSample, currentUserId, currentUserName);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_STATUS_CHANGED',
      `Sampel: ${currentSample.productName}`,
      `Status sampel berubah dari ${currentSample.status} menjadi ${newStatus}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SAMPLES_COLLECTION}/${id}`);
    throw error;
  }
}

// 5. Update Sample Content Progress & Sync with Linked Kerjaan Harian
export async function updateSampleContentProgress(
  id: string,
  currentSample: AffiliateSample,
  newCompletedContent: number,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const completed = Math.max(0, Number(newCompletedContent) || 0);
  const target = Number(currentSample.targetContent) || 3;
  const isTargetAchieved = completed >= target;

  try {
    const docRef = doc(db, SAMPLES_COLLECTION, id);
    const updates: any = {
      completedContent: completed,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    // Auto-update sample status to DIGUNAKAN or SELESAI if progress advances
    if (isTargetAchieved) {
      updates.status = 'SELESAI';
    } else if (completed > 0) {
      updates.status = 'DIGUNAKAN';
    }

    await updateDoc(docRef, updates);

    // Sync with linked deterministic DailyTask
    const mergedSample = { ...currentSample, ...updates, id };
    await syncSampleToDailyTask(id, mergedSample, currentUserId, currentUserName);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_CONTENT_PROGRESS_UPDATED',
      `Sampel: ${currentSample.productName}`,
      `Progress konten: ${completed}/${target} ${currentSample.unitContent || 'VT'} (${isTargetAchieved ? 'TARGET TERCAPAI' : 'BELUM SELESAI'})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SAMPLES_COLLECTION}/${id}`);
    throw error;
  }
}

// 6. Synchronize Financial Transaction for Buku Kas & Bank (Deterministic ID: SAMPLE_PURCHASE_{sampleId})
export async function syncSampleFinancialTransaction(
  sampleId: string,
  sample: Partial<AffiliateSample>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const deterministicId = `SAMPLE_PURCHASE_${sampleId}`;
    const amount = Number(sample.totalPaid || sample.totalCost || (Number(sample.samplePrice || 0) * Number(sample.quantity || 1))) || 0;
    const txRef = doc(db, 'transactions', deterministicId);

    if (amount <= 0) {
      try {
        await deleteDoc(txRef);
      } catch (err) {
        console.warn('Notice deleting zero-amount sample transaction:', err);
      }
      return;
    }

    let defaultAccount = 'BCA PT KDRT';
    if (sample.paymentMethod) {
      const pm = sample.paymentMethod.toUpperCase();
      if (pm === 'COD') defaultAccount = 'Kas Tunai';
      else if (pm === 'DANA') defaultAccount = 'DANA';
      else if (pm === 'TRANSFER') defaultAccount = 'BCA PT KDRT';
      else if (pm === 'PAYLATER') defaultAccount = 'Paylater';
    } else if (sample.accountName) {
      defaultAccount = sample.accountName;
    }

    const brandDisplay = sample.brandName || sample.sellerName || '';
    const noteParts: string[] = [];
    if (brandDisplay) noteParts.push(`Brand: ${brandDisplay}`);
    if (sample.orderNumber) noteParts.push(`No Pesanan: ${sample.orderNumber}`);
    if (sample.notes) noteParts.push(sample.notes);

    const txData = {
      id: deterministicId,
      transactionId: deterministicId,
      type: 'EXPENSE',
      date: sample.purchaseDate || tanggalHariIni(),
      amount: amount,
      category: 'Sampel / Inventory',
      sourceType: 'SAMPLE_PURCHASE',
      referenceId: sampleId,
      sampleId: sampleId,
      productId: sample.productId || null,
      scope: sample.scope || 'SHARING',
      accountId: sample.accountId || null,
      accountName: defaultAccount,
      employeeId: sample.employeeId || null,
      employeeName: sample.employeeName || null,
      description: `Pembelian Sampel - ${sample.productName || 'Produk'}${sample.quantity && sample.quantity > 1 ? ` (${sample.quantity} unit)` : ''}`,
      notes: noteParts.join(' | ') || null,
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
      createdBy: currentUserId,
      createdByName: currentUserName,
    };

    await setDoc(txRef, txData, { merge: true });

    // Mark sample as expense recorded
    try {
      await updateDoc(doc(db, SAMPLES_COLLECTION, sampleId), {
        expenseId: deterministicId,
        isExpenseRecorded: true,
        expenseRecordedAt: serverTimestamp(),
      });
    } catch {
      // ignore if sample doc is being created/deleted
    }
  } catch (err) {
    console.error('[SYNC_SAMPLE_TX_ERROR]', err);
  }
}

// Bulk Sync All Existing Samples to Buku Kas & Bank
export async function syncAllSamplesToFinancialTransactions(
  currentUserId: string,
  currentUserName: string
): Promise<{ syncedCount: number; totalAmount: number }> {
  try {
    const snap = await getDocs(collection(db, SAMPLES_COLLECTION));
    let syncedCount = 0;
    let totalAmount = 0;

    for (const d of snap.docs) {
      const sample = { id: d.id, ...d.data() } as AffiliateSample;
      const amount = Number(sample.totalPaid || sample.totalCost || (Number(sample.samplePrice || 0) * Number(sample.quantity || 1))) || 0;
      if (amount > 0) {
        await syncSampleFinancialTransaction(d.id, sample, currentUserId, currentUserName);
        syncedCount++;
        totalAmount += amount;
      }
    }

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLES_SYNCED_TO_FINANCIAL_TRANSACTIONS',
      'Sinkronisasi Database Sampel',
      `Berhasil mensinkronkan ${syncedCount} pembelian sampel dengan total Rp ${totalAmount.toLocaleString('id-ID')} ke Buku Kas & Bank.`
    );

    return { syncedCount, totalAmount };
  } catch (err) {
    console.error('[BULK_SYNC_SAMPLES_ERROR]', err);
    throw err;
  }
}

// 7. Record Financial Expense (Legacy compatibility wrapper)
export async function recordSampleExpense(
  sampleId: string,
  sample: AffiliateSample,
  currentUserId: string,
  currentUserName: string,
  _skipDuplicateCheck: boolean = false
): Promise<{ success: boolean; message: string; expenseId?: string }> {
  try {
    await syncSampleFinancialTransaction(sampleId, sample, currentUserId, currentUserName);
    return {
      success: true,
      message: 'Pengeluaran sampel berhasil disinkronkan ke Buku Kas & Bank.',
      expenseId: `SAMPLE_PURCHASE_${sampleId}`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
    throw error;
  }
}

// 8. Delete Sample (cleanly deletes linked transactions, tasks, and audit log)
export async function deleteSample(
  id: string,
  currentSample: AffiliateSample,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, SAMPLES_COLLECTION, id);
    await deleteDoc(docRef);

    // 1. Delete deterministic transaction from Buku Kas & Bank
    try {
      await deleteDoc(doc(db, 'transactions', `SAMPLE_PURCHASE_${id}`));
      await deleteDoc(doc(db, 'transactions', `SAMPLE_${id}`));
    } catch (txErr) {
      console.warn('Notice deleting sample transaction:', txErr);
    }

    // 2. Query any lingering transactions with referenceId == id
    try {
      const qTx = query(collection(db, 'transactions'), where('referenceId', '==', id));
      const snapTx = await getDocs(qTx);
      for (const d of snapTx.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      console.warn('Notice cleaning transactions:', err);
    }

    // 3. Query any lingering expenses with sampleId == id
    try {
      const qExp = query(collection(db, 'expenses'), where('sampleId', '==', id));
      const snapExp = await getDocs(qExp);
      for (const d of snapExp.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      console.warn('Notice cleaning expenses:', err);
    }

    // 4. Delete deterministic sample task
    const taskDocRef = doc(db, 'dailyTasks', `sampleTask_${id}`);
    try {
      await deleteDoc(taskDocRef);
    } catch (err) {
      console.warn('Notice deleting sample task:', err);
    }

    // 5. Query any lingering tasks with sampleId == id
    try {
      const q = query(collection(db, 'dailyTasks'), where('sampleId', '==', id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      console.warn('Notice cleaning sample tasks:', err);
    }

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_DELETED',
      `Sampel: ${currentSample.productName}`,
      `Sampel ID ${id} dihapus beserta pengeluaran Kas & Bank dan tugas operasional terkait.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SAMPLES_COLLECTION}/${id}`);
    throw error;
  }
}
