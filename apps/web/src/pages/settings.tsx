import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth-store';
import { api } from '../services/api';

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const queryClient = useQueryClient();

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Profile update mutation
  const updateProfile = useMutation({
    mutationFn: async (data: { name: string }): Promise<{ name: string }> => {
      const response = await api.patch<{ name: string }>('/auth/profile', data);
      return response.data;
    },
    onSuccess: (data) => {
      updateUser({ name: data.name });
      setProfileSuccess(true);
      setProfileError('');
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (error: any) => {
      setProfileError(error.response?.data?.message || 'Failed to update profile');
      setProfileSuccess(false);
    },
  });

  // Password update mutation
  const updatePassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.patch('/auth/password', data);
      return response.data;
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: any) => {
      setPasswordError(error.response?.data?.message || 'Failed to update password');
      setPasswordSuccess(false);
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileError('Name is required');
      return;
    }
    updateProfile.mutate({ name });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    updatePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Profile Section */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Profile</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg text-sm">
                Profile updated successfully!
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-border rounded-lg bg-muted cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Role</label>
              <input
                type="text"
                value={user?.role || ''}
                disabled
                className="w-full px-3 py-2 border border-border rounded-lg bg-muted cursor-not-allowed capitalize"
              />
            </div>
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
            >
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Change Password</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg text-sm">
                Password updated successfully!
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
              />
            </div>
            <button
              type="submit"
              disabled={updatePassword.isPending}
              className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
            >
              {updatePassword.isPending ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Notifications Section */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive email alerts for new messages</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-whatsapp-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Desktop Notifications</p>
                <p className="text-sm text-muted-foreground">Show browser notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-whatsapp-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Sound Notifications</p>
                <p className="text-sm text-muted-foreground">Play sound for new messages</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-whatsapp-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card rounded-lg shadow-sm border border-red-200 dark:border-red-900 p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
