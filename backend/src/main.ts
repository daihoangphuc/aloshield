import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './shared/adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get('NODE_ENV') || 'development';
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:3000';

  // Build allowed origins array
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'https://aloshield.phucndh.site',
  ].filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates

  console.log(`🔧 Environment: ${nodeEnv}`);
  console.log(`🌐 Frontend URL: ${frontendUrl}`);
  console.log(`🌍 Allowed Origins: ${allowedOrigins.join(', ')}`);

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // Response compression (gzip/brotli)
  app.use(compression({
    filter: (req, res) => {
      // Don't compress if client explicitly requests no compression
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use default compression filter
      return compression.filter(req, res);
    },
    threshold: 512, // Only compress responses larger than 512B (Optimized for JSON)
    level: 6, // Compression level (1-9, 6 is good balance)
  }));

  // CORS - Allow frontend origins
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
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

  // Setup Redis adapter for Socket.io (enable horizontal scaling)
  const redisAdapter = new RedisIoAdapter(app, configService);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  console.log(`🚀 ALO Shield Backend running on: http://localhost:${port}`);
  console.log(`📡 API available at: http://localhost:${port}/api`);
}

bootstrap();


