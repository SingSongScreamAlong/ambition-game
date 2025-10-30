import { WorldState, Faction, ActionProposal } from '../types/index.js';
import { FactionAmbition } from './factions.js';

export interface PlayerInfluence {
  reputation: number; // -100..+100 global moral reputation
  favor: Record<string, number>; // -100..+100 per faction
  fear: Record<string, number>; // -100..+100 per faction (from might/war)
  culture: Record<string, number>; // -100..+100 per faction (shared customs)
  lastUpdated: number; // tick number
}

export interface InfluenceChange {
  type: 'reputation' | 'favor' | 'fear' | 'culture';
  target?: string; // faction ID for non-reputation changes
  delta: number;
  reason: string;
}

export interface InfluenceEvent {
  tick: number;
  changes: InfluenceChange[];
  description: string;
}

/**
 * Initialize player influence for a new world
 */
export function initializePlayerInfluence(world: WorldState): PlayerInfluence {
  const favor: Record<string, number> = {};
  const fear: Record<string, number> = {};
  const culture: Record<string, number> = {};
  
  // Initialize with neutral influence toward all factions
  for (const faction of world.factions) {
    favor[faction.id] = 0;
    fear[faction.id] = 0;
    culture[faction.id] = 0;
  }
  
  return {
    reputation: 0, // Start neutral
    favor,
    fear,
    culture,
    lastUpdated: world.tick
  };
}

/**
 * Apply influence changes from player actions
 */
export function applyActionInfluence(
  influence: PlayerInfluence,
  action: ActionProposal,
  world: WorldState,
  factionAmbitions: FactionAmbition[]
): { updatedInfluence: PlayerInfluence; events: InfluenceEvent[] } {
  const changes: InfluenceChange[] = [];
  const updatedInfluence = JSON.parse(JSON.stringify(influence));
  
  // Analyze action for influence effects
  if (action.satisfies.includes('law') || action.description.toLowerCase().includes('justice')) {
    changes.push({
      type: 'reputation',
      delta: 5,
      reason: 'Promoted justice and law'
    });
    
    // Virtue-focused factions appreciate law and order
    for (const factionAmbition of factionAmbitions) {
      if (factionAmbition.profile.virtue > 0.3) {
        changes.push({
          type: 'favor',
          target: factionAmbition.factionId,
          delta: 3,
          reason: 'Appreciated lawful actions'
        });
      }
    }
  }
  
  if (action.satisfies.includes('army') || action.description.toLowerCase().includes('military')) {
    // Military actions increase fear
    for (const factionAmbition of factionAmbitions) {
      const fearIncrease = factionAmbition.profile.power > 0.4 ? 2 : 5; // Power factions less intimidated
      changes.push({
        type: 'fear',
        target: factionAmbition.factionId,
        delta: fearIncrease,
        reason: 'Military buildup'
      });
    }
    
    // Reduce reputation if aggressive
    if (action.description.toLowerCase().includes('conquest') || 
        action.description.toLowerCase().includes('raid')) {
      changes.push({
        type: 'reputation',
        delta: -8,
        reason: 'Aggressive military action'
      });
    }
  }
  
  if (action.description.toLowerCase().includes('trade') || 
      action.description.toLowerCase().includes('merchant')) {
    // Trade actions increase favor with wealth-focused factions
    for (const factionAmbition of factionAmbitions) {
      if (factionAmbition.profile.wealth > 0.3) {
        changes.push({
          type: 'favor',
          target: factionAmbition.factionId,
          delta: 4,
          reason: 'Promoted trade and commerce'
        });
      }
    }
  }
  
  if (action.description.toLowerCase().includes('festival') || 
      action.description.toLowerCase().includes('ceremony')) {
    changes.push({
      type: 'reputation',
      delta: 3,
      reason: 'Celebrated with the people'
    });
    
    // Cultural events increase culture with all factions
    for (const factionAmbition of factionAmbitions) {
      changes.push({
        type: 'culture',
        target: factionAmbition.factionId,
        delta: 2,
        reason: 'Shared cultural celebration'
      });
    }
  }
  
  if (action.description.toLowerCase().includes('temple') || 
      action.description.toLowerCase().includes('faith')) {
    // Faith actions benefit religious factions
    for (const factionAmbition of factionAmbitions) {
      if (factionAmbition.profile.faith > 0.3) {
        changes.push({
          type: 'favor',
          target: factionAmbition.factionId,
          delta: 6,
          reason: 'Promoted religious values'
        });
        changes.push({
          type: 'culture',
          target: factionAmbition.factionId,
          delta: 3,
          reason: 'Shared religious practices'
        });
      }
    }
  }
  
  // Apply all changes
  for (const change of changes) {
    switch (change.type) {
      case 'reputation':
        updatedInfluence.reputation = Math.max(-100, Math.min(100, 
          updatedInfluence.reputation + change.delta));
        break;
      
      case 'favor':
        if (change.target) {
          updatedInfluence.favor[change.target] = Math.max(-100, Math.min(100,
            (updatedInfluence.favor[change.target] || 0) + change.delta));
        }
        break;
      
      case 'fear':
        if (change.target) {
          updatedInfluence.fear[change.target] = Math.max(-100, Math.min(100,
            (updatedInfluence.fear[change.target] || 0) + change.delta));
        }
        break;
      
      case 'culture':
        if (change.target) {
          updatedInfluence.culture[change.target] = Math.max(-100, Math.min(100,
            (updatedInfluence.culture[change.target] || 0) + change.delta));
        }
        break;
    }
  }
  
  updatedInfluence.lastUpdated = world.tick;
  
  const events: InfluenceEvent[] = changes.length > 0 ? [{
    tick: world.tick,
    changes,
    description: `${action.label} affected your standing in the realm`
  }] : [];
  
  return { updatedInfluence, events };
}

