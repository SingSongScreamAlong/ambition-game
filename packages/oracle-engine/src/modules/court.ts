import { WorldState, Resources } from '../types/index.js';
import { PlayerInfluence, InfluenceChange } from './influence.js';
import { FactionAmbition } from './factions.js';
import { Offer, TreatyType } from './diplomacy.js';
import { SeededRandom } from './worldGen.js';

export interface CourtEvent {
  id: string;
  type: 'petition' | 'trade_request' | 'dispute' | 'emergency' | 'ceremony';
  title: string;
  description: string;
  petitioner: {
    name: string;
    type: 'noble' | 'merchant' | 'clergy' | 'commoner' | 'foreign_envoy';
    factionId?: string; // if representing a faction
  };
  choices: CourtChoice[];
  urgency: 'low' | 'medium' | 'high';
  expiresAt: number; // tick when event expires
  context: Record<string, any>; // additional data for choices
}

export interface CourtChoice {
  id: string;
  label: string;
  description: string;
  costs?: Partial<Resources>;
  risks?: Record<string, number>;
  effects: CourtChoiceEffect[];
  requirements?: {
    legitimacy?: Partial<{ law: number; faith: number; lineage: number; might: number }>;
    resources?: Partial<Resources>;
    titles?: string[];
  };
}

export interface CourtChoiceEffect {
  type: 'influence' | 'legitimacy' | 'resources' | 'trait' | 'diplomacy_offer' | 'event_chain';
  target?: string;
  value?: number | string;
  duration?: number; // for temporary effects
  description: string;
}

export interface CourtState {
  activeEvents: CourtEvent[];
  eventHistory: CourtEvent[];
  lastCourtSession: number;
  courtFrequency: number; // ticks between court sessions
}

