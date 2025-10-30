// Export all types
export * from './types/index.js';

// Export all modules
export * as intentParser from './modules/intentParser.js';
export * as graphForge from './modules/graphForge.js';
export * as worldGen from './modules/worldGen.js';
export * as dsl from './modules/dsl.js';
export * as planner from './modules/planner.js';
export * as sim from './modules/sim.js';
export * as events from './modules/events.js';

// Dynamic Ambition System modules
export * as ambition from './modules/ambition.js';
export * as goalGen from './modules/goalGen.js';
export * as ambitionMutation from './modules/ambitionMutation.js';
export * as dynamicPlanner from './modules/dynamicPlanner.js';

// NPC Faction Ambitions modules
export * as factions from './modules/factions.js';
export * as factionPlanner from './modules/factionPlanner.js';

// Player Influence & Diplomacy modules
export * as influence from './modules/influence.js';
export * as diplomacy from './modules/diplomacy.js';
export * as vassalage from './modules/vassalage.js';
export * as court from './modules/court.js';

// Export utility functions
export { createBasicKnowledgeBase } from './modules/dsl.js';
export { parseAmbition, mutateAmbition, getDominantDomains, checkDreamThresholds } from './modules/ambition.js';
export { generateDynamicGoals, generateThresholdNodes } from './modules/goalGen.js';
export { applyActionMutation, generateDreamReflectionEvents } from './modules/ambitionMutation.js';
export { proposeDynamic } from './modules/dynamicPlanner.js';

// Export faction functions
export { 
  generateFactionAmbitions, 
  generateFactionRelationships, 
  updateFactionAmbitions, 
  getFactionsByArchetype, 
  findPotentialAllies 
} from './modules/factions.js';
export { 
  planFactionActions, 
  executeFactionAction, 
  generateFactionEvents, 
  calculateFactionInfluence, 
  getFactionPowerBalance 
} from './modules/factionPlanner.js';

// Export influence functions
export {
  initializePlayerInfluence,
  applyActionInfluence,
  getInfluenceScore,
  getInfluenceSummary,
  applyInfluenceDecay,
  applyMajorInfluenceEvent
} from './modules/influence.js';

// Export diplomacy functions
export {
  initializeDiplomacyState,
  createPlayerOffer,
  evaluateOffer,
  updateTreatyStatus,
  breakTreaty,
  getPlayerTreaties,
  hasTreatyWith,
  getDiplomaticStatus
} from './modules/diplomacy.js';

// Export vassalage functions
export {
  checkTitleEligibility,
  awardTitle,
  createVassalage,
  calculateVassalLoyalty,
  calculateRebellionRisk,
  processVassalObligations,
  callVassalsToArms,
  canVassalize
} from './modules/vassalage.js';

// Export court functions
export {
  initializeCourtState,
  generateCourtEvents,
  processCourtChoice,
  updateCourtState
} from './modules/court.js';