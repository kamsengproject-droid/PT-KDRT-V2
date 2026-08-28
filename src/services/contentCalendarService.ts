import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import {
  ContentCalendarItem,
  ContentStatus,
  ContentRecurringTemplate,
  ContentStatusHistory,
  DailyTask,
  ScopeType,
  UserProfile,
} from '../types';
import { catatAuditLog } from './auditService';
import { compressImageFile } from '../utils/imageCompressor';
import { tanggalHariIni, exportToCSV } from '../utils/formatters';

export const CONTENT_CALENDAR_COLLECTION = 'contentCalendar';
export const CONTENT_TEMPLATES_COLLECTION = 'contentTemplates';
const TASKS_COLLECTION = 'dailyTasks';

// ==========================================
// 1. REAL-TIME SUBSCRIPTIONS
// ==========================================

export interface ContentFilterOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  date?: string; // YYYY-MM-DD
  accountId?: string;
  productId?: string;
  talentId?: string;
  editorId?: string;
  status?: ContentStatus | 'SEMUA';
  scope?: ScopeType | 'SEMUA';
  taskId?: string;
  employeeId?: string; // If filtered for specific employee (talent or editor)
}

/**
 * Subscribe to Content Calendar with real-time updates & flexible filtering
 */
export function subscribeContentCalendar(
  filters: ContentFilterOptions | undefined,
  callback: (items: ContentCalendarItem[]) => void,
  userProfile?: UserProfile
) {
  const colRef = collection(db, CONTENT_CALENDAR_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      let items = snapshot.docs.map((d) => ({
        id: d.id,
        contentId: d.id,
        ...d.data(),
      })) as ContentCalendarItem[];

      items.sort((a, b) => {
        const dateComp = (b.date || '').localeCompare(a.date || '');
        if (dateComp !== 0) return dateComp;
        return (a.time || '').localeCompare(b.time || '');
      });

      // 1. Security & Role filter
      if (userProfile && userProfile.role === 'EMPLOYEE') {
        const empId = userProfile.employeeId || userProfile.uid;
        items = items.filter(
          (item) => item.talentId === empId || item.editorId === empId
        );
      } else if (userProfile && userProfile.role === 'INVESTOR') {
        // Investor only sees SHARING scope aggregate
        items = items.filter((item) => item.scope === 'SHARING');
      }

      // 2. User Permission Filters (Private vs Sharing)
      if (userProfile && userProfile.role === 'MANAGER' && userProfile.permissions) {
        if (!userProfile.permissions.canReadPrivate) {
          items = items.filter((item) => item.scope !== 'PRIBADI');
        }
        if (!userProfile.permissions.canReadSharing) {
          items = items.filter((item) => item.scope !== 'SHARING');
        }
      }

      // 3. Dynamic UI Filters
      if (filters) {
        if (filters.date) {
          items = items.filter((i) => i.date === filters.date);
        }
        if (filters.startDate) {
          items = items.filter((i) => i.date >= filters.startDate!);
        }
        if (filters.endDate) {
          items = items.filter((i) => i.date <= filters.endDate!);
        }
        if (filters.accountId && filters.accountId !== 'SEMUA') {
          items = items.filter((i) => i.accountId === filters.accountId);
        }
        if (filters.productId && filters.productId !== 'SEMUA') {
          items = items.filter((i) => i.productId === filters.productId);
        }
        if (filters.talentId && filters.talentId !== 'SEMUA') {
          items = items.filter((i) => i.talentId === filters.talentId);
        }
        if (filters.editorId && filters.editorId !== 'SEMUA') {
          items = items.filter((i) => i.editorId === filters.editorId);
        }
        if (filters.status && filters.status !== 'SEMUA') {
          items = items.filter((i) => i.status === filters.status);
        }
        if (filters.scope && filters.scope !== 'SEMUA') {
          items = items.filter((i) => i.scope === filters.scope);
        }
        if (filters.taskId && filters.taskId !== 'SEMUA') {
          items = items.filter((i) => i.taskId === filters.taskId);
        }
        if (filters.employeeId && filters.employeeId !== 'SEMUA') {
          items = items.filter(
            (i) => i.talentId === filters.employeeId || i.editorId === filters.employeeId
          );
        }
      }

      callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, CONTENT_CALENDAR_COLLECTION);
    }
  );
}

