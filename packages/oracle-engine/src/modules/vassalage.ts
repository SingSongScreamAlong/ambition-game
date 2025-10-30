import { WorldState, Resources, Legitimacy } from '../types/index.js';
import { FactionAmbition } from './factions.js';
import { PlayerInfluence } from './influence.js';
import { Treaty } from './diplomacy.js';

export interface VassalObligation {
  type: 'tribute' | 'levy' | 'call_to_arms' | 'no_foreign_treaties' | 'attend_court';
  value?: number; // percentage for tribute/levy
  frequency?: number; // ticks between obligations
  description: string;
}

export interface VassalState {
  vassalId: string; // faction ID
  lordId: string; // 'player' or faction ID
  obligations: VassalObligation[];
  loyaltyScore: number; // 0-100
  lastTribute: number; // tick when last tribute paid
  lastLevy: number; // tick when last levy called
  rebellionRisk: number; // 0-100
  establishedAt: number; // tick when vassalage established
}

export interface LegitimacyRequirement {
  law?: number;
  lineage?: number;
  might?: number;
  faith?: number;
  description: string;
}

export interface Title {
  id: string;
  name: string;
  description: string;
  requirements: LegitimacyRequirement;
  benefits: {
    legitimacyBonus?: Partial<Legitimacy>;
    influenceBonus?: number;
    specialActions?: string[];
  };
  unlocked: boolean;
}

const AVAILABLE_TITLES: Title[] = [
  {
    id: 'duke',
    name: 'Duke/Duchess',
    description: 'Noble title allowing governance of multiple regions',
    requirements: {
      law: 40,
      description: 'Establish legal authority over 40 law legitimacy'
    },
    benefits: {
      legitimacyBonus: { law: 5 },
      influenceBonus: 10,
      specialActions: ['delegate_governance']
    },
    unlocked: false
  },
  {
    id: 'king',
    name: 'King/Queen',
    description: 'Royal authority to rule and command vassals',
    requirements: {
      law: 60,
      lineage: 30,
      description: 'Combine legal authority (60) with noble blood (30)'
    },
    benefits: {
      legitimacyBonus: { law: 10, lineage: 5 },
      influenceBonus: 25,
      specialActions: ['royal_decree', 'call_vassals']
    },
    unlocked: false
  },
  {
    id: 'emperor',
    name: 'Emperor/Empress',
    description: 'Supreme authority over multiple kingdoms',
    requirements: {
      law: 80,
      lineage: 50,
      might: 60,
      description: 'Supreme legal authority (80), noble lineage (50), and military might (60)'
    },
    benefits: {
      legitimacyBonus: { law: 15, lineage: 10, might: 10 },
      influenceBonus: 50,
      specialActions: ['imperial_edict', 'grand_campaign']
    },
    unlocked: false
  },
  {
    id: 'high_priest',
    name: 'High Priest/Priestess',
    description: 'Supreme religious authority',
    requirements: {
      faith: 70,
      description: 'Achieve supreme religious legitimacy (70)'
    },
    benefits: {
      legitimacyBonus: { faith: 15 },
      influenceBonus: 20,
      specialActions: ['holy_decree', 'call_crusade']
    },
    unlocked: false
  },
  {
    id: 'warlord',
    name: 'Warlord/Warchief',
    description: 'Authority through military might alone',
    requirements: {
      might: 80,
      description: 'Dominate through pure military might (80)'
    },
    benefits: {
      legitimacyBonus: { might: 20 },
      influenceBonus: 15,
      specialActions: ['warband_rally', 'intimidate']
    },
    unlocked: false
  },
  {
    id: 'archon',
    name: 'Archon/Archoness',
    description: 'Scholarly ruler of enlightened realm',
    requirements: {
      law: 50,
      faith: 30,
      description: 'Balance legal scholarship (50) with wisdom (30 faith)'
    },
    benefits: {
      legitimacyBonus: { law: 8, faith: 5 },
      influenceBonus: 18,
      specialActions: ['scholarly_edict', 'convene_council']
    },
    unlocked: false
  }
];

