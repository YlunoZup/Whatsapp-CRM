import { useState } from 'react';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
} from '../hooks/use-templates';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';
import type { MessageTemplate } from '@whatsapp-crm/shared';
import { SimpleSelect } from '@/components/ui/CustomSelect';

const CATEGORIES = [
  { value: 'greeting', label: 'Greeting', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  { value: 'support', label: 'Support', color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  { value: 'sales', label: 'Sales', color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  { value: 'notification', label: 'Notification', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
  { value: 'other', label: 'Other', color: 'bg-muted text-foreground' },
];

interface TemplateFormData {
  name: string;
  content: string;
  category: string;
  variables: string[];
}

export function TemplatesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MessageTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    content: '',
    category: 'other',
    variables: [],
  });
  const [formError, setFormError] = useState('');

  // Lock body scroll when any modal is open
  useBodyScrollLock(showModal || !!editTemplate || !!deleteConfirm);

  // Filter templates
  const filteredTemplates = templates?.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  // Extract variables from content using {{variable}} pattern
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
  };

  const handleContentChange = (content: string) => {
    const variables = extractVariables(content);
    setFormData({ ...formData, content, variables });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.content) {
      setFormError('Name and content are required');
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name: formData.name,
        content: formData.content,
        category: formData.category as any,
        variables: formData.variables,
      });
      setShowModal(false);
      setFormData({ name: '', content: '', category: 'other', variables: [] });
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to create template');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTemplate) return;
    setFormError('');

    try {
      await updateTemplate.mutateAsync({
        id: editTemplate.id,
        name: formData.name,
        content: formData.content,
        category: formData.category as any,
        variables: formData.variables,
      });
      setEditTemplate(null);
      setFormData({ name: '', content: '', category: 'other', variables: [] });
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to update template');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteTemplate.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleDuplicate = async (template: MessageTemplate) => {
    try {
      await duplicateTemplate.mutateAsync({
        id: template.id,
        name: `${template.name} (Copy)`,
      });
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const openEditModal = (template: MessageTemplate) => {
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      variables: template.variables || [],
    });
    setEditTemplate(template);
    setFormError('');
  };

  const getCategoryColor = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.color || 'bg-muted text-foreground';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Message Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage quick reply templates for your conversations
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', content: '', category: 'other', variables: [] });
            setFormError('');
            setShowModal(true);
          }}
          className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2 border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
        />
        <SimpleSelect
          value={categoryFilter}
          onChange={(value) => setCategoryFilter(value)}
          options={[
            { value: '', label: 'All Categories' },
            ...CATEGORIES.map((cat) => ({
              value: cat.value,
              label: cat.label,
            })),
          ]}
          className="w-44"
          clearable={!!categoryFilter}
        />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-foreground">{template.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(template.category)}`}>
                  {CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
                </span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3 mb-3">
                {template.content}
              </p>
              {template.variables && template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.variables.map((v) => (
                    <span key={v} className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <button
                  onClick={() => handleDuplicate(template)}
                  disabled={duplicateTemplate.isPending}
                  className="p-1 text-muted-foreground hover:text-blue-600 transition-colors disabled:opacity-50"
                  title="Duplicate"
                >
                  {duplicateTemplate.isPending ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => openEditModal(template)}
                  className="p-1 text-muted-foreground hover:text-green-600 transition-colors"
                  title="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteConfirm(template)}
                  className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <h3 className="font-medium text-foreground">No templates found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery || categoryFilter
              ? 'Try adjusting your filters'
              : 'Create your first template to speed up your conversations'}
          </p>
          {!searchQuery && !categoryFilter && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
            >
              Create First Template
            </button>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Template Variables</h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Use <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">{'{{variable_name}}'}</code> to create dynamic placeholders.
          For example: "Hello {'{{name}}'}, thank you for contacting us!"
        </p>
      </div>

      {/* Create/Edit Modal */}
      {(showModal || editTemplate) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowModal(false);
              setEditTemplate(null);
            }}
          />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {editTemplate ? 'Edit Template' : 'Create Template'}
            </h3>
            <form onSubmit={editTemplate ? handleEditSubmit : handleCreateSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Welcome Message"
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <SimpleSelect
                  value={formData.category}
                  onChange={(value) => setFormData({ ...formData, category: value })}
                  options={CATEGORIES.map((cat) => ({
                    value: cat.value,
                    label: cat.label,
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Type your template message here... Use {{variable}} for dynamic content."
                  rows={5}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary resize-none"
                  required
                />
                {formData.variables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">Variables:</span>
                    {formData.variables.map((v) => (
                      <span key={v} className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditTemplate(null);
                  }}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTemplate.isPending || updateTemplate.isPending}
                  className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
                >
                  {(createTemplate.isPending || updateTemplate.isPending)
                    ? 'Saving...'
                    : editTemplate
                    ? 'Save Changes'
                    : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Template</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTemplate.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteTemplate.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
