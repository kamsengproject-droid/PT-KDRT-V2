import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';

import {
  Expense,
  ScopeType,
} from '../types';

import {
  catatAuditLog,
} from './auditService';

import {
  createFinancialTransaction,
} from './transactionService';

/* ============================================================
   UTIL
============================================================ */

function cleanUndefined<
  T extends Record<string, any>
>(obj: T): Partial<T> {
  const result: any = {};

  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });

  return result;
}

/* ============================================================
   SUBSCRIBE EXPENSES
============================================================ */

export function subscribeExpenses(
  scope?: ScopeType,
  callback?: (
    expenses: Expense[]
  ) => void
) {
  const colRef =
    collection(db, 'expenses');

  const q = scope
    ? query(
        colRef,
        where(
          'scope',
          '==',
          scope
        )
      )
    : colRef;

  return onSnapshot(
    q,
    (snap) => {
      const list =
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Expense[];

      list.sort(
        (a, b) =>
          (b.date || '').localeCompare(
            a.date || ''
          )
      );

      if (callback) {
        callback(list);
      }
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.GET,
        'expenses'
      );
    }
  );
}

/* ============================================================
   DETERMINISTIC TRANSACTION INFO
============================================================ */

function getTransactionSource(
  expense: Expense,
  expenseId: string
) {
  let sourceType =
    expense.sourceType ||
    'DAILY_EXPENSE';

  let referenceId =
    expenseId;

  if (expense.sampleId) {
    sourceType = 'SAMPLE';
    referenceId =
      expense.sampleId;
  } else if (expense.inventoryId) {
    sourceType = 'INVENTORY';
    referenceId =
      expense.inventoryId;
  } else if (expense.payrollId) {
    sourceType = 'PAYROLL';
    referenceId =
      expense.payrollId;
  }

  return {
    sourceType,
    referenceId,
  };
}

/* ============================================================
   ADD EXPENSE
============================================================ */

export async function tambahPengeluaran(
  expense: Omit<
    Expense,
    'id' |
      'createdAt' |
      'updatedAt'
  >,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const amount =
      Number(expense.amount) || 0;

    if (amount <= 0) {
      throw new Error(
        'Nominal pengeluaran harus lebih dari Rp 0.'
      );
    }

    const scope: ScopeType =
      expense.scope ===
      'PRIBADI'
        ? 'PRIBADI'
        : 'SHARING';

    /*
     * ----------------------------------------------------------
     * 1. SIMPAN EXPENSE
     * ----------------------------------------------------------
     */

    const rawData =
      cleanUndefined({
        ...expense,

        amount,

        scope,

        paymentMethod:
          expense.paymentMethod ||
          'TRANSFER',

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        createdBy:
          currentUserId,
      });

    const expenseRef =
      await addDoc(
        collection(
          db,
          'expenses'
        ),
        rawData
      );

    const expenseId =
      expenseRef.id;

    /*
     * ----------------------------------------------------------
     * 2. TENTUKAN SUMBER TRANSAKSI
     * ----------------------------------------------------------
     */

    const {
      sourceType,
      referenceId,
    } =
      getTransactionSource(
        expense,
        expenseId
      );

    /*
     * ----------------------------------------------------------
     * 3. BUAT TRANSAKSI KAS & BANK
     * ----------------------------------------------------------
     *
     * Satu pengeluaran = satu transaksi.
     *
     * createFinancialTransaction()
     * bertanggung jawab terhadap
     * deterministic transaction ID.
     */

    await createFinancialTransaction(
      cleanUndefined({
        type:
          'EXPENSE',

        scope,

        amount,

        date:
          expense.date,

        category:
          expense.category,

        sourceType,

        referenceId,

        accountId:
          expense.accountId ||
          null,

        accountName:
          expense.accountName ||
          null,

        employeeId:
          expense.employeeId ||
          null,

        employeeName:
          expense.employeeName ||
          null,

        sampleId:
          expense.sampleId ||
          null,

        inventoryId:
          expense.inventoryId ||
          null,

        payrollId:
          expense.payrollId ||
          null,

        paymentMethod:
          expense.paymentMethod ||
          'TRANSFER',

        description:
          expense.description ||
          `Pengeluaran ${expense.category}`,

        attachmentUrl:
          expense.receiptUrl ||
          null,

        notes:
          expense.notes ||
          '',

        createdBy:
          currentUserId,

        createdByName:
          currentUserName,
      }) as any,
      currentUserId,
      currentUserName
    );

    /*
     * ----------------------------------------------------------
     * 4. AUDIT
     * ----------------------------------------------------------
     */

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TAMBAH_PENGELUARAN',
      expense.category,
      `Jumlah: Rp ${amount.toLocaleString(
        'id-ID'
      )}, Scope: ${scope}, Ket: ${
        expense.description || '-'
      }`
    );

    return expenseId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      'expenses'
    );

    throw error;
  }
}

/* ============================================================
   UPDATE EXPENSE
============================================================ */

