import { supabase } from '../lib/supabase';

// Helper for lightweight local image compression using Canvas
export async function compressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.82): Promise<Blob | File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        }, file.type, quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// System Error Logging Auto-Register
export async function logSystemError(source: string, message: string, stackTrace = '', userId?: string): Promise<void> {
  try {
    console.warn(`[logSystemError] Source: ${source} | Message: ${message}`);
    if (!supabase) return;

    // Resolve active session user ID if not provided
    let activeUid = userId;
    if (!activeUid) {
      const { data } = await supabase.auth.getSession();
      activeUid = data?.session?.user?.id;
    }

    const { error } = await supabase.from('system_errors').insert([{
      source,
      error_message: message,
      stack_trace: stackTrace || new Error().stack || '',
      user_id: activeUid || null,
      fixed: false
    }]);

    if (error) {
      console.error('[logSystemError] Failed to log error to database:', error);
    }
  } catch (err) {
    console.error('[logSystemError] Logging method crash:', err);
  }
}

// Unified XMLHttpRequest-based upload with progress updates
export function uploadWithProgress(
  bucket: string,
  filePath: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const supabaseUrl = (supabase as any)?.supabaseUrl || (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = (supabase as any)?.supabaseKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'undefined' || supabaseAnonKey === 'undefined') {
      const errMsg = "Supabase credentials not configured.";
      logSystemError('storageService.uploadWithProgress', errMsg);
      reject(new Error(errMsg));
      return;
    }

    const xhr = new XMLHttpRequest();
    const url = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

    xhr.open("POST", url, true);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    
    // Attempt to inject user authorization token if present, fallback to anon
    supabase?.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token || supabaseAnonKey;
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(Math.round(percentComplete));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          resolve(publicUrlData.publicUrl);
        } else {
          const errorMsg = `Upload failed with status ${xhr.status}: ${xhr.statusText}`;
          logSystemError(`storageService.${bucket}Upload`, errorMsg, xhr.responseText);
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        const errorMsg = "Network error during upload.";
        logSystemError(`storageService.${bucket}Upload`, errorMsg);
        reject(new Error(errorMsg));
      };

      xhr.send(file);
    }).catch(err => {
      logSystemError(`storageService.${bucket}Upload`, `Auth session retrieval error: ${err.message}`, err.stack);
      reject(err);
    });
  });
}

/**
 * Avatar Upload
 * - Compresses images before upload
 * - Limit: 5MB
 * - Enforces path: avatars/{user_id}/avatar_{timestamp}.ext
 */
export async function avatarUpload(
  file: File,
  userId: string,
  onProgress?: (p: number) => void
): Promise<string> {
  // 1. File Type check
  if (!file.type.startsWith('image/')) {
    const err = 'Invalid file type. Only images are allowed for avatars.';
    await logSystemError('avatarUpload', err, '', userId);
    throw new Error(err);
  }

  // 2. File Size check (limit: 5MB)
  const limit = 5 * 1024 * 1024;
  if (file.size > limit) {
    const err = 'Image size exceeds the 5MB limit.';
    await logSystemError('avatarUpload', err, '', userId);
    throw new Error(err);
  }

  try {
    // 3. Compression
    const compressedFile = await compressImage(file, 800, 800, 0.75);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;

    return await uploadWithProgress('avatars', filePath, compressedFile, onProgress);
  } catch (error: any) {
    await logSystemError('avatarUpload', error.message || String(error), error.stack, userId);
    throw error;
  }
}

/**
 * Reel Upload
 * - Limit: 50MB
 * - Supported: video/*, image/*
 * - Enforces path: reels/{user_id}/reel_{timestamp}.ext
 */
export async function reelUpload(
  file: File,
  userId: string,
  onProgress?: (p: number) => void
): Promise<string> {
  // 1. Type check
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    const err = 'Invalid file type. Only videos or images (thumbnails) are allowed for reels.';
    await logSystemError('reelUpload', err, '', userId);
    throw new Error(err);
  }

  // 2. Size check (limit: 50MB)
  const limit = 50 * 1024 * 1024;
  if (file.size > limit) {
    const err = 'File exceeds the 50MB reels limit.';
    await logSystemError('reelUpload', err, '', userId);
    throw new Error(err);
  }

  try {
    let finalFile: File | Blob = file;
    if (isImage) {
      finalFile = await compressImage(file, 1280, 720, 0.8);
    }
    const fileExt = file.name.split('.').pop() || (isImage ? 'jpg' : 'mp4');
    const filePath = `${userId}/reel_${Date.now()}.${fileExt}`;

    return await uploadWithProgress('reels', filePath, finalFile, onProgress);
  } catch (error: any) {
    await logSystemError('reelUpload', error.message || String(error), error.stack, userId);
    throw error;
  }
}

/**
 * Place Image Upload (City Guide)
 * - Compresses images
 * - Limit: 10MB
 * - Enforces path: places/{place_id_or_admin}/{timestamp}.ext
 */
export async function placeImageUpload(
  file: File,
  placeId: string,
  userId: string,
  onProgress?: (p: number) => void
): Promise<string> {
  // 1. Type check
  if (!file.type.startsWith('image/')) {
    const err = 'Only images are allowed for City Guide places.';
    await logSystemError('placeImageUpload', err, '', userId);
    throw new Error(err);
  }

  // 2. Size check (limit: 10MB)
  const limit = 10 * 1024 * 1024;
  if (file.size > limit) {
    const err = 'Image size exceeds the 10MB limit.';
    await logSystemError('placeImageUpload', err, '', userId);
    throw new Error(err);
  }

  try {
    const compressedFile = await compressImage(file, 1600, 1200, 0.85);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${placeId}/place_${Date.now()}.${fileExt}`;

    return await uploadWithProgress('places', filePath, compressedFile, onProgress);
  } catch (error: any) {
    await logSystemError('placeImageUpload', error.message || String(error), error.stack, userId);
    throw error;
  }
}