/**
 * Check which titles the player is eligible for
 */
export function checkTitleEligibility(legitimacy: Legitimacy): Title[] {
  return AVAILABLE_TITLES.map(title => {
    const req = title.requirements;
    const eligible = 
      (!req.law || legitimacy.law >= req.law) &&
      (!req.lineage || legitimacy.lineage >= req.lineage) &&
      (!req.might || legitimacy.might >= req.might) &&
      (!req.faith || legitimacy.faith >= req.faith);
    
    return {
      ...title,
      unlocked: eligible
    };
  });
}

/**
 * Award a title to the player
 */
export function awardTitle(
  titleId: string,
  world: WorldState,
  currentTitles: string[]
): { 
  success: boolean; 
  newTitle?: Title; 
  legitimacyChanges?: Partial<Legitimacy>;
  error?: string;
} {
  const title = AVAILABLE_TITLES.find(t => t.id === titleId);
  if (!title) {
    return { success: false, error: 'Title not found' };
  }
  
  if (currentTitles.includes(titleId)) {
    return { success: false, error: 'Already holds this title' };
  }
  
  const eligibleTitles = checkTitleEligibility(world.legitimacy);
  const eligibleTitle = eligibleTitles.find(t => t.id === titleId);
  
  if (!eligibleTitle?.unlocked) {
    return { success: false, error: 'Not eligible for this title' };
  }
  
  return {
    success: true,
    newTitle: eligibleTitle,
    legitimacyChanges: title.benefits.legitimacyBonus
  };
}

/**
 * Create vassalage relationship
 */
export function createVassalage(
  vassalFactionId: string,
  obligations: VassalObligation[],
  currentTick: number
): VassalState {
  return {
    vassalId: vassalFactionId,
    lordId: 'player',
    obligations,
    loyaltyScore: 50, // Start neutral
    lastTribute: currentTick,
    lastLevy: currentTick,
    rebellionRisk: 0,
    establishedAt: currentTick
  };
}

/**
 * Calculate vassal loyalty based on various factors
 */
export function calculateVassalLoyalty(
  vassal: VassalState,
  world: WorldState,
  playerInfluence: PlayerInfluence,
  factionAmbition: FactionAmbition
): number {
  let loyalty = vassal.loyaltyScore;
  
  // Base influence with the faction
  const influenceScore = playerInfluence.favor[vassal.vassalId] || 0;
  loyalty += influenceScore * 0.3;
  
  // Fear can substitute for loyalty to some degree
  const fearScore = playerInfluence.fear[vassal.vassalId] || 0;
  loyalty += fearScore * 0.15;
  
  // Check if obligations are being honored
  const ticksSinceEstablished = world.tick - vassal.establishedAt;
  
  // Tribute obligations
  const tributeObligation = vassal.obligations.find(o => o.type === 'tribute');
  if (tributeObligation && tributeObligation.frequency) {
    const expectedTributes = Math.floor(ticksSinceEstablished / tributeObligation.frequency);
    const actualTributes = Math.floor((world.tick - vassal.lastTribute) / tributeObligation.frequency);
    const tributeMissed = expectedTributes - actualTributes;
    loyalty -= tributeMissed * 5; // -5 per missed tribute
  }
  
  // Regional conditions in their territory
  const vassalFaction = world.factions.find(f => f.id === vassal.vassalId);
  if (vassalFaction) {
    for (const regionId of vassalFaction.regions) {
      const region = world.regions.find(r => r.id === regionId);
      if (region) {
        // Low lawfulness in their regions breeds discontent
        if (region.lawfulness < 30) {
          loyalty -= 5;
        }
        // High unrest in their regions makes them restless
        if (region.unrest > 70) {
          loyalty -= 8;
        }
      }
    }
  }
  
  // Faction personality affects loyalty
  const profile = factionAmbition.profile;
  
  // Freedom-loving factions naturally resist vassalage
  loyalty -= profile.freedom * 20;
  
  // Virtue factions are more loyal if they respect you
  if (profile.virtue > 0.4 && playerInfluence.reputation > 20) {
    loyalty += 10;
  }
  
  // Power factions respect strength
  if (profile.power > 0.4 && fearScore > 30) {
    loyalty += 8;
  }
  
  return Math.max(0, Math.min(100, loyalty));
}

