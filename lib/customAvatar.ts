'use client';

/**
 * Custom avatar — client-side image upload + storage.
 *
 * Lets a user override their auto-generated GenerativeAvatar with
 * an image they upload. Today this lives entirely in localStorage
 * (the engineer-owned backend isn't wired for avatar storage yet);
 * once a real endpoint exists, the storage layer here flips over
 * with zero changes to consumers.
 *
 * Storage strategy:
 *   • Image is canvas-resized to 256×256 (square center-crop) and
 *     re-encoded as JPEG @ 0.85 quality before storing — typically
 *     keeps the data URL under ~50KB regardless of source size.
 *     Safe for localStorage quotas (5–10MB) + avoids the original
 *     megabyte-scale photo bloating the key.
 *   • Stored as `aegis_custom_avatar` data URL string.
 *   • A custom `aegis_custom_avatar_change` window event fires on
 *     set/remove so other components (UserAvatar everywhere across
 *     the app) re-render reactively without polling.
 *
 * Demo workspace avatars are intentionally NOT customizable —
 * they're a workspace identity, not a personal one.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aegis_custom_avatar';
const CHANGE_EVENT = 'aegis_custom_avatar_change';
/** Stored image edge length. 256px = retina-quality even at the 80px
 *  hero avatar in Settings. JPEG at this size is ~30–50KB. */
const STORED_EDGE = 256;
/** Max accepted source file size — guards against pathological inputs.
 *  Anything larger should be auto-rejected before we even decode it. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

/** Read the currently stored custom avatar. Returns null on SSR or
 *  when no override is set. */
export function getCustomAvatar(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Center-crop a File to a square, downscale to STORED_EDGE, and
 *  encode as JPEG. Returns a data URL ready for localStorage. */
async function fileToCroppedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read image.'));
      i.src = url;
    });

    // Square crop from the center — preserves the most visually
    // important region of typical portrait or landscape photos.
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - min) / 2;
    const sy = (img.naturalHeight - min) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = STORED_EDGE;
    canvas.height = STORED_EDGE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    // High-quality downscale step — browsers use a bilinear filter
    // by default which is good enough for 256px output.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, min, min, 0, 0, STORED_EDGE, STORED_EDGE);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload + persist a custom avatar. Throws on invalid file types,
 *  oversize files, or localStorage quota errors. */
export async function setCustomAvatarFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is too large. Try one under 8MB.');
  }
  const dataUrl = await fileToCroppedDataUrl(file);
  try {
    localStorage.setItem(STORAGE_KEY, dataUrl);
  } catch (err) {
    // localStorage quota — usually means too many other keys + a
    // very large source image. Re-throw with a clearer message.
    throw new Error('Could not save the image. Local storage is full.');
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return dataUrl;
}

/** Clear the custom avatar — UI falls back to the GenerativeAvatar. */
export function removeCustomAvatar(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — embedded contexts may block localStorage
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/**
 * React hook — returns the current custom avatar data URL (or null)
 * and re-renders when it changes (same tab via the custom event,
 * other tabs via the native `storage` event).
 */
export function useCustomAvatar(): string | null {
  // Start at null on first render to keep SSR + client output in
  // sync; the useEffect populates the actual value post-mount.
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    setValue(getCustomAvatar());
    const onChange = () => setValue(getCustomAvatar());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return value;
}
