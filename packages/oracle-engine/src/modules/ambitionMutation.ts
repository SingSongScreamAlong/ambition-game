/**
 * Ambition Mutation System
 * 
 * Handles the evolution of player ambitions based on their actions.
 * Every resolved action shifts ambition weights toward relevant domains,
 * and threshold crossings trigger Dream Reflection events with new goals.
 */

import { AmbitionProfile, AmbitionMutation } from '../types/index.js';
import { ActionProposal } from '../types/index.js';
import { mutateAmbition, checkDreamThresholds } from './ambition.js';

/**
 * Action-to-domain mappings for mutation effects
 */
export interface ActionMutationEffect {
  domainChanges: Partial<Record<keyof Omit<AmbitionProfile, 'modifiers' | 'scale' | 'rawText' | 'generation' | 'mutations'>, number>>;
  modifierChanges?: Partial<Record<keyof AmbitionProfile['modifiers'], number>>;
  reason: string;
}

/**
 * Default mutation effects for different action types
 */
const DEFAULT_MUTATION_EFFECTS: Record<string, ActionMutationEffect> = {
  // Power-related actions
  'conquest': {
    domainChanges: { power: 0.05, virtue: -0.02 },
    modifierChanges: { ruthless: 0.03 },
    reason: 'Conquest strengthens power ambitions but may weaken virtue'
  },
  'military_recruitment': {
    domainChanges: { power: 0.03 },
    modifierChanges: { charismatic: 0.01 },
    reason: 'Building armies reinforces power ambitions'
  },
  'diplomacy': {
    domainChanges: { power: 0.02, virtue: 0.01 },
    modifierChanges: { peaceful: 0.03, charismatic: 0.02 },
    reason: 'Diplomatic success enhances peaceful power approaches'
  },
  'throne_claim': {
    domainChanges: { power: 0.06, virtue: -0.01 },
    reason: 'Claiming authority strengthens power ambitions'
  },
  
  // Wealth-related actions
  'trade_expansion': {
    domainChanges: { wealth: 0.04, creation: 0.01 },
    reason: 'Successful trade increases wealth focus'
  },
  'merchant_dealings': {
    domainChanges: { wealth: 0.03 },
    modifierChanges: { charismatic: 0.01 },
    reason: 'Commerce reinforces wealth ambitions'
  },
  'taxation': {
    domainChanges: { wealth: 0.03, virtue: -0.02 },
    modifierChanges: { ruthless: 0.01 },
    reason: 'Heavy taxation prioritizes wealth over virtue'
  },
  'guild_cooperation': {
    domainChanges: { wealth: 0.02, creation: 0.02 },
    modifierChanges: { peaceful: 0.01 },
    reason: 'Guild alliances strengthen economic focus'
  },
  
  // Faith-related actions
  'temple_construction': {
    domainChanges: { faith: 0.04, creation: 0.02 },
    reason: 'Building temples deepens faith ambitions'
  },
  'religious_ceremony': {
    domainChanges: { faith: 0.03, virtue: 0.01 },
    modifierChanges: { charismatic: 0.01 },
    reason: 'Religious leadership strengthens faith'
  },
  'pilgrimage': {
    domainChanges: { faith: 0.05 },
    modifierChanges: { ascetic: 0.02, peaceful: 0.01 },
    reason: 'Spiritual journey deepens religious devotion'
  },
  'crusade': {
    domainChanges: { faith: 0.04, power: 0.02, virtue: -0.01 },
    modifierChanges: { ruthless: 0.02 },
    reason: 'Holy war merges faith with militant power'
  },
  
  // Virtue-related actions
  'charity': {
    domainChanges: { virtue: 0.04, wealth: -0.01 },
    modifierChanges: { peaceful: 0.02 },
    reason: 'Charitable acts strengthen virtue focus'
  },
  'justice_dispensation': {
    domainChanges: { virtue: 0.05, power: 0.01 },
    reason: 'Delivering justice reinforces moral ambitions'
  },
  'protection_of_innocent': {
    domainChanges: { virtue: 0.04, freedom: 0.01 },
    modifierChanges: { peaceful: 0.01 },
    reason: 'Protecting others enhances virtue and freedom values'
  },
  'moral_reformation': {
    domainChanges: { virtue: 0.06 },
    modifierChanges: { charismatic: 0.02 },
    reason: 'Leading moral change deepens virtue commitment'
  },
  
  // Freedom-related actions
  'rebellion': {
    domainChanges: { freedom: 0.06, power: -0.02 },
    modifierChanges: { ruthless: 0.02 },
    reason: 'Rebellion strengthens freedom ambitions'
  },
  'liberation': {
    domainChanges: { freedom: 0.05, virtue: 0.02 },
    reason: 'Freeing others reinforces liberation goals'
  },
  'resistance_organization': {
    domainChanges: { freedom: 0.04 },
    modifierChanges: { secretive: 0.03, charismatic: 0.01 },
    reason: 'Building resistance networks strengthens freedom focus'
  },
  'escape_tyranny': {
    domainChanges: { freedom: 0.04, power: -0.01 },
    reason: 'Escaping oppression reinforces freedom values'
  },
  
  // Creation-related actions
  'artistic_creation': {
    domainChanges: { creation: 0.05 },
    modifierChanges: { opulent: 0.01 },
    reason: 'Creative works strengthen artistic ambitions'
  },
  'construction_project': {
    domainChanges: { creation: 0.04, wealth: 0.01 },
    reason: 'Building projects enhance creation focus'
  },
  'innovation': {
    domainChanges: { creation: 0.06 },
    reason: 'Innovation reinforces creative ambitions'
  },
  'cultural_patronage': {
    domainChanges: { creation: 0.03, wealth: -0.01 },
    modifierChanges: { opulent: 0.02, charismatic: 0.01 },
    reason: 'Supporting arts strengthens cultural creation'
  },
  
  // Mixed domain actions
  'fortress_building': {
    domainChanges: { power: 0.02, creation: 0.03 },
    reason: 'Fortress construction serves both power and creation'
  },
  'school_establishment': {
    domainChanges: { creation: 0.03, virtue: 0.02 },
    reason: 'Education serves both knowledge and virtue'
  },
  'hospital_founding': {
    domainChanges: { virtue: 0.03, creation: 0.02 },
    modifierChanges: { peaceful: 0.02 },
    reason: 'Healthcare combines virtue with constructive creation'
  }
};

