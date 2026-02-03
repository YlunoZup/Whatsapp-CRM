import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function formatPhoneNumber(phone: string) {
  // Simple formatting - can be enhanced with libphonenumber-js
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    const country = cleaned.slice(0, 2);
    const area = cleaned.slice(2, 4);
    const first = cleaned.slice(4, 9);
    const second = cleaned.slice(9);
    return `+${country} (${area}) ${first}-${second}`;
  }
  return phone;
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
