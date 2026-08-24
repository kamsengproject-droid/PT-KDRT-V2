import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Expense, ScopeType } from '../types';
import { catatAuditLog } from './auditService';
import { createFinancialTransaction } from './transactionService';

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function subscribeExpenses(
  scope?: ScopeType,
  callback?: (expenses: Expense[]) => void
) {
  const colRef = collection(db, 'expenses');
  const q = scope
    ? query(colRef, where('scope', '==', scope))
    : colRef;

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Expense[];
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'expenses');
    }
  );
}

export async function tambahPengeluaran(
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const amount = Number(expense.amount) || 0;
    const rawData = cleanUndefined({
      ...expense,
      amount,
      paymentMethod: expense.paymentMethod || 'TRANSFER',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUserId,
    });

    const docRef = await addDoc(collection(db, 'expenses'), rawData);

    // Also record transaction in unified transactions collection for single source of truth
    let sourceType: any = expense.sourceType || 'DAILY_EXPENSE';
    let refId: any = docRef.id;

    if (expense.sampleId) {
      sourceType = 'SAMPLE';
      refId = expense.sampleId;
    } else if (expense.inventoryId) {
      sourceType = 'INVENTORY';
      refId = expense.inventoryId;
    } else if (expense.payrollId) {
      sourceType = 'PAYROLL';
      refId = expense.payrollId;
    }

    const txScope: ScopeType = expense.scope === 'PRIBADI' ? 'PRIBADI' : 'SHARING';

    await createFinancialTransaction(
      cleanUndefined({
        type: 'EXPENSE',
        scope: txScope,
        amount,
        date: expense.date,
        category: expense.category,
        sourceType,
        referenceId: refId,
        accountId: expense.accountId || null,
        accountName: expense.accountName || null,
        employeeId: expense.employeeId || null,
        employeeName: expense.employeeName || null,
        sampleId: expense.sampleId || null,
        inventoryId: expense.inventoryId || null,
        payrollId: expense.payrollId || null,
        paymentMethod: expense.paymentMethod || 'TRANSFER',
        description: expense.description || `Pengeluaran ${expense.category}`,
        attachmentUrl: expense.receiptUrl || null,
        notes: expense.notes || '',
        createdBy: currentUserId,
        createdByName: currentUserName,
      }) as any,
      currentUserId,
      currentUserName
    );

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TAMBAH_PENGELUARAN',
      expense.category,
      `Jumlah: Rp ${amount.toLocaleString('id-ID')}, Scope: ${expense.scope}, Ket: ${expense.description}`
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'expenses');
    throw error;
  }
}

export async function updateExpense(
  id: string,
  updates: Partial<Expense>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const docRef = doc(db, 'expenses', id);
    const cleaned = cleanUndefined({
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(docRef, cleaned);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_PENGELUARAN',
      id,
      `Update pengeluaran: ${updates.description || id}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `expenses/${id}`);
    throw error;
  }
}

export async function hapusPengeluaran(
  id: string,
  description: string,
  currentUserId: string,
  currentUserName: string,
  sourceType: string = 'DAILY_EXPENSE'
) {
  try {
    await deleteDoc(doc(db, 'expenses', id));
    
    // Attempt to delete transaction with deterministic ID
    try {
      const deterministicId = `${sourceType}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const txRef = doc(db, 'transactions', deterministicId);
      await deleteDoc(txRef);
    } catch (e) {
      console.warn("Could not delete related transaction", e);
    }
    
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'DELETE_EXPENSE',
      id,
      `Pengeluaran dihapus: ${description}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    throw error;
  }
}

// Aliases for consistent naming
export const tambahExpense = tambahPengeluaran;
export const hapusExpense = hapusPengeluaran;
export const updatePengeluaran = updateExpense;
