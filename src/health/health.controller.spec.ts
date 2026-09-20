import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the service health payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T00:00:00.000Z'));

    try {
      const controller = new HealthController();

      expect(controller.check()).toEqual({
        ok: true,
        service: 'smarky-logistics',
        version: '0.1.0',
        timestamp: '2026-09-20T00:00:00.000Z',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
