import { ActionProposal, WorldState, Faction } from '../types/index.js';
import { FactionAmbition, FactionRelationship } from './factions.js';
import { SeededRandom } from './worldGen.js';

export interface FactionAction {
  id: string;
  factionId: string;
  type: 'expand' | 'trade' | 'diplomatic' | 'military' | 'internal' | 'religious';
  targetId?: string;
  description: string;
  probability: number;
  effects: FactionActionEffect[];
  cost: number;
}

export interface FactionActionEffect {
  type: 'power_change' | 'relationship_change' | 'resource_change' | 'region_control' | 'faction_modifier';
  target: string;
  value: number;
  duration?: number;
}

export interface FactionPlanningContext {
  faction: Faction;
  ambition: FactionAmbition;
  world: WorldState;
  relationships: FactionRelationship[];
  availableActions: FactionAction[];
  tick: number;
}

const FACTION_ACTION_TEMPLATES = {
  expand: [
    {
      type: 'military' as const,
      description: 'Launch military expansion into {target}',
      baseCost: 150,
      effects: [
        { type: 'region_control' as const, target: '{target}', value: 0.3 },
        { type: 'power_change' as const, target: 'self', value: 10 }
      ]
    },
    {
      type: 'diplomatic' as const,
      description: 'Negotiate territorial agreement with {target}',
      baseCost: 80,
      effects: [
        { type: 'relationship_change' as const, target: '{target}', value: 0.2 },
        { type: 'region_control' as const, target: '{target}', value: 0.1 }
      ]
    }
  ],
  trade: [
    {
      type: 'trade' as const,
      description: 'Establish trade route with {target}',
      baseCost: 100,
      effects: [
        { type: 'resource_change' as const, target: 'self', value: 50 },
        { type: 'relationship_change' as const, target: '{target}', value: 0.1 }
      ]
    },
    {
      type: 'internal' as const,
      description: 'Improve internal trade infrastructure',
      baseCost: 120,
      effects: [
        { type: 'faction_modifier' as const, target: 'self', value: 0.1 },
        { type: 'resource_change' as const, target: 'self', value: 30 }
      ]
    }
  ],
  diplomatic: [
    {
      type: 'diplomatic' as const,
      description: 'Send diplomatic envoy to {target}',
      baseCost: 50,
      effects: [
        { type: 'relationship_change' as const, target: '{target}', value: 0.15 }
      ]
    },
    {
      type: 'diplomatic' as const,
      description: 'Forge alliance with {target}',
      baseCost: 200,
      effects: [
        { type: 'relationship_change' as const, target: '{target}', value: 0.4 }
      ]
    }
  ],
  military: [
    {
      type: 'military' as const,
      description: 'Recruit and train new forces',
      baseCost: 100,
      effects: [
        { type: 'power_change' as const, target: 'self', value: 15 }
      ]
    },
    {
      type: 'military' as const,
      description: 'Raid {target} territory',
      baseCost: 80,
      effects: [
        { type: 'resource_change' as const, target: 'self', value: 40 },
        { type: 'relationship_change' as const, target: '{target}', value: -0.3 },
        { type: 'power_change' as const, target: '{target}', value: -5 }
      ]
    }
  ],
  internal: [
    {
      type: 'internal' as const,
      description: 'Strengthen internal governance',
      baseCost: 90,
      effects: [
        { type: 'faction_modifier' as const, target: 'self', value: 0.15 }
      ]
    },
    {
      type: 'internal' as const,
      description: 'Develop faction infrastructure',
      baseCost: 150,
      effects: [
        { type: 'faction_modifier' as const, target: 'self', value: 0.2 },
        { type: 'power_change' as const, target: 'self', value: 8 }
      ]
    }
  ],
  religious: [
    {
      type: 'religious' as const,
      description: 'Spread faith to {target}',
      baseCost: 70,
      effects: [
        { type: 'faction_modifier' as const, target: 'self', value: 0.1 },
        { type: 'relationship_change' as const, target: '{target}', value: 0.05 }
      ]
    },
    {
      type: 'religious' as const,
      description: 'Build sacred sites and temples',
      baseCost: 130,
      effects: [
        { type: 'faction_modifier' as const, target: 'self', value: 0.25 }
      ]
    }
  ]
};

