import { AmbitionProfile, Faction, WorldState } from '../types/index.js';
import { parseAmbition } from './ambition.js';
import { SeededRandom } from './worldGen.js';

export interface FactionAmbition {
  factionId: string;
  profile: AmbitionProfile;
  currentGoals: string[];
  lastAction: string | null;
  plannerCooldown: number;
  relationshipModifiers: Record<string, number>;
}

export interface FactionRelationship {
  factionA: string;
  factionB: string;
  stance: 'allied' | 'neutral' | 'hostile' | 'war' | 'trade';
  strength: number;
  history: string[];
}

const FACTION_ARCHETYPES = {
  kingdoms: {
    domains: { power: 0.4, virtue: 0.25, wealth: 0.15, faith: 0.1, freedom: 0.05, creation: 0.05 },
    modifiers: { lawful: 0.6, aggressive: 0.3, traditional: 0.7 },
    ambitionTemplates: [
      "I shall expand my kingdom's borders through righteous conquest",
      "Divine right guides my rule over these lands",
      "Through law and order I will bring stability to my realm",
      "My lineage demands that I reclaim our ancestral territories"
    ]
  },
  clergy: {
    domains: { faith: 0.5, virtue: 0.3, power: 0.1, creation: 0.05, wealth: 0.03, freedom: 0.02 },
    modifiers: { peaceful: 0.6, zealous: 0.4, traditional: 0.8 },
    ambitionTemplates: [
      "I must spread the divine word to all corners of the realm",
      "Sacred duty compels me to purify this land of heresy",
      "Through prayer and devotion I will guide the faithful",
      "The gods have chosen me to establish their divine order"
    ]
  },
  merchants: {
    domains: { wealth: 0.4, creation: 0.2, power: 0.15, freedom: 0.15, virtue: 0.05, faith: 0.05 },
    modifiers: { ambitious: 0.7, pragmatic: 0.8, innovative: 0.6 },
    ambitionTemplates: [
      "Through trade and commerce I will build an economic empire",
      "Gold flows where opportunity meets preparation",
      "I shall establish trade routes across all known lands",
      "Prosperity for all through mercantile excellence"
    ]
  },
  rebels: {
    domains: { freedom: 0.4, virtue: 0.25, power: 0.2, creation: 0.08, wealth: 0.05, faith: 0.02 },
    modifiers: { rebellious: 0.9, aggressive: 0.5, passionate: 0.7 },
    ambitionTemplates: [
      "I will break the chains that bind the common folk",
      "Freedom for all who suffer under tyrannical rule",
      "Through revolution we shall create a just society",
      "No crown should rule over the free spirits of this land"
    ]
  },
  scholars: {
    domains: { creation: 0.35, virtue: 0.2, faith: 0.15, wealth: 0.1, power: 0.1, freedom: 0.1 },
    modifiers: { intellectual: 0.9, peaceful: 0.7, innovative: 0.8 },
    ambitionTemplates: [
      "Through knowledge and wisdom I will unlock the mysteries of existence",
      "Learning shall be the foundation of a better world",
      "I must preserve and expand the great libraries of knowledge",
      "Innovation and discovery will guide our path to enlightenment"
    ]
  },
  military: {
    domains: { power: 0.45, virtue: 0.2, faith: 0.15, wealth: 0.1, creation: 0.05, freedom: 0.05 },
    modifiers: { aggressive: 0.6, lawful: 0.5, traditional: 0.6 },
    ambitionTemplates: [
      "Military strength is the foundation of lasting peace",
      "Through disciplined force I will protect the innocent",
      "Victory in battle brings honor to our cause",
      "The sword and shield are the pillars of civilization"
    ]
  }
};

export function generateFactionAmbitions(world: WorldState, seed: number): FactionAmbition[] {
  const rng = new SeededRandom(seed + 5000);
  const factionAmbitions: FactionAmbition[] = [];

  for (const faction of world.factions) {
    const archetype = determineFactionArchetype(faction, rng);
    const ambitionProfile = generateFactionAmbitionProfile(faction, archetype, rng);
    
    factionAmbitions.push({
      factionId: faction.id,
      profile: ambitionProfile,
      currentGoals: [],
      lastAction: null,
      plannerCooldown: 0,
      relationshipModifiers: {}
    });
  }

  return factionAmbitions;
}

function determineFactionArchetype(faction: Faction, rng: SeededRandom): keyof typeof FACTION_ARCHETYPES {
  const affinities = faction.domainAffinities;
  
  if (affinities.power > 0.6) return 'kingdoms';
  if (affinities.faith > 0.6) return 'clergy';
  if (affinities.wealth > 0.6) return 'merchants';
  if (affinities.freedom > 0.6) return 'rebels';
  if (affinities.creation > 0.6) return 'scholars';
  if (affinities.power > 0.4 && affinities.virtue > 0.3) return 'military';
  
  const types = Object.keys(FACTION_ARCHETYPES) as Array<keyof typeof FACTION_ARCHETYPES>;
  return rng.choice(types);
}

