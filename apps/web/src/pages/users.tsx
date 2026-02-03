import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword } from '../hooks/use-users';
import { useAuthStore } from '../stores/auth-store';
import { DataTable, Column } from '../components/ui/DataTable';
import { SimpleSelect } from '@/components/ui/CustomSelect';
import type { User } from '@whatsapp-crm/shared';

interface UserFormData {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
}

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

  const { data: usersData, isLoading } = useUsers({ page, limit: 10, search });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetUserPassword();

  const users = usersData?.data || [];
  const pagination = usersData?.meta;

  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    name: '',
    role: 'agent',
  });
  const [formError, setFormError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.email || !formData.password || !formData.name) {
      setFormError('All fields are required');
      return;
    }

    if (formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    try {
      await createUser.mutateAsync(formData);
      setShowCreateModal(false);
      setFormData({ email: '', password: '', name: '', role: 'agent' });
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setFormError('');

    try {
      await updateUser.mutateAsync({
        id: editUser.id,
        name: formData.name,
        role: formData.role,
      });
      setEditUser(null);
      setFormData({ email: '', password: '', name: '', role: 'agent' });
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      await resetPassword.mutateAsync({ id: resetPasswordUser.id, newPassword });
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      setPasswordError(error.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteUser.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        isActive: !user.isActive,
      });
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const openEditModal = (user: User) => {
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role as 'admin' | 'agent' | 'viewer',
    });
    setEditUser(user);
    setFormError('');
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
      member: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      viewer: 'bg-muted text-foreground',
    };
    return styles[role] || styles.viewer;
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-whatsapp-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-whatsapp-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user) => (
        <span className={`px-2 py-1 text-xs rounded-full capitalize ${getRoleBadge(user.role)}`}>
          {user.role}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (user) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          user.isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
        }`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      sortable: true,
      render: (user) => (
        <span className="text-sm text-muted-foreground">
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (user) => (
        <div className="flex items-center justify-end gap-2">
          {isAdmin && user.id !== currentUser?.id && (
            <>
              <button
                onClick={() => handleToggleActive(user)}
                className={`p-1 rounded transition-colors ${
                  user.isActive
                    ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
                title={user.isActive ? 'Deactivate' : 'Activate'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={() => openEditModal(user)}
                className="p-1 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded transition-colors"
                title="Edit"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setResetPasswordUser(user)}
                className="p-1 text-muted-foreground hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950 rounded transition-colors"
                title="Reset Password"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </button>
              <button
                onClick={() => setDeleteConfirm(user)}
                className="p-1 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
          {user.id === currentUser?.id && (
            <span className="text-xs text-muted-foreground">You</span>
          )}
        </div>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">Access Denied</h2>
          <p className="text-yellow-600 dark:text-yellow-400 mt-1">
            Only administrators can access user management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage team members and their access levels
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ email: '', password: '', name: '', role: 'agent' });
            setFormError('');
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
        />
      </div>

      {/* Users Table */}
      <DataTable
        data={users}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No users found"
        searchable={false}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-border bg-card text-foreground rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-foreground">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-3 py-1 border border-border bg-card text-foreground rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Add New User</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                <SimpleSelect
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'agent' | 'viewer' })}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUser.isPending}
                  className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
                >
                  {createUser.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Edit User</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                <SimpleSelect
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'agent' | 'viewer' })}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUser.isPending}
                  className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
                >
                  {updateUser.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetPasswordUser(null)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Reset Password for {resetPasswordUser.name}
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPassword.isPending}
                  className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                >
                  {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
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
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete User</h3>
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
                disabled={deleteUser.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteUser.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
