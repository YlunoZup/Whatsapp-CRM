import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTemplates } from '../../hooks/use-templates';
import { api } from '../../services/api';
import { cn } from '@/lib/utils';
import type { MessageTemplate } from '@whatsapp-crm/shared';

interface MessageInputProps {
  onSend: (content: string, type?: string, mediaUrl?: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

// Common WhatsApp emojis organized by category
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
  'Gestures': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '💪', '🦾', '🦿', '🦵', '🦶'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objects': ['🎉', '🎊', '🎁', '🎈', '🔥', '⭐', '✨', '💫', '🌟', '💯', '💢', '💥', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤'],
};

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = React.useState('Smileys');
  const pickerRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to close picker
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={pickerRef} className="absolute bottom-full left-0 mb-2 bg-card/95 backdrop-blur-xl rounded-xl shadow-premium border border-border/50 w-80 overflow-hidden animate-fade-up">
      {/* Category tabs */}
      <div className="flex border-b border-border/50 bg-secondary/30 px-2 py-1.5 gap-1">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg transition-all duration-200',
              activeCategory === category
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {category}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div className="p-2 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
            <button
              key={index}
              onClick={() => {
                onSelect(emoji);
              }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-accent rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type MediaType = 'image' | 'video' | 'audio' | 'document';

interface UploadResponse {
  url: string;
  type: MediaType;
  filename: string;
  size: number;
}

interface MediaPreview {
  file: File;
  url: string;
  type: MediaType;
}

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

export function MessageInput({ onSend, onTyping, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: templates } = useTemplates();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post<UploadResponse>('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onError: (error: any) => {
      setUploadError(error?.message || 'Failed to upload file. Please try again.');
      setTimeout(() => setUploadError(null), 5000);
    },
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Handle typing indicator
    if (onTyping) {
      onTyping(true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (disabled) return;

    // Send media if there's a preview
    if (mediaPreview) {
      try {
        const result = await uploadMutation.mutateAsync(mediaPreview.file);
        onSend(message.trim() || '', result.type, result.url);
        setMediaPreview(null);
        setMessage('');
        if (onTyping) onTyping(false);
      } catch (error) {
        console.error('Failed to upload media:', error);
      }
      return;
    }

    // Send text message
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
      if (onTyping) onTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = (template: MessageTemplate) => {
    setMessage(template.content);
    setShowTemplates(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (16MB max)
    if (file.size > 16 * 1024 * 1024) {
      alert('File size exceeds 16MB limit');
      return;
    }

    const type = getMediaType(file.type);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url, type });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearMediaPreview = () => {
    if (mediaPreview?.url) {
      URL.revokeObjectURL(mediaPreview.url);
    }
    setMediaPreview(null);
  };

  const canSend = !disabled && (message.trim() || mediaPreview);

  return (
    <div className="relative border-t border-border/50 bg-card/80 backdrop-blur-xl">
      {/* Template picker */}
      {showTemplates && templates && templates.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-xl border border-border/50 rounded-t-xl shadow-premium max-h-64 overflow-y-auto animate-fade-up">
          <div className="p-3 border-b border-border/50 bg-secondary/30">
            <h4 className="font-semibold text-sm text-foreground">Quick Templates</h4>
          </div>
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className="w-full text-left p-3 hover:bg-accent border-b border-border/30 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-sm text-foreground">{template.name}</div>
              <div className="text-sm text-muted-foreground truncate">{template.content}</div>
            </button>
          ))}
        </div>
      )}

      {/* Media Preview */}
      {mediaPreview && (
        <div className="p-3 border-b border-border/50 bg-secondary/30">
          <div className="relative inline-block">
            {mediaPreview.type === 'image' ? (
              <img
                src={mediaPreview.url}
                alt="Preview"
                className="max-h-32 rounded-xl shadow-sm"
              />
            ) : mediaPreview.type === 'video' ? (
              <video
                src={mediaPreview.url}
                className="max-h-32 rounded-xl shadow-sm"
                controls
              />
            ) : mediaPreview.type === 'audio' ? (
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-sm text-foreground">{mediaPreview.file.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-foreground">{mediaPreview.file.name}</span>
              </div>
            )}
            <button
              onClick={clearMediaPreview}
              className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 shadow-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
          <svg className="w-4 h-4 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-destructive">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="ml-auto p-1 text-destructive hover:bg-destructive/10 rounded"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-end space-x-2">
          {/* Emoji button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowEmoji(!showEmoji);
                setShowTemplates(false);
              }}
              className={cn(
                'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
                showEmoji
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              disabled={disabled}
              aria-label="Emoji"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all duration-200"
            disabled={disabled || uploadMutation.isPending}
            aria-label="Attach file"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
          />

          {/* Template button */}
          <button
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowEmoji(false);
            }}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
              showTemplates
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            disabled={disabled}
            aria-label="Message templates"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          </button>

          {/* Message input - premium rounded input */}
          <div className="flex-1 bg-secondary/50 border border-border rounded-2xl shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={mediaPreview ? "Add a caption..." : "Type a message"}
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-2.5 resize-none focus:outline-none rounded-2xl bg-transparent text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>

          {/* Send button - premium style */}
          <button
            onClick={handleSend}
            disabled={!canSend || uploadMutation.isPending}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
              'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            {uploadMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
