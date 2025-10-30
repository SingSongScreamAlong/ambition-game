import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { gameRoutes } from './routes/game.js';
import { sessionRoutes } from './routes/session.js';
import { diplomacyRoutes } from './routes/diplomacy.js';
import { mapRoutes } from './routes/map.js';
import { WebSocketManager } from './services/websocket.js';
import { PrismaClient } from '@prisma/client';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    } : undefined,
  },
});

// Initialize services
const prisma = new PrismaClient();
const wsManager = new WebSocketManager(prisma);

// Error handler
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation,
    });
  }

  return reply.status(500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  });
});

// Register plugins
async function registerPlugins() {
  // Cookie support
  await server.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'ambition-cookie-secret-key',
  });

  // CORS
  await server.register(cors, {
    origin: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : false, // Configure for production
    credentials: true,
  });

  // WebSocket support
  await wsManager.register(server);

  // Health check route
  server.get('/health', async () => {
    const wsStats = {
      connectedPlayers: wsManager.getConnectedPlayersCount(),
      connectedPlayerIds: wsManager.getConnectedPlayerIds()
    };
    
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      websocket: wsStats
    };
  });

  // Session routes
  await server.register(sessionRoutes);

  // Diplomacy routes
  await server.register(async function (fastify) {
    await diplomacyRoutes(fastify, wsManager);
  });

  // Map routes
  await server.register(mapRoutes);

  // Game routes
  await server.register(gameRoutes);
}

// Start server
async function start() {
  try {
    await registerPlugins();

    const port = parseInt(process.env.API_PORT || '8787');
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

    await server.listen({ port, host });
    
    console.log(`🚀 API server ready at http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
    console.log(`🎮 Game API: http://${host}:${port}/start`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    // Cleanup WebSocket manager
    wsManager.cleanupExpiredProposals();
    
    // Close Prisma connection
    await prisma.$disconnect();
    
    // Close server
    await server.close();
    server.log.info('Server closed');
    process.exit(0);
  } catch (error) {
    server.log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};

// Periodic cleanup
setInterval(() => {
  const cleaned = wsManager.cleanupExpiredProposals();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired treaty proposals`);
  }
}, 60 * 60 * 1000); // Every hour

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  server.log.fatal(error, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  server.log.fatal({ promise, reason }, 'Unhandled rejection');
  process.exit(1);
});

start();