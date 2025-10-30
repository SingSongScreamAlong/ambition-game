import { AmbitionCanonical, AmbitionProfile, WorldState, Region, Faction, Resources, People, Forces, Legitimacy } from '../types/index.js';

// Simple PRNG using seed
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    const selected = array[index];
    if (selected === undefined) {
      throw new Error('Selected element is undefined');
    }
    return selected;
  }
}

const REGION_NAMES_BY_DOMAIN = {
  power: ['Ironhold', 'Dragonspear', 'Crownmarch', 'Thornwall', 'Stormkeep'],
  wealth: ['Goldmeadow', 'Silverbrook', 'Merchant Rest', 'Coinspring', 'Tradehaven'],
  faith: ['Holmdale', 'Blessed Vale', 'Pilgrim End', 'Sancthaven', 'Moonshire'],
  virtue: ['Brightlands', 'Justice Keep', 'Fairdale', 'Honorhold', 'Trueheart'],
  freedom: ['Wildmarsh', 'Roamer Rest', 'Freehaven', 'Wanderlands', 'Libermoor'],
  creation: ['Craftshall', 'Artisan Vale', 'Buildhaven', 'Forgeworks', 'Makersmark']
};

const FACTION_NAMES_BY_DOMAIN = {
  power: ['House Drakmoor', 'The Iron Brotherhood', 'Order of the Crimson Crown', 'The Steel Legion', 'Lords of the Black Tower'],
  wealth: ['Merchant Guild of Vaelthorne', 'The Golden Consortium', 'House Coinwright', 'Traders of the Silver Road', 'The Prosperity League'],
  faith: ['Order of the Silver Phoenix', 'Circle of Ancient Stones', 'The Sacred Assembly', 'Guardians of the Light', 'The Divine Covenant'],
  virtue: ['Knights of the Golden Lion', 'The Just Order', 'Defenders of the Innocent', 'The Righteous Company', 'Order of Pure Hearts'],
  freedom: ['Shadowbane Society', 'The Free Companies', 'Brotherhood of the Open Road', 'The Liberation Front', 'Wanderers of the Wild'],
  creation: ['The Scholars of Aethermoor', 'Master Artisans Guild', 'The Builders Alliance', 'Order of the Forge', 'Society of Makers']
};

const NEUTRAL_REGION_NAMES = [
  'Aldermore', 'Blackstone', 'Crescent Vale', 'Emberfall', 'Frosthold',
  'Ravenwatch', 'Windcrest', 'Shadowmere', 'Greenvale', 'Mistwood'
];

const NEUTRAL_FACTION_NAMES = [
  'The Old Guard', 'House Greymantle', 'The Border Watch', 'Company of the Rose',
  'The Neutral Council', 'House Middleton', 'The Grey Alliance', 'Independent Lords'
];

/**
 * Generate initial world state based on ambition profile and seed
 */
