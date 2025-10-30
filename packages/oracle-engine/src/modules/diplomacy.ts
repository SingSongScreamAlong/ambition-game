import { WorldState, Resources } from '../types/index.js';
import { FactionAmbition } from './factions.js';
import { PlayerInfluence, getInfluenceScore } from './influence.js';
import { SeededRandom } from './worldGen.js';

export type TreatyType = 'non_aggression' | 'trade' | 'alliance' | 'defense' | 'access' | 'vassalage';

export interface TreatyTerm {
  type: string;
  value?: number;
  duration?: number; // ticks, undefined = permanent
  description: string;
}

export interface Offer {
  id: string;
  from: string; // 'player' or faction ID
  to: string; // faction ID or 'player'
  treatyType: TreatyType;
  terms: TreatyTerm[];
  upfrontCosts?: Partial<Resources>;
  standingEffects?: Record<string, number>; // ongoing resource flows
  validUntil: number; // tick when offer expires
}

export interface Treaty {
  id: string;
  factionA: string; // 'player' or faction ID
  factionB: string; // faction ID
  treatyType: TreatyType;
  terms: TreatyTerm[];
  startTick: number;
  endTick?: number; // undefined = permanent
  status: 'active' | 'expired' | 'broken';
  brokenBy?: string; // who broke it
  brokenAtTick?: number;
}

export interface NegotiationResult {
  decision: 'accept' | 'decline' | 'counter';
  score: number; // -100 to +100, how good they think the deal is
  reasoning: string[];
  counter?: Offer; // if decision is 'counter'
  treaty?: Treaty; // if decision is 'accept'
}

export interface DiplomacyState {
  activeTreaties: Treaty[];
  pendingOffers: Offer[];
  treatyHistory: Treaty[];
  playerTags: string[]; // 'oathbreaker', 'reliable_ally', etc.
}

const TREATY_TEMPLATES = {
  non_aggression: {
    baseTerms: [
      { type: 'no_attack', description: 'Neither party will attack the other' },
      { type: 'no_raid', description: 'No raiding or pillaging of territories' }
    ],
    baseDuration: 20, // ticks
    baseValue: 15
  },
  trade: {
    baseTerms: [
      { type: 'trade_access', description: 'Open borders for merchants' },
      { type: 'tariff_reduction', value: 0.5, description: 'Reduced trade tariffs' }
    ],
    baseDuration: 30,
    baseValue: 25
  },
  alliance: {
    baseTerms: [
      { type: 'mutual_defense', description: 'Mutual defense against external threats' },
      { type: 'information_sharing', description: 'Share intelligence about mutual enemies' },
      { type: 'no_separate_peace', description: 'No separate peace with common enemies' }
    ],
    baseDuration: 50,
    baseValue: 40
  },
  defense: {
    baseTerms: [
      { type: 'defensive_pact', description: 'Come to aid if attacked by third party' }
    ],
    baseDuration: 40,
    baseValue: 30
  },
  access: {
    baseTerms: [
      { type: 'military_access', description: 'Allow armies to pass through territory' }
    ],
    baseDuration: 25,
    baseValue: 20
  },
  vassalage: {
    baseTerms: [
      { type: 'tribute', value: 0.15, description: 'Pay 15% of income as tribute' },
      { type: 'military_service', value: 0.25, description: 'Provide 25% of forces when called' },
      { type: 'no_foreign_treaties', description: 'Cannot make treaties without liege approval' }
    ],
    baseDuration: undefined, // permanent
    baseValue: -30 // negative because it's a submission
  }
};

/**
 * Initialize diplomacy state for a new world
 */
export function initializeDiplomacyState(): DiplomacyState {
  return {
    activeTreaties: [],
    pendingOffers: [],
    treatyHistory: [],
    playerTags: []
  };
}

/**
 * Create a new offer from player to faction
 */
