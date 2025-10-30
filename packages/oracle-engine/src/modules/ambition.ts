/**
 * Dynamic Ambition System (DAS)
 * 
 * Replaces static archetypes with fully dynamic ambition interpretation.
 * Analyzes free-text player ambitions and converts them into domain weights
 * that drive all other game systems.
 */

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

/**
 * Domain keyword patterns for text analysis
 */
const DOMAIN_PATTERNS = {
  power: [
    // Direct power terms
    'rule', 'ruler', 'king', 'queen', 'emperor', 'empress', 'lord', 'lady', 'sovereign',
    'command', 'control', 'dominate', 'conquer', 'authority', 'lead', 'leader', 'leadership',
    'throne', 'crown', 'empire', 'kingdom', 'realm', 'domain', 'territory',
    'subjects', 'followers', 'army', 'military', 'war', 'battle', 'victory',
    'influence', 'power', 'strength', 'might', 'force', 'order',
    // Political terms
    'govern', 'politics', 'political', 'senate', 'council', 'court', 'nobility'
  ],
  
  wealth: [
    // Economic terms
    'wealth', 'wealthy', 'rich', 'riches', 'gold', 'silver', 'treasure', 'money',
    'trade', 'merchant', 'trading', 'commerce', 'business', 'profit', 'prosperity',
    'economic', 'economy', 'market', 'guild', 'craft', 'artisan',
    'luxury', 'opulent', 'expensive', 'valuable', 'precious',
    'resources', 'goods', 'commodities', 'investment', 'fortune'
  ],
  
  faith: [
    // Religious terms
    'god', 'gods', 'divine', 'holy', 'sacred', 'blessed', 'prayer', 'pray',
    'temple', 'church', 'shrine', 'monastery', 'cathedral', 'altar',
    'priest', 'clergy', 'monk', 'nun', 'prophet', 'oracle', 'saint',
    'faith', 'faithful', 'devotion', 'devout', 'pious', 'righteous',
    'salvation', 'redemption', 'soul', 'spirit', 'spiritual', 'religion',
    'worship', 'ritual', 'ceremony', 'crusade', 'pilgrimage'
  ],
  
  virtue: [
    // Moral terms
    'justice', 'just', 'fair', 'honor', 'honorable', 'noble', 'virtue', 'virtuous',
    'good', 'goodness', 'righteousness', 'moral', 'ethical', 'right',
    'compassion', 'compassionate', 'mercy', 'merciful', 'kind', 'kindness',
    'help', 'helping', 'protect', 'protection', 'defender', 'guardian',
    'innocent', 'pure', 'honest', 'truthful', 'integrity', 'loyalty',
    'benevolent', 'charitable', 'generous', 'selfless'
  ],
  
  freedom: [
    // Liberation terms
    'free', 'freedom', 'liberty', 'liberate', 'liberation', 'independence',
    'rebel', 'rebellion', 'revolt', 'revolution', 'resistance', 'escape',
    'chains', 'oppression', 'tyranny', 'tyrant', 'slavery', 'slave',
    'break', 'shatter', 'destroy', 'overthrow', 'uprising', 'fight',
    'rights', 'choice', 'choose', 'will', 'autonomous', 'self-rule'
  ],
  
  creation: [
    // Building/making terms
    'build', 'create', 'make', 'craft', 'forge', 'construct', 'establish',
    'found', 'founding', 'builder', 'creator', 'architect', 'engineer',
    'city', 'cities', 'civilization', 'culture', 'art', 'beauty',
    'knowledge', 'wisdom', 'learn', 'study', 'scholar', 'invention',
    'innovation', 'discovery', 'explore', 'exploration', 'pioneer',
    'legacy', 'monument', 'wonder', 'masterpiece', 'achievement'
  ]
};

const MODIFIER_PATTERNS = {
  peaceful: [
    'peace', 'peaceful', 'diplomat', 'diplomacy', 'negotiate', 'alliance',
    'harmony', 'gentle', 'calm', 'patient', 'understanding', 'cooperation'
  ],
  
  ruthless: [
    'ruthless', 'cruel', 'harsh', 'merciless', 'brutal', 'savage',
    'cunning', 'manipulate', 'deceive', 'betray', 'sacrifice', 'pragmatic'
  ],
  
  ascetic: [
    'simple', 'humble', 'modest', 'ascetic', 'monk', 'minimalist',
    'poverty', 'renounce', 'spiritual', 'meditation', 'discipline'
  ],
  
  opulent: [
    'opulent', 'luxury', 'lavish', 'extravagant', 'grand', 'magnificent',
    'splendor', 'glory', 'display', 'show', 'impressive', 'beautiful'
  ],
  
  secretive: [
    'secret', 'hidden', 'shadow', 'mysterious', 'covert', 'spy',
    'assassin', 'rogue', 'stealth', 'disguise', 'underground', 'conspiracy'
  ],
  
  charismatic: [
    'charismatic', 'inspiring', 'beloved', 'charming', 'persuasive',
    'magnetic', 'popular', 'admired', 'respected', 'influential'
  ]
};

