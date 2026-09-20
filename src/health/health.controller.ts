import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
    @Get()
    check() {
        return {
            ok: true,
            service: 'smarky-logistics',
            version: '0.1.0',
            timestamp: new Date().toISOString(),
        };
    }
}