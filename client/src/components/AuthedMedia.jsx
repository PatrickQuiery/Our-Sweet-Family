import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

// Private media is served only by authenticated endpoints, so <img>/<video> can't
// load it directly (no auth header). These components fetch the bytes with the
// bearer token, then render them from a blob object URL. Absolute external URLs
// (e.g. seed/stock images) are rendered directly.

const isExternal = (src) => /^https?:\/\//i.test(src || '');

function useBlobUrl(src) {
  const [url, setUrl] = useState(isExternal(src) ? src : null);

  useEffect(() => {
    if (!src) { setUrl(null); return; }
    if (isExternal(src)) { setUrl(src); return; }

    let active = true;
    let objUrl;
    setUrl(null);
    api.get(src, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        objUrl = URL.createObjectURL(res.data);
        setUrl(objUrl);
      })
      .catch(() => { if (active) setUrl(null); });

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [src]);

  return url;
}

export function AuthedImage({ src, className = '', alt = '', ...props }) {
  const url = useBlobUrl(src);
  if (!url) return <div className={`${className} bg-ink/5 animate-pulse`} aria-hidden="true" />;
  return <img src={url} className={className} alt={alt} {...props} />;
}

export function AuthedVideo({ src, className = '', muted, loadingClassName, ...props }) {
  const url = useBlobUrl(src);
  const ref = useRef(null);
  // React's `muted` attribute alone is unreliable — browsers often ignore it and
  // block muted autoplay. Set the DOM property directly so autoplay is allowed.
  useEffect(() => {
    if (ref.current) ref.current.muted = !!muted;
  }, [muted, url]);
  if (!url) {
    return (
      <div className={`${loadingClassName ?? className} bg-gray-900 flex items-center justify-center`} aria-hidden="true">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/70" />
      </div>
    );
  }
  return <video ref={ref} src={url} className={className} muted={muted} {...props} />;
}
