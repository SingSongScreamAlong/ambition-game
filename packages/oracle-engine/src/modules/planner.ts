import { RequirementGraph, WorldState, KnowledgeBase, ActionProposal } from '../types/index.js';

interface PlannerInput {
  graph: RequirementGraph;
  world: WorldState;
  kb: KnowledgeBase;
}

interface ActionScore {
  action: ActionProposal;
  score: number;
  reasoning: string;
}

/**
 * Generate top 3-5 action proposals using GOAP-lite approach
 */
export function propose({ graph, world, kb }: PlannerInput): ActionProposal[] {
  const candidateActions: ActionProposal[] = [];

  // 1. Generate actions from requirement paths
  const requirementActions = generateRequirementActions(graph, world, kb);
  candidateActions.push(...requirementActions);

  // 2. Generate actions from generators (opportunities)
  const generatedActions = generateOpportunityActions(world, kb);
  candidateActions.push(...generatedActions);

  // 3. Score all actions
  const scoredActions = candidateActions
    .map(action => scoreAction(action, graph, world))
    .filter(scored => scored.score > 0) // Remove impossible actions
    .sort((a, b) => b.score - a.score); // Sort by score descending

  // 4. Return top 3-5 actions
  return scoredActions.slice(0, 5).map(scored => scored.action);
}

/**
 * Generate actions from unmet requirements in the graph
 */
function generateRequirementActions(
  graph: RequirementGraph,
  world: WorldState,
  kb: KnowledgeBase
): ActionProposal[] {
  const actions: ActionProposal[] = [];

  // Find unmet nodes
  const unmetNodes = graph.nodes.filter(node => node.status === 'unmet');

  for (const node of unmetNodes) {
    // Check if prerequisites are met
    const prereqsMet = !node.needs || node.needs.every(needId => 
      graph.nodes.find(n => n.id === needId)?.status === 'met'
    );

    if (!prereqsMet) continue;

    // Get requirement rule from knowledge base
    const reqRule = kb.requirements[node.id];
    if (!reqRule) continue;

    // Generate actions for each available path
    for (const [pathId, pathRule] of Object.entries(reqRule.paths)) {
      // Check if path requirements are met
      const pathReqsMet = !pathRule.requirements || pathRule.requirements.every(req =>
        checkRequirement(req, world)
      );

      if (!pathReqsMet) continue;

      // Create action proposal
      const action: ActionProposal = {
        id: `${node.id}_${pathId}_${Date.now()}`,
        label: `${reqRule.label} via ${pathId}`,
        description: `Achieve ${reqRule.label} through ${pathId}`,
        satisfies: [node.id],
        costs: pathRule.costs,
        risks: pathRule.risks,
        time: pathRule.time,
        requirements: pathRule.requirements,
        rewards: {},
      };

      actions.push(action);
    }
  }

  return actions;
}

/**
 * Generate actions from generator rules (opportunities)
 */
function generateOpportunityActions(world: WorldState, kb: KnowledgeBase): ActionProposal[] {
  const actions: ActionProposal[] = [];

  for (const generator of kb.generators) {
    // Check if all conditions are met
    const conditionsMet = generator.conditions.every(condition => 
      evaluateCondition(condition, world)
    );

    if (conditionsMet) {
      actions.push(generator.action);
    }
  }

  return actions;
}

/**
 * Score an action based on utility (progress, risk, cost, time, reputation, legitimacy)
 */
function scoreAction(action: ActionProposal, graph: RequirementGraph, world: WorldState): ActionScore {
  let score = 0;
  let reasoning = '';

  // 1. Progress score (how much does this advance our goals?)
  const progressScore = calculateProgressScore(action, graph);
  score += progressScore * 0.35; // 35% weight (reduced from 40% to make room for legitimacy)
  reasoning += `Progress: ${progressScore.toFixed(1)} `;

  // 2. Resource cost penalty
  const costPenalty = calculateCostPenalty(action, world);
  score -= costPenalty * 0.2; // 20% weight
  reasoning += `Cost: -${costPenalty.toFixed(1)} `;

  // 3. Risk penalty
  const riskPenalty = calculateRiskPenalty(action);
  score -= riskPenalty * 0.2; // 20% weight
  reasoning += `Risk: -${riskPenalty.toFixed(1)} `;

  // 4. Time efficiency (shorter is better)
  const timeScore = calculateTimeScore(action);
  score += timeScore * 0.1; // 10% weight
  reasoning += `Time: ${timeScore.toFixed(1)} `;

  // 5. Opportunity bonus (from generators)
  const opportunityBonus = action.rewards && Object.keys(action.rewards).length > 0 ? 2 : 0;
  score += opportunityBonus * 0.05; // 5% weight (reduced from 10%)
  reasoning += `Opportunity: ${opportunityBonus.toFixed(1)} `;

  // 6. Legitimacy bonus (NEW: actions that increase unmet legitimacy goals)
  const legitimacyBonus = calculateLegitimacyBonus(action, world);
  score += legitimacyBonus * 0.08; // 8% weight (reduced to make room for faith bonus)
  reasoning += `Legitimacy: ${legitimacyBonus.toFixed(1)} `;

  // 7. Faith bonus (NEW: actions that address faith crises and regional faith needs)
  const faithBonus = calculateFaithBonus(action, world);
  score += faithBonus * 0.07; // 7% weight
  reasoning += `Faith: ${faithBonus.toFixed(1)}`;

  return {
    action,
    score: Math.max(0, score), // Ensure non-negative
    reasoning,
  };
}

