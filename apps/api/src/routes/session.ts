import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, extractSessionFromRequest } from '../services/auth.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const authService = new AuthService(prisma);

export async function sessionRoutes(fastify: FastifyInstance) {
  /**
   * POST /session/start - Start a new session
   */
  fastify.post<{ 
    Body: { playerHandle?: string } 
  }>('/session/start', {
    handler: async (request: FastifyRequest<{ Body: { playerHandle?: string } }>, reply: FastifyReply) => {
      try {
        const { playerHandle } = request.body || {};
        
        const result = await authService.startSession(playerHandle);
        
        // Set session cookie
        reply.setCookie('session', result.session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });

        return reply.code(200).send({
          player: result.player,
          session: {
            id: result.session.id,
            // Don't return the raw token in response body for security
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  });

  /**
   * GET /session/resume - Resume existing session
   */
  fastify.get('/session/resume', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const token = extractSessionFromRequest(
          request.headers.authorization,
          request.cookies
        );

        if (!token) {
          return reply.code(401).send({ error: 'No session token provided' });
        }

        const sessionData = await authService.resumeSession(token);

        if (!sessionData) {
          return reply.code(401).send({ error: 'Invalid or expired session' });
        }

        return reply.code(200).send({
          player: {
            id: sessionData.playerId,
            handle: sessionData.handle,
          },
          session: {
            id: sessionData.sessionId,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  });

  /**
   * POST /session/end - End current session
   */
  fastify.post('/session/end', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const token = extractSessionFromRequest(
          request.headers.authorization,
          request.cookies
        );

        if (!token) {
          return reply.code(401).send({ error: 'No session token provided' });
        }

        const sessionData = await authService.validateSession(token);

        if (!sessionData) {
          return reply.code(401).send({ error: 'Invalid session' });
        }

        const success = await authService.endSession(sessionData.sessionId);

        if (success) {
          // Clear session cookie
          reply.clearCookie('session', { path: '/' });
          return reply.code(200).send({ message: 'Session ended successfully' });
        } else {
          return reply.code(500).send({ error: 'Failed to end session' });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  });

  /**
   * GET /session/validate - Validate current session (for debugging)
   */
  fastify.get('/session/validate', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const token = extractSessionFromRequest(
          request.headers.authorization,
          request.cookies
        );

        if (!token) {
          return reply.code(401).send({ error: 'No session token provided' });
        }

        const sessionData = await authService.validateSession(token);

        if (!sessionData) {
          return reply.code(401).send({ 
            valid: false, 
            error: 'Invalid or expired session' 
          });
        }

        return reply.code(200).send({
          valid: true,
          player: {
            id: sessionData.playerId,
            handle: sessionData.handle,
          },
          session: {
            id: sessionData.sessionId,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  });
}

/**
 * Session validation middleware
 */
export async function validateSessionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = extractSessionFromRequest(
    request.headers.authorization,
    request.cookies
  );

  if (!token) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  const sessionData = await authService.validateSession(token);

  if (!sessionData) {
    return reply.code(401).send({ error: 'Invalid or expired session' });
  }

  // Add session data to request context
  (request as any).session = sessionData;
}