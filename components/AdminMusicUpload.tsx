import React, { useState, useRef, useEffect } from 'react';

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  uploaded: string;
}

const AdminMusicUpload: React.FC = () => {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ url: string } | null>(null);
  const [uploadError, setUploadError] = useState('');

  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [copied, setCopied] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkAuth = async () => {
    setAuthError('');
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/upload-music?secret=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (data.ok) {
        setAuthed(true);
        setExistingFiles(data.files || []);
      } else {
        setAuthError('Incorrect password.');
      }
    } catch {
      setAuthError('Could not connect to upload service.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !filename) {
      setFilename(f.name.toLowerCase().replace(/\s+/g, '-'));
    }
    setUploadResult(null);
    setUploadError('');
  };

  const handleUpload = async () => {
    if (!file || !filename) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('filename', filename);
      form.append('secret', secret);

      const res = await fetch('/api/upload-music', { method: 'POST', body: form });
      const data = await res.json();
      if (data.ok) {
        setUploadResult({ url: data.url });
        setFile(null);
        setFilename('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setExistingFiles(prev => [
          { key: filename, url: data.url, size: file.size, uploaded: new Date().toISOString() },
          ...prev,
        ]);
      } else {
        setUploadError(data.error || 'Upload failed.');
      }
    } catch {
      setUploadError('Upload failed. Check your connection.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!authed) {
    return (
      <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl text-wood-900 font-medium mb-2 text-center">Music Upload</h1>
          <p className="font-sans text-sm text-wood-500 text-center mb-10">Admin access only.</p>
          <div className="space-y-4">
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkAuth()}
              placeholder="Password"
              className="w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400"
            />
            {authError && <p className="font-sans text-sm text-red-600">{authError}</p>}
            <button
              onClick={checkAuth}
              disabled={!secret || loadingFiles}
              className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
            >
              {loadingFiles ? 'Checking...' : 'Enter'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl text-wood-900 font-medium mb-2">Music Upload</h1>
        <p className="font-sans text-sm text-wood-500 mb-12">Files upload to the <span className="font-medium text-wood-700">adrian-music</span> R2 bucket.</p>

        {/* Upload form */}
        <div className="bg-white border border-wood-200 p-8 mb-10">
          <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-6">Upload a Track</h2>
          <div className="space-y-5">
            <div>
              <label className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2">Audio File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="block w-full font-sans text-sm text-wood-700 file:mr-4 file:py-2 file:px-4 file:border file:border-wood-300 file:bg-white file:font-label file:text-xs file:uppercase file:tracking-[0.15em] file:font-semibold file:text-wood-700 hover:file:border-bronze-400 file:transition-colors cursor-pointer"
              />
            </div>
            <div>
              <label className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2">Filename in bucket</label>
              <input
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="river-poem.mp3"
                className="w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400"
              />
            </div>
            {uploadError && <p className="font-sans text-sm text-red-600">{uploadError}</p>}
            {uploadResult && (
              <div className="bg-wood-50 border border-wood-200 p-4">
                <p className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-600 font-semibold mb-2">Uploaded. Copy this URL:</p>
                <div className="flex items-center gap-3">
                  <code className="font-mono text-xs text-wood-800 break-all flex-1">{uploadResult.url}</code>
                  <button
                    onClick={() => copyToClipboard(uploadResult.url, 'result')}
                    className="flex-shrink-0 font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold transition-colors"
                  >
                    {copied === 'result' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={handleUpload}
              disabled={!file || !filename || uploading}
              className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* Existing files */}
        {existingFiles.length > 0 && (
          <div>
            <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-4">Files in Bucket</h2>
            <div className="space-y-2">
              {existingFiles.map(f => (
                <div key={f.key} className="bg-white border border-wood-200 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-wood-900 font-medium truncate">{f.key}</p>
                    <p className="font-label text-[11px] text-wood-400 font-semibold mt-0.5">{formatSize(f.size)}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(f.url, f.key)}
                    className="flex-shrink-0 font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold transition-colors"
                  >
                    {copied === f.key ? 'Copied' : 'Copy URL'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminMusicUpload;
