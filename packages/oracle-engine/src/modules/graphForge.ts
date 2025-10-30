import { AmbitionCanonical, RequirementGraph, GraphNode } from '../types/index.js';

// Template requirement graphs for different archetypes
const ARCHETYPE_TEMPLATES = {
  king: {
    nodes: [
      { id: 'land', label: 'Control Territory', status: 'unmet' as const, paths: ['conquest', 'purchase', 'grant', 'marriage'] },
      { id: 'people', label: 'Win the People', status: 'unmet' as const, needs: ['land'], paths: ['charity', 'justice', 'protection'] },
      { id: 'army', label: 'Raise an Army', status: 'unmet' as const, paths: ['recruitment', 'mercenaries', 'conscription'] },
      { id: 'treasury', label: 'Fill the Treasury', status: 'unmet' as const, paths: ['taxation', 'trade', 'conquest'] },
      { id: 'legitimacy', label: 'Gain Legitimacy', status: 'unmet' as const, needs: ['people', 'army'], paths: ['bloodline', 'divine_right', 'election', 'conquest'] },
    ],
  },
  warrior: {
    nodes: [
      { id: 'strength', label: 'Personal Strength', status: 'unmet' as const, paths: ['training', 'magic', 'equipment'] },
      { id: 'reputation', label: 'Warrior Reputation', status: 'unmet' as const, needs: ['strength'], paths: ['duels', 'tournaments', 'battles'] },
      { id: 'followers', label: 'Loyal Followers', status: 'unmet' as const, needs: ['reputation'], paths: ['brotherhood', 'victory', 'charisma'] },
      { id: 'weapons', label: 'Legendary Weapons', status: 'unmet' as const, paths: ['forge', 'quest', 'inheritance'] },
      { id: 'glory', label: 'Eternal Glory', status: 'unmet' as const, needs: ['reputation', 'followers'], paths: ['great_deed', 'sacrifice', 'legend'] },
    ],
  },
  merchant: {
    nodes: [
      { id: 'capital', label: 'Starting Capital', status: 'unmet' as const, paths: ['loan', 'inheritance', 'theft'] },
      { id: 'trade_routes', label: 'Trade Routes', status: 'unmet' as const, needs: ['capital'], paths: ['exploration', 'negotiation', 'conquest'] },
      { id: 'connections', label: 'Business Network', status: 'unmet' as const, paths: ['partnership', 'bribery', 'marriage'] },
      { id: 'monopoly', label: 'Market Monopoly', status: 'unmet' as const, needs: ['trade_routes', 'connections'], paths: ['elimination', 'regulation', 'innovation'] },
      { id: 'wealth', label: 'Vast Wealth', status: 'unmet' as const, needs: ['monopoly'], paths: ['accumulation', 'investment', 'exploitation'] },
    ],
  },
  scholar: {
    nodes: [
      { id: 'education', label: 'Formal Education', status: 'unmet' as const, paths: ['academy', 'mentor', 'self_study'] },
      { id: 'research', label: 'Original Research', status: 'unmet' as const, needs: ['education'], paths: ['experimentation', 'exploration', 'collaboration'] },
      { id: 'knowledge', label: 'Hidden Knowledge', status: 'unmet' as const, paths: ['ancient_texts', 'forbidden_lore', 'divine_vision'] },
      { id: 'discovery', label: 'Great Discovery', status: 'unmet' as const, needs: ['research', 'knowledge'], paths: ['breakthrough', 'synthesis', 'revelation'] },
      { id: 'legacy', label: 'Scholarly Legacy', status: 'unmet' as const, needs: ['discovery'], paths: ['teaching', 'writing', 'institution'] },
    ],
  },
};

/**
 * Generate a requirement graph from an ambition
 */
export function fromAmbition(ambition: AmbitionCanonical): RequirementGraph {
  // Use the highest-weighted archetype, or default to king
  const primaryArchetype = ambition.archetypes.reduce((best, current) => {
    const currentWeight = ambition.weights[current] || 0;
    const bestWeight = ambition.weights[best] || 0;
    return currentWeight > bestWeight ? current : best;
  }, ambition.archetypes[0] || 'king');

  // Get the template for this archetype
  const template = ARCHETYPE_TEMPLATES[primaryArchetype as keyof typeof ARCHETYPE_TEMPLATES] 
    || ARCHETYPE_TEMPLATES.king;

  // Clone the template nodes
  const nodes: GraphNode[] = template.nodes.map(node => ({ ...node }));

  // Apply virtue/vice modifiers
  modifyGraphBasedOnTraits(nodes, ambition.virtues, ambition.vices);

  return {
    ambition: ambition.archetypes.join(', ') + (ambition.virtues.length > 0 ? ` (${ambition.virtues.join(', ')})` : ''),
    nodes,
  };
}

/**
 * Modify graph based on virtues and vices
 */
function modifyGraphBasedOnTraits(nodes: GraphNode[], virtues: string[], vices: string[]): void {
  // Add virtue-based paths
  if (virtues.includes('honor')) {
    const legitNode = nodes.find(n => n.id === 'legitimacy' || n.id === 'reputation');
    if (legitNode && legitNode.paths) {
      legitNode.paths.push('honor_code');
    }
  }

  if (virtues.includes('compassion')) {
    const peopleNode = nodes.find(n => n.id === 'people' || n.id === 'followers');
    if (peopleNode && peopleNode.paths) {
      peopleNode.paths.push('benevolence');
    }
  }

  if (virtues.includes('wisdom')) {
    const knowledgeNode = nodes.find(n => n.id === 'knowledge' || n.id === 'education');
    if (knowledgeNode && knowledgeNode.paths) {
      knowledgeNode.paths.push('meditation');
    }
  }

  // Remove paths based on vices (e.g., pride might remove humble paths)
  if (vices.includes('pride')) {
    nodes.forEach(node => {
      if (node.paths) {
        node.paths = node.paths.filter(path => !['submission', 'humility', 'service'].includes(path));
      }
    });
  }

  if (vices.includes('greed')) {
    nodes.forEach(node => {
      if (node.paths) {
        node.paths = node.paths.filter(path => !['charity', 'gift', 'sacrifice'].includes(path));
      }
    });
  }
}