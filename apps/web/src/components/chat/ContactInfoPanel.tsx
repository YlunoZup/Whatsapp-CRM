import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Pin, Trash2, Plus, History, FileText, X, Mail, Phone, Calendar,
  Building2, MapPin, Globe, Briefcase, Edit3, Save, User, Smartphone
} from 'lucide-react';
import { useTags, useAssignTag, useRemoveTag } from '../../hooks/use-tags';
import { useUpdateContact } from '../../hooks/use-contacts';
import {
  useContactNotes,
  useCreateContactNote,
  useDeleteContactNote,
  useToggleContactNotePin,
  useContactActivity,
  type ContactNote,
  type ContactActivity,
} from '../../hooks/use-contact-notes';
import { cn } from '@/lib/utils';
import type { Contact, Tag } from '@whatsapp-crm/shared';

interface ContactInfoPanelProps {
  contact: Contact;
  onClose: () => void;
}

interface ContactMetadata {
  company?: string;
  jobTitle?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  notes?: string;
  source?: string;
  [key: string]: unknown;
}

const activityIcons: Record<string, string> = {
  created: '🆕',
  updated: '✏️',
  tagged: '🏷️',
  untagged: '🏷️',
  note_added: '📝',
  conversation_opened: '💬',
  conversation_closed: '✅',
  assigned: '👤',
  message_sent: '📤',
  message_received: '📥',
};

// Muted, monochromatic avatar colors - subtle variations of neutral/slate tones
const avatarColors = [
  'bg-slate-600',
  'bg-slate-700',
  'bg-zinc-600',
  'bg-zinc-700',
  'bg-neutral-600',
  'bg-neutral-700',
  'bg-stone-600',
  'bg-gray-600',
];

