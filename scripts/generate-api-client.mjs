import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

const [name, clientType, tenantId] = process.argv.slice(2);
if (!name || !['internal_service', 'tenant_client'].includes(clientType) || (clientType === 'tenant_client' && !tenantId) || (clientType === 'internal_service' && tenantId)) {
  throw new Error('Usage: node scripts/generate-api-client.mjs <name> <internal_service|tenant_client> [tenantId]');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const token = `sml_${randomBytes(32).toString('base64url')}`;
const tokenHash = createHash('sha256').update(token).digest('hex');
const sslEnabled = process.env.DATABASE_SSL !== 'false';
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const pool = new pg.Pool({
  connectionString: withoutSslConnectionParameters(process.env.DATABASE_URL),
  ssl: sslEnabled ? { rejectUnauthorized } : false,
});
try { await pool.query('insert into api_clients (name, client_type, tenant_id, token_hash, token_prefix) values ($1, $2, $3, $4, $5)', [name, clientType, tenantId ?? null, tokenHash, token.slice(0, 12)]); console.log(token); } finally { await pool.end(); }

function withoutSslConnectionParameters(connectionString) {
  const url = new URL(connectionString);
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl']) url.searchParams.delete(parameter);
  return url.toString();
}