const SCALE_PATTERNS = {
  local: [
    'village', 'town', 'local', 'community', 'neighborhood', 'home',
    'family', 'tribe', 'clan', 'small', 'humble', 'simple'
  ],
  
  regional: [
    'region', 'province', 'duchy', 'county', 'land', 'territory',
    'realm', 'domain', 'several', 'multiple', 'many', 'expand'
  ],
  
  world: [
    'world', 'global', 'universe', 'everywhere', 'all', 'entire',
    'empire', 'continent', 'vast', 'infinite', 'eternal', 'ultimate'
  ]
};

/**
 * Parse free-text ambition into dynamic domain weights
 */
export function parseAmbition(rawText: string): AmbitionProfile {
  const text = rawText.toLowerCase();
  const words = text.split(/\s+/);
  
  // Count domain matches
  const domainCounts: Record<string, number> = {
    power: 0,
    wealth: 0,
    faith: 0,
    virtue: 0,
    freedom: 0,
    creation: 0
  };
  
  // Count modifier matches
  const modifierCounts: Record<string, number> = {
    peaceful: 0,
    ruthless: 0,
    ascetic: 0,
    opulent: 0,
    secretive: 0,
    charismatic: 0
  };
  
  // Count scale matches
  const scaleCounts: Record<string, number> = {
    local: 0,
    regional: 0,
    world: 0
  };
  
  // Analyze each word and phrase
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    
    const phrase2 = i < words.length - 1 && words[i + 1] ? `${word} ${words[i + 1]}` : word;
    const phrase3 = i < words.length - 2 && words[i + 1] && words[i + 2] ? `${word} ${words[i + 1]} ${words[i + 2]}` : phrase2;
    
    // Check domains
    for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      for (const pattern of patterns) {
        if (word.includes(pattern) || phrase2.includes(pattern) || phrase3.includes(pattern)) {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
      }
    }
    
    // Check modifiers
    for (const [modifier, patterns] of Object.entries(MODIFIER_PATTERNS)) {
      for (const pattern of patterns) {
        if (word.includes(pattern) || phrase2.includes(pattern) || phrase3.includes(pattern)) {
          modifierCounts[modifier] = (modifierCounts[modifier] || 0) + 1;
        }
      }
    }
    
    // Check scale
    for (const [scale, patterns] of Object.entries(SCALE_PATTERNS)) {
      for (const pattern of patterns) {
        if (word.includes(pattern) || phrase2.includes(pattern) || phrase3.includes(pattern)) {
          scaleCounts[scale] = (scaleCounts[scale] || 0) + 1;
        }
      }
    }
  }
  
  // Normalize domain weights (must sum to 1.0)
  const totalDomainCount = Object.values(domainCounts).reduce((sum, count) => sum + count, 0);
  const domains: Record<string, number> = {};
  
  if (totalDomainCount > 0) {
    for (const [domain, count] of Object.entries(domainCounts)) {
      domains[domain] = count / totalDomainCount;
    }
  } else {
    // Default fallback - balanced ambition
    domains.power = 0.25;
    domains.wealth = 0.15;
    domains.faith = 0.15;
    domains.virtue = 0.25;
    domains.freedom = 0.10;
    domains.creation = 0.10;
  }
  
  // Normalize modifiers (0.0 to 1.0, independent)
  const maxModifierCount = Math.max(...Object.values(modifierCounts), 1);
  const modifiers: Record<string, number> = {};
  for (const [modifier, count] of Object.entries(modifierCounts)) {
    modifiers[modifier] = Math.min(count / maxModifierCount, 1.0);
  }
  
  // Normalize scale (must sum to 1.0)
  const totalScaleCount = Object.values(scaleCounts).reduce((sum, count) => sum + count, 0);
  const scale: Record<string, number> = {};
  
  if (totalScaleCount > 0) {
    for (const [scaleType, count] of Object.entries(scaleCounts)) {
      scale[scaleType] = count / totalScaleCount;
    }
  } else {
    // Default to regional scale
    scale.local = 0.2;
    scale.regional = 0.6;
    scale.world = 0.2;
  }
  
  return {
    power: domains.power || 0,
    wealth: domains.wealth || 0,
    faith: domains.faith || 0,
    virtue: domains.virtue || 0,
    freedom: domains.freedom || 0,
    creation: domains.creation || 0,
    modifiers: {
      peaceful: modifiers.peaceful || 0,
      ruthless: modifiers.ruthless || 0,
      ascetic: modifiers.ascetic || 0,
      opulent: modifiers.opulent || 0,
      secretive: modifiers.secretive || 0,
      charismatic: modifiers.charismatic || 0
    },
    scale: {
      local: scale.local || 0,
      regional: scale.regional || 0,
      world: scale.world || 0
    },
    rawText,
    generation: 0,
    mutations: []
  };
}

