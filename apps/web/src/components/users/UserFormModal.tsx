import React, { useState, useEffect } from 'react';
import { X, UserCog, AlertCircle } from 'lucide-react';
import { useCreateUser, useUpdateUser } from '../../hooks/use-users';
import type { User } from '@whatsapp-crm/shared';
import { SimpleSelect } from '@/components/ui/CustomSelect';
import { cn } from '@/lib/utils';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

export function UserFormModal({ isOpen, onClose, user }: UserFormModalProps) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'agent' as 'admin' | 'agent' | 'viewer',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!user;
  const isPending = createUser.isPending || updateUser.isPending;

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        password: '',
        name: user.name || '',
        role: user.role as 'admin' | 'agent' | 'viewer',
      });
    } else {
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'agent',
      });
    }
    setErrors({});
  }, [user, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!isEditing && !formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (!isEditing && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (isEditing && user) {
        await updateUser.mutateAsync({
          id: user.id,
          name: formData.name,
          role: formData.role,
        });
      } else {
        await createUser.mutateAsync({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
        });
      }
      onClose();
    } catch (error: any) {
      if (error.response?.data?.message) {
        setErrors({ submit: error.response.data.message });
      }
    }
  };

  if (!isOpen) return null;

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
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {isEditing ? 'Edit User' : 'New User'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{errors.submit}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className={labelClasses}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isEditing}
              placeholder="user@example.com"
              className={cn(
                inputClasses,
                errors.email && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                isEditing && 'bg-muted cursor-not-allowed opacity-60'
              )}
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Password (only for new users) */}
          {!isEditing && (
            <div>
              <label className={labelClasses}>
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className={cn(
                  inputClasses,
                  errors.password && 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                )}
              />
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-500">{errors.password}</p>
              )}
            </div>
          )}

          {/* Name */}
          <div>
            <label className={labelClasses}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Full name"
              className={cn(
                inputClasses,
                errors.name && 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              )}
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className={labelClasses}>Role</label>
            <SimpleSelect
              value={formData.role}
              onChange={(value) => setFormData((prev) => ({ ...prev, role: value as 'admin' | 'agent' | 'viewer' }))}
              options={[
                { value: 'admin', label: 'Admin', description: 'Full access' },
                { value: 'agent', label: 'Agent', description: 'Can chat and manage contacts' },
                { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
              ]}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50 bg-secondary/30 rounded-b-2xl">
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
              : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
