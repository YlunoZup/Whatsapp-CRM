import { useState, useEffect } from 'react';
import {
  Filter,
  X,
  Plus,
  ChevronDown,
  Save,
  Trash2,
  FolderOpen,
  Calendar,
  Tag,
  Smartphone,
  Building2,
  MapPin,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags } from '@/hooks/use-tags';
import { useSessions } from '@/hooks/use-sessions';
import { SimpleSelect } from '@/components/ui/CustomSelect';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
}

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

export interface SmartList {
  id: string;
  name: string;
  filters: FilterGroup[];
  createdAt: string;
}

export interface ContactFiltersState {
  groups: FilterGroup[];
}

interface ContactFiltersProps {
  filters: ContactFiltersState;
  onFiltersChange: (filters: ContactFiltersState) => void;
  smartLists: SmartList[];
  onSaveSmartList: (name: string, filters: FilterGroup[]) => void;
  onLoadSmartList: (smartList: SmartList) => void;
  onDeleteSmartList: (id: string) => void;
  activeSmartListId?: string;
}

const FILTER_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', icon: User, group: 'basic' },
  { key: 'email', label: 'Email', type: 'text', icon: User, group: 'basic' },
  { key: 'phone', label: 'Phone', type: 'text', icon: User, group: 'basic' },
  { key: 'tags', label: 'Tags', type: 'tags', icon: Tag, group: 'basic' },
  { key: 'assignedSession', label: 'Assigned Session', type: 'session', icon: Smartphone, group: 'basic' },
  { key: 'company', label: 'Company', type: 'text', icon: Building2, group: 'metadata' },
  { key: 'jobTitle', label: 'Job Title', type: 'text', icon: Building2, group: 'metadata' },
  { key: 'city', label: 'City', type: 'text', icon: MapPin, group: 'metadata' },
  { key: 'country', label: 'Country', type: 'text', icon: MapPin, group: 'metadata' },
  { key: 'source', label: 'Lead Source', type: 'text', icon: User, group: 'metadata' },
  { key: 'createdAt', label: 'Created Date', type: 'date', icon: Calendar, group: 'date' },
] as const;

const TEXT_OPERATORS = [
  { key: 'contains', label: 'Contains' },
  { key: 'not_contains', label: 'Does not contain' },
  { key: 'equals', label: 'Equals' },
  { key: 'not_equals', label: 'Does not equal' },
  { key: 'starts_with', label: 'Starts with' },
  { key: 'ends_with', label: 'Ends with' },
  { key: 'is_empty', label: 'Is empty' },
  { key: 'is_not_empty', label: 'Is not empty' },
];

const TAG_OPERATORS = [
  { key: 'has_any', label: 'Has any of' },
  { key: 'has_all', label: 'Has all of' },
  { key: 'has_none', label: 'Has none of' },
  { key: 'is_empty', label: 'Has no tags' },
];

const SESSION_OPERATORS = [
  { key: 'equals', label: 'Is assigned to' },
  { key: 'not_equals', label: 'Is not assigned to' },
  { key: 'is_empty', label: 'Not assigned' },
  { key: 'is_not_empty', label: 'Has assignment' },
];

