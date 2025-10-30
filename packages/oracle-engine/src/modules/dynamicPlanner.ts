/**
 * Dynamic Planner for Ambition System
 * 
 * Replaces static template-based planning with domain-driven action proposal.
 * Queries DSL for rules matching node domains and ambition profile modifiers.
 * Guarantees at least one reachable action each tick.
 */

import { RequirementGraph, WorldState, KnowledgeBase, ActionProposal, AmbitionProfile } from '../types/index.js';
import { GeneratorRule, RequirementRule } from '../types/index.js';

interface DynamicPlannerInput {
  graph: RequirementGraph;
  world: WorldState;
  kb: KnowledgeBase;
  ambitionProfile: AmbitionProfile;
}

interface ActionScore {
  action: ActionProposal;
  score: number;
  reasoning: string;
}

/**
 * Generate action proposals using dynamic domain-based matching
 */
export function proposeDynamic({ graph, world, kb, ambitionProfile }: DynamicPlannerInput): ActionProposal[] {
  const candidateActions: ActionProposal[] = [];

  // 1. Generate actions for unmet requirements using domain matching
  const requirementActions = generateDomainBasedRequirementActions(graph, world, kb, ambitionProfile);
  candidateActions.push(...requirementActions);

  // 2. Generate ambition-driven opportunity actions
  const opportunityActions = generateAmbitionOpportunityActions(world, kb, ambitionProfile);
  candidateActions.push(...opportunityActions);

  // 3. Generate fallback actions if no viable actions found
  if (candidateActions.length === 0) {
    const fallbackActions = generateFallbackActions(world, kb, ambitionProfile);
    candidateActions.push(...fallbackActions);
  }

  // 4. Score all actions using domain affinity
  const scoredActions = candidateActions
    .map(action => scoreDynamicAction(action, graph, world, ambitionProfile))
    .filter(scored => scored.score > 0)
    .sort((a, b) => b.score - a.score);

  // 5. Ensure diversity and return top actions
  const diverseActions = ensureActionDiversity(scoredActions, ambitionProfile);
  return diverseActions.slice(0, 5).map(scored => scored.action);
}

/**
 * Generate actions for unmet requirements using domain matching
 */
function generateDomainBasedRequirementActions(
  graph: RequirementGraph,
  world: WorldState,
  kb: KnowledgeBase,
  ambitionProfile: AmbitionProfile
): ActionProposal[] {
  const actions: ActionProposal[] = [];
  const unmetNodes = graph.nodes.filter(node => node.status === 'unmet');

  for (const node of unmetNodes) {
    // Check if node has dependencies that are met
    const dependenciesMet = !node.needs || node.needs.every(needId => 
      graph.nodes.find(n => n.id === needId)?.status === 'met'
    );

    if (!dependenciesMet) continue;

    // Find rules that match this node's domains
    const nodeDomains = node.domains || [];
    const matchingRules = findRulesForDomains(kb, nodeDomains, ambitionProfile);

    for (const rule of matchingRules) {
      // Generate actions from rule paths
      for (const [pathId, path] of Object.entries(rule.paths)) {
        const action: ActionProposal = {
          id: `${rule.id}_${pathId}`,
          label: path.label || `${rule.label} via ${pathId}`,
          description: path.description || `Pursue ${rule.label} through ${pathId}`,
          satisfies: [rule.id, node.id, ...nodeDomains],
          costs: path.costs || {},
          rewards: path.rewards || {},
          risks: path.risks || {},
          time: path.time || '1 turn',
          requirements: path.requirements || [],
          mapRefs: path.mapRefs || [],
          effects: path.effects || []
        };

        actions.push(action);
      }
    }
  }

  return actions;
}

/**
 * Generate opportunity actions based on ambition profile
 */
function generateAmbitionOpportunityActions(
  world: WorldState,
  kb: KnowledgeBase,
  ambitionProfile: AmbitionProfile
): ActionProposal[] {
  const actions: ActionProposal[] = [];
  const dominantDomains = getDominantDomains(ambitionProfile);

  // Check generator rules for actions matching dominant domains
  for (const generator of kb.generators) {
    // Evaluate generator conditions
    if (!evaluateGeneratorConditions(generator, world, ambitionProfile)) {
      continue;
    }

    // Check if generator action matches our ambitions
    const actionDomains = extractActionDomains(generator.action);
    const domainOverlap = actionDomains.filter(domain => dominantDomains.includes(domain));

    if (domainOverlap.length > 0) {
      const action: ActionProposal = {
        id: generator.action.id,
        label: generator.action.label,
        description: generator.action.description,
        satisfies: generator.action.satisfies,
        costs: generator.action.costs || {},
        rewards: generator.action.rewards || {},
        risks: generator.action.risks || {},
        time: generator.action.time || '1 turn',
        requirements: generator.action.requirements || [],
        mapRefs: generator.action.mapRefs || [],
        effects: generator.action.effects || []
      };

      actions.push(action);
    }
  }

  return actions;
}