export function createPlayerOffer(
  to: string,
  treatyType: TreatyType,
  world: WorldState,
  customTerms?: TreatyTerm[],
  upfrontCosts?: Partial<Resources>,
  duration?: number
): Offer {
  const template = TREATY_TEMPLATES[treatyType];
  const terms = customTerms || template.baseTerms.map(term => ({
    ...term,
    duration: duration || template.baseDuration
  }));

  return {
    id: `offer_${world.tick}_${Date.now()}`,
    from: 'player',
    to,
    treatyType,
    terms,
    upfrontCosts,
    validUntil: world.tick + 5 // Offers expire in 5 ticks
  };
}

/**
 * Evaluate an offer and determine faction's response
 */
export function evaluateOffer(
  offer: Offer,
  faction: FactionAmbition,
  world: WorldState,
  playerInfluence: PlayerInfluence,
  diplomacyState: DiplomacyState,
  seed: number
): NegotiationResult {
  const rng = new SeededRandom(seed + faction.factionId.charCodeAt(0) * 1000);
  const reasoning: string[] = [];
  
  // Base score from treaty template
  const template = TREATY_TEMPLATES[offer.treatyType];
  let score = template.baseValue;
  reasoning.push(`Base ${offer.treatyType} treaty value: ${template.baseValue}`);
  
  // Player influence with this faction
  const influence = getInfluenceScore(playerInfluence, faction.factionId, faction);
  const influenceBonus = influence * 0.3; // Scale influence to reasonable range
  score += influenceBonus;
  reasoning.push(`Player influence (${influence.toFixed(1)}): ${influenceBonus.toFixed(1)}`);
  
  // Domain alignment bonuses
  const domainBonus = calculateDomainBonus(offer, faction);
  score += domainBonus;
  reasoning.push(`Domain alignment: ${domainBonus.toFixed(1)}`);
  
  // Power balance considerations
  const powerBonus = calculatePowerBalance(offer, faction, world);
  score += powerBonus;
  reasoning.push(`Power balance factor: ${powerBonus.toFixed(1)}`);
  
  // Existing treaties consideration
  const treatyPenalty = calculateTreatyConflicts(offer, faction, diplomacyState);
  score += treatyPenalty;
  if (treatyPenalty !== 0) {
    reasoning.push(`Existing treaty conflicts: ${treatyPenalty.toFixed(1)}`);
  }
  
  // Player reputation effects
  if (playerInfluence.reputation < -30) {
    score -= 15;
    reasoning.push('Poor reputation penalty: -15');
  } else if (playerInfluence.reputation > 50) {
    score += 10;
    reasoning.push('Excellent reputation bonus: +10');
  }
  
  // Oathbreaker penalty
  if (diplomacyState.playerTags.includes('oathbreaker')) {
    score -= 25;
    reasoning.push('Oathbreaker penalty: -25');
  }
  
  // Randomness factor (±10)
  const randomFactor = (rng.next() - 0.5) * 20;
  score += randomFactor;
  reasoning.push(`Random factor: ${randomFactor.toFixed(1)}`);
  
  // Determine decision
  let decision: 'accept' | 'decline' | 'counter';
  
  if (score >= 20) {
    decision = 'accept';
  } else if (score >= -10 && rng.next() < 0.4) {
    decision = 'counter';
  } else {
    decision = 'decline';
  }
  
  const result: NegotiationResult = {
    decision,
    score: Math.max(-100, Math.min(100, score)),
    reasoning
  };
  
  if (decision === 'accept') {
    result.treaty = createTreaty(offer, world.tick);
  } else if (decision === 'counter') {
    result.counter = createCounterOffer(offer, faction, score, world, rng);
  }
  
  return result;
}

/**
 * Calculate domain alignment bonus for offer
 */
