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

    // Synchronize linked dailyTask deterministically (handles PIC transfer, scope changes, target changes)
    const mergedSample = { ...currentSample, ...payload, id };

    // Task sync and audit log are independent writes to different collections — run in parallel.
    await Promise.all([
      (async () => {
        console.time('[SAMPLE_TASK_SYNC]');
        try {
          await syncSampleToDailyTask(id, mergedSample, currentUserId, currentUserName);
        } finally {
          console.timeEnd('[SAMPLE_TASK_SYNC]');
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

// 6. Record Financial Expense with STRICT Anti-Double-Entry Protection
export async function recordSampleExpense(
  sampleId: string,
  sample: AffiliateSample,
  currentUserId: string,
  currentUserName: string,
  _skipDuplicateCheck: boolean = false
): Promise<{ success: boolean; message: string; expenseId?: string }> {
  try {
    // Check 1: In sample document itself
    if (sample.isExpenseRecorded && sample.expenseId) {
      await catatAuditLog(
        currentUserId,
        currentUserName,
        'SAMPLE_EXPENSE_PREVENTED_DUPLICATE',
        `Sampel: ${sample.productName}`,
        `Percobaan pencatatan ganda dicegah. Pengeluaran sampel ${sampleId} sudah tercatat di Expense ID: ${sample.expenseId}`
      );
      return {
        success: false,
        message: 'Pengeluaran sampel ini sudah tercatat.',
        expenseId: sample.expenseId,
      };
    }

    // Check 2: Query Firestore 'expenses' collection for any doc with sampleId.
    // Keep this check enabled even for fresh creates. It is a cheap read compared with
    // the cost of allowing a retry to create a second expense after a partial failure.
    // The flag is retained for API compatibility but intentionally no longer bypasses
    // the anti-duplicate check.
    const expensesCol = collection(db, 'expenses');
    void _skipDuplicateCheck; // retained for backwards-compatible callers; anti-duplicate check is always enforced.

    const q = query(expensesCol, where('sampleId', '==', sampleId));
    const existingSnap = await getDocs(q);

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      // Update sample reference if not already synced
      await updateDoc(doc(db, SAMPLES_COLLECTION, sampleId), {
        expenseId: existingDoc.id,
        isExpenseRecorded: true,
        expenseRecordedAt: serverTimestamp(),
      });

      await catatAuditLog(
        currentUserId,
        currentUserName,
        'SAMPLE_EXPENSE_PREVENTED_DUPLICATE',
        `Sampel: ${sample.productName}`,
        `Pengeluaran sampel ${sampleId} sudah ada di database (Expense ID: ${existingDoc.id}). Anti-double-entry aktif.`
      );

      return {
        success: false,
        message: 'Pengeluaran sampel ini sudah tercatat.',
        expenseId: existingDoc.id,
      };
    }
    // Amount to record
    const amount = Number(sample.totalCost) > 0 ? Number(sample.totalCost) : Number(sample.samplePrice) * Number(sample.quantity);

    // Create Expense in 'expenses' collection
    const expensePayload = {
      date: sample.purchaseDate || tanggalHariIni(),
      amount: amount,
      category: 'SAMPEL',
      scope: sample.scope || 'SHARING',
      accountId: sample.accountId || null,
      accountName: sample.accountName || null,
      employeeId: sample.employeeId || null,
      employeeName: sample.employeeName || null,
      sampleId: sampleId,
      productId: sample.productId || null,
      description: `Pembelian Sampel: ${sample.productName} (${sample.quantity} unit @ Rp ${Number(sample.samplePrice).toLocaleString('id-ID')})`,
      createdBy: currentUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const expenseDocRef = await addDoc(expensesCol, expensePayload);

    // Also add to master transactions collection with deterministic ID for unified ledger
    await createFinancialTransaction(
      {
        type: 'EXPENSE',
        scope: sample.scope || 'SHARING',
        amount: amount,
        date: sample.purchaseDate || tanggalHariIni(),
        category: 'SAMPEL',
        sourceType: 'SAMPLE',
        referenceId: sampleId,
        accountId: sample.accountId || null,
        accountName: sample.accountName || null,
        employeeId: sample.employeeId || null,
        employeeName: sample.employeeName || null,
        sampleId: sampleId,
        productId: sample.productId || null,
        description: expensePayload.description,
        createdBy: currentUserId,
        createdByName: currentUserName,
      },
      currentUserId,
      currentUserName
    );

    // Update Sample record with expense reference
    await updateDoc(doc(db, SAMPLES_COLLECTION, sampleId), {
      expenseId: expenseDocRef.id,
      isExpenseRecorded: true,
      expenseRecordedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_EXPENSE_CREATED',
      `Sampel: ${sample.productName}`,
      `Pengeluaran dicatat: Rp ${amount.toLocaleString('id-ID')} (Expense ID: ${expenseDocRef.id}, Scope: ${sample.scope})`
    );

    return {
      success: true,
      message: `Pengeluaran sampel sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat ke Arus Kas.`,
      expenseId: expenseDocRef.id,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'expenses');
    throw error;
  }
}

// 7. Delete Sample
export async function deleteSample(
  id: string,
  currentSample: AffiliateSample,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, SAMPLES_COLLECTION, id);
    await deleteDoc(docRef);

    // Delete deterministic sample task
    const taskDocRef = doc(db, 'dailyTasks', `sampleTask_${id}`);
    try {
      await deleteDoc(taskDocRef);
    } catch (err) {
      console.warn('Notice deleting sample task:', err);
    }

    // Query any lingering tasks with sampleId == id
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
      `Sampel ID ${id} dihapus beserta tugas operasional terkait.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SAMPLES_COLLECTION}/${id}`);
    throw error;
  }
}