/**
 * Generate fallback actions when no other actions are available
 */
function generateFallbackActions(
  world: WorldState,
  kb: KnowledgeBase,
  ambitionProfile: AmbitionProfile
): ActionProposal[] {
  const fallbackActions: ActionProposal[] = [];

  // Basic resource gathering based on current needs
  if (world.resources.gold < 50) {
    fallbackActions.push({
      id: 'gather_gold',
      label: 'Gather Gold',
      description: 'Collect basic funds through various means',
      satisfies: ['wealth', 'resources'],
      costs: {},
      rewards: { gold: 25 },
      risks: {},
      time: '1 turn',
      requirements: [],
      mapRefs: [],
      effects: []
    });
  }

  // Military recruitment if forces are low
  if (world.forces.units < 50) {
    fallbackActions.push({
      id: 'recruit_followers',
      label: 'Recruit Followers',
      description: 'Gather loyal supporters to your cause',
      satisfies: ['power', 'followers'],
      costs: { gold: 20 },
      rewards: {},
      risks: {},
      time: '1 turn',
      requirements: [],
      mapRefs: [],
      effects: ['+forces.units = 10']
    });
  }

  // Wait/contemplate action as absolute fallback
  fallbackActions.push({
    id: 'contemplate_ambition',
    label: 'Contemplate Your Path',
    description: 'Spend time reflecting on your ambitions and planning future actions',
    satisfies: ['wisdom', 'planning'],
    costs: {},
    rewards: {},
    risks: {},
    time: '1 turn',
    requirements: [],
    mapRefs: [],
    effects: []
  });

  return fallbackActions;
}

/**
 * Score actions based on domain affinity and current needs
 */
function scoreDynamicAction(
  action: ActionProposal,
  graph: RequirementGraph,
  world: WorldState,
  ambitionProfile: AmbitionProfile
): ActionScore {
  let score = 0;
  const reasons: string[] = [];

  // Base score from domain alignment
  const actionDomains = extractActionDomains(action);
  const domainScore = calculateDomainAlignmentScore(actionDomains, ambitionProfile);
  score += domainScore * 10;
  if (domainScore > 0.5) {
    reasons.push(`Strong domain alignment (${domainScore.toFixed(2)})`);
  }

  // Modifier compatibility bonus
  const modifierScore = calculateModifierCompatibility(action, ambitionProfile);
  score += modifierScore * 5;
  if (modifierScore > 0.3) {
    reasons.push(`Modifier compatibility (${modifierScore.toFixed(2)})`);
  }

  // Requirement fulfillment bonus
  const unmetNodes = graph.nodes.filter(n => n.status === 'unmet');
  const fulfillsRequirement = unmetNodes.some(node => 
    action.satisfies.includes(node.id) || 
    (node.domains && node.domains.some(domain => action.satisfies.includes(domain)))
  );
  if (fulfillsRequirement) {
    score += 15;
    reasons.push('Fulfills active requirement');
  }

  // Affordability check
  const isAffordable = checkAffordability(action, world);
  if (!isAffordable) {
    score = 0;
    reasons.push('Cannot afford action costs');
  } else if (action.costs && Object.keys(action.costs).length > 0) {
    reasons.push('Action is affordable');
  }

  // Risk assessment based on modifier preferences
  const riskScore = calculateRiskScore(action, ambitionProfile);
  score += riskScore;
  if (riskScore !== 0) {
    reasons.push(`Risk assessment (${riskScore > 0 ? '+' : ''}${riskScore.toFixed(1)})`);
  }

  // Scale preference bonus
  const scaleScore = calculateScalePreference(action, ambitionProfile);
  score += scaleScore;
  if (scaleScore > 0) {
    reasons.push(`Scale preference (+${scaleScore.toFixed(1)})`);
  }

  return {
    action,
    score: Math.max(0, score),
    reasoning: reasons.join(', ') || 'Basic action viability'
  };
}

/**
 * Calculate how well action domains align with ambition profile
 */
