import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiClientGuard } from './api-client.guard.js';
@Global()
@Module({ providers: [{ provide: APP_GUARD, useClass: ApiClientGuard }] })
export class AuthModule {}
