import { Controller, Get, Module, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import {
  DEFAULT_CORS_EXCLUDED_PATH_PREFIXES,
  createCorsOptionsDelegate
} from '#/bootstrap/http-application.bootstrap';

const ALLOWED_ORIGIN = 'http://127.0.0.1:4201';

@Controller()
class CorsProbeController {
  @Get('sales')
  listSales(): { ok: boolean } {
    return { ok: true };
  }

  @Post('internal/manager-approvals/verifications')
  verify(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [CorsProbeController] })
class CorsProbeModule {}

describe('CORS exclusion of internal paths (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(CorsProbeModule, { logger: false });
    app.enableCors(
      createCorsOptionsDelegate([ALLOWED_ORIGIN], DEFAULT_CORS_EXCLUDED_PATH_PREFIXES)
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps sending CORS headers to an allowed origin on a public path', async () => {
    const response = await request(app.getHttpServer()).get('/sales').set('Origin', ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('sends no CORS headers for an internal path, even from an allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/manager-approvals/verifications')
      .set('Origin', ALLOWED_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers an internal preflight without CORS headers', async () => {
    const response = await request(app.getHttpServer())
      .options('/internal/manager-approvals/verifications')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-methods']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toBeUndefined();
  });

  it('sends no CORS headers when the internal path is written in another case', async () => {
    const response = await request(app.getHttpServer())
      .post('/INTERNAL/manager-approvals/verifications')
      .set('Origin', ALLOWED_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
