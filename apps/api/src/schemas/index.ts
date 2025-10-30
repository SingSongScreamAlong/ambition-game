import { z } from 'zod';

// Request schemas
export const StartGameSchema = z.object({
  rawAmbition: z.string().min(1, 'Ambition cannot be empty'),
  seed: z.number().optional(),
});

export const ChooseActionSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  actionId: z.string().min(1, 'Action ID is required'),
  choiceId: z.string().optional(), // For event choices
});

export const AdvanceGameSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
});

export const GetStateSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
});

// Response schemas for validation/documentation
export const ResourcesSchema = z.object({
  gold: z.number(),
  grain: z.number(),
  iron: z.number(),
  wood: z.number(),
  stone: z.number(),
});

export const PeopleSchema = z.object({
  population: z.number(),
  loyalty: z.number(),
  unrest: z.number(),
  faith: z.number(),
});

export const ForcesSchema = z.object({
  units: z.number(),
  morale: z.number(),
  supply: z.number(),
});

export const RegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  controlled: z.boolean(),
  resources: ResourcesSchema.partial(),
  people: PeopleSchema,
  security: z.number(),
});

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  stance: z.enum(['allied', 'neutral', 'hostile']),
  power: z.number(),
  regions: z.array(z.string()),
});

export const WorldStateSchema = z.object({
  seed: z.number(),
  regions: z.array(RegionSchema),
  factions: z.array(FactionSchema),
  resources: ResourcesSchema,
  people: PeopleSchema,
  forces: ForcesSchema,
  traits: z.array(z.string()),
  tick: z.number(),
  playerId: z.string(),
});

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['unmet', 'met']),
  needs: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
});

export const RequirementGraphSchema = z.object({
  ambition: z.string(),
  nodes: z.array(GraphNodeSchema),
});

export const ActionProposalSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  satisfies: z.array(z.string()),
  costs: ResourcesSchema.partial().optional(),
  risks: z.record(z.number()).optional(),
  time: z.string(),
  requirements: z.array(z.string()).optional(),
  mapRefs: z.array(z.string()).optional(),
  rewards: ResourcesSchema.partial().optional(),
});

export const EventChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  costs: ResourcesSchema.partial().optional(),
  effects: z.array(z.string()).optional(),
  riskTags: z.array(z.string()).optional(),
});

export const EventCardSchema = z.object({
  id: z.string(),
  text: z.string(),
  choices: z.array(EventChoiceSchema),
});

export const AmbitionCanonicalSchema = z.object({
  archetypes: z.array(z.string()),
  virtues: z.array(z.string()),
  vices: z.array(z.string()),
  weights: z.record(z.number()),
});

// Combined response schemas
export const GameStartResponseSchema = z.object({
  ambition: AmbitionCanonicalSchema,
  graph: RequirementGraphSchema,
  world: WorldStateSchema,
  proposals: z.array(ActionProposalSchema),
  events: z.array(EventCardSchema),
});

export const GameStateResponseSchema = z.object({
  graph: RequirementGraphSchema,
  world: WorldStateSchema,
  pendingActions: z.array(ActionProposalSchema),
  lastEvents: z.array(EventCardSchema),
});

export const AdvanceResponseSchema = z.object({
  world: WorldStateSchema,
  events: z.array(EventCardSchema),
  proposals: z.array(ActionProposalSchema),
});

export const ChooseResponseSchema = z.object({
  world: WorldStateSchema,
  events: z.array(EventCardSchema),
  proposals: z.array(ActionProposalSchema),
});

// Type exports for TypeScript
export type StartGameRequest = z.infer<typeof StartGameSchema>;
export type ChooseActionRequest = z.infer<typeof ChooseActionSchema>;
export type AdvanceGameRequest = z.infer<typeof AdvanceGameSchema>;
export type GetStateRequest = z.infer<typeof GetStateSchema>;

export type GameStartResponse = z.infer<typeof GameStartResponseSchema>;
export type GameStateResponse = z.infer<typeof GameStateResponseSchema>;
export type AdvanceResponse = z.infer<typeof AdvanceResponseSchema>;
export type ChooseResponse = z.infer<typeof ChooseResponseSchema>;