/**
 * Calculate rebellion risk
 */
export function calculateRebellionRisk(
  vassal: VassalState,
  loyalty: number,
  factionAmbition: FactionAmbition
): number {
  let risk = 100 - loyalty; // Base risk inverse of loyalty
  
  // Freedom-focused factions more likely to rebel
  risk += factionAmbition.profile.freedom * 30;
  
  // Power-focused factions rebel if they think they can win
  risk += factionAmbition.profile.power * 15;
  
  // Virtue factions less likely to break oaths
  risk -= factionAmbition.profile.virtue * 10;
  
  // Time factor - longer vassalage breeds resentment
  const yearsAsVassal = Math.floor((Date.now() - vassal.establishedAt) / 10); // Rough years
  risk += yearsAsVassal * 2;
  
  return Math.max(0, Math.min(100, risk));
}

/**
 * Process vassal obligations (called each tick)
 */
export function processVassalObligations(
  vassals: VassalState[],
  world: WorldState,
  playerInfluence: PlayerInfluence,
  factionAmbitions: FactionAmbition[]
): {
  updatedVassals: VassalState[];
  resourceGains: Partial<Resources>;
  events: string[];
  rebellions: string[]; // faction IDs that rebelled
} {
  const updatedVassals: VassalState[] = [];
  const resourceGains: Partial<Resources> = {};
  const events: string[] = [];
  const rebellions: string[] = [];
  
  for (const vassal of vassals) {
    const factionAmbition = factionAmbitions.find(fa => fa.factionId === vassal.vassalId);
    if (!factionAmbition) continue;
    
    const updatedVassal = { ...vassal };
    
    // Calculate current loyalty and rebellion risk
    const loyalty = calculateVassalLoyalty(vassal, world, playerInfluence, factionAmbition);
    const rebellionRisk = calculateRebellionRisk(vassal, loyalty, factionAmbition);
    
    updatedVassal.loyaltyScore = loyalty;
    updatedVassal.rebellionRisk = rebellionRisk;
    
    // Check for rebellion
    if (rebellionRisk > 80 && Math.random() < 0.1) {
      rebellions.push(vassal.vassalId);
      events.push(`${factionAmbition.factionId} has rebelled against your rule!`);
      continue; // Skip processing obligations for rebels
    }
    
    // Process tribute obligations
    const tributeObligation = vassal.obligations.find(o => o.type === 'tribute');
    if (tributeObligation && tributeObligation.frequency) {
      const ticksSinceLastTribute = world.tick - vassal.lastTribute;
      if (ticksSinceLastTribute >= tributeObligation.frequency) {
        const tributeRate = tributeObligation.value || 0.15;
        const vassalFaction = world.factions.find(f => f.id === vassal.vassalId);
        
        if (vassalFaction) {
          // Calculate tribute based on vassal's power/wealth
          const tributeAmount = Math.floor(vassalFaction.power * tributeRate * 2);
          resourceGains.gold = (resourceGains.gold || 0) + tributeAmount;
          
          updatedVassal.lastTribute = world.tick;
          events.push(`Received ${tributeAmount} gold tribute from ${vassalFaction.name}`);
        }
      }
    }
    
    updatedVassals.push(updatedVassal);
  }
  
  return {
    updatedVassals,
    resourceGains,
    events,
    rebellions
  };
}

/**
 * Call vassals to arms (military levy)
 */
