import { Product } from '../types';

export interface AIScanResult {
  productName: string;
  productPrice: number;
  platform: 'TikTok' | 'Shopee' | 'MANUAL';
  category: string;
  aiRecommendation: string;
  earningInfo: string;
  variantOrSize: string;
  notes: string;
  productImageBoundingBox: {
    box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000
  } | null;
  confidence: {
    productName: 'HIGH' | 'MEDIUM' | 'LOW';
    productPrice: 'HIGH' | 'MEDIUM' | 'LOW';
    platform: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

/**
 * Sends a screenshot to the server-side Gemini API endpoint /api/scan-product
 */
export async function scanProductScreenshot(file: File): Promise<AIScanResult> {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const response = await fetch('/api/scan-product', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: base64Data,
      mimeType: mimeType,
    }),
  });

  if (!response.ok) {
    let errorMsg = 'Gagal memproses screenshot dengan AI';
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Hasil analisa AI tidak valid.');
  }

  return result.data as AIScanResult;
}

/**
 * Converts File to pure base64 data string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Crops a bounding box area from the image file on an HTML5 canvas,
 * returning a new cropped JPEG File and Data URL.
 * Falls back to the original image if box is invalid or cropping fails.
 */
export async function cropProductImage(
  imageFile: File,
  boundingBox: { box_2d: [number, number, number, number] } | null
): Promise<{ file: File; previewUrl: string }> {
  if (!boundingBox || !boundingBox.box_2d || boundingBox.box_2d.length !== 4) {
    const previewUrl = URL.createObjectURL(imageFile);
    return { file: imageFile, previewUrl };
  }

  const [ymin, xmin, ymax, xmax] = boundingBox.box_2d;

  // Basic sanity check on coordinates (0..1000 scale)
  if (
    typeof ymin !== 'number' ||
    typeof xmin !== 'number' ||
    typeof ymax !== 'number' ||
    typeof xmax !== 'number' ||
    ymax <= ymin ||
    xmax <= xmin ||
    ymax <= 0 ||
    xmax <= 0
  ) {
    const previewUrl = URL.createObjectURL(imageFile);
    return { file: imageFile, previewUrl };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        // Convert normalized coordinates (0..1000) to actual pixels
        const cropX = Math.max(0, Math.floor((xmin / 1000) * naturalWidth));
        const cropY = Math.max(0, Math.floor((ymin / 1000) * naturalHeight));
        const cropW = Math.min(naturalWidth - cropX, Math.ceil(((xmax - xmin) / 1000) * naturalWidth));
        const cropH = Math.min(naturalHeight - cropY, Math.ceil(((ymax - ymin) / 1000) * naturalHeight));

        if (cropW < 20 || cropH < 20) {
          // If crop is too tiny, fallback to full image
          resolve({ file: imageFile, previewUrl: objectUrl });
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ file: imageFile, previewUrl: objectUrl });
          return;
        }

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ file: imageFile, previewUrl: objectUrl });
              return;
            }
            const croppedFileName = `cropped_${imageFile.name.replace(/\.[^/.]+$/, '')}.jpg`;
            const croppedFile = new File([blob], croppedFileName, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            resolve({ file: croppedFile, previewUrl });
          },
          'image/jpeg',
          0.9
        );
      } catch (e) {
        console.warn('Cropping canvas error, using fallback:', e);
        resolve({ file: imageFile, previewUrl: objectUrl });
      }
    };

    img.onerror = () => {
      resolve({ file: imageFile, previewUrl: objectUrl });
    };

    img.src = objectUrl;
  });
}

/**
 * Checks existing products for potential duplicates based on product name similarity or productUrl
 */
export function checkDuplicateProducts(
  nameToCheck: string,
  urlToCheck: string | undefined,
  existingProducts: Product[]
): Product[] {
  const cleanCandidate = nameToCheck.trim().toLowerCase();
  if (!cleanCandidate && !urlToCheck) return [];

  const candidateWords = cleanCandidate
    .replace(/[^\w\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return existingProducts.filter((p) => {
    // 1. Direct URL match if provided
    if (urlToCheck && urlToCheck.trim() && p.productUrl && p.productUrl.trim()) {
      if (p.productUrl.trim().toLowerCase() === urlToCheck.trim().toLowerCase()) {
        return true;
      }
    }

    const existingName = (p.productName || '').trim().toLowerCase();
    if (!existingName) return false;

    // 2. Exact or substring match
    if (existingName === cleanCandidate) return true;
    if (existingName.includes(cleanCandidate) || cleanCandidate.includes(existingName)) return true;

    // 3. Word overlap match (if at least 3 significant words match)
    if (candidateWords.length >= 3) {
      const existingWords = existingName
        .replace(/[^\w\s]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const matchingCount = candidateWords.filter((cw) => existingWords.includes(cw)).length;
      if (matchingCount >= 3 && matchingCount / candidateWords.length >= 0.6) {
        return true;
      }
    }

    return false;
  });
}
