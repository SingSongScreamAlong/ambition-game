import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GameStateDBRepository } from '../repository/gameStateDB.js';
import { AuthService } from '../services/auth.js';
import { 
  ambition,
  goalGen,
  worldGen,
  dynamicPlanner,
  dsl,
  planner,
  sim,
  events
} from '@ambition/oracle-engine';

describe('Save/Load Determinism Tests', () => {
  let prisma: PrismaClient;
  let repository: GameStateDBRepository;
  let authService: AuthService;

  beforeEach(async () => {
    // Use in-memory SQLite for testing
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file::memory:?cache=shared'
        }
      }
    });
    
    // Apply migrations programmatically for testing
    // In a real test setup, you'd use `prisma migrate deploy`
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

    repository = new GameStateDBRepository(prisma);
    authService = new AuthService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Game State Determinism', () => {
    it('should produce identical snapshots for same seed and choices', async () => {
      const seed = 12345;
      const ambitionText = "I seek to build a prosperous kingdom through trade and diplomacy";
      
      // Create two separate players for isolation
      const auth1 = await authService.startSession('test_player_1');
      const auth2 = await authService.startSession('test_player_2');

      // Generate identical game states
      const ambitionProfile = ambition.parseAmbition(ambitionText);
      const rng1 = new worldGen.SeededRandom(seed + 1000);
      const rng2 = new worldGen.SeededRandom(seed + 1000);
      
      const graph1 = goalGen.generateDynamicGoals(ambitionProfile, rng1, 5, 3);
      const graph2 = goalGen.generateDynamicGoals(ambitionProfile, rng2, 5, 3);
      
      const world1 = worldGen.seed(ambitionProfile, seed);
      const world2 = worldGen.seed(ambitionProfile, seed);
      
      world1.playerId = auth1.player.id;
      world2.playerId = auth2.player.id;

      const knowledgeBase = dsl.createBasicKnowledgeBase();
      
      const proposals1 = dynamicPlanner.proposeDynamic({ 
        graph: graph1, 
        world: world1, 
        ambitionProfile, 
        kb: knowledgeBase 
      });
      
      const proposals2 = dynamicPlanner.proposeDynamic({ 
        graph: graph2, 
        world: world2, 
        ambitionProfile, 
        kb: knowledgeBase 
      });

      // Create initial sessions
      const session1 = await repository.createSession(
        auth1.player.id, graph1, world1, proposals1, []
      );
      
      const session2 = await repository.createSession(
        auth2.player.id, graph2, world2, proposals2, []
      );

      // Save initial snapshots
      const snapshot1Id = await repository.saveSnapshot(seed, session1);
      const snapshot2Id = await repository.saveSnapshot(seed, session2);

      // Load snapshots
      const loadedSnapshot1 = await repository.loadSnapshot(snapshot1Id);
      const loadedSnapshot2 = await repository.loadSnapshot(snapshot2Id);

      expect(loadedSnapshot1).toBeDefined();
      expect(loadedSnapshot2).toBeDefined();

      // Compare critical deterministic properties (excluding player IDs)
      expect(loadedSnapshot1!.seed).toBe(loadedSnapshot2!.seed);
      expect(loadedSnapshot1!.state.world.seed).toBe(loadedSnapshot2!.state.world.seed);
      expect(loadedSnapshot1!.state.world.tick).toBe(loadedSnapshot2!.state.world.tick);
      expect(loadedSnapshot1!.state.world.regions.length).toBe(loadedSnapshot2!.state.world.regions.length);
      expect(loadedSnapshot1!.state.world.factions.length).toBe(loadedSnapshot2!.state.world.factions.length);
      
      // Compare resource states
      expect(loadedSnapshot1!.state.world.resources).toEqual(loadedSnapshot2!.state.world.resources);
      
      // Compare proposal types (should be same proposals available)
      expect(loadedSnapshot1!.state.pendingActions.length).toBe(loadedSnapshot2!.state.pendingActions.length);
    });

    it('should maintain determinism through multiple ticks with same choices', async () => {
      const seed = 54321;
      const ambitionText = "I will conquer all lands through military might";
      
      // Create player
      const auth = await authService.startSession('test_determinism_player');
      
      // Generate game state
      const ambitionProfile = ambition.parseAmbition(ambitionText);
      const rng = new worldGen.SeededRandom(seed + 1000);
      const graph = goalGen.generateDynamicGoals(ambitionProfile, rng, 5, 3);
      const world = worldGen.seed(ambitionProfile, seed);
      world.playerId = auth.player.id;

      const knowledgeBase = dsl.createBasicKnowledgeBase();
      const initialProposals = dynamicPlanner.proposeDynamic({ 
        graph, world, ambitionProfile, kb: knowledgeBase 
      });

      // Create session and save initial state
      let session = await repository.createSession(
        auth.player.id, graph, world, initialProposals, []
      );
      
      const initialSnapshotId = await repository.saveSnapshot(seed, session);

      // Simulate 3 ticks with the same choices
      const tickSnapshots: string[] = [];
      
      for (let tick = 0; tick < 3; tick++) {
        // Choose the first available action (deterministic choice)
        const availableActions = session.pendingActions;
        if (availableActions.length > 0) {
          const chosenAction = availableActions[0];
          
          // Apply action and advance tick
          const prevWorld = JSON.parse(JSON.stringify(session.world));
          const newWorld = sim.tick(session.world, [chosenAction]);
          
          // Update graph progress
          for (const satisfiedReq of chosenAction.satisfies) {
            const node = session.graph.nodes.find((n: any) => n.id === satisfiedReq);
            if (node) {
              node.status = 'met';
            }
          }
          
          // Generate events and new proposals
          const newEvents = events.alchemize(prevWorld, newWorld);
          const newProposals = planner.propose({ 
            graph: session.graph, 
            world: newWorld, 
            kb: knowledgeBase 
          });

          // Update session
          session = await repository.updateSession(auth.player.id, {
            world: newWorld,
            pendingActions: newProposals,
            lastEvents: newEvents,
          }) || session;

          // Save snapshot
          const snapshotId = await repository.saveSnapshot(seed, session);
          tickSnapshots.push(snapshotId);
        } else {
          // No actions available, just advance time
          const newWorld = sim.tick(session.world, []);
          const newEvents = events.alchemize(session.world, newWorld);
          const newProposals = planner.propose({ 
            graph: session.graph, 
            world: newWorld, 
            kb: knowledgeBase 
          });

          session = await repository.updateSession(auth.player.id, {
            world: newWorld,
            pendingActions: newProposals,
            lastEvents: newEvents,
          }) || session;

          const snapshotId = await repository.saveSnapshot(seed, session);
          tickSnapshots.push(snapshotId);
        }
      }

      // Now repeat the exact same sequence and verify determinism
      const auth2 = await authService.startSession('test_determinism_player_2');
      const world2 = worldGen.seed(ambitionProfile, seed);
      world2.playerId = auth2.player.id;
      
      let session2 = await repository.createSession(
        auth2.player.id, graph, world2, initialProposals, []
      );

      // Repeat same sequence
      for (let tick = 0; tick < 3; tick++) {
        const availableActions = session2.pendingActions;
        if (availableActions.length > 0) {
          const chosenAction = availableActions[0];
          
          const prevWorld = JSON.parse(JSON.stringify(session2.world));
          const newWorld = sim.tick(session2.world, [chosenAction]);
          
          for (const satisfiedReq of chosenAction.satisfies) {
            const node = session2.graph.nodes.find((n: any) => n.id === satisfiedReq);
            if (node) {
              node.status = 'met';
            }
          }
          
          const newEvents = events.alchemize(prevWorld, newWorld);
          const newProposals = planner.propose({ 
            graph: session2.graph, 
            world: newWorld, 
            kb: knowledgeBase 
          });

          session2 = await repository.updateSession(auth2.player.id, {
            world: newWorld,
            pendingActions: newProposals,
            lastEvents: newEvents,
          }) || session2;
        } else {
          const newWorld = sim.tick(session2.world, []);
          const newEvents = events.alchemize(session2.world, newWorld);
          const newProposals = planner.propose({ 
            graph: session2.graph, 
            world: newWorld, 
            kb: knowledgeBase 
          });

          session2 = await repository.updateSession(auth2.player.id, {
            world: newWorld,
            pendingActions: newProposals,
            lastEvents: newEvents,
          }) || session2;
        }

        // Compare final state after each tick
        const originalSnapshot = await repository.loadSnapshot(tickSnapshots[tick]);
        
        expect(session2.world.tick).toBe(originalSnapshot!.state.world.tick);
        expect(session2.world.resources).toEqual(originalSnapshot!.state.world.resources);
        expect(session2.pendingActions.length).toBe(originalSnapshot!.state.pendingActions.length);
      }
    });

    it('should load snapshots and resume with identical next proposals', async () => {
      const seed = 98765;
      const ambitionText = "I seek balance between might and virtue";
      
      // Create player and initial game state
      const auth = await authService.startSession('test_resume_player');
      const ambitionProfile = ambition.parseAmbition(ambitionText);
      const rng = new worldGen.SeededRandom(seed + 1000);
      const graph = goalGen.generateDynamicGoals(ambitionProfile, rng, 5, 3);
      const world = worldGen.seed(ambitionProfile, seed);
      world.playerId = auth.player.id;

      const knowledgeBase = dsl.createBasicKnowledgeBase();
      const initialProposals = dynamicPlanner.proposeDynamic({ 
        graph, world, ambitionProfile, kb: knowledgeBase 
      });

      const session = await repository.createSession(
        auth.player.id, graph, world, initialProposals, []
      );

      // Save snapshot at specific state
      const snapshotId = await repository.saveSnapshot(seed, session);

      // Load the snapshot
      const loadedSnapshot = await repository.loadSnapshot(snapshotId);
      expect(loadedSnapshot).toBeDefined();

      // Generate next proposals from loaded state
      const nextProposals1 = planner.propose({ 
        graph: loadedSnapshot!.state.graph, 
        world: loadedSnapshot!.state.world, 
        kb: knowledgeBase 
      });

      // Load again and generate proposals (should be identical)
      const loadedSnapshot2 = await repository.loadSnapshot(snapshotId);
      const nextProposals2 = planner.propose({ 
        graph: loadedSnapshot2!.state.graph, 
        world: loadedSnapshot2!.state.world, 
        kb: knowledgeBase 
      });

      // Proposals should be identical
      expect(nextProposals1.length).toBe(nextProposals2.length);
      
      for (let i = 0; i < nextProposals1.length; i++) {
        expect(nextProposals1[i].id).toBe(nextProposals2[i].id);
        expect(nextProposals1[i].name).toBe(nextProposals2[i].name);
        expect(nextProposals1[i].type).toBe(nextProposals2[i].type);
        expect(nextProposals1[i].costs).toEqual(nextProposals2[i].costs);
        expect(nextProposals1[i].effects).toEqual(nextProposals2[i].effects);
      }
    });
  });

  describe('Repository Operations', () => {
    it('should save and load snapshots correctly', async () => {
      const auth = await authService.startSession('test_save_load');
      
      // Create a simple game session
      const ambitionProfile = ambition.parseAmbition("Test ambition");
      const world = worldGen.seed(ambitionProfile, 12345);
      world.playerId = auth.player.id;
      
      const session = await repository.createSession(
        auth.player.id, 
        { nodes: [], edges: [], root: 'test' }, // Simple graph
        world, 
        [], 
        []
      );

      // Save snapshot
      const snapshotId = await repository.saveSnapshot(12345, session);
      expect(snapshotId).toBeDefined();

      // Load snapshot
      const loadedSnapshot = await repository.loadSnapshot(snapshotId);
      expect(loadedSnapshot).toBeDefined();
      expect(loadedSnapshot!.seed).toBe(12345);
      expect(loadedSnapshot!.state.playerId).toBe(auth.player.id);
    });

    it('should list snapshots for a player', async () => {
      const auth = await authService.startSession('test_list_snapshots');
      
      // Create multiple snapshots
      const ambitionProfile = ambition.parseAmbition("Test ambition");
      const world = worldGen.seed(ambitionProfile, 11111);
      world.playerId = auth.player.id;
      
      const session = await repository.createSession(
        auth.player.id, 
        { nodes: [], edges: [], root: 'test' },
        world, 
        [], 
        []
      );

      const snapshot1Id = await repository.saveSnapshot(11111, session);
      const snapshot2Id = await repository.saveSnapshot(11112, session);

      // List snapshots
      const snapshots = await repository.listSnapshots(auth.player.id);
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      expect(snapshots.some(s => s.id === snapshot1Id)).toBe(true);
      expect(snapshots.some(s => s.id === snapshot2Id)).toBe(true);
    });
  });
});