const COURT_EVENT_TEMPLATES = [
  {
    type: 'petition' as const,
    title: 'Petition for Tax Relief',
    description: 'Merchants from {region} petition for reduced taxes after a poor harvest',
    petitioner: { name: 'Merchant Guild Representative', type: 'merchant' as const },
    choices: [
      {
        id: 'grant_relief',
        label: 'Grant Tax Relief',
        description: 'Reduce taxes temporarily to help the merchants',
        costs: { gold: 50 },
        effects: [
          { type: 'influence', target: 'all_merchants', value: 15, description: 'Merchants appreciate your compassion' },
          { type: 'legitimacy', value: 5, target: 'law', description: 'Shows wise governance' }
        ]
      },
      {
        id: 'maintain_taxes',
        label: 'Maintain Taxes',
        description: 'The realm needs its revenue',
        effects: [
          { type: 'resources', value: 30, target: 'gold', description: 'Treasury remains full' },
          { type: 'influence', target: 'all_merchants', value: -10, description: 'Merchants disappointed' }
        ]
      },
      {
        id: 'increase_taxes',
        label: 'Increase Taxes',
        description: 'The realm demands more during hard times',
        effects: [
          { type: 'resources', value: 80, target: 'gold', description: 'Treasury gains significantly' },
          { type: 'influence', target: 'all_merchants', value: -25, description: 'Merchants outraged' },
          { type: 'legitimacy', value: -8, target: 'law', description: 'Seen as tyrannical' }
        ]
      }
    ]
  },
  {
    type: 'trade_request' as const,
    title: 'Foreign Trade Charter',
    description: 'An envoy from {faction} requests exclusive trading rights in your realm',
    petitioner: { name: 'Foreign Trade Envoy', type: 'foreign_envoy' as const },
    choices: [
      {
        id: 'grant_charter',
        label: 'Grant Exclusive Charter',
        description: 'Give them monopoly trading rights',
        effects: [
          { type: 'resources', value: 150, target: 'gold', description: 'Large upfront payment' },
          { type: 'diplomacy_offer', target: 'faction', value: 'trade', description: 'Offer trade treaty' },
          { type: 'influence', target: 'local_merchants', value: -20, description: 'Local merchants angry about competition' }
        ]
      },
      {
        id: 'limited_charter',
        label: 'Limited Trading Rights',
        description: 'Allow trade but no monopoly',
        effects: [
          { type: 'resources', value: 75, target: 'gold', description: 'Modest payment' },
          { type: 'influence', target: 'faction', value: 8, description: 'Some goodwill gained' }
        ]
      },
      {
        id: 'reject_charter',
        label: 'Reject Request',
        description: 'Protect local merchants',
        effects: [
          { type: 'influence', target: 'local_merchants', value: 12, description: 'Local merchants pleased' },
          { type: 'influence', target: 'faction', value: -15, description: 'Foreign faction disappointed' }
        ]
      }
    ]
  },
  {
    type: 'dispute' as const,
    title: 'Religious Dispute',
    description: 'Two religious orders dispute over control of a sacred site in {region}',
    petitioner: { name: 'High Cleric', type: 'clergy' as const },
    choices: [
      {
        id: 'favor_orthodox',
        label: 'Support Orthodox Order',
        description: 'Side with the traditional religious authority',
        effects: [
          { type: 'legitimacy', value: 10, target: 'faith', description: 'Orthodox clergy grateful' },
          { type: 'influence', target: 'orthodox_faction', value: 20, description: 'Strong support from orthodox' },
          { type: 'influence', target: 'reform_faction', value: -15, description: 'Reformists disappointed' }
        ]
      },
      {
        id: 'favor_reform',
        label: 'Support Reform Order',
        description: 'Back the progressive religious movement',
        effects: [
          { type: 'influence', target: 'reform_faction', value: 25, description: 'Reformists very pleased' },
          { type: 'influence', target: 'orthodox_faction', value: -20, description: 'Orthodox clergy angered' },
          { type: 'legitimacy', value: -5, target: 'faith', description: 'Challenges traditional authority' }
        ]
      },
      {
        id: 'shared_custody',
        label: 'Shared Custody',
        description: 'Order both groups to share the site',
        requirements: { legitimacy: { law: 40 } },
        effects: [
          { type: 'legitimacy', value: 8, target: 'law', description: 'Shows wise judgment' },
          { type: 'influence', target: 'orthodox_faction', value: -5, description: 'Orthodox slightly disappointed' },
          { type: 'influence', target: 'reform_faction', value: -5, description: 'Reformists slightly disappointed' }
        ]
      }
    ]
  },
  {
    type: 'emergency' as const,
    title: 'Border Raid Emergency',
    description: 'Raiders from {threat_region} have attacked border villages. Survivors seek aid and protection',
    petitioner: { name: 'Village Elder', type: 'commoner' as const },
    choices: [
      {
        id: 'military_response',
        label: 'Send Military Force',
        description: 'Deploy troops to hunt down the raiders',
        costs: { gold: 80 },
        requirements: { resources: { gold: 80 } },
        effects: [
          { type: 'influence', target: 'all_commoners', value: 15, description: 'People feel protected' },
          { type: 'legitimacy', value: 8, target: 'might', description: 'Shows military strength' },
          { type: 'trait', value: 'protector', description: 'Gained reputation as protector' }
        ]
      },
      {
        id: 'defensive_measures',
        label: 'Strengthen Defenses',
        description: 'Fortify border regions against future attacks',
        costs: { stone: 40, gold: 60 },
        effects: [
          { type: 'influence', target: 'border_regions', value: 20, description: 'Border folk grateful' },
          { type: 'legitimacy', value: 5, target: 'law', description: 'Shows responsible governance' }
        ]
      },
      {
        id: 'diplomatic_solution',
        label: 'Seek Diplomatic Solution',
        description: 'Try to negotiate with the raiders\' leaders',
        requirements: { legitimacy: { law: 30 } },
        effects: [
          { type: 'influence', target: 'all_commoners', value: -8, description: 'Some see this as weakness' },
          { type: 'legitimacy', value: 10, target: 'law', description: 'Shows preference for peace' },
          { type: 'diplomacy_offer', target: 'raider_faction', value: 'non_aggression', description: 'Offer peace treaty' }
        ]
      }
    ]
  },
  {
    type: 'ceremony' as const,
    title: 'Harvest Festival Planning',
    description: 'The annual harvest festival approaches. How should the realm celebrate?',
    petitioner: { name: 'Festival Organizer', type: 'commoner' as const },
    choices: [
      {
        id: 'grand_festival',
        label: 'Grand Festival',
        description: 'Spare no expense for a magnificent celebration',
        costs: { gold: 120, grain: 50 },
        effects: [
          { type: 'influence', target: 'all_factions', value: 12, description: 'Everyone enjoys the festivities' },
          { type: 'legitimacy', value: 8, target: 'law', description: 'Shows prosperity and good governance' },
          { type: 'trait', value: 'generous', description: 'Known for generosity' }
        ]
      },
      {
        id: 'modest_festival',
        label: 'Modest Festival',
        description: 'A reasonable celebration within our means',
        costs: { gold: 60, grain: 25 },
        effects: [
          { type: 'influence', target: 'all_factions', value: 6, description: 'Pleasant celebration' },
          { type: 'legitimacy', value: 3, target: 'law', description: 'Shows fiscal responsibility' }
        ]
      },
      {
        id: 'work_festival',
        label: 'Working Harvest',
        description: 'Focus on work rather than celebration',
        effects: [
          { type: 'resources', value: 80, target: 'grain', description: 'Extra grain harvested' },
          { type: 'resources', value: 40, target: 'gold', description: 'Money saved from celebration' },
          { type: 'influence', target: 'all_factions', value: -15, description: 'People disappointed by lack of celebration' }
        ]
      }
    ]
  }
];