function calculateDomainBonus(offer: Offer, faction: FactionAmbition): number {
  let bonus = 0;
  const profile = faction.profile;
  
  switch (offer.treatyType) {
    case 'trade':
      bonus += profile.wealth * 30; // Wealth factions love trade
      bonus += profile.creation * 15; // Creation factions like commerce
      break;
    
    case 'alliance':
    case 'defense':
      bonus += profile.virtue * 20; // Virtue factions value mutual defense
      bonus -= profile.freedom * 10; // Freedom factions dislike binding alliances
      break;
    
    case 'access':
      bonus += profile.faith * 25; // Faith factions want access to holy sites
      bonus += profile.creation * 10; // Scholars want access to libraries
      break;
    
    case 'non_aggression':
      bonus += (profile.modifiers.peaceful || 0) * 25; // Peaceful factions love this
      bonus += profile.virtue * 15;
      break;
    
    case 'vassalage':
      bonus -= profile.freedom * 40; // Freedom factions hate submission
      bonus -= profile.power * 30; // Power factions resist vassalage
      bonus += profile.virtue * 10; // Virtue factions may accept honorable submission
      break;
  }
  
  return bonus;
}

/**
 * Calculate power balance considerations
 */
function calculatePowerBalance(offer: Offer, faction: FactionAmbition, world: WorldState): number {
  const totalPower = world.factions.reduce((sum, f) => sum + f.power, 0);
  const factionPower = world.factions.find(f => f.id === faction.factionId)?.power || 0;
  const powerRatio = factionPower / totalPower;
  
  // Weak factions more eager for protection
  if (powerRatio < 0.2) {
    if (offer.treatyType === 'alliance' || offer.treatyType === 'defense') {
      return 15; // Desperate for protection
    }
    if (offer.treatyType === 'vassalage') {
      return 5; // Might accept vassalage if very weak
    }
  }
  
  // Strong factions less interested in equal treaties
  if (powerRatio > 0.4) {
    if (offer.treatyType === 'alliance') {
      return -10; // Why ally with equals?
    }
    if (offer.treatyType === 'vassalage') {
      return -20; // Strong factions won't submit
    }
  }
  
  return 0;
}

/**
 * Check for conflicts with existing treaties
 */
function calculateTreatyConflicts(
  offer: Offer,
  faction: FactionAmbition,
  diplomacyState: DiplomacyState
): number {
  const existingTreaties = diplomacyState.activeTreaties.filter(
    t => (t.factionA === faction.factionId || t.factionB === faction.factionId) && t.status === 'active'
  );
  
  let penalty = 0;
  
  for (const treaty of existingTreaties) {
    // Can't have multiple alliance/defense pacts easily
    if ((treaty.treatyType === 'alliance' || treaty.treatyType === 'defense') &&
        (offer.treatyType === 'alliance' || offer.treatyType === 'defense')) {
      penalty -= 10;
    }
    
    // Can't be vassal to multiple lords
    if (treaty.treatyType === 'vassalage' && offer.treatyType === 'vassalage') {
      penalty -= 50; // Impossible
    }
  }
  
  return penalty;
}

/**
 * Create a counter-offer
 */
function createCounterOffer(
  originalOffer: Offer,
  faction: FactionAmbition,
  originalScore: number,
  world: WorldState,
  rng: SeededRandom
): Offer {
  const newTerms = [...originalOffer.terms];
  
  // Modify terms to make deal more attractive to faction
  if (originalScore < 0) {
    // If they don't like the deal, make it shorter or add benefits
    for (const term of newTerms) {
      if (term.duration && term.duration > 10) {
        term.duration = Math.max(10, Math.floor(term.duration * 0.7));
        term.description += ' (shortened duration)';
      }
    }
    
    // Maybe request upfront payment
    if (originalOffer.treatyType === 'trade' || originalOffer.treatyType === 'access') {
      // Don't modify upfront costs in counter - that's too complex for MVP
    }
  }
  
  return {
    id: `counter_${world.tick}_${Date.now()}`,
    from: faction.factionId,
    to: originalOffer.from,
    treatyType: originalOffer.treatyType,
    terms: newTerms,
    upfrontCosts: originalOffer.upfrontCosts,
    validUntil: world.tick + 3 // Shorter time for counter-offers
  };
}