function calculateProgressScore(action: ActionProposal, graph: RequirementGraph): number {
  if (!action.satisfies || action.satisfies.length === 0) return 1; // Opportunity actions get base score

  let score = 0;
  for (const nodeId of action.satisfies) {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node && node.status === 'unmet') {
      score += 5; // Base score for satisfying a requirement
      
      // Bonus if this unlocks other requirements
      const dependents = graph.nodes.filter(n => n.needs?.includes(nodeId));
      score += dependents.length * 2;
    }
  }
  return score;
}

function calculateCostPenalty(action: ActionProposal, world: WorldState): number {
  if (!action.costs) return 0;

  let penalty = 0;
  for (const [resource, cost] of Object.entries(action.costs)) {
    const available = world.resources[resource as keyof typeof world.resources] || 0;
    if (cost > available) {
      return 1000; // Impossible action
    }
    // Penalty increases as we use more of our resources
    penalty += (cost / available) * 3;
  }
  return penalty;
}

function calculateRiskPenalty(action: ActionProposal): number {
  if (!action.risks) return 0;

  let penalty = 0;
  for (const [_riskType, probability] of Object.entries(action.risks)) {
    penalty += probability * 5; // Each 10% risk = 0.5 penalty
  }
  return penalty;
}

function calculateTimeScore(action: ActionProposal): number {
  const timeStr = action.time.toLowerCase();
  if (timeStr.includes('1')) return 3;
  if (timeStr.includes('2')) return 2;
  if (timeStr.includes('3')) return 1;
  return 0.5; // Longer than 3 turns
}

/**
 * Check if a requirement is met
 */
function checkRequirement(requirement: string, world: WorldState): boolean {
  // Simple requirement checking - can be extended
  switch (requirement) {
    case 'army':
      return world.forces.units > 0;
    case 'people':
      return world.people.loyalty > 0.5;
    case 'legitimacy':
      return world.traits.includes('legitimacy') || world.people.loyalty > 0.8;
    case 'reputation':
      return world.traits.includes('reputation') || world.forces.morale > 0.7;
    default:
      return world.traits.includes(requirement);
  }
}

/**
 * Evaluate a generator condition
 */
function evaluateCondition(condition: string, world: WorldState): boolean {
  // Parse simple conditions like "iron < 50", "road_security < 0.5", etc.
  if (condition.includes('<')) {
    const parts = condition.split('<').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const leftValue = getWorldValue(parts[0], world);
      const rightValue = parseFloat(parts[1]);
      return leftValue < rightValue;
    }
  }
  
  if (condition.includes('>')) {
    const parts = condition.split('>').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const leftValue = getWorldValue(parts[0], world);
      const rightValue = parseFloat(parts[1]);
      return leftValue > rightValue;
    }
  }
  
  // Simple boolean conditions
  switch (condition) {
    case 'iron_scarcity':
      return world.resources.iron < 30;
    case 'winter':
      return world.tick % 4 === 3; // Every 4th tick is winter
    default:
      return false;
  }
}

function getWorldValue(key: string, world: WorldState): number {
  switch (key) {
    case 'iron':
      return world.resources.iron || 0;
    case 'grain':
      return world.resources.grain || 0;
    case 'gold':
      return world.resources.gold || 0;
    case 'unrest':
      return world.people.unrest || 0;
    case 'road_security':
    case 'security':
      return world.regions.length > 0 
        ? world.regions.reduce((avg, r) => avg + (r.security || 0), 0) / world.regions.length
        : 0;
    default:
      return 0;
  }
}

/**
 * Calculate legitimacy bonus for actions that address unmet legitimacy goals
 */
