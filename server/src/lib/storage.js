const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';

// Media is stored under an opaque KEY (e.g. "memories/<uuid>.jpg"). Keys — not
// public URLs — are persisted, and bytes are only served through the
// access-controlled streaming endpoint. In production the S3 bucket should be
// PRIVATE; the server proxies the bytes after checking access.

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
};

function contentTypeForKey(key) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';
}

function s3Config() {
  const config = {
    region: process.env.AWS_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  };
  if (process.env.AWS_ENDPOINT) {
    config.endpoint = process.env.AWS_ENDPOINT;
    config.forcePathStyle = true;
  }
  return config;
}

// Returns the storage KEY for the uploaded file.
async function uploadFile(buffer, originalName, mimeType, folder = 'memories') {
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  if (STORAGE_PROVIDER === 's3') {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client(s3Config());
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    return key;
  }

  const dir = path.join(__dirname, '../../uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../../uploads', key), buffer);
  return key;
}

// Returns { stream, contentType } for a stored key. Caller is responsible for
// piping/handling errors (e.g. a missing local file emits 'error' on the stream).
async function readFile(key) {
  if (STORAGE_PROVIDER === 's3') {
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client(s3Config());
    const out = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: key }));
    return { stream: out.Body, contentType: out.ContentType || contentTypeForKey(key) };
  }
  const filepath = path.join(__dirname, '../../uploads', key);
  return { stream: fs.createReadStream(filepath), contentType: contentTypeForKey(key) };
}

// True for values that are already absolute URLs (legacy/external, e.g. seed
// images) rather than storage keys.
function isAbsoluteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/**
 * Best-effort delete of a stored file by key. Never throws — a failed cleanup must
 * not fail the user-facing operation. Ignores absolute external URLs (not ours).
 */
async function deleteFile(key) {
  if (!key || isAbsoluteUrl(key)) return;
  try {
    if (STORAGE_PROVIDER === 's3') {
      const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client(s3Config());
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: key }));
    } else {
      const filepath = path.join(__dirname, '../../uploads', key);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
  } catch (e) {
    console.error('deleteFile failed (ignored):', e.message);
  }
}

module.exports = { uploadFile, readFile, deleteFile, isAbsoluteUrl, contentTypeForKey };
