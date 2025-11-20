# File Upload Setup Guide for StudySpaceV2

## Step 1: Create Storage Buckets in Supabase

### 1.1 Create the buckets via Supabase Dashboard:
1. Go to your Supabase Dashboard → Storage
2. Click "New Bucket"
3. Create two buckets with these settings:

**Bucket 1: note-attachments**
- Name: `note-attachments`
- Privacy: Public (so users can download files)
- File size limit: 50 MB (or your preference)

**Bucket 2: task-attachments**
- Name: `task-attachments`
- Privacy: Public
- File size limit: 50 MB

### 1.2 Set up Storage Policies (RLS)

For each bucket, go to Policies and add:

**For note-attachments:**
```sql
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read note attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'note-attachments' AND auth.role() = 'authenticated');

-- Allow users to upload to their own folder
CREATE POLICY "Users can upload note attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'note-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own note attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'note-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

**For task-attachments:**
```sql
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read task attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

-- Allow users to upload to their own folder
CREATE POLICY "Users can upload task attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own task attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Step 2: Run the Database Migration

Execute the SQL from `setup-file-uploads.sql` in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy and paste the contents of `setup-file-uploads.sql`
4. Run the query

This will create:
- `note_attachments` table
- `task_attachments` table
- Row Level Security policies
- Indexes for performance

## Step 3: Integration in Frontend

The file upload utilities are already set up in `src/lib/file-upload.ts`. Use them like this:

```typescript
import { uploadFile, getFileUrl, formatFileSize } from '@/lib/file-upload';

// Upload a file
const result = await uploadFile(file, 'note-attachments', userId);
if (result.success) {
  // Save result.path to your database
  console.log('File uploaded to:', result.path);
} else {
  console.error('Upload failed:', result.error);
}

// Get file URL
const url = getFileUrl('note-attachments', storagePath);

// Format file size
const size = formatFileSize(1024); // "1 KB"
```

## Step 4: Database Schema

Two new tables were created:

### note_attachments
```
- id (UUID, Primary Key)
- note_id (UUID, Foreign Key → notes.id)
- user_id (UUID, Foreign Key → profiles.id)
- file_name (TEXT) - Original file name
- file_size (INTEGER) - File size in bytes
- file_type (TEXT) - MIME type
- storage_path (TEXT) - Path in Supabase Storage
- created_at (TIMESTAMP)
```

### task_attachments
```
- id (UUID, Primary Key)
- task_id (UUID, Foreign Key → tasks.id)
- user_id (UUID, Foreign Key → profiles.id)
- file_name (TEXT) - Original file name
- file_size (INTEGER) - File size in bytes
- file_type (TEXT) - MIME type
- storage_path (TEXT) - Path in Supabase Storage
- created_at (TIMESTAMP)
```

## Step 5: Usage in Components

### In Notes.tsx:
```typescript
// When creating/updating a note with attachments
const { error: insertError } = await supabase
  .from('note_attachments')
  .insert({
    note_id: noteId,
    user_id: userId,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    storage_path: uploadResult.path,
  });
```

### In Tasks.tsx:
```typescript
// When creating/updating a task with attachments
const { error: insertError } = await supabase
  .from('task_attachments')
  .insert({
    task_id: taskId,
    user_id: userId,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    storage_path: uploadResult.path,
  });
```

## File Size Limits

- Frontend validation: 10MB max per file
- Supabase bucket config: 50MB max (adjustable)
- Adjust `maxSize` in `file-upload.ts` if needed

## Security Features

✅ User-level folder organization in storage
✅ Row Level Security on database tables
✅ Storage policies tied to user authentication
✅ File size validation
✅ Users can only access/delete their own files

## Testing

1. Create a test note/task
2. Upload a file
3. Check Supabase Storage → Files to see uploaded file
4. Check database → note_attachments table for record
5. Try downloading/accessing the file from UI

## Troubleshooting

**"Bucket doesn't exist" error:**
- Verify bucket names match exactly (case-sensitive)

**"Permission denied" error:**
- Check Storage RLS policies are set correctly
- Verify user is authenticated

**"File too large" error:**
- Increase `maxSize` in file-upload.ts or bucket limit

**Files not visible in Storage:**
- Check bucket privacy setting is "Public"
- Verify file path format is correct
