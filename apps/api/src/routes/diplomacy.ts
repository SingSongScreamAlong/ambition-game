import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateSessionMiddleware } from './session.js';
import { WebSocketManager } from '../services/websocket.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function diplomacyRoutes(fastify: FastifyInstance, wsManager: WebSocketManager) {
  /**
   * POST /diplomacy/propose - Propose a treaty to another player
   */
  fastify.post<{
    Body: {
      toPlayerId: string;
      treatyType: string;
      terms: any[];
    }
  }>('/diplomacy/propose', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest<{
      Body: {
        toPlayerId: string;
        treatyType: string;
        terms: any[];
      }
    }>, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { toPlayerId, treatyType, terms } = request.body;

        // Validate target player exists
        const targetPlayer = await prisma.player.findUnique({
          where: { id: toPlayerId }
        });

        if (!targetPlayer) {
          return reply.code(404).send({ error: 'Target player not found' });
        }

        // Validate treaty type
        const validTreatyTypes = ['non_aggression', 'trade', 'alliance', 'defense', 'access'];
        if (!validTreatyTypes.includes(treatyType)) {
          return reply.code(400).send({ 
            error: 'Invalid treaty type',
            validTypes: validTreatyTypes
          });
        }

        // Create treaty proposal via WebSocket manager
        const proposal = await wsManager.createTreatyProposal(
          sessionData.playerId,
          toPlayerId,
          treatyType,
          terms
        );

        return reply.code(200).send({
          success: true,
          proposal: {
            id: proposal.id,
            treatyType: proposal.treatyType,
            terms: proposal.terms,
            status: proposal.status,
            expiresAt: proposal.expiresAt
          }
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * POST /diplomacy/respond - Respond to a treaty proposal
   */
  fastify.post<{
    Body: {
      treatyId: string;
      response: 'accept' | 'decline';
    }
  }>('/diplomacy/respond', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest<{
      Body: {
        treatyId: string;
        response: 'accept' | 'decline';
      }
    }>, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { treatyId, response } = request.body;

        if (!['accept', 'decline'].includes(response)) {
          return reply.code(400).send({ 
            error: 'Invalid response',
            validResponses: ['accept', 'decline']
          });
        }

        // Respond to treaty proposal via WebSocket manager
        const updatedProposal = await wsManager.respondToTreatyProposal(
          treatyId,
          sessionData.playerId,
          response
        );

        if (!updatedProposal) {
          return reply.code(404).send({ error: 'Treaty proposal not found' });
        }

        return reply.code(200).send({
          success: true,
          proposal: {
            id: updatedProposal.id,
            treatyType: updatedProposal.treatyType,
            status: updatedProposal.status,
            response
          }
        });

      } catch (error) {
        if (error instanceof Error && error.message.includes('Not authorized')) {
          return reply.code(403).send({ error: error.message });
        }
        
        if (error instanceof Error && error.message.includes('no longer pending')) {
          return reply.code(400).send({ error: error.message });
        }

        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * GET /diplomacy/proposals - Get pending treaty proposals
   */
  fastify.get('/diplomacy/proposals', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const proposals = wsManager.getPendingTreatyProposals(sessionData.playerId);

        return reply.code(200).send({
          proposals: proposals.map(proposal => ({
            id: proposal.id,
            fromPlayerId: proposal.fromPlayerId,
            toPlayerId: proposal.toPlayerId,
            treatyType: proposal.treatyType,
            terms: proposal.terms,
            status: proposal.status,
            createdAt: proposal.createdAt,
            expiresAt: proposal.expiresAt,
            isIncoming: proposal.toPlayerId === sessionData.playerId,
            isOutgoing: proposal.fromPlayerId === sessionData.playerId
          }))
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * GET /diplomacy/players - Get list of players available for diplomacy
   */
  fastify.get('/diplomacy/players', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        // Get all players except the current one
        const players = await prisma.player.findMany({
          where: {
            id: { not: sessionData.playerId }
          },
          select: {
            id: true,
            handle: true,
            createdAt: true
          }
        });

        // Add online status from WebSocket manager
        const connectedPlayerIds = wsManager.getConnectedPlayerIds();
        const playersWithStatus = players.map((player: any) => ({
          ...player,
          isOnline: connectedPlayerIds.includes(player.id)
        }));

        return reply.code(200).send({
          players: playersWithStatus
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * GET /diplomacy/status - Get diplomacy status and statistics
   */
  fastify.get('/diplomacy/status', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const pendingProposals = wsManager.getPendingTreatyProposals(sessionData.playerId);
        const connectedPlayers = wsManager.getConnectedPlayersCount();

        const incomingProposals = pendingProposals.filter(p => p.toPlayerId === sessionData.playerId);
        const outgoingProposals = pendingProposals.filter(p => p.fromPlayerId === sessionData.playerId);

        return reply.code(200).send({
          status: {
            connectedPlayers,
            pendingProposals: pendingProposals.length,
            incomingProposals: incomingProposals.length,
            outgoingProposals: outgoingProposals.length
          }
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * DELETE /diplomacy/proposal/:treatyId - Cancel an outgoing treaty proposal
   */
  fastify.delete<{
    Params: { treatyId: string }
  }>('/diplomacy/proposal/:treatyId', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest<{
      Params: { treatyId: string }
    }>, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { treatyId } = request.params;

        // For now, we'll implement this as "decline" from the proposer's side
        // In a full implementation, this would be a separate method
        const proposals = wsManager.getPendingTreatyProposals(sessionData.playerId);
        const proposal = proposals.find(p => p.id === treatyId && p.fromPlayerId === sessionData.playerId);

        if (!proposal) {
          return reply.code(404).send({ error: 'Treaty proposal not found or not authorized' });
        }

        // Cancel by declining from sender side
        await wsManager.respondToTreatyProposal(treatyId, sessionData.playerId, 'decline');

        return reply.code(200).send({
          success: true,
          message: 'Treaty proposal cancelled'
        });

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });
}