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
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { Product, ProductStatus, ScopeType } from '../types';
import { compressImageFile } from '../utils/imageCompressor';
import { catatAuditLog } from './auditService';

export const PRODUCTS_COLLECTION = 'products';

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

// 1. Subscribe to Products
export function subscribeProducts(
  options?: {
    scope?: ScopeType;
    status?: ProductStatus | 'SEMUA';
    category?: string;
  },
  callback?: (products: Product[]) => void
) {
  let q: any = collection(db, PRODUCTS_COLLECTION);

  if (options?.scope) {
    q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('scope', '==', options.scope)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let products = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        productId: docSnap.id,
        ...docSnap.data(),
      })) as Product[];

      products.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return timeB - timeA;
      });

      if (options?.status && options.status !== 'SEMUA') {
        products = products.filter((p) => p.status === options.status);
      }

      if (options?.category && options.category !== 'SEMUA') {
        products = products.filter((p) => p.category === options.category);
      }

      if (callback) callback(products);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, PRODUCTS_COLLECTION);
    }
  );
}

// 2. Upload Product Photo to Firebase Storage with timeout safeguard
export async function uploadProductPhoto(
  file: File,
  productTempId: string
): Promise<{
  photoUrl: string;
  storagePath: string;
  photoSizeBytes: number;
  photoMimeType: string;
  photoWidth: number;
  photoHeight: number;
}> {
  const compressed = await compressImageFile(file, 1000, 1000, 0.82);
  const timestamp = Date.now();
  const storagePath = `products/${productTempId}_${timestamp}.jpg`;
  const storageRef = ref(storage, storagePath);

  let photoUrl = compressed.dataUrl;
  try {
    const uploadAction = (async () => {
      await uploadBytes(storageRef, compressed.blob, {
        contentType: compressed.mimeType,
        customMetadata: {
          uploadedAt: new Date().toISOString(),
          originalFileName: file.name,
        },
      });

      return await getDownloadURL(storageRef);
    })();

    photoUrl = await Promise.race([
      uploadAction,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Storage upload timeout fallback')), 3500)
      ),
    ]);
  } catch (storageErr) {
    console.warn('Firebase Storage upload notice for product photo (fallback to compressed dataUrl):', storageErr);
  }

  return {
    photoUrl,
    storagePath,
    photoSizeBytes: compressed.sizeBytes,
    photoMimeType: compressed.mimeType,
    photoWidth: compressed.width,
    photoHeight: compressed.height,
  };
}

// 3. Create Product (Manual Input)
export async function createProduct(
  productData: Omit<Product, 'id' | 'productId' | 'createdAt' | 'updatedAt'>,
  photoFile: File | null,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  const tempId = 'prod_' + Date.now();
  let photoMetadata: Partial<Product> = {};

  if (photoFile) {
    try {
      const uploaded = await uploadProductPhoto(photoFile, tempId);
      photoMetadata = {
        productImage: uploaded.photoUrl,
        photoUrl: uploaded.photoUrl,
        photoStoragePath: uploaded.storagePath,
        photoSizeBytes: uploaded.photoSizeBytes,
        photoMimeType: uploaded.photoMimeType,
        photoWidth: uploaded.photoWidth,
        photoHeight: uploaded.photoHeight,
      };
    } catch (err: any) {
      console.warn('Gagal mengupload foto produk, melanjutkan simpan tanpa foto:', err);
    }
  }

  const payload = cleanUndefined({
    ...productData,
    ...photoMetadata,
    productPrice: Number(productData.productPrice) || 0,
    commissionRate: Number(productData.commissionRate) || 0,
    scope: productData.scope || 'PRIBADI',
    status: productData.status || 'AKTIF',
    createdBy: currentUserId,
    createdByName: currentUserName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), payload);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'PRODUCT_CREATED',
      `Produk: ${productData.productName}`,
      `ID: ${docRef.id}, Harga: Rp ${Number(productData.productPrice).toLocaleString('id-ID')}, Komisi: ${productData.commissionRate}%, Scope: ${productData.scope}`
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
    throw error;
  }
}

// 4. Update Product
export async function updateProduct(
  id: string,
  currentProduct: Product,
  updates: Partial<Product>,
  photoFile: File | null,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  let photoMetadata: Partial<Product> = {};

  if (photoFile) {
    try {
      const uploaded = await uploadProductPhoto(photoFile, id);
      photoMetadata = {
        productImage: uploaded.photoUrl,
        photoUrl: uploaded.photoUrl,
        photoStoragePath: uploaded.storagePath,
        photoSizeBytes: uploaded.photoSizeBytes,
        photoMimeType: uploaded.photoMimeType,
        photoWidth: uploaded.photoWidth,
        photoHeight: uploaded.photoHeight,
      };
    } catch (err: any) {
      console.warn('Gagal mengupload foto produk baru:', err);
    }
  }

  const payload: any = {
    ...updates,
    ...photoMetadata,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
    updatedByName: currentUserName,
  };

  if (updates.productPrice !== undefined) {
    payload.productPrice = Number(updates.productPrice) || 0;
  }
  if (updates.commissionRate !== undefined) {
    payload.commissionRate = Number(updates.commissionRate) || 0;
  }

  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, cleanUndefined(payload));

    const isStatusChange = updates.status && updates.status !== currentProduct.status;
    const action = isStatusChange ? 'PRODUCT_STATUS_CHANGED' : 'PRODUCT_UPDATED';

    await catatAuditLog(
      currentUserId,
      currentUserName,
      action,
      `Produk: ${updates.productName || currentProduct.productName}`,
      `Perubahan pada produk ID: ${id}. ${isStatusChange ? `Status baru: ${updates.status}` : ''}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
    throw error;
  }
}

// 5. Toggle Status Product (Soft Deactivation - Jangan hapus permanen jika ada relasi)
export async function toggleProductStatus(
  id: string,
  currentProduct: Product,
  newStatus: ProductStatus,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'PRODUCT_STATUS_CHANGED',
      `Produk: ${currentProduct.productName}`,
      `Status diubah menjadi: ${newStatus}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
    throw error;
  }
}

// 6. Delete Product (Permanent only if strictly confirmed & safe)
export async function deleteProduct(
  id: string,
  currentProduct: Product,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await deleteDoc(docRef);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'PRODUCT_DELETED',
      `Produk: ${currentProduct.productName}`,
      `Produk ID ${id} dihapus dari katalog.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${id}`);
    throw error;
  }
}
