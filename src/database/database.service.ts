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
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const ssl = configService.get<string>('DATABASE_SSL') !== 'false';

    super({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString,
          ssl,
        }),
      }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.destroy();
  }
}
