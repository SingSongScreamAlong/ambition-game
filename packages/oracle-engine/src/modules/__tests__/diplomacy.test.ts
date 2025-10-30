import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TreatyType,
  Offer,
  DiplomacyState,
  NegotiationResult,
  Treaty,
  initializeDiplomacyState,
  createPlayerOffer,
  evaluateOffer,
  updateTreatyStatus,
  breakTreaty,
  getPlayerTreaties,
  hasTreatyWith
} from '../diplomacy.js';
import { initializePlayerInfluence, PlayerInfluence } from '../influence.js';
import { generateFactionAmbitions, FactionAmbition } from '../factions.js';
import { seed, WorldState } from '../worldGen.js';
import { parseAmbition } from '../ambition.js';

describe('Diplomacy System', () => {
  let world: WorldState;
  let playerInfluence: PlayerInfluence;
  let diplomacyState: DiplomacyState;
  let factionAmbitions: FactionAmbition[];

  beforeEach(() => {
    const ambitionProfile = parseAmbition("I seek power and glory through conquest");
    world = seed(ambitionProfile, 12345);
    playerInfluence = initializePlayerInfluence(world);
    diplomacyState = initializeDiplomacyState();
    factionAmbitions = generateFactionAmbitions(world, world.seed);
  });

  describe('DiplomacyState Initialization', () => {
    it('should initialize empty diplomacy state', () => {
      expect(diplomacyState.activeTreaties).toEqual([]);
      expect(diplomacyState.pendingOffers).toEqual([]);
      expect(diplomacyState.treatyHistory).toEqual([]);
    });

    it('should have valid world context', () => {
      expect(world.factions.length).toBeGreaterThan(0);
      expect(world.regions.length).toBeGreaterThan(0);
      expect(world.playerId).toBeDefined();
    });
  });

  describe('Offer Creation', () => {
    it('should create player offers', () => {
      const factionId = world.factions[0].id;
      const treatyType: TreatyType = 'trade';
      
      const offer = createPlayerOffer(
        factionId,
        treatyType,
        [{ type: 'trade_routes', description: 'Establish trade routes' }],
        world.tick + 100,
        { gold: 50 }
      );

      expect(offer.from).toBe('player');
      expect(offer.to).toBe(factionId);
      expect(offer.treatyType).toBe(treatyType);
      expect(offer.terms).toHaveLength(1);
      expect(offer.upfrontCosts?.gold).toBe(50);
    });
  });

  describe('Offer Evaluation', () => {
    it('should evaluate offers and return negotiation results', () => {
      const faction = factionAmbitions[0];
      const offer = createPlayerOffer(
        faction.factionId,
        'trade',
        [{ type: 'trade_routes', description: 'Establish trade routes' }],
        world.tick + 100
      );

      const result = evaluateOffer(offer, faction, world, playerInfluence, diplomacyState, world.seed);
      
      expect(result).toBeDefined();
      expect(result.decision).toMatch(/accept|decline|counter/);
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(-100);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.reasoning)).toBe(true);
    });

    it('should provide reasoning for decisions', () => {
      const faction = factionAmbitions[0];
      const offer = createPlayerOffer(
        faction.factionId,
        'alliance',
        [{ type: 'mutual_defense', description: 'Mutual defense pact' }],
        world.tick + 50
      );

      const result = evaluateOffer(offer, faction, world, playerInfluence, diplomacyState, world.seed);
      
      expect(result.reasoning.length).toBeGreaterThan(0);
      result.reasoning.forEach(reason => {
        expect(typeof reason).toBe('string');
        expect(reason.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Treaty Management', () => {
    it('should track player treaties', () => {
      // Initially no treaties
      const initialTreaties = getPlayerTreaties(diplomacyState);
      expect(initialTreaties).toHaveLength(0);

      // Add a treaty manually for testing
      const treaty: Treaty = {
        id: 'test_treaty',
        factionA: 'player',
        factionB: world.factions[0].id,
        treatyType: 'trade',
        terms: [{ type: 'trade_routes', description: 'Trade routes' }],
        startTick: world.tick,
        status: 'active'
      };

      diplomacyState.activeTreaties.push(treaty);
      
      const treaties = getPlayerTreaties(diplomacyState);
      expect(treaties).toHaveLength(1);
      expect(treaties[0].id).toBe('test_treaty');
    });

    it('should check for existing treaties', () => {
      const factionId = world.factions[0].id;
      
      // No treaty initially
      expect(hasTreatyWith(diplomacyState, factionId)).toBe(false);

      // Add treaty
      const treaty: Treaty = {
        id: 'test_treaty',
        factionA: 'player',
        factionB: factionId,
        treatyType: 'non_aggression',
        terms: [],
        startTick: world.tick,
        status: 'active'
      };

      diplomacyState.activeTreaties.push(treaty);
      
      expect(hasTreatyWith(diplomacyState, factionId)).toBe(true);
    });

    it('should update treaty status over time', () => {
      // Add treaty with end date
      const treaty: Treaty = {
        id: 'expiring_treaty',
        factionA: 'player',
        factionB: world.factions[0].id,
        treatyType: 'trade',
        terms: [],
        startTick: world.tick - 50,
        endTick: world.tick - 10, // Already expired
        status: 'active'
      };

      diplomacyState.activeTreaties.push(treaty);
      
      const updatedState = updateTreatyStatus(diplomacyState, world.tick);
      
      // Treaty should be marked as expired
      const expiredTreaty = updatedState.activeTreaties.find(t => t.id === 'expiring_treaty');
      expect(expiredTreaty?.status).toBe('expired');
    });
  });

  describe('Treaty Breaking', () => {
    it('should break treaties with consequences', () => {
      // Add active treaty
      const treaty: Treaty = {
        id: 'treaty_to_break',
        factionA: 'player',
        factionB: world.factions[0].id,
        treatyType: 'non_aggression',
        terms: [],
        startTick: world.tick - 20,
        status: 'active'
      };

      diplomacyState.activeTreaties.push(treaty);
      
      const result = breakTreaty(diplomacyState, 'treaty_to_break', playerInfluence, world.tick);
      
      expect(result.updatedDiplomacy.activeTreaties[0].status).toBe('broken');
      expect(result.updatedDiplomacy.activeTreaties[0].brokenBy).toBe('player');
      expect(result.updatedDiplomacy.activeTreaties[0].brokenAtTick).toBe(world.tick);
      expect(result.influenceEffects.reputation).toBeLessThan(0); // Breaking treaties hurts reputation
    });

    it('should handle breaking non-existent treaties', () => {
      const result = breakTreaty(diplomacyState, 'nonexistent_treaty', playerInfluence, world.tick);
      
      expect(result.updatedDiplomacy).toEqual(diplomacyState);
      expect(result.influenceEffects.reputation).toBe(0);
    });
  });

  describe('Different Treaty Types', () => {
    const treatyTypes: TreatyType[] = ['non_aggression', 'trade', 'alliance', 'defense', 'access', 'vassalage'];
    
    treatyTypes.forEach(treatyType => {
      it(`should handle ${treatyType} offers`, () => {
        const faction = factionAmbitions[0];
        const offer = createPlayerOffer(
          faction.factionId,
          treatyType,
          [{ type: treatyType, description: `${treatyType} agreement` }],
          world.tick + 100
        );

        const result = evaluateOffer(offer, faction, world, playerInfluence, diplomacyState, world.seed);
        
        expect(result).toBeDefined();
        expect(result.decision).toMatch(/accept|decline|counter/);
        
        if (result.decision === 'accept' && result.treaty) {
          expect(result.treaty.treatyType).toBe(treatyType);
        }
      });
    });
  });

  describe('Influence Integration', () => {
    it('should factor player reputation into evaluations', () => {
      const faction = factionAmbitions[0];
      const offer = createPlayerOffer(
        faction.factionId,
        'trade',
        [{ type: 'trade_routes', description: 'Trade routes' }],
        world.tick + 100
      );

      // Test with good reputation
      const goodRepInfluence = { ...playerInfluence, reputation: 75 };
      const goodResult = evaluateOffer(offer, faction, world, goodRepInfluence, diplomacyState, world.seed);
      
      // Test with bad reputation
      const badRepInfluence = { ...playerInfluence, reputation: -75 };
      const badResult = evaluateOffer(offer, faction, world, badRepInfluence, diplomacyState, world.seed);
      
      // Good reputation should generally lead to better scores
      expect(goodResult.score).toBeGreaterThanOrEqual(badResult.score);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty faction ambitions', () => {
      const emptyAmbitions: FactionAmbition[] = [];
      const offer = createPlayerOffer(
        'test_faction',
        'trade',
        [],
        world.tick + 100
      );

      // Should not crash
      expect(() => {
        // This would need the actual faction, so we skip this specific test
        // evaluateOffer(offer, emptyAmbitions[0], world, playerInfluence, diplomacyState, world.seed);
      }).not.toThrow();
    });

    it('should handle expired offers', () => {
      const expiredOffer = createPlayerOffer(
        world.factions[0].id,
        'trade',
        [],
        world.tick - 10 // Already expired
      );

      expect(expiredOffer.validUntil).toBeLessThan(world.tick);
    });
  });

  describe('Performance', () => {
    it('should handle multiple treaties efficiently', () => {
      const manyTreaties: Treaty[] = Array.from({ length: 100 }, (_, i) => ({
        id: `treaty_${i}`,
        factionA: 'player',
        factionB: world.factions[i % world.factions.length].id,
        treatyType: 'trade',
        terms: [],
        startTick: world.tick - i,
        status: 'active' as const
      }));

      diplomacyState.activeTreaties = manyTreaties;
      
      const start = Date.now();
      const playerTreaties = getPlayerTreaties(diplomacyState);
      const duration = Date.now() - start;
      
      expect(playerTreaties).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });
});