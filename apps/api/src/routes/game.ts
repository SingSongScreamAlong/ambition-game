import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  intentParser,
  ambition,
  goalGen,
  graphForge,
  worldGen,
  dsl,
  planner,
  dynamicPlanner,
  sim,
  events,
  factions,
  factionPlanner,
  influence,
  diplomacy,
  vassalage,
  court,
  RequirementGraph,
  WorldState,
  ActionProposal,
  EventCard
} from '@ambition/oracle-engine';
import {
  StartGameSchema,
  ChooseActionSchema,
  AdvanceGameSchema,
  StartGameRequest,
  ChooseActionRequest,
  AdvanceGameRequest,
  GameStartResponse,
  GameStateResponse,
  AdvanceResponse,
  ChooseResponse,
} from '../schemas/index.js';
import { GameStateDBRepository } from '../repository/gameStateDB.js';
import { validateSessionMiddleware } from './session.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const gameStateRepository = new GameStateDBRepository(prisma);

export async function gameRoutes(fastify: FastifyInstance) {
  // Load knowledge base once at startup
  const knowledgeBase = dsl.createBasicKnowledgeBase();

  /**
   * POST /start - Start a new game (requires authentication)
   */
  fastify.post<{ Body: StartGameRequest }>('/start', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest<{ Body: StartGameRequest }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const validatedBody = StartGameSchema.parse(request.body);
        const { rawAmbition, seed } = validatedBody;
        const gameSeed = seed || Math.floor(Math.random() * 1000000);

        // Get session data from middleware
        const session = (request as any).session;
        if (!session) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        // 1. Parse ambition using DAS
        const ambitionProfile = ambition.parseAmbition(rawAmbition);

        // 2. Generate dynamic requirement graph
        const rng = new worldGen.SeededRandom(gameSeed + 1000);
        const graph = goalGen.generateDynamicGoals(ambitionProfile, rng, 5, 3);

        // 3. Generate world with domain bias
        const world = worldGen.seed(ambitionProfile, gameSeed);
        world.playerId = session.playerId; // Use authenticated player ID

        // 4. Generate initial proposals using dynamic planner
        const proposals = dynamicPlanner.proposeDynamic({ 
          graph, 
          world, 
          ambitionProfile, 
          kb: knowledgeBase 
        });

        // 5. Generate initial events (usually empty for new game)
        const initialEvents: EventCard[] = [];

        // 6. Store session in database
        const gameSession = await gameStateRepository.createSession(
          session.playerId,
          graph,
          world,
          proposals,
          initialEvents
        );

        // Store ambition profile in world for later retrieval
        (world as any).ambitionProfile = ambitionProfile;

        const response: GameStartResponse = {
          ambition: ambitionProfile as any, // Legacy compatibility
          graph,
          world,
          proposals,
          events: initialEvents,
        };

        return reply.code(200).send(response);
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
   * GET /state - Get current game state (requires authentication)
   */
  fastify.get('/state', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get session data from middleware
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const response: GameStateResponse = {
          graph: session.graph,
          world: session.world,
          pendingActions: session.pendingActions,
          lastEvents: session.lastEvents,
        };

        return reply.code(200).send(response);
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
   * POST /choose - Choose an action or event choice (requires authentication)
   */
  fastify.post<{ Body: ChooseActionRequest }>('/choose', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest<{ Body: ChooseActionRequest }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const validatedBody = ChooseActionSchema.parse(request.body);
        const { actionId, choiceId } = validatedBody;

        // Get session data from middleware
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        // Find the action
        const action = session.pendingActions.find(a => a.id === actionId);
        if (!action) {
          return reply.code(400).send({ error: 'Action not found' });
        }

        // Check if action is affordable
        if (action.costs) {
          for (const [resource, cost] of Object.entries(action.costs)) {
            const available = session.world.resources[resource as keyof typeof session.world.resources];
            if (typeof cost === 'number' && cost > available) {
              return reply.code(400).send({ 
                error: `Insufficient ${resource}`,
                required: cost,
                available 
              });
            }
          }
        }

        // Apply action and advance one tick
        const prevWorld = JSON.parse(JSON.stringify(session.world));
        const newWorld = sim.tick(session.world, [action]);

        // Update requirement graph if action satisfies requirements
        const updatedGraph = updateGraphProgress(session.graph, action);

        // Generate events from changes
        const newEvents = events.alchemize(prevWorld, newWorld);

        // Generate new proposals
        const newProposals = planner.propose({ 
          graph: updatedGraph, 
          world: newWorld, 
          kb: knowledgeBase 
        });

        // Update session
        const updatedSession = await gameStateRepository.updateSession(sessionData.playerId, {
          graph: updatedGraph,
          world: newWorld,
          pendingActions: newProposals,
          lastEvents: newEvents,
        });

        // Save snapshot after action
        if (updatedSession) {
          await gameStateRepository.saveSnapshot(newWorld.seed, updatedSession);
        }

        const response: ChooseResponse = {
          world: newWorld,
          events: newEvents,
          proposals: newProposals,
        };

        return reply.code(200).send(response);
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
   * POST /advance - Advance one tick without taking action (requires authentication)
   */
  fastify.post('/advance', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get session data from middleware
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        // Advance world by one tick without actions
        const prevWorld = JSON.parse(JSON.stringify(session.world));
        const newWorld = sim.tick(session.world, []);

        // Generate events from natural changes
        const newEvents = events.alchemize(prevWorld, newWorld);

        // Generate new proposals
        const newProposals = planner.propose({ 
          graph: session.graph, 
          world: newWorld, 
          kb: knowledgeBase 
        });

        // Update session
        const updatedSession = await gameStateRepository.updateSession(sessionData.playerId, {
          world: newWorld,
          pendingActions: newProposals,
          lastEvents: newEvents,
        });

        // Save snapshot every tick (configurable in future)
        if (updatedSession) {
          await gameStateRepository.saveSnapshot(newWorld.seed, updatedSession);
        }

        const response: AdvanceResponse = {
          world: newWorld,
          events: newEvents,
          proposals: newProposals,
        };

        return reply.code(200).send(response);
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
   * GET /diplomacy/influence - Get player influence status
   */
  fastify.get<{ Querystring: { playerId: string } }>('/diplomacy/influence', {
    handler: async (request: FastifyRequest<{ Querystring: { playerId: string } }>, reply: FastifyReply) => {
      try {
        const { playerId } = request.query;
        const session = await gameStateRepository.getSession(playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const world = session.world;
        const playerInfluence = influence.initializePlayerInfluence(world);
        const factionAmbitions = factions.generateFactionAmbitions(world, world.seed);
        const influenceSummary = influence.getInfluenceSummary(playerInfluence, factionAmbitions);

        return reply.send({
          playerInfluence,
          influenceSummary,
          reputation: playerInfluence.reputation
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
   * POST /diplomacy/negotiate - Negotiate with a faction
   */
  fastify.post<{ Body: { playerId: string; factionId: string; offer: any } }>('/diplomacy/negotiate', {
    handler: async (request: FastifyRequest<{ Body: { playerId: string; factionId: string; offer: any } }>, reply: FastifyReply) => {
      try {
        const { playerId, factionId, offer } = request.body;
        const session = await gameStateRepository.getSession(playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const world = session.world;
        const faction = world.factions.find(f => f.id === factionId);
        if (!faction) {
          return reply.code(404).send({ error: 'Faction not found' });
        }

        const playerInfluence = influence.initializePlayerInfluence(world);
        const factionAmbitions = factions.generateFactionAmbitions(world, world.seed);
        const factionAmbition = factionAmbitions.find(fa => fa.factionId === factionId);
        
        if (!factionAmbition) {
          return reply.code(404).send({ error: 'Faction ambition not found' });
        }

        const diplomacyState = diplomacy.initializeDiplomacyState();
        const result = diplomacy.evaluateOffer(offer, factionAmbition, world, playerInfluence, diplomacyState, world.seed);

        return reply.send({
          success: result.success,
          treaty: result.treaty,
          reason: result.reason,
          reputation_change: result.reputation_change,
          counterOffer: result.counterOffer
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
   * GET /diplomacy/treaties - Get all active treaties
   */
  fastify.get<{ Querystring: { playerId: string } }>('/diplomacy/treaties', {
    handler: async (request: FastifyRequest<{ Querystring: { playerId: string } }>, reply: FastifyReply) => {
      try {
        const { playerId } = request.query;
        const session = await gameStateRepository.getSession(playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const world = session.world;
        const diplomacyState = diplomacy.initializeDiplomacyState();
        const activeTreaties = diplomacy.getPlayerTreaties(diplomacyState);

        return reply.send({
          treaties: activeTreaties,
          count: activeTreaties.length
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
   * GET /court/events - Get current court events
   */
  fastify.get<{ Querystring: { playerId: string } }>('/court/events', {
    handler: async (request: FastifyRequest<{ Querystring: { playerId: string } }>, reply: FastifyReply) => {
      try {
        const { playerId } = request.query;
        const session = await gameStateRepository.getSession(playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const world = session.world;
        const playerInfluence = influence.initializePlayerInfluence(world);
        const factionAmbitions = factions.generateFactionAmbitions(world, world.seed);
        const courtState = court.initializeCourtState();
        const courtEvents = court.generateCourtEvents(world, playerInfluence, factionAmbitions, courtState, world.seed);

        return reply.send({
          events: courtEvents,
          courtState: courtState
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
   * POST /court/respond - Respond to a court event
   */
  fastify.post<{ Body: { playerId: string; eventId: string; choiceId: string } }>('/court/respond', {
    handler: async (request: FastifyRequest<{ Body: { playerId: string; eventId: string; choiceId: string } }>, reply: FastifyReply) => {
      try {
        const { playerId, eventId, choiceId } = request.body;
        const session = await gameStateRepository.getSession(playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const world = session.world;
        const playerInfluence = influence.initializePlayerInfluence(world);
        const factionAmbitions = factions.generateFactionAmbitions(world, world.seed);
        const courtState = court.initializeCourtState();
        
        const result = court.processCourtChoice(eventId, choiceId, world, playerInfluence, factionAmbitions, courtState);

        return reply.send({
          outcome: result.outcome,
          influence_changes: result.influenceChanges,
          resource_changes: result.resourceChanges,
          new_events: result.newEvents
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
   * GET /vassalage/status - Get vassalage relationships
   */
  fastify.get<{ Querystring: { playerId: string } }>('/vassalage/status', {
    handler: async (request: FastifyRequest<{ Querystring: { playerId: string } }>, reply: FastifyReply) => {
      try {
        const { playerId } = request.query;
        const session = await gameStateRepository.getSession(playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const world = session.world;
        const playerInfluence = influence.initializePlayerInfluence(world);
        const factionAmbitions = factions.generateFactionAmbitions(world, world.seed);
        
        // Get player's vassals (this would be stored in game state in real implementation)
        const vassals: any[] = []; // Empty for now, would load from persistence
        
        const vassalInfo = vassals.map(vassal => ({
          ...vassal,
          loyalty: vassalage.calculateVassalLoyalty(vassal, world, playerInfluence, factionAmbitions.find(fa => fa.factionId === vassal.factionId)!)
        }));

        return reply.send({
          vassals: vassalInfo,
          total_vassals: vassals.length
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
   * GET /debug/stats - Get repository statistics (debug endpoint)
   */
  fastify.get('/debug/stats', async (request, reply) => {
    const stats = gameStateRepository.getStats();
    return reply.send(stats);
  });

  /**
   * GET /debug/factions - Get faction ambitions and relationships for all active games
   */
  fastify.get('/debug/factions', async (request, reply) => {
    try {
      const activeSessions = await gameStateRepository.getAllSessions();
      const factionDebugData = [];

      for (const session of activeSessions) {
        const world = session.world;
        
        // Generate faction ambitions and relationships for this world
        const factionAmbitions = factions.generateFactionAmbitions(world, world.seed);
        const factionRelationships = factions.generateFactionRelationships(world, world.seed);
        
        // Calculate faction influence and power balance
        const powerBalance = factionPlanner.getFactionPowerBalance(world);
        const factionInfluences = world.factions.map((faction: any) => ({
          factionId: faction.id,
          name: faction.name,
          influence: factionPlanner.calculateFactionInfluence(faction, world),
          powerShare: powerBalance[faction.id] || 0
        }));

        // Group factions by archetype
        const factionsByArchetype = factions.getFactionsByArchetype(factionAmbitions);

        factionDebugData.push({
          playerId: world.playerId,
          tick: world.tick,
          worldSeed: world.seed,
          factionCount: world.factions.length,
          regionCount: world.regions.length,
          factionAmbitions: factionAmbitions.map((fa: any) => ({
            factionId: fa.factionId,
            factionName: world.factions.find((f: any) => f.id === fa.factionId)?.name || 'Unknown',
            archetype: fa.profile.archetype,
            dominantDomains: {
              power: fa.profile.power.toFixed(2),
              wealth: fa.profile.wealth.toFixed(2),
              faith: fa.profile.faith.toFixed(2),
              virtue: fa.profile.virtue.toFixed(2),
              freedom: fa.profile.freedom.toFixed(2),
              creation: fa.profile.creation.toFixed(2)
            },
            modifiers: fa.profile.modifiers,
            currentGoals: fa.currentGoals,
            lastAction: fa.lastAction,
            cooldown: fa.plannerCooldown
          })),
          factionRelationships: factionRelationships.map((rel: any) => ({
            factionA: world.factions.find((f: any) => f.id === rel.factionA)?.name || rel.factionA,
            factionB: world.factions.find((f: any) => f.id === rel.factionB)?.name || rel.factionB,
            stance: rel.stance,
            strength: rel.strength.toFixed(2),
            historyLength: rel.history.length
          })),
          powerBalance: factionInfluences,
          archetypeDistribution: Object.fromEntries(
            Object.entries(factionsByArchetype).map(([archetype, factionList]: [string, any]) => [
              archetype,
              factionList.length
            ])
          ),
          summary: {
            alliedRelationships: factionRelationships.filter(r => r.stance === 'allied').length,
            hostileRelationships: factionRelationships.filter(r => r.stance === 'hostile').length,
            tradeRelationships: factionRelationships.filter(r => r.stance === 'trade').length,
            warRelationships: factionRelationships.filter(r => r.stance === 'war').length,
            averageRelationshipStrength: (
              factionRelationships.reduce((sum, r) => sum + r.strength, 0) / 
              factionRelationships.length
            ).toFixed(2),
            mostPowerfulFaction: factionInfluences.length > 0 ? factionInfluences.reduce((max: any, curr: any) => 
              curr.powerShare > max.powerShare ? curr : max
            ) : null,
            balanceOfPower: factionInfluences.some((f: any) => f.powerShare > 0.4) ? 'Hegemonic' :
                           factionInfluences.filter((f: any) => f.powerShare > 0.2).length <= 2 ? 'Bipolar' :
                           'Multipolar'
          }
        });
      }

      return reply.send({
        timestamp: new Date().toISOString(),
        totalActiveSessions: activeSessions.length,
        factionAnalysis: factionDebugData
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Update requirement graph when actions satisfy requirements
 */
function updateGraphProgress(graph: RequirementGraph, action: ActionProposal): RequirementGraph {
  const updatedGraph = JSON.parse(JSON.stringify(graph));

  // Mark satisfied requirements as met
  for (const satisfiedReq of action.satisfies) {
    const node = updatedGraph.nodes.find((n: any) => n.id === satisfiedReq);
    if (node) {
      node.status = 'met';
    }
  }

  return updatedGraph;
}