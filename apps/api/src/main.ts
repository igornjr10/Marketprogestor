import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true })

import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())

  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env['WEB_URL'] ?? 'http://localhost:3000', credentials: true })

  // Health check (used by Railway)
  const instance = app.getHttpAdapter().getInstance() as { get: (path: string, handler: () => object) => void }
  instance.get('/api/health', () => ({ status: 'ok' }))

  const port = parseInt(process.env['API_PORT'] ?? '3001', 10)
  await app.listen(port, '0.0.0.0')
  console.warn(`API running on port ${port}`)
}

bootstrap()
