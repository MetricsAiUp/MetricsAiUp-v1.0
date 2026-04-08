import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Upload, X, Maximize2, Trash2 } from 'lucide-react';

export default function PhotoGallery({ sessionId, workOrderId, photos = [], onPhotosChange }) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [viewing, setViewing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        await api.post('/api/photos', {
          sessionId,
          workOrderId,
          image: reader.result,
          filename: file.name,
        });
        onPhotosChange?.();
      };
      reader.readAsDataURL(file);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/photos/${id}`);
      onPhotosChange?.();
    } catch { /* ignore */ }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div>
      {/* Upload buttons */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
          style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          disabled={uploading}>
          <Upload size={14} /> {t('photos.upload')}
        </button>
        <button onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}
          disabled={uploading}>
          <Camera size={14} /> {t('photos.takePhoto')}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Camera size={24} className="mx-auto mb-1 opacity-30" />
          {t('photos.noPhotos')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square cursor-pointer"
              style={{ background: 'var(--bg-secondary)' }}>
              <img
                src={`./data/${photo.path}`}
                alt={photo.filename}
                className="w-full h-full object-cover"
                onClick={() => setViewing(photo)}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => setViewing(photo)}
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
                  <Maximize2 size={14} className="text-white" />
                </button>
                <button onClick={() => handleDelete(photo.id)}
                  className="p-1.5 rounded-full bg-red-500/50 hover:bg-red-500/70">
                  <Trash2 size={14} className="text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-screen viewer */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setViewing(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={() => setViewing(null)}>
            <X size={24} className="text-white" />
          </button>
          <img src={`./data/${viewing.path}`} alt={viewing.filename}
            className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
}
