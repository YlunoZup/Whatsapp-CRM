import React, { useState, useMemo } from 'react';
import { useTemplates } from '../../hooks/use-templates';
import type { MessageTemplate } from '@whatsapp-crm/shared';

interface QuickReplyPickerProps {
  onSelect: (content: string, variables?: Record<string, string>) => void;
  contactName?: string;
}

export function QuickReplyPicker({ onSelect, contactName }: QuickReplyPickerProps) {
  const { data: templates, isLoading } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!searchQuery) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, MessageTemplate[]> = {};
    filteredTemplates.forEach((template) => {
      const category = template.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(template);
    });
    return groups;
  }, [filteredTemplates]);

  const handleTemplateClick = (template: MessageTemplate) => {
    if (template.variables && template.variables.length > 0) {
      // Initialize variables with defaults
      const initialVars: Record<string, string> = {};
      template.variables.forEach((v) => {
        if (v === 'name' && contactName) {
          initialVars[v] = contactName;
        } else {
          initialVars[v] = '';
        }
      });
      setVariables(initialVars);
      setSelectedTemplate(template);
    } else {
      onSelect(template.content);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitWithVariables = () => {
    if (!selectedTemplate) return;

    let content = selectedTemplate.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    onSelect(content, variables);
    setSelectedTemplate(null);
    setVariables({});
  };

  const handleCancel = () => {
    setSelectedTemplate(null);
    setVariables({});
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      greeting: '👋 Greetings',
      follow_up: '📞 Follow-ups',
      support: '🛠️ Support',
      sales: '💼 Sales',
      notification: '🔔 Notifications',
      other: '📝 Other',
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading templates...
      </div>
    );
  }

  // Variable input form
  if (selectedTemplate) {
    return (
      <div className="p-4 bg-card rounded-lg shadow-lg">
        <h4 className="font-medium text-foreground mb-2">{selectedTemplate.name}</h4>
        <p className="text-sm text-muted-foreground mb-4">{selectedTemplate.content}</p>

        <div className="space-y-3">
          {selectedTemplate.variables?.map((variable) => (
            <div key={variable}>
              <label className="block text-sm font-medium text-foreground mb-1 capitalize">
                {variable}
              </label>
              <input
                type="text"
                value={variables[variable] || ''}
                onChange={(e) => handleVariableChange(variable, e.target.value)}
                placeholder={`Enter ${variable}...`}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitWithVariables}
            disabled={Object.values(variables).some((v) => !v.trim())}
            className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
          >
            Use Template
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col">
      {/* Search */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
        />
      </div>

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedTemplates).length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No templates found
          </div>
        ) : (
          Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <div key={category}>
              <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                {getCategoryLabel(category)}
              </div>
              {categoryTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-sm text-foreground">
                    {template.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {template.content}
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {template.variables.map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