/**
 * Apply mutation effects from an action to an ambition profile
 */
export function applyActionMutation(
  profile: AmbitionProfile,
  action: ActionProposal,
  tick: number,
  customEffects?: ActionMutationEffect
): {
  mutatedProfile: AmbitionProfile,
  dreamThresholds: Array<{domain: string, threshold: number}>
} {
  // Determine mutation effects
  const effects: ActionMutationEffect = customEffects || findMutationEffects(action);
  
  // Apply the mutation
  const mutatedProfile = mutateAmbition(
    profile,
    action.id,
    effects.domainChanges,
    effects.modifierChanges || {},
    tick,
    effects.reason
  );
  
  // Check for dream threshold crossings
  const dreamThresholds = checkDreamThresholds(mutatedProfile);
  
  return {
    mutatedProfile,
    dreamThresholds
  };
}

/**
 * Find appropriate mutation effects for an action
 */
function findMutationEffects(action: ActionProposal): ActionMutationEffect {
  // Direct ID match
  const directEffect = DEFAULT_MUTATION_EFFECTS[action.id];
  if (directEffect) {
    return directEffect;
  }
  
  // Check satisfies array for keywords
  const satisfiesKeywords = action.satisfies || [];
  for (const keyword of satisfiesKeywords) {
    if (DEFAULT_MUTATION_EFFECTS[keyword]) {
      return DEFAULT_MUTATION_EFFECTS[keyword];
    }
  }
  
  // Analyze action description and label for domain keywords
  const textToAnalyze = `${action.label} ${action.description}`.toLowerCase();
  
  // Power keywords
  if (hasKeywords(textToAnalyze, ['conquer', 'dominate', 'rule', 'army', 'military', 'war', 'battle', 'throne', 'authority'])) {
    return {
      domainChanges: { power: 0.03 },
      reason: 'Action involves power and authority'
    };
  }
  
  // Wealth keywords
  if (hasKeywords(textToAnalyze, ['trade', 'merchant', 'gold', 'wealth', 'commerce', 'profit', 'economic'])) {
    return {
      domainChanges: { wealth: 0.03 },
      reason: 'Action involves wealth and commerce'
    };
  }
  
  // Faith keywords
  if (hasKeywords(textToAnalyze, ['temple', 'god', 'divine', 'holy', 'sacred', 'prayer', 'faith', 'religious'])) {
    return {
      domainChanges: { faith: 0.03 },
      reason: 'Action involves faith and spirituality'
    };
  }
  
  // Virtue keywords
  if (hasKeywords(textToAnalyze, ['justice', 'honor', 'virtue', 'protect', 'help', 'charity', 'moral', 'righteous'])) {
    return {
      domainChanges: { virtue: 0.03 },
      reason: 'Action involves virtue and morality'
    };
  }
  
  // Freedom keywords
  if (hasKeywords(textToAnalyze, ['free', 'liberate', 'rebel', 'escape', 'independence', 'resistance', 'overthrow'])) {
    return {
      domainChanges: { freedom: 0.03 },
      reason: 'Action involves freedom and liberation'
    };
  }
  
  // Creation keywords
  if (hasKeywords(textToAnalyze, ['build', 'create', 'craft', 'art', 'construct', 'establish', 'innovation', 'culture'])) {
    return {
      domainChanges: { creation: 0.03 },
      reason: 'Action involves creation and building'
    };
  }
  
  // Default fallback - minimal change
  return {
    domainChanges: { power: 0.01 },
    reason: 'Generic action with minor impact'
  };
}