export function seed(ambition: AmbitionCanonical | AmbitionProfile, seedValue: number): WorldState {
  const rng = new SeededRandom(seedValue);
  
  // Extract domain weights - handle both legacy and new types
  let domainWeights: Record<string, number>;
  if ('power' in ambition) {
    // New AmbitionProfile
    domainWeights = {
      power: ambition.power,
      wealth: ambition.wealth, 
      faith: ambition.faith,
      virtue: ambition.virtue,
      freedom: ambition.freedom,
      creation: ambition.creation
    };
  } else {
    // Legacy AmbitionCanonical - convert to basic weights
    domainWeights = {
      power: 0.25,
      wealth: 0.15,
      faith: 0.15,
      virtue: 0.25,
      freedom: 0.10,
      creation: 0.10
    };
  }

  // Generate 6-10 regions with domain bias
  const numRegions = rng.nextInt(6, 10);
  const regions: Region[] = [];
  
  for (let i = 0; i < numRegions; i++) {
    const region = generateDomainBiasedRegion(i, domainWeights, rng);
    regions.push(region);
  }

  // Generate 4-6 factions with domain bias
  const numFactions = rng.nextInt(4, 6);
  const factions: Faction[] = [];
  for (let i = 0; i < numFactions; i++) {
    const faction = generateDomainBiasedFaction(i, domainWeights, rng);
    factions.push(faction);
  }

  // Assign non-player regions to factions based on domain compatibility
  assignRegionsToFactions(regions, factions, rng);

  // Generate starting resources based on domain bias
  const startingResources = generateDomainBiasedResources(domainWeights, rng);
  
  // Generate starting forces based on domain bias
  const startingForces = generateDomainBiasedForces(domainWeights, rng);
  
  // Generate starting people stats based on domain bias
  const startingPeople = generateDomainBiasedPeople(domainWeights, rng);

  // Generate starting legitimacy based on domain bias
  const startingLegitimacy = generateDomainBiasedLegitimacy(domainWeights, rng);

  // Generate traits based on domain focus
  const traits = generateDomainTraits(domainWeights);

  return {
    seed: seedValue,
    regions,
    factions,
    resources: startingResources,
    people: startingPeople,
    forces: startingForces,
    legitimacy: startingLegitimacy,
    traits,
    tick: 0,
    playerId: generatePlayerId(rng),
  };
}

/**
 * Generate a domain-biased region
 */
function generateDomainBiasedRegion(index: number, domainWeights: Record<string, number>, rng: SeededRandom): Region {
  // Determine if this region should be domain-specialized
  const isDomainSpecialized = rng.next() < 0.4; // 40% chance of specialization
  
  let regionName: string;
  let domainAffinities: Record<'power' | 'wealth' | 'faith' | 'virtue' | 'freedom' | 'creation', number>;
  
  if (isDomainSpecialized && index > 0) { // Player's region (index 0) is always balanced
    // Pick dominant domain based on player ambition weights
    const domains = Object.keys(domainWeights) as Array<keyof typeof domainWeights>;
    const weightedDomains = domains.filter(d => (domainWeights[d] || 0) > 0.15);
    const chosenDomain = weightedDomains.length > 0 ? rng.choice(weightedDomains) : rng.choice(domains);
    if (!chosenDomain) return generateDomainBiasedRegion(index, domainWeights, rng);
    
    regionName = rng.choice(REGION_NAMES_BY_DOMAIN[chosenDomain as keyof typeof REGION_NAMES_BY_DOMAIN]);
    
    // High affinity for chosen domain, low for others
    domainAffinities = {
      power: chosenDomain === 'power' ? 0.7 + rng.next() * 0.3 : rng.next() * 0.2,
      wealth: chosenDomain === 'wealth' ? 0.7 + rng.next() * 0.3 : rng.next() * 0.2,
      faith: chosenDomain === 'faith' ? 0.7 + rng.next() * 0.3 : rng.next() * 0.2,
      virtue: chosenDomain === 'virtue' ? 0.7 + rng.next() * 0.3 : rng.next() * 0.2,
      freedom: chosenDomain === 'freedom' ? 0.7 + rng.next() * 0.3 : rng.next() * 0.2,
      creation: chosenDomain === 'creation' ? 0.7 + rng.next() * 0.3 : rng.next() * 0.2
    };
  } else {
    // Neutral region
    regionName = rng.choice(NEUTRAL_REGION_NAMES);
    domainAffinities = {
      power: 0.3 + rng.next() * 0.4,
      wealth: 0.3 + rng.next() * 0.4,
      faith: 0.3 + rng.next() * 0.4,
      virtue: 0.3 + rng.next() * 0.4,
      freedom: 0.3 + rng.next() * 0.4,
      creation: 0.3 + rng.next() * 0.4
    };
  }
  
  // Generate base stats
  const baseStats = generateRegionBaseStats(domainAffinities, rng);
  
  return {
    id: `region_${index}`,
    name: regionName,
    controlled: index === 0, // Player starts with first region
    resources: generateDomainBiasedRegionResources(domainAffinities, rng),
    people: generateRegionPeople(rng),
    security: baseStats.security,
    lawfulness: baseStats.lawfulness,
    unrest: baseStats.unrest,
    piety: baseStats.piety,
    heresy: baseStats.heresy,
    domainAffinities
  };
}

