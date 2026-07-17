import React, { useState, useRef, useEffect } from 'react';

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  uploaded: string;
}

const PUBLIC_BASE = 'https://audio.adrianrasmussen.com';

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const FileRow: React.FC<{ file: UploadedFile; onDelete: (key: string) => void }> = ({ file, onDelete }) => {
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isAudio = /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.key);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  };

  const copy = () => {
    navigator.clipboard.writeText(file.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/delete-file?key=${encodeURIComponent(file.key)}`, { method: 'DELETE' });
    onDelete(file.key);
  };

  return (
    <div className="bg-white border border-wood-200 px-5 py-4">
      <div className="flex items-center gap-4">
        {isAudio && (
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="w-8 h-8 flex-shrink-0 rounded-full border border-bronze-300 flex items-center justify-center text-bronze-600 hover:bg-bronze-50 transition-colors"
          >
            {playing ? (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <rect x="0" y="0" width="3" height="12" rx="1" />
                <rect x="7" y="0" width="3" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <path d="M1 1l8 5-8 5V1z" />
              </svg>
            )}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm text-wood-900 font-medium truncate">{file.key}</p>
          <p className="font-label text-[11px] text-wood-400 font-semibold mt-0.5">
            {formatSize(file.size)} · {formatDate(file.uploaded)}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={copy}
            className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold transition-colors"
          >
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          <a
            href={file.url}
            download
            className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold transition-colors"
          >
            Download
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`font-label text-[11px] uppercase tracking-[0.15em] font-semibold transition-colors ${
              confirmDelete ? 'text-red-600 hover:text-red-800' : 'text-wood-300 hover:text-red-500'
            }`}
          >
            {deleting ? 'Deleting...' : confirmDelete ? 'Confirm' : 'Delete'}
          </button>
        </div>
      </div>
      {isAudio && (
        <audio
          ref={audioRef}
          src={file.url}
          onEnded={() => setPlaying(false)}
          preload="none"
          className="hidden"
        />
      )}
    </div>
  );
};

const AdminFileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ url: string } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/upload-music')
      .then(r => r.json())
      .then(data => { if (data.ok) setExistingFiles(data.files || []); })
      .finally(() => setLoadingFiles(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !filename) setFilename(f.name.toLowerCase().replace(/\s+/g, '-'));
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

  const handleDelete = (key: string) => {
    setExistingFiles(prev => prev.filter(f => f.key !== key));
  };

  return (
    <section className="pt-12 pb-32 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-4xl text-wood-900 font-medium mb-2">Files</h1>
          <p className="font-sans text-sm text-wood-500 mb-12">
            {loadingFiles ? 'Loading...' : `${existingFiles.length} file${existingFiles.length !== 1 ? 's' : ''} in bucket`}
          </p>

          {/* Upload form */}
          <div className="bg-white border border-wood-200 p-8 mb-10">
            <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-6">Upload</h2>
            <div className="space-y-5">
              <div>
                <label className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2">File</label>
                <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-wood-300 hover:border-bronze-400 transition-colors cursor-pointer py-8 px-4 text-center">
                  <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
                  {file ? (
                    <span className="font-sans text-sm text-wood-900 font-medium">{file.name}</span>
                  ) : (
                    <>
                      <span className="font-sans text-sm text-wood-500 mb-1">Drop a file here or click to browse</span>
                      <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 font-semibold">MP3, WAV, OGG, M4A</span>
                    </>
                  )}
                </label>
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
                      onClick={() => { navigator.clipboard.writeText(uploadResult.url); }}
                      className="flex-shrink-0 font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold transition-colors"
                    >
                      Copy
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

          {/* File list */}
          {!loadingFiles && existingFiles.length > 0 && (
            <div>
              <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-4">All Files</h2>
              <div className="space-y-2">
                {existingFiles.map(f => (
                  <FileRow key={f.key} file={f} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {!loadingFiles && existingFiles.length === 0 && (
            <p className="font-sans text-sm text-wood-400 text-center py-8">No files uploaded yet.</p>
          )}
        </div>
    </section>
  );
};

export default AdminFileUpload;
