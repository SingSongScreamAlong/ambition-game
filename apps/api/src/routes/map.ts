import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateSessionMiddleware } from './session.js';
import { GameStateDBRepository } from '../repository/gameStateDB.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const gameStateRepository = new GameStateDBRepository(prisma);

export interface MapTile {
  id: string;
  x: number;
  y: number;
  type: 'land' | 'water' | 'mountain' | 'forest' | 'desert';
  elevation: number;
  resources?: string[];
  regionId?: string;
}

export interface MapEntity {
  id: string;
  type: 'region' | 'faction' | 'structure' | 'unit';
  x: number;
  y: number;
  data: any;
}

export interface RegionInfo {
  id: string;
  name: string;
  population: number;
  prosperity: number;
  stability: number;
  resources: Record<string, number>;
  legitimacy: {
    law: number;
    lineage: number;
    might: number;
    faith: number;
  };
  factionId?: string;
  factionName?: string;
  traits: string[];
  piety?: number;
  heresy?: number;
  unrest?: number;
}

export async function mapRoutes(fastify: FastifyInstance) {
  /**
   * GET /map/tiles - Get map tiles for the world
   */
  fastify.get('/map/tiles', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        // Generate map tiles from world regions
        const tiles: MapTile[] = session.world.regions.map((region, index) => {
          // Generate hex grid coordinates
          const row = Math.floor(index / 8);
          const col = index % 8;
          const x = col + (row % 2) * 0.5; // Offset alternate rows for hex grid
          const y = row * 0.866; // Height factor for hex grid

          // Determine tile type based on region properties (simplified since traits don't exist)
          let tileType: MapTile['type'] = 'land';
          // Use a simple hash of region ID to determine terrain variety
          const hash = region.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          if (hash % 5 === 0) tileType = 'water';
          else if (hash % 5 === 1) tileType = 'mountain';
          else if (hash % 5 === 2) tileType = 'forest';
          else if (hash % 5 === 3) tileType = 'desert';

          return {
            id: `tile_${region.id}`,
            x,
            y,
            type: tileType,
            elevation: tileType === 'mountain' ? 8 : 
                      tileType === 'forest' ? 5 : 2,
            resources: Object.keys(region.resources || {}),
            regionId: region.id
          };
        });

        return reply.code(200).send({
          tiles,
          worldSize: {
            width: 8,
            height: Math.ceil(session.world.regions.length / 8)
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
   * GET /map/entities - Get map entities (factions, structures, etc.)
   */
  fastify.get('/map/entities', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const entities: MapEntity[] = [];

        // Add regions as entities
        session.world.regions.forEach((region, index) => {
          const row = Math.floor(index / 8);
          const col = index % 8;
          const x = col + (row % 2) * 0.5;
          const y = row * 0.866;

          entities.push({
            id: `region_${region.id}`,
            type: 'region',
            x,
            y,
            data: {
              name: region.name,
              population: region.people.population,
              prosperity: region.people.prosperity,
              stability: region.security,
              controlled: region.controlled,
              lawfulness: region.lawfulness,
              unrest: region.unrest,
              piety: region.piety,
              heresy: region.heresy
            }
          });
        });

        // Add factions as entities
        session.world.factions.forEach(faction => {
          // Find faction's primary region (first controlled region)
          const primaryRegion = session.world.regions.find(r => faction.regions.includes(r.id));
          if (primaryRegion) {
            const regionIndex = session.world.regions.indexOf(primaryRegion);
            const row = Math.floor(regionIndex / 8);
            const col = regionIndex % 8;
            const x = col + (row % 2) * 0.5;
            const y = row * 0.866;

            entities.push({
              id: `faction_${faction.id}`,
              type: 'faction',
              x: x + 0.1, // Slight offset to avoid overlap
              y: y + 0.1,
              data: {
                name: faction.name,
                stance: faction.stance,
                power: faction.power,
                regionCount: faction.regions.length,
                domainAffinities: faction.domainAffinities
              }
            });
          }
        });

        return reply.code(200).send({
          entities
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
   * GET /map/region/:regionId - Get detailed region information
   */
  fastify.get<{
    Params: { regionId: string }
  }>('/map/region/:regionId', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest<{
      Params: { regionId: string }
    }>, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        const { regionId } = request.params;
        const region = session.world.regions.find(r => r.id === regionId);

        if (!region) {
          return reply.code(404).send({ error: 'Region not found' });
        }

        // Find controlling faction
        const controllingFaction = session.world.factions.find(f => f.regions.includes(region.id));

        const regionInfo: RegionInfo = {
          id: region.id,
          name: region.name,
          population: region.people.population,
          prosperity: region.people.prosperity,
          stability: region.security,
          resources: region.resources || {},
          legitimacy: {
            law: session.world.legitimacy?.law || 50,
            lineage: session.world.legitimacy?.lineage || 50,
            might: session.world.legitimacy?.might || 50,
            faith: session.world.legitimacy?.faith || 50
          },
          factionId: controllingFaction?.id || null,
          factionName: controllingFaction?.name,
          lawfulness: region.lawfulness,
          piety: region.piety,
          heresy: region.heresy,
          unrest: region.unrest
        };

        return reply.code(200).send({
          region: regionInfo
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
   * GET /map/overview - Get world overview and statistics
   */
  fastify.get('/map/overview', {
    preHandler: validateSessionMiddleware,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionData = (request as any).session;
        if (!sessionData) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const session = await gameStateRepository.getSession(sessionData.playerId);
        if (!session) {
          return reply.code(404).send({ error: 'Game session not found' });
        }

        // Calculate world statistics
        const totalPopulation = session.world.regions.reduce((sum, r) => sum + r.people.population, 0);
        const averageProsperity = session.world.regions.reduce((sum, r) => sum + r.people.prosperity, 0) / session.world.regions.length;
        const averageStability = session.world.regions.reduce((sum, r) => sum + r.security, 0) / session.world.regions.length;

        // Faction control statistics
        const factionControl = session.world.factions.map(faction => {
          const controlledRegions = session.world.regions.filter(r => faction.regions.includes(r.id));
          return {
            factionId: faction.id,
            factionName: faction.name,
            controlledRegions: controlledRegions.length,
            totalPopulation: controlledRegions.reduce((sum, r) => sum + r.people.population, 0),
            averageProsperity: controlledRegions.length > 0 
              ? controlledRegions.reduce((sum, r) => sum + r.people.prosperity, 0) / controlledRegions.length 
              : 0
          };
        });

        return reply.code(200).send({
          overview: {
            tick: session.world.tick,
            totalRegions: session.world.regions.length,
            totalFactions: session.world.factions.length,
            totalPopulation,
            averageProsperity: Math.round(averageProsperity),
            averageStability: Math.round(averageStability),
            playerResources: session.world.resources,
            playerLegitimacy: session.world.legitimacy
          },
          factionControl
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