/**
 * Generate region base stats influenced by domain affinities
 */
function generateRegionBaseStats(domainAffinities: Record<string, number>, rng: SeededRandom) {
  const powerAffinity = domainAffinities.power || 0.5;
  const virtueAffinity = domainAffinities.virtue || 0.5;
  const faithAffinity = domainAffinities.faith || 0.5;
  const freedomAffinity = domainAffinities.freedom || 0.5;
  
  return {
    security: Math.min(100, 40 + powerAffinity * 40 + rng.next() * 20), // Higher with power
    lawfulness: Math.min(100, 50 + virtueAffinity * 30 + powerAffinity * 10 + rng.next() * 10), // Higher with virtue/power
    unrest: Math.max(0, 30 - virtueAffinity * 20 + freedomAffinity * 15 + rng.next() * 20 - 10), // Lower with virtue, higher with freedom
    piety: Math.min(100, 40 + faithAffinity * 40 + rng.next() * 20), // Higher with faith
    heresy: Math.max(0, 25 - faithAffinity * 15 + freedomAffinity * 10 + rng.next() * 15 - 7) // Lower with faith, higher with freedom
  };
}

/**
 * Generate domain-biased region resources
 */
function generateDomainBiasedRegionResources(domainAffinities: Record<string, number>, rng: SeededRandom): Partial<Resources> {
  const wealthAffinity = domainAffinities.wealth || 0.5;
  const creationAffinity = domainAffinities.creation || 0.5;
  
  return {
    gold: Math.floor(rng.nextInt(10, 50) * (1 + wealthAffinity * 0.5)),
    grain: rng.nextInt(20, 80),
    iron: Math.floor(rng.nextInt(5, 30) * (1 + creationAffinity * 0.5)),
    stone: Math.floor(rng.nextInt(5, 30) * (1 + creationAffinity * 0.5)),
    wood: Math.floor(rng.nextInt(10, 40) * (1 + creationAffinity * 0.3))
  };
}

/**
 * Generate a domain-biased faction
 */
function generateDomainBiasedFaction(index: number, domainWeights: Record<string, number>, rng: SeededRandom): Faction {
  // Determine faction domain specialization
  const domains = Object.keys(domainWeights) as Array<keyof typeof domainWeights>;
  const weightedDomains = domains.filter(d => (domainWeights[d] || 0) > 0.15);
  
  let factionName: string;
  let domainAffinities: Record<'power' | 'wealth' | 'faith' | 'virtue' | 'freedom' | 'creation', number>;
  
  if (weightedDomains.length > 0 && rng.next() < 0.6) { // 60% chance of domain alignment
    const chosenDomain = rng.choice(weightedDomains);
    if (!chosenDomain) return generateDomainBiasedFaction(index, domainWeights, rng);
    factionName = rng.choice(FACTION_NAMES_BY_DOMAIN[chosenDomain as keyof typeof FACTION_NAMES_BY_DOMAIN]);
    
    // High affinity for chosen domain
    domainAffinities = {
      power: chosenDomain === 'power' ? 0.8 + rng.next() * 0.2 : 0.1 + rng.next() * 0.3,
      wealth: chosenDomain === 'wealth' ? 0.8 + rng.next() * 0.2 : 0.1 + rng.next() * 0.3,
      faith: chosenDomain === 'faith' ? 0.8 + rng.next() * 0.2 : 0.1 + rng.next() * 0.3,
      virtue: chosenDomain === 'virtue' ? 0.8 + rng.next() * 0.2 : 0.1 + rng.next() * 0.3,
      freedom: chosenDomain === 'freedom' ? 0.8 + rng.next() * 0.2 : 0.1 + rng.next() * 0.3,
      creation: chosenDomain === 'creation' ? 0.8 + rng.next() * 0.2 : 0.1 + rng.next() * 0.3
    };
  } else {
    // Neutral faction
    factionName = rng.choice(NEUTRAL_FACTION_NAMES);
    domainAffinities = {
      power: 0.3 + rng.next() * 0.4,
      wealth: 0.3 + rng.next() * 0.4,
      faith: 0.3 + rng.next() * 0.4,
      virtue: 0.3 + rng.next() * 0.4,
      freedom: 0.3 + rng.next() * 0.4,
      creation: 0.3 + rng.next() * 0.4
    };
  }
  
  return {
    id: `faction_${index}`,
    name: factionName,
    stance: rng.choice(['allied', 'neutral', 'hostile'] as const),
    power: rng.nextInt(20, 100),
    regions: [],
    domainAffinities
  };
}

