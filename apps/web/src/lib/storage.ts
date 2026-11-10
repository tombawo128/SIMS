import { supabase } from './supabase';

const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

function validateDocument(file: File, maxBytes: number): void {
  if (!DOCUMENT_TYPES.includes(file.type)) {
    throw new Error('Upload a PDF or Word document.');
  }
  if (file.size > maxBytes) {
    throw new Error(`File must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
}

export async function uploadCv(file: File, userId: string): Promise<string> {
  validateDocument(file, 5 * 1024 * 1024);
  const path = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from('cvs').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadReport(file: File, placementId: string, userId: string): Promise<string> {
  validateDocument(file, 10 * 1024 * 1024);
  const path = `${placementId}/${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from('reports').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(bucket: 'cvs' | 'reports', path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function openDocument(bucket: 'cvs' | 'reports', path: string): Promise<void> {
  const url = await getSignedUrl(bucket, path);
  window.open(url, '_blank', 'noopener,noreferrer');
}