function generateFactionAmbitionProfile(
  faction: Faction, 
  archetype: keyof typeof FACTION_ARCHETYPES, 
  rng: SeededRandom
): AmbitionProfile {
  const template = FACTION_ARCHETYPES[archetype];
  const ambitionText = rng.choice(template.ambitionTemplates);
  
  let profile = parseAmbition(ambitionText);
  
  profile = {
    ...profile,
    power: template.domains.power + (rng.next() - 0.5) * 0.1,
    wealth: template.domains.wealth + (rng.next() - 0.5) * 0.1,
    faith: template.domains.faith + (rng.next() - 0.5) * 0.1,
    virtue: template.domains.virtue + (rng.next() - 0.5) * 0.1,
    freedom: template.domains.freedom + (rng.next() - 0.5) * 0.1,
    creation: template.domains.creation + (rng.next() - 0.5) * 0.1
  };
  
  const sum = profile.power + profile.wealth + profile.faith + profile.virtue + profile.freedom + profile.creation;
  profile.power /= sum;
  profile.wealth /= sum;
  profile.faith /= sum;
  profile.virtue /= sum;
  profile.freedom /= sum;
  profile.creation /= sum;
  
  profile.modifiers = {
    ...profile.modifiers,
    ...template.modifiers
  };
  
  (profile as any).archetype = `${archetype}_faction`;
  
  return profile;
}

export function generateFactionRelationships(world: WorldState, seed: number): FactionRelationship[] {
  const rng = new SeededRandom(seed + 6000);
  const relationships: FactionRelationship[] = [];
  
  for (let i = 0; i < world.factions.length; i++) {
    for (let j = i + 1; j < world.factions.length; j++) {
      const factionA = world.factions[i];
      const factionB = world.factions[j];
      
      if (!factionA || !factionB) continue;
      
      const compatibility = calculateFactionCompatibility(factionA, factionB);
      const stance = determineInitialStance(compatibility, rng);
      const strength = 0.3 + rng.next() * 0.4;
      
      relationships.push({
        factionA: factionA.id,
        factionB: factionB.id,
        stance,
        strength,
        history: [`Initial ${stance} relationship established`]
      });
    }
  }
  
  return relationships;
}

function calculateFactionCompatibility(factionA: Faction, factionB: Faction): number {
  const domains = ['power', 'wealth', 'faith', 'virtue', 'freedom', 'creation'] as const;
  let compatibility = 0;
  
  for (const domain of domains) {
    const diff = Math.abs(factionA.domainAffinities[domain] - factionB.domainAffinities[domain]);
    compatibility += 1 - diff;
  }
  
  return compatibility / domains.length;
}

function determineInitialStance(compatibility: number, rng: SeededRandom): FactionRelationship['stance'] {
  const roll = rng.next();
  
  if (compatibility > 0.7) {
    return roll < 0.6 ? 'allied' : roll < 0.9 ? 'trade' : 'neutral';
  } else if (compatibility > 0.4) {
    return roll < 0.3 ? 'trade' : roll < 0.8 ? 'neutral' : 'hostile';
  } else {
    return roll < 0.1 ? 'neutral' : roll < 0.7 ? 'hostile' : 'war';
  }
}

export function updateFactionAmbitions(
  factionAmbitions: FactionAmbition[],
  world: WorldState,
  tick: number
): FactionAmbition[] {
  return factionAmbitions.map(fa => {
    if (fa.plannerCooldown > 0) {
      return { ...fa, plannerCooldown: fa.plannerCooldown - 1 };
    }
    
    const faction = world.factions.find(f => f.id === fa.factionId);
    if (!faction) return fa;
    
    const updatedGoals = evaluateFactionGoals(fa, faction, world);
    
    return {
      ...fa,
      currentGoals: updatedGoals,
      plannerCooldown: 2 + Math.floor(Math.random() * 3)
    };
  });
}

function evaluateFactionGoals(
  factionAmbition: FactionAmbition,
  faction: Faction,
  world: WorldState
): string[] {
  const goals: string[] = [];
  const profile = factionAmbition.profile;
  
  if (profile.power > 0.3 && faction.regions.length < 3) {
    goals.push('expand_territory');
  }
  
  if (profile.wealth > 0.3 && faction.power < 80) {
    goals.push('increase_wealth');
  }
  
  if (profile.faith > 0.3) {
    goals.push('spread_faith');
  }
  
  if (profile.virtue > 0.3) {
    goals.push('maintain_order');
  }
  
  if (profile.freedom > 0.3) {
    goals.push('resist_oppression');
  }
  
  if (profile.creation > 0.3) {
    goals.push('build_infrastructure');
  }
  
  return goals.slice(0, 2);
}

export function getFactionsByArchetype(
  factionAmbitions: FactionAmbition[]
): Record<string, FactionAmbition[]> {
  const byArchetype: Record<string, FactionAmbition[]> = {};
  
  for (const fa of factionAmbitions) {
    const archetype = fa.profile.archetype || 'unknown';
    if (!byArchetype[archetype]) {
      byArchetype[archetype] = [];
    }
    byArchetype[archetype].push(fa);
  }
  
  return byArchetype;
}

export function findPotentialAllies(
  targetFaction: FactionAmbition,
  allFactions: FactionAmbition[]
): FactionAmbition[] {
  return allFactions
    .filter(fa => fa.factionId !== targetFaction.factionId)
    .filter(fa => {
      const compatibility = calculateProfileCompatibility(targetFaction.profile, fa.profile);
      return compatibility > 0.6;
    })
    .sort((a, b) => {
      const compatA = calculateProfileCompatibility(targetFaction.profile, a.profile);
      const compatB = calculateProfileCompatibility(targetFaction.profile, b.profile);
      return compatB - compatA;
    });
}

function calculateProfileCompatibility(profileA: AmbitionProfile, profileB: AmbitionProfile): number {
  const domains = ['power', 'wealth', 'faith', 'virtue', 'freedom', 'creation'] as const;
  let compatibility = 0;
  
  for (const domain of domains) {
    const diff = Math.abs(profileA[domain] - profileB[domain]);
    compatibility += 1 - diff;
  }
  
  return compatibility / domains.length;
}