/**
 * Check if text contains any of the given keywords
 */
function hasKeywords(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Generate Dream Reflection events for threshold crossings
 */
export function generateDreamReflectionEvents(
  crossedThresholds: Array<{domain: string, threshold: number}>,
  profile: AmbitionProfile
): Array<{
  id: string,
  title: string,
  text: string,
  domain: string,
  threshold: number
}> {
  const events = [];
  
  for (const crossed of crossedThresholds) {
    const { domain, threshold } = crossed;
    const event = generateDreamEvent(domain, threshold, profile);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Generate a specific dream event for a domain threshold
 */
function generateDreamEvent(
  domain: string, 
  threshold: number, 
  profile: AmbitionProfile
): {
  id: string,
  title: string,
  text: string,
  domain: string,
  threshold: number
} | null {
  const dreamTemplates: Record<string, Record<number, {title: string, text: string}>> = {
    power: {
      0.4: {
        title: "Dreams of Authority",
        text: "You dream of commanding respect and wielding influence. The vision of subjects bowing before your authority fills your mind. Your ambitions grow stronger."
      },
      0.6: {
        title: "Visions of Dominion",
        text: "In your dreams, you see vast territories under your control, armies marching at your command. The hunger for absolute power burns brighter within you."
      },
      0.8: {
        title: "The Throne Eternal",
        text: "Your dreams show you upon a throne that spans worlds, ruling with unquestioned supremacy. Nothing can satisfy you now but complete dominion."
      }
    },
    wealth: {
      0.4: {
        title: "Golden Visions",
        text: "You dream of overflowing treasuries and bustling markets. The gleam of gold and the sound of coins counting fills your sleeping mind with purpose."
      },
      0.6: {
        title: "Empire of Commerce",
        text: "In your dreams, trade routes span continents under your control. Every transaction, every exchange flows through your influence. Wealth calls to you."
      },
      0.8: {
        title: "Infinite Prosperity",
        text: "Your dreams reveal a world where all wealth flows to you, where your name is synonymous with prosperity itself. Nothing less will suffice."
      }
    },
    faith: {
      0.4: {
        title: "Sacred Calling",
        text: "Divine whispers fill your dreams, showing you temples bathed in holy light. You feel called to serve a higher purpose, to spread faith across the land."
      },
      0.6: {
        title: "Divine Mandate",
        text: "In your dreams, you stand as a chosen vessel of the divine. Holy power flows through you as you lead the faithful toward spiritual transcendence."
      },
      0.8: {
        title: "Unity with the Divine",
        text: "Your dreams blur the line between mortal and divine. You see yourself as the bridge between earth and heaven, the ultimate spiritual authority."
      }
    },
    virtue: {
      0.4: {
        title: "The Righteous Path",
        text: "You dream of bringing justice to the oppressed, of standing as a beacon of moral clarity in a world of shadows. Virtue guides your steps."
      },
      0.6: {
        title: "Paragon of Justice",
        text: "In your dreams, you right every wrong, protect every innocent. The weight of moral responsibility settles upon your shoulders like a sacred mantle."
      },
      0.8: {
        title: "Eternal Righteousness",
        text: "Your dreams show a world perfected by your moral vision, where justice reigns supreme and virtue triumphs over all darkness."
      }
    },
    freedom: {
      0.4: {
        title: "Breaking Chains",
        text: "You dream of shattered shackles and opened cage doors. The cry for liberty echoes in your mind, demanding that all oppression must end."
      },
      0.6: {
        title: "Liberation's Herald",
        text: "In your dreams, you lead a great movement of liberation, freeing the oppressed wherever they may be found. No tyrant can stand against your cause."
      },
      0.8: {
        title: "Universal Freedom",
        text: "Your dreams envision a world where no chains exist, where every soul knows true liberty. You must be the architect of this absolute freedom."
      }
    },
    creation: {
      0.4: {
        title: "Artistic Vision",
        text: "Dreams of beautiful works fill your mind - grand buildings, moving artworks, innovations that will change the world. You must create something lasting."
      },
      0.6: {
        title: "Master of Creation",
        text: "In your dreams, you shape culture itself, inspiring generations with your creations. The world becomes your canvas for artistic expression."
      },
      0.8: {
        title: "Immortal Legacy",
        text: "Your dreams show creations that will outlast empires, art and innovations that will echo through eternity. You must leave an immortal mark upon the world."
      }
    }
  };
  
  const domainTemplates = dreamTemplates[domain];
  if (!domainTemplates) return null;
  
  const template = domainTemplates[threshold];
  if (!template) return null;
  
  return {
    id: `dream_${domain}_${threshold.toString().replace('.', '_')}_${profile.generation}`,
    title: template.title,
    text: template.text,
    domain,
    threshold
  };
}

/**
 * Calculate the total mutation impact of a profile over time
 */
export function calculateMutationImpact(profile: AmbitionProfile): {
  totalMutations: number,
  dominantMutationSource: string | null,
  mutationVelocity: number,
  domainDrift: Record<string, number>
} {
  const mutations = profile.mutations;
  const totalMutations = mutations.length;
  
  if (totalMutations === 0) {
    return {
      totalMutations: 0,
      dominantMutationSource: null,
      mutationVelocity: 0,
      domainDrift: {}
    };
  }
  
  // Find dominant mutation source
  const actionCounts: Record<string, number> = {};
  for (const mutation of mutations) {
    actionCounts[mutation.actionId] = (actionCounts[mutation.actionId] || 0) + 1;
  }
  
  const sortedActions = Object.entries(actionCounts).sort(([,a], [,b]) => b - a);
  const dominantMutationSource = sortedActions.length > 0 ? sortedActions[0]![0] : null;
  
  // Calculate mutation velocity (mutations per tick)
  const recentMutations = mutations.slice(-10); // Last 10 mutations
  const lastMutation = mutations[mutations.length - 1];
  const tenthFromLastMutation = mutations[Math.max(0, mutations.length - 10)];
  const mutationVelocity = recentMutations.length > 0 && lastMutation && tenthFromLastMutation
    ? recentMutations.length / Math.max(1, lastMutation.tick - tenthFromLastMutation.tick)
    : 0;
  
  // Calculate domain drift (cumulative changes)
  const domainDrift: Record<string, number> = {
    power: 0,
    wealth: 0,
    faith: 0,
    virtue: 0,
    freedom: 0,
    creation: 0
  };
  
  for (const mutation of mutations) {
    for (const [domain, change] of Object.entries(mutation.domainChanges)) {
      if (domain in domainDrift && typeof change === 'number' && change !== undefined) {
        const currentValue = domainDrift[domain];
        if (currentValue !== undefined) {
          domainDrift[domain] = currentValue + change;
        }
      }
    }
  }
  
  return {
    totalMutations,
    dominantMutationSource,
    mutationVelocity,
    domainDrift
  };
}

/**
 * Add custom mutation effects for specific action types
 */
export function addCustomMutationEffect(
  actionId: string,
  effect: ActionMutationEffect
): void {
  DEFAULT_MUTATION_EFFECTS[actionId] = effect;
}

/**
 * Get all registered mutation effects
 */
export function getAllMutationEffects(): Record<string, ActionMutationEffect> {
  return { ...DEFAULT_MUTATION_EFFECTS };
}