/**
 * Procedural Goal Generator
 * 
 * Generates dynamic requirement graphs based on AmbitionProfile weights.
 * Replaces static archetype-based goal templates with probabilistic,
 * domain-driven goal generation.
 */

import { AmbitionProfile } from '../types/index.js';
import { GraphNode, RequirementGraph } from '../types/index.js';
import { SeededRandom } from './worldGen.js';

export interface GoalNodeTemplate {
  id: string;
  label: string;
  domains: string[];           // Which domains this node serves
  spawnWeight: number;         // Base probability of spawning (0-1)
  minDomainWeight: number;     // Minimum domain weight required to spawn
  dependencies?: string[];     // Other nodes this depends on
  exclusions?: string[];       // Nodes that exclude this one
  tier: number;               // Goal hierarchy tier (1=basic, 2=intermediate, 3=ultimate)
}

/**
 * Node templates organized by domain
 */
const GOAL_NODE_TEMPLATES: Record<string, GoalNodeTemplate[]> = {
  power: [
    // Tier 1 - Basic power goals
    {
      id: 'personal_strength',
      label: 'Personal Strength',
      domains: ['power'],
      spawnWeight: 0.8,
      minDomainWeight: 0.1,
      tier: 1
    },
    {
      id: 'loyal_followers',
      label: 'Loyal Followers',
      domains: ['power'],
      spawnWeight: 0.7,
      minDomainWeight: 0.15,
      dependencies: ['personal_strength'],
      tier: 1
    },
    {
      id: 'military_force',
      label: 'Military Force',
      domains: ['power'],
      spawnWeight: 0.6,
      minDomainWeight: 0.2,
      tier: 1
    },
    
    // Tier 2 - Intermediate power goals
    {
      id: 'political_influence',
      label: 'Political Influence',
      domains: ['power'],
      spawnWeight: 0.5,
      minDomainWeight: 0.25,
      dependencies: ['loyal_followers'],
      tier: 2
    },
    {
      id: 'territorial_control',
      label: 'Territorial Control',
      domains: ['power'],
      spawnWeight: 0.6,
      minDomainWeight: 0.3,
      dependencies: ['military_force'],
      tier: 2
    },
    
    // Tier 3 - Ultimate power goals
    {
      id: 'absolute_dominion',
      label: 'Absolute Dominion',
      domains: ['power'],
      spawnWeight: 0.3,
      minDomainWeight: 0.5,
      dependencies: ['political_influence', 'territorial_control'],
      tier: 3
    }
  ],
  
  wealth: [
    // Tier 1 - Basic wealth goals
    {
      id: 'resource_accumulation',
      label: 'Resource Accumulation',
      domains: ['wealth'],
      spawnWeight: 0.8,
      minDomainWeight: 0.1,
      tier: 1
    },
    {
      id: 'trade_networks',
      label: 'Trade Networks',
      domains: ['wealth'],
      spawnWeight: 0.7,
      minDomainWeight: 0.15,
      tier: 1
    },
    {
      id: 'skilled_artisans',
      label: 'Skilled Artisans',
      domains: ['wealth', 'creation'],
      spawnWeight: 0.6,
      minDomainWeight: 0.2,
      tier: 1
    },
    
    // Tier 2 - Intermediate wealth goals
    {
      id: 'merchant_empire',
      label: 'Merchant Empire',
      domains: ['wealth'],
      spawnWeight: 0.5,
      minDomainWeight: 0.3,
      dependencies: ['trade_networks'],
      tier: 2
    },
    {
      id: 'economic_hegemony',
      label: 'Economic Hegemony',
      domains: ['wealth', 'power'],
      spawnWeight: 0.4,
      minDomainWeight: 0.4,
      dependencies: ['merchant_empire', 'skilled_artisans'],
      tier: 2
    },
    
    // Tier 3 - Ultimate wealth goals
    {
      id: 'golden_age',
      label: 'Golden Age of Prosperity',
      domains: ['wealth', 'creation'],
      spawnWeight: 0.3,
      minDomainWeight: 0.5,
      dependencies: ['economic_hegemony'],
      tier: 3
    }
  ],
  
  faith: [
    // Tier 1 - Basic faith goals
    {
      id: 'personal_devotion',
      label: 'Personal Devotion',
      domains: ['faith'],
      spawnWeight: 0.8,
      minDomainWeight: 0.1,
      tier: 1
    },
    {
      id: 'sacred_relics',
      label: 'Sacred Relics',
      domains: ['faith'],
      spawnWeight: 0.6,
      minDomainWeight: 0.15,
      tier: 1
    },
    {
      id: 'faithful_congregation',
      label: 'Faithful Congregation',
      domains: ['faith'],
      spawnWeight: 0.7,
      minDomainWeight: 0.2,
      dependencies: ['personal_devotion'],
      tier: 1
    },
    
    // Tier 2 - Intermediate faith goals
    {
      id: 'holy_temples',
      label: 'Holy Temples',
      domains: ['faith', 'creation'],
      spawnWeight: 0.5,
      minDomainWeight: 0.25,
      dependencies: ['faithful_congregation'],
      tier: 2
    },
    {
      id: 'divine_mandate',
      label: 'Divine Mandate',
      domains: ['faith', 'power'],
      spawnWeight: 0.4,
      minDomainWeight: 0.35,
      dependencies: ['sacred_relics', 'holy_temples'],
      tier: 2
    },
    
    // Tier 3 - Ultimate faith goals
    {
      id: 'spiritual_transcendence',
      label: 'Spiritual Transcendence',
      domains: ['faith'],
      spawnWeight: 0.3,
      minDomainWeight: 0.5,
      dependencies: ['divine_mandate'],
      tier: 3
    }
  ],
  
  virtue: [
    // Tier 1 - Basic virtue goals
    {
      id: 'moral_foundation',
      label: 'Moral Foundation',
      domains: ['virtue'],
      spawnWeight: 0.8,
      minDomainWeight: 0.1,
      tier: 1
    },
    {
      id: 'just_governance',
      label: 'Just Governance',
      domains: ['virtue', 'power'],
      spawnWeight: 0.7,
      minDomainWeight: 0.2,
      dependencies: ['moral_foundation'],
      tier: 1
    },
    {
      id: 'protect_innocent',
      label: 'Protect the Innocent',
      domains: ['virtue'],
      spawnWeight: 0.6,
      minDomainWeight: 0.15,
      tier: 1
    },
    
    // Tier 2 - Intermediate virtue goals
    {
      id: 'righteous_order',
      label: 'Righteous Order',
      domains: ['virtue', 'power'],
      spawnWeight: 0.5,
      minDomainWeight: 0.3,
      dependencies: ['just_governance', 'protect_innocent'],
      tier: 2
    },
    {
      id: 'moral_exemplar',
      label: 'Moral Exemplar',
      domains: ['virtue'],
      spawnWeight: 0.4,
      minDomainWeight: 0.35,
      dependencies: ['moral_foundation'],
      tier: 2
    },
    
    // Tier 3 - Ultimate virtue goals
    {
      id: 'paragon_of_justice',
      label: 'Paragon of Justice',
      domains: ['virtue'],
      spawnWeight: 0.3,
      minDomainWeight: 0.5,
      dependencies: ['righteous_order', 'moral_exemplar'],
      tier: 3
    }
  ],
  
  freedom: [
    // Tier 1 - Basic freedom goals
    {
      id: 'personal_liberty',
      label: 'Personal Liberty',
      domains: ['freedom'],
      spawnWeight: 0.8,
      minDomainWeight: 0.1,
      tier: 1
    },
    {
      id: 'break_chains',
      label: 'Break the Chains',
      domains: ['freedom'],
      spawnWeight: 0.7,
      minDomainWeight: 0.15,
      tier: 1
    },
    {
      id: 'resistance_network',
      label: 'Resistance Network',
      domains: ['freedom'],
      spawnWeight: 0.6,
      minDomainWeight: 0.2,
      dependencies: ['personal_liberty'],
      tier: 1
    },
    
    // Tier 2 - Intermediate freedom goals
    {
      id: 'liberation_movement',
      label: 'Liberation Movement',
      domains: ['freedom'],
      spawnWeight: 0.5,
      minDomainWeight: 0.3,
      dependencies: ['break_chains', 'resistance_network'],
      tier: 2
    },
    {
      id: 'overthrow_tyranny',
      label: 'Overthrow Tyranny',
      domains: ['freedom', 'power'],
      spawnWeight: 0.4,
      minDomainWeight: 0.35,
      dependencies: ['liberation_movement'],
      tier: 2
    },
    
    // Tier 3 - Ultimate freedom goals
    {
      id: 'eternal_freedom',
      label: 'Eternal Freedom',
      domains: ['freedom'],
      spawnWeight: 0.3,
      minDomainWeight: 0.5,
      dependencies: ['overthrow_tyranny'],
      tier: 3
    }
  ],
  
  creation: [
    // Tier 1 - Basic creation goals
    {
      id: 'artistic_vision',
      label: 'Artistic Vision',
      domains: ['creation'],
      spawnWeight: 0.8,
      minDomainWeight: 0.1,
      tier: 1
    },
    {
      id: 'master_craftsmen',
      label: 'Master Craftsmen',
      domains: ['creation'],
      spawnWeight: 0.7,
      minDomainWeight: 0.15,
      tier: 1
    },
    {
      id: 'great_works',
      label: 'Great Works',
      domains: ['creation'],
      spawnWeight: 0.6,
      minDomainWeight: 0.2,
      dependencies: ['artistic_vision'],
      tier: 1
    },
    
    // Tier 2 - Intermediate creation goals
    {
      id: 'cultural_renaissance',
      label: 'Cultural Renaissance',
      domains: ['creation'],
      spawnWeight: 0.5,
      minDomainWeight: 0.3,
      dependencies: ['master_craftsmen', 'great_works'],
      tier: 2
    },
    {
      id: 'timeless_legacy',
      label: 'Timeless Legacy',
      domains: ['creation'],
      spawnWeight: 0.4,
      minDomainWeight: 0.35,
      dependencies: ['cultural_renaissance'],
      tier: 2
    },
    
    // Tier 3 - Ultimate creation goals
    {
      id: 'immortal_masterpiece',
      label: 'Immortal Masterpiece',
      domains: ['creation'],
      spawnWeight: 0.3,
      minDomainWeight: 0.5,
      dependencies: ['timeless_legacy'],
      tier: 3
    }
  ]
};

