import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@whatsapp-crm/shared';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onResetPassword: (user: User) => void;
  currentUserId?: string;
}

export function UserTable({
  users,
  onEdit,
  onDelete,
  onResetPassword,
  currentUserId,
}: UserTableProps) {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300';
      case 'agent':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300';
      case 'viewer':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-whatsapp-primary flex items-center justify-center text-white font-medium">
                      {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-foreground">
                      {user.name || 'Unnamed'}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${getRoleBadge(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.isActive !== false
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                  }`}
                >
                  {user.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {user.createdAt &&
                  formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-whatsapp-primary hover:text-whatsapp-dark"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onResetPassword(user)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    Reset Password
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => onDelete(user)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
