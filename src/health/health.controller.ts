import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';

@Controller('health')
export class HealthController {
    @Get()
    @Public()
    check() {
        return {
            ok: true,
            service: 'smarky-logistics',
            version: '0.1.0',
            timestamp: new Date().toISOString(),
        };
    }
}
