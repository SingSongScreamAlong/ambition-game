import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { AuthService, SessionData } from './auth.js';
import { PrismaClient } from '@prisma/client';

export interface GameUpdate {
  type: 'tick_update' | 'diplomacy_event' | 'player_action' | 'system_message';
  playerId: string;
  tick?: number;
  data: any;
  timestamp: string;
}

export interface TreatyProposal {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  treatyType: string;
  terms: any[];
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
}

/**
 * WebSocket manager for real-time game updates
 */
export class WebSocketManager {
  private clients = new Map<string, WebSocket>(); // playerId -> WebSocket
  private playerSessions = new Map<string, SessionData>(); // playerId -> SessionData
  private treatyProposals = new Map<string, TreatyProposal>(); // treatyId -> TreatyProposal
  private authService: AuthService;

  constructor(private prisma: PrismaClient) {
    this.authService = new AuthService(prisma);
  }

  /**
   * Register WebSocket routes with Fastify
   */
  async register(fastify: FastifyInstance) {
    await fastify.register(require('@fastify/websocket'));

    const self = this;
    await fastify.register(async function (fastify: FastifyInstance) {
      fastify.get('/ws', { websocket: true }, (connection: any, req: any) => {
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            await self.handleMessage(connection.socket, data);
          } catch (error) {
            console.error('WebSocket message error:', error);
            connection.socket.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message format'
            }));
          }
        });

        connection.socket.on('close', () => {
          self.handleDisconnection(connection.socket);
        });
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(socket: WebSocket, data: any) {
    switch (data.type) {
      case 'authenticate':
        await this.handleAuthentication(socket, data.token);
        break;
      
      case 'subscribe_game_updates':
        await this.handleGameSubscription(socket, data.playerId);
        break;
      
      case 'unsubscribe_game_updates':
        this.handleGameUnsubscription(socket);
        break;
      
      default:
        socket.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
    }
  }

  /**
   * Authenticate WebSocket connection
   */
  private async handleAuthentication(socket: WebSocket, token: string) {
    try {
      const sessionData = await this.authService.validateSession(token);
      
      if (!sessionData) {
        socket.send(JSON.stringify({
          type: 'auth_error',
          message: 'Invalid session token'
        }));
        return;
      }

      // Store connection
      this.clients.set(sessionData.playerId, socket);
      this.playerSessions.set(sessionData.playerId, sessionData);

      socket.send(JSON.stringify({
        type: 'authenticated',
        playerId: sessionData.playerId,
        handle: sessionData.handle
      }));

    } catch (error) {
      socket.send(JSON.stringify({
        type: 'auth_error',
        message: 'Authentication failed'
      }));
    }
  }

  /**
   * Subscribe to game updates
   */
  private async handleGameSubscription(socket: WebSocket, playerId: string) {
    const sessionData = this.playerSessions.get(playerId);
    
    if (!sessionData) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
      return;
    }

    // Confirm subscription
    socket.send(JSON.stringify({
      type: 'subscribed',
      playerId,
      message: 'Subscribed to game updates'
    }));
  }

  /**
   * Unsubscribe from game updates
   */
  private handleGameUnsubscription(socket: WebSocket) {
    socket.send(JSON.stringify({
      type: 'unsubscribed',
      message: 'Unsubscribed from game updates'
    }));
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socket: WebSocket) {
    // Find and remove the disconnected client
    for (const [playerId, client] of this.clients.entries()) {
      if (client === socket) {
        this.clients.delete(playerId);
        this.playerSessions.delete(playerId);
        break;
      }
    }
  }

  /**
   * Broadcast game update to specific player
   */
  public sendGameUpdate(playerId: string, update: GameUpdate) {
    const client = this.clients.get(playerId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(update));
    }
  }

  /**
   * Broadcast game update to all connected players
   */
  public broadcastGameUpdate(update: GameUpdate) {
    for (const [playerId, client] of this.clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          ...update,
          playerId // Override with recipient's player ID
        }));
      }
    }
  }

  /**
   * Send tick update to player
   */
  public sendTickUpdate(playerId: string, worldState: any, tick: number) {
    this.sendGameUpdate(playerId, {
      type: 'tick_update',
      playerId,
      tick,
      data: {
        world: worldState,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a treaty proposal between players
   */
  public async createTreatyProposal(
    fromPlayerId: string,
    toPlayerId: string,
    treatyType: string,
    terms: any[]
  ): Promise<TreatyProposal> {
    const treatyId = `treaty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const proposal: TreatyProposal = {
      id: treatyId,
      fromPlayerId,
      toPlayerId,
      treatyType,
      terms,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.treatyProposals.set(treatyId, proposal);

    // Notify both players
    this.sendGameUpdate(fromPlayerId, {
      type: 'diplomacy_event',
      playerId: fromPlayerId,
      data: {
        action: 'treaty_proposed',
        treaty: proposal,
        message: `Treaty proposal sent to player ${toPlayerId}`
      },
      timestamp: new Date().toISOString()
    });

    this.sendGameUpdate(toPlayerId, {
      type: 'diplomacy_event',
      playerId: toPlayerId,
      data: {
        action: 'treaty_received',
        treaty: proposal,
        message: `Treaty proposal received from player ${fromPlayerId}`
      },
      timestamp: new Date().toISOString()
    });

    return proposal;
  }

  /**
   * Respond to a treaty proposal
   */
  public async respondToTreatyProposal(
    treatyId: string,
    playerId: string,
    response: 'accept' | 'decline'
  ): Promise<TreatyProposal | null> {
    const proposal = this.treatyProposals.get(treatyId);
    
    if (!proposal) {
      return null;
    }

    if (proposal.toPlayerId !== playerId) {
      throw new Error('Not authorized to respond to this treaty');
    }

    if (proposal.status !== 'pending') {
      throw new Error('Treaty proposal is no longer pending');
    }

    // Update proposal status
    proposal.status = response === 'accept' ? 'accepted' : 'declined';

    // Notify both players
    this.sendGameUpdate(proposal.fromPlayerId, {
      type: 'diplomacy_event',
      playerId: proposal.fromPlayerId,
      data: {
        action: 'treaty_response',
        treaty: proposal,
        response,
        message: `Treaty proposal ${response}ed by player ${playerId}`
      },
      timestamp: new Date().toISOString()
    });

    this.sendGameUpdate(proposal.toPlayerId, {
      type: 'diplomacy_event',
      playerId: proposal.toPlayerId,
      data: {
        action: 'treaty_response',
        treaty: proposal,
        response,
        message: `You ${response}ed the treaty proposal`
      },
      timestamp: new Date().toISOString()
    });

    return proposal;
  }

  /**
   * Get pending treaty proposals for a player
   */
  public getPendingTreatyProposals(playerId: string): TreatyProposal[] {
    return Array.from(this.treatyProposals.values())
      .filter(proposal => 
        (proposal.fromPlayerId === playerId || proposal.toPlayerId === playerId) &&
        proposal.status === 'pending' &&
        proposal.expiresAt > new Date()
      );
  }

  /**
   * Get connected players count
   */
  public getConnectedPlayersCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected player IDs
   */
  public getConnectedPlayerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Clean up expired treaty proposals
   */
  public cleanupExpiredProposals(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [treatyId, proposal] of this.treatyProposals.entries()) {
      if (proposal.expiresAt < now && proposal.status === 'pending') {
        proposal.status = 'declined'; // Auto-decline expired proposals
        this.treatyProposals.delete(treatyId);
        cleanedCount++;

        // Notify both players
        this.sendGameUpdate(proposal.fromPlayerId, {
          type: 'diplomacy_event',
          playerId: proposal.fromPlayerId,
          data: {
            action: 'treaty_expired',
            treaty: proposal,
            message: 'Treaty proposal expired'
          },
          timestamp: new Date().toISOString()
        });

        this.sendGameUpdate(proposal.toPlayerId, {
          type: 'diplomacy_event',
          playerId: proposal.toPlayerId,
          data: {
            action: 'treaty_expired',
            treaty: proposal,
            message: 'Treaty proposal expired'
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    return cleanedCount;
  }
}