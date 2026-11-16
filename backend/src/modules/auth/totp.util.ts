import * as crypto from 'crypto';

/**
 * RFC 6238 Time-Based One-Time Password (TOTP) Implementation
 * - HMAC-SHA1 algorithm with 30-second time-step
 * - 6-digit zero-padded decimal output
 * - Constant-time comparison to prevent timing attacks
 * - Window drift allowance (±1 time-step = ±30 seconds)
 */
export class TotpUtil {
  private static readonly TIME_STEP_SECONDS = 30;
  private static readonly DIGITS = 6;

  /**
   * Generates a cryptographically secure Base32 secret for TOTP enrollment
   */
  public static generateSecret(length: number = 20): string {
    const randomBytes = crypto.randomBytes(length);
    return this.base32Encode(randomBytes);
  }

  /**
   * Generates a 6-digit TOTP code for a given secret and counter
   */
  public static generateCode(secretBase32: string, timeStepCounter: number): string {
    const key = this.base32Decode(secretBase32);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(timeStepCounter));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation (RFC 4226)
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, this.DIGITS);
    return otp.toString().padStart(this.DIGITS, '0');
  }

  /**
   * Verifies a 6-digit TOTP code with time drift window (window = 1 means -30s to +30s)
   */
  public static verifyCode(
    token: string,
    secretBase32: string,
    window: number = 1
  ): { valid: boolean; timeStep: number } {
    if (!token || !/^\d{6}$/.test(token)) {
      return { valid: false, timeStep: 0 };
    }

    const currentEpochSeconds = Math.floor(Date.now() / 1000);
    const currentCounter = Math.floor(currentEpochSeconds / this.TIME_STEP_SECONDS);

    for (let i = -window; i <= window; i++) {
      const counter = currentCounter + i;
      const expectedCode = this.generateCode(secretBase32, counter);

      // Constant-time string comparison
      const tokenBuffer = Buffer.from(token);
      const expectedBuffer = Buffer.from(expectedCode);
      if (tokenBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
        return { valid: true, timeStep: counter };
      }
    }

    return { valid: false, timeStep: 0 };
  }

  // Base32 RFC 4648 Alphabet
  private static readonly B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  private static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += this.B32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.B32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private static base32Decode(base32String: string): Buffer {
    const cleaned = base32String.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const index = this.B32_ALPHABET.indexOf(char);
      if (index === -1) {
        throw new Error(`Invalid Base32 character: ${char}`);
      }
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}
