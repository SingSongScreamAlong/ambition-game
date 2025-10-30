import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createVassalage,
  calculateVassalLoyalty,
  processVassalObligations,
  VassalState,
  Title
} from '../vassalage.js';
import { initializePlayerInfluence, PlayerInfluence } from '../influence.js';
import { generateFactionAmbitions, FactionAmbition } from '../factions.js';
import { seed, WorldState } from '../worldGen.js';
import { parseAmbition } from '../ambition.js';

describe('Vassalage System', () => {
  let world: WorldState;
  let playerInfluence: PlayerInfluence;
  let factionAmbitions: FactionAmbition[];
  let vassalState: VassalState;

  beforeEach(() => {
    const ambitionProfile = parseAmbition("I will unite all lands under my righteous rule");
    world = seed(ambitionProfile, 98765);
    playerInfluence = initializePlayerInfluence(world);
    factionAmbitions = generateFactionAmbitions(world, world.seed);
    
    // Create a test vassal
    vassalState = {
      factionId: world.factions[0].id,
      title: 'baron',
      loyaltyScore: 75,
      obligations: [
        {
          type: 'tribute',
          amount: { gold: 100 },
          frequency: 'monthly',
          lastFulfilled: world.tick - 5
        },
        {
          type: 'military_service',
          amount: { troops: 50 },
          frequency: 'on_demand',
          lastFulfilled: world.tick - 10
        }
      ],
      privileges: ['trade_rights', 'local_governance'],
      relationship: {
        trust: 70,
        respect: 80,
        fear: 30
      },
      joinedAt: world.tick - 20,
      lastInteraction: world.tick - 3
    };
  });

  describe('Vassal Creation', () => {
    it('should create vassalage relationship', () => {
      const factionId = world.factions[1].id;
      const title: VassalTitle = 'duke';
      const obligations = [
        {
          type: 'tribute' as const,
          amount: { gold: 200 },
          frequency: 'monthly' as const,
          lastFulfilled: world.tick
        }
      ];

      const newVassal = createVassalage(factionId, title, obligations, world.tick);
      
      expect(newVassal.factionId).toBe(factionId);
      expect(newVassal.title).toBe(title);
      expect(newVassal.obligations).toEqual(obligations);
      expect(newVassal.loyaltyScore).toBeGreaterThan(0);
      expect(newVassal.joinedAt).toBe(world.tick);
    });

    it('should set appropriate initial loyalty based on title', () => {
      const baron = createVassalage(world.factions[0].id, 'baron', [], world.tick);
      const duke = createVassalage(world.factions[1].id, 'duke', [], world.tick);
      const king = createVassalage(world.factions[2].id, 'king', [], world.tick);
      
      // Higher titles should generally have lower initial loyalty (harder to control)
      expect(duke.loyaltyScore).toBeLessThan(baron.loyaltyScore);
      expect(king.loyaltyScore).toBeLessThan(duke.loyaltyScore);
    });
  });

  describe('Loyalty Calculation', () => {
    it('should calculate loyalty based on multiple factors', () => {
      const factionAmbition = factionAmbitions.find(fa => fa.factionId === vassalState.factionId)!;
      
      const loyalty = calculateVassalLoyalty(vassalState, world, playerInfluence, factionAmbition);
      
      expect(typeof loyalty).toBe('number');
      expect(loyalty).toBeGreaterThanOrEqual(0);
      expect(loyalty).toBeLessThanOrEqual(100);
    });

    it('should factor in player influence', () => {
      const factionAmbition = factionAmbitions.find(fa => fa.factionId === vassalState.factionId)!;
      
      // Test with high favor
      const highFavorInfluence = { ...playerInfluence };
      highFavorInfluence.favor[vassalState.factionId] = 80;
      
      const highLoyalty = calculateVassalLoyalty(vassalState, world, highFavorInfluence, factionAmbition);
      
      // Test with low favor
      const lowFavorInfluence = { ...playerInfluence };
      lowFavorInfluence.favor[vassalState.factionId] = -50;
      
      const lowLoyalty = calculateVassalLoyalty(vassalState, world, lowFavorInfluence, factionAmbition);
      
      expect(highLoyalty).toBeGreaterThan(lowLoyalty);
    });

    it('should consider relationship factors', () => {
      const factionAmbition = factionAmbitions.find(fa => fa.factionId === vassalState.factionId)!;
      
      // Test with high trust/respect
      const trustedVassal = { 
        ...vassalState, 
        relationship: { trust: 90, respect: 85, fear: 20 } 
      };
      
      const highLoyalty = calculateVassalLoyalty(trustedVassal, world, playerInfluence, factionAmbition);
      
      // Test with low trust/respect
      const distrustedVassal = { 
        ...vassalState, 
        relationship: { trust: 20, respect: 25, fear: 80 } 
      };
      
      const lowLoyalty = calculateVassalLoyalty(distrustedVassal, world, playerInfluence, factionAmbition);
      
      expect(highLoyalty).toBeGreaterThan(lowLoyalty);
    });

    it('should account for faction ambition alignment', () => {
      const powerFaction = factionAmbitions.find(fa => fa.profile.power > 0.7);
      const virtueFaction = factionAmbitions.find(fa => fa.profile.virtue > 0.7);
      
      if (!powerFaction || !virtueFaction) return;

      const powerVassal = { ...vassalState, factionId: powerFaction.factionId };
      const virtueVassal = { ...vassalState, factionId: virtueFaction.factionId };
      
      // Fear might be more effective with power-focused factions
      const fearInfluence = { ...playerInfluence };
      fearInfluence.fear[powerFaction.factionId] = 70;
      fearInfluence.fear[virtueFaction.factionId] = 70;
      
      const powerLoyalty = calculateVassalLoyalty(powerVassal, world, fearInfluence, powerFaction);
      const virtueLoyalty = calculateVassalLoyalty(virtueVassal, world, fearInfluence, virtueFaction);
      
      // Power factions might respond better to fear
      expect(powerLoyalty).toBeGreaterThanOrEqual(virtueLoyalty - 10); // Allow some variance
    });
  });

  describe('Obligation Processing', () => {
    it('should process tribute obligations', () => {
      const vassals = [vassalState];
      
      const result = processVassalObligations(vassals, world, playerInfluence, factionAmbitions);
      
      expect(result.updatedVassals).toHaveLength(1);
      expect(result.resourceGains).toBeDefined();
      expect(result.loyaltyChanges).toBeDefined();
      
      // Should have collected tribute
      if (result.resourceGains.gold) {
        expect(result.resourceGains.gold).toBeGreaterThan(0);
      }
    });

    it('should handle overdue obligations', () => {
      const overdueVassal = {
        ...vassalState,
        obligations: [
          {
            type: 'tribute' as const,
            amount: { gold: 100 },
            frequency: 'monthly' as const,
            lastFulfilled: world.tick - 50 // Very overdue
          }
        ]
      };
      
      const result = processVassalObligations([overdueVassal], world, playerInfluence, factionAmbitions);
      
      // Loyalty should decrease for overdue obligations
      const loyaltyChange = result.loyaltyChanges[overdueVassal.factionId];
      expect(loyaltyChange).toBeLessThan(0);
    });

    it('should handle insufficient resources', () => {
      // Create vassal with obligation they can't fulfill
      const poorVassal = {
        ...vassalState,
        obligations: [
          {
            type: 'tribute' as const,
            amount: { gold: 999999 }, // Impossibly large tribute
            frequency: 'monthly' as const,
            lastFulfilled: world.tick - 15
          }
        ]
      };
      
      const result = processVassalObligations([poorVassal], world, playerInfluence, factionAmbitions);
      
      // Should handle gracefully without crashing
      expect(result.updatedVassals).toHaveLength(1);
      expect(result.loyaltyChanges[poorVassal.factionId]).toBeLessThan(0);
    });
  });

  describe('Title Management', () => {
    it('should update vassal titles', () => {
      const newTitle: VassalTitle = 'duke';
      const updatedVassal = updateVassalTitle(vassalState, newTitle, world.tick);
      
      expect(updatedVassal.title).toBe(newTitle);
      expect(updatedVassal.lastInteraction).toBe(world.tick);
    });

    it('should adjust loyalty when promoting', () => {
      const promoted = updateVassalTitle(vassalState, 'duke', world.tick);
      
      // Promotion should generally increase loyalty
      expect(promoted.loyaltyScore).toBeGreaterThanOrEqual(vassalState.loyaltyScore);
    });

    it('should adjust loyalty when demoting', () => {
      const highTitleVassal = { ...vassalState, title: 'duke' as VassalTitle };
      const demoted = updateVassalTitle(highTitleVassal, 'baron', world.tick);
      
      // Demotion should generally decrease loyalty
      expect(demoted.loyaltyScore).toBeLessThan(highTitleVassal.loyaltyScore);
    });
  });

  describe('Vassal Privileges', () => {
    it('should handle different privilege combinations', () => {
      const privilegedVassal = createVassalage(
        world.factions[0].id, 
        'duke', 
        [], 
        world.tick
      );
      
      // Vassals should have appropriate privileges for their title
      expect(privilegedVassal.privileges).toContain('local_governance');
      
      if (privilegedVassal.title === 'duke' || privilegedVassal.title === 'king') {
        expect(privilegedVassal.privileges).toContain('trade_rights');
      }
    });
  });

  describe('Multiple Vassals', () => {
    it('should handle multiple vassals efficiently', () => {
      const multipleVassals = world.factions.slice(0, 5).map((faction, i) => 
        createVassalage(faction.id, i % 2 === 0 ? 'baron' : 'duke', [
          {
            type: 'tribute',
            amount: { gold: 50 + i * 25 },
            frequency: 'monthly',
            lastFulfilled: world.tick - (i + 1) * 5
          }
        ], world.tick - i * 10)
      );
      
      const result = processVassalObligations(multipleVassals, world, playerInfluence, factionAmbitions);
      
      expect(result.updatedVassals).toHaveLength(5);
      expect(Object.keys(result.loyaltyChanges).length).toBeGreaterThan(0);
      expect(result.resourceGains.gold).toBeGreaterThan(0);
    });

    it('should calculate total tribute correctly', () => {
      const vassals = [
        createVassalage(world.factions[0].id, 'baron', [
          { type: 'tribute', amount: { gold: 100 }, frequency: 'monthly', lastFulfilled: world.tick - 15 }
        ], world.tick),
        createVassalage(world.factions[1].id, 'duke', [
          { type: 'tribute', amount: { gold: 200 }, frequency: 'monthly', lastFulfilled: world.tick - 15 }
        ], world.tick)
      ];
      
      const result = processVassalObligations(vassals, world, playerInfluence, factionAmbitions);
      
      // Should collect tribute from both vassals
      expect(result.resourceGains.gold).toBeGreaterThanOrEqual(250); // Some may be partial
    });
  });

  describe('Edge Cases', () => {
    it('should handle vassals with no obligations', () => {
      const noObligationVassal = { ...vassalState, obligations: [] };
      
      const result = processVassalObligations([noObligationVassal], world, playerInfluence, factionAmbitions);
      
      expect(result.updatedVassals).toHaveLength(1);
      expect(result.resourceGains).toEqual({});
    });

    it('should handle invalid faction IDs', () => {
      const invalidVassal = { ...vassalState, factionId: 'nonexistent_faction' };
      
      expect(() => {
        processVassalObligations([invalidVassal], world, playerInfluence, factionAmbitions);
      }).not.toThrow();
    });

    it('should handle extreme loyalty values', () => {
      const extremeVassal = { ...vassalState, loyaltyScore: 999 };
      const factionAmbition = factionAmbitions.find(fa => fa.factionId === vassalState.factionId)!;
      
      const loyalty = calculateVassalLoyalty(extremeVassal, world, playerInfluence, factionAmbition);
      
      expect(loyalty).toBeLessThanOrEqual(100);
      expect(loyalty).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of vassals efficiently', () => {
      const manyVassals = Array.from({ length: 100 }, (_, i) => 
        createVassalage(`faction_${i}`, 'baron', [
          {
            type: 'tribute',
            amount: { gold: 10 },
            frequency: 'monthly',
            lastFulfilled: world.tick - 15
          }
        ], world.tick)
      );
      
      const start = Date.now();
      const result = processVassalObligations(manyVassals, world, playerInfluence, factionAmbitions);
      const duration = Date.now() - start;
      
      expect(result.updatedVassals).toHaveLength(100);
      expect(duration).toBeLessThan(500); // Should be reasonably fast
    });
  });
});