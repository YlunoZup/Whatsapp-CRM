import React, { useState, useEffect } from 'react';
import { useCreateContact, useUpdateContact, useAssignContactSession } from '../../hooks/use-contacts';
import { useTags } from '../../hooks/use-tags';
import { useSessions } from '../../hooks/use-sessions';
import { cn } from '@/lib/utils';
import { SimpleSelect } from '@/components/ui/CustomSelect';
import { X, AlertCircle, User, Building2, MapPin, FileText } from 'lucide-react';
import type { Contact, Tag } from '@whatsapp-crm/shared';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
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

export function ContactFormModal({ isOpen, onClose, contact }: ContactFormModalProps) {
  const { data: allTags } = useTags();
  const { data: sessions = [] } = useSessions();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const assignSession = useAssignContactSession();

  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    email: '',
    // Extended fields from metadata
    company: '',
    jobTitle: '',
    address: '',
    city: '',
    country: '',
    website: '',
    notes: '',
    source: '',
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'basic' | 'business' | 'location' | 'additional'>('basic');

  const isEditing = !!contact;
  const isPending = createContact.isPending || updateContact.isPending || assignSession.isPending;

  // Filter to only show connected sessions
  const connectedSessions = sessions.filter(s => s.status === 'connected');

  useEffect(() => {
    if (contact) {
      const metadata = (contact.metadata || {}) as ContactMetadata;
      setFormData({
        phone: contact.phone || '',
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
      setSelectedTags(contact.tags?.map((t: Tag) => t.id) || []);
      setSelectedSessionId(contact.assignedSessionId || '');
    } else {
      setFormData({
        phone: '',
        name: '',
        email: '',
        company: '',
        jobTitle: '',
        address: '',
        city: '',
        country: '',
        website: '',
        notes: '',
        source: '',
      });
      setSelectedTags([]);
      setSelectedSessionId('');
    }
    setErrors({});
    setApiError(null);
    setActiveSection('basic');
  }, [contact, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) {
      setApiError(null);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else {
      const cleanedPhone = formData.phone.replace(/[\s\-()]/g, '');
      if (!/^\+?[1-9]\d{6,14}$/.test(cleanedPhone)) {
        newErrors.phone = 'Invalid phone number format (e.g. +1234567890)';
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.website && !/^https?:\/\/.+/.test(formData.website) && formData.website.length > 0) {
      newErrors.website = 'Website should start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Build metadata object
    const metadata: ContactMetadata = {};
    if (formData.company) metadata.company = formData.company;
    if (formData.jobTitle) metadata.jobTitle = formData.jobTitle;
    if (formData.address) metadata.address = formData.address;
    if (formData.city) metadata.city = formData.city;
    if (formData.country) metadata.country = formData.country;
    if (formData.website) metadata.website = formData.website;
    if (formData.notes) metadata.notes = formData.notes;
    if (formData.source) metadata.source = formData.source;

    const cleanedData = {
      phone: formData.phone.replace(/[\s\-()]/g, ''),
      name: formData.name || undefined,
      email: formData.email || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    try {
      setApiError(null);
      if (isEditing && contact) {
        // Merge with existing metadata
        const existingMetadata = (contact.metadata || {}) as ContactMetadata;
        await updateContact.mutateAsync({
          id: contact.id,
          name: cleanedData.name,
          email: cleanedData.email,
          metadata: { ...existingMetadata, ...metadata },
        });
        // Update session assignment if changed
        if (selectedSessionId && selectedSessionId !== contact.assignedSessionId) {
          await assignSession.mutateAsync({
            contactId: contact.id,
            sessionId: selectedSessionId,
          });
        }
      } else {
        const newContact = await createContact.mutateAsync(cleanedData);
        // Assign session to new contact if selected
        if (selectedSessionId && newContact?.id) {
          await assignSession.mutateAsync({
            contactId: newContact.id,
            sessionId: selectedSessionId,
          });
        }
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving contact:', error);
      setApiError(error?.message || 'Failed to save contact. Please try again.');
    }
  };

  if (!isOpen) return null;

  const sections = [
    { id: 'basic', label: 'Basic', icon: User },
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'additional', label: 'Additional', icon: FileText },
  ] as const;

  const inputClasses = cn(
    'w-full px-4 py-2.5 rounded-xl transition-all duration-200',
    'bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground',
    'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
  );

  const labelClasses = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={isPending ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">
            {isEditing ? 'Edit Contact' : 'New Contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex-shrink-0 flex border-b border-border/50 px-2 bg-secondary/30">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all',
                activeSection === section.id
                  ? 'text-primary border-b-2 border-primary -mb-[1px]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <section.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{section.label}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4 overflow-y-auto min-h-0">
          {/* API Error */}
          {apiError && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{apiError}</p>
            </div>
          )}

          {/* Basic Section */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              {/* Phone */}
              <div>
                <label className={labelClasses}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1234567890"
                  disabled={isEditing}
                  className={cn(
                    inputClasses,
                    errors.phone && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                    isEditing && 'bg-muted cursor-not-allowed opacity-60'
                  )}
                />
                {errors.phone && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.phone}</p>
                )}
                {!isEditing && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Include country code (e.g., +1 for US, +44 for UK)
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className={labelClasses}>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className={inputClasses}
                />
              </div>

              {/* Email */}
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className={cn(
                    inputClasses,
                    errors.email && 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  )}
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Assigned Session */}
              {connectedSessions.length > 0 && (
                <div>
                  <label className={labelClasses}>Assigned SIM / Session</label>
                  <SimpleSelect
                    value={selectedSessionId}
                    onChange={setSelectedSessionId}
                    placeholder="No session assigned"
                    options={connectedSessions.map((session) => ({
                      value: session.id,
                      label: `${session.name}${session.phoneNumber ? ` (${session.phoneNumber})` : ''}`,
                    }))}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Messages to this contact will be sent from the assigned session
                  </p>
                </div>
              )}

              {/* Tags */}
              {allTags && allTags.length > 0 && (
                <div>
                  <label className={labelClasses}>Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg border transition-all duration-200',
                          selectedTags.includes(tag.id)
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-dashed hover:border-solid'
                        )}
                        style={{
                          backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: selectedTags.includes(tag.id) ? 'white' : tag.color,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Business Section */}
          {activeSection === 'business' && (
            <div className="space-y-4">
              <div>
                <label className={labelClasses}>Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Acme Inc."
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>Job Title</label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  placeholder="Marketing Manager"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  className={cn(
                    inputClasses,
                    errors.website && 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  )}
                />
                {errors.website && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.website}</p>
                )}
              </div>
            </div>
          )}

          {/* Location Section */}
          {activeSection === 'location' && (
            <div className="space-y-4">
              <div>
                <label className={labelClasses}>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Main Street"
                  className={inputClasses}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="New York"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="United States"
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Additional Section */}
          {activeSection === 'additional' && (
            <div className="space-y-4">
              <div>
                <label className={labelClasses}>Lead Source</label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  placeholder="Where did this contact come from?"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Additional notes about this contact..."
                  rows={4}
                  className={cn(inputClasses, 'resize-none')}
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-border/50 bg-secondary/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className={cn(
              'px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
              'bg-primary text-primary-foreground shadow-sm',
              'hover:bg-primary/90 hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isPending
              ? 'Saving...'
              : isEditing
              ? 'Save Changes'
              : 'Create Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
