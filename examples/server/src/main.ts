import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestUwsAdapter } from '@torlnapp/nest-uws-adapter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new NestUwsAdapter({ path: '/ws' }));

  await app.listen(3000);

  console.log(`HTTP server ready at ${await app.getUrl()}`);
  console.log('WebSocket endpoint ws://localhost:3001/ws (MsgPack packets)');
}

bootstrap();
