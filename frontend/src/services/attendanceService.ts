import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { AttendanceRecord, AttendanceStatus, CheckoutStatus, Holiday, WorkplaceSchedule, OfficeLocation } from '../types';
import { hitungMenitTerlambat, hitungStatusPulang, getJadwalHari, cekHariLibur, DEFAULT_SCHEDULE } from '../utils/attendanceCalc';
import { validasiGeofence } from '../utils/geofence';
import { catatAuditLog } from './auditService';
import { formatJamPendek, tanggalHariIni } from '../utils/formatters';

export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return { blob: new Blob([u8arr], { type: mimeType }), mimeType };
  } catch (err) {
    console.error('[ATTENDANCE_IMAGE_ERROR] Failed converting dataUrl to Blob:', err);
    throw new Error('Format foto tidak valid. Silakan ulangi pengambilan selfie.');
  }
}

// Upload selfie image (base64 data URL) to Firebase Storage
export async function uploadSelfieStorage(
  employeeId: string,
  tanggal: string,
  type: 'checkin' | 'checkout',
  dataUrl: string,
  onProgress?: (msg: string) => void
): Promise<{
  photoUrl: string;
  storagePath: string;
  photoWidth: number;
  photoHeight: number;
  photoSizeBytes: number;
  photoMimeType: string;
}> {
  if (onProgress) onProgress('Mengompres foto...');

  let blob: Blob;
  let photoMimeType = 'image/jpeg';
  try {
    const converted = dataUrlToBlob(dataUrl);
    blob = converted.blob;
    photoMimeType = converted.mimeType;
  } catch (err: any) {
    console.error('[ATTENDANCE_IMAGE_ERROR]', err);
    throw new Error('Gagal memproses foto selfie. Silakan coba lagi.');
  }

  const photoSizeBytes = blob.size;
  const photoWidth = 640;
  const photoHeight = 480;

  if (photoSizeBytes > 5 * 1024 * 1024) {
    throw new Error('Ukuran foto terlalu besar. Silakan ambil foto kembali.');
  }

  const storagePath = `attendance/${employeeId}/${tanggal}/${type === 'checkin' ? 'check-in' : 'check-out'}.jpg`;

  if (onProgress) onProgress('Menyimpan foto...');

  try {
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, blob, {
      contentType: photoMimeType,
      customMetadata: {
        employeeId,
        date: tanggal,
        type,
        uploadedAt: new Date().toISOString(),
      },
    });
    const downloadUrl = await getDownloadURL(fileRef);
    return {
      photoUrl: downloadUrl,
      storagePath,
      photoWidth,
      photoHeight,
      photoSizeBytes,
      photoMimeType,
    };
  } catch (error: any) {
    console.error('[ATTENDANCE_STORAGE_ERROR]', {
      code: error?.code || 'STORAGE_UPLOAD_ERROR',
      message: error?.message || 'Storage upload error',
    });
    throw new Error('Gagal mengupload foto selfie ke cloud storage. Periksa koneksi internet Anda.');
  }
}

export interface AbsenMasukParams {
  employeeId: string;
  employeeName: string;
  fotoBase64?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  validateGps?: boolean;
  schedule?: WorkplaceSchedule;
  office?: OfficeLocation;
  holidays?: Holiday[];
  currentUserId: string;
  currentUserName: string;
  customTimeStr?: string; // for testing or specific time
  onProgress?: (msg: string) => void;
}

