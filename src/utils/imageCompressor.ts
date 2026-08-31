/**
 * Image compression utility using HTML5 Canvas
 */

export interface CompressedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export function compressImageFile(
  file: File | Blob,
  maxWidth: number = 1000,
  maxHeight: number = 1000,
  quality: number = 0.8
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    let isResolved = false;

    // Safety timeout: if compression takes more than 4 seconds, fallback to reader result
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try {
          const fallbackReader = new FileReader();
          fallbackReader.onload = () => {
            const dataUrl = (fallbackReader.result as string) || '';
            resolve({
              dataUrl,
              blob: file,
              width: 800,
              height: 800,
              sizeBytes: file.size,
              mimeType: file.type || 'image/jpeg',
            });
          };
          fallbackReader.onerror = () => {
            resolve({
              dataUrl: '',
              blob: file,
              width: 0,
              height: 0,
              sizeBytes: 0,
              mimeType: 'image/jpeg',
            });
          };
          fallbackReader.readAsDataURL(file);
        } catch {
          resolve({
            dataUrl: '',
            blob: file,
            width: 0,
            height: 0,
            sizeBytes: 0,
            mimeType: 'image/jpeg',
          });
        }
      }
    }, 4000);

    const reader = new FileReader();
    reader.onerror = (err) => {
      if (!isResolved) {
        clearTimeout(timer);
        isResolved = true;
        reject(err);
      }
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        if (!isResolved) {
          clearTimeout(timer);
          isResolved = true;
          // Fallback to dataUrl directly
          const dataUrl = (e.target?.result as string) || '';
          resolve({
            dataUrl,
            blob: file,
            width: 800,
            height: 800,
            sizeBytes: file.size,
            mimeType: file.type || 'image/jpeg',
          });
        }
      };
      img.onload = () => {
        if (isResolved) return;
        clearTimeout(timer);
        isResolved = true;

        try {
          let width = img.width || 800;
          let height = img.height || 800;

          // Maintain aspect ratio
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const dataUrl = (e.target?.result as string) || '';
            resolve({
              dataUrl,
              blob: file,
              width,
              height,
              sizeBytes: file.size,
              mimeType: file.type || 'image/jpeg',
            });
            return;
          }

          // Draw image onto canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG data URL
          const mimeType = 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, quality);

          canvas.toBlob(
            (blob) => {
              const finalBlob = blob || file;
              resolve({
                dataUrl,
                blob: finalBlob,
                width,
                height,
                sizeBytes: finalBlob.size,
                mimeType,
              });
            },
            mimeType,
            quality
          );
        } catch (canvasErr) {
          const dataUrl = (e.target?.result as string) || '';
          resolve({
            dataUrl,
            blob: file,
            width: 800,
            height: 800,
            sizeBytes: file.size,
            mimeType: file.type || 'image/jpeg',
          });
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