export function planFactionActions(context: FactionPlanningContext, seed: number): FactionAction[] {
  const rng = new SeededRandom(seed + context.faction.id.charCodeAt(0) * 1000);
  const actions: FactionAction[] = [];
  
  const profile = context.ambition.profile;
  const faction = context.faction;
  
  const actionPriorities = calculateActionPriorities(profile);
  
  for (const [actionType, priority] of Object.entries(actionPriorities)) {
    if (priority > 0.2 && actions.length < 3) {
      const generatedActions = generateActionsOfType(
        actionType as keyof typeof FACTION_ACTION_TEMPLATES,
        context,
        rng,
        priority
      );
      actions.push(...generatedActions);
    }
  }
  
  return actions.slice(0, 2);
}

function calculateActionPriorities(profile: any): Record<string, number> {
  return {
    expand: profile.power * 0.8 + profile.virtue * 0.2,
    trade: profile.wealth * 0.7 + profile.creation * 0.3,
    diplomatic: profile.virtue * 0.5 + profile.wealth * 0.3 + profile.faith * 0.2,
    military: profile.power * 0.6 + (1 - profile.modifiers.peaceful || 0) * 0.4,
    internal: profile.creation * 0.4 + profile.virtue * 0.4 + profile.faith * 0.2,
    religious: profile.faith * 0.8 + profile.virtue * 0.2
  };
}

function generateActionsOfType(
  actionType: keyof typeof FACTION_ACTION_TEMPLATES,
  context: FactionPlanningContext,
  rng: SeededRandom,
  priority: number
): FactionAction[] {
  const templates = FACTION_ACTION_TEMPLATES[actionType];
  const actions: FactionAction[] = [];
  
  const selectedTemplate = rng.choice(templates as any[]);
  const targetOptions = getValidTargets(actionType, context);
  
  if (actionType === 'internal' || actionType === 'religious') {
    const action = createFactionAction(
      selectedTemplate,
      context.faction,
      null,
      priority,
      rng
    );
    if (action) actions.push(action);
  } else if (targetOptions.length > 0) {
    const target = rng.choice(targetOptions);
    const action = createFactionAction(
      selectedTemplate,
      context.faction,
      target,
      priority,
      rng
    );
    if (action) actions.push(action);
  }
  
  return actions;
}

function getValidTargets(
  actionType: keyof typeof FACTION_ACTION_TEMPLATES,
  context: FactionPlanningContext
): string[] {
  const { faction, world, relationships } = context;
  
  switch (actionType) {
    case 'expand':
      return world.regions
        .filter(r => !r.controlled && !faction.regions.includes(r.id))
        .map(r => r.id);
    
    case 'trade':
    case 'diplomatic':
      return world.factions
        .filter(f => f.id !== faction.id)
        .map(f => f.id);
    
    case 'military':
      const hostileFactions = relationships
        .filter(rel => 
          (rel.factionA === faction.id || rel.factionB === faction.id) &&
          (rel.stance === 'hostile' || rel.stance === 'war')
        )
        .map(rel => rel.factionA === faction.id ? rel.factionB : rel.factionA);
      
      return hostileFactions.length > 0 
        ? hostileFactions 
        : world.factions.filter(f => f.id !== faction.id).map(f => f.id);
    
    default:
      return [];
  }
}

function createFactionAction(
  template: any,
  faction: Faction,
  target: string | null,
  priority: number,
  rng: SeededRandom
): FactionAction | null {
  const description = target 
    ? template.description.replace('{target}', target)
    : template.description;
  
  const effects = template.effects.map((effect: any) => ({
    ...effect,
    target: effect.target === '{target}' ? target : effect.target
  }));
  
  const affordabilityCheck = template.baseCost <= faction.power * 2;
  if (!affordabilityCheck && rng.next() > 0.3) {
    return null;
  }
  
  return {
    id: `${faction.id}_${template.type}_${Date.now()}_${rng.nextInt(1000, 9999)}`,
    factionId: faction.id,
    type: template.type,
    targetId: target || undefined,
    description,
    probability: priority * (0.6 + rng.next() * 0.4),
    effects,
    cost: template.baseCost
  };
}

