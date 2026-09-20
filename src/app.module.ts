import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssignmentsModule } from './assignments/assignments.module.js';
import configuration from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { HealthModule } from './health/health.module.js';
import { RidersModule } from './riders/riders.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    AssignmentsModule,
    DeliveriesModule,
    HealthModule,
    RidersModule,
  ],
})
export class AppModule { }