export async function lakukanAbsenMasuk(params: AbsenMasukParams): Promise<AttendanceRecord> {
  const {
    employeeId,
    employeeName,
    latitude,
    longitude,
    accuracy,
    validateGps = false,
    schedule = DEFAULT_SCHEDULE,
    office = { officeName: 'Kantor PT.KDRT', latitude: -6.2088, longitude: 106.8456, radius: 100 },
    holidays = [],
    currentUserId,
    currentUserName,
    customTimeStr,
    onProgress,
  } = params;

  console.time('[ATTENDANCE_SAVE_TOTAL]');
  console.log('[ATTENDANCE_SAVE_START]', { type: 'CHECKIN', employeeId, employeeName });

  const today = tanggalHariIni();
  const dateFormatted = today.replace(/-/g, '');
  const docId = `${employeeId}_${dateFormatted}`;
  const docRef = doc(db, 'attendance', docId);

  // 1. Check existing record (prevent duplicate check-in)
  console.time('[ATTENDANCE_DUPLICATE_CHECK]');
  const existingSnap = await getDoc(docRef);
  console.timeEnd('[ATTENDANCE_DUPLICATE_CHECK]');

  if (existingSnap.exists()) {
    const data = existingSnap.data();
    if (data.waktuMasuk || data.checkInTime || data.checkInAt) {
      catatAuditLog(
        currentUserId,
        currentUserName,
        'CHECK_IN_REJECTED',
        employeeName,
        'Alasan: DUPLICATE_CHECK_IN (Anda sudah melakukan absen masuk hari ini.)'
      ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
      throw new Error('Anda sudah melakukan absen masuk hari ini.');
    }
  }

  let distanceMeters = 0;

  // 2. Optional GPS & Geofence validation (only if explicitly enabled)
  if (validateGps && latitude !== undefined && longitude !== undefined && accuracy !== undefined) {
    const accuracyLimit = office.radius ? Math.max(office.radius, 100) : 100;
    if (accuracy > accuracyLimit) {
      catatAuditLog(
        currentUserId,
        currentUserName,
        'CHECK_IN_REJECTED',
        employeeName,
        `Alasan: LOW_GPS_ACCURACY (Akurasi ${Math.round(accuracy)}m > batas ${accuracyLimit}m)`
      ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
      throw new Error('Akurasi lokasi terlalu rendah. Silakan aktifkan lokasi dengan akurasi tinggi dan coba lagi.');
    }

    const geofenceResult = validasiGeofence(
      latitude,
      longitude,
      accuracy,
      office.latitude,
      office.longitude,
      office.radius
    );

    if (!geofenceResult.isWithin) {
      catatAuditLog(
        currentUserId,
        currentUserName,
        'CHECK_IN_REJECTED',
        employeeName,
        `Alasan: OUTSIDE_GEOFENCE (Jarak: ${geofenceResult.distance}m dari radius ${office.radius}m)`
      ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
      throw new Error('Anda berada di luar area kantor.');
    }
    distanceMeters = geofenceResult.distance;
  }

  // 3. Determine time & status based on day-of-week schedule (Asia/Jakarta)
  const now = new Date();
  const timeStr = customTimeStr || formatJamPendek(now);
  const daySched = getJadwalHari(today, schedule);

  const liburCheck = cekHariLibur(today, holidays, schedule.workDays);
  let status: AttendanceStatus = 'HADIR';
  let menitTerlambat = 0;

  if (liburCheck.isLibur || daySched.isLibur) {
    status = 'LIBUR';
  } else {
    // Jam Masuk 09:00 WIB. Tepat 09:00 = Hadir (0m). 09:01+ = Terlambat (1m+). TIDAK ADA TOLERANSI MASUK.
    const calc = hitungMenitTerlambat(timeStr, daySched.checkInTime, 0);
    status = calc.status;
    menitTerlambat = calc.menitTerlambat;
  }

  if (onProgress) onProgress('Menyimpan absensi...');

  // 4. Save attendance record to Firestore with serverTimestamp (instant without selfie upload)
  const recordData: any = {
    userId: currentUserId,
    employeeId,
    employeeName,
    date: today,
    tanggal: today,
    
    // Check In fields
    checkInAt: serverTimestamp(),
    checkInTime: timeStr,
    waktuMasuk: timeStr,

    // Status
    status,
    lateMinutes: menitTerlambat,
    menitTerlambat,
    earlyCheckoutMinutes: 0,
    jadwalMasuk: daySched.checkInTime,
    jadwalPulang: daySched.checkOutTime,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: currentUserId,
  };

  if (latitude !== undefined) recordData.latitude = latitude;
  if (longitude !== undefined) recordData.longitude = longitude;
  if (accuracy !== undefined) recordData.accuracy = accuracy;
  if (distanceMeters > 0) recordData.distanceFromOffice = distanceMeters;

  try {
    console.time('[ATTENDANCE_FIRESTORE_WRITE]');
    await setDoc(docRef, recordData, { merge: true });
    console.timeEnd('[ATTENDANCE_FIRESTORE_WRITE]');

    console.log('[ATTENDANCE_SAVE_END]', { docId });
    console.timeEnd('[ATTENDANCE_SAVE_TOTAL]');

    // Non-blocking audit log so user doesn't wait for audit trail
    catatAuditLog(
      currentUserId,
      currentUserName,
      'CHECK_IN_SUCCESS',
      employeeName,
      `Absen Masuk: ${timeStr} WIB (${daySched.namaHari}, Jadwal: ${daySched.checkInTime} WIB), Status: ${status}${menitTerlambat > 0 ? ` (Terlambat ${menitTerlambat} menit)` : ''}`
    ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));

    return { id: docId, ...recordData };
  } catch (err) {
    console.error('[ATTENDANCE_SAVE_ERROR]', err);
    handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
    throw new Error('Absensi gagal disimpan. Silakan coba lagi.');
  }
}

export interface AbsenPulangParams {
  employeeId: string;
  employeeName: string;
  fotoBase64?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  validateGps?: boolean;
  schedule?: WorkplaceSchedule;
  office?: OfficeLocation;
  currentUserId: string;
  currentUserName: string;
  customTimeStr?: string;
  onProgress?: (msg: string) => void;
}

export async function lakukanAbsenPulang(params: AbsenPulangParams): Promise<AttendanceRecord> {
  const {
    employeeId,
    employeeName,
    latitude,
    longitude,
    accuracy,
    validateGps = false,
    schedule = DEFAULT_SCHEDULE,
    office = { officeName: 'Kantor PT.KDRT', latitude: -6.2088, longitude: 106.8456, radius: 100 },
    currentUserId,
    currentUserName,
    customTimeStr,
    onProgress,
  } = params;

  console.time('[ATTENDANCE_SAVE_TOTAL]');
  console.log('[ATTENDANCE_SAVE_START]', { type: 'CHECKOUT', employeeId, employeeName });

  const today = tanggalHariIni();
  const dateFormatted = today.replace(/-/g, '');
  const docId = `${employeeId}_${dateFormatted}`;
  const docRef = doc(db, 'attendance', docId);

  // 1. Check existing record
  console.time('[ATTENDANCE_DUPLICATE_CHECK]');
  const existingSnap = await getDoc(docRef);
  console.timeEnd('[ATTENDANCE_DUPLICATE_CHECK]');

  if (!existingSnap.exists() || (!existingSnap.data().waktuMasuk && !existingSnap.data().checkInTime)) {
    catatAuditLog(
      currentUserId,
      currentUserName,
      'CHECK_OUT_REJECTED',
      employeeName,
      'Alasan: CHECKOUT_WITHOUT_CHECKIN (Anda belum melakukan absen masuk hari ini.)'
    ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
    throw new Error('Anda belum melakukan absen masuk hari ini.');
  }

  const existingData = existingSnap.data();
  if (existingData.waktuPulang || existingData.checkOutTime || existingData.checkOutAt) {
    catatAuditLog(
      currentUserId,
      currentUserName,
      'CHECK_OUT_REJECTED',
      employeeName,
      'Alasan: DUPLICATE_CHECK_OUT (Anda sudah melakukan absen pulang hari ini.)'
    ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
    throw new Error('Anda sudah melakukan absen pulang hari ini.');
  }

  let distanceMeters = 0;

  // 2. Optional GPS & Geofence validation
  if (validateGps && latitude !== undefined && longitude !== undefined && accuracy !== undefined) {
    const accuracyLimit = office.radius ? Math.max(office.radius, 100) : 100;
    if (accuracy > accuracyLimit) {
      catatAuditLog(
        currentUserId,
        currentUserName,
        'CHECK_OUT_REJECTED',
        employeeName,
        `Alasan: LOW_GPS_ACCURACY (Akurasi ${Math.round(accuracy)}m > batas ${accuracyLimit}m)`
      ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
      throw new Error('Akurasi lokasi terlalu rendah. Silakan aktifkan lokasi dengan akurasi tinggi dan coba lagi.');
    }

    const geofenceResult = validasiGeofence(
      latitude,
      longitude,
      accuracy,
      office.latitude,
      office.longitude,
      office.radius
    );

    if (!geofenceResult.isWithin) {
      catatAuditLog(
        currentUserId,
        currentUserName,
        'CHECK_OUT_REJECTED',
        employeeName,
        `Alasan: OUTSIDE_GEOFENCE (Jarak: ${geofenceResult.distance}m dari radius ${office.radius}m)`
      ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));
      throw new Error('Anda berada di luar area kantor.');
    }
    distanceMeters = geofenceResult.distance;
  }

  // 3. Calculate day schedule and early checkout status
  const now = new Date();
  const timeStr = customTimeStr || formatJamPendek(now);
  const daySched = getJadwalHari(today, schedule);
  const checkoutCalc = hitungStatusPulang(
    timeStr,
    daySched.checkOutTime,
    daySched.earlyCheckoutToleranceMinutes
  );

  if (onProgress) onProgress('Menyimpan absensi...');

  const updateData: any = {
    checkOutAt: serverTimestamp(),
    checkOutTime: timeStr,
    waktuPulang: timeStr,
    statusPulang: checkoutCalc.statusPulang,
    checkoutStatus: checkoutCalc.checkoutStatus,
    isEarlyCheckout: checkoutCalc.isEarlyCheckout,
    earlyCheckoutMinutes: checkoutCalc.earlyCheckoutMinutes,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
  };

  if (latitude !== undefined) updateData.latitudePulang = latitude;
  if (longitude !== undefined) updateData.longitudePulang = longitude;
  if (accuracy !== undefined) updateData.accuracyPulang = accuracy;
  if (distanceMeters > 0) updateData.distanceFromOffice = distanceMeters;

  try {
    console.time('[ATTENDANCE_FIRESTORE_WRITE]');
    await updateDoc(docRef, updateData);
    console.timeEnd('[ATTENDANCE_FIRESTORE_WRITE]');

    console.log('[ATTENDANCE_SAVE_END]', { docId });
    console.timeEnd('[ATTENDANCE_SAVE_TOTAL]');

    const logDetail = checkoutCalc.isEarlyCheckout
      ? `PULANG TERLALU CEPAT (${checkoutCalc.earlyCheckoutMinutes} menit sebelum batas ${checkoutCalc.earliestAllowedTime} WIB, Jadwal: ${daySched.checkOutTime}) [EARLY_CHECKOUT]`
      : `NORMAL / TEPAT WAKTU (Batas mulai: ${checkoutCalc.earliestAllowedTime} WIB, Jadwal: ${daySched.checkOutTime} WIB)`;

    // Non-blocking audit log
    catatAuditLog(
      currentUserId,
      currentUserName,
      'CHECK_OUT_SUCCESS',
      employeeName,
      `Absen Pulang: ${timeStr} WIB (${daySched.namaHari}), Status: ${logDetail}${distanceMeters > 0 ? `, Jarak: ${distanceMeters}m` : ''}`
    ).catch((e) => console.warn('[AUDIT_LOG_ERROR]', e));

    return { id: docId, ...existingData, ...updateData } as AttendanceRecord;
  } catch (err) {
    console.error('[ATTENDANCE_SAVE_ERROR]', err);
    handleFirestoreError(err, OperationType.UPDATE, `attendance/${docId}`);
    throw new Error('Absensi gagal disimpan. Silakan coba lagi.');
  }
}

// Subscribe today's attendance for all employees
export function subscribeTodayAttendance(
  tanggal: string,
  callback: (records: AttendanceRecord[]) => void
) {
  const q = query(collection(db, 'attendance'), where('tanggal', '==', tanggal));
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AttendanceRecord[];
      callback(records);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendance');
    }
  );
}

// Subscribe personal attendance history
export function subscribeEmployeeAttendance(
  employeeId: string,
  callback: (records: AttendanceRecord[]) => void
) {
  const q = query(
    collection(db, 'attendance'),
    where('employeeId', '==', employeeId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AttendanceRecord[];
      records.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      callback(records);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendance');
    }
  );
}

// Fetch attendance range for weekly bonus / payroll calculation
export async function getAttendanceRange(
  startDate: string,
  endDate: string,
  employeeId?: string
): Promise<AttendanceRecord[]> {
  try {
    let q = query(
      collection(db, 'attendance'),
      where('tanggal', '>=', startDate),
      where('tanggal', '<=', endDate)
    );
    const snap = await getDocs(q);
    let records = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as AttendanceRecord[];

    if (employeeId) {
      records = records.filter((r) => r.employeeId === employeeId);
    }
    return records;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'attendance');
    return [];
  }
}

// Manual override attendance by Owner
export async function overrideAttendance(
  recordId: string,
  changes: Partial<AttendanceRecord>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const ref = doc(db, 'attendance', recordId);
    const prevSnap = await getDoc(ref);
    const before = prevSnap.exists() ? prevSnap.data() : null;

    await updateDoc(ref, {
      ...changes,
      updatedAt: serverTimestamp(),
      overrideBy: currentUserId,
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'OVERRIDE_ABSENSI',
      recordId,
      `Perubahan status/jam oleh Owner`,
      before,
      changes
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `attendance/${recordId}`);
  }
}
