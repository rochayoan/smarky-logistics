import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { hashApiToken } from '../src/auth/token.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';
  const internalToken = 'sml_internal_test_token';
  const tenantToken = 'sml_tenant_test_token';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseMock())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      service: 'smarky-logistics',
      version: '0.1.0',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('/v1/riders (GET) rejects requests without a bearer token', () => {
    return request(app.getHttpServer()).get('/v1/riders').expect(401);
  });

  it('passes a valid internal bearer through the real guard and returns tenant-safe 404', () => {
    return request(app.getHttpServer()).get('/v1/deliveries/33333333-3333-4333-8333-333333333333').set('Authorization', `Bearer ${internalToken}`).set('X-Tenant-Id', tenantA).expect(404);
  });

  it('rejects an internal bearer without X-Tenant-Id', () => {
    return request(app.getHttpServer()).get('/v1/deliveries/33333333-3333-4333-8333-333333333333').set('Authorization', `Bearer ${internalToken}`).expect(400);
  });

  it('derives tenant-client context and rejects a conflicting header', async () => {
    await request(app.getHttpServer()).get('/v1/deliveries/33333333-3333-4333-8333-333333333333').set('Authorization', `Bearer ${tenantToken}`).expect(404);
    await request(app.getHttpServer()).get('/v1/deliveries/33333333-3333-4333-8333-333333333333').set('Authorization', `Bearer ${tenantToken}`).set('X-Tenant-Id', tenantB).expect(403);
  });

  afterEach(async () => {
    await app.close();
  });
});

function databaseMock() {
  return {
    selectFrom: (table: string) => {
      const query = {
        where: (column: string, _operator: string, value: string) => {
          if (table === 'api_clients' && column === 'token_hash') {
            query.row = value === hashApiToken('sml_internal_test_token') ? { id: 'client-internal', name: 'orders', client_type: 'internal_service', tenant_id: null } : value === hashApiToken('sml_tenant_test_token') ? { id: 'client-tenant', name: 'tenant-a', client_type: 'tenant_client', tenant_id: '11111111-1111-4111-8111-111111111111' } : undefined;
          }
          return query;
        },
        selectAll: () => query,
        executeTakeFirst: async () => query.row,
        row: undefined as unknown,
      };
      return query;
    },
  };
}
