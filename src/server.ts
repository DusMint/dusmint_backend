import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as dotenv from 'dotenv';

import { authRoutes } from './routes/auth';
import { clusterRoutes } from './routes/clusters';
import { catalogRoutes } from './routes/catalog';
import { orderRoutes } from './routes/orders';
import { claimRoutes } from './routes/claims';
import { vendorRoutes } from './routes/vendor';

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const jwtSecret = process.env.JWT_SECRET || 'dusmint-secret-key-32-chars-minimum-prod-2026';

const fastify = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
            },
          }
        : undefined,
  },
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function main() {
  // Security & standard plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  // JWT Authentication
  await fastify.register(jwt, {
    secret: jwtSecret,
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ message: 'Unauthorized. Please login with OTP.' });
    }
  });

  // OpenAPI / Swagger Documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Dusmint Backend API',
        description: 'Decentralised hyperlocal grocery delivery API for Tier 2/3 India',
        version: '1.0.0',
      },
      servers: [{ url: `http://${host}:${port}` }],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Healthcheck
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'dusmint-backend-api',
  }));

  // Mount API V1 Modules
  await fastify.register(authRoutes, { prefix: '/api/v1' });
  await fastify.register(clusterRoutes, { prefix: '/api/v1' });
  await fastify.register(catalogRoutes, { prefix: '/api/v1' });
  await fastify.register(orderRoutes, { prefix: '/api/v1' });
  await fastify.register(claimRoutes, { prefix: '/api/v1' });
  await fastify.register(vendorRoutes, { prefix: '/api/v1' });

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 DusMint API Server running at http://${host}:${port}`);
    fastify.log.info(`📖 Interactive API Documentation available at http://${host}:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }