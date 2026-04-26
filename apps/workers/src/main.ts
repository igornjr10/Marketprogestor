import { NestFactory } from '@nestjs/core'
import { WorkersModule } from './workers.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkersModule)
  app.enableShutdownHooks()
  console.warn('Workers running')
}

bootstrap()
