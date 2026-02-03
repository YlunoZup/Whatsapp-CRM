import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
  Settings2,
  Tags,
  Smartphone,
  FileSpreadsheet,
  ArrowRight,
  Info,
} from 'lucide-react';
import { api } from '@/services/api';
import { useTags } from '@/hooks/use-tags';
import { useSessions } from '@/hooks/use-sessions';
import { cn } from '@/lib/utils';
import { SimpleSelect } from '@/components/ui/CustomSelect';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  updated: number;
  created: number;
  errors: Array<{
    row: number;
    phone: string;
    error: string;
  }>;
}

type ImportMode = 'create' | 'update' | 'createOrUpdate';
type Step = 'upload' | 'mapping' | 'options' | 'importing' | 'done';

// All mappable fields
const CONTACT_FIELDS = [
  { key: 'phone', label: 'Phone', required: true, group: 'basic' },
  { key: 'name', label: 'Name', required: false, group: 'basic' },
  { key: 'email', label: 'Email', required: false, group: 'basic' },
  { key: 'company', label: 'Company', required: false, group: 'business' },
  { key: 'jobTitle', label: 'Job Title', required: false, group: 'business' },
  { key: 'website', label: 'Website', required: false, group: 'business' },
  { key: 'address', label: 'Address', required: false, group: 'location' },
  { key: 'city', label: 'City', required: false, group: 'location' },
  { key: 'country', label: 'Country', required: false, group: 'location' },
  { key: 'source', label: 'Lead Source', required: false, group: 'additional' },
  { key: 'notes', label: 'Notes', required: false, group: 'additional' },
] as const;

type FieldKey = typeof CONTACT_FIELDS[number]['key'];

const STEPS: { id: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'mapping', label: 'Map Fields', icon: FileSpreadsheet },
  { id: 'options', label: 'Options', icon: Settings2 },
  { id: 'done', label: 'Complete', icon: Check },
];

