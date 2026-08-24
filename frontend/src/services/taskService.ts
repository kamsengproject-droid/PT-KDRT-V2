import {
  collection,
  doc,
  addDoc,
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { catatAuditLog } from './auditService';
import {
  DailyTask,
  DailyTaskStatus,
  DailyTaskPriority,
  TaskTemplate,
  Employee,
} from '../types';
import { tanggalHariIni } from '../utils/formatters';

const TASKS_COLLECTION = 'dailyTasks';
const TEMPLATES_COLLECTION = 'taskTemplates';

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

// ==========================================
// 1. REAL-TIME SUBSCRIPTIONS
// ==========================================

export function subscribeDailyTasks(
  filters?: {
    tanggal?: string;
    employeeId?: string;
    status?: string;
  },
  callback?: (tasks: DailyTask[]) => void
) {
  let q: any = collection(db, TASKS_COLLECTION);

  if (filters?.tanggal) {
    q = query(
      collection(db, TASKS_COLLECTION),
      where('tanggal', '==', filters.tanggal)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let tasks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        taskId: docSnap.id,
        ...docSnap.data(),
      })) as DailyTask[];

      tasks.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return timeB - timeA;
      });

      if (filters?.tanggal) {
        tasks = tasks.filter((t) => {
          if (t.tanggal === filters.tanggal) return true;
          const isSampleTask = t.sourceType === 'SAMPLE' || Boolean(t.sampleId);
          const isUnfinished = t.status !== 'SELESAI' && (t.currentOutput || 0) < (t.targetOutput || 1);
          if (isSampleTask && isUnfinished) return true;
          return false;
        });
      }

      if (callback) callback(tasks);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, TASKS_COLLECTION);
    }
  );
}

export function subscribeDailyTasksByEmployee(
  employeeIdentifier:
    | string
    | { employeeId?: string; assigneeEmployeeId?: string; userId?: string; employeeName?: string },
  tanggal?: string,
  callback?: (tasks: DailyTask[]) => void
) {
  let q: any = collection(db, TASKS_COLLECTION);
  if (tanggal) {
    q = query(collection(db, TASKS_COLLECTION), where('tanggal', '==', tanggal));
  }

  const idsToMatch = new Set<string>();
  let nameFallback = '';

  if (typeof employeeIdentifier === 'string') {
    if (employeeIdentifier) idsToMatch.add(employeeIdentifier);
  } else if (employeeIdentifier) {
    if (employeeIdentifier.employeeId) idsToMatch.add(employeeIdentifier.employeeId);
    if (employeeIdentifier.assigneeEmployeeId) idsToMatch.add(employeeIdentifier.assigneeEmployeeId);
    if (employeeIdentifier.userId) idsToMatch.add(employeeIdentifier.userId);
    if (employeeIdentifier.employeeName) nameFallback = employeeIdentifier.employeeName.toLowerCase().trim();
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let tasks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        taskId: docSnap.id,
        ...docSnap.data(),
      })) as DailyTask[];

      tasks.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return timeB - timeA;
      });

      if (idsToMatch.size > 0 || nameFallback) {
        tasks = tasks.filter((t: any) => {
          const idMatch =
            (t.employeeId && idsToMatch.has(t.employeeId)) ||
            (t.assigneeEmployeeId && idsToMatch.has(t.assigneeEmployeeId)) ||
            (t.userId && idsToMatch.has(t.userId)) ||
            (t.assigneeId && idsToMatch.has(t.assigneeId));

          if (idMatch) return true;

          // Fallback if employeeName matches
          if (nameFallback && t.employeeName && t.employeeName.toLowerCase().trim() === nameFallback) {
            return true;
          }
          return false;
        });
      }

      if (tanggal) {
        tasks = tasks.filter((t) => {
          if (t.tanggal === tanggal) return true;
          const isSampleTask = t.sourceType === 'SAMPLE' || Boolean(t.sampleId);
          const isUnfinished = t.status !== 'SELESAI' && (t.currentOutput || 0) < (t.targetOutput || 1);
          if (isSampleTask && isUnfinished) return true;
          return false;
        });
      }

      if (callback) callback(tasks);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, TASKS_COLLECTION);
    }
  );
}