export function executeFactionAction(
  action: FactionAction,
  world: WorldState,
  relationships: FactionRelationship[]
): {
  updatedWorld: WorldState;
  updatedRelationships: FactionRelationship[];
  outcome: string;
} {
  const updatedWorld = JSON.parse(JSON.stringify(world));
  const updatedRelationships = JSON.parse(JSON.stringify(relationships));
  
  let outcome = `${action.description}`;
  
  for (const effect of action.effects) {
    outcome += applyFactionActionEffect(effect, action, updatedWorld, updatedRelationships);
  }
  
  return {
    updatedWorld,
    updatedRelationships,
    outcome
  };
}

function applyFactionActionEffect(
  effect: FactionActionEffect,
  action: FactionAction,
  world: WorldState,
  relationships: FactionRelationship[]
): string {
  switch (effect.type) {
    case 'power_change':
      const powerFaction = world.factions.find(f => 
        effect.target === 'self' ? f.id === action.factionId : f.id === effect.target
      );
      if (powerFaction) {
        powerFaction.power = Math.max(0, Math.min(100, powerFaction.power + effect.value));
        return ` (Power ${effect.value > 0 ? '+' : ''}${effect.value})`;
      }
      break;
    
    case 'relationship_change':
      const relationship = relationships.find(rel => 
        (rel.factionA === action.factionId && rel.factionB === effect.target) ||
        (rel.factionB === action.factionId && rel.factionA === effect.target)
      );
      if (relationship) {
        relationship.strength = Math.max(0, Math.min(1, relationship.strength + effect.value));
        if (relationship.strength > 0.8 && relationship.stance === 'neutral') {
          relationship.stance = 'allied';
        } else if (relationship.strength < 0.2 && relationship.stance === 'neutral') {
          relationship.stance = 'hostile';
        }
        return ` (Relations ${effect.value > 0 ? '+' : ''}${(effect.value * 100).toFixed(0)}%)`;
      }
      break;
    
    case 'resource_change':
      const resourceFaction = world.factions.find(f => f.id === action.factionId);
      if (resourceFaction) {
        resourceFaction.power += effect.value * 0.1;
        return ` (Resources ${effect.value > 0 ? '+' : ''}${effect.value})`;
      }
      break;
    
    case 'region_control':
      const region = world.regions.find(r => r.id === effect.target);
      const controllingFaction = world.factions.find(f => f.id === action.factionId);
      if (region && controllingFaction && !region.controlled) {
        const success = Math.random() < effect.value;
        if (success) {
          controllingFaction.regions.push(region.id);
          return ` (Gained control of ${region.name})`;
        } else {
          return ` (Failed to gain control)`;
        }
      }
      break;
    
    case 'faction_modifier':
      const modifierFaction = world.factions.find(f => f.id === action.factionId);
      if (modifierFaction) {
        modifierFaction.power += effect.value * 20;
        return ` (Faction strength improved)`;
      }
      break;
  }
  
  return '';
}

export function generateFactionEvents(
  executedActions: FactionAction[],
  world: WorldState
): string[] {
  const events: string[] = [];
  
  for (const action of executedActions) {
    const faction = world.factions.find(f => f.id === action.factionId);
    if (!faction) continue;
    
    events.push(`${faction.name}: ${action.description}`);
  }
  
  return events;
}

export function calculateFactionInfluence(
  faction: Faction,
  world: WorldState
): number {
  const baseInfluence = faction.power / 100;
  const regionInfluence = faction.regions.length * 0.1;
  const totalInfluence = Math.min(1.0, baseInfluence + regionInfluence);
  
  return totalInfluence;
}

export function getFactionPowerBalance(world: WorldState): Record<string, number> {
  const totalPower = world.factions.reduce((sum, f) => sum + f.power, 0);
  const powerBalance: Record<string, number> = {};
  
  for (const faction of world.factions) {
    powerBalance[faction.id] = totalPower > 0 ? faction.power / totalPower : 0;
  }
  
  return powerBalance;
}