import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FilePreview({ file, onRemove }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div className="relative group bg-gray-100 rounded-xl overflow-hidden aspect-square">
      {preview ? (
        <img src={preview} alt={file.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.876V15.5a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-gray-500 text-center truncate w-full px-2">{file.name}</p>
          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
        </div>
      )}
      <button
        onClick={() => onRemove(file)}
        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
}

export default function Upload() {
  const { user, family } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [caption, setCaption] = useState('');
  const [isClassified, setIsClassified] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState([]);

  useEffect(() => {
    if (!family) return;
    api.get(`/children?familyId=${family.id}`).then(({ data }) => setChildren(data.children));
  }, [family]);

  const onDrop = useCallback((accepted) => {
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.m4v'],
    },
    multiple: true,
  });

  const removeFile = (file) => setFiles((prev) => prev.filter((f) => f !== file));

  const toggleChild = (childId) => {
    setSelectedChildren((prev) =>
      prev.includes(childId) ? prev.filter((c) => c !== childId) : [...prev, childId]
    );
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setErrors({});
    const results = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('familyId', family.id);
      if (selectedChildren.length > 0) {
        formData.append('childIds', JSON.stringify(selectedChildren));
      }
      if (caption) formData.append('caption', caption);
      if (isClassified) formData.append('isClassified', 'true');

      try {
        setUploadProgress((p) => ({ ...p, [file.name]: 0 }));
        // Let the browser set Content-Type itself so the multipart boundary is
        // included — hardcoding 'multipart/form-data' omits the boundary, and the
        // server then silently drops every field (childIds, caption, familyId).
        await api.post('/memories', formData, {
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded * 100) / e.total);
            setUploadProgress((p) => ({ ...p, [file.name]: pct }));
          },
        });
        results.push(file.name);
        setDone((prev) => [...prev, file.name]);
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [file.name]: err.response?.data?.error || 'Upload failed',
        }));
      }
    }

    setUploading(false);
    if (results.length > 0) {
      setTimeout(() => navigate('/dashboard'), 1500);
    }
  };

  if (!family) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Please set up your family first.</p>
      </div>
    );
  }

  const allDone = files.length > 0 && files.every((f) => done.includes(f.name));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload memories</h1>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive ? 'border-brand-400 bg-brand-50' : 'border-gray-300 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/30'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">📁</div>
        {isDragActive ? (
          <p className="text-brand-600 font-semibold">Drop files here...</p>
        ) : (
          <>
            <p className="font-semibold text-gray-700 mb-1">Drag & drop photos or videos</p>
            <p className="text-sm text-gray-500">or click to browse your files</p>
            <p className="text-xs text-gray-400 mt-2">JPG, PNG, GIF, WebP, MP4, MOV, AVI, MKV — up to 500MB per file</p>
          </>
        )}
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
          {files.map((file) => (
            <div key={file.name} className="relative">
              <FilePreview file={file} onRemove={removeFile} />
              {uploadProgress[file.name] !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-xl overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${done.includes(file.name) ? 'bg-green-500' : 'bg-brand-500'}`}
                    style={{ width: `${uploadProgress[file.name]}%` }}
                  />
                </div>
              )}
              {errors[file.name] && (
                <div className="absolute inset-0 bg-red-500/70 rounded-xl flex items-center justify-center p-1">
                  <p className="text-white text-xs text-center">{errors[file.name]}</p>
                </div>
              )}
              {done.includes(file.name) && (
                <div className="absolute inset-0 bg-green-500/60 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="card p-6 space-y-5">
          {/* Tag children */}
          {children.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tag children (optional)</label>
              <div className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => toggleChild(child.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedChildren.includes(child.id)
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'border-gray-300 text-gray-600 hover:border-brand-300'
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Caption (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Add a caption for all selected files..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {/* Classified (Premium) */}
          {user?.plan === 'premium' && user?.role === 'owner' && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="classified"
                checked={isClassified}
                onChange={(e) => setIsClassified(e.target.checked)}
                className="w-4 h-4 accent-brand-500"
              />
              <label htmlFor="classified" className="text-sm text-gray-700">
                <span className="font-medium">Classified</span>
                <span className="text-gray-500"> — visible to parents only (hides from loved ones)</span>
              </label>
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={uploading || allDone}
            className="btn-primary w-full py-3 text-base"
          >
            {allDone
              ? '✓ All uploaded! Redirecting...'
              : uploading
              ? `Uploading ${files.length} file${files.length !== 1 ? 's' : ''}...`
              : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
