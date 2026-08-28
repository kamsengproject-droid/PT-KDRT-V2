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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import {
  InventoryItem,
  InventoryHistory,
  InventoryCondition,
  InventoryStatus,
  ScopeType,
} from '../types';
import { compressImageFile } from '../utils/imageCompressor';
import { catatAuditLog } from './auditService';
import { createFinancialTransaction } from './transactionService';

export const INVENTORY_COLLECTION = 'inventory';
export const INVENTORY_HISTORY_COLLECTION = 'inventoryHistory';

// 1. Upload Foto Inventory dengan Kompresi Client-side Canvas
export async function uploadInventoryPhoto(
  file: File,
  prefix: string = 'inventory'
): Promise<{
  photoUrl: string;
  storagePath: string;
  photoSizeBytes: number;
  photoMimeType: string;
  photoWidth: number;
  photoHeight: number;
}> {
  try {
    const compressed = await compressImageFile(file, 1200, 1200, 0.85);
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const storagePath = `inventory/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, compressed.blob, {
      contentType: compressed.mimeType,
      customMetadata: {
        originalName: file.name,
        compressed: 'true',
        width: String(compressed.width),
        height: String(compressed.height),
      },
    });

    const photoUrl = await getDownloadURL(snapshot.ref);

    return {
      photoUrl,
      storagePath,
      photoSizeBytes: compressed.sizeBytes,
      photoMimeType: compressed.mimeType,
      photoWidth: compressed.width,
      photoHeight: compressed.height,
    };
  } catch (error) {
    console.error('Gagal mengupload foto inventory:', error);
    throw new Error('Gagal mengunggah foto barang inventory ke server.');
  }
}

// 2. Subscribe to Inventory Items
export function subscribeInventory(
  options?: {
    scope?: ScopeType;
    category?: string;
    condition?: InventoryCondition | 'SEMUA';
    status?: InventoryStatus | 'SEMUA';
    picEmployeeId?: string;
    location?: string;
  },
  callback?: (items: InventoryItem[]) => void
) {
  let q: any = collection(db, INVENTORY_COLLECTION);

  if (options?.scope) {
    q = query(
      collection(db, INVENTORY_COLLECTION),
      where('scope', '==', options.scope)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        inventoryId: docSnap.id,
        ...docSnap.data(),
      })) as InventoryItem[];

      items.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return timeB - timeA;
      });

      if (options?.category && options.category !== 'SEMUA') {
        items = items.filter((i) => i.category === options.category);
      }
      if (options?.condition && options.condition !== 'SEMUA') {
        items = items.filter((i) => i.condition === options.condition);
      }
      if (options?.status && options.status !== 'SEMUA') {
        items = items.filter((i) => i.status === options.status);
      }
      if (options?.picEmployeeId && options.picEmployeeId !== 'SEMUA') {
        items = items.filter((i) => i.picEmployeeId === options.picEmployeeId);
      }
      if (options?.location && options.location !== 'SEMUA') {
        items = items.filter((i) => i.location === options.location);
      }

      if (callback) callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, INVENTORY_COLLECTION);
    }
  );
}

// 3. Subscribe to Inventory History for a specific item
export function subscribeInventoryHistory(
  inventoryId: string,
  callback?: (histories: InventoryHistory[]) => void
) {
  const q = query(
    collection(db, INVENTORY_HISTORY_COLLECTION),
    where('inventoryId', '==', inventoryId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const histories = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as InventoryHistory[];

      histories.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return timeB - timeA;
      });

      if (callback) callback(histories);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, INVENTORY_HISTORY_COLLECTION);
    }
  );
}

// 4. Tambah Inventory Baru (dengan opsi catat pengeluaran & histori awal)
export async function createInventory(
  itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>,
  autoCreateExpense: boolean,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  try {
    const qty = Math.max(1, Number(itemData.quantity) || 1);
    const price = Math.max(0, Number(itemData.pricePerUnit) || 0);
    const totalVal = qty * price;

    // 1. Simpan item ke collection inventory
    const docRef = await addDoc(collection(db, INVENTORY_COLLECTION), {
      ...itemData,
      quantity: qty,
      pricePerUnit: price,
      totalValue: totalVal,
      isExpenseRecorded: false,
      expenseId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUserId,
      createdByName: currentUserName,
    });

    const inventoryId = docRef.id;

    // 2. Buat Histori Awal (DIBELI / DICATAT)
    await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
      inventoryId: inventoryId,
      itemName: itemData.itemName,
      action: 'DIBELI',
      date: itemData.purchaseDate || new Date().toISOString().slice(0, 10),
      newLocation: itemData.location || 'Studio',
      newPicId: itemData.picEmployeeId || null,
      newPicName: itemData.picEmployeeName || null,
      newCondition: itemData.condition || 'BAIK',
      newStatus: itemData.status || 'AKTIF',
      notes: itemData.notes
        ? `Pembelian awal: ${itemData.quantity} unit @ Rp ${price.toLocaleString('id-ID')}. Catatan: ${itemData.notes}`
        : `Pembelian awal: ${itemData.quantity} unit @ Rp ${price.toLocaleString('id-ID')}`,
      actorUid: currentUserId,
      actorName: currentUserName,
      createdAt: serverTimestamp(),
    });

    // 3. Catat Pengeluaran Otomatis jika dipilih & total biaya > 0
    if (autoCreateExpense && totalVal > 0) {
      const expenseRef = await addDoc(collection(db, 'expenses'), {
        date: itemData.purchaseDate || new Date().toISOString().slice(0, 10),
        amount: totalVal,
        category: 'INVENTORY',
        scope: itemData.scope || 'PRIBADI',
        inventoryId: inventoryId,
        description: `Pembelian Inventory: ${itemData.itemName} (${qty} unit @ Rp ${price.toLocaleString('id-ID')})`,
        createdBy: currentUserId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Unified Transaction with deterministic reference
      await createFinancialTransaction(
        {
          type: 'EXPENSE',
          scope: itemData.scope || 'PRIBADI',
          amount: totalVal,
          date: itemData.purchaseDate || new Date().toISOString().slice(0, 10),
          category: 'INVENTORY',
          sourceType: 'INVENTORY',
          referenceId: inventoryId,
          inventoryId: inventoryId,
          description: `Pembelian Inventory: ${itemData.itemName} (${qty} unit)`,
          createdBy: currentUserId,
          createdByName: currentUserName,
        },
        currentUserId,
        currentUserName
      );

      // Update Inventory doc with expense reference
      await updateDoc(doc(db, INVENTORY_COLLECTION, inventoryId), {
        isExpenseRecorded: true,
        expenseId: expenseRef.id,
        expenseRecordedAt: serverTimestamp(),
      });

      // Histori catat pengeluaran
      await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
        inventoryId: inventoryId,
        itemName: itemData.itemName,
        action: 'EXPENSE_DICATAT',
        date: itemData.purchaseDate || new Date().toISOString().slice(0, 10),
        notes: `Tercatat sebagai Pengeluaran Kas (Rp ${totalVal.toLocaleString('id-ID')})`,
        actorUid: currentUserId,
        actorName: currentUserName,
        createdAt: serverTimestamp(),
      });

      await catatAuditLog(
        currentUserId,
        currentUserName,
        'INVENTORY_EXPENSE_CREATED',
        itemData.itemName,
        `Mencatat otomatis pengeluaran inventory ${itemData.itemName} sebesar Rp ${totalVal.toLocaleString('id-ID')}`
      );
    }

    // 4. Catat Audit Log Utama
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INVENTORY_CREATED',
      itemData.itemName,
      `Kategori: ${itemData.category}, Qty: ${qty}, Total: Rp ${totalVal.toLocaleString('id-ID')}, Lokasi: ${itemData.location}, Scope: ${itemData.scope}`
    );

    return inventoryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, INVENTORY_COLLECTION);
    throw error;
  }
}

// 5. Update Data Inventory (dengan deteksi histori otomatis)
export async function updateInventory(
  id: string,
  currentItem: InventoryItem,
  updates: Partial<InventoryItem>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, INVENTORY_COLLECTION, id);

    // Hitung ulang total jika qty atau harga berubah
    const newQty = updates.quantity !== undefined ? Number(updates.quantity) : currentItem.quantity;
    const newPrice =
      updates.pricePerUnit !== undefined ? Number(updates.pricePerUnit) : currentItem.pricePerUnit;
    const newTotal = newQty * newPrice;

    await updateDoc(docRef, {
      ...updates,
      quantity: newQty,
      pricePerUnit: newPrice,
      totalValue: newTotal,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    // Deteksi Perubahan Kondisi
    if (updates.condition && updates.condition !== currentItem.condition) {
      await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
        inventoryId: id,
        itemName: updates.itemName || currentItem.itemName,
        action: updates.condition === 'BAIK' && currentItem.condition !== 'BAIK' ? 'DIPERBAIKI' : 'KONDISI_BERUBAH',
        date: todayStr,
        previousCondition: currentItem.condition,
        newCondition: updates.condition,
        notes: `Kondisi diubah dari ${currentItem.condition} menjadi ${updates.condition}. Catatan: ${updates.notes || '-'}`,
        actorUid: currentUserId,
        actorName: currentUserName,
        createdAt: serverTimestamp(),
      });

      await catatAuditLog(
        currentUserId,
        currentUserName,
        'INVENTORY_CONDITION_CHANGED',
        currentItem.itemName,
        `Kondisi berubah: ${currentItem.condition} -> ${updates.condition}`
      );
    }

    // Deteksi Perubahan Status
    if (updates.status && updates.status !== currentItem.status) {
      await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
        inventoryId: id,
        itemName: updates.itemName || currentItem.itemName,
        action: 'STATUS_BERUBAH',
        date: todayStr,
        previousStatus: currentItem.status,
        newStatus: updates.status,
        notes: `Status diubah dari ${currentItem.status} menjadi ${updates.status}`,
        actorUid: currentUserId,
        actorName: currentUserName,
        createdAt: serverTimestamp(),
      });

      await catatAuditLog(
        currentUserId,
        currentUserName,
        'INVENTORY_STATUS_CHANGED',
        currentItem.itemName,
        `Status berubah: ${currentItem.status} -> ${updates.status}`
      );
    }

    // Deteksi Perubahan Lokasi / PIC
    const locationChanged = updates.location && updates.location !== currentItem.location;
    const picChanged = updates.picEmployeeId !== undefined && updates.picEmployeeId !== currentItem.picEmployeeId;

    if (locationChanged || picChanged) {
      await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
        inventoryId: id,
        itemName: updates.itemName || currentItem.itemName,
        action: locationChanged ? 'DIPINDAHKAN' : 'PIC_BERUBAH',
        date: todayStr,
        previousLocation: currentItem.location,
        newLocation: updates.location || currentItem.location,
        previousPicId: currentItem.picEmployeeId || null,
        previousPicName: currentItem.picEmployeeName || null,
        newPicId: updates.picEmployeeId !== undefined ? updates.picEmployeeId : currentItem.picEmployeeId,
        newPicName: updates.picEmployeeName !== undefined ? updates.picEmployeeName : currentItem.picEmployeeName,
        notes: `Perubahan penempatan/PIC. Catatan: ${updates.notes || '-'}`,
        actorUid: currentUserId,
        actorName: currentUserName,
        createdAt: serverTimestamp(),
      });

      if (locationChanged) {
        await catatAuditLog(
          currentUserId,
          currentUserName,
          'INVENTORY_MOVED',
          currentItem.itemName,
          `Lokasi dipindahkan: ${currentItem.location} -> ${updates.location}`
        );
      }

      if (picChanged) {
        await catatAuditLog(
          currentUserId,
          currentUserName,
          'INVENTORY_PIC_CHANGED',
          currentItem.itemName,
          `PIC diubah: ${currentItem.picEmployeeName || 'Belum ada'} -> ${updates.picEmployeeName || 'Belum ada'}`
        );
      }
    }

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INVENTORY_UPDATED',
      currentItem.itemName,
      `Memperbarui data inventory ${currentItem.itemName}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, INVENTORY_COLLECTION);
    throw error;
  }
}

