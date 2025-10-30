import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initializePlayerInfluence,
  applyActionInfluence,
  getInfluenceScore,
  getInfluenceSummary,
  applyInfluenceDecay,
  applyMajorInfluenceEvent,
  PlayerInfluence
} from '../influence.js';
import { generateFactionAmbitions, FactionAmbition } from '../factions.js';
import { seed, WorldState } from '../worldGen.js';
import { parseAmbition } from '../ambition.js';
import { ActionProposal } from '../../types/index.js';

describe('Player Influence System', () => {
  let world: WorldState;
  let playerInfluence: PlayerInfluence;
  let factionAmbitions: FactionAmbition[];

  beforeEach(() => {
    const ambitionProfile = parseAmbition("I seek to build a prosperous kingdom through trade and diplomacy");
    world = seed(ambitionProfile, 54321);
    playerInfluence = initializePlayerInfluence(world);
    factionAmbitions = generateFactionAmbitions(world, world.seed);
  });

  describe('Initialization', () => {
    it('should initialize with neutral reputation', () => {
      expect(playerInfluence.reputation).toBe(0);
    });

    it('should initialize empty favor and fear records', () => {
      expect(Object.keys(playerInfluence.favor)).toEqual([]);
      expect(Object.keys(playerInfluence.fear)).toEqual([]);
      expect(Object.keys(playerInfluence.culture)).toEqual([]);
      expect(Object.keys(playerInfluence.history)).toEqual([]);
    });

    it('should have valid faction count', () => {
      expect(world.factions.length).toBeGreaterThan(0);
      expect(factionAmbitions.length).toBe(world.factions.length);
    });
  });

  describe('Action Influence Application', () => {
    it('should apply influence from trade actions', () => {
      const tradeAction: ActionProposal = {
        id: 'trade_action',
        name: 'Establish Trade Route',
        description: 'Create profitable trade connections',
        type: 'economic',
        costs: { gold: 100 },
        effects: { gold: 200 },
        satisfies: [],
        domains: { wealth: 0.8, virtue: 0.2 }
      };

      const result = applyActionInfluence(playerInfluence, tradeAction, world, factionAmbitions);
      
      expect(result.updatedInfluence).toBeDefined();
      expect(result.events.length).toBeGreaterThan(0);
      
      // Trade actions should generally improve reputation and favor with trade-focused factions
      const tradeEvent = result.events.find(e => e.type === 'reputation_change');
      if (tradeEvent) {
        expect(tradeEvent.change).toBeGreaterThan(0);
      }
    });

    it('should apply negative influence from aggressive actions', () => {
      const warAction: ActionProposal = {
        id: 'declare_war',
        name: 'Declare War',
        description: 'Launch military campaign',
        type: 'military',
        costs: { population: 1000, gold: 500 },
        effects: { territory: 1 },
        satisfies: [],
        domains: { power: 0.9, virtue: -0.3 }
      };

      const result = applyActionInfluence(playerInfluence, warAction, world, factionAmbitions);
      
      expect(result.updatedInfluence.reputation).toBeLessThan(playerInfluence.reputation);
      
      // Should increase fear with some factions
      const fearChanges = result.events.filter(e => e.type === 'fear_change');
      expect(fearChanges.length).toBeGreaterThan(0);
    });

    it('should apply cultural influence from cultural actions', () => {
      const cultureAction: ActionProposal = {
        id: 'cultural_exchange',
        name: 'Promote Cultural Exchange',
        description: 'Foster cultural ties with other factions',
        type: 'cultural',
        costs: { gold: 200 },
        effects: { culture: 50 },
        satisfies: [],
        domains: { creation: 0.7, virtue: 0.3 }
      };

      const result = applyActionInfluence(playerInfluence, cultureAction, world, factionAmbitions);
      
      const cultureEvents = result.events.filter(e => e.type === 'culture_change');
      expect(cultureEvents.length).toBeGreaterThan(0);
      expect(cultureEvents[0].change).toBeGreaterThan(0);
    });
  });

  describe('Influence Score Calculation', () => {
    it('should calculate composite influence scores', () => {
      const faction = factionAmbitions[0];
      
      // Set some influence values
      playerInfluence.favor[faction.factionId] = 30;
      playerInfluence.fear[faction.factionId] = 10;
      playerInfluence.culture[faction.factionId] = 20;
      playerInfluence.reputation = 25;

      const score = getInfluenceScore(playerInfluence, faction.factionId, faction);
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(-100);
      expect(score).toBeLessThan(100);
    });

    it('should weight different influence types based on faction ambition', () => {
      const powerFaction = factionAmbitions.find(fa => fa.profile.power > 0.7);
      const wealthFaction = factionAmbitions.find(fa => fa.profile.wealth > 0.7);
      
      if (!powerFaction || !wealthFaction) return;

      // Set same influence values for both
      playerInfluence.fear[powerFaction.factionId] = 50;
      playerInfluence.fear[wealthFaction.factionId] = 50;
      playerInfluence.favor[powerFaction.factionId] = 20;
      playerInfluence.favor[wealthFaction.factionId] = 20;

      const powerScore = getInfluenceScore(playerInfluence, powerFaction.factionId, powerFaction);
      const wealthScore = getInfluenceScore(playerInfluence, wealthFaction.factionId, wealthFaction);
      
      // Power-focused factions should weigh fear more heavily
      expect(powerScore).toBeGreaterThan(wealthScore);
    });
  });

  describe('Influence Summary', () => {
    it('should generate comprehensive influence summary', () => {
      // Set some influence values
      factionAmbitions.forEach((fa, i) => {
        playerInfluence.favor[fa.factionId] = i * 10;
        playerInfluence.fear[fa.factionId] = (i + 1) * 5;
      });

      const summary = getInfluenceSummary(playerInfluence, factionAmbitions);
      
      expect(Object.keys(summary)).toHaveLength(factionAmbitions.length);
      
      Object.values(summary).forEach(factionSummary => {
        expect(factionSummary).toHaveProperty('favor');
        expect(factionSummary).toHaveProperty('fear');
        expect(factionSummary).toHaveProperty('culture');
        expect(factionSummary).toHaveProperty('composite');
        expect(factionSummary).toHaveProperty('standing');
      });
    });

    it('should correctly categorize standings', () => {
      const faction = factionAmbitions[0];
      
      // Test hostile standing
      playerInfluence.favor[faction.factionId] = -70;
      playerInfluence.fear[faction.factionId] = 30;
      
      let summary = getInfluenceSummary(playerInfluence, [faction]);
      expect(summary[faction.factionId].standing).toBe('hostile');
      
      // Test allied standing
      playerInfluence.favor[faction.factionId] = 70;
      playerInfluence.fear[faction.factionId] = 10;
      
      summary = getInfluenceSummary(playerInfluence, [faction]);
      expect(summary[faction.factionId].standing).toBe('allied');
    });
  });

  describe('Influence Decay', () => {
    it('should apply natural decay over time', () => {
      // Set high values
      playerInfluence.reputation = 80;
      playerInfluence.favor[world.factions[0].id] = 90;
      playerInfluence.fear[world.factions[0].id] = 70;
      playerInfluence.culture[world.factions[0].id] = 60;

      const decayed = applyInfluenceDecay(playerInfluence, world);
      
      // All values should decay toward zero
      expect(Math.abs(decayed.reputation)).toBeLessThan(Math.abs(playerInfluence.reputation));
      expect(Math.abs(decayed.favor[world.factions[0].id])).toBeLessThan(Math.abs(playerInfluence.favor[world.factions[0].id]));
      expect(Math.abs(decayed.fear[world.factions[0].id])).toBeLessThan(Math.abs(playerInfluence.fear[world.factions[0].id]));
      expect(Math.abs(decayed.culture[world.factions[0].id])).toBeLessThan(Math.abs(playerInfluence.culture[world.factions[0].id]));
    });

    it('should not decay past zero', () => {
      playerInfluence.reputation = 5; // Small positive value
      
      const decayed = applyInfluenceDecay(playerInfluence, world);
      
      expect(decayed.reputation).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Major Influence Events', () => {
    it('should handle war declarations', () => {
      const targetFactionId = world.factions[0].id;
      
      const result = applyMajorInfluenceEvent(
        playerInfluence, 
        'declare_war', 
        targetFactionId, 
        factionAmbitions
      );
      
      expect(result.updatedInfluence.reputation).toBeLessThan(playerInfluence.reputation);
      expect(result.events.length).toBeGreaterThan(0);
      
      // Fear should increase with target and possibly others
      expect(result.updatedInfluence.fear[targetFactionId]).toBeGreaterThan(
        playerInfluence.fear[targetFactionId] || 0
      );
    });

    it('should handle treaty breaking', () => {
      const targetFactionId = world.factions[0].id;
      
      const result = applyMajorInfluenceEvent(
        playerInfluence, 
        'break_treaty', 
        targetFactionId, 
        factionAmbitions
      );
      
      // Breaking treaties should hurt reputation significantly
      expect(result.updatedInfluence.reputation).toBeLessThan(playerInfluence.reputation - 10);
      expect(result.events.some(e => e.type === 'reputation_change')).toBe(true);
    });

    it('should handle vassalization', () => {
      const targetFactionId = world.factions[0].id;
      
      const result = applyMajorInfluenceEvent(
        playerInfluence, 
        'vassalize', 
        targetFactionId, 
        factionAmbitions
      );
      
      // Vassalization should increase fear and may hurt reputation
      expect(result.updatedInfluence.fear[targetFactionId]).toBeGreaterThan(
        playerInfluence.fear[targetFactionId] || 0
      );
    });

    it('should handle liberation positively', () => {
      const targetFactionId = world.factions[0].id;
      
      const result = applyMajorInfluenceEvent(
        playerInfluence, 
        'liberation', 
        targetFactionId, 
        factionAmbitions
      );
      
      // Liberation should improve reputation and favor
      expect(result.updatedInfluence.reputation).toBeGreaterThan(playerInfluence.reputation);
      expect(result.updatedInfluence.favor[targetFactionId]).toBeGreaterThan(
        playerInfluence.favor[targetFactionId] || 0
      );
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle extreme influence values', () => {
      playerInfluence.reputation = 150; // Over max
      playerInfluence.favor[world.factions[0].id] = -150; // Under min
      
      const clamped = applyInfluenceDecay(playerInfluence, world);
      
      expect(clamped.reputation).toBeLessThanOrEqual(100);
      expect(clamped.favor[world.factions[0].id]).toBeGreaterThanOrEqual(-100);
    });

    it('should handle missing faction data gracefully', () => {
      const invalidFactionId = 'nonexistent_faction';
      
      expect(() => {
        getInfluenceScore(playerInfluence, invalidFactionId, factionAmbitions[0]);
      }).not.toThrow();
      
      expect(() => {
        applyMajorInfluenceEvent(playerInfluence, 'declare_war', invalidFactionId, factionAmbitions);
      }).not.toThrow();
    });

    it('should maintain historical records', () => {
      const tradeAction: ActionProposal = {
        id: 'trade',
        name: 'Trade',
        description: 'Trade action',
        type: 'economic',
        costs: {},
        effects: {},
        satisfies: [],
        domains: { wealth: 0.5 }
      };

      const result = applyActionInfluence(playerInfluence, tradeAction, world, factionAmbitions);
      
      // History should be updated
      expect(Object.keys(result.updatedInfluence.history).length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of factions efficiently', () => {
      // Create many faction ambitions
      const manyFactions: FactionAmbition[] = Array.from({ length: 1000 }, (_, i) => ({
        factionId: `faction_${i}`,
        profile: {
          archetype: 'mercantile',
          power: 0.3,
          wealth: 0.7,
          faith: 0.2,
          virtue: 0.4,
          freedom: 0.3,
          creation: 0.2,
          modifiers: {}
        },
        currentGoals: [],
        lastAction: null,
        plannerCooldown: 0
      }));

      const start = Date.now();
      const summary = getInfluenceSummary(playerInfluence, manyFactions);
      const duration = Date.now() - start;
      
      expect(Object.keys(summary)).toHaveLength(1000);
      expect(duration).toBeLessThan(500); // Should be reasonably fast
    });
  });
});