/**
 * Calculate composite influence score for a specific faction
 */
export function getInfluenceScore(
  influence: PlayerInfluence,
  factionId: string,
  factionAmbition: FactionAmbition
): number {
  const favor = influence.favor[factionId] || 0;
  const fear = influence.fear[factionId] || 0;
  const culture = influence.culture[factionId] || 0;
  const reputation = influence.reputation;
  
  // Weight factors based on faction personality
  const profile = factionAmbition.profile;
  
  // Power-focused factions respect fear more
  const fearWeight = profile.power * 0.6 + 0.2;
  
  // Virtue-focused factions value reputation highly
  const reputationWeight = profile.virtue * 0.8 + 0.3;
  
  // Faith/creation factions value culture
  const cultureWeight = (profile.faith + profile.creation) * 0.5 + 0.2;
  
  // Base favor weight
  const favorWeight = 0.7;
  
  // Peaceful factions dislike fear
  const peacefulModifier = (profile.modifiers.peaceful || 0) * -0.3;
  
  const compositeScore = 
    (favor * favorWeight) +
    (fear * (fearWeight + peacefulModifier)) +
    (culture * cultureWeight) +
    (reputation * reputationWeight * 0.3); // Reputation has global but moderate impact
  
  // Normalize to -100..+100 range
  return Math.max(-100, Math.min(100, compositeScore));
}

/**
 * Get influence summary for all factions
 */
export function getInfluenceSummary(
  influence: PlayerInfluence,
  factionAmbitions: FactionAmbition[]
): Record<string, {
  favor: number;
  fear: number;
  culture: number;
  composite: number;
  standing: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied';
}> {
  const summary: Record<string, any> = {};
  
  for (const factionAmbition of factionAmbitions) {
    const composite = getInfluenceScore(influence, factionAmbition.factionId, factionAmbition);
    
    let standing: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied';
    if (composite <= -60) standing = 'hostile';
    else if (composite <= -20) standing = 'unfriendly';
    else if (composite <= 20) standing = 'neutral';
    else if (composite <= 60) standing = 'friendly';
    else standing = 'allied';
    
    summary[factionAmbition.factionId] = {
      favor: influence.favor[factionAmbition.factionId] || 0,
      fear: influence.fear[factionAmbition.factionId] || 0,
      culture: influence.culture[factionAmbition.factionId] || 0,
      composite,
      standing
    };
  }
  
  return summary;
}

/**
 * Apply natural influence decay over time
 */
export function applyInfluenceDecay(influence: PlayerInfluence, world: WorldState): PlayerInfluence {
  const updated = JSON.parse(JSON.stringify(influence));
  
  // Reputation slowly decays toward neutral
  if (updated.reputation > 0) {
    updated.reputation = Math.max(0, updated.reputation - 1);
  } else if (updated.reputation < 0) {
    updated.reputation = Math.min(0, updated.reputation + 1);
  }
  
  // Fear decays faster than favor
  for (const factionId of Object.keys(updated.fear)) {
    const current = updated.fear[factionId];
    if (current > 0) {
      updated.fear[factionId] = Math.max(0, current - 2);
    } else if (current < 0) {
      updated.fear[factionId] = Math.min(0, current + 2);
    }
  }
  
  // Favor and culture decay slowly
  for (const factionId of Object.keys(updated.favor)) {
    const currentFavor = updated.favor[factionId];
    const currentCulture = updated.culture[factionId];
    
    if (currentFavor > 0) {
      updated.favor[factionId] = Math.max(0, currentFavor - 0.5);
    } else if (currentFavor < 0) {
      updated.favor[factionId] = Math.min(0, currentFavor + 0.5);
    }
    
    if (currentCulture > 0) {
      updated.culture[factionId] = Math.max(0, currentCulture - 0.3);
    } else if (currentCulture < 0) {
      updated.culture[factionId] = Math.min(0, currentCulture + 0.3);
    }
  }
  
  updated.lastUpdated = world.tick;
  return updated;
}

