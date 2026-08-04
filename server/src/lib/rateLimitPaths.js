// Read-only media streaming endpoints. A photo/video feed legitimately makes
// many of these requests (one per rendered image), so they must NOT count
// against the global API rate limiter — otherwise loading a feed self-exhausts
// the budget and every subsequent call 429s.
//
// `path` is relative to the `/api` mount (Express strips the mount prefix inside
// `app.use('/api', ...)` middleware), e.g. `/memories/<id>/thumb`.
const MEDIA_STREAM_RE = /^\/memories\/[^/]+\/(file|thumb)$/;

function isMediaStreamPath(path) {
  return MEDIA_STREAM_RE.test(path);
}

module.exports = { isMediaStreamPath };