function calculateLegitimacyBonus(action: ActionProposal, world: WorldState): number {
  if (!action.satisfies || action.satisfies.length === 0) {
    return 0; // Opportunity actions don't get legitimacy bonus
  }

  const { legitimacy } = world;
  let bonus = 0;
  let influencingMeter = '';

  // Handle missing legitimacy data (for backward compatibility with tests)
  if (!legitimacy) {
    return 0;
  }

  // Identify which legitimacy meters are most needed (lowest scores)
  const legitimacyNeeds = [
    { meter: 'law', value: legitimacy.law, weight: 1 },
    { meter: 'faith', value: legitimacy.faith, weight: 1 },
    { meter: 'lineage', value: legitimacy.lineage, weight: 1 },
    { meter: 'might', value: legitimacy.might, weight: 1 },
  ].sort((a, b) => a.value - b.value); // Sort by lowest first

  // Higher bonus for addressing the most critical legitimacy gaps
  const criticalMeter = legitimacyNeeds[0];
  const secondaryMeter = legitimacyNeeds[1];

  // Check if this action would help with legitimacy based on its requirements and effects
  for (const requirement of action.satisfies) {
    let legitimacyGain = 0;
    let meterInfluenced = '';

    switch (requirement) {
      case 'legitimacy':
        // Direct legitimacy actions get bonus based on most needed meter
        if (criticalMeter) {
          legitimacyGain = (100 - criticalMeter.value) / 20; // 0-5 bonus
          meterInfluenced = criticalMeter.meter;
        }
        break;
      
      case 'army':
      case 'strength':
      case 'followers':
        // Military actions boost 'might' legitimacy
        if (legitimacy.might < 70) {
          legitimacyGain = (70 - legitimacy.might) / 25; // 0-2.8 bonus
          meterInfluenced = 'might';
        }
        break;
      
      case 'people':
        // People-focused actions boost 'law' (good governance)
        if (legitimacy.law < 70) {
          legitimacyGain = (70 - legitimacy.law) / 25; // 0-2.8 bonus
          meterInfluenced = 'law';
        }
        break;
      
      case 'treasury':
        // Economic actions boost 'law' (administrative competence)
        if (legitimacy.law < 60) {
          legitimacyGain = (60 - legitimacy.law) / 30; // 0-2 bonus
          meterInfluenced = 'law';
        }
        break;
      
      case 'land':
        // Territory control boosts 'lineage' (rightful rule)
        if (legitimacy.lineage < 60) {
          legitimacyGain = (60 - legitimacy.lineage) / 30; // 0-2 bonus
          meterInfluenced = 'lineage';
        }
        break;
    }

    if (legitimacyGain > bonus) {
      bonus = legitimacyGain;
      influencingMeter = meterInfluenced;
    }
  }

  // Log which meter influenced the decision (dev console logging)
  if (bonus > 0) {
    console.log(`[Legitimacy Influence] Action "${action.label}" gains +${bonus.toFixed(1)} utility (${influencingMeter}: ${legitimacy[influencingMeter as keyof typeof legitimacy]}/100)`);
  }

  return bonus;
}

/**
 * Calculate bonus for actions addressing faith and regional religious needs
 */
function calculateFaithBonus(action: ActionProposal, world: WorldState): number {
  let bonus = 0;
  let reason = '';

  // 1. Faith legitimacy crisis bonus
  if (world.legitimacy.faith < 40) {
    // High bonus for faith actions when faith legitimacy is low
    if (action.satisfies?.includes('faith') || action.id.includes('faith') || action.id.includes('religious')) {
      bonus += (40 - world.legitimacy.faith) / 10; // 0-4 bonus
      reason = `faith legitimacy crisis (${world.legitimacy.faith})`;
    }
  }

  // 2. Regional heresy crisis bonus
  const controlledRegions = world.regions.filter(r => r.controlled);
  const hereticalRegions = controlledRegions.filter(r => r.heresy > 60);
  
  if (hereticalRegions.length > 0) {
    const maxHeresy = Math.max(...hereticalRegions.map(r => r.heresy));
    if (action.satisfies?.includes('faith') || action.id.includes('heresy') || action.id.includes('religious')) {
      bonus += (maxHeresy - 60) / 15; // 0-2.7 bonus for high heresy
      reason = `heresy crisis (max heresy: ${maxHeresy})`;
    }
  }

  // 3. High piety opportunity bonus
  const piousRegions = controlledRegions.filter(r => r.piety > 70);
  
  if (piousRegions.length > 0) {
    const maxPiety = Math.max(...piousRegions.map(r => r.piety));
    if (action.satisfies?.includes('faith') || action.id.includes('religious') || action.id.includes('pilgrimage')) {
      bonus += (maxPiety - 70) / 20; // 0-1.5 bonus for leveraging high piety
      reason = `high piety opportunity (max piety: ${maxPiety})`;
    }
  }

  // 4. Trait-based bonuses
  if (world.traits.includes('heresy_pressure')) {
    if (action.satisfies?.includes('faith') || action.id.includes('heresy') || action.id.includes('inquisition')) {
      bonus += 2; // Significant bonus for addressing heresy pressure
      reason = 'heresy pressure trait';
    }
  }

  // Log faith influence decisions
  if (bonus > 0) {
    console.log(`[Faith Influence] Action "${action.label}" gains +${bonus.toFixed(1)} utility (${reason})`);
  }

  return bonus;
}