import { WorldState, ActionProposal, Resources, Faction } from '../types/index.js';
import { FactionAmbition, FactionRelationship } from './factions.js';
import { FactionAction, planFactionActions, executeFactionAction, FactionPlanningContext } from './factionPlanner.js';

/**
 * Advance world state by one tick with simple economic and political drift
 */
export function tick(
  world: WorldState, 
  resolvedActions: ActionProposal[] = [],
  factionAmbitions?: FactionAmbition[],
  factionRelationships?: FactionRelationship[]
): WorldState {
  // Create deep copy of world state
  const newWorld: WorldState = JSON.parse(JSON.stringify(world));
  newWorld.tick += 1;

  // Apply resolved actions first
  for (const action of resolvedActions) {
    applyActionEffects(newWorld, action);
  }

  // Apply faction actions if faction system is active
  if (factionAmbitions && factionRelationships) {
    const factionResults = processFactionTurn(newWorld, factionAmbitions, factionRelationships);
    Object.assign(newWorld, factionResults.updatedWorld);
    // Store faction events in world traits for event generation
    if (factionResults.factionEvents.length > 0) {
      newWorld.traits.push('faction_activity');
      (newWorld as any).factionEvents = factionResults.factionEvents;
    }
  }

  // Apply natural drift
  applyEconomicDrift(newWorld);
  applyPoliticalDrift(newWorld);
  applyRegionalDrift(newWorld);
  applyJusticeAndLawDrift(newWorld);
  applyFaithAndOmensDrift(newWorld);
  applyFactionDrift(newWorld);

  return newWorld;
}

/**
 * Apply effects of a resolved action to the world state
 */
function applyActionEffects(world: WorldState, action: ActionProposal): void {
  // Apply costs
  if (action.costs) {
    for (const [resource, cost] of Object.entries(action.costs)) {
      const key = resource as keyof Resources;
      if (world.resources[key] !== undefined) {
        world.resources[key] = Math.max(0, world.resources[key] - cost);
      }
    }
  }

  // Apply rewards
  if (action.rewards) {
    for (const [resource, reward] of Object.entries(action.rewards)) {
      const key = resource as keyof Resources;
      if (world.resources[key] !== undefined) {
        world.resources[key] += reward;
      }
    }
  }

  // Apply trait changes based on action type
  if (action.satisfies.includes('people')) {
    world.people.loyalty = Math.min(1.0, world.people.loyalty + 0.1);
    world.people.unrest = Math.max(0, world.people.unrest - 0.05);
  }

  if (action.satisfies.includes('army')) {
    world.forces.units += 20;
    world.forces.morale = Math.min(1.0, world.forces.morale + 0.05);
  }

  if (action.satisfies.includes('land')) {
    // Find an uncontrolled region to control
    const uncontrolled = world.regions.find(r => !r.controlled);
    if (uncontrolled) {
      uncontrolled.controlled = true;
      // Remove from faction control
      world.factions.forEach(faction => {
        faction.regions = faction.regions.filter(id => id !== uncontrolled.id);
      });
    }
  }

  // Add specific traits based on action
  if (action.id.includes('charity')) {
    if (!world.traits.includes('generous')) {
      world.traits.push('generous');
    }
  }

  if (action.id.includes('conquest')) {
    if (!world.traits.includes('conqueror')) {
      world.traits.push('conqueror');
    }
    // Conquest may increase unrest
    world.people.unrest = Math.min(1.0, world.people.unrest + 0.1);
  }
}

/**
 * Apply economic drift - resources change over time
 */
function applyEconomicDrift(world: WorldState): void {
  // Basic resource production from controlled regions
  const controlledRegions = world.regions.filter(r => r.controlled);
  
  for (const region of controlledRegions) {
    // Add region production to world resources
    if (region.resources.grain) {
      world.resources.grain += Math.floor(region.resources.grain * 0.1);
    }
    if (region.resources.gold) {
      world.resources.gold += Math.floor(region.resources.gold * 0.05);
    }
    if (region.resources.iron) {
      world.resources.iron += Math.floor(region.resources.iron * 0.05);
    }
    if (region.resources.wood) {
      world.resources.wood += Math.floor(region.resources.wood * 0.1);
    }
    if (region.resources.stone) {
      world.resources.stone += Math.floor(region.resources.stone * 0.05);
    }
  }

  // Basic consumption/upkeep
  world.resources.grain = Math.max(0, world.resources.grain - Math.floor(world.people.population / 100));
  world.resources.gold = Math.max(0, world.resources.gold - Math.floor(world.forces.units * 0.5));

  // Price drift based on scarcity
  adjustResourceScarcity(world);
}