/**
 * Subscribe to today's content calendar items
 */
export function subscribeTodayContent(
  callback: (items: ContentCalendarItem[]) => void,
  userProfile?: UserProfile
) {
  const today = tanggalHariIni();
  return subscribeContentCalendar({ date: today }, callback, userProfile);
}

/**
 * Subscribe to recurring templates
 */
export function subscribeContentTemplates(
  callback: (templates: ContentRecurringTemplate[]) => void
) {
  const colRef = collection(db, CONTENT_TEMPLATES_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        templateId: d.id,
        ...d.data(),
      })) as ContentRecurringTemplate[];
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, CONTENT_TEMPLATES_COLLECTION);
    }
  );
}

// ==========================================
// 2. CREATE OPERATIONS
// ==========================================

/**
 * Buat Konten Tunggal (Single Content Record)
 */
export async function createContentItem(
  contentData: Omit<ContentCalendarItem, 'id' | 'contentId' | 'createdAt' | 'updatedAt'>,
  userProfile: UserProfile
): Promise<string> {
  try {
    const initialStatus = contentData.status || 'IDE';
    const nowTimestamp = serverTimestamp();

    const initialHistory: ContentStatusHistory = {
      status: initialStatus,
      timestamp: new Date().toISOString(),
      actorUid: userProfile.uid,
      actorName: userProfile.name,
      notes: 'Konten dijadwalkan / dibuat.',
    };

    const docData: any = {
      ...contentData,
      targetOutput: Number(contentData.targetOutput) || 1,
      unitOutput: contentData.unitOutput || 'VT',
      status: initialStatus,
      statusHistory: [initialHistory],
      ideAt: initialStatus === 'IDE' ? nowTimestamp : null,
      direkamAt: initialStatus === 'DIREKAM' ? nowTimestamp : null,
      editingAt: initialStatus === 'EDITING' ? nowTimestamp : null,
      siapAt: initialStatus === 'SIAP' ? nowTimestamp : null,
      terjadwalAt: initialStatus === 'TERJADWAL' ? nowTimestamp : null,
      postedAt: initialStatus === 'DIPOSTING' ? nowTimestamp : null,
      cancelledAt: initialStatus === 'DIBATALKAN' ? nowTimestamp : null,
      createdAt: nowTimestamp,
      createdBy: userProfile.uid,
      createdByName: userProfile.name,
      updatedAt: nowTimestamp,
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    const docRef = await addDoc(collection(db, CONTENT_CALENDAR_COLLECTION), docData);

    // Audit log
    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'CONTENT_CREATED',
      `Konten: ${contentData.title}`,
      `Jadwal: ${contentData.date} ${contentData.time} | Akun: ${contentData.accountName} | Status: ${initialStatus}`,
      null,
      docData
    );

    // If linked to a daily task, sync task progress
    if (contentData.taskId) {
      await syncDailyTaskWithContentCalendar(contentData.taskId, userProfile);
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CONTENT_CALENDAR_COLLECTION);
    throw error;
  }
}

/**
 * Buat Konten Berulang Secara Terkontrol (Batch Generator)
 * Membuat record mandiri per tanggal tanpa duplikasi
 */
