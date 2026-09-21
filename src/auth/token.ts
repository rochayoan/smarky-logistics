import { createHash, randomBytes } from 'node:crypto';
export const hashApiToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const generateApiToken = () => `sml_${randomBytes(32).toString('base64url')}`;
export const tokenPrefix = (token: string) => token.slice(0, 12);
