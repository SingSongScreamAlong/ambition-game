import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { sessionRoutes } from '../routes/session.js';
import { gameRoutes } from '../routes/game.js';
import { diplomacyRoutes } from '../routes/diplomacy.js';
import { mapRoutes } from '../routes/map.js';
import { WebSocketManager } from '../services/websocket.js';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';

describe('API Integration Tests', () => {
  let app: any;
  let prisma: PrismaClient;
  let wsManager: WebSocketManager;

  beforeEach(async () => {
    // Create test Fastify instance
    app = Fastify({ logger: false });
    
    // Use in-memory SQLite for testing
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file::memory:?cache=shared'
        }
      }
    });

    // Create test tables
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "players" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "handle" TEXT NOT NULL UNIQUE,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "playerId" TEXT NOT NULL,
        "sessionToken" TEXT NOT NULL UNIQUE,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "game_sessions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "playerId" TEXT NOT NULL,
        "seed" INTEGER NOT NULL,
        "worldSnapshot" TEXT NOT NULL,
        "tick" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE
      );
    `;

    // Initialize WebSocket manager
    wsManager = new WebSocketManager(prisma);

    // Register plugins
    await app.register(cookie, {
      secret: 'test-secret-key',
    });

    await app.register(cors, {
      origin: true,
      credentials: true,
    });

    // Register routes
    await app.register(sessionRoutes);
    await app.register(async function (fastify: any) {
      await diplomacyRoutes(fastify, wsManager);
    });
    await app.register(mapRoutes);
    await app.register(gameRoutes);

    await app.ready();
  });

  afterEach(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Session Management', () => {
    it('should start a new session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: {
          playerHandle: 'test_player'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.handle).toBe('test_player');
      expect(body.session.id).toBeDefined();
      expect(response.cookies).toBeDefined();
    });

    it('should resume an existing session', async () => {
      // First create a session
      const startResponse = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: {
          playerHandle: 'test_player'
        }
      });

      const sessionCookie = startResponse.cookies[0];

      // Then resume it
      const resumeResponse = await app.inject({
        method: 'GET',
        url: '/session/resume',
        cookies: { session: sessionCookie.value }
      });

      expect(resumeResponse.statusCode).toBe(200);
      const body = JSON.parse(resumeResponse.body);
      expect(body.player.handle).toBe('test_player');
    });

    it('should validate session tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/session/validate'
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Game Management', () => {
    let sessionCookie: any;

    beforeEach(async () => {
      // Create a session for game tests
      const startResponse = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: {
          playerHandle: 'game_test_player'
        }
      });
      sessionCookie = startResponse.cookies[0];
    });

    it('should start a new game', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/start',
        cookies: { session: sessionCookie.value },
        payload: {
          rawAmbition: 'I seek to build a prosperous kingdom',
          seed: 12345
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.world).toBeDefined();
      expect(body.world.seed).toBe(12345);
      expect(body.proposals).toBeDefined();
      expect(Array.isArray(body.proposals)).toBe(true);
    });

    it('should get game state', async () => {
      // First start a game
      await app.inject({
        method: 'POST',
        url: '/start',
        cookies: { session: sessionCookie.value },
        payload: {
          rawAmbition: 'I seek power',
          seed: 54321
        }
      });

      // Then get state
      const response = await app.inject({
        method: 'GET',
        url: '/state',
        cookies: { session: sessionCookie.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.world).toBeDefined();
      expect(body.world.seed).toBe(54321);
    });

    it('should advance game ticks', async () => {
      // Start a game
      await app.inject({
        method: 'POST',
        url: '/start',
        cookies: { session: sessionCookie.value },
        payload: {
          rawAmbition: 'I seek wisdom',
          seed: 11111
        }
      });

      // Advance tick
      const response = await app.inject({
        method: 'POST',
        url: '/advance',
        cookies: { session: sessionCookie.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.world).toBeDefined();
      expect(body.world.tick).toBeGreaterThan(0);
    });

    it('should require authentication for game endpoints', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/start',
        payload: {
          rawAmbition: 'I seek power',
          seed: 12345
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Map API', () => {
    let sessionCookie: any;

    beforeEach(async () => {
      // Create session and start game
      const startResponse = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: {
          playerHandle: 'map_test_player'
        }
      });
      sessionCookie = startResponse.cookies[0];

      await app.inject({
        method: 'POST',
        url: '/start',
        cookies: { session: sessionCookie.value },
        payload: {
          rawAmbition: 'I seek to explore',
          seed: 99999
        }
      });
    });

    it('should get map tiles', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/map/tiles',
        cookies: { session: sessionCookie.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tiles).toBeDefined();
      expect(Array.isArray(body.tiles)).toBe(true);
      expect(body.worldSize).toBeDefined();
    });

    it('should get map entities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/map/entities',
        cookies: { session: sessionCookie.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entities).toBeDefined();
      expect(Array.isArray(body.entities)).toBe(true);
    });

    it('should get world overview', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/map/overview',
        cookies: { session: sessionCookie.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.overview).toBeDefined();
      expect(body.overview.totalRegions).toBeGreaterThan(0);
      expect(body.factionControl).toBeDefined();
    });
  });

  describe('Diplomacy API', () => {
    let sessionCookie1: any;
    let sessionCookie2: any;
    let player1Id: string;
    let player2Id: string;

    beforeEach(async () => {
      // Create two sessions for diplomacy tests
      const start1 = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: { playerHandle: 'diplomat_1' }
      });
      sessionCookie1 = start1.cookies[0];
      player1Id = JSON.parse(start1.body).player.id;

      const start2 = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: { playerHandle: 'diplomat_2' }
      });
      sessionCookie2 = start2.cookies[0];
      player2Id = JSON.parse(start2.body).player.id;
    });

    it('should get available players for diplomacy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/diplomacy/players',
        cookies: { session: sessionCookie1.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toBeDefined();
      expect(Array.isArray(body.players)).toBe(true);
      expect(body.players.some((p: any) => p.id === player2Id)).toBe(true);
    });

    it('should propose treaties between players', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/diplomacy/propose',
        cookies: { session: sessionCookie1.value },
        payload: {
          toPlayerId: player2Id,
          treatyType: 'trade',
          terms: [
            { type: 'trade_routes', description: 'Establish trade routes' }
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.proposal).toBeDefined();
      expect(body.proposal.treatyType).toBe('trade');
    });

    it('should get diplomacy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/diplomacy/status',
        cookies: { session: sessionCookie1.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
      expect(typeof body.status.connectedPlayers).toBe('number');
    });

    it('should list pending proposals', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/diplomacy/proposals',
        cookies: { session: sessionCookie1.value }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.proposals).toBeDefined();
      expect(Array.isArray(body.proposals)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle invalid JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/session/start',
        payload: 'invalid json',
        headers: {
          'content-type': 'application/json'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });
});