import crypto from 'node:crypto';
import { promisify } from 'node:util';
const pbkdf2 = promisify(crypto.pbkdf2);
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export async function hashPassword(value: string) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = await pbkdf2(value, salt, 210000, 32, 'sha256');
  return `pbkdf2_sha256$210000$${salt}$${hash.toString('base64url')}`;
}
export async function verifyPassword(value: string, stored?: string) {
  const [, count, salt, encoded] = (stored ?? 'pbkdf2_sha256$210000$invalid$invalid').split('$');
  const actual = await pbkdf2(value, salt, Number(count), 32, 'sha256');
  const expected = Buffer.from(encoded, 'base64url');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
