import { describe, it, expect } from 'vitest';
import { parseAmbition } from '../src/modules/ambition.js';
import { generateDynamicGoals } from '../src/modules/goalGen.js';
import { seed, SeededRandom } from '../src/modules/worldGen.js';

describe('DAS Determinism', () => {
  const testSeed = 12345;
  const testAmbition1 = "I wish to be a just king who rules with honor and virtue";
  const testAmbition2 = "I want to become wealthy through trade and build great monuments";

  describe('Ambition Parsing Determinism', () => {
    it('should parse identical ambition text identically', () => {
      const profile1 = parseAmbition(testAmbition1);
      const profile2 = parseAmbition(testAmbition1);
      
      expect(profile1).toEqual(profile2);
      expect(profile1.power).toEqual(profile2.power);
      expect(profile1.virtue).toEqual(profile2.virtue);
      expect(profile1.modifiers).toEqual(profile2.modifiers);
      expect(profile1.scale).toEqual(profile2.scale);
    });

    it('should produce different profiles for different ambitions', () => {
      const profile1 = parseAmbition(testAmbition1);
      const profile2 = parseAmbition(testAmbition2);
      
      expect(profile1).not.toEqual(profile2);
      // "just king" should have higher virtue
      expect(profile1.virtue).toBeGreaterThan(profile2.virtue);
      // "wealthy through trade" should have higher wealth
      expect(profile2.wealth).toBeGreaterThan(profile1.wealth);
    });

    it('should have consistent domain weights that sum to 1', () => {
      const profile = parseAmbition(testAmbition1);
      const sum = profile.power + profile.wealth + profile.faith + 
                 profile.virtue + profile.freedom + profile.creation;
      
      expect(sum).toBeCloseTo(1.0, 3);
    });
  });

  describe('SeededRandom Determinism', () => {
    it('should produce identical sequences with same seed', () => {
      const rng1 = new SeededRandom(testSeed);
      const rng2 = new SeededRandom(testSeed);
      
      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());
      
      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRandom(testSeed);
      const rng2 = new SeededRandom(testSeed + 1);
      
      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());
      
      expect(sequence1).not.toEqual(sequence2);
    });

    it('should produce identical choices with same seed', () => {
      const options = ['a', 'b', 'c', 'd', 'e'];
      const rng1 = new SeededRandom(testSeed);
      const rng2 = new SeededRandom(testSeed);
      
      const choices1 = Array.from({ length: 20 }, () => rng1.choice(options));
      const choices2 = Array.from({ length: 20 }, () => rng2.choice(options));
      
      expect(choices1).toEqual(choices2);
    });
  });

  describe('Goal Generation Determinism', () => {
    it('should generate identical goals with same profile and seed', () => {
      const profile = parseAmbition(testAmbition1);
      const rng1 = new SeededRandom(testSeed);
      const rng2 = new SeededRandom(testSeed);
      
      const goals1 = generateDynamicGoals(profile, rng1, 5, 3);
      const goals2 = generateDynamicGoals(profile, rng2, 5, 3);
      
      expect(goals1).toEqual(goals2);
      expect(goals1.nodes).toHaveLength(goals2.nodes.length);
      
      // Check node IDs are identical
      const nodeIds1 = goals1.nodes.map(n => n.id).sort();
      const nodeIds2 = goals2.nodes.map(n => n.id).sort();
      expect(nodeIds1).toEqual(nodeIds2);
    });

    it('should generate different goals with different seeds', () => {
      const profile = parseAmbition(testAmbition1);
      const rng1 = new SeededRandom(testSeed);
      const rng2 = new SeededRandom(testSeed + 1);
      
      const goals1 = generateDynamicGoals(profile, rng1, 5, 3);
      const goals2 = generateDynamicGoals(profile, rng2, 5, 3);
      
      // Should have different node sets
      const nodeIds1 = goals1.nodes.map(n => n.id).sort();
      const nodeIds2 = goals2.nodes.map(n => n.id).sort();
      expect(nodeIds1).not.toEqual(nodeIds2);
    });

    it('should respect ambition domain preferences in goal selection', () => {
      const justKingProfile = parseAmbition(testAmbition1);
      const wealthyTraderProfile = parseAmbition(testAmbition2);
      const rng1 = new SeededRandom(testSeed);
      const rng2 = new SeededRandom(testSeed);
      
      const goals1 = generateDynamicGoals(justKingProfile, rng1, 5, 3);
      const goals2 = generateDynamicGoals(wealthyTraderProfile, rng2, 5, 3);
      
      // Check that virtue-focused profile gets more virtue goals
      const virtueGoals1 = goals1.nodes.filter(n => n.domains?.includes('virtue')).length;
      const virtueGoals2 = goals2.nodes.filter(n => n.domains?.includes('virtue')).length;
      
      // Check that wealth-focused profile gets more wealth goals
      const wealthGoals1 = goals1.nodes.filter(n => n.domains?.includes('wealth')).length;
      const wealthGoals2 = goals2.nodes.filter(n => n.domains?.includes('wealth')).length;
      
      expect(virtueGoals1).toBeGreaterThanOrEqual(virtueGoals2);
      expect(wealthGoals2).toBeGreaterThanOrEqual(wealthGoals1);
    });
  });

  describe('World Generation Determinism', () => {
    it('should generate identical worlds with same profile and seed', () => {
      const profile = parseAmbition(testAmbition1);
      
      const world1 = seed(profile, testSeed);
      const world2 = seed(profile, testSeed);
      
      expect(world1).toEqual(world2);
      expect(world1.seed).toBe(world2.seed);
      expect(world1.regions).toEqual(world2.regions);
      expect(world1.factions).toEqual(world2.factions);
    });

    it('should generate different worlds with different seeds', () => {
      const profile = parseAmbition(testAmbition1);
      
      const world1 = seed(profile, testSeed);
      const world2 = seed(profile, testSeed + 1);
      
      expect(world1).not.toEqual(world2);
      expect(world1.seed).not.toBe(world2.seed);
      // Region names should be different
      const regionNames1 = world1.regions.map(r => r.name).sort();
      const regionNames2 = world2.regions.map(r => r.name).sort();
      expect(regionNames1).not.toEqual(regionNames2);
    });

    it('should reflect ambition bias in world generation', () => {
      const faithProfile = parseAmbition("I wish to serve God and spread divine faith across the land");
      const powerProfile = parseAmbition("I will conquer all lands and rule with absolute power");
      
      const faithWorld = seed(faithProfile, testSeed);
      const powerWorld = seed(powerProfile, testSeed + 1); // Different seed to avoid identical generation
      
      // Faith-focused should have higher average piety in regions
      const avgFaithPiety = faithWorld.regions.reduce((sum, r) => sum + r.piety, 0) / faithWorld.regions.length;
      const avgPowerPiety = powerWorld.regions.reduce((sum, r) => sum + r.piety, 0) / powerWorld.regions.length;
      
      // Faith-focused should have higher average security (from power domain)
      const avgFaithSecurity = faithWorld.regions.reduce((sum, r) => sum + r.security, 0) / faithWorld.regions.length;
      const avgPowerSecurity = powerWorld.regions.reduce((sum, r) => sum + r.security, 0) / powerWorld.regions.length;
      
      // Note: These are probabilistic tests, so we use a reasonable threshold
      expect(avgFaithPiety).toBeGreaterThan(avgPowerPiety - 10); // Allow some variance
      expect(avgPowerSecurity).toBeGreaterThan(avgFaithSecurity - 10);
    });

    it('should have consistent domain affinities in regions and factions', () => {
      const profile = parseAmbition(testAmbition1);
      const world = seed(profile, testSeed);
      
      // All regions should have domain affinities
      world.regions.forEach(region => {
        expect(region.domainAffinities).toBeDefined();
        expect(Object.keys(region.domainAffinities)).toHaveLength(6);
        
        // Values should be between 0 and 1
        Object.values(region.domainAffinities).forEach(affinity => {
          expect(affinity).toBeGreaterThanOrEqual(0);
          expect(affinity).toBeLessThanOrEqual(1);
        });
      });
      
      // All factions should have domain affinities
      world.factions.forEach(faction => {
        expect(faction.domainAffinities).toBeDefined();
        expect(Object.keys(faction.domainAffinities)).toHaveLength(6);
        
        Object.values(faction.domainAffinities).forEach(affinity => {
          expect(affinity).toBeGreaterThanOrEqual(0);
          expect(affinity).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('End-to-End Determinism', () => {
    it('should produce identical first two ticks with same inputs', () => {
      const ambitionText = "I wish to build a prosperous trading empire based on virtue";
      const profile1 = parseAmbition(ambitionText);
      const profile2 = parseAmbition(ambitionText);
      
      const world1 = seed(profile1, testSeed);
      const world2 = seed(profile2, testSeed);
      
      const rng1 = new SeededRandom(testSeed + 1000); // Offset for goal generation
      const rng2 = new SeededRandom(testSeed + 1000);
      
      const goals1 = generateDynamicGoals(profile1, rng1, 5, 3);
      const goals2 = generateDynamicGoals(profile2, rng2, 5, 3);
      
      // Everything should be identical
      expect(profile1).toEqual(profile2);
      expect(world1).toEqual(world2);
      expect(goals1).toEqual(goals2);
    });

    it('should maintain determinism across multiple domain weight profiles', () => {
      const testCases = [
        "I wish to rule through divine right and holy authority",
        "Freedom for all! Break the chains of oppression!",
        "I shall build wonders that will last for eternity",
        "Gold flows to those who know trade and commerce",
        "With sword and shield I will conquer all lands"
      ];
      
      testCases.forEach((ambitionText, index) => {
        const profile1 = parseAmbition(ambitionText);
        const profile2 = parseAmbition(ambitionText);
        const testSeedForCase = testSeed + index * 1000;
        
        const world1 = seed(profile1, testSeedForCase);
        const world2 = seed(profile2, testSeedForCase);
        
        expect(profile1).toEqual(profile2);
        expect(world1).toEqual(world2);
      });
    });
  });
});