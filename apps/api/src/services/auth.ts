import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

export interface SessionData {
  playerId: string;
  sessionId: string;
  handle: string;
}

export interface AuthResult {
  player: {
    id: string;
    handle: string;
  };
  session: {
    id: string;
    token: string;
  };
}

/**
 * Authentication and session management service
 */
export class AuthService {
  private jwtSecret: string;

  constructor(private prisma: PrismaClient) {
    this.jwtSecret = process.env.JWT_SECRET || 'ambition-dev-secret-key';
  }

  /**
   * Start a new session for a player
   */
  async startSession(playerHandle?: string): Promise<AuthResult> {
    // Create or find player
    const handle = playerHandle || `player_${randomBytes(4).toString('hex')}`;
    
    let player = await this.prisma.player.findUnique({
      where: { handle }
    });

    if (!player) {
      player = await this.prisma.player.create({
        data: { handle }
      });
    }

    // Create session
    const sessionToken = this.generateSessionToken();
    const session = await this.prisma.session.create({
      data: {
        playerId: player.id,
        sessionToken,
      }
    });

    return {
      player: {
        id: player.id,
        handle: player.handle,
      },
      session: {
        id: session.id,
        token: this.signSessionToken({
          playerId: player.id,
          sessionId: session.id,
          handle: player.handle,
        }),
      },
    };
  }

  /**
   * Resume an existing session
   */
  async resumeSession(token: string): Promise<SessionData | null> {
    try {
      const decoded = this.verifySessionToken(token);
      
      // Verify session still exists and is valid
      const session = await this.prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { player: true }
      });

      if (!session) {
        return null;
      }

      // Update last active time
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() }
      });

      return {
        playerId: session.playerId,
        sessionId: session.id,
        handle: session.player.handle,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<boolean> {
    try {
      await this.prisma.session.delete({
        where: { id: sessionId }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate a session token and extract session data
   */
  async validateSession(token: string): Promise<SessionData | null> {
    try {
      const decoded = this.verifySessionToken(token);
      
      const session = await this.prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { player: true }
      });

      if (!session) {
        return null;
      }

      return {
        playerId: session.playerId,
        sessionId: session.id,
        handle: session.player.handle,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(maxAgeHours: number = 24 * 7): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const result = await this.prisma.session.deleteMany({
      where: {
        lastActiveAt: { lt: cutoff }
      }
    });

    return result.count;
  }

  /**
   * Generate a unique session token
   */
  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Sign session data into a JWT
   */
  private signSessionToken(data: SessionData): string {
    return jwt.sign(data, this.jwtSecret, {
      expiresIn: '7d', // Sessions expire in 7 days
      issuer: 'ambition-api',
    });
  }

  /**
   * Verify and decode a JWT session token
   */
  private verifySessionToken(token: string): SessionData {
    return jwt.verify(token, this.jwtSecret, {
      issuer: 'ambition-api',
    }) as SessionData;
  }
}

/**
 * Middleware to extract session data from request
 */
export function extractSessionFromRequest(authHeader?: string, cookies?: Record<string, string | undefined>): string | null {
  // Try Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try session cookie
  if (cookies && cookies.session && typeof cookies.session === 'string') {
    return cookies.session;
  }

  return null;
}