/**
 * Apply political drift - loyalty, unrest, faction relations change
 */
function applyPoliticalDrift(world: WorldState): void {
  // Natural loyalty decay if no recent positive actions
  world.people.loyalty = Math.max(0.1, world.people.loyalty - 0.02);

  // Unrest increases if loyalty is low or resources are scarce
  if (world.people.loyalty < 0.4 || world.resources.grain < 20) {
    world.people.unrest = Math.min(1.0, world.people.unrest + 0.05);
  } else {
    world.people.unrest = Math.max(0, world.people.unrest - 0.02);
  }

  // Force morale affected by supply and recent battles
  if (world.forces.supply < 0.5) {
    world.forces.morale = Math.max(0.1, world.forces.morale - 0.05);
  }

  // Supply slowly regenerates
  world.forces.supply = Math.min(1.0, world.forces.supply + 0.1);
}

/**
 * Apply regional changes
 */
function applyRegionalDrift(world: WorldState): void {
  for (const region of world.regions) {
    // Security changes based on control and unrest
    if (region.controlled) {
      region.security = Math.min(1.0, region.security + 0.02);
    } else {
      region.security = Math.max(0.1, region.security - 0.01);
    }

    // Population loyalty in regions
    if (world.people.unrest > 0.5) {
      region.people.loyalty = Math.max(0.1, region.people.loyalty - 0.03);
    }

    // Regional unrest propagation
    if (region.people.loyalty < 0.3) {
      region.people.unrest = Math.min(1.0, region.people.unrest + 0.05);
    }

    // Drift lawfulness and unrest toward 50 if unmodified
    driftTowardMiddle(region, 'lawfulness', 50, 1);
    driftTowardMiddle(region, 'unrest', 50, 1);
    
    // Drift piety and heresy toward 50 if unmodified
    driftTowardMiddle(region, 'piety', 50, 1);
    driftTowardMiddle(region, 'heresy', 50, 1);
  }
}

/**
 * Helper function to drift a value toward a target
 */
function driftTowardMiddle(region: any, property: string, target: number, rate: number): void {
  const current = region[property];
  if (current < target) {
    region[property] = Math.min(target, current + rate);
  } else if (current > target) {
    region[property] = Math.max(target, current - rate);
  }
}

/**
 * Apply Justice & Law system changes
 */
function applyJusticeAndLawDrift(world: WorldState): void {
  for (const region of world.regions) {
    // Only apply to controlled regions
    if (!region.controlled) continue;
    
    // Lawfulness decays slowly if law legitimacy < 40
    if (world.legitimacy.law < 40) {
      region.lawfulness = Math.max(0, region.lawfulness - 2);
    }
    
    // Low lawfulness (<30) raises crime risk
    if (region.lawfulness < 30) {
      // Add crime trait for event generation
      if (!world.traits.includes('high_crime')) {
        world.traits.push('high_crime');
      }
      // Crime affects regional security and loyalty
      region.security = Math.max(0.1, region.security - 0.05);
      region.people.loyalty = Math.max(0.1, region.people.loyalty - 0.03);
    } else {
      // Remove crime trait if lawfulness improves
      world.traits = world.traits.filter(t => t !== 'high_crime');
    }
    
    // High lawfulness (>70) raises upkeep (bureaucracy cost)
    if (region.lawfulness > 70) {
      // Administrative costs for maintaining law and order
      const bureaucracyCost = Math.floor((region.lawfulness - 70) * 0.5);
      world.resources.gold = Math.max(0, world.resources.gold - bureaucracyCost);
      
      // Add bureaucracy trait
      if (!world.traits.includes('high_bureaucracy')) {
        world.traits.push('high_bureaucracy');
      }
    } else {
      world.traits = world.traits.filter(t => t !== 'high_bureaucracy');
    }
  }
}

