import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import TagInput from '../components/TagInput';

// Accept anything the browser reports as media, plus common extensions — iOS
// sometimes hands over a video with an empty MIME type, which the accept filter
// would otherwise silently reject.
const MEDIA_RE = /\.(mp4|mov|m4v|avi|mkv|webm|3gp|jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;
const isMediaFile = (f) =>
  (f.type || '').startsWith('image/') || (f.type || '').startsWith('video/') || MEDIA_RE.test(f.name || '');

const IS_IOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Thumb({ file }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);
  return (
    <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink/5 flex-shrink-0 flex items-center justify-center">
      {preview ? (
        <img src={preview} alt="" className="w-full h-full object-cover" />
      ) : (
        <svg className="w-7 h-7 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.876V15.5a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </div>
  );
}

let _seq = 0;
const nextId = () => `f${_seq++}_${Math.round(performance.now())}`;

export default function Upload() {
  const { user, family } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);        // { id, file }
  const [children, setChildren] = useState([]);
  const [childSel, setChildSel] = useState({});  // id -> [childId]
  const [captions, setCaptions] = useState({});  // id -> string
  const [tagSel, setTagSel] = useState({});      // id -> [tag]
  const [isClassified, setIsClassified] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState([]);
  const [preparing, setPreparing] = useState(false); // iOS exporting the selection
  const [notice, setNotice] = useState('');
  const awaitingRef = useRef(false); // picker opened, files not yet delivered
  const prepTimerRef = useRef(null);

  useEffect(() => {
    if (!family) return;
    api.get(`/children?familyId=${family.id}`).then(({ data }) => setChildren(data.children));
  }, [family]);

  const clearPreparing = () => {
    awaitingRef.current = false;
    if (prepTimerRef.current) { clearTimeout(prepTimerRef.current); prepTimerRef.current = null; }
    setPreparing(false);
  };

  // Take BOTH accepted and rejected files so an iOS video with an odd/empty MIME
  // type never gets silently dropped; keep only real media.
  const onDrop = useCallback((accepted, fileRejections) => {
    clearPreparing();
    const rejected = (fileRejections || []).map((r) => r.file).filter(Boolean);
    const all = [...accepted, ...rejected];
    const media = all.filter(isMediaFile);
    const skipped = all.length - media.length;
    if (media.length) setItems((prev) => [...prev, ...media.map((file) => ({ id: nextId(), file }))]);
    setNotice(skipped > 0 ? `${skipped} file${skipped > 1 ? 's' : ''} skipped — only photos and videos can be uploaded.` : '');
  }, []);

  // iOS prepares (exports) selected videos AFTER you tap ✓ but BEFORE the change
  // event fires — a silent gap. When the window regains focus with a pending pick
  // and no files yet, show a "preparing" indicator so it never looks frozen.
  useEffect(() => {
    const onFocus = () => {
      if (!awaitingRef.current) return;
      setPreparing(true);
      if (prepTimerRef.current) clearTimeout(prepTimerRef.current);
      // Safety: clear the hint even if the pick was cancelled. If a real export
      // runs longer, the files still appear on arrival (onDrop) regardless.
      prepTimerRef.current = setTimeout(() => { setPreparing(false); awaitingRef.current = false; }, 60000);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': [],
    },
    multiple: true,
  });

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setChildSel((p) => { const n = { ...p }; delete n[id]; return n; });
    setTagSel((p) => { const n = { ...p }; delete n[id]; return n; });
    setCaptions((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const toggleChild = (id, childId) => {
    setChildSel((prev) => {
      const cur = prev[id] || [];
      return { ...prev, [id]: cur.includes(childId) ? cur.filter((c) => c !== childId) : [...cur, childId] };
    });
  };

  const allHave = (childId) => items.length > 0 && items.every((i) => (childSel[i.id] || []).includes(childId));
  const applyToAll = (childId) => {
    const add = !allHave(childId);
    setChildSel((prev) => {
      const n = { ...prev };
      for (const i of items) {
        const cur = n[i.id] || [];
        n[i.id] = add ? (cur.includes(childId) ? cur : [...cur, childId]) : cur.filter((c) => c !== childId);
      }
      return n;
    });
  };

  const handleUpload = async () => {
    if (items.length === 0) return;
    setUploading(true);
    setErrors({});
    const okIds = [];

    for (const { id, file } of items) {
      if (done.includes(id)) continue;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('familyId', family.id);
      // Fallback "date taken" for files without EXIF (screenshots, exports): the
      // file's own modified time. EXIF still wins server-side when present.
      if (file.lastModified) fd.append('fileLastModified', String(file.lastModified));
      const cids = childSel[id] || [];
      if (cids.length) fd.append('childIds', JSON.stringify(cids));
      const cap = (captions[id] || '').trim();
      if (cap) fd.append('caption', cap);
      const tgs = tagSel[id] || [];
      if (tgs.length) fd.append('tags', JSON.stringify(tgs));
      if (isClassified) fd.append('isClassified', 'true');

      try {
        setProgress((p) => ({ ...p, [id]: 0 }));
        await api.post('/memories', fd, {
          onUploadProgress: (e) => setProgress((p) => ({ ...p, [id]: Math.round((e.loaded * 100) / e.total) })),
        });
        okIds.push(id);
        setDone((prev) => [...prev, id]);
      } catch (err) {
        setErrors((prev) => ({ ...prev, [id]: err.response?.data?.error || 'Upload failed' }));
      }
    }

    setUploading(false);
    if (okIds.length > 0) setTimeout(() => navigate('/dashboard'), 1500);
  };

  if (!family) {
    return <div className="text-center py-20"><p className="text-ink-muted">Please set up your family first.</p></div>;
  }

  const allDone = items.length > 0 && items.every((i) => done.includes(i.id));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-6">Upload memories</h1>

      {preparing && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
          <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-ink">Preparing your selection…</p>
            <p className="text-xs text-ink-muted">Videos from an iPhone can take a moment to load in — hang tight.</p>
          </div>
        </div>
      )}
      {notice && <p className="text-sm text-amber-600 mb-4">{notice}</p>}

      <div
        {...getRootProps({ onClick: () => { awaitingRef.current = true; } })}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive ? 'border-brand-400 bg-brand-50' : 'border-ink-muted/30 bg-paper hover:border-brand-300 hover:bg-brand-50/30'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">📁</div>
        {isDragActive ? (
          <p className="text-brand-600 font-semibold">Drop files here...</p>
        ) : (
          <>
            <p className="font-semibold text-ink-soft mb-1">Drag & drop photos or videos</p>
            <p className="text-sm text-ink-muted">or click to browse your files</p>
            <p className="text-xs text-ink-muted mt-2">JPG, PNG, GIF, WebP, MP4, MOV, AVI, MKV — up to 500MB per file</p>
            <p className="text-xs text-ink-muted/80 mt-1">On iPhone, large videos take a moment to appear after you tap ✓.</p>
          </>
        )}
      </div>

      {IS_IOS && (
        <div className="-mt-3 mb-6 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 4H7a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3zm-5 15a1 1 0 110-2 1 1 0 010 2zm4-4H8V7h8v8z" /></svg>
          <p className="text-xs text-ink-soft">
            Uploading big videos from your iPhone? The <span className="font-semibold">Our Sweet Family app</span> is much faster — it skips Safari's video-prep step that makes the picker feel slow here.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {children.length > 0 && items.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm text-ink-muted mr-1">Tag all children:</span>
              {children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyToAll(c.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    allHave(c.id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-muted/30 text-ink-soft hover:border-brand-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {items.map(({ id, file }) => (
              <div key={id} className="card p-3 flex gap-3 items-start">
                <Thumb file={file} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink truncate">{file.name}</p>
                    {!done.includes(id) && !uploading && (
                      <button onClick={() => removeItem(id)} className="text-ink-muted hover:text-red-500 text-xs flex-shrink-0">Remove</button>
                    )}
                  </div>

                  {children.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {children.map((c) => {
                        const on = (childSel[id] || []).includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleChild(id, c.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              on ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-muted/30 text-ink-muted hover:border-brand-300'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <input
                    type="text"
                    value={captions[id] || ''}
                    onChange={(e) => setCaptions((p) => ({ ...p, [id]: e.target.value }))}
                    placeholder="Caption for this file…"
                    className="w-full text-sm bg-surface text-ink placeholder:text-ink-muted border border-ink/5 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent"
                  />

                  <TagInput value={tagSel[id] || []} onChange={(t) => setTagSel((p) => ({ ...p, [id]: t }))} />

                  {progress[id] !== undefined && !done.includes(id) && !errors[id] && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-ink-soft mb-1">
                        <span className="font-medium">{progress[id] < 100 ? 'Uploading…' : 'Processing…'}</span>
                        <span className="tabular-nums">{progress[id]}%</span>
                      </div>
                      <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progress[id] < 100 ? 'bg-brand-500' : 'bg-brand-400 animate-pulse'}`}
                          style={{ width: `${progress[id]}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {errors[id] && <p className="text-xs text-red-500">{errors[id]}</p>}
                  {done.includes(id) && <p className="text-xs text-green-600 font-medium">✓ Uploaded</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6 space-y-5">
            {user?.plan === 'premium' && user?.role === 'owner' && (
              <div className="flex items-center gap-3">
                <input type="checkbox" id="classified" checked={isClassified} onChange={(e) => setIsClassified(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <label htmlFor="classified" className="text-sm text-ink-soft">
                  <span className="font-medium">Classified</span>
                  <span className="text-ink-muted"> — visible to parents only (hides from loved ones)</span>
                </label>
              </div>
            )}

            <button onClick={handleUpload} disabled={uploading || allDone} className="btn-primary w-full py-3 text-base">
              {allDone
                ? '✓ All uploaded! Redirecting...'
                : uploading
                ? `Uploading ${items.length} file${items.length !== 1 ? 's' : ''}...`
                : `Upload ${items.length} file${items.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
