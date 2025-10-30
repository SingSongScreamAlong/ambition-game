import { AmbitionInput, AmbitionCanonical } from '../types/index.js';

// Keyword lattices for different aspects
const ARCHETYPES = {
  king: ['king', 'ruler', 'monarch', 'sovereign', 'emperor', 'throne', 'crown', 'reign'],
  warrior: ['warrior', 'fighter', 'soldier', 'champion', 'knight', 'battle', 'combat', 'war'],
  merchant: ['merchant', 'trader', 'rich', 'wealthy', 'gold', 'commerce', 'business'],
  scholar: ['scholar', 'wise', 'learned', 'knowledge', 'study', 'research', 'magic'],
  priest: ['priest', 'holy', 'divine', 'god', 'faith', 'blessed', 'religious'],
  rogue: ['rogue', 'thief', 'stealth', 'shadow', 'cunning', 'spy', 'assassin'],
};

const VIRTUES = {
  honor: ['honor', 'honorable', 'noble', 'integrity', 'righteous'],
  courage: ['brave', 'courage', 'fearless', 'bold', 'daring'],
  wisdom: ['wise', 'wisdom', 'intelligent', 'clever', 'smart'],
  compassion: ['kind', 'compassionate', 'merciful', 'caring', 'gentle'],
  justice: ['just', 'fair', 'righteous', 'law', 'order'],
  loyalty: ['loyal', 'faithful', 'devoted', 'trustworthy'],
};

const VICES = {
  pride: ['proud', 'arrogant', 'vain', 'hubris', 'superior'],
  greed: ['greedy', 'selfish', 'avaricious', 'money', 'wealth'],
  wrath: ['angry', 'wrathful', 'furious', 'rage', 'vengeful'],
  envy: ['envious', 'jealous', 'covetous', 'resentful'],
  sloth: ['lazy', 'idle', 'sluggish', 'complacent'],
  treachery: ['treacherous', 'deceitful', 'dishonest', 'betrayer'],
};

/**
 * Parse free-text ambition into canonical form using keyword matching
 */
export function parse(input: AmbitionInput): AmbitionCanonical {
  const text = input.raw.toLowerCase();
  const words = text.split(/\s+/);
  
  const archetypes: string[] = [];
  const virtues: string[] = [];
  const vices: string[] = [];
  const weights: Record<string, number> = {};

  // Match archetypes
  for (const [archetype, keywords] of Object.entries(ARCHETYPES)) {
    const matches = keywords.filter(keyword => 
      words.some(word => word.includes(keyword) || keyword.includes(word))
    );
    if (matches.length > 0) {
      archetypes.push(archetype);
      weights[archetype] = matches.length;
    }
  }

  // Match virtues
  for (const [virtue, keywords] of Object.entries(VIRTUES)) {
    const matches = keywords.filter(keyword => 
      words.some(word => word.includes(keyword) || keyword.includes(word))
    );
    if (matches.length > 0) {
      virtues.push(virtue);
      weights[virtue] = matches.length;
    }
  }

  // Match vices
  for (const [vice, keywords] of Object.entries(VICES)) {
    const matches = keywords.filter(keyword => 
      words.some(word => word.includes(keyword) || keyword.includes(word))
    );
    if (matches.length > 0) {
      vices.push(vice);
      weights[vice] = matches.length;
    }
  }

  // Default fallback if no matches
  if (archetypes.length === 0) {
    archetypes.push('king'); // Default archetype
    weights.king = 1;
  }

  // Normalize weights to sum to 1
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight > 0) {
    for (const key in weights) {
      const currentWeight = weights[key];
      if (currentWeight !== undefined) {
        weights[key] = currentWeight / totalWeight;
      }
    }
  }

  return {
    archetypes,
    virtues,
    vices,
    weights,
  };
}