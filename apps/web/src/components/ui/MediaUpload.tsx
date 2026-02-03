import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';

interface MediaUploadProps {
  onUpload: (url: string, type: MediaType) => void;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
  disabled?: boolean;
}

export type MediaType = 'image' | 'video' | 'audio' | 'document';

interface UploadResponse {
  url: string;
  type: MediaType;
  filename: string;
  size: number;
}

const ACCEPTED_TYPES: Record<MediaType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'],
};

function getMediaType(mimeType: string): MediaType {
  if (ACCEPTED_TYPES.image.includes(mimeType)) return 'image';
  if (ACCEPTED_TYPES.video.includes(mimeType)) return 'video';
  if (ACCEPTED_TYPES.audio.includes(mimeType)) return 'audio';
  return 'document';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function MediaUpload({
  onUpload,
  accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt',
  maxSize = 16,
  className = '',
  disabled = false,
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: MediaType; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post<UploadResponse>('/uploads', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: (data) => {
      onUpload(data.url, data.type);
      setPreview(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Failed to upload file');
    },
  });

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB limit`;
    }

    // Check file type
    const allAccepted = [
      ...ACCEPTED_TYPES.image,
      ...ACCEPTED_TYPES.video,
      ...ACCEPTED_TYPES.audio,
      ...ACCEPTED_TYPES.document,
    ];

    if (!allAccepted.includes(file.type)) {
      return 'File type not supported';
    }

    return null;
  };

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const mediaType = getMediaType(file.type);

      // Create preview
      if (mediaType === 'image' || mediaType === 'video') {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview({
            url: reader.result as string,
            type: mediaType,
            name: file.name,
          });
        };
        reader.readAsDataURL(file);
      } else {
        setPreview({
          url: '',
          type: mediaType,
          name: file.name,
        });
      }

      // Upload file
      uploadMutation.mutate(file);
    },
    [maxSize, uploadMutation]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const clearPreview = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (type: MediaType) => {
    switch (type) {
      case 'image':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'audio':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-whatsapp-primary bg-whatsapp-light' : 'border-border hover:border-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-whatsapp-primary border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center">
            {preview.type === 'image' ? (
              <img
                src={preview.url}
                alt="Preview"
                className="max-h-32 max-w-full rounded-lg object-contain"
              />
            ) : preview.type === 'video' ? (
              <video
                src={preview.url}
                className="max-h-32 max-w-full rounded-lg"
                controls
              />
            ) : (
              <div className="text-muted-foreground">{getFileIcon(preview.type)}</div>
            )}
            <p className="mt-2 text-sm text-muted-foreground truncate max-w-full">
              {preview.name}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearPreview();
              }}
              className="mt-2 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-whatsapp-primary">Click to upload</span>
              {' '}or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Images, videos, audio, or documents up to {maxSize}MB
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// Compact version for inline use (e.g., in chat input)
export function MediaUploadButton({
  onUpload,
  disabled = false,
  className = '',
}: Omit<MediaUploadProps, 'accept' | 'maxSize'>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post<UploadResponse>('/uploads', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: (data) => {
      onUpload(data.url, data.type);
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadMutation.mutate(file);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className={`p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ${className}`}
        title="Attach file"
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )}
      </button>
    </>
  );
}

// Media preview component for displaying uploaded media in messages
export function MediaPreview({
  url,
  type,
  className = '',
}: {
  url: string;
  type: MediaType;
  className?: string;
}) {
  switch (type) {
    case 'image':
      return (
        <img
          src={url}
          alt="Uploaded media"
          className={`max-w-full rounded-lg ${className}`}
          loading="lazy"
        />
      );
    case 'video':
      return (
        <video
          src={url}
          controls
          className={`max-w-full rounded-lg ${className}`}
        />
      );
    case 'audio':
      return (
        <audio src={url} controls className={`w-full ${className}`} />
      );
    case 'document':
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted transition-colors ${className}`}
        >
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-foreground">View Document</span>
        </a>
      );
    default:
      return null;
  }
}
