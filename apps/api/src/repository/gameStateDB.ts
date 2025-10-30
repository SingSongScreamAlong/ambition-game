import { PrismaClient } from '@prisma/client';
import { 
  WorldState, 
  RequirementGraph, 
  ActionProposal, 
  EventCard 
} from '@ambition/oracle-engine';

export interface GameSession {
  playerId: string;
  graph: RequirementGraph;
  world: WorldState;
  pendingActions: ActionProposal[];
  lastEvents: EventCard[];
  createdAt: Date;
  lastUpdated: Date;
}

export interface GameSnapshot {
  id: string;
  seed: number;
  state: GameSession;
  tick: number;
  createdAt: Date;
}

/**
 * Database-backed game state repository using Prisma
 */
export class GameStateDBRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new game session
   */
  async createSession(
    playerId: string,
    graph: RequirementGraph,
    world: WorldState,
    initialProposals: ActionProposal[],
    initialEvents: EventCard[]
  ): Promise<GameSession> {
    const session: GameSession = {
      playerId,
      graph,
      world,
      pendingActions: initialProposals,
      lastEvents: initialEvents,
      createdAt: new Date(),
      lastUpdated: new Date(),
    };

    // Save as GameSession in database
    await this.prisma.gameSession.create({
      data: {
        playerId,
        seed: world.seed,
        worldSnapshot: JSON.stringify(session),
        tick: world.tick,
      }
    });

    return session;
  }

  /**
   * Get a game session by player ID (latest session)
   */
  async getSession(playerId: string): Promise<GameSession | null> {
    const gameSession = await this.prisma.gameSession.findFirst({
      where: { playerId },
      orderBy: { updatedAt: 'desc' }
    });

    if (!gameSession) {
      return null;
    }

    return JSON.parse(gameSession.worldSnapshot) as GameSession;
  }

  /**
   * Update a game session
   */
  async updateSession(
    playerId: string,
    updates: Partial<Omit<GameSession, 'playerId' | 'createdAt'>>
  ): Promise<GameSession | null> {
    const existingSession = await this.getSession(playerId);
    if (!existingSession) {
      return null;
    }

    const updatedSession: GameSession = {
      ...existingSession,
      ...updates,
      lastUpdated: new Date(),
    };

    // Update the latest game session for this player
    await this.prisma.gameSession.updateMany({
      where: { 
        playerId,
        id: {
          in: (await this.prisma.gameSession.findFirst({
            where: { playerId },
            orderBy: { updatedAt: 'desc' },
            select: { id: true }
          }))?.id ? [(await this.prisma.gameSession.findFirst({
            where: { playerId },
            orderBy: { updatedAt: 'desc' },
            select: { id: true }
          }))!.id] : []
        }
      },
      data: {
        worldSnapshot: JSON.stringify(updatedSession),
        tick: updatedSession.world?.tick || 0,
        updatedAt: new Date()
      }
    });

    return updatedSession;
  }

  /**
   * Delete a game session
   */
  async deleteSession(playerId: string): Promise<boolean> {
    const result = await this.prisma.gameSession.deleteMany({
      where: { playerId }
    });

    return result.count > 0;
  }

  /**
   * Save a snapshot of the current game state
   */
  async saveSnapshot(seed: number, state: GameSession): Promise<string> {
    const gameSession = await this.prisma.gameSession.create({
      data: {
        playerId: state.playerId,
        seed,
        worldSnapshot: JSON.stringify(state),
        tick: state.world.tick,
      }
    });

    return gameSession.id;
  }

  /**
   * Load a snapshot by ID
   */
  async loadSnapshot(id: string): Promise<GameSnapshot | null> {
    const gameSession = await this.prisma.gameSession.findUnique({
      where: { id }
    });

    if (!gameSession) {
      return null;
    }

    return {
      id: gameSession.id,
      seed: gameSession.seed,
      state: JSON.parse(gameSession.worldSnapshot) as GameSession,
      tick: gameSession.tick,
      createdAt: gameSession.createdAt
    };
  }

  /**
   * List snapshots for a player
   */
  async listSnapshots(playerId: string): Promise<GameSnapshot[]> {
    const gameSessions = await this.prisma.gameSession.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' }
    });

    return gameSessions.map((session: any) => ({
      id: session.id,
      seed: session.seed,
      state: JSON.parse(session.worldSnapshot) as GameSession,
      tick: session.tick,
      createdAt: session.createdAt
    }));
  }

  /**
   * Get all sessions (for admin/debug purposes)
   */
  async getAllSessions(): Promise<GameSession[]> {
    const gameSessions = await this.prisma.gameSession.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    return gameSessions.map((session: any) => 
      JSON.parse(session.worldSnapshot) as GameSession
    );
  }

  /**
   * Clean up old sessions (called periodically)
   */
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const result = await this.prisma.gameSession.deleteMany({
      where: {
        updatedAt: { lt: cutoff }
      }
    });

    return result.count;
  }

  /**
   * Get repository statistics
   */
  async getStats() {
    const totalSessions = await this.prisma.gameSession.count();
    const recentCutoff = new Date(Date.now() - 60 * 60 * 1000); // Last hour
    
    const activeSessions = await this.prisma.gameSession.count({
      where: {
        updatedAt: { gt: recentCutoff }
      }
    });

    return {
      totalSessions,
      activeSessions,
    };
  }
}

/**
 * In-memory game state repository (legacy)
 * Kept for backward compatibility and testing
 */
export class GameStateRepository {
  private sessions = new Map<string, GameSession>();

  createSession(
    playerId: string,
    graph: RequirementGraph,
    world: WorldState,
    initialProposals: ActionProposal[],
    initialEvents: EventCard[]
  ): GameSession {
    const session: GameSession = {
      playerId,
      graph,
      world,
      pendingActions: initialProposals,
      lastEvents: initialEvents,
      createdAt: new Date(),
      lastUpdated: new Date(),
    };

    this.sessions.set(playerId, session);
    return session;
  }

  getSession(playerId: string): GameSession | null {
    return this.sessions.get(playerId) || null;
  }

  updateSession(
    playerId: string,
    updates: Partial<Omit<GameSession, 'playerId' | 'createdAt'>>
  ): GameSession | null {
    const session = this.sessions.get(playerId);
    if (!session) {
      return null;
    }

    const updatedSession: GameSession = {
      ...session,
      ...updates,
      lastUpdated: new Date(),
    };

    this.sessions.set(playerId, updatedSession);
    return updatedSession;
  }

  deleteSession(playerId: string): boolean {
    return this.sessions.delete(playerId);
  }

  saveSnapshot(seed: number, state: GameSession): string {
    const id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // In-memory doesn't persist snapshots, but we maintain the interface
    return id;
  }

  loadSnapshot(id: string): GameSnapshot | null {
    // In-memory doesn't persist snapshots
    return null;
  }

  listSnapshots(playerId: string): GameSnapshot[] {
    // In-memory doesn't persist snapshots
    return [];
  }

  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  cleanupOldSessions(maxAgeHours: number = 24): number {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [playerId, session] of this.sessions) {
      if (session.lastUpdated < cutoff) {
        this.sessions.delete(playerId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        s => s.lastUpdated > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      ).length,
    };
  }
}