// 6. Pemindahan Barang (Aksi Khusus [ PINDAHKAN ])
export async function moveInventory(
  id: string,
  currentItem: InventoryItem,
  newLocation: string,
  newPicId: string,
  newPicName: string,
  notes: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, INVENTORY_COLLECTION, id);

    await updateDoc(docRef, {
      location: newLocation,
      picEmployeeId: newPicId || null,
      picEmployeeName: newPicName || null,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    // Tambah Histori Perpindahan
    await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
      inventoryId: id,
      itemName: currentItem.itemName,
      action: 'DIPINDAHKAN',
      date: todayStr,
      previousLocation: currentItem.location,
      newLocation: newLocation,
      previousPicId: currentItem.picEmployeeId || null,
      previousPicName: currentItem.picEmployeeName || null,
      newPicId: newPicId || null,
      newPicName: newPicName || null,
      notes: notes.trim() || `Barang dipindahkan dari ${currentItem.location} ke ${newLocation} (PIC: ${newPicName || '-'})`,
      actorUid: currentUserId,
      actorName: currentUserName,
      createdAt: serverTimestamp(),
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INVENTORY_MOVED',
      currentItem.itemName,
      `Pemindahan barang: ${currentItem.location} -> ${newLocation}, PIC: ${currentItem.picEmployeeName || '-'} -> ${newPicName || '-'}. Ket: ${notes || '-'}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, INVENTORY_COLLECTION);
    throw error;
  }
}

// 7. Update Kondisi Barang (Aksi Cepat)
export async function updateInventoryCondition(
  id: string,
  currentItem: InventoryItem,
  newCondition: InventoryCondition,
  notes: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, INVENTORY_COLLECTION, id);

    await updateDoc(docRef, {
      condition: newCondition,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const actionType: any = newCondition === 'BAIK' && currentItem.condition !== 'BAIK' ? 'DIPERBAIKI' : 'KONDISI_BERUBAH';

    await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
      inventoryId: id,
      itemName: currentItem.itemName,
      action: actionType,
      date: todayStr,
      previousCondition: currentItem.condition,
      newCondition: newCondition,
      notes: notes.trim() || `Kondisi diubah ke ${newCondition}`,
      actorUid: currentUserId,
      actorName: currentUserName,
      createdAt: serverTimestamp(),
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INVENTORY_CONDITION_CHANGED',
      currentItem.itemName,
      `Perubahan kondisi: ${currentItem.condition} -> ${newCondition}. Ket: ${notes || '-'}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, INVENTORY_COLLECTION);
    throw error;
  }
}