export async function updateExpense(
  id: string,
  updates: Partial<Expense>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const expenseRef =
      doc(
        db,
        'expenses',
        id
      );

    /*
     * Ambil data lama agar kita bisa
     * memperbarui transaksi Kas & Bank
     * dengan data lengkap.
     */

    const existingSnap =
      await getDoc(
        expenseRef
      );

    if (
      !existingSnap.exists()
    ) {
      throw new Error(
        'Data pengeluaran tidak ditemukan.'
      );
    }

    const existing =
      existingSnap.data() as Expense;

    const merged =
      {
        ...existing,
        ...updates,
      } as Expense;

    const amount =
      Number(
        merged.amount
      ) || 0;

    if (amount <= 0) {
      throw new Error(
        'Nominal pengeluaran harus lebih dari Rp 0.'
      );
    }

    const scope: ScopeType =
      merged.scope ===
      'PRIBADI'
        ? 'PRIBADI'
        : 'SHARING';

    /*
     * ----------------------------------------------------------
     * 1. UPDATE EXPENSE
     * ----------------------------------------------------------
     */

    const cleaned =
      cleanUndefined({
        ...updates,

        amount,

        scope,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          currentUserId,
      });

    await updateDoc(
      expenseRef,
      cleaned
    );

    /*
     * ----------------------------------------------------------
     * 2. UPDATE TRANSAKSI KAS & BANK
     * ----------------------------------------------------------
     *
     * Gunakan reference ID yang sama
     * dengan transaksi saat pertama dibuat.
     */

    const {
      sourceType,
      referenceId,
    } =
      getTransactionSource(
        merged,
        id
      );

    const transactionId =
      `${sourceType}_${referenceId}`
        .replace(
          /[^a-zA-Z0-9_-]/g,
          '_'
        );

    const transactionRef =
      doc(
        db,
        'transactions',
        transactionId
      );

    const transactionSnap =
      await getDoc(
        transactionRef
      );

    if (
      transactionSnap.exists()
    ) {
      await updateDoc(
        transactionRef,
        cleanUndefined({
          amount,

          date:
            merged.date,

          category:
            merged.category,

          scope,

          accountId:
            merged.accountId ||
            null,

          accountName:
            merged.accountName ||
            null,

          employeeId:
            merged.employeeId ||
            null,

          employeeName:
            merged.employeeName ||
            null,

          sampleId:
            merged.sampleId ||
            null,

          inventoryId:
            merged.inventoryId ||
            null,

          payrollId:
            merged.payrollId ||
            null,

          paymentMethod:
            merged.paymentMethod ||
            'TRANSFER',

          description:
            merged.description ||
            `Pengeluaran ${merged.category}`,

          attachmentUrl:
            merged.receiptUrl ||
            null,

          notes:
            merged.notes ||
            '',

          updatedAt:
            serverTimestamp(),

          updatedBy:
            currentUserId,
        })
      );
    }

    /*
     * ----------------------------------------------------------
     * 3. AUDIT
     * ----------------------------------------------------------
     */

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_PENGELUARAN',
      id,
      `Update pengeluaran: ${
        merged.description ||
        id
      }`
    );

    return true;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `expenses/${id}`
    );

    throw error;
  }
}

/* ============================================================
   DELETE EXPENSE
============================================================ */

export async function hapusPengeluaran(
  id: string,
  description: string,
  currentUserId: string,
  currentUserName: string,
  sourceType: string =
    'DAILY_EXPENSE'
) {
  try {
    /*
     * Ambil expense sebelum dihapus
     * supaya kita tahu reference ID
     * transaksi Kas & Bank.
     */

    const expenseRef =
      doc(
        db,
        'expenses',
        id
      );

    const expenseSnap =
      await getDoc(
        expenseRef
      );

    const expense =
      expenseSnap.exists()
        ? (expenseSnap.data() as Expense)
        : null;

    /*
     * ----------------------------------------------------------
     * TENTUKAN TRANSAKSI TERKAIT
     * ----------------------------------------------------------
     */

    if (expense) {
      const source =
        getTransactionSource(
          expense,
          id
        );

      const transactionId =
        `${source.sourceType}_${source.referenceId}`
          .replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          );

      try {
        await deleteDoc(
          doc(
            db,
            'transactions',
            transactionId
          )
        );
      } catch (transactionError) {
        console.warn(
          'Transaksi Kas & Bank terkait tidak dapat dihapus:',
          transactionError
        );
      }
    } else {
      /*
       * Fallback untuk transaksi lama.
       */

      try {
        const deterministicId =
          `${sourceType}_${id}`
            .replace(
              /[^a-zA-Z0-9_-]/g,
              '_'
            );

        await deleteDoc(
          doc(
            db,
            'transactions',
            deterministicId
          )
        );
      } catch (transactionError) {
        console.warn(
          'Could not delete related transaction',
          transactionError
        );
      }
    }

    /*
     * ----------------------------------------------------------
     * HAPUS EXPENSE
     * ----------------------------------------------------------
     */

    await deleteDoc(
      expenseRef
    );

    /*
     * ----------------------------------------------------------
     * AUDIT
     * ----------------------------------------------------------
     */

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'DELETE_EXPENSE',
      id,
      `Pengeluaran dihapus: ${description}`
    );

    return true;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `expenses/${id}`
    );

    throw error;
  }
}

/* ============================================================
   ALIASES
============================================================ */

export const tambahExpense =
  tambahPengeluaran;

export const hapusExpense =
  hapusPengeluaran;

export const updatePengeluaran =
  updateExpense;