export async function createBatchRecurringContent(
  template: ContentRecurringTemplate,
  startDate: string,
  endDate: string,
  userProfile: UserProfile
): Promise<number> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const datesToCreate: string[] = [];

    // Iterate through dates
    const curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 = Mon, 7 = Sun
      const dateStr = curr.toISOString().split('T')[0];

      let isMatch = false;
      if (template.frequency === 'DAILY') {
        isMatch = true;
      } else if (template.frequency === 'MON_SAT') {
        isMatch = isoDay >= 1 && isoDay <= 6;
      } else if (template.frequency === 'WEEKLY') {
        // Same day of week as template start
        const templateStartDay = start.getDay() === 0 ? 7 : start.getDay();
        isMatch = isoDay === templateStartDay;
      } else if (template.frequency === 'CUSTOM_DAYS' && template.customDays) {
        isMatch = template.customDays.includes(isoDay);
      }

      if (isMatch) {
        datesToCreate.push(dateStr);
      }

      curr.setDate(curr.getDate() + 1);
    }

    if (datesToCreate.length === 0) return 0;

    // Check existing records to prevent accidental identical duplicate
    const existingSnap = await getDocs(
      query(
        collection(db, CONTENT_CALENDAR_COLLECTION),
        where('accountId', '==', template.accountId),
        where('title', '==', template.title)
      )
    );
    const existingDateTimes = new Set(
      existingSnap.docs.map((d) => `${d.data().date}_${d.data().time}`)
    );

    let createdCount = 0;
    const batch = writeBatch(db);

    for (const dateStr of datesToCreate) {
      const key = `${dateStr}_${template.time}`;
      if (existingDateTimes.has(key)) {
        continue; // Skip existing to prevent duplicate
      }

      const newDocRef = doc(collection(db, CONTENT_CALENDAR_COLLECTION));
      const initialHistory: ContentStatusHistory = {
        status: 'TERJADWAL',
        timestamp: new Date().toISOString(),
        actorUid: userProfile.uid,
        actorName: userProfile.name,
        notes: `Dibuat dari Template Berulang: ${template.templateName}`,
      };

      const docData: any = {
        title: template.title,
        date: dateStr,
        time: template.time || '19:00',
        accountId: template.accountId,
        accountName: template.accountName,
        scope: template.scope || 'PRIBADI',
        productId: template.productId || null,
        productName: template.productName || null,
        productImage: template.productImage || null,
        productPrice: template.productPrice || null,
        productUrl: template.productUrl || null,
        talentId: template.talentId || null,
        talentName: template.talentName || null,
        editorId: template.editorId || null,
        editorName: template.editorName || null,
        taskId: template.taskId || null,
        taskName: template.taskName || null,
        targetOutput: Number(template.targetOutput) || 1,
        unitOutput: template.unitOutput || 'VT',
        status: 'TERJADWAL' as ContentStatus,
        notes: template.notes || '',
        statusHistory: [initialHistory],
        terjadwalAt: serverTimestamp(),
        recurringTemplateId: template.id || template.templateId || null,
        isRecurringInstance: true,
        createdAt: serverTimestamp(),
        createdBy: userProfile.uid,
        createdByName: userProfile.name,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.uid,
        updatedByName: userProfile.name,
      };

      batch.set(newDocRef, docData);
      createdCount++;
    }

    if (createdCount > 0) {
      await batch.commit();

      await catatAuditLog(
        userProfile.uid,
        userProfile.name,
        'CONTENT_SCHEDULED',
        `Batch Template: ${template.templateName}`,
        `Membuat ${createdCount} jadwal konten berulang (${startDate} s/d ${endDate})`,
        null,
        { createdCount, template }
      );

      if (template.taskId) {
        await syncDailyTaskWithContentCalendar(template.taskId, userProfile);
      }
    }

    return createdCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CONTENT_CALENDAR_COLLECTION);
    throw error;
  }
}

/**
 * Simpan / Tambah Template Berulang
 */
export async function saveContentRecurringTemplate(
  templateData: Omit<ContentRecurringTemplate, 'id' | 'templateId' | 'createdAt' | 'updatedAt'>,
  userProfile: UserProfile
): Promise<string> {
  try {
    const docData = {
      ...templateData,
      active: templateData.active ?? true,
      createdAt: serverTimestamp(),
      createdBy: userProfile.uid,
      createdByName: userProfile.name,
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CONTENT_TEMPLATES_COLLECTION), docData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CONTENT_TEMPLATES_COLLECTION);
    throw error;
  }
}

// ==========================================
// 3. UPDATE & STATUS TRANSITION OPERATIONS
// ==========================================

/**
 * Update Data Konten
 */