// 8. Catat sebagai Pengeluaran (dengan proteksi Anti-Double-Entry yang ketat)
export async function recordInventoryExpense(
  inventoryId: string,
  item: InventoryItem,
  currentUserId: string,
  currentUserName: string
): Promise<{ success: boolean; message: string; expenseId?: string }> {
  try {
    // 1. Cek flag lokal pada item
    if (item.isExpenseRecorded || item.expenseId) {
      await catatAuditLog(
        currentUserId,
        currentUserName,
        'INVENTORY_EXPENSE_DUPLICATE_PREVENTED',
        item.itemName,
        `Percobaan double-entry pengeluaran inventory ${item.itemName} dicegah oleh sistem.`
      );
      return {
        success: false,
        message: 'Pengeluaran inventory ini sudah tercatat sebelumnya (Anti-Double-Entry).',
      };
    }

    // 2. Cek apakah sudah ada expense di database dengan inventoryId ini
    const q = query(
      collection(db, 'expenses'),
      where('inventoryId', '==', inventoryId)
    );
    const existingExpenses = await getDocs(q);

    if (!existingExpenses.empty) {
      const existingDoc = existingExpenses.docs[0];
      // Update item flag agar sinkron
      await updateDoc(doc(db, INVENTORY_COLLECTION, inventoryId), {
        isExpenseRecorded: true,
        expenseId: existingDoc.id,
      });

      await catatAuditLog(
        currentUserId,
        currentUserName,
        'INVENTORY_EXPENSE_DUPLICATE_PREVENTED',
        item.itemName,
        `Ditemukan dokumen expense existing (${existingDoc.id}) untuk inventory ${item.itemName}. Double-entry dicegah.`
      );

      return {
        success: false,
        message: 'Pengeluaran inventory ini sudah tercatat di sistem.',
      };
    }

    const totalCost = Number(item.totalValue) || (Number(item.quantity) * Number(item.pricePerUnit)) || 0;
    if (totalCost <= 0) {
      return {
        success: false,
        message: 'Total nilai inventory adalah Rp 0, tidak dapat dicatat ke pengeluaran kas.',
      };
    }

    // 3. Buat dokumen baru di expenses
    const expenseRef = await addDoc(collection(db, 'expenses'), {
      date: item.purchaseDate || new Date().toISOString().slice(0, 10),
      amount: totalCost,
      category: 'INVENTORY',
      scope: item.scope || 'PRIBADI',
      inventoryId: inventoryId,
      description: `Pembelian Inventory: ${item.itemName} (${item.quantity} unit @ Rp ${(item.pricePerUnit || 0).toLocaleString('id-ID')})`,
      createdBy: currentUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Buat transaksi terpadu di transactions dengan deterministic ID
    await createFinancialTransaction(
      {
        type: 'EXPENSE',
        scope: item.scope || 'PRIBADI',
        amount: totalCost,
        date: item.purchaseDate || new Date().toISOString().slice(0, 10),
        category: 'INVENTORY',
        sourceType: 'INVENTORY',
        referenceId: inventoryId,
        inventoryId: inventoryId,
        description: `Pembelian Inventory: ${item.itemName} (${item.quantity} unit)`,
        createdBy: currentUserId,
        createdByName: currentUserName,
      },
      currentUserId,
      currentUserName
    );

    // 5. Update status di dokumen inventory
    await updateDoc(doc(db, INVENTORY_COLLECTION, inventoryId), {
      isExpenseRecorded: true,
      expenseId: expenseRef.id,
      expenseRecordedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    });

    // 6. Catat Histori & Audit Log
    const todayStr = new Date().toISOString().slice(0, 10);
    await addDoc(collection(db, INVENTORY_HISTORY_COLLECTION), {
      inventoryId: inventoryId,
      itemName: item.itemName,
      action: 'EXPENSE_DICATAT',
      date: todayStr,
      notes: `Dicatat manual sebagai Pengeluaran Kas sebesar Rp ${totalCost.toLocaleString('id-ID')}`,
      actorUid: currentUserId,
      actorName: currentUserName,
      createdAt: serverTimestamp(),
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INVENTORY_EXPENSE_CREATED',
      item.itemName,
      `Berhasil mencatat pengeluaran kas untuk inventory ${item.itemName} sebesar Rp ${totalCost.toLocaleString('id-ID')}`
    );

    return {
      success: true,
      message: `Pengeluaran inventory "${item.itemName}" berhasil dicatat ke Kas Kantor (Rp ${totalCost.toLocaleString('id-ID')}).`,
      expenseId: expenseRef.id,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'expenses');
    throw error;
  }
}

// 9. Hapus Inventory
export async function deleteInventory(
  id: string,
  item: InventoryItem,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, INVENTORY_COLLECTION, id));

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INVENTORY_DELETED',
      item.itemName,
      `Menghapus data inventory ${item.itemName} (Kategori: ${item.category}, Nilai: Rp ${item.totalValue.toLocaleString('id-ID')})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, INVENTORY_COLLECTION);
    throw error;
  }
}