/**
 * Apply faction relationship and power changes
 */
function applyFactionDrift(world: WorldState): void {
  for (const faction of world.factions) {
    // Faction power slowly changes
    if (faction.regions.length === 0) {
      faction.power = Math.max(1, faction.power - 5);
    } else {
      faction.power = Math.min(100, faction.power + faction.regions.length);
    }

    // Stance can drift based on player actions and traits
    if (world.traits.includes('conqueror') && faction.stance === 'neutral') {
      faction.stance = 'hostile';
    }

    if (world.traits.includes('generous') && faction.stance === 'hostile') {
      // Small chance to improve relations
      if (Math.random() < 0.1) {
        faction.stance = 'neutral';
      }
    }
  }
}

/**
 * Adjust resource availability and create scarcity events
 */
function adjustResourceScarcity(world: WorldState): void {
  // Simple scarcity model
  if (world.resources.iron < 20) {
    // Iron scarcity - could trigger generator events
    world.traits.push('iron_scarcity');
  } else {
    world.traits = world.traits.filter(t => t !== 'iron_scarcity');
  }

  if (world.resources.grain < 30) {
    world.traits.push('grain_shortage');
    world.people.unrest = Math.min(1.0, world.people.unrest + 0.1);
  } else {
    world.traits = world.traits.filter(t => t !== 'grain_shortage');
  }

  // Seasonal effects
  if (world.tick % 4 === 3) { // Winter
    world.traits.push('winter');
    world.resources.grain = Math.max(0, world.resources.grain - 10);
  } else {
    world.traits = world.traits.filter(t => t !== 'winter');
  }
}

/**
 * Apply Faith & Omens system changes
 */
function applyFaithAndOmensDrift(world: WorldState): void {
  for (const region of world.regions) {
    // Only apply effects to controlled regions
    if (!region.controlled) continue;
    
    // If legitimacy.faith < 40 → piety decreases, heresy increases
    if (world.legitimacy.faith < 40) {
      const pietyLoss = Math.floor(Math.random() * 3) + 1; // 1-3 points
      region.piety = Math.max(0, region.piety - pietyLoss);
      region.heresy = Math.min(100, region.heresy + 1);
    }
    
    // If piety > 70 → social cohesion reduces unrest, but festival costs increase
    if (region.piety > 70) {
      // Social cohesion benefit
      region.unrest = Math.max(0, region.unrest - 1);
      
      // Festival/charity upkeep costs
      const festivalsUpkeep = 10;
      world.resources.gold = Math.max(0, world.resources.gold - festivalsUpkeep);
    }
    
    // If heresy > 70 → spawn heresy_pressure trait and clergy stance penalties
    if (region.heresy > 70) {
      if (!world.traits.includes('heresy_pressure')) {
        world.traits.push('heresy_pressure');
      }
      
      // Reduce regional loyalty due to religious conflict
      region.people.loyalty = Math.max(0.1, region.people.loyalty - 0.05);
    } else {
      world.traits = world.traits.filter(t => t !== 'heresy_pressure');
    }
  }
}

/**
 * Process faction AI turn - plan and execute faction actions
 */
