const { isAbsoluteUrl } = require('./storage');

/**
 * Replace stored media keys with the authenticated streaming endpoints the client
 * fetches (with its bearer token). Absolute external URLs (e.g. seed images) pass
 * through unchanged and are rendered directly by the client.
 */
function mediaRefs(memory) {
  const fileUrl = isAbsoluteUrl(memory.fileUrl)
    ? memory.fileUrl
    : `/memories/${memory.id}/file`;
  let thumbnailUrl = null;
  if (memory.thumbnailUrl) {
    thumbnailUrl = isAbsoluteUrl(memory.thumbnailUrl)
      ? memory.thumbnailUrl
      : `/memories/${memory.id}/thumb`;
  }
  return { ...memory, fileUrl, thumbnailUrl };
}

module.exports = { mediaRefs };