const DATE_OPERATORS = [
  { key: 'equals', label: 'Is' },
  { key: 'before', label: 'Is before' },
  { key: 'after', label: 'Is after' },
  { key: 'between', label: 'Is between' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'last_90_days', label: 'Last 90 days' },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function ContactFilters({
  filters,
  onFiltersChange,
  smartLists,
  onSaveSmartList,
  onLoadSmartList,
  onDeleteSmartList,
  activeSmartListId,
}: ContactFiltersProps) {
  const { data: tags = [] } = useTags();
  const { data: sessions = [] } = useSessions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSmartListDropdown, setShowSmartListDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSmartListName, setNewSmartListName] = useState('');

  const hasActiveFilters = filters.groups.some(g => g.conditions.length > 0);
  const activeFiltersCount = filters.groups.reduce((acc, g) => acc + g.conditions.length, 0);

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: generateId(),
      logic: 'AND',
      conditions: [],
    };
    onFiltersChange({ groups: [...filters.groups, newGroup] });
  };

  const removeFilterGroup = (groupId: string) => {
    onFiltersChange({ groups: filters.groups.filter(g => g.id !== groupId) });
  };

  const updateGroupLogic = (groupId: string, logic: 'AND' | 'OR') => {
    onFiltersChange({
      groups: filters.groups.map(g => g.id === groupId ? { ...g, logic } : g),
    });
  };

  const addCondition = (groupId: string) => {
    const newCondition: FilterCondition = {
      id: generateId(),
      field: 'name',
      operator: 'contains',
      value: '',
    };
    onFiltersChange({
      groups: filters.groups.map(g =>
        g.id === groupId ? { ...g, conditions: [...g.conditions, newCondition] } : g
      ),
    });
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    onFiltersChange({
      groups: filters.groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
          : g
      ),
    });
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    onFiltersChange({
      groups: filters.groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
              ),
            }
          : g
      ),
    });
  };

  const getOperatorsForField = (fieldKey: string) => {
    const field = FILTER_FIELDS.find(f => f.key === fieldKey);
    if (!field) return TEXT_OPERATORS;

    switch (field.type) {
      case 'tags':
        return TAG_OPERATORS;
      case 'session':
        return SESSION_OPERATORS;
      case 'date':
        return DATE_OPERATORS;
      default:
        return TEXT_OPERATORS;
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({ groups: [] });
  };

  const handleSaveSmartList = () => {
    if (newSmartListName.trim() && hasActiveFilters) {
      onSaveSmartList(newSmartListName.trim(), filters.groups);
      setNewSmartListName('');
      setShowSaveDialog(false);
    }
  };

  const renderConditionValue = (groupId: string, condition: FilterCondition) => {
    const field = FILTER_FIELDS.find(f => f.key === condition.field);
    const operator = condition.operator;

    // No value needed for empty/not empty operators
    if (operator === 'is_empty' || operator === 'is_not_empty' ||
        operator === 'last_7_days' || operator === 'last_30_days' || operator === 'last_90_days') {
      return null;
    }

    if (field?.type === 'tags') {
      return (
        <div className="flex flex-wrap gap-1.5 min-w-[200px]">
          {tags.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                const currentValues = Array.isArray(condition.value) ? condition.value : [];
                const newValues = currentValues.includes(tag.id)
                  ? currentValues.filter(v => v !== tag.id)
                  : [...currentValues, tag.id];
                updateCondition(groupId, condition.id, { value: newValues });
              }}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-lg border transition-all',
                Array.isArray(condition.value) && condition.value.includes(tag.id)
                  ? 'border-transparent text-white'
                  : 'border-dashed'
              )}
              style={{
                backgroundColor: Array.isArray(condition.value) && condition.value.includes(tag.id)
                  ? tag.color
                  : 'transparent',
                borderColor: tag.color,
                color: Array.isArray(condition.value) && condition.value.includes(tag.id)
                  ? 'white'
                  : tag.color,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      );
    }

    if (field?.type === 'session') {
      return (
        <SimpleSelect
          value={condition.value as string}
          onChange={(value) => updateCondition(groupId, condition.id, { value })}
          placeholder="Select session..."
          className="min-w-[180px]"
          options={sessions.map(session => ({
            value: session.id,
            label: `${session.name}${session.phoneNumber ? ` (${session.phoneNumber})` : ''}`,
          }))}
        />
      );
    }

    if (field?.type === 'date') {
      return (
        <input
          type="date"
          value={condition.value as string}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className={cn(
            'px-3 py-2 rounded-lg text-sm',
            'bg-secondary/50 border border-border text-foreground',
            'focus:outline-none focus:border-primary/50'
          )}
        />
      );
    }

    return (
      <input
        type="text"
        value={condition.value as string}
        onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
        placeholder="Enter value..."
        className={cn(
          'px-3 py-2 rounded-lg text-sm min-w-[180px]',
          'bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:border-primary/50'
        )}
      />
    );
  };

  return (
    <div className="space-y-3">
      {/* Filter Header */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Smart Lists Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSmartListDropdown(!showSmartListDropdown)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              'bg-secondary/50 border border-border text-foreground',
              'hover:bg-accent hover:border-primary/30',
              activeSmartListId && 'border-primary/50 bg-primary/5'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">
              {activeSmartListId
                ? smartLists.find(s => s.id === activeSmartListId)?.name || 'Smart List'
                : 'Smart Lists'}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showSmartListDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSmartListDropdown(false)} />
              <div className="absolute left-0 top-full mt-2 w-64 bg-card rounded-xl border border-border shadow-lg z-50 py-2 animate-scale-in">
                {smartLists.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No saved smart lists</p>
                ) : (
                  smartLists.map(smartList => (
                    <div
                      key={smartList.id}
                      className={cn(
                        'flex items-center justify-between px-4 py-2 hover:bg-accent transition-colors',
                        activeSmartListId === smartList.id && 'bg-primary/10'
                      )}
                    >
                      <button
                        onClick={() => {
                          onLoadSmartList(smartList);
                          setShowSmartListDropdown(false);
                        }}
                        className="flex-1 text-left text-sm font-medium text-foreground"
                      >
                        {smartList.name}
                      </button>
                      <button
                        onClick={() => onDeleteSmartList(smartList.id)}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
            'bg-secondary/50 border border-border text-foreground',
            'hover:bg-accent hover:border-primary/30',
            hasActiveFilters && 'border-primary/50 bg-primary/5'
          )}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary text-white rounded-md">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}

        {/* Save as Smart List */}
        {hasActiveFilters && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save as Smart List</span>
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {isExpanded && (
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4 animate-fade-in">
          {filters.groups.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-3">No filters applied</p>
              <button
                onClick={addFilterGroup}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Filter
              </button>
            </div>
          ) : (
            <>
              {filters.groups.map((group, groupIndex) => (
                <div key={group.id} className="space-y-3">
                  {groupIndex > 0 && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <SimpleSelect
                        value={group.logic}
                        onChange={(value) => updateGroupLogic(group.id, value as 'AND' | 'OR')}
                        className="w-20"
                        options={[
                          { value: 'AND', label: 'AND' },
                          { value: 'OR', label: 'OR' },
                        ]}
                      />
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {group.conditions.map((condition, conditionIndex) => (
                      <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                        {conditionIndex > 0 && (
                          <span className="text-xs font-semibold text-muted-foreground uppercase w-12">
                            {group.logic}
                          </span>
                        )}
                        {conditionIndex === 0 && <span className="w-12" />}

                        {/* Field Select */}
                        <SimpleSelect
                          value={condition.field}
                          onChange={(newField) => {
                            const newOperators = getOperatorsForField(newField);
                            updateCondition(group.id, condition.id, {
                              field: newField,
                              operator: newOperators[0].key,
                              value: '',
                            });
                          }}
                          className="min-w-[140px]"
                          options={[
                            ...FILTER_FIELDS.filter(f => f.group === 'basic').map(field => ({
                              value: field.key,
                              label: field.label,
                              group: 'Basic',
                            })),
                            ...FILTER_FIELDS.filter(f => f.group === 'metadata').map(field => ({
                              value: field.key,
                              label: field.label,
                              group: 'Business Info',
                            })),
                            ...FILTER_FIELDS.filter(f => f.group === 'date').map(field => ({
                              value: field.key,
                              label: field.label,
                              group: 'Date',
                            })),
                          ]}
                        />

                        {/* Operator Select */}
                        <SimpleSelect
                          value={condition.operator}
                          onChange={(value) => updateCondition(group.id, condition.id, { operator: value })}
                          className="min-w-[140px]"
                          options={getOperatorsForField(condition.field).map(op => ({
                            value: op.key,
                            label: op.label,
                          }))}
                        />

                        {/* Value Input */}
                        {renderConditionValue(group.id, condition)}

                        {/* Remove Condition */}
                        <button
                          onClick={() => removeCondition(group.id, condition.id)}
                          className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <div className="flex items-center gap-2 pl-14">
                      <button
                        onClick={() => addCondition(group.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add condition
                      </button>
                      {filters.groups.length > 1 && (
                        <button
                          onClick={() => removeFilterGroup(group.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove group
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addFilterGroup}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add filter group
              </button>
            </>
          )}
        </div>
      )}

      {/* Save Smart List Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-lg p-6 w-full max-w-md animate-scale-in">
            <h3 className="text-lg font-semibold text-foreground mb-4">Save as Smart List</h3>
            <input
              type="text"
              value={newSmartListName}
              onChange={(e) => setNewSmartListName(e.target.value)}
              placeholder="Enter smart list name..."
              className={cn(
                'w-full px-4 py-3 rounded-xl text-foreground placeholder:text-muted-foreground',
                'bg-secondary/50 border border-border',
                'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
              )}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSmartList}
                disabled={!newSmartListName.trim()}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg',
                  'bg-primary text-white hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