function calculateDomainAlignmentScore(actionDomains: string[], ambitionProfile: AmbitionProfile): number {
  if (actionDomains.length === 0) return 0.1; // Small base score for unknown actions

  const domainWeights = {
    power: ambitionProfile.power,
    wealth: ambitionProfile.wealth,
    faith: ambitionProfile.faith,
    virtue: ambitionProfile.virtue,
    freedom: ambitionProfile.freedom,
    creation: ambitionProfile.creation
  };

  let totalAlignment = 0;
  for (const domain of actionDomains) {
    totalAlignment += domainWeights[domain as keyof typeof domainWeights] || 0;
  }

  return totalAlignment / actionDomains.length;
}

/**
 * Calculate modifier compatibility with action
 */
function calculateModifierCompatibility(action: ActionProposal, ambitionProfile: AmbitionProfile): number {
  let compatibility = 0;
  const actionText = `${action.label} ${action.description}`.toLowerCase();

  // Peaceful modifier
  if (hasKeywords(actionText, ['diplomacy', 'peace', 'negotiate', 'alliance', 'cooperation'])) {
    compatibility += ambitionProfile.modifiers.peaceful * 0.8;
  } else if (hasKeywords(actionText, ['war', 'battle', 'attack', 'conquest', 'violence'])) {
    compatibility += (1 - ambitionProfile.modifiers.peaceful) * 0.5;
  }

  // Ruthless modifier
  if (hasKeywords(actionText, ['ruthless', 'brutal', 'sacrifice', 'betray', 'manipulate'])) {
    compatibility += ambitionProfile.modifiers.ruthless * 0.8;
  } else if (hasKeywords(actionText, ['merciful', 'gentle', 'compassionate', 'forgive'])) {
    compatibility += (1 - ambitionProfile.modifiers.ruthless) * 0.5;
  }

  // Secretive modifier
  if (hasKeywords(actionText, ['secret', 'hidden', 'spy', 'infiltrate', 'covert'])) {
    compatibility += ambitionProfile.modifiers.secretive * 0.8;
  } else if (hasKeywords(actionText, ['public', 'open', 'declare', 'announce'])) {
    compatibility += (1 - ambitionProfile.modifiers.secretive) * 0.5;
  }

  // Opulent modifier
  if (hasKeywords(actionText, ['luxury', 'grand', 'magnificent', 'opulent', 'lavish'])) {
    compatibility += ambitionProfile.modifiers.opulent * 0.8;
  } else if (hasKeywords(actionText, ['simple', 'humble', 'modest', 'austere'])) {
    compatibility += ambitionProfile.modifiers.ascetic * 0.8;
  }

  return Math.min(compatibility, 1.0);
}

/**
 * Check if action is affordable
 */
