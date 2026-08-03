# Private Media Access — Design

_2026-08-03 · Our Sweet Family_

## Problem

Uploaded media is served with **no access control**:
- Local: `express.static('/uploads')` serves every file to anyone with the URL.
- S3/public bucket: the stored public URL is directly fetchable.

The API enforces per-child/classified access, but the raw file URLs bypass it —
anyone with (or who guesses) a URL can download any photo, including classified /
per-child-restricted media. This is the top data-exposure risk for a privacy app.

## Approach (confirmed with owner): authenticated blob fetch

`<img>`/`<video>` can't send auth headers, so the client fetches each media file
with its bearer token via JS and renders the result as a blob object URL. Media is
served only by an authenticated endpoint that re-runs the memory access check.

Rejected alternative: short-lived signed URLs (simpler, but a signed URL works for
anyone until expiry — the owner chose strict per-request auth).

## Server

1. **`storage.uploadFile` returns an opaque key** (`memories/<uuid>.jpg`,
   `thumbnails/<uuid>_thumb.jpg`) instead of a public URL. The DB stores keys.
2. **`storage.readFile(key)` → `{ stream, contentType }`**
   - local: `fs.createReadStream` + content-type from the key's extension.
   - s3: `GetObjectCommand` → `Body` stream + `ContentType`.
   - content-type map: jpg/jpeg→image/jpeg, png→image/png, gif→image/gif,
     webp→image/webp, mp4/m4v→video/mp4, mov→video/quicktime, avi→video/x-msvideo,
     mkv→video/x-matroska; default application/octet-stream.
3. **`storage.deleteFile(key)`** updated to delete by key (ignores absolute
   external URLs, e.g. seed images).
4. **Authenticated streaming endpoints** on the memories router:
   - `GET /api/memories/:id/file` and `GET /api/memories/:id/thumb`.
   - `authenticate` middleware → `loadAccessibleMemory(id, user)` (owner/member +
     classified + per-child). 403/404 exactly as the JSON detail endpoint.
   - Resolve the key (`memory.fileUrl` / `memory.thumbnailUrl`). If the stored value
     is an absolute `http(s)` URL (legacy/external) → 302 redirect to it. Otherwise
     `storage.readFile(key)` and pipe with `Content-Type` + `Cache-Control: private, max-age=3600`.
   - `/thumb` with no thumbnail → fall back to the file key.
5. **Remove `app.use('/uploads', express.static(...))`** from `app.js`. The uploads
   dir is still created for local writes; it's just no longer publicly served.
6. **Enrich memory responses** (list, detail, reels, upload) via a shared helper
   `mediaRefs(memory)`:
   - `fileUrl`: absolute external URL → unchanged; else → `/memories/<id>/file`.
   - `thumbnailUrl`: absolute external → unchanged; a key → `/memories/<id>/thumb`;
     null → null.
   Paths are relative to the axios `/api` base (client calls `api.get(path, {responseType:'blob'})`).

## Client

7. **`AuthedImage` / `AuthedVideo`** (new `components/AuthedMedia.jsx`):
   - absolute `http(s)` src → render directly (external stock images).
   - otherwise → `api.get(src, { responseType: 'blob' })` → `URL.createObjectURL`;
     show a pulse placeholder until loaded; `revokeObjectURL` + abort on unmount/src change.
8. Replace raw `<img>`/`<video>` for memory media in `MemoryCard`, `MemoryDetail`,
   and `Reels` with these. `Landing.jsx` (hardcoded marketing Unsplash) stays as-is.

## Security outcome

Media requires a valid bearer token **and** passes the same gate as its memory
(classified + per-child). No unauthenticated static dir, no shareable/guessable
permanent URLs. In production, the S3 bucket should be **private** (server proxies
bytes; the presigned-URL path is not used in this approach).

## Known tradeoffs

- Video loads fully as a blob (no HTTP range/seek-while-downloading). Acceptable for
  now; a future enhancement can add `Range` support to the streaming endpoint and
  serve video via a tokenized URL instead of a blob.
- No cross-reload browser caching of media URLs (blobs are per-session). `Cache-Control`
  on the endpoint still lets the browser cache within a session.

## Testing (mocked Prisma + mocked storage)

- `GET /memories/:id/file` — owner → 200, pipes bytes, correct Content-Type
- non-member → 403; classified + non-owner → 403; per-child-restricted → 403
- unknown memory → 404
- `/thumb` → streams the thumbnail key; falls back to file key when no thumbnail
- external absolute URL stored → 302 redirect
- `mediaRefs` enrichment: key → `/memories/:id/file`; external URL → unchanged