/**
 * Generate a dynamic requirement graph based on ambition profile
 */
export function generateDynamicGoals(
  profile: AmbitionProfile, 
  rng: SeededRandom,
  maxNodes: number = 5,
  minNodes: number = 3
): RequirementGraph {
  const selectedNodes: GraphNode[] = [];
  const usedIds = new Set<string>();
  
  // Determine target number of nodes
  const targetNodes = rng.nextInt(minNodes, maxNodes);
  
  // Get domain priorities
  const domainPriorities = [
    { domain: 'power', weight: profile.power },
    { domain: 'wealth', weight: profile.wealth },
    { domain: 'faith', weight: profile.faith },
    { domain: 'virtue', weight: profile.virtue },
    { domain: 'freedom', weight: profile.freedom },
    { domain: 'creation', weight: profile.creation }
  ].sort((a, b) => b.weight - a.weight);
  
  // Generate nodes tier by tier to ensure proper dependencies
  for (let tier = 1; tier <= 3 && selectedNodes.length < targetNodes; tier++) {
    for (const domainInfo of domainPriorities) {
      if (selectedNodes.length >= targetNodes) break;
      
      const domain = domainInfo.domain;
      const domainWeight = domainInfo.weight;
      const templates = GOAL_NODE_TEMPLATES[domain] || [];
      
      // Filter templates for this tier
      const tierTemplates = templates.filter(t => t.tier === tier);
      
      for (const template of tierTemplates) {
        if (selectedNodes.length >= targetNodes) break;
        if (usedIds.has(template.id)) continue;
        
        // Check minimum domain weight requirement
        if (domainWeight < template.minDomainWeight) continue;
        
        // Check dependencies
        if (template.dependencies) {
          const hasAllDeps = template.dependencies.every(dep => usedIds.has(dep));
          if (!hasAllDeps) continue;
        }
        
        // Check exclusions
        if (template.exclusions) {
          const hasExclusion = template.exclusions.some(excl => usedIds.has(excl));
          if (hasExclusion) continue;
        }
        
        // Calculate spawn probability
        const baseChance = template.spawnWeight;
        const domainBonus = Math.min(domainWeight * 2, 1.0); // Double weight for strong domains
        const modifierBonus = calculateModifierBonus(profile, template);
        const finalChance = Math.min(baseChance + domainBonus + modifierBonus, 1.0);
        
        // Roll for spawn
        if (rng.next() < finalChance) {
          const node: GraphNode = {
            id: template.id,
            label: template.label,
            status: 'unmet',
            domains: template.domains,
            spawnThreshold: template.minDomainWeight,
            spawnedAtTick: 0
          };
          
          // Add dependencies if any
          if (template.dependencies && template.dependencies.length > 0) {
            node.needs = template.dependencies;
          }
          
          selectedNodes.push(node);
          usedIds.add(template.id);
        }
      }
    }
  }
  
  // Ensure we have at least minNodes
  if (selectedNodes.length < minNodes) {
    // Add guaranteed basic nodes from top domains
    const fallbackDomains = domainPriorities.slice(0, 2);
    for (const domainInfo of fallbackDomains) {
      if (selectedNodes.length >= minNodes) break;
      
      const domain = domainInfo.domain;
      const templates = GOAL_NODE_TEMPLATES[domain] || [];
      const tier1Templates = templates.filter(t => t.tier === 1 && !usedIds.has(t.id));
      
      if (tier1Templates.length > 0) {
        const template = tier1Templates[0]; // Take the first available
        if (template) {
          const node: GraphNode = {
            id: template.id,
            label: template.label,
            status: 'unmet',
            domains: template.domains,
            spawnThreshold: template.minDomainWeight,
            spawnedAtTick: 0
          };
          
          selectedNodes.push(node);
          usedIds.add(template.id);
        }
      }
    }
  }
  
  return {
    ambition: generateAmbitionSummary(profile),
    nodes: selectedNodes
  };
}

