const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';

async function uploadFile(buffer, originalName, mimeType, folder = 'memories') {
  if (STORAGE_PROVIDER === 's3') {
    return uploadToS3(buffer, originalName, mimeType, folder);
  }
  return uploadToLocal(buffer, originalName, folder);
}

async function uploadToLocal(buffer, originalName, folder) {
  const ext = path.extname(originalName);
  const filename = `${uuidv4()}${ext}`;
  const dir = path.join(__dirname, '../../uploads', folder);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);

  const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/uploads/${folder}/${filename}`;
}

async function uploadToS3(buffer, originalName, mimeType, folder) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { v4: uuidv4 } = require('uuid');

  const s3Config = {
    region: process.env.AWS_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  };
  if (process.env.AWS_ENDPOINT) {
    s3Config.endpoint = process.env.AWS_ENDPOINT;
    s3Config.forcePathStyle = true;
  }

  const s3 = new S3Client(s3Config);

  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));

  const baseUrl = process.env.AWS_PUBLIC_URL
    || `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

/**
 * Best-effort delete of a previously uploaded file. Never throws — a failed
 * cleanup should not fail the user-facing operation (the DB row is already gone).
 * Safely ignores external URLs (e.g. seed images) that aren't ours.
 */
async function deleteFile(fileUrl) {
  if (!fileUrl) return;
  try {
    if (STORAGE_PROVIDER === 's3') {
      const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const key = new URL(fileUrl).pathname.replace(/^\//, '');
      const s3Config = {
        region: process.env.AWS_REGION || 'auto',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_KEY,
        },
      };
      if (process.env.AWS_ENDPOINT) {
        s3Config.endpoint = process.env.AWS_ENDPOINT;
        s3Config.forcePathStyle = true;
      }
      const s3 = new S3Client(s3Config);
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: key }));
    } else {
      const marker = '/uploads/';
      const idx = fileUrl.indexOf(marker);
      if (idx === -1) return; // not a locally-stored file
      const rel = fileUrl.slice(idx + marker.length);
      const filepath = path.join(__dirname, '../../uploads', rel);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
  } catch (e) {
    console.error('deleteFile failed (ignored):', e.message);
  }
}

module.exports = { uploadFile, deleteFile };
