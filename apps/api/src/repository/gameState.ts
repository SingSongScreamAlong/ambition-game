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

/**
 * In-memory game state repository
 * In production, this would be replaced with a proper database
 */
class GameStateRepository {
  private sessions = new Map<string, GameSession>();

  /**
   * Create a new game session
   */
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

  /**
   * Get a game session by player ID
   */
  getSession(playerId: string): GameSession | null {
    return this.sessions.get(playerId) || null;
  }

  /**
   * Update a game session
   */
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

  /**
   * Delete a game session
   */
  deleteSession(playerId: string): boolean {
    return this.sessions.delete(playerId);
  }

  /**
   * Get all sessions (for admin/debug purposes)
   */
  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up old sessions (called periodically)
   */
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

  /**
   * Get repository statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        s => s.lastUpdated > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      ).length,
    };
  }
}

// Singleton instance
export const gameStateRepository = new GameStateRepository();

// Clean up old sessions every hour
setInterval(() => {
  const deleted = gameStateRepository.cleanupOldSessions(24);
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old game sessions`);
  }
}, 60 * 60 * 1000);