export function ImportContactsModal({ isOpen, onClose }: ImportContactsModalProps) {
  const { data: allTags = [] } = useTags();
  const { data: sessions = [] } = useSessions();
  const connectedSessions = sessions.filter((s) => s.status === 'connected');

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>(
    Object.fromEntries(CONTACT_FIELDS.map((f) => [f.key, -1])) as Record<FieldKey, number>
  );
  const [step, setStep] = useState<Step>('upload');
  const [result, setResult] = useState<ImportResult | null>(null);

  // Import options
  const [importMode, setImportMode] = useState<ImportMode>('createOrUpdate');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [skipEmptyValues, setSkipEmptyValues] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreview([]);
      setTotalRows(0);
      setMapping(Object.fromEntries(CONTACT_FIELDS.map((f) => [f.key, -1])) as Record<FieldKey, number>);
      setStep('upload');
      setResult(null);
      setImportMode('createOrUpdate');
      setSelectedTagIds([]);
      setSelectedSessionId('');
      setSkipEmptyValues(true);
    }
  }, [isOpen]);

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<ImportResult>('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: any) => {
      setResult({
        success: 0,
        failed: totalRows,
        updated: 0,
        created: 0,
        errors: [{ row: 0, phone: '', error: error?.message || 'Import failed' }],
      });
      setStep('done');
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 30 * 1024 * 1024) {
      alert('File size must be under 30MB');
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());
      setTotalRows(Math.max(0, lines.length - 1)); // Exclude header

      // Preview first 6 rows (header + 5 data rows)
      const rows = lines.slice(0, 6).map((line) => parseCsvRow(line));
      setPreview(rows);

      // Auto-detect column mapping
      if (rows.length > 0) {
        const headers = rows[0].map((h) => h.toLowerCase().trim());
        const newMapping = { ...mapping };

        headers.forEach((header, index) => {
          // Phone detection
          if (header.includes('phone') || header.includes('mobile') || header.includes('number') || header === 'tel') {
            if (newMapping.phone === -1) newMapping.phone = index;
          }
          // Name detection
          else if (header.includes('name') || header === 'contact' || header === 'full name') {
            if (newMapping.name === -1) newMapping.name = index;
          }
          // Email detection
          else if (header.includes('email') || header.includes('mail')) {
            if (newMapping.email === -1) newMapping.email = index;
          }
          // Company detection
          else if (header.includes('company') || header.includes('organization') || header.includes('business')) {
            if (newMapping.company === -1) newMapping.company = index;
          }
          // Job Title detection
          else if (header.includes('title') || header.includes('position') || header.includes('role') || header === 'job') {
            if (newMapping.jobTitle === -1) newMapping.jobTitle = index;
          }
          // Website detection
          else if (header.includes('website') || header.includes('url') || header === 'web') {
            if (newMapping.website === -1) newMapping.website = index;
          }
          // Address detection
          else if (header.includes('address') || header.includes('street')) {
            if (newMapping.address === -1) newMapping.address = index;
          }
          // City detection
          else if (header === 'city' || header.includes('city')) {
            if (newMapping.city === -1) newMapping.city = index;
          }
          // Country detection
          else if (header === 'country' || header.includes('country')) {
            if (newMapping.country === -1) newMapping.country = index;
          }
          // Source detection
          else if (header.includes('source') || header.includes('lead') || header.includes('origin')) {
            if (newMapping.source === -1) newMapping.source = index;
          }
          // Notes detection
          else if (header.includes('note') || header.includes('comment') || header.includes('remark')) {
            if (newMapping.notes === -1) newMapping.notes = index;
          }
        });

        setMapping(newMapping);
      }

      setStep('mapping');
    };

    reader.readAsText(selectedFile);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(droppedFile);
        input.files = dt.files;
        handleFileSelect({ target: input } as any);
      }
    }
  };

  const handleImport = () => {
    if (!file || mapping.phone === -1) return;

    setStep('importing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('importMode', importMode);
    formData.append('skipEmptyValues', String(skipEmptyValues));

    // Add column mappings
    Object.entries(mapping).forEach(([field, columnIndex]) => {
      if (columnIndex !== -1) {
        formData.append(`${field}Column`, String(columnIndex));
      }
    });

    // Add tag IDs
    if (selectedTagIds.length > 0) {
      formData.append('tagIds', JSON.stringify(selectedTagIds));
    }

    // Add session ID
    if (selectedSessionId) {
      formData.append('sessionId', selectedSessionId);
    }

    importMutation.mutate(formData);
  };

  const handleClose = () => {
    onClose();
  };

  const downloadTemplate = () => {
    const headers = CONTACT_FIELDS.map((f) => f.label).join(',');
    const sampleRow = '+1234567890,John Doe,john@example.com,Acme Inc,Marketing Manager,https://acme.com,123 Main St,New York,United States,Website,Great lead!';
    const csv = `${headers}\n${sampleRow}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of row) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const getMappedFieldsCount = () => {
    return Object.values(mapping).filter((v) => v !== -1).length;
  };

  const canProceedToOptions = mapping.phone !== -1;

  if (!isOpen) return null;

  const currentStepIndex = STEPS.findIndex((s) => s.id === step || (step === 'importing' && s.id === 'done'));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Import Contacts</h2>
            <p className="text-sm text-muted-foreground">Bulk import contacts from a CSV file</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        {step !== 'importing' && (
          <div className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-4 bg-secondary/30 border-b border-border/50">
            {STEPS.filter((s) => s.id !== 'done' || step === 'done').map((s, index) => {
              const isActive = s.id === step;
              const isCompleted = STEPS.findIndex((st) => st.id === step) > index;
              const Icon = s.icon;

              return (
                <div key={s.id} className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all',
                      isActive && 'bg-primary/10 text-primary',
                      isCompleted && 'text-primary',
                      !isActive && !isCompleted && 'text-muted-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                        isActive && 'bg-primary text-white',
                        isCompleted && 'bg-primary text-white',
                        !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                  </div>
                  {index < STEPS.length - 2 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
                  'hover:border-primary hover:bg-primary/5',
                  'border-border'
                )}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  CSV file up to 30MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Requirements */}
              <div className="p-4 bg-secondary/50 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Info className="w-4 h-4 text-primary" />
                  Requirements
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>File must be in CSV format (.csv)</li>
                  <li>First row should contain column headers</li>
                  <li>Phone number column is required</li>
                  <li>Maximum file size: 30MB</li>
                </ul>
              </div>

              {/* Download Template */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Need a template? Download our sample CSV file
                  </span>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">{totalRows} rows detected</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {getMappedFieldsCount()} fields mapped
                  </span>
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    mapping.phone !== -1 ? 'bg-green-500' : 'bg-yellow-500'
                  )} />
                </div>
              </div>

              {/* Column Mapping */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Map CSV columns to contact fields</h3>

                {/* Group: Basic */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Basic Information</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CONTACT_FIELDS.filter((f) => f.group === 'basic').map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <SimpleSelect
                          value={String(mapping[field.key])}
                          onChange={(value) => setMapping({ ...mapping, [field.key]: Number(value) })}
                          placeholder="-- Select column --"
                          options={[
                            { value: '-1', label: '-- Select column --' },
                            ...(preview[0]?.map((header, index) => ({
                              value: String(index),
                              label: header || `Column ${index + 1}`,
                            })) || []),
                          ]}
                          className={cn(
                            mapping[field.key] !== -1 && '[&_button]:border-green-500/50 [&_button]:bg-green-500/5'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group: Business */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Information</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CONTACT_FIELDS.filter((f) => f.group === 'business').map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          {field.label}
                        </label>
                        <SimpleSelect
                          value={String(mapping[field.key])}
                          onChange={(value) => setMapping({ ...mapping, [field.key]: Number(value) })}
                          placeholder="-- Select column --"
                          options={[
                            { value: '-1', label: '-- Select column --' },
                            ...(preview[0]?.map((header, index) => ({
                              value: String(index),
                              label: header || `Column ${index + 1}`,
                            })) || []),
                          ]}
                          className={cn(
                            mapping[field.key] !== -1 && '[&_button]:border-green-500/50 [&_button]:bg-green-500/5'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group: Location */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CONTACT_FIELDS.filter((f) => f.group === 'location').map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          {field.label}
                        </label>
                        <SimpleSelect
                          value={String(mapping[field.key])}
                          onChange={(value) => setMapping({ ...mapping, [field.key]: Number(value) })}
                          placeholder="-- Select column --"
                          options={[
                            { value: '-1', label: '-- Select column --' },
                            ...(preview[0]?.map((header, index) => ({
                              value: String(index),
                              label: header || `Column ${index + 1}`,
                            })) || []),
                          ]}
                          className={cn(
                            mapping[field.key] !== -1 && '[&_button]:border-green-500/50 [&_button]:bg-green-500/5'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group: Additional */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Additional</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CONTACT_FIELDS.filter((f) => f.group === 'additional').map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          {field.label}
                        </label>
                        <SimpleSelect
                          value={String(mapping[field.key])}
                          onChange={(value) => setMapping({ ...mapping, [field.key]: Number(value) })}
                          placeholder="-- Select column --"
                          options={[
                            { value: '-1', label: '-- Select column --' },
                            ...(preview[0]?.map((header, index) => ({
                              value: String(index),
                              label: header || `Column ${index + 1}`,
                            })) || []),
                          ]}
                          className={cn(
                            mapping[field.key] !== -1 && '[&_button]:border-green-500/50 [&_button]:bg-green-500/5'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        {preview[0]?.map((header, index) => {
                          const mappedField = CONTACT_FIELDS.find((f) => mapping[f.key] === index);
                          return (
                            <th key={index} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {header || `Column ${index + 1}`}
                              {mappedField && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                                  {mappedField.label}
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(1).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-border">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[200px] truncate">
                              {cell || <span className="text-muted-foreground italic">empty</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Import Options */}
          {step === 'options' && (
            <div className="space-y-6">
              {/* Import Mode */}
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">Import Mode</h3>
                <p className="text-sm text-muted-foreground">Choose how to handle existing contacts</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'create', label: 'Create Only', desc: 'Only create new contacts, skip existing' },
                    { value: 'update', label: 'Update Only', desc: 'Only update existing contacts' },
                    { value: 'createOrUpdate', label: 'Create & Update', desc: 'Create new and update existing' },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setImportMode(mode.value as ImportMode)}
                      className={cn(
                        'p-4 rounded-xl border text-left transition-all',
                        importMode === mode.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                            importMode === mode.value ? 'border-primary' : 'border-muted-foreground'
                          )}
                        >
                          {importMode === mode.value && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-medium text-foreground">{mode.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">{mode.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skip Empty Values */}
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
                <div>
                  <p className="font-medium text-foreground">Skip empty values</p>
                  <p className="text-sm text-muted-foreground">Don't overwrite existing data with empty values</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSkipEmptyValues(!skipEmptyValues)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-all relative',
                    skipEmptyValues ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all',
                      skipEmptyValues ? 'left-6' : 'left-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Tag Assignment */}
              {allTags.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Tags className="w-4 h-4 text-primary" />
                    <h3 className="font-medium text-foreground">Assign Tags</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Apply tags to all imported contacts</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg border transition-all',
                          selectedTagIds.includes(tag.id)
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-dashed hover:border-solid'
                        )}
                        style={{
                          backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: selectedTagIds.includes(tag.id) ? 'white' : tag.color,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Session Assignment */}
              {connectedSessions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <h3 className="font-medium text-foreground">Assign Session</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Assign all imported contacts to a WhatsApp session</p>
                  <SimpleSelect
                    value={selectedSessionId}
                    onChange={(value) => setSelectedSessionId(value)}
                    placeholder="No session (assign later)"
                    options={[
                      { value: '', label: 'No session (assign later)' },
                      ...connectedSessions.map((session) => ({
                        value: session.id,
                        label: `${session.name}${session.phoneNumber ? ` (${session.phoneNumber})` : ''}`,
                      })),
                    ]}
                  />
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <h3 className="font-medium text-foreground mb-2">Import Summary</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {totalRows} contacts will be processed</li>
                  <li>• {getMappedFieldsCount()} fields will be imported</li>
                  <li>• Mode: {importMode === 'create' ? 'Create only' : importMode === 'update' ? 'Update only' : 'Create and update'}</li>
                  {selectedTagIds.length > 0 && (
                    <li>• {selectedTagIds.length} tag(s) will be applied</li>
                  )}
                  {selectedSessionId && (
                    <li>• Contacts will be assigned to a session</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-xl font-semibold text-foreground">Importing contacts...</p>
              <p className="text-sm text-muted-foreground mt-2">Processing {totalRows} contacts</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && result && (
            <div className="space-y-6">
              {/* Success Banner */}
              {result.success > 0 && (
                <div className="flex items-start gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-600 dark:text-green-400">Import completed!</p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      {result.success} contact{result.success !== 1 ? 's' : ''} imported successfully
                      {result.created > 0 && ` (${result.created} created`}
                      {result.updated > 0 && `, ${result.updated} updated`}
                      {(result.created > 0 || result.updated > 0) && ')'}
                    </p>
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.failed > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      {result.failed} contact{result.failed !== 1 ? 's' : ''} failed to import
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-yellow-500/5 p-2">
                    {result.errors.slice(0, 50).map((error, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-2 border-b border-yellow-500/10 last:border-0 text-sm"
                      >
                        <span className="text-yellow-700 dark:text-yellow-400">
                          Row {error.row}: {error.phone || 'Unknown'}
                        </span>
                        <span className="text-yellow-600 dark:text-yellow-500 text-right ml-4">
                          {error.error}
                        </span>
                      </div>
                    ))}
                    {result.errors.length > 50 && (
                      <p className="text-sm text-yellow-600 dark:text-yellow-500 text-center py-2">
                        ... and {result.errors.length - 50} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* No success case */}
              {result.success === 0 && result.failed > 0 && (
                <div className="flex items-start gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <X className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-600 dark:text-red-400">Import failed</p>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                      No contacts were imported. Please check the errors above and try again.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-border/50 bg-secondary/30">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setStep('upload');
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {step === 'options' && (
              <button
                onClick={() => setStep('mapping')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step !== 'done' && step !== 'importing' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
              >
                Cancel
              </button>
            )}

            {step === 'upload' && (
              <button
                disabled
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-xl bg-primary/50 text-primary-foreground cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'mapping' && (
              <button
                onClick={() => setStep('options')}
                disabled={!canProceedToOptions}
                className={cn(
                  'flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-xl transition-all',
                  canProceedToOptions
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                )}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'options' && (
              <button
                onClick={handleImport}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Import {totalRows} Contacts
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 'done' && (
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
