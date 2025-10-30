import { RequirementGraph, GraphNode } from '@ambition/oracle-engine';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface GameStartResponse {
  ambition: {
    archetypes: string[];
    virtues: string[];
    vices: string[];
    weights: Record<string, number>;
  };
  graph: {
    ambition: string;
    nodes: Array<{
      id: string;
      label: string;
      status: 'unmet' | 'met';
      needs?: string[];
      paths?: string[];
    }>;
  };
  world: WorldState;
  proposals: ActionProposal[];
  events: EventCard[];
}

export interface Legitimacy {
  law: number;
  faith: number;
  lineage: number;
  might: number;
}

export interface WorldState {
  seed: number;
  regions: Region[];
  factions: Faction[];
  resources: Resources;
  people: People;
  forces: Forces;
  legitimacy: Legitimacy;
  traits: string[];
  tick: number;
  playerId: string;
}

export interface Region {
  id: string;
  name: string;
  controlled: boolean;
  resources: Partial<Resources>;
  people: People;
  security: number;
  lawfulness: number;
  unrest: number;
  piety: number;
  heresy: number;
}

export interface Faction {
  id: string;
  name: string;
  stance: 'allied' | 'neutral' | 'hostile';
  power: number;
  regions: string[];
}

export interface Resources {
  gold: number;
  grain: number;
  iron: number;
  wood: number;
  stone: number;
}

export interface People {
  population: number;
  loyalty: number;
  unrest: number;
  faith: number;
}

export interface Forces {
  units: number;
  morale: number;
  supply: number;
}

export interface ActionProposal {
  id: string;
  label: string;
  description: string;
  satisfies: string[];
  costs?: Partial<Resources>;
  risks?: Record<string, number>;
  time: string;
  requirements?: string[];
  mapRefs?: string[];
  rewards?: Partial<Resources>;
}

export interface EventCard {
  id: string;
  text: string;
  choices: EventChoice[];
}

export interface EventChoice {
  id: string;
  label: string;
  costs?: Partial<Resources>;
  effects?: string[];
  riskTags?: string[];
}

export interface GameStateResponse {
  graph: GameStartResponse['graph'];
  world: WorldState;
  pendingActions: ActionProposal[];
  lastEvents: EventCard[];
}

export interface AdvanceResponse {
  world: WorldState;
  events: EventCard[];
  proposals: ActionProposal[];
  graph: RequirementGraph;
}

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: 'Network error' };
    }
    
    throw new ApiError(
      response.status, 
      errorData.message || `HTTP ${response.status}`,
      errorData
    );
  }

  return response.json();
}

export const api = {
  async startGame(rawAmbition: string, seed?: number): Promise<GameStartResponse> {
    return apiRequest('/start', {
      method: 'POST',
      body: JSON.stringify({ rawAmbition, seed }),
    });
  },

  async getGameState(playerId: string): Promise<GameStateResponse> {
    return apiRequest(`/state?playerId=${encodeURIComponent(playerId)}`);
  },

  async chooseAction(playerId: string, actionId: string, choiceId?: string): Promise<AdvanceResponse> {
    return apiRequest('/choose', {
      method: 'POST',
      body: JSON.stringify({ playerId, actionId, choiceId }),
    });
  },

  async advanceGame(playerId: string): Promise<AdvanceResponse> {
    return apiRequest('/advance', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  async getStats() {
    return apiRequest('/debug/stats');
  },
};

export { ApiError };