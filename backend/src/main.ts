import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get('NODE_ENV') || 'development';
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:3000';

  console.log(`🔧 Environment: ${nodeEnv}`);
  console.log(`🌐 Frontend URL: ${frontendUrl}`);

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // CORS - Allow frontend origin
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  console.log(`🚀 ALO Shield Backend running on: http://localhost:${port}`);
  console.log(`📡 API available at: http://localhost:${port}/api`);
}

bootstrap();