function checkAffordability(action: ActionProposal, world: WorldState): boolean {
  if (!action.costs) return true;
  
  for (const [resource, cost] of Object.entries(action.costs)) {
    const available = world.resources[resource as keyof typeof world.resources];
    if (typeof cost === 'number' && cost > available) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate risk score based on ambition modifiers
 */
function calculateRiskScore(action: ActionProposal, ambitionProfile: AmbitionProfile): number {
  if (!action.risks) return 0;
  
  const totalRisk = Object.values(action.risks).reduce((sum, risk) => sum + (typeof risk === 'number' ? risk : 0), 0);
  
  if (totalRisk === 0) return 0;

  // Ruthless characters are more willing to take risks
  const riskTolerance = 0.5 + (ambitionProfile.modifiers.ruthless * 0.3) - (ambitionProfile.modifiers.peaceful * 0.2);
  
  // Convert risk to score modifier
  if (totalRisk > riskTolerance) {
    return -(totalRisk - riskTolerance) * 5; // Penalty for excessive risk
  } else {
    return (riskTolerance - totalRisk) * 2; // Bonus for manageable risk
  }
}

/**
 * Calculate scale preference score
 */
function calculateScalePreference(action: ActionProposal, ambitionProfile: AmbitionProfile): number {
  const actionText = `${action.label} ${action.description}`.toLowerCase();
  let scaleScore = 0;

  if (hasKeywords(actionText, ['local', 'village', 'town', 'community', 'neighborhood'])) {
    scaleScore += ambitionProfile.scale.local * 3;
  }
  
  if (hasKeywords(actionText, ['region', 'province', 'territory', 'land', 'domain'])) {
    scaleScore += ambitionProfile.scale.regional * 3;
  }
  
  if (hasKeywords(actionText, ['world', 'global', 'empire', 'continent', 'universal'])) {
    scaleScore += ambitionProfile.scale.world * 3;
  }

  return scaleScore;
}

/**
 * Utility functions
 */
function getDominantDomains(ambitionProfile: AmbitionProfile, threshold: number = 0.2): string[] {
  const domains = [
    { name: 'power', value: ambitionProfile.power },
    { name: 'wealth', value: ambitionProfile.wealth },
    { name: 'faith', value: ambitionProfile.faith },
    { name: 'virtue', value: ambitionProfile.virtue },
    { name: 'freedom', value: ambitionProfile.freedom },
    { name: 'creation', value: ambitionProfile.creation }
  ];

  return domains
    .filter(d => d.value >= threshold)
    .sort((a, b) => b.value - a.value)
    .map(d => d.name);
}

function extractActionDomains(action: any): string[] {
  const domains: string[] = [];
  const actionText = `${action.label} ${action.description} ${(action.satisfies || []).join(' ')}`.toLowerCase();

  if (hasKeywords(actionText, ['power', 'rule', 'command', 'authority', 'control', 'dominate'])) domains.push('power');
  if (hasKeywords(actionText, ['wealth', 'trade', 'gold', 'commerce', 'merchant', 'profit'])) domains.push('wealth');
  if (hasKeywords(actionText, ['faith', 'divine', 'holy', 'sacred', 'temple', 'god', 'prayer'])) domains.push('faith');
  if (hasKeywords(actionText, ['virtue', 'justice', 'honor', 'moral', 'righteous', 'good'])) domains.push('virtue');
  if (hasKeywords(actionText, ['freedom', 'liberate', 'rebel', 'independence', 'escape'])) domains.push('freedom');
  if (hasKeywords(actionText, ['create', 'build', 'craft', 'art', 'innovation', 'construct'])) domains.push('creation');

  return domains;
}

function findRulesForDomains(kb: KnowledgeBase, domains: string[], ambitionProfile: AmbitionProfile): RequirementRule[] {
  const matchingRules: RequirementRule[] = [];

  for (const rule of Object.values(kb.requirements)) {
    // Check if rule satisfies any of the domains
    const ruleDomains = extractActionDomains(rule);
    const hasOverlap = domains.some(domain => ruleDomains.includes(domain));

    if (hasOverlap) {
      matchingRules.push(rule);
    }
  }

  return matchingRules;
}

function evaluateGeneratorConditions(generator: GeneratorRule, world: WorldState, ambitionProfile: AmbitionProfile): boolean {
  // Simplified condition evaluation - can be enhanced
  for (const condition of generator.conditions) {
    if (condition.includes('ambition.')) {
      // Ambition-based conditions
      const domainMatch = condition.match(/ambition\.(\w+)\s*([><=]+)\s*([\d.]+)/);
      if (domainMatch) {
        const [, domain, operator, valueStr] = domainMatch;
        if (!domain || !operator || !valueStr) continue;
        
        const value = parseFloat(valueStr);
        const currentValue = (ambitionProfile as any)[domain];
        
        if (typeof currentValue === 'number') {
          switch (operator) {
            case '>': if (!(currentValue > value)) return false; break;
            case '>=': if (!(currentValue >= value)) return false; break;
            case '<': if (!(currentValue < value)) return false; break;
            case '<=': if (!(currentValue <= value)) return false; break;
            case '=': if (!(Math.abs(currentValue - value) < 0.01)) return false; break;
          }
        }
      }
    } else {
      // World-based conditions (existing logic)
      // TODO: Implement world condition evaluation
    }
  }

  return true;
}

function hasKeywords(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

function ensureActionDiversity(scoredActions: ActionScore[], ambitionProfile: AmbitionProfile): ActionScore[] {
  if (scoredActions.length <= 3) return scoredActions;

  const diverse: ActionScore[] = [];
  const usedDomains = new Set<string>();

  // First pass: include highest-scoring action from each domain
  for (const scored of scoredActions) {
    const actionDomains = extractActionDomains(scored.action);
    const newDomain = actionDomains.find(domain => !usedDomains.has(domain));

    if (newDomain || diverse.length === 0) {
      diverse.push(scored);
      actionDomains.forEach(domain => usedDomains.add(domain));
      
      if (diverse.length >= 5) break;
    }
  }

  // Second pass: fill remaining slots with highest scores
  for (const scored of scoredActions) {
    if (!diverse.includes(scored) && diverse.length < 5) {
      diverse.push(scored);
    }
  }

  return diverse;
}