export function subscribeTaskTemplates(callback: (templates: TaskTemplate[]) => void) {
  const q = query(collection(db, TEMPLATES_COLLECTION), orderBy('templateName', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const templates = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as TaskTemplate[];
      callback(templates);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, TEMPLATES_COLLECTION);
    }
  );
}

// ==========================================
// 2. TASK CRUD OPERATIONS
// ==========================================

export async function createDailyTask(
  taskData: Omit<DailyTask, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>,
  actorUid: string,
  actorName: string
): Promise<string> {
  try {
    const rawData: any = {
      tanggal: taskData.tanggal || tanggalHariIni(),
      employeeId: taskData.employeeId,
      employeeName: taskData.employeeName || 'Karyawan',
      taskName: taskData.taskName,
      currentOutput: Number(taskData.currentOutput) || 0,
      targetOutput: Number(taskData.targetOutput) || 1,
      unitOutput: taskData.unitOutput || 'TAKE VIDEO',
      status: taskData.status || ('BELUM DIKERJAKAN' as DailyTaskStatus),
      priority: taskData.priority || ('NORMAL' as DailyTaskPriority),
      notes: taskData.notes || '',
      attachment: taskData.attachment || '',
      attachmentUrl: taskData.attachmentUrl || '',
      proofLink: taskData.proofLink || '',
      proofType: taskData.proofType || 'TEXT',
      isRecurring: Boolean(taskData.isRecurring),
      recurringFrequency: taskData.recurringFrequency || 'DAILY',
      startedAt: null,
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actorUid,
      createdByName: actorName,
      updatedBy: actorUid,
      updatedByName: actorName,
    };

    if (taskData.accountId) rawData.accountId = taskData.accountId;
    if (taskData.accountName) rawData.accountName = taskData.accountName;
    if (taskData.deadline) rawData.deadline = taskData.deadline;
    if (taskData.templateId) rawData.templateId = taskData.templateId;

    const docData = cleanUndefined(rawData);
    const docRef = await addDoc(collection(db, TASKS_COLLECTION), docData);

    // Record audit log
    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_CREATED',
      `Tugas: ${taskData.taskName}`,
      `Dibuat untuk ${taskData.employeeName} (Target: ${taskData.targetOutput} ${taskData.unitOutput}, Tanggal: ${taskData.tanggal})`,
      null,
      docData
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, TASKS_COLLECTION);
    throw error;
  }
}

// ==========================================
// 3. TASK LIFECYCLE ACTIONS
// ==========================================

/**
 * MULAI KERJAKAN
 * Mengubah status ke SEDANG DIKERJAKAN & mencatat server timestamp startedAt
 */