/**
 * Create a treaty from an accepted offer
 */
function createTreaty(offer: Offer, currentTick: number): Treaty {
  const maxDuration = Math.max(...offer.terms.map(t => t.duration || 0));
  
  return {
    id: `treaty_${currentTick}_${Date.now()}`,
    factionA: offer.from,
    factionB: offer.to,
    treatyType: offer.treatyType,
    terms: offer.terms,
    startTick: currentTick,
    endTick: maxDuration > 0 ? currentTick + maxDuration : undefined,
    status: 'active'
  };
}

/**
 * Check if treaties are expired and update their status
 */
export function updateTreatyStatus(diplomacyState: DiplomacyState, currentTick: number): DiplomacyState {
  const updated = JSON.parse(JSON.stringify(diplomacyState));
  
  for (const treaty of updated.activeTreaties) {
    if (treaty.status === 'active' && treaty.endTick && currentTick >= treaty.endTick) {
      treaty.status = 'expired';
      updated.treatyHistory.push(treaty);
    }
  }
  
  // Remove expired treaties from active list
  updated.activeTreaties = updated.activeTreaties.filter((t: Treaty) => t.status === 'active');
  
  // Remove expired offers
  updated.pendingOffers = updated.pendingOffers.filter((o: Offer) => o.validUntil > currentTick);
  
  return updated;
}

/**
 * Break a treaty (player action)
 */
export function breakTreaty(
  treatyId: string,
  diplomacyState: DiplomacyState,
  currentTick: number,
  brokenBy: string = 'player'
): DiplomacyState {
  const updated = JSON.parse(JSON.stringify(diplomacyState));
  
  const treaty = updated.activeTreaties.find((t: Treaty) => t.id === treatyId);
  if (treaty) {
    treaty.status = 'broken';
    treaty.brokenBy = brokenBy;
    treaty.brokenAtTick = currentTick;
    
    // Add oathbreaker tag if player broke it
    if (brokenBy === 'player' && !updated.playerTags.includes('oathbreaker')) {
      updated.playerTags.push('oathbreaker');
    }
    
    // Move to history
    updated.treatyHistory.push(treaty);
    updated.activeTreaties = updated.activeTreaties.filter((t: Treaty) => t.id !== treatyId);
  }
  
  return updated;
}

/**
 * Get all treaties involving the player
 */
export function getPlayerTreaties(diplomacyState: DiplomacyState): Treaty[] {
  return diplomacyState.activeTreaties.filter(
    t => t.factionA === 'player' || t.factionB === 'player'
  );
}

/**
 * Check if player has specific type of treaty with faction
 */
export function hasTreatyWith(
  diplomacyState: DiplomacyState,
  factionId: string,
  treatyType?: TreatyType
): boolean {
  return diplomacyState.activeTreaties.some(t => 
    (t.factionA === 'player' && t.factionB === factionId) ||
    (t.factionB === 'player' && t.factionA === factionId) &&
    (!treatyType || t.treatyType === treatyType)
  );
}

/**
 * Get diplomatic status between player and faction
 */
export function getDiplomaticStatus(
  diplomacyState: DiplomacyState,
  factionId: string
): {
  treaties: Treaty[];
  isVassal: boolean;
  isLord: boolean;
  hasAlliance: boolean;
  hasTrade: boolean;
} {
  const treaties = diplomacyState.activeTreaties.filter(
    t => (t.factionA === 'player' && t.factionB === factionId) ||
         (t.factionB === 'player' && t.factionA === factionId)
  );
  
  const vassalTreaty = treaties.find(t => t.treatyType === 'vassalage');
  const isVassal = vassalTreaty ? vassalTreaty.factionA === 'player' : false;
  const isLord = vassalTreaty ? vassalTreaty.factionB === 'player' : false;
  
  return {
    treaties,
    isVassal,
    isLord,
    hasAlliance: treaties.some(t => t.treatyType === 'alliance'),
    hasTrade: treaties.some(t => t.treatyType === 'trade')
  };
}