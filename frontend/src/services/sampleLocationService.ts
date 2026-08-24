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
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SampleLocation, AffiliateSample } from '../types';
import { catatAuditLog } from './auditService';
import { SAMPLES_COLLECTION } from './sampleService';

export const SAMPLE_LOCATIONS_COLLECTION = 'sampleLocations';

// 1. Subscribe to Sample Locations in Realtime
export function subscribeSampleLocations(
  callback?: (locations: SampleLocation[]) => void
) {
  const q = query(collection(db, SAMPLE_LOCATIONS_COLLECTION));

  return onSnapshot(
    q,
    (snapshot) => {
      const locations = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        locationId: docSnap.id,
        ...docSnap.data(),
      })) as SampleLocation[];

      // Sort by category then kodeLokasi
      locations.sort((a, b) => {
        const catCompare = (a.kategori || '').localeCompare(b.kategori || '');
        if (catCompare !== 0) return catCompare;
        return (a.kodeLokasi || '').localeCompare(b.kodeLokasi || '');
      });

      if (callback) callback(locations);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, SAMPLE_LOCATIONS_COLLECTION);
    }
  );
}

// 2. Fetch all locations snapshot (one-time)
export async function getSampleLocations(): Promise<SampleLocation[]> {
  try {
    const snap = await getDocs(collection(db, SAMPLE_LOCATIONS_COLLECTION));
    const locations = snap.docs.map((d) => ({
      id: d.id,
      locationId: d.id,
      ...d.data(),
    })) as SampleLocation[];
    return locations;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, SAMPLE_LOCATIONS_COLLECTION);
    return [];
  }
}

// 3. Create Sample Location
export async function createSampleLocation(
  data: Omit<SampleLocation, 'id' | 'locationId' | 'createdAt' | 'updatedAt'>,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  const cleanedKode = (data.kodeLokasi || '').trim().toUpperCase();
  const cleanedNama = (data.namaLokasi || '').trim();
  const cleanedKategori = (data.kategori || 'Umum').trim();
  const cleanedTipe = (data.tipeLokasi || 'RAK').trim().toUpperCase();

  if (!cleanedKode) {
    throw new Error('Kode Lokasi wajib diisi (contoh: CELANA-A).');
  }
  if (!cleanedNama) {
    throw new Error('Nama Lokasi wajib diisi (contoh: Rak Celana A).');
  }

  // Check unique kodeLokasi
  const allLocations = await getSampleLocations();
  const duplicate = allLocations.find(
    (loc) => loc.kodeLokasi?.trim().toUpperCase() === cleanedKode
  );
  if (duplicate) {
    throw new Error(`Kode Lokasi "${cleanedKode}" sudah digunakan oleh "${duplicate.namaLokasi}". Harap gunakan kode unik.`);
  }

  const payload: any = {
    kodeLokasi: cleanedKode,
    namaLokasi: cleanedNama,
    kategori: cleanedKategori,
    tipeLokasi: cleanedTipe,
    aktif: data.aktif !== undefined ? data.aktif : true,
    notes: data.notes || '',
    createdBy: currentUserId,
    createdByName: currentUserName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, SAMPLE_LOCATIONS_COLLECTION), payload);
    const locId = docRef.id;

    catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_LOCATION_CREATED',
      `Lokasi: ${cleanedKode} (${cleanedNama})`,
      `Kategori: ${cleanedKategori}, Tipe: ${cleanedTipe}, ID: ${locId}`
    ).catch((e) => console.warn('Audit error:', e));

    return locId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SAMPLE_LOCATIONS_COLLECTION);
    throw error;
  }
}