/**
 * Apply an ambition mutation from an action
 */
export function mutateAmbition(
  profile: AmbitionProfile, 
  actionId: string, 
  domainChanges: Partial<Record<keyof Omit<AmbitionProfile, 'modifiers' | 'scale' | 'rawText' | 'generation' | 'mutations'>, number>>,
  modifierChanges: Partial<Record<keyof AmbitionProfile['modifiers'], number>> = {},
  tick: number,
  reason: string
): AmbitionProfile {
  // Create mutation record
  const mutation: AmbitionMutation = {
    tick,
    actionId,
    domainChanges,
    modifierChanges,
    reason
  };
  
  // Apply domain changes
  const newDomains = {
    power: profile.power,
    wealth: profile.wealth,
    faith: profile.faith,
    virtue: profile.virtue,
    freedom: profile.freedom,
    creation: profile.creation
  };
  
  for (const [domain, change] of Object.entries(domainChanges)) {
    if (change !== undefined && domain in newDomains) {
      newDomains[domain as keyof typeof newDomains] += change;
    }
  }
  
  // Normalize domains to sum to 1.0
  const domainSum = Object.values(newDomains).reduce((sum, val) => sum + val, 0);
  if (domainSum > 0) {
    for (const domain of Object.keys(newDomains) as Array<keyof typeof newDomains>) {
      newDomains[domain] = Math.max(0, newDomains[domain] / domainSum);
    }
  }
  
  // Apply modifier changes
  const newModifiers = { ...profile.modifiers };
  for (const [modifier, change] of Object.entries(modifierChanges)) {
    if (change !== undefined && modifier in newModifiers) {
      newModifiers[modifier as keyof typeof newModifiers] = Math.max(0, Math.min(1, 
        newModifiers[modifier as keyof typeof newModifiers] + change
      ));
    }
  }
  
  return {
    ...newDomains,
    modifiers: newModifiers,
    scale: profile.scale,
    rawText: profile.rawText,
    generation: profile.generation + 1,
    mutations: [...profile.mutations, mutation]
  };
}

/**
 * Get the dominant domain(s) for world generation biasing
 */
export function getDominantDomains(profile: AmbitionProfile, threshold: number = 0.2): string[] {
  const domains = [
    { name: 'power', value: profile.power },
    { name: 'wealth', value: profile.wealth },
    { name: 'faith', value: profile.faith },
    { name: 'virtue', value: profile.virtue },
    { name: 'freedom', value: profile.freedom },
    { name: 'creation', value: profile.creation }
  ];
  
  return domains
    .filter(d => d.value >= threshold)
    .sort((a, b) => b.value - a.value)
    .map(d => d.name);
}

/**
 * Check if any domain has crossed a threshold for dream reflection events
 */
export function checkDreamThresholds(profile: AmbitionProfile, thresholds: number[] = [0.4, 0.6, 0.8]): Array<{domain: string, threshold: number}> {
  const crossedThresholds: Array<{domain: string, threshold: number}> = [];
  
  const domains = {
    power: profile.power,
    wealth: profile.wealth,
    faith: profile.faith,
    virtue: profile.virtue,
    freedom: profile.freedom,
    creation: profile.creation
  };
  
  for (const [domain, value] of Object.entries(domains)) {
    for (const threshold of thresholds) {
      if (value >= threshold) {
        // Check if this is a new threshold crossing
        const lastMutation = profile.mutations[profile.mutations.length - 1];
        const previousValue = profile.mutations.length > 0 && lastMutation
          ? value - (lastMutation.domainChanges[domain as keyof typeof domains] || 0)
          : 0;
          
        if (previousValue < threshold) {
          crossedThresholds.push({ domain, threshold });
        }
      }
    }
  }
  
  return crossedThresholds;
}

/**
 * Generate a textual summary of the current ambition profile
 */
export function summarizeAmbition(profile: AmbitionProfile): string {
  const dominant = getDominantDomains(profile, 0.15);
  const strongModifiers = Object.entries(profile.modifiers)
    .filter(([_, value]) => value > 0.3)
    .map(([mod, _]) => mod);
  
  const scaleType = profile.scale.world > 0.5 ? 'global' : 
                   profile.scale.regional > 0.5 ? 'regional' : 'local';
  
  let summary = `A ${scaleType} ambition focused on ${dominant.join(', ')}`;
  
  if (strongModifiers.length > 0) {
    summary += ` with ${strongModifiers.join(', ')} tendencies`;
  }
  
  if (profile.generation > 0) {
    summary += ` (evolved ${profile.generation} times)`;
  }
  
  return summary;
}