export async function updateContentItem(
  contentId: string,
  currentContent: ContentCalendarItem,
  updates: Partial<ContentCalendarItem>,
  userProfile: UserProfile
): Promise<void> {
  try {
    const docRef = doc(db, CONTENT_CALENDAR_COLLECTION, contentId);
    const payload: any = {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    await updateDoc(docRef, payload);

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'CONTENT_UPDATED',
      `Konten: ${updates.title || currentContent.title}`,
      `Update data jadwal konten oleh ${userProfile.name}`,
      currentContent,
      payload
    );

    // Sync task progress if task connection changed
    if (updates.taskId && updates.taskId !== currentContent.taskId) {
      if (currentContent.taskId) {
        await syncDailyTaskWithContentCalendar(currentContent.taskId, userProfile);
      }
      await syncDailyTaskWithContentCalendar(updates.taskId, userProfile);
    } else if (currentContent.taskId) {
      await syncDailyTaskWithContentCalendar(currentContent.taskId, userProfile);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CONTENT_CALENDAR_COLLECTION}/${contentId}`);
    throw error;
  }
}

/**
 * Transisi Status Konten
 * Sequence: IDE -> DIREKAM -> EDITING -> SIAP -> TERJADWAL -> DIPOSTING / DIBATALKAN
 */
export async function updateContentStatus(
  contentId: string,
  currentContent: ContentCalendarItem,
  newStatus: ContentStatus,
  userProfile: UserProfile,
  extraData?: {
    notes?: string;
    postedUrl?: string;
    postedProofUrl?: string;
    postedProofStoragePath?: string;
    cancellationReason?: string;
  }
): Promise<void> {
  try {
    const docRef = doc(db, CONTENT_CALENDAR_COLLECTION, contentId);
    const nowTimestamp = serverTimestamp();

    const historyEntry: ContentStatusHistory = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      actorUid: userProfile.uid,
      actorName: userProfile.name,
      notes: extraData?.notes || `Status diubah dari ${currentContent.status} ke ${newStatus}`,
      postedUrl: extraData?.postedUrl,
    };

    const existingHistory = currentContent.statusHistory || [];
    const updatedHistory = [...existingHistory, historyEntry];

    const updates: any = {
      status: newStatus,
      statusHistory: updatedHistory,
      updatedAt: nowTimestamp,
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    // Specific Status Timestamp Fields
    if (newStatus === 'IDE') {
      updates.ideAt = currentContent.ideAt || nowTimestamp;
    } else if (newStatus === 'DIREKAM') {
      updates.direkamAt = currentContent.direkamAt || nowTimestamp;
    } else if (newStatus === 'EDITING') {
      updates.editingAt = currentContent.editingAt || nowTimestamp;
    } else if (newStatus === 'SIAP') {
      updates.siapAt = currentContent.siapAt || nowTimestamp;
    } else if (newStatus === 'TERJADWAL') {
      updates.terjadwalAt = currentContent.terjadwalAt || nowTimestamp;
    } else if (newStatus === 'DIPOSTING') {
      updates.postedAt = currentContent.postedAt || nowTimestamp;
      updates.postedAtTimestamp = nowTimestamp;
      if (extraData?.postedUrl) {
        updates.postedUrl = extraData.postedUrl;
      }
      if (extraData?.postedProofUrl) {
        updates.postedProofUrl = extraData.postedProofUrl;
      }
      if (extraData?.postedProofStoragePath) {
        updates.postedProofStoragePath = extraData.postedProofStoragePath;
      }
    } else if (newStatus === 'DIBATALKAN') {
      updates.cancelledAt = nowTimestamp;
      if (extraData?.cancellationReason) {
        updates.cancellationReason = extraData.cancellationReason;
      }
    }

    if (extraData?.notes) {
      updates.notes = extraData.notes;
    }

    await updateDoc(docRef, updates);

    // Audit Logging
    const auditAction =
      newStatus === 'DIPOSTING'
        ? 'CONTENT_POSTED'
        : newStatus === 'DIBATALKAN'
        ? 'CONTENT_CANCELLED'
        : newStatus === 'TERJADWAL'
        ? 'CONTENT_SCHEDULED'
        : 'CONTENT_STATUS_CHANGED';

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      auditAction,
      `Konten: ${currentContent.title}`,
      `Status berubah: ${currentContent.status} -> ${newStatus}${
        extraData?.postedUrl ? ` | Link: ${extraData.postedUrl}` : ''
      }`,
      { status: currentContent.status },
      updates
    );

    // Sync connected Daily Task (Phase 3A)
    if (currentContent.taskId) {
      await syncDailyTaskWithContentCalendar(currentContent.taskId, userProfile);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CONTENT_CALENDAR_COLLECTION}/${contentId}`);
    throw error;
  }
}

/**
 * Upload Screenshot Bukti Posting ke Firebase Storage
 */
