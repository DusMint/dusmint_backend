import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

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

async function main() {
  // Security & standard plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });

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

  // Route Modules Mount
  fastify.get('/api/v1/clusters/check-serviceability', async (request, reply) => {
    const { lat, lng } = request.query as { lat?: string; lng?: string };
    return {
      clusterId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      clusterName: 'Indore Vijay Nagar Cluster 1',
      city: 'Indore',
      distanceMeters: 450,
      isServiceable: true,
    };
  });

  fastify.get('/api/v1/clusters/:clusterId/slots', async (request, reply) => {
    return [
      {
        id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        clusterId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: 'Morning Delivery (7:00 AM - 10:00 AM)',
        slotType: 'morning',
        startTime: '07:00:00',
        endTime: '10:00:00',
        orderCutoffTime: '06:00:00',
        maxOrdersCapacity: 60,
        isActive: true,
      },
      {
        id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
        clusterId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: 'Evening Delivery (5:00 PM - 8:00 PM)',
        slotType: 'evening',
        startTime: '17:00:00',
        endTime: '20:00:00',
        orderCutoffTime: '16:00:00',
        maxOrdersCapacity: 60,
        isActive: true,
      },
    ];
  });

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`Server running at http://${host}:${port}`);
    fastify.log.info(`API Docs available at http://${host}:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
