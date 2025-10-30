// Core Input/Output Types
export interface AmbitionInput {
  raw: string;
}

// Legacy - will be phased out for AmbitionProfile
export interface AmbitionCanonical {
  archetypes: string[];
  virtues: string[];
  vices: string[];
  weights: Record<string, number>;
}

// Dynamic Ambition System - replaces AmbitionCanonical
export interface AmbitionProfile {
  // Core domains (sum to 1.0)
  power: number;     // Control, authority, dominance
  wealth: number;    // Trade, resources, prosperity
  faith: number;     // Religion, devotion, spiritual
  virtue: number;    // Justice, honor, morality
  freedom: number;   // Independence, rebellion, liberation
  creation: number;  // Building, crafting, innovation
  
  // Modifiers (0.0 to 1.0, independent)
  modifiers: {
    peaceful: number;   // Diplomatic vs aggressive approach
    ruthless: number;   // Pragmatic vs idealistic methods
    ascetic: number;    // Simple vs opulent lifestyle
    opulent: number;    // Wealth display vs humility
    secretive: number;  // Hidden vs open operations
    charismatic: number; // Personal magnetism
  };
  
  // Scale of ambition
  scale: {
    local: number;     // Village/region focus
    regional: number;  // Multiple regions
    world: number;     // Global ambitions
  };
  
  // Raw text for reference
  rawText: string;
  
  // Archetype for faction classification (optional)
  archetype?: string;
  
  // Mutation tracking
  generation: number; // How many times this has evolved
  mutations: AmbitionMutation[];
}

export interface AmbitionMutation {
  tick: number;
  actionId: string;
  domainChanges: Partial<Record<keyof Omit<AmbitionProfile, 'modifiers' | 'scale' | 'rawText' | 'generation' | 'mutations'>, number>>;
  modifierChanges: Partial<Record<keyof AmbitionProfile['modifiers'], number>>;
  reason: string;
}

// Requirement Graph Types
export interface GraphNode {
  id: string;
  label: string;
  status: 'unmet' | 'met';
  needs?: string[];
  paths?: string[];
  
  // Dynamic Ambition System extensions
  domains?: string[];        // Which ambition domains this node serves
  spawnThreshold?: number;   // Domain weight threshold for spawning this node
  spawnedAtTick?: number;    // When this node was dynamically generated
}

export interface RequirementGraph {
  ambition: string;
  nodes: GraphNode[];
}

// World State Types
export interface Resources {
  gold: number;
  grain: number;
  iron: number;
  stone: number;
  wood: number;
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

export interface Legitimacy {
  law: number;    // 0-100: Legal authority, bureaucratic control, rule of law
  faith: number;  // 0-100: Religious backing, divine mandate, spiritual authority
  lineage: number; // 0-100: Noble bloodline, ancestral claim, hereditary right
  might: number;  // 0-100: Military strength, conquest, power through force
}

export interface Region {
  id: string;
  name: string;
  controlled: boolean;
  resources: Partial<Resources>;
  people: People;
  security: number;
  lawfulness: number;  // 0-100: Rule of law, justice system effectiveness
  unrest: number;      // 0-100: Regional unrest and civil disorder
  piety: number;       // 0-100: Populace religiosity, spiritual devotion
  heresy: number;      // 0-100: Heterodoxy risk, religious dissent
  domainAffinities: Record<'power' | 'wealth' | 'faith' | 'virtue' | 'freedom' | 'creation', number>;
}

export interface Faction {
  id: string;
  name: string;
  stance: 'allied' | 'neutral' | 'hostile';
  power: number;
  regions: string[];
  domainAffinities: Record<'power' | 'wealth' | 'faith' | 'virtue' | 'freedom' | 'creation', number>;
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

// Action and Event Types
export interface ActionProposal {
  id: string;
  label: string;
  satisfies: string[];
  costs?: Partial<Resources>;
  risks?: Record<string, number>;
  time: string;
  requirements?: string[];
  mapRefs?: string[];
  rewards?: Partial<Resources>;
  description: string;
  effects?: (string | LegitimacyEffect | RegionalEffect | AmbitionEffect | ModifierEffect)[];
}

export interface LegitimacyEffect {
  type: 'legitimacy';
  meter: string;
  change: number;
}

export interface RegionalEffect {
  type: 'region';
  property: string;
  change: number;
}

export interface EventChoice {
  id: string;
  label: string;
  costs?: Partial<Resources>;
  effects?: string[];
  riskTags?: string[];
}

export interface EventCard {
  id: string;
  text: string;
  choices: EventChoice[];
}

// DSL Types (Enhanced for Dynamic Ambition System)
export interface AmbitionEffect {
  type: 'ambition';
  domain: string;      // 'power', 'wealth', 'faith', 'virtue', 'freedom', 'creation'
  change: number;      // Delta to apply (-1.0 to 1.0)
}

export interface ModifierEffect {
  type: 'modifier';
  modifier: string;    // 'peaceful', 'ruthless', 'ascetic', 'opulent', 'secretive', 'charismatic'
  change: number;      // Delta to apply (-1.0 to 1.0)
}

export interface PathRule {
  id: string;
  label?: string;
  description?: string;
  requirements?: string[];
  costs?: Partial<Resources>;
  rewards?: Partial<Resources>;
  time: string;
  risks?: Record<string, number>;
  effects?: (string | LegitimacyEffect | RegionalEffect | AmbitionEffect | ModifierEffect)[];
  mapRefs?: string[];           // Map reference locations
  
  // Dynamic Ambition System extensions
  domains?: string[];           // Which ambition domains this path serves
  modifierRequirements?: {      // Required modifier levels
    [modifier: string]: number;
  };
  scaleRequirement?: 'local' | 'regional' | 'world'; // Required ambition scale
}

export interface RequirementRule {
  id: string;
  label: string;
  paths: Record<string, PathRule>;
  
  // Dynamic Ambition System extensions  
  domains?: string[];           // Which ambition domains this requirement serves
  spawnConditions?: {           // Conditions for dynamic spawning
    domainThreshold?: {
      domain: string;
      threshold: number;
    };
    modifierRequirement?: {
      modifier: string;
      threshold: number;
    };
  };
}

export interface GeneratorRule {
  id: string;
  conditions: string[];
  action: ActionProposal;
  
  // Dynamic Ambition System extensions
  domains?: string[];           // Which domains this generator serves
  ambitionConditions?: {        // Ambition-based spawn conditions
    [domain: string]: number;   // Minimum domain weight required
  };
  modifierConditions?: {        // Modifier-based spawn conditions
    [modifier: string]: number; // Minimum modifier value required
  };
}

export interface KnowledgeBase {
  requirements: Record<string, RequirementRule>;
  generators: GeneratorRule[];
}

// Utility Types
export interface GameStartResult {
  ambition: AmbitionCanonical;
  graph: RequirementGraph;
  world: WorldState;
  proposals: ActionProposal[];
  events: EventCard[];
}

export interface GameState {
  graph: RequirementGraph;
  world: WorldState;
  pendingActions: ActionProposal[];
  lastEvents: EventCard[];
}

export interface AdvanceResult {
  world: WorldState;
  events: EventCard[];
  proposals: ActionProposal[];
}