/**
 * Assign regions to factions based on domain compatibility
 */
function assignRegionsToFactions(regions: Region[], factions: Faction[], rng: SeededRandom): void {
  // Skip player's region (index 0)
  for (let i = 1; i < regions.length; i++) {
    const region = regions[i];
    if (!region) continue;
    
    // Find best faction match based on domain compatibility
    let bestFaction = factions[0];
    let bestCompatibility = 0;
    
    for (const faction of factions) {
      const compatibility = calculateDomainCompatibility(region.domainAffinities, faction.domainAffinities);
      if (compatibility > bestCompatibility) {
        bestCompatibility = compatibility;
        bestFaction = faction;
      }
    }
    
    // Add some randomness - 70% chance of best match, 30% random
    const chosenFaction = rng.next() < 0.7 ? bestFaction : rng.choice(factions);
    if (chosenFaction) {
      chosenFaction.regions.push(region.id);
    }
  }
}

/**
 * Calculate domain compatibility between two entities
 */
function calculateDomainCompatibility(affinities1: Record<string, number>, affinities2: Record<string, number>): number {
  let compatibility = 0;
  const domains = ['power', 'wealth', 'faith', 'virtue', 'freedom', 'creation'];
  
  for (const domain of domains) {
    const diff = Math.abs((affinities1[domain] || 0) - (affinities2[domain] || 0));
    compatibility += 1 - diff; // Closer values = higher compatibility
  }
  
  return compatibility / domains.length;
}

/**
 * Generate domain-biased starting resources
 */
function generateDomainBiasedResources(domainWeights: Record<string, number>, rng: SeededRandom): Resources {
  const wealthMultiplier = 1 + (domainWeights.wealth || 0) * 0.5;
  const creationMultiplier = 1 + (domainWeights.creation || 0) * 0.3;
  
  return {
    gold: Math.floor(rng.nextInt(80, 150) * wealthMultiplier),
    grain: rng.nextInt(100, 200),
    iron: Math.floor(rng.nextInt(20, 60) * creationMultiplier),
    stone: Math.floor(rng.nextInt(20, 60) * creationMultiplier),
    wood: Math.floor(rng.nextInt(40, 100) * creationMultiplier)
  };
}

/**
 * Generate domain-biased starting forces
 */
function generateDomainBiasedForces(domainWeights: Record<string, number>, rng: SeededRandom): Forces {
  const powerMultiplier = 1 + (domainWeights.power || 0) * 0.4;
  
  return {
    units: Math.floor(rng.nextInt(15, 35) * powerMultiplier),
    morale: Math.min(100, rng.nextInt(60, 85) + (domainWeights.virtue || 0) * 15),
    supply: rng.nextInt(60, 90)
  };
}

/**
 * Generate domain-biased starting people stats
 */