function getAvatarColor(id: string): string {
  const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function DetailRow({
  icon: Icon,
  label,
  value,
  isEditing,
  onChange,
  placeholder,
  multiline = false,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  isEditing: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (!isEditing && !value) return null;

  return (
    <div className="py-2">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {isEditing ? (
        multiline ? (
          <textarea
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={cn(
              'w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm',
              'text-foreground placeholder:text-muted-foreground resize-none',
              'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
            )}
          />
        ) : (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className={cn(
              'w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
            )}
          />
        )
      ) : (
        <p className="text-sm text-foreground px-1">{value}</p>
      )}
    </div>
  );
}

export function ContactInfoPanel({ contact, onClose }: ContactInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'activity'>('details');
  const [newNote, setNewNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const metadata = (contact.metadata || {}) as ContactMetadata;
  const [editForm, setEditForm] = useState({
    name: contact.name || '',
    email: contact.email || '',
    company: metadata.company || '',
    jobTitle: metadata.jobTitle || '',
    address: metadata.address || '',
    city: metadata.city || '',
    country: metadata.country || '',
    website: metadata.website || '',
    notes: metadata.notes || '',
    source: metadata.source || '',
  });

  // Reset form when contact changes
  useEffect(() => {
    const meta = (contact.metadata || {}) as ContactMetadata;
    setEditForm({
      name: contact.name || '',
      email: contact.email || '',
      company: meta.company || '',
      jobTitle: meta.jobTitle || '',
      address: meta.address || '',
      city: meta.city || '',
      country: meta.country || '',
      website: meta.website || '',
      notes: meta.notes || '',
      source: meta.source || '',
    });
    setIsEditing(false);
  }, [contact.id]);

  const { data: allTags } = useTags();
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();
  const updateContact = useUpdateContact();

  const { data: notes } = useContactNotes(contact.id);
  const { data: activities } = useContactActivity(contact.id);
  const createNote = useCreateContactNote();
  const deleteNote = useDeleteContactNote();
  const togglePin = useToggleContactNotePin();

  const contactTags = contact.tags || [];
  const availableTags = allTags?.filter(
    (tag) => !contactTags.some((ct: Tag) => ct.id === tag.id)
  );
  const avatarColor = getAvatarColor(contact.id);

  const handleCreateNote = async () => {
    if (!newNote.trim()) return;
    try {
      await createNote.mutateAsync({
        contactId: contact.id,
        content: newNote.trim(),
      });
      setNewNote('');
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleAssignTag = (tagId: string) => {
    assignTag.mutate({ contactId: contact.id, tagId });
  };

  const handleRemoveTag = (tagId: string) => {
    removeTag.mutate({ contactId: contact.id, tagId });
  };

  const handleSave = async () => {
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        name: editForm.name || undefined,
        email: editForm.email || undefined,
        metadata: {
          ...metadata,
          company: editForm.company || undefined,
          jobTitle: editForm.jobTitle || undefined,
          address: editForm.address || undefined,
          city: editForm.city || undefined,
          country: editForm.country || undefined,
          website: editForm.website || undefined,
          notes: editForm.notes || undefined,
          source: editForm.source || undefined,
        },
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update contact:', error);
    }
  };

  const assignedSession = contact.assignedSession;

  return (
    <div className="fixed inset-0 md:relative md:inset-auto w-full md:w-96 bg-card/95 backdrop-blur-xl md:border-l border-border/50 flex flex-col h-full z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="font-semibold text-foreground">Contact Info</h3>
        </div>
        <div className="flex items-center gap-1">
          {activeTab === 'details' && (
            isEditing ? (
              <button
                onClick={handleSave}
                disabled={updateContact.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="hidden md:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile section */}
        <div className="p-6 text-center border-b border-border/50">
          <div className={cn(
            'w-20 h-20 mx-auto rounded-2xl flex items-center justify-center',
            'text-white text-2xl font-semibold',
            avatarColor
          )}>
            {contact.name?.[0]?.toUpperCase() || contact.phone?.[0] || '?'}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="Contact name"
              className={cn(
                'mt-4 w-full text-center text-lg font-semibold bg-transparent border-b-2 border-primary/50',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:border-primary'
              )}
            />
          ) : (
            <h4 className="mt-4 text-lg font-semibold text-foreground">
              {contact.name || 'Unknown'}
            </h4>
          )}
          <p className="text-sm text-muted-foreground font-mono">{contact.phone}</p>

          {/* Assigned Session Badge */}
          {assignedSession && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium">
              <Smartphone className="w-3.5 h-3.5" />
              {assignedSession.name}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 bg-secondary/30">
          {[
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'notes', label: 'Notes', icon: Pin },
            { id: 'activity', label: 'Activity', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="p-4 space-y-4">
            {/* Basic Info */}
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contact Information
              </h5>

              <DetailRow
                icon={Mail}
                label="Email"
                value={isEditing ? editForm.email : contact.email}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, email: v })}
                placeholder="email@example.com"
              />

              <DetailRow
                icon={Phone}
                label="Phone"
                value={contact.phone}
                isEditing={false}
                placeholder=""
              />
            </div>

            {/* Business Info */}
            <div className="space-y-1 pt-2 border-t border-border/50">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Business Information
              </h5>

              <DetailRow
                icon={Building2}
                label="Company"
                value={editForm.company}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, company: v })}
                placeholder="Company name"
              />

              <DetailRow
                icon={Briefcase}
                label="Job Title"
                value={editForm.jobTitle}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, jobTitle: v })}
                placeholder="Job title"
              />

              <DetailRow
                icon={Globe}
                label="Website"
                value={editForm.website}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, website: v })}
                placeholder="https://example.com"
              />
            </div>

            {/* Location */}
            <div className="space-y-1 pt-2 border-t border-border/50">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Location
              </h5>

              <DetailRow
                icon={MapPin}
                label="Address"
                value={editForm.address}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, address: v })}
                placeholder="Street address"
              />

              <DetailRow
                icon={MapPin}
                label="City"
                value={editForm.city}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, city: v })}
                placeholder="City"
              />

              <DetailRow
                icon={Globe}
                label="Country"
                value={editForm.country}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, country: v })}
                placeholder="Country"
              />
            </div>

            {/* Additional Info */}
            <div className="space-y-1 pt-2 border-t border-border/50">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Additional Information
              </h5>

              <DetailRow
                icon={User}
                label="Source"
                value={editForm.source}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, source: v })}
                placeholder="Where did this lead come from?"
              />

              <DetailRow
                icon={FileText}
                label="Notes"
                value={editForm.notes}
                isEditing={isEditing}
                onChange={(v) => setEditForm({ ...editForm, notes: v })}
                placeholder="General notes about this contact..."
                multiline
              />

              <div className="py-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Added
                </label>
                <p className="text-sm text-foreground px-1">
                  {contact.createdAt
                    ? new Date(contact.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Unknown'}
                </p>
              </div>
            </div>

            {/* Tags section */}
            <div className="pt-2 border-t border-border/50">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tags</h5>

              {/* Current tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                {contactTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tags assigned</p>
                )}
                {contactTags.map((tag: Tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-1.5 hover:opacity-70 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Available tags to add */}
              {availableTags && availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAssignTag(tag.id)}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed hover:border-solid transition-all"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      + {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="p-4 space-y-4">
            {/* Add note form */}
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className={cn(
                  'w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm',
                  'text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none',
                  'transition-all duration-200'
                )}
              />
              <button
                onClick={handleCreateNote}
                disabled={!newNote.trim() || createNote.isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl',
                  'bg-primary text-primary-foreground shadow-sm',
                  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-all duration-200'
                )}
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            </div>

            {/* Notes list */}
            <div className="space-y-3">
              {notes?.map((note: ContactNote) => (
                <div
                  key={note.id}
                  className={cn(
                    'p-3 rounded-xl border transition-colors',
                    note.isPinned
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-secondary/30 border-border/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => togglePin.mutate({ id: note.id, contactId: contact.id })}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          note.isPinned
                            ? 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        title={note.isPinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNote.mutate({ id: note.id, contactId: contact.id })}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}

              {notes?.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                    <Pin className="w-6 h-6 text-primary/50" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    No notes yet. Add one above!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="p-4">
            <div className="space-y-2">
              {activities?.map((activity: ContactActivity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors">
                  <span className="text-lg flex-shrink-0">
                    {activityIcons[activity.type] || '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground capitalize">
                      {activity.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}

              {activities?.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                    <History className="w-6 h-6 text-primary/50" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    No activity recorded yet
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
