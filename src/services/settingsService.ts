import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Holiday, OfficeLocation, WorkplaceSchedule } from '../types';
import { DEFAULT_SCHEDULE } from '../utils/attendanceCalc';
import { catatAuditLog } from './auditService';

export const DEFAULT_OFFICE: OfficeLocation = {
  officeName: 'Kantor PT.KDRT',
  latitude: -6.2088,
  longitude: 106.8456,
  radius: 100, // 100 meters
};

// Subscribe schedule
export function subscribeWorkplaceSchedule(callback: (schedule: WorkplaceSchedule) => void) {
  const ref = doc(db, 'workplaceSettings', 'schedule');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as WorkplaceSchedule);
      } else {
        callback(DEFAULT_SCHEDULE);
      }
    },
    (err) => {
      console.warn('Gagal membaca schedule settings:', err);
      callback(DEFAULT_SCHEDULE);
    }
  );
}

// Update schedule
export async function updateWorkplaceSchedule(
  schedule: WorkplaceSchedule,
  userId: string,
  userName: string
) {
  try {
    const ref = doc(db, 'workplaceSettings', 'schedule');
    const prevSnap = await getDoc(ref);
    const before = prevSnap.exists() ? prevSnap.data() : null;

    await setDoc(ref, {
      ...schedule,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await catatAuditLog(
      userId,
      userName,
      'EDIT_JADWAL_KERJA',
      'Jadwal Kerja',
      `Senin–Jumat: ${schedule.weekdayCheckInTime || schedule.checkInTime}–${schedule.weekdayCheckOutTime || schedule.checkOutTime}, Sabtu: ${schedule.saturdayCheckInTime || '09:00'}–${schedule.saturdayCheckOutTime || '12:30'}, Toleransi Pulang Cepat: ${schedule.earlyCheckoutToleranceMinutes ?? 10}m, Hari: ${schedule.workDays.join(', ')}`,
      before,
      schedule
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'workplaceSettings/schedule');
  }
}

// Subscribe office geofence location
export function subscribeOfficeLocation(callback: (office: OfficeLocation) => void) {
  const ref = doc(db, 'workplaceSettings', 'geofence');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as OfficeLocation);
      } else {
        callback(DEFAULT_OFFICE);
      }
    },
    (err) => {
      console.warn('Gagal membaca geofence settings:', err);
      callback(DEFAULT_OFFICE);
    }
  );
}

// Update office geofence location
export async function updateOfficeLocation(
  office: OfficeLocation,
  userId: string,
  userName: string
) {
  try {
    const ref = doc(db, 'workplaceSettings', 'geofence');
    const prevSnap = await getDoc(ref);
    const before = prevSnap.exists() ? prevSnap.data() : null;

    await setDoc(ref, {
      ...office,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await catatAuditLog(
      userId,
      userName,
      'EDIT_LOKASI_KANTOR',
      office.officeName,
      `Lat: ${office.latitude}, Lon: ${office.longitude}, Radius: ${office.radius} meter`,
      before,
      office
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'workplaceSettings/geofence');
  }
}

// Subscribe holidays
export function subscribeHolidays(callback: (holidays: Holiday[]) => void) {
  const q = query(collection(db, 'holidays'), orderBy('date', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Holiday[];
      callback(data);
    },
    (err) => {
      console.warn('Gagal membaca holidays:', err);
      callback([]);
    }
  );
}

// Add holiday
export async function tambahHariLibur(
  holiday: Omit<Holiday, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
  userName: string
) {
  try {
    const docRef = await addDoc(collection(db, 'holidays'), {
      ...holiday,
      active: holiday.active !== undefined ? holiday.active : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    });

    await catatAuditLog(
      userId,
      userName,
      'TAMBAH_HARI_LIBUR',
      holiday.name,
      `Tanggal: ${holiday.date}, Keterangan: ${holiday.notes || '-'}`
    );
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'holidays');
  }
}

// Update holiday
export async function updateHariLibur(
  id: string,
  holiday: Partial<Holiday>,
  userId: string,
  userName: string
) {
  try {
    const ref = doc(db, 'holidays', id);
    const prevSnap = await getDoc(ref);
    const before = prevSnap.exists() ? prevSnap.data() : null;

    await setDoc(
      ref,
      {
        ...holiday,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await catatAuditLog(
      userId,
      userName,
      'EDIT_HARI_LIBUR',
      holiday.name || (before ? before.name : id),
      `Tanggal: ${holiday.date || before?.date}, Keterangan: ${holiday.notes || before?.notes || '-'}`,
      before,
      holiday
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `holidays/${id}`);
  }
}

// Delete holiday
export async function hapusHariLibur(
  id: string,
  holidayName: string,
  userId: string,
  userName: string
) {
  try {
    await deleteDoc(doc(db, 'holidays', id));
    await catatAuditLog(userId, userName, 'HAPUS_HARI_LIBUR', holidayName, `Menghapus hari libur ${holidayName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `holidays/${id}`);
  }
}