export async function mulaiKerjakanTask(
  taskId: string,
  currentTask: DailyTask,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const updates: any = {
      status: 'SEDANG DIKERJAKAN' as DailyTaskStatus,
      startedAt: currentTask.startedAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    };

    await updateDoc(taskRef, updates);

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_STARTED',
      `Mulai Kerja: ${currentTask.taskName}`,
      `${currentTask.employeeName} mulai mengerjakan tugas ${currentTask.taskName}`,
      { status: currentTask.status },
      updates
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

/**
 * TAMBAH / UPDATE OUTPUT PROGRESS
 */
export async function updateTaskOutput(
  taskId: string,
  currentTask: DailyTask,
  newOutput: number,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const validatedOutput = Math.max(0, Number(newOutput) || 0);
    const target = currentTask.targetOutput || 1;
    const isAchieved = validatedOutput >= target;

    const updates: any = {
      currentOutput: validatedOutput,
      status: isAchieved
        ? ('SELESAI' as DailyTaskStatus)
        : validatedOutput > 0
        ? ('SEDANG DIKERJAKAN' as DailyTaskStatus)
        : currentTask.status,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    };
    if (isAchieved && !currentTask.completedAt) {
      updates.completedAt = serverTimestamp();
    }

    await updateDoc(taskRef, updates);

    // Sync back to linked sample document if exists
    if (currentTask.sampleId) {
      try {
        const sampleRef = doc(db, 'samples', currentTask.sampleId);
        const sampleSnap = await getDoc(sampleRef);
        if (sampleSnap.exists()) {
          const sampleData = sampleSnap.data();
          const sampleTarget = Number(sampleData.targetContent) || target;
          const sampleDone = validatedOutput >= sampleTarget;
          await updateDoc(sampleRef, {
            completedContent: validatedOutput,
            status: sampleDone ? 'SELESAI' : validatedOutput > 0 ? 'DIGUNAKAN' : sampleData.status || 'DITERIMA',
            updatedAt: serverTimestamp(),
            updatedBy: actorUid,
            updatedByName: actorName,
          });
        }
      } catch (sErr) {
        console.warn('Sync back to sample notice:', sErr);
      }
    }

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_PROGRESS_UPDATED',
      `Update Output: ${currentTask.taskName}`,
      `Progress output ${currentTask.employeeName}: ${currentTask.currentOutput} -> ${validatedOutput} ${currentTask.unitOutput} (Target: ${currentTask.targetOutput})`,
      { currentOutput: currentTask.currentOutput },
      updates
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

/**
 * SELESAIKAN PEKERJAAN
 * Mengubah status ke SELESAI & mencatat server timestamp completedAt
 */
export async function selesaikanTask(
  taskId: string,
  currentTask: DailyTask,
  finalOutput: number | undefined,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const output = finalOutput !== undefined ? Math.max(0, Number(finalOutput)) : (currentTask.targetOutput || currentTask.currentOutput);

    const updates: any = {
      status: 'SELESAI' as DailyTaskStatus,
      currentOutput: output,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    };

    await updateDoc(taskRef, updates);

    // Sync back to linked sample document if exists
    if (currentTask.sampleId) {
      try {
        const sampleRef = doc(db, 'samples', currentTask.sampleId);
        await updateDoc(sampleRef, {
          completedContent: output,
          status: 'SELESAI',
          updatedAt: serverTimestamp(),
          updatedBy: actorUid,
          updatedByName: actorName,
        });
      } catch (sErr) {
        console.warn('Sync back to sample notice:', sErr);
      }
    }

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_COMPLETED',
      `Selesai: ${currentTask.taskName}`,
      `Tugas ${currentTask.taskName} diselesaikan oleh ${currentTask.employeeName} dengan output ${output}/${currentTask.targetOutput} ${currentTask.unitOutput}`,
      { status: currentTask.status, currentOutput: currentTask.currentOutput },
      updates
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}


/**
 * JEDA / TERTUNDA
 */
export async function pauseTask(
  taskId: string,
  currentTask: DailyTask,
  actorUid: string,
  actorName: string,
  notes?: string
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const updates: any = {
      status: 'TERTUNDA' as DailyTaskStatus,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    };
    if (notes) {
      updates.notes = notes;
    }

    await updateDoc(taskRef, updates);

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_PAUSED',
      `Tertunda: ${currentTask.taskName}`,
      `Tugas ${currentTask.taskName} (${currentTask.employeeName}) ditunda. Alasan: ${notes || '-'}`,
      { status: currentTask.status },
      updates
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

/**
 * BATALKAN TUGAS
 */
export async function cancelTask(
  taskId: string,
  currentTask: DailyTask,
  actorUid: string,
  actorName: string,
  reason?: string
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const updates: any = {
      status: 'DIBATALKAN' as DailyTaskStatus,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    };
    if (reason) {
      updates.notes = currentTask.notes ? `${currentTask.notes} [Batal: ${reason}]` : `Batal: ${reason}`;
    }

    await updateDoc(taskRef, updates);

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_CANCELLED',
      `Batal: ${currentTask.taskName}`,
      `Tugas ${currentTask.taskName} (${currentTask.employeeName}) dibatalkan. Alasan: ${reason || '-'}`,
      { status: currentTask.status },
      updates
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

/**
 * UPDATE TUGAS (Edit detail, override status, reassign)
 */
export async function updateDailyTask(
  taskId: string,
  oldTask: DailyTask,
  updates: Partial<DailyTask>,
  actorUid: string,
  actorName: string,
  isOverride: boolean = false
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const payload: any = cleanUndefined({
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    });

    await updateDoc(taskRef, payload);

    const action = isOverride
      ? 'TASK_OVERRIDE'
      : updates.employeeId && updates.employeeId !== oldTask.employeeId
      ? 'TASK_REASSIGNED'
      : 'TASK_UPDATED';

    await catatAuditLog(
      actorUid,
      actorName,
      action,
      `Ubah Task: ${oldTask.taskName}`,
      `Pembaruan data tugas ${oldTask.taskName} (${isOverride ? 'Owner Override' : 'Update Detail'})`,
      oldTask,
      payload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

/**
 * HAPUS TUGAS
 */
export async function deleteDailyTask(
  taskId: string,
  task: DailyTask,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId));

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_UPDATED',
      `Hapus Task: ${task.taskName}`,
      `Tugas ${task.taskName} milik ${task.employeeName} pada ${task.tanggal} telah dihapus`,
      task,
      null
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

// ==========================================
// 4. STORAGE / BUKTI PEKERJAAN
// ==========================================

export async function uploadTaskProofFile(
  taskId: string,
  file: File,
  actorUid: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `taskProofs/${taskId}/${timestamp}_${safeFileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    // Save proof to task document
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(taskRef, {
      attachment: downloadUrl,
      attachmentUrl: downloadUrl,
      proofType: 'FILE',
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });

    return downloadUrl;
  } catch (error) {
    console.error('Gagal mengunggah bukti file:', error);
    throw error;
  }
}

export async function saveTaskProofLink(
  taskId: string,
  proofLink: string,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(taskRef, {
      proofLink,
      attachmentUrl: proofLink,
      proofType: 'LINK',
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
      updatedByName: actorName,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

// ==========================================
// 5. PRESETS & TEMPLATES
// ==========================================

/**
 * PRESET MELINDA
 * 1. NISA GROSIR88: 25 VT
 * 2. DuniaMainan: 5 VT
 * 3. Baju Anak: 5 VT
 */
export async function applyMelindaPresets(
  melinda: Employee,
  tanggal: string,
  actorUid: string,
  actorName: string,
  existingTasks: DailyTask[] = []
): Promise<number> {
  if (!melinda.id) throw new Error('Data karyawan Melinda tidak valid.');

  const presets = [
    {
      taskName: 'NISA GROSIR88',
      targetOutput: 25,
      unitOutput: 'VT',
      priority: 'TINGGI' as DailyTaskPriority,
      notes: 'Produksi konten video harian akun NISA GROSIR88',
    },
    {
      taskName: 'DuniaMainan',
      targetOutput: 5,
      unitOutput: 'VT',
      priority: 'NORMAL' as DailyTaskPriority,
      notes: 'Produksi konten video harian akun DuniaMainan',
    },
    {
      taskName: 'Baju Anak',
      targetOutput: 5,
      unitOutput: 'VT',
      priority: 'NORMAL' as DailyTaskPriority,
      notes: 'Produksi konten video harian akun Baju Anak',
    },
  ];

  let createdCount = 0;

  for (const preset of presets) {
    // Check if task with same name and employee already exists on this date
    const alreadyExists = existingTasks.some(
      (t) =>
        t.employeeId === melinda.id &&
        t.tanggal === tanggal &&
        t.taskName.toLowerCase().trim() === preset.taskName.toLowerCase().trim()
    );

    if (!alreadyExists) {
      await createDailyTask(
        {
          tanggal,
          employeeId: melinda.id,
          employeeName: melinda.name,
          taskName: preset.taskName,
          targetOutput: preset.targetOutput,
          currentOutput: 0,
          unitOutput: preset.unitOutput,
          status: 'BELUM DIKERJAKAN',
          priority: preset.priority,
          notes: preset.notes,
          createdBy: actorUid,
          createdByName: actorName,
        },
        actorUid,
        actorName
      );
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * DEFAULT TEMPLATES FOR EDITORS & OTHER ROLES
 */
export const DEFAULT_TASK_TEMPLATES: Array<Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    templateName: 'Edit Video',
    targetRole: 'Editor',
    description: 'Editing mentahan video menjadi konten siap tayang',
    defaultTargetOutput: 10,
    unitOutput: 'VIDEO',
    estimatedDuration: '4 jam',
    defaultPriority: 'NORMAL',
    active: true,
  },
  {
    templateName: 'Revisi Video',
    targetRole: 'Editor',
    description: 'Melakukan perbaikan dan revisi video dari catatan talent/owner',
    defaultTargetOutput: 5,
    unitOutput: 'VIDEO',
    estimatedDuration: '2 jam',
    defaultPriority: 'TINGGI',
    active: true,
  },
  {
    templateName: 'Export Video',
    targetRole: 'Editor',
    description: 'Render dan export video resolusi tinggi',
    defaultTargetOutput: 10,
    unitOutput: 'VIDEO',
    estimatedDuration: '1 jam',
    defaultPriority: 'NORMAL',
    active: true,
  },
  {
    templateName: 'Upload Video',
    targetRole: 'Editor',
    description: 'Upload video ke akun TikTok dan atur sound/caption',
    defaultTargetOutput: 10,
    unitOutput: 'VIDEO',
    estimatedDuration: '1.5 jam',
    defaultPriority: 'NORMAL',
    active: true,
  },
  {
    templateName: 'Jadwalkan Posting',
    targetRole: 'Editor',
    description: 'Atur jadwal jam tayang posting konten di TikTok Creator Center',
    defaultTargetOutput: 10,
    unitOutput: 'POSTING',
    estimatedDuration: '1 jam',
    defaultPriority: 'NORMAL',
    active: true,
  },
  {
    templateName: 'Thumbnail / Cover Video',
    targetRole: 'Editor',
    description: 'Pembuatan cover headline dan thumbnail visual',
    defaultTargetOutput: 10,
    unitOutput: 'COVER',
    estimatedDuration: '1.5 jam',
    defaultPriority: 'NORMAL',
    active: true,
  },
  {
    templateName: 'Editing Produk / Katalog',
    targetRole: 'Editor',
    description: 'Potong dan kemas video showcase produk etalase',
    defaultTargetOutput: 5,
    unitOutput: 'PRODUK',
    estimatedDuration: '2 jam',
    defaultPriority: 'NORMAL',
    active: true,
  },
];

export async function seedDefaultTaskTemplates(
  actorUid: string,
  actorName: string
): Promise<number> {
  try {
    const existingSnap = await getDocs(collection(db, TEMPLATES_COLLECTION));
    if (!existingSnap.empty) return 0;

    let count = 0;
    for (const tpl of DEFAULT_TASK_TEMPLATES) {
      await addDoc(collection(db, TEMPLATES_COLLECTION), {
        ...tpl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: actorUid,
      });
      count++;
    }
    return count;
  } catch (error) {
    console.error('Gagal seed default task templates:', error);
    return 0;
  }
}

export async function createTaskTemplate(
  templateData: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  actorUid: string,
  actorName: string
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), {
      ...templateData,
      defaultTargetOutput: Number(templateData.defaultTargetOutput) || 1,
      active: templateData.active !== undefined ? templateData.active : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actorUid,
    });

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_CREATED',
      `Template: ${templateData.templateName}`,
      `Membuat template tugas baru: ${templateData.templateName} (${templateData.defaultTargetOutput} ${templateData.unitOutput})`,
      null,
      templateData
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, TEMPLATES_COLLECTION);
    throw error;
  }
}

export async function updateTaskTemplate(
  templateId: string,
  updates: Partial<TaskTemplate>,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    const docRef = doc(db, TEMPLATES_COLLECTION, templateId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_UPDATED',
      `Update Template: ${updates.templateName || templateId}`,
      `Memperbarui template tugas ${updates.templateName || templateId}`,
      null,
      updates
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TEMPLATES_COLLECTION}/${templateId}`);
    throw error;
  }
}

export async function deleteTaskTemplate(
  templateId: string,
  templateName: string,
  actorUid: string,
  actorName: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, TEMPLATES_COLLECTION, templateId));

    await catatAuditLog(
      actorUid,
      actorName,
      'TASK_UPDATED',
      `Hapus Template: ${templateName}`,
      `Menghapus template tugas: ${templateName}`,
      null,
      null
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${TEMPLATES_COLLECTION}/${templateId}`);
    throw error;
  }
}