/**
 * Calculate modifier bonus for node spawning
 */
function calculateModifierBonus(profile: AmbitionProfile, template: GoalNodeTemplate): number {
  let bonus = 0;
  
  // Peaceful modifier affects certain goals
  if (template.domains.includes('virtue') || template.domains.includes('faith')) {
    bonus += profile.modifiers.peaceful * 0.1;
  }
  
  // Ruthless modifier affects power goals
  if (template.domains.includes('power')) {
    bonus += profile.modifiers.ruthless * 0.1;
  }
  
  // Opulent modifier affects wealth goals
  if (template.domains.includes('wealth')) {
    bonus += profile.modifiers.opulent * 0.1;
  }
  
  // Charismatic modifier affects power and virtue goals
  if (template.domains.includes('power') || template.domains.includes('virtue')) {
    bonus += profile.modifiers.charismatic * 0.05;
  }
  
  return bonus;
}

/**
 * Generate new nodes when domain thresholds are crossed
 */
export function generateThresholdNodes(
  profile: AmbitionProfile,
  currentGraph: RequirementGraph,
  crossedThresholds: Array<{domain: string, threshold: number}>,
  rng: SeededRandom,
  tick: number
): GraphNode[] {
  const newNodes: GraphNode[] = [];
  const existingIds = new Set(currentGraph.nodes.map(n => n.id));
  
  for (const crossed of crossedThresholds) {
    const { domain, threshold } = crossed;
    const templates = GOAL_NODE_TEMPLATES[domain] || [];
    
    // Find templates that match this threshold
    const eligibleTemplates = templates.filter(template => {
      // Must not already exist
      if (existingIds.has(template.id)) return false;
      
      // Must meet minimum threshold
      if (template.minDomainWeight > threshold + 0.05) return false; // Small buffer
      
      // Check dependencies
      if (template.dependencies) {
        const hasAllDeps = template.dependencies.every(dep => existingIds.has(dep));
        if (!hasAllDeps) return false;
      }
      
      return true;
    });
    
    // Select one template to spawn
    if (eligibleTemplates.length > 0) {
      // Prefer higher tier nodes for higher thresholds
      const preferredTier = threshold >= 0.6 ? 3 : threshold >= 0.4 ? 2 : 1;
      const tierTemplates = eligibleTemplates.filter(t => t.tier === preferredTier);
      const finalTemplates = tierTemplates.length > 0 ? tierTemplates : eligibleTemplates;
      
      const selectedTemplate = rng.choice(finalTemplates);
      
      const newNode: GraphNode = {
        id: selectedTemplate.id,
        label: selectedTemplate.label,
        status: 'unmet',
        domains: selectedTemplate.domains,
        spawnThreshold: selectedTemplate.minDomainWeight,
        spawnedAtTick: tick
      };
      
      if (selectedTemplate.dependencies && selectedTemplate.dependencies.length > 0) {
        newNode.needs = selectedTemplate.dependencies;
      }
      
      newNodes.push(newNode);
      existingIds.add(selectedTemplate.id);
    }
  }
  
  return newNodes;
}

/**
 * Generate a textual summary of the ambition for the graph
 */
function generateAmbitionSummary(profile: AmbitionProfile): string {
  const dominantDomains = [
    { name: 'power', value: profile.power },
    { name: 'wealth', value: profile.wealth },
    { name: 'faith', value: profile.faith },
    { name: 'virtue', value: profile.virtue },
    { name: 'freedom', value: profile.freedom },
    { name: 'creation', value: profile.creation }
  ]
    .filter(d => d.value > 0.15)
    .sort((a, b) => b.value - a.value)
    .map(d => d.name);
  
  const strongModifiers = Object.entries(profile.modifiers)
    .filter(([_, value]) => value > 0.3)
    .map(([name, _]) => name);
  
  let summary = `Dynamic ambition focused on ${dominantDomains.join(', ')}`;
  
  if (strongModifiers.length > 0) {
    summary += ` (${strongModifiers.join(', ')})`;
  }
  
  return summary;
}

/**
 * Get all available node templates for inspection/testing
 */
export function getAllNodeTemplates(): Record<string, GoalNodeTemplate[]> {
  return GOAL_NODE_TEMPLATES;
}