export function callVassalsToArms(
  vassals: VassalState[],
  world: WorldState,
  factionAmbitions: FactionAmbition[]
): {
  totalLevyStrength: number;
  responseByVassal: Record<string, { responded: boolean; strength: number; reason: string }>;
} {
  const responseByVassal: Record<string, { responded: boolean; strength: number; reason: string }> = {};
  let totalLevyStrength = 0;
  
  for (const vassal of vassals) {
    const factionAmbition = factionAmbitions.find(fa => fa.factionId === vassal.vassalId);
    const faction = world.factions.find(f => f.id === vassal.vassalId);
    
    if (!factionAmbition || !faction) continue;
    
    const levyObligation = vassal.obligations.find(o => o.type === 'levy');
    if (!levyObligation) {
      responseByVassal[vassal.vassalId] = {
        responded: false,
        strength: 0,
        reason: 'No military obligation'
      };
      continue;
    }
    
    const levyRate = levyObligation.value || 0.25;
    const maxLevy = Math.floor(faction.power * levyRate);
    
    // Check if they'll respond based on loyalty
    const willRespond = vassal.loyaltyScore > 30 && vassal.rebellionRisk < 70;
    
    if (willRespond) {
      const actualLevy = Math.floor(maxLevy * (vassal.loyaltyScore / 100));
      totalLevyStrength += actualLevy;
      
      responseByVassal[vassal.vassalId] = {
        responded: true,
        strength: actualLevy,
        reason: `Sent ${actualLevy} troops (${(levyRate * 100).toFixed(0)}% obligation)`
      };
    } else {
      responseByVassal[vassal.vassalId] = {
        responded: false,
        strength: 0,
        reason: vassal.rebellionRisk > 70 ? 'Too disloyal to respond' : 'Refused the call'
      };
    }
  }
  
  return {
    totalLevyStrength,
    responseByVassal
  };
}

/**
 * Get legitimacy requirements for vassalizing a faction
 */
export function getVassalizationRequirements(
  targetFaction: FactionAmbition,
  world: WorldState
): LegitimacyRequirement[] {
  const requirements: LegitimacyRequirement[] = [];
  const profile = targetFaction.profile;
  
  // Base requirement: some form of legitimacy
  requirements.push({
    law: 30,
    description: 'Minimum legal authority to claim lordship'
  });
  
  // Power factions require might
  if (profile.power > 0.4) {
    requirements.push({
      might: 50,
      description: 'Power factions respect only strength'
    });
  }
  
  // Faith factions may require religious authority
  if (profile.faith > 0.4) {
    requirements.push({
      faith: 40,
      description: 'Religious factions require spiritual legitimacy'
    });
  }
  
  // Virtue factions require high law or lineage
  if (profile.virtue > 0.4) {
    requirements.push({
      law: 60,
      lineage: 40,
      description: 'Virtuous factions require either strong legal authority (60) OR noble bloodline (40)'
    });
  }
  
  return requirements;
}

/**
 * Check if player can vassalize a faction
 */
export function canVassalize(
  targetFaction: FactionAmbition,
  world: WorldState,
  playerTitles: string[]
): { canVassalize: boolean; reason: string; requirements?: LegitimacyRequirement[] } {
  const requirements = getVassalizationRequirements(targetFaction, world);
  const legitimacy = world.legitimacy;
  
  // Check if player has any noble title
  const hasNobleTitle = playerTitles.some(title => 
    ['duke', 'king', 'emperor', 'high_priest', 'archon'].includes(title)
  );
  
  if (!hasNobleTitle) {
    return {
      canVassalize: false,
      reason: 'No noble title - must be at least Duke/Duchess to take vassals',
      requirements
    };
  }
  
  // Check each requirement set (any one can satisfy)
  for (const req of requirements) {
    const meetsReq = 
      (!req.law || legitimacy.law >= req.law) &&
      (!req.lineage || legitimacy.lineage >= req.lineage) &&
      (!req.might || legitimacy.might >= req.might) &&
      (!req.faith || legitimacy.faith >= req.faith);
    
    if (meetsReq) {
      return { canVassalize: true, reason: 'Legitimacy requirements met' };
    }
  }
  
  return {
    canVassalize: false,
    reason: 'Insufficient legitimacy',
    requirements
  };
}