function generateDomainBiasedPeople(domainWeights: Record<string, number>, rng: SeededRandom): People {
  return {
    population: rng.nextInt(800, 1200),
    loyalty: Math.min(100, rng.nextInt(50, 75) + (domainWeights.virtue || 0) * 20),
    unrest: Math.max(0, rng.nextInt(15, 35) - (domainWeights.virtue || 0) * 15),
    faith: Math.min(100, rng.nextInt(40, 70) + (domainWeights.faith || 0) * 25)
  };
}

/**
 * Generate domain-biased starting legitimacy
 */
function generateDomainBiasedLegitimacy(domainWeights: Record<string, number>, rng: SeededRandom): Legitimacy {
  return {
    law: Math.min(100, rng.nextInt(40, 70) + (domainWeights.virtue || 0) * 20 + (domainWeights.power || 0) * 10),
    faith: Math.min(100, rng.nextInt(30, 60) + (domainWeights.faith || 0) * 30),
    lineage: rng.nextInt(20, 80),
    might: Math.min(100, rng.nextInt(30, 60) + (domainWeights.power || 0) * 25)
  };
}

/**
 * Generate traits based on dominant domains
 */
function generateDomainTraits(domainWeights: Record<string, number>): string[] {
  const traits: string[] = [];
  const threshold = 0.2; // Only add traits for domains above this threshold
  
  if ((domainWeights.power || 0) > threshold) traits.push('ambitious', 'commanding');
  if ((domainWeights.wealth || 0) > threshold) traits.push('shrewd', 'prosperous');
  if ((domainWeights.faith || 0) > threshold) traits.push('devout', 'blessed');
  if ((domainWeights.virtue || 0) > threshold) traits.push('just', 'honorable');
  if ((domainWeights.freedom || 0) > threshold) traits.push('independent', 'rebellious');
  if ((domainWeights.creation || 0) > threshold) traits.push('creative', 'innovative');
  
  return traits.slice(0, 4); // Limit to 4 traits maximum
}

function generateRegionResources(rng: SeededRandom): Partial<Resources> {
  return {
    gold: rng.nextInt(0, 50),
    grain: rng.nextInt(10, 100),
    iron: rng.nextInt(0, 30),
    stone: rng.nextInt(5, 40),
    wood: rng.nextInt(10, 60),
  };
}

function generateRegionPeople(rng: SeededRandom): People {
  return {
    population: rng.nextInt(1000, 10000),
    loyalty: rng.next() * 0.8 + 0.2, // 0.2 to 1.0
    unrest: rng.next() * 0.3, // 0 to 0.3
    faith: rng.next() * 0.8 + 0.2, // 0.2 to 1.0
  };
}

function generateStartingResources(ambition: AmbitionCanonical, rng: SeededRandom): Resources {
  const base: Resources = {
    gold: 100,
    grain: 50,
    iron: 20,
    stone: 30,
    wood: 40,
  };

  // Modify based on archetype
  if (ambition.archetypes.includes('merchant')) {
    base.gold *= 2;
  }
  
  if (ambition.archetypes.includes('warrior')) {
    base.iron *= 2;
  }
  
  if (ambition.archetypes.includes('king')) {
    base.gold *= 1.5;
    base.grain *= 1.5;
  }

  // Add some randomness
  Object.keys(base).forEach(key => {
    const k = key as keyof Resources;
    base[k] = Math.floor(base[k] * (0.8 + rng.next() * 0.4)); // ±20% variation
  });

  return base;
}

function generateStartingForces(ambition: AmbitionCanonical, rng: SeededRandom): Forces {
  let baseUnits = 50;
  
  if (ambition.archetypes.includes('warrior')) {
    baseUnits *= 2;
  }
  
  if (ambition.archetypes.includes('king')) {
    baseUnits *= 1.5;
  }

  return {
    units: Math.floor(baseUnits * (0.8 + rng.next() * 0.4)),
    morale: 0.6 + rng.next() * 0.3, // 0.6 to 0.9
    supply: 0.8 + rng.next() * 0.2, // 0.8 to 1.0
  };
}

