import * as crypto from 'crypto';

export class SecurityUtil {
  /**
   * Generate a cryptographically secure random string
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure API key
   */
  static generateApiKey(): string {
    const prefix = 'crm';
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Hash sensitive data for logging (partial masking)
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars * 2) {
      return '*'.repeat(data?.length || 0);
    }

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const masked = '*'.repeat(data.length - visibleChars * 2);

    return `${start}${masked}${end}`;
  }

  /**
   * Mask email for logging
   */
  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return this.maskSensitiveData(email);

    const maskedLocal =
      local.length > 2
        ? `${local.substring(0, 2)}${'*'.repeat(local.length - 2)}`
        : '*'.repeat(local.length);

    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask phone number for logging
   */
  static maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return '*'.repeat(phone.length);

    const lastFour = digits.slice(-4);
    const masked = '*'.repeat(digits.length - 4);
    return `${masked}${lastFour}`;
  }

  /**
   * Validate that a string doesn't contain potentially dangerous patterns
   */
  static isSafeString(str: string): boolean {
    // Check for common injection patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i, // onclick, onerror, etc.
      /\beval\s*\(/i,
      /\bexec\s*\(/i,
      /\bunion\s+select/i,
      /\bdrop\s+table/i,
      /\bdelete\s+from/i,
      /\binsert\s+into/i,
      /\bupdate\s+\w+\s+set/i,
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(str));
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  static escapeHtml(str: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return str.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
  }

  /**
   * Validate file type by magic bytes
   */
  static validateFileType(
    buffer: Buffer,
    allowedTypes: string[],
  ): { valid: boolean; detectedType?: string } {
    const magicBytes: Record<string, Buffer> = {
      'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
      'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'image/gif': Buffer.from([0x47, 0x49, 0x46, 0x38]),
      'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
      'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
    };

    for (const [type, magic] of Object.entries(magicBytes)) {
      if (buffer.slice(0, magic.length).equals(magic)) {
        return {
          valid: allowedTypes.includes(type),
          detectedType: type,
        };
      }
    }

    return { valid: false };
  }

  /**
   * Rate limit key generator
   */
  static generateRateLimitKey(
    tenantId: string,
    userId: string,
    action: string,
  ): string {
    return `ratelimit:${tenantId}:${userId}:${action}`;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
