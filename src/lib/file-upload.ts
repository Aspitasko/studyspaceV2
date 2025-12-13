import { supabase } from '@/integrations/supabase/client';

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB for avatars

interface UploadResult {
  success: boolean;
  path?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  error?: string;
}

/**
 * Upload an avatar image to Supabase Storage
 * @param file - Image file to upload
 * @param userId - User ID for organizing files
 * @returns Upload result with path or error
 */
export const uploadAvatar = async (
  file: File,
  userId: string
): Promise<UploadResult> => {
  try {
    // Validate file size (5MB max for avatars)
    if (file.size > MAX_AVATAR_SIZE) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: 'Avatar size exceeds 5MB limit',
      };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: 'Only JPEG, PNG, WebP, and GIF images are allowed',
      };
    }

    // Create a unique file path
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `avatar-${timestamp}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Replace existing avatar
      });

    if (error) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: error.message,
      };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return {
      success: true,
      path: publicUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };
  } catch (error) {
    return {
      success: false,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Delete an avatar from Supabase Storage
 * @param userId - User ID
 * @returns Success or error
 */
export const deleteAvatar = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // List all files in user's avatar folder
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list(userId);

    if (listError) {
      return { success: false, error: listError.message };
    }

    if (!files || files.length === 0) {
      return { success: true }; // No avatar to delete
    }

    // Delete all avatar files
    const filePaths = files.map(file => `${userId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove(filePaths);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Upload a file to Supabase Storage
 * @param file - File to upload
 * @param bucket - Storage bucket name ('note-attachments' or 'task-attachments')
 * @param userId - User ID for organizing files
 * @returns Upload result with path or error
 */
export const uploadFile = async (
  file: File,
  bucket: 'note-attachments' | 'task-attachments',
  userId: string
): Promise<UploadResult> => {
  try {
    // Validate file size (10MB max)
    if (file.size > MAX_UPLOAD_SIZE) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: 'File size exceeds 10MB limit',
      };
    }

    // Create a unique file path
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: error.message,
      };
    }

    return {
      success: true,
      path: data?.path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };
  } catch (error) {
    return {
      success: false,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Delete a file from Supabase Storage
 * @param bucket - Storage bucket name
 * @param filePath - File path to delete
 * @returns Success or error
 */
export const deleteFile = async (
  bucket: 'note-attachments' | 'task-attachments',
  filePath: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Get a public URL for a file
 * @param bucket - Storage bucket name
 * @param filePath - File path
 * @returns Public URL
 */
export const getFileUrl = (
  bucket: 'note-attachments' | 'task-attachments',
  filePath: string
): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
};

/**
 * Format file size to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file icon based on file type
 */
export const getFileIcon = (fileType: string): string => {
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('sheet') || fileType.includes('csv')) return '📊';
  if (fileType.includes('presentation')) return '📽️';
  if (fileType.includes('video')) return '🎥';
  if (fileType.includes('audio')) return '🎵';
  if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
  return '📎';
};

/**
 * Check if file is an image
 */
export const isImageFile = (fileType: string): boolean => {
  return fileType.includes('image');
};

/**
 * Get image preview URL
 */
export const getImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