function generateStartingPeople(ambition: AmbitionCanonical, rng: SeededRandom): People {
  let baseLoyalty = 0.5;
  
  if (ambition.virtues.includes('compassion')) {
    baseLoyalty += 0.2;
  }
  
  if (ambition.virtues.includes('justice')) {
    baseLoyalty += 0.1;
  }
  
  if (ambition.vices.includes('pride')) {
    baseLoyalty -= 0.1;
  }

  return {
    population: 5000 + rng.nextInt(-1000, 2000),
    loyalty: Math.max(0.2, Math.min(1.0, baseLoyalty + (rng.next() - 0.5) * 0.2)),
    unrest: rng.next() * 0.2,
    faith: 0.6 + rng.next() * 0.3,
  };
}

function generateStartingLegitimacy(ambition: AmbitionCanonical, rng: SeededRandom): Legitimacy {
  // Base legitimacy levels - everyone starts low
  let baseLaw = 15;
  let baseFaith = 15;
  let baseLineage = 15;
  let baseMight = 15;

  // Modify based on archetype
  if (ambition.archetypes.includes('king')) {
    baseLaw += 10;
    baseLineage += 10;
  }
  
  if (ambition.archetypes.includes('priest')) {
    baseFaith += 20;
  }
  
  if (ambition.archetypes.includes('warrior')) {
    baseMight += 15;
  }
  
  if (ambition.archetypes.includes('scholar')) {
    baseLaw += 5; // Knowledge of legal systems
  }

  // Modify based on virtues
  if (ambition.virtues.includes('justice')) {
    baseLaw += 10;
  }
  
  if (ambition.virtues.includes('honor')) {
    baseLineage += 8;
    baseMight += 5;
  }
  
  if (ambition.virtues.includes('wisdom')) {
    baseLaw += 5;
    baseFaith += 5;
  }

  // Modify based on vices
  if (ambition.vices.includes('pride')) {
    baseLineage += 5; // Pride in bloodline
    baseLaw -= 3; // Disregard for law
  }
  
  if (ambition.vices.includes('wrath')) {
    baseMight += 8;
    baseLaw -= 5;
  }

  // Add randomness and clamp to 0-100
  return {
    law: Math.max(0, Math.min(100, baseLaw + rng.nextInt(-5, 10))),
    faith: Math.max(0, Math.min(100, baseFaith + rng.nextInt(-5, 10))),
    lineage: Math.max(0, Math.min(100, baseLineage + rng.nextInt(-5, 10))),
    might: Math.max(0, Math.min(100, baseMight + rng.nextInt(-5, 10))),
  };
}

function generateRegionalLawfulness(rng: SeededRandom): number {
  // Default: lawfulness 60 ± 10
  const base = 60;
  const variation = rng.nextInt(-10, 10);
  return Math.max(0, Math.min(100, base + variation));
}

function generateRegionalUnrest(rng: SeededRandom): number {
  // Default: unrest 25 ± 10  
  const base = 25;
  const variation = rng.nextInt(-10, 10);
  return Math.max(0, Math.min(100, base + variation));
}

function generateRegionalPiety(rng: SeededRandom): number {
  // Default: piety 55 ± 10
  const base = 55;
  const variation = rng.nextInt(-10, 10);
  return Math.max(0, Math.min(100, base + variation));
}

function generateRegionalHeresy(rng: SeededRandom): number {
  // Default: heresy 20 ± 8
  const base = 20;
  const variation = rng.nextInt(-8, 8);
  return Math.max(0, Math.min(100, base + variation));
}

function generatePlayerId(rng: SeededRandom): string {
  // Generate deterministic player ID using seeded random
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'player_';
  for (let i = 0; i < 9; i++) {
    result += chars[Math.floor(rng.next() * chars.length)];
  }
  return result;
}