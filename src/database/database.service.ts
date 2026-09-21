import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './database.types.js';

@Injectable()
export class DatabaseService
  extends Kysely<Database>
  implements OnApplicationShutdown
{
  constructor(configService: ConfigService) {
    const connectionString = withoutSslConnectionParameters(
      configService.getOrThrow<string>('DATABASE_URL'),
    );
    const sslEnabled = configService.get<string>('DATABASE_SSL') !== 'false';
    const rejectUnauthorized =
      configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED') !== 'false';

    super({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString,
          ssl: sslEnabled ? { rejectUnauthorized } : false,
        }),
      }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.destroy();
  }
}

function withoutSslConnectionParameters(connectionString: string): string {
  const url = new URL(connectionString);

  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl']) {
    url.searchParams.delete(parameter);
  }

  return url.toString();
}