export async function uploadContentProofImage(
  file: File,
  contentId: string
): Promise<{ downloadUrl: string; storagePath: string }> {
  try {
    const compressed = await compressImageFile(file, 1600, 1600, 0.82);

    const timestamp = Date.now();
    const storagePath = `content_proofs/${contentId}_${timestamp}.jpg`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, compressed.blob, {
      contentType: 'image/jpeg',
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return { downloadUrl, storagePath };
  } catch (error) {
    console.error('Gagal upload bukti posting:', error);
    throw new Error('Gagal mengupload gambar bukti posting ke Firebase Storage.');
  }
}

/**
 * Hapus Konten
 */
export async function deleteContentItem(
  contentId: string,
  content: ContentCalendarItem,
  userProfile: UserProfile
): Promise<void> {
  try {
    await deleteDoc(doc(db, CONTENT_CALENDAR_COLLECTION, contentId));

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'CONTENT_CANCELLED',
      `Hapus Konten: ${content.title}`,
      `Konten tanggal ${content.date} dihapus oleh ${userProfile.name}`,
      content,
      null
    );

    if (content.taskId) {
      await syncDailyTaskWithContentCalendar(content.taskId, userProfile);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CONTENT_CALENDAR_COLLECTION}/${contentId}`);
    throw error;
  }
}

// ==========================================
// 4. SYNCHRONIZATION WITH DAILY TASKS (PHASE 3A)
// ==========================================

/**
 * Sinkronisasi Real-Time dengan Kerjaan Harian (Daily Task)
 * Mengunci sumber target produksi pada dailyTasks, menghitung output riil konten
 * dan memperbarui status task jika target terpenuhi.
 */
export async function syncDailyTaskWithContentCalendar(
  taskId: string,
  userProfile: UserProfile
): Promise<void> {
  try {
    const taskDocRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskDocRef);
    if (!taskSnap.exists()) return;

    const taskData = taskSnap.data() as DailyTask;

    // Ambil semua record konten yang terhubung ke task ini
    const contentSnap = await getDocs(
      query(collection(db, CONTENT_CALENDAR_COLLECTION), where('taskId', '==', taskId))
    );

    const linkedContents = contentSnap.docs.map((d) => d.data() as ContentCalendarItem);

    // Hitung total konten yang berstatus DIPOSTING (atau total konten yang diproduksi)
    const postedCount = linkedContents.filter((c) => c.status === 'DIPOSTING').length;
    const targetOutput = Number(taskData.targetOutput) || 1;

    const updates: any = {
      currentOutput: postedCount,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    // Jika seluruh target terpenuhi dan task belum selesai
    if (postedCount >= targetOutput && taskData.status !== 'SELESAI') {
      updates.status = 'SELESAI';
      updates.completedAt = serverTimestamp();
    } else if (postedCount < targetOutput && taskData.status === 'SELESAI') {
      // Jika di-unpost atau batal sehingga output berkurang
      updates.status = 'SEDANG DIKERJAKAN';
      updates.completedAt = null;
    } else if (postedCount > 0 && taskData.status === 'BELUM DIKERJAKAN') {
      updates.status = 'SEDANG DIKERJAKAN';
      updates.startedAt = taskData.startedAt || serverTimestamp();
    }

    await updateDoc(taskDocRef, updates);
  } catch (error) {
    console.warn('Sync daily task with content calendar warning:', error);
  }
}

// ==========================================
// 5. EXPORT CSV
// ==========================================

export function exportContentCalendarToCSV(items: ContentCalendarItem[]) {
  if (!items || items.length === 0) {
    alert('Tidak ada data konten untuk di-export.');
    return;
  }

  const exportData = items.map((item) => ({
    Tanggal: item.date,
    Jam: item.time,
    Akun: item.accountName || '-',
    Scope: item.scope || 'PRIBADI',
    Produk: item.productName || '-',
    'Judul Konten': item.title,
    Talent: item.talentName || '-',
    Editor: item.editorName || '-',
    Status: item.status,
    Target: `${item.targetOutput} ${item.unitOutput || 'VT'}`,
    'Task Terkait': item.taskName || '-',
    'Link Posting': item.postedUrl || '-',
    Catatan: item.notes || '-',
  }));

  exportToCSV(exportData, `jadwal_konten_${tanggalHariIni()}`);
}
