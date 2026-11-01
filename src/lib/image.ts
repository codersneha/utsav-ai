/** Client-side photo preparation: shrink before upload (faster, cheaper, private). */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1024;
/** Menus need sharper images so small prices stay readable. */
export const MENU_EDGE = 1400;

export interface PreparedImage {
  /** Base64 without the data: prefix. */
  data: string;
  mimeType: string;
}

const readAsBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ''));
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.readAsDataURL(blob);
  });

/** Validates and downsizes a photo to at most 1024px as JPEG. Throws a friendly message on bad input. */
export async function prepareImage(file: File, maxEdge = MAX_EDGE): Promise<PreparedImage> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Please choose a JPG, PNG or WebP photo.');
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That photo is too large — please use one under 15 MB.');

  if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
        if (blob) return { data: await readAsBase64(blob), mimeType: 'image/jpeg' };
      }
    } catch {
      // Fall through to sending the original if it is small enough.
    }
  }
  if (file.size > 1_000_000) throw new Error('Could not resize that photo — please try a smaller one.');
  return { data: await readAsBase64(file), mimeType: file.type };
}