// 4. Update Sample Location
export async function updateSampleLocation(
  id: string,
  currentLocation: SampleLocation,
  updates: Partial<SampleLocation>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const cleanedKode = updates.kodeLokasi !== undefined
    ? updates.kodeLokasi.trim().toUpperCase()
    : currentLocation.kodeLokasi;
  const cleanedNama = updates.namaLokasi !== undefined
    ? updates.namaLokasi.trim()
    : currentLocation.namaLokasi;
  const cleanedKategori = updates.kategori !== undefined
    ? updates.kategori.trim()
    : currentLocation.kategori;
  const cleanedTipe = updates.tipeLokasi !== undefined
    ? updates.tipeLokasi.trim().toUpperCase()
    : currentLocation.tipeLokasi;

  if (cleanedKode !== currentLocation.kodeLokasi) {
    const allLocations = await getSampleLocations();
    const duplicate = allLocations.find(
      (loc) => loc.id !== id && loc.kodeLokasi?.trim().toUpperCase() === cleanedKode
    );
    if (duplicate) {
      throw new Error(`Kode Lokasi "${cleanedKode}" sudah digunakan oleh "${duplicate.namaLokasi}".`);
    }
  }

  const payload: any = {
    ...updates,
    kodeLokasi: cleanedKode,
    namaLokasi: cleanedNama,
    kategori: cleanedKategori,
    tipeLokasi: cleanedTipe,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
    updatedByName: currentUserName,
  };

  try {
    const docRef = doc(db, SAMPLE_LOCATIONS_COLLECTION, id);
    await updateDoc(docRef, payload);

    // If kodeLokasi or namaLokasi changed, sync affected samples
    if (
      cleanedKode !== currentLocation.kodeLokasi ||
      cleanedNama !== currentLocation.namaLokasi
    ) {
      try {
        const samplesSnap = await getDocs(
          query(collection(db, SAMPLES_COLLECTION), where('locationId', '==', id))
        );
        if (!samplesSnap.empty) {
          const batch = writeBatch(db);
          samplesSnap.docs.forEach((sDoc) => {
            batch.update(sDoc.ref, {
              locationCode: cleanedKode,
              locationName: cleanedNama,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
      } catch (syncErr) {
        console.warn('Sync location to samples notice:', syncErr);
      }
    }

    catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_LOCATION_UPDATED',
      `Lokasi: ${cleanedKode} (${cleanedNama})`,
      `Update lokasi ID ${id}. Aktif: ${payload.aktif ?? currentLocation.aktif}`
    ).catch((e) => console.warn('Audit error:', e));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SAMPLE_LOCATIONS_COLLECTION}/${id}`);
    throw error;
  }
}

// 5. Delete Sample Location
export async function deleteSampleLocation(
  id: string,
  locationName: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    // Check if any samples are currently assigned to this location
    const samplesSnap = await getDocs(
      query(collection(db, SAMPLES_COLLECTION), where('locationId', '==', id))
    );
    if (!samplesSnap.empty) {
      throw new Error(`Lokasi ini tidak dapat dihapus karena masih digunakan oleh ${samplesSnap.size} sampel produk. Harap pindahkan sampel ke lokasi lain terlebih dahulu.`);
    }

    const docRef = doc(db, SAMPLE_LOCATIONS_COLLECTION, id);
    await deleteDoc(docRef);

    catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_LOCATION_DELETED',
      `Lokasi: ${locationName}`,
      `ID: ${id} dihapus dari master penataan lokasi`
    ).catch((e) => console.warn('Audit error:', e));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SAMPLE_LOCATIONS_COLLECTION}/${id}`);
    throw error;
  }
}

// 6. Assign or Reassign Sample to Location
export async function assignSampleLocation(
  sampleId: string,
  sampleName: string,
  location: { locationId: string; locationCode: string; locationName: string } | null,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, SAMPLES_COLLECTION, sampleId);
    const updates: any = {
      locationId: location ? location.locationId : null,
      locationCode: location ? location.locationCode : null,
      locationName: location ? location.locationName : null,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    await updateDoc(docRef, updates);

    const logText = location
      ? `Ditempatkan di lokasi: ${location.locationCode} (${location.locationName})`
      : 'Lokasi diubah menjadi: BELUM DITATA';

    catatAuditLog(
      currentUserId,
      currentUserName,
      'SAMPLE_LOCATION_ASSIGNED',
      `Sampel: ${sampleName}`,
      logText
    ).catch((e) => console.warn('Audit error:', e));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SAMPLES_COLLECTION}/${sampleId}`);
    throw error;
  }
}

// 7. Batch Import Locations from CSV
export interface ImportResult {
  successCount: number;
  failedCount: number;
  errors: Array<{ row: number; kode: string; reason: string }>;
}

export async function importSampleLocationsCSV(
  csvText: string,
  currentUserId: string,
  currentUserName: string
): Promise<ImportResult> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('File CSV kosong atau tidak memiliki data.');
  }

  // Fetch existing locations for duplicate verification
  const existingLocations = await getSampleLocations();
  const existingCodeMap = new Map<string, SampleLocation>();
  existingLocations.forEach((loc) => {
    if (loc.kodeLokasi) {
      existingCodeMap.set(loc.kodeLokasi.trim().toUpperCase(), loc);
    }
  });

  const seenInBatch = new Set<string>();
  const result: ImportResult = {
    successCount: 0,
    failedCount: 0,
    errors: [],
  };

  // Check if first line is header
  let startIndex = 0;
  const firstLineCols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  if (
    firstLineCols[0].includes('kodelokasi') ||
    firstLineCols[0].includes('kode') ||
    firstLineCols[0].includes('code')
  ) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const rowNumber = i + 1;
    const line = lines[i];
    
    // Parse CSV line handling potential quotes
    const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const kodeLokasi = (cols[0] || '').toUpperCase();
    const namaLokasi = cols[1] || '';
    const kategori = cols[2] || 'Umum';
    const tipeLokasi = (cols[3] || 'RAK').toUpperCase();

    if (!kodeLokasi) {
      result.failedCount++;
      result.errors.push({ row: rowNumber, kode: '(Kosong)', reason: 'Kode Lokasi wajib diisi.' });
      continue;
    }

    if (!namaLokasi) {
      result.failedCount++;
      result.errors.push({ row: rowNumber, kode: kodeLokasi, reason: 'Nama Lokasi wajib diisi.' });
      continue;
    }

    if (seenInBatch.has(kodeLokasi)) {
      result.failedCount++;
      result.errors.push({ row: rowNumber, kode: kodeLokasi, reason: 'Duplikasi kode dalam file CSV yang sama.' });
      continue;
    }

    seenInBatch.add(kodeLokasi);

    try {
      const existing = existingCodeMap.get(kodeLokasi);
      if (existing && existing.id) {
        // Safe UPDATE existing location
        const docRef = doc(db, SAMPLE_LOCATIONS_COLLECTION, existing.id);
        await updateDoc(docRef, {
          namaLokasi,
          kategori,
          tipeLokasi,
          aktif: true,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserId,
          updatedByName: currentUserName,
        });
      } else {
        // Safe ADD new location
        await addDoc(collection(db, SAMPLE_LOCATIONS_COLLECTION), {
          kodeLokasi,
          namaLokasi,
          kategori,
          tipeLokasi,
          aktif: true,
          notes: 'Imported via CSV',
          createdBy: currentUserId,
          createdByName: currentUserName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      result.successCount++;
    } catch (err: any) {
      result.failedCount++;
      result.errors.push({ row: rowNumber, kode: kodeLokasi, reason: err.message || 'Gagal menyimpan ke database' });
    }
  }

  catatAuditLog(
    currentUserId,
    currentUserName,
    'SAMPLE_LOCATION_IMPORT_CSV',
    'Import Penataan Lokasi',
    `Hasil Import: ${result.successCount} berhasil, ${result.failedCount} gagal.`
  ).catch((e) => console.warn('Audit error:', e));

  return result;
}
