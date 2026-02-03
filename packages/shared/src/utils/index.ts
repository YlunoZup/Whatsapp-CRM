/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
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

/**
 * Convert phone number to WhatsApp JID
 */
export function phoneToWhatsAppId(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Extract phone number from WhatsApp JID
 */
export function whatsAppIdToPhone(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

/**
 * Check if a JID is a group
 */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/**
 * Format a date for display (relative time)
 */
export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString();
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await delay(baseDelay * Math.pow(2, i));
      }
    }
  }

  throw lastError;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if an object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Webhook signature verification
 */
export function verifyWebhookSignature(
  _payload: string,
  signature: string,
  _secret: string,
  _timestamp: string
): boolean {
  // This is a placeholder - actual implementation would use crypto
  // For now, just return true for development
  return signature.startsWith('sha256=');
}