/**
 * Handle major influence events (wars, treaties, etc.)
 */
export function applyMajorInfluenceEvent(
  influence: PlayerInfluence,
  eventType: 'declare_war' | 'break_treaty' | 'vassalize' | 'liberation' | 'persecution',
  targetFactionId: string,
  factionAmbitions: FactionAmbition[]
): { updatedInfluence: PlayerInfluence; events: InfluenceEvent[] } {
  const changes: InfluenceChange[] = [];
  const updatedInfluence = JSON.parse(JSON.stringify(influence));
  
  switch (eventType) {
    case 'declare_war':
      changes.push({
        type: 'reputation',
        delta: -15,
        reason: 'Declared war'
      });
      
      changes.push({
        type: 'favor',
        target: targetFactionId,
        delta: -40,
        reason: 'Declared war against them'
      });
      
      changes.push({
        type: 'fear',
        target: targetFactionId,
        delta: 25,
        reason: 'Military threat'
      });
      
      // Other factions become wary
      for (const fa of factionAmbitions) {
        if (fa.factionId !== targetFactionId) {
          changes.push({
            type: 'fear',
            target: fa.factionId,
            delta: 8,
            reason: 'Witnessed aggression'
          });
        }
      }
      break;
    
    case 'break_treaty':
      changes.push({
        type: 'reputation',
        delta: -25,
        reason: 'Broke sacred treaties (oathbreaker)'
      });
      
      // All factions lose trust
      for (const fa of factionAmbitions) {
        changes.push({
          type: 'favor',
          target: fa.factionId,
          delta: -15,
          reason: 'Lost trust due to oathbreaking'
        });
      }
      break;
    
    case 'vassalize':
      changes.push({
        type: 'favor',
        target: targetFactionId,
        delta: -20,
        reason: 'Reduced to vassalage'
      });
      
      changes.push({
        type: 'fear',
        target: targetFactionId,
        delta: 15,
        reason: 'Demonstrated dominance'
      });
      
      // Other factions fear your growing power
      for (const fa of factionAmbitions) {
        if (fa.factionId !== targetFactionId) {
          changes.push({
            type: 'fear',
            target: fa.factionId,
            delta: 10,
            reason: 'Growing dominance'
          });
        }
      }
      break;
    
    case 'liberation':
      changes.push({
        type: 'reputation',
        delta: 20,
        reason: 'Liberated the oppressed'
      });
      
      // Freedom-loving factions appreciate this
      for (const fa of factionAmbitions) {
        if (fa.profile.freedom > 0.3) {
          changes.push({
            type: 'favor',
            target: fa.factionId,
            delta: 12,
            reason: 'Championed freedom'
          });
        }
      }
      break;
    
    case 'persecution':
      changes.push({
        type: 'reputation',
        delta: -20,
        reason: 'Persecuted innocent people'
      });
      
      // Virtue factions are appalled
      for (const fa of factionAmbitions) {
        if (fa.profile.virtue > 0.3) {
          changes.push({
            type: 'favor',
            target: fa.factionId,
            delta: -18,
            reason: 'Horrified by persecution'
          });
        }
      }
      break;
  }
  
  // Apply changes
  for (const change of changes) {
    switch (change.type) {
      case 'reputation':
        updatedInfluence.reputation = Math.max(-100, Math.min(100, 
          updatedInfluence.reputation + change.delta));
        break;
      
      case 'favor':
        if (change.target) {
          updatedInfluence.favor[change.target] = Math.max(-100, Math.min(100,
            (updatedInfluence.favor[change.target] || 0) + change.delta));
        }
        break;
      
      case 'fear':
        if (change.target) {
          updatedInfluence.fear[change.target] = Math.max(-100, Math.min(100,
            (updatedInfluence.fear[change.target] || 0) + change.delta));
        }
        break;
      
      case 'culture':
        if (change.target) {
          updatedInfluence.culture[change.target] = Math.max(-100, Math.min(100,
            (updatedInfluence.culture[change.target] || 0) + change.delta));
        }
        break;
    }
  }
  
  const events: InfluenceEvent[] = [{
    tick: updatedInfluence.lastUpdated,
    changes,
    description: `Major event: ${eventType.replace('_', ' ')} dramatically shifted your influence`
  }];
  
  return { updatedInfluence, events };
}