function processFactionTurn(
  world: WorldState,
  factionAmbitions: FactionAmbition[],
  factionRelationships: FactionRelationship[]
): {
  updatedWorld: WorldState;
  updatedRelationships: FactionRelationship[];
  factionEvents: string[];
} {
  const updatedWorld = JSON.parse(JSON.stringify(world));
  const updatedRelationships = JSON.parse(JSON.stringify(factionRelationships));
  const factionEvents: string[] = [];
  const executedActions: FactionAction[] = [];

  // Process each faction's turn
  for (const factionAmbition of factionAmbitions) {
    const faction = updatedWorld.factions.find((f: Faction) => f.id === factionAmbition.factionId);
    if (!faction || factionAmbition.plannerCooldown > 0) continue;

    // Create planning context
    const context: FactionPlanningContext = {
      faction,
      ambition: factionAmbition,
      world: updatedWorld,
      relationships: updatedRelationships,
      availableActions: [],
      tick: updatedWorld.tick
    };

    // Plan faction actions
    const plannedActions = planFactionActions(context, updatedWorld.seed + updatedWorld.tick);
    
    // Execute the most probable action
    if (plannedActions.length === 0) continue;
    
    const bestAction = plannedActions.reduce((best, current) => 
      current.probability > best.probability ? current : best
    );

    if (bestAction && Math.random() < bestAction.probability) {
      const result = executeFactionAction(bestAction, updatedWorld, updatedRelationships);
      
      // Apply results
      Object.assign(updatedWorld, result.updatedWorld);
      Object.assign(updatedRelationships, result.updatedRelationships);
      
      // Record the action
      executedActions.push(bestAction);
      factionEvents.push(`${faction.name}: ${result.outcome}`);
      
      // Update faction ambition
      factionAmbition.lastAction = bestAction.id;
      factionAmbition.plannerCooldown = 2 + Math.floor(Math.random() * 3);
    }
  }

  // Apply diplomatic consequences
  processAIIPolitics(updatedWorld, updatedRelationships, executedActions);

  return {
    updatedWorld,
    updatedRelationships,
    factionEvents
  };
}

/**
 * Process inter-faction politics and relationship changes
 */
function processAIIPolitics(
  world: WorldState,
  relationships: FactionRelationship[],
  executedActions: FactionAction[]
): void {
  // Process relationship changes based on faction actions
  for (const action of executedActions) {
    if (action.targetId) {
      const relationship = relationships.find(rel =>
        (rel.factionA === action.factionId && rel.factionB === action.targetId) ||
        (rel.factionB === action.factionId && rel.factionA === action.targetId)
      );

      if (relationship) {
        // Aggressive actions damage relationships
        if (action.type === 'military' && action.description.includes('raid')) {
          relationship.strength = Math.max(0, relationship.strength - 0.2);
          relationship.stance = relationship.strength < 0.3 ? 'hostile' : relationship.stance;
        }
        
        // Trade actions improve relationships
        if (action.type === 'trade') {
          relationship.strength = Math.min(1, relationship.strength + 0.1);
          relationship.stance = relationship.strength > 0.7 ? 'allied' : 'trade';
        }
        
        // Diplomatic actions have moderate positive effects
        if (action.type === 'diplomatic') {
          relationship.strength = Math.min(1, relationship.strength + 0.15);
          if (relationship.strength > 0.8) {
            relationship.stance = 'allied';
          }
        }
      }
    }
  }

  // Apply power balance pressure
  const totalPower = world.factions.reduce((sum, f) => sum + f.power, 0);
  
  for (const faction of world.factions) {
    const powerShare = faction.power / totalPower;
    
    // If a faction becomes too powerful (>40%), others become hostile
    if (powerShare > 0.4) {
      relationships.forEach(rel => {
        if (rel.factionA === faction.id || rel.factionB === faction.id) {
          const otherFactionId = rel.factionA === faction.id ? rel.factionB : rel.factionA;
          const otherFaction = world.factions.find(f => f.id === otherFactionId);
          
          if (otherFaction && otherFaction.power < faction.power * 0.6) {
            rel.strength = Math.max(0, rel.strength - 0.1);
            if (rel.stance === 'neutral') {
              rel.stance = 'hostile';
            }
          }
        }
      });
    }
  }

  // Coalition formation against dominant factions
  const dominantFactions = world.factions.filter(f => f.power / totalPower > 0.35);
  
  if (dominantFactions.length > 0) {
    // Encourage alliances among weaker factions
    const weakerFactions = world.factions.filter(f => f.power / totalPower < 0.2);
    
    for (let i = 0; i < weakerFactions.length; i++) {
      for (let j = i + 1; j < weakerFactions.length; j++) {
        const rel = relationships.find(r =>
          (r.factionA === weakerFactions[i]?.id && r.factionB === weakerFactions[j]?.id) ||
          (r.factionB === weakerFactions[i]?.id && r.factionA === weakerFactions[j]?.id)
        );
        
        if (rel && rel.stance === 'neutral') {
          rel.strength = Math.min(1, rel.strength + 0.1);
          if (rel.strength > 0.6) {
            rel.stance = 'allied';
          }
        }
      }
    }
  }
}