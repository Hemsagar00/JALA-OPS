import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { newPasswordSchema } from '@jala-ops/validation';

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
export async function hashPassword(password: string): Promise<string> {
  newPasswordSchema.parse(password);
  const salt = Buffer.from(randomBytes(16)).toString('hex');
  return `scrypt-v1$${salt}$${Buffer.from(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (password.length > 128) return false;
  const match = /^scrypt-v1\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(encoded);
  if (!match?.[1] || !match[2]) return false;
  return timingSafeEqual(await derive(password, match[1]), Buffer.from(match[2], 'hex'));
}
