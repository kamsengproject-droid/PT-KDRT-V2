import { addDoc, collection, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AuditLogEntry } from '../types';

export async function catatAuditLog(
  userId: string,
  userName: string,
  action: string,
  target: string,
  details?: string,
  before?: any,
  after?: any
) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId,
      userName,
      action,
      target,
      details: details || '',
      before: before || null,
      after: after || null,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Gagal mencatat audit log:', error);
  }
}

export function subscribeAuditLogs(
  maxLimit: number = 50,
  callback: (logs: AuditLogEntry[]) => void
) {
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(maxLimit));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AuditLogEntry[];
      callback(logs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'auditLogs');
    }
  );
}
