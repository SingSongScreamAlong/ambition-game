import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { gameRoutes } from '../src/routes/game.js';

describe('API Routes', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    await app.register(gameRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should start a new game', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/start',
      payload: {
        rawAmbition: 'I want to be a just king',
        seed: 12345,
      },
    });

    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.payload);
    expect(data.ambition).toBeDefined();
    expect(data.graph).toBeDefined();
    expect(data.world).toBeDefined();
    expect(data.proposals).toBeDefined();
    expect(data.events).toBeDefined();

    expect(data.ambition.archetypes).toContain('king');
    expect(data.ambition.virtues).toContain('justice');
    expect(data.world.seed).toBe(12345);
    expect(Array.isArray(data.proposals)).toBe(true);
    expect(data.proposals.length).toBeGreaterThan(0);
  });

  it('should validate required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/start',
      payload: {
        // Missing rawAmbition
        seed: 12345,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should get game state', async () => {
    // First start a game
    const startResponse = await app.inject({
      method: 'POST',
      url: '/start',
      payload: {
        rawAmbition: 'I want to be a warrior',
        seed: 54321,
      },
    });

    const startData = JSON.parse(startResponse.payload);
    const playerId = startData.world.playerId;

    // Then get the state
    const stateResponse = await app.inject({
      method: 'GET',
      url: `/state?playerId=${playerId}`,
    });

    expect(stateResponse.statusCode).toBe(200);
    
    const stateData = JSON.parse(stateResponse.payload);
    expect(stateData.graph).toBeDefined();
    expect(stateData.world).toBeDefined();
    expect(stateData.pendingActions).toBeDefined();
    expect(stateData.lastEvents).toBeDefined();
  });

  it('should return 404 for non-existent game', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/state?playerId=non-existent',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should advance game by one tick', async () => {
    // Start a game
    const startResponse = await app.inject({
      method: 'POST',
      url: '/start',
      payload: {
        rawAmbition: 'I want to be a merchant',
        seed: 99999,
      },
    });

    const startData = JSON.parse(startResponse.payload);
    const playerId = startData.world.playerId;
    const initialTick = startData.world.tick;

    // Advance one tick
    const advanceResponse = await app.inject({
      method: 'POST',
      url: '/advance',
      payload: {
        playerId,
      },
    });

    expect(advanceResponse.statusCode).toBe(200);
    
    const advanceData = JSON.parse(advanceResponse.payload);
    expect(advanceData.world.tick).toBe(initialTick + 1);
    expect(Array.isArray(advanceData.events)).toBe(true);
    expect(Array.isArray(advanceData.proposals)).toBe(true);
  });

  it('should choose an action', async () => {
    // Start a game
    const startResponse = await app.inject({
      method: 'POST',
      url: '/start',
      payload: {
        rawAmbition: 'I want to be a king',
        seed: 11111,
      },
    });

    const startData = JSON.parse(startResponse.payload);
    const playerId = startData.world.playerId;
    
    // Find a cheap action we can afford
    const affordableAction = startData.proposals.find((p: any) => {
      if (!p.costs) return true; // Free action
      
      return Object.entries(p.costs).every(([resource, cost]) => {
        const available = startData.world.resources[resource];
        return cost <= available;
      });
    });

    if (affordableAction) {
      const chooseResponse = await app.inject({
        method: 'POST',
        url: '/choose',
        payload: {
          playerId,
          actionId: affordableAction.id,
        },
      });

      expect(chooseResponse.statusCode).toBe(200);
      
      const chooseData = JSON.parse(chooseResponse.payload);
      expect(chooseData.world).toBeDefined();
      expect(chooseData.world.tick).toBe(startData.world.tick + 1);
      expect(Array.isArray(chooseData.events)).toBe(true);
      expect(Array.isArray(chooseData.proposals)).toBe(true);
    }
  });

  it('should return 400 for unaffordable action', async () => {
    // Start a game with very limited resources
    const startResponse = await app.inject({
      method: 'POST',
      url: '/start',
      payload: {
        rawAmbition: 'I want to be a king',
        seed: 22222,
      },
    });

    const startData = JSON.parse(startResponse.payload);
    const playerId = startData.world.playerId;
    
    // Try to choose an expensive action
    const expensiveAction = startData.proposals.find((p: any) => {
      if (!p.costs) return false;
      
      return Object.entries(p.costs).some(([resource, cost]) => {
        const available = startData.world.resources[resource];
        return cost > available;
      });
    });

    if (expensiveAction) {
      const chooseResponse = await app.inject({
        method: 'POST',
        url: '/choose',
        payload: {
          playerId,
          actionId: expensiveAction.id,
        },
      });

      expect(chooseResponse.statusCode).toBe(400);
      expect(chooseResponse.payload).toMatch(/Insufficient/);
    }
  });

  it('should get debug stats', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/debug/stats',
    });

    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.payload);
    expect(data.totalSessions).toBeDefined();
    expect(data.activeSessions).toBeDefined();
    expect(typeof data.totalSessions).toBe('number');
    expect(typeof data.activeSessions).toBe('number');
  });
});