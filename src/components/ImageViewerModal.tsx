import React from 'react';
import { X, Download, Share2 } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string;
  senderName?: string;
  caption?: string | null;
  timestamp?: number;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  imageUrl,
  senderName,
  caption,
  timestamp,
  onClose
}) => {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `LAMAVI_Image_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl text-white select-none animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div>
            {senderName && <p className="text-sm font-semibold">{senderName}</p>}
            {timestamp && (
              <p className="text-xs text-white/60">
                {new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={onClose}>
        <img
          src={imageUrl}
          alt="Shared"
          className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl transition-transform"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Caption at bottom */}
      {caption && (
        <div className="p-4 bg-black/60 border-t border-white/10 text-center">
          <p className="text-sm font-light text-white/90 max-w-xl mx-auto">{caption}</p>
        </div>
      )}
    </div>
  );
};