/**
 * Initialize court state
 */
export function initializeCourtState(): CourtState {
  return {
    activeEvents: [],
    eventHistory: [],
    lastCourtSession: 0,
    courtFrequency: 8 // Court session every 8 ticks
  };
}

/**
 * Generate court events for the current session
 */
export function generateCourtEvents(
  world: WorldState,
  playerInfluence: PlayerInfluence,
  factionAmbitions: FactionAmbition[],
  courtState: CourtState,
  seed: number
): CourtEvent[] {
  const rng = new SeededRandom(seed + world.tick * 1000);
  const events: CourtEvent[] = [];
  
  // Don't generate events too frequently
  if (world.tick - courtState.lastCourtSession < courtState.courtFrequency) {
    return events;
  }
  
  // Generate 1-3 events per session
  const eventCount = rng.nextInt(1, 3);
  
  for (let i = 0; i < eventCount; i++) {
    const template = rng.choice(COURT_EVENT_TEMPLATES);
    const event = createEventFromTemplate(template, world, factionAmbitions, rng);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Create a specific court event from template
 */
function createEventFromTemplate(
  template: any,
  world: WorldState,
  factionAmbitions: FactionAmbition[],
  rng: SeededRandom
): CourtEvent | null {
  const availableRegions = world.regions.filter(r => r.controlled);
  const availableFactions = factionAmbitions.filter(fa => 
    world.factions.find(f => f.id === fa.factionId && f.stance !== 'hostile')
  );
  
  if (availableRegions.length === 0) return null;
  
  const selectedRegion = rng.choice(availableRegions);
  const selectedFaction = availableFactions.length > 0 ? rng.choice(availableFactions) : null;
  
  // Replace placeholders in template
  let description = template.description;
  description = description.replace('{region}', selectedRegion.name);
  
  if (selectedFaction && description.includes('{faction}')) {
    const faction = world.factions.find(f => f.id === selectedFaction.factionId);
    description = description.replace('{faction}', faction?.name || 'Unknown Faction');
  }
  
  // Create the event
  const event: CourtEvent = {
    id: `court_${world.tick}_${Date.now()}_${rng.nextInt(1000, 9999)}`,
    type: template.type,
    title: template.title,
    description,
    petitioner: {
      ...template.petitioner,
      factionId: template.petitioner.type === 'foreign_envoy' ? selectedFaction?.factionId : undefined
    },
    choices: template.choices.map((choice: any) => ({
      ...choice,
      effects: choice.effects.map((effect: any) => ({
        ...effect,
        target: effect.target === 'faction' ? selectedFaction?.factionId : effect.target
      }))
    })),
    urgency: determineUrgency(template.type),
    expiresAt: world.tick + getEventDuration(template.type),
    context: {
      regionId: selectedRegion.id,
      factionId: selectedFaction?.factionId
    }
  };
  
  return event;
}

/**
 * Determine event urgency based on type
 */
function determineUrgency(type: string): 'low' | 'medium' | 'high' {
  switch (type) {
    case 'emergency': return 'high';
    case 'dispute': return 'medium';
    case 'trade_request': return 'medium';
    case 'petition': return 'low';
    case 'ceremony': return 'low';
    default: return 'low';
  }
}

/**
 * Get event duration in ticks
 */
function getEventDuration(type: string): number {
  switch (type) {
    case 'emergency': return 3; // Must respond quickly
    case 'dispute': return 5;
    case 'trade_request': return 8;
    case 'petition': return 10;
    case 'ceremony': return 12;
    default: return 8;
  }
}

/**
 * Process a court choice and apply its effects
 */
export function processCourtChoice(
  eventId: string,
  choiceId: string,
  world: WorldState,
  playerInfluence: PlayerInfluence,
  factionAmbitions: FactionAmbition[],
  courtState: CourtState
): {
  success: boolean;
  resourceChanges?: Partial<Resources>;
  legitimacyChanges?: Partial<{ law: number; faith: number; lineage: number; might: number }>;
  influenceChanges?: InfluenceChange[];
  newTraits?: string[];
  diplomacyOffers?: Offer[];
  events?: string[];
  error?: string;
} {
  const event = courtState.activeEvents.find(e => e.id === eventId);
  if (!event) {
    return { success: false, error: 'Event not found' };
  }
  
  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) {
    return { success: false, error: 'Choice not found' };
  }
  
  // Check requirements
  if (choice.requirements) {
    const req = choice.requirements;
    
    // Check legitimacy requirements
    if (req.legitimacy) {
      for (const [type, required] of Object.entries(req.legitimacy)) {
        const current = world.legitimacy[type as keyof typeof world.legitimacy];
        if (current < required) {
          return { 
            success: false, 
            error: `Insufficient ${type} legitimacy (need ${required}, have ${current})` 
          };
        }
      }
    }
    
    // Check resource requirements
    if (req.resources) {
      for (const [resource, required] of Object.entries(req.resources)) {
        const current = world.resources[resource as keyof typeof world.resources];
        if (current < required) {
          return { 
            success: false, 
            error: `Insufficient ${resource} (need ${required}, have ${current})` 
          };
        }
      }
    }
  }
  
  // Apply costs
  let resourceChanges: Partial<Resources> = {};
  if (choice.costs) {
    for (const [resource, cost] of Object.entries(choice.costs)) {
      resourceChanges[resource as keyof Resources] = -(cost as number);
    }
  }
  
  // Process effects
  let legitimacyChanges: Partial<{ law: number; faith: number; lineage: number; might: number }> = {};
  const influenceChanges: InfluenceChange[] = [];
  const newTraits: string[] = [];
  const diplomacyOffers: Offer[] = [];
  const events: string[] = [];
  
  for (const effect of choice.effects) {
    switch (effect.type) {
      case 'resources':
        if (effect.target && effect.value) {
          const currentChange = resourceChanges[effect.target as keyof Resources] || 0;
          resourceChanges[effect.target as keyof Resources] = currentChange + (effect.value as number);
        }
        break;
      
      case 'legitimacy':
        if (effect.target && effect.value) {
          legitimacyChanges[effect.target as keyof typeof legitimacyChanges] = effect.value as number;
        }
        break;
      
      case 'influence':
        if (effect.target && effect.value) {
          // Handle special targets
          if (effect.target === 'all_factions') {
            for (const fa of factionAmbitions) {
              influenceChanges.push({
                type: 'favor',
                target: fa.factionId,
                delta: effect.value as number,
                reason: effect.description
              });
            }
          } else if (effect.target === 'all_merchants') {
            for (const fa of factionAmbitions) {
              if (fa.profile.wealth > 0.3) {
                influenceChanges.push({
                  type: 'favor',
                  target: fa.factionId,
                  delta: effect.value as number,
                  reason: effect.description
                });
              }
            }
          } else if (effect.target === 'all_commoners') {
            influenceChanges.push({
              type: 'reputation',
              delta: effect.value as number,
              reason: effect.description
            });
          } else {
            // Specific faction
            influenceChanges.push({
              type: 'favor',
              target: effect.target,
              delta: effect.value as number,
              reason: effect.description
            });
          }
        }
        break;
      
      case 'trait':
        if (effect.value) {
          newTraits.push(effect.value as string);
        }
        break;
      
      case 'diplomacy_offer':
        if (effect.target && effect.value && event.context.factionId) {
          // Create a basic offer template - this would be refined in actual implementation
          const offer: Offer = {
            id: `auto_offer_${Date.now()}`,
            from: 'player',
            to: event.context.factionId,
            treatyType: effect.value as TreatyType,
            terms: [], // Would be filled with appropriate terms
            validUntil: world.tick + 5
          };
          diplomacyOffers.push(offer);
        }
        break;
    }
    
    events.push(effect.description);
  }
  
  return {
    success: true,
    resourceChanges,
    legitimacyChanges,
    influenceChanges,
    newTraits,
    diplomacyOffers,
    events
  };
}

/**
 * Update court state and remove expired events
 */
export function updateCourtState(courtState: CourtState, currentTick: number): CourtState {
  const updated = JSON.parse(JSON.stringify(courtState));
  
  // Move expired events to history
  const expiredEvents = updated.activeEvents.filter((e: CourtEvent) => e.expiresAt <= currentTick);
  updated.eventHistory.push(...expiredEvents);
  
  // Keep only active events
  updated.activeEvents = updated.activeEvents.filter((e: CourtEvent) => e.expiresAt > currentTick);
  
  // Limit history size
  updated.eventHistory = updated.eventHistory.slice(-20);
  
  return updated;
}