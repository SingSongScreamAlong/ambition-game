import { describe, it, expect } from 'vitest';
import { parseAmbition } from '../src/modules/ambition.js';
import { generateDynamicGoals } from '../src/modules/goalGen.js';
import { seed, SeededRandom } from '../src/modules/worldGen.js';
import { proposeDynamic } from '../src/modules/dynamicPlanner.js';
import { createBasicKnowledgeBase } from '../src/modules/dsl.js';
import { applyActionMutation } from '../src/modules/ambitionMutation.js';

describe('Dynamic Ambition System Integration', () => {
  const testSeed = 99999;
  const knowledgeBase = createBasicKnowledgeBase();

  describe('End-to-End Ambition Flow', () => {
    it('should parse "just king" ambition and generate appropriate world/goals', () => {
      const ambitionText = "I wish to be a just king who rules with honor and virtue";
      
      // Step 1: Parse ambition
      const profile = parseAmbition(ambitionText);
      
      // Should be virtue and power focused
      expect(profile.virtue).toBeGreaterThan(0.3);
      expect(profile.power).toBeGreaterThan(0.2);
      expect(profile.modifiers.peaceful).toBeGreaterThan(0.3);
      
      // Step 2: Generate world
      const world = seed(profile, testSeed);
      
      // Should have virtue-biased regions
      const avgVirtueAffinity = world.regions.reduce((sum, r) => sum + r.domainAffinities.virtue, 0) / world.regions.length;
      expect(avgVirtueAffinity).toBeGreaterThan(0.4);
      
      // Should have higher lawfulness
      const avgLawfulness = world.regions.reduce((sum, r) => sum + r.lawfulness, 0) / world.regions.length;
      expect(avgLawfulness).toBeGreaterThan(60);
      
      // Step 3: Generate goals
      const rng = new SeededRandom(testSeed + 1000);
      const goals = generateDynamicGoals(profile, rng, 5, 3);
      
      // Should have virtue-focused goals
      const virtueGoals = goals.nodes.filter(n => n.domains?.includes('virtue'));
      expect(virtueGoals.length).toBeGreaterThan(0);
      
      // Step 4: Generate actions
      const proposals = proposeDynamic(goals, world, profile, knowledgeBase, testSeed);
      
      // Should have justice/virtue actions
      const justiceActions = proposals.filter(p =>
        p.description.toLowerCase().includes('justice') ||
        p.description.toLowerCase().includes('protect') ||
        p.description.toLowerCase().includes('honor')
      );
      expect(justiceActions.length).toBeGreaterThan(0);
    });

    it('should parse "wealthy trader" ambition and generate merchant-focused content', () => {
      const ambitionText = "I want to become wealthy and build great monuments through trade";
      
      // Step 1: Parse ambition
      const profile = parseAmbition(ambitionText);
      
      // Should be wealth and creation focused
      expect(profile.wealth).toBeGreaterThan(0.3);
      expect(profile.creation).toBeGreaterThan(0.2);
      
      // Step 2: Generate world
      const world = seed(profile, testSeed);
      
      // Should have wealth-biased regions
      const avgWealthAffinity = world.regions.reduce((sum, r) => sum + r.domainAffinities.wealth, 0) / world.regions.length;
      expect(avgWealthAffinity).toBeGreaterThan(0.35);
      
      // Should have merchant factions
      const merchantFactions = world.factions.filter(f => 
        f.domainAffinities.wealth > 0.5 ||
        f.name.toLowerCase().includes('merchant') ||
        f.name.toLowerCase().includes('guild') ||
        f.name.toLowerCase().includes('golden')
      );
      expect(merchantFactions.length).toBeGreaterThan(0);
      
      // Step 3: Generate goals
      const rng = new SeededRandom(testSeed + 1000);
      const goals = generateDynamicGoals(profile, rng, 5, 3);
      
      // Should have wealth and creation goals
      const economicGoals = goals.nodes.filter(n => 
        n.domains?.includes('wealth') || n.domains?.includes('creation')
      );
      expect(economicGoals.length).toBeGreaterThan(0);
      
      // Step 4: Generate actions
      const proposals = proposeDynamic(goals, world, profile, knowledgeBase, testSeed);
      
      // Should have trade/building actions
      const commerceActions = proposals.filter(p =>
        p.description.toLowerCase().includes('trade') ||
        p.description.toLowerCase().includes('build') ||
        p.description.toLowerCase().includes('gold') ||
        p.description.toLowerCase().includes('merchant')
      );
      expect(commerceActions.length).toBeGreaterThan(0);
    });

    it('should parse "free rebel" ambition and generate liberation content', () => {
      const ambitionText = "Freedom for all! I will break every chain and liberate the oppressed!";
      
      // Step 1: Parse ambition
      const profile = parseAmbition(ambitionText);
      
      // Should be freedom focused
      expect(profile.freedom).toBeGreaterThan(0.4);
      expect(profile.virtue).toBeGreaterThan(0.2); // Justice for oppressed
      
      // Step 2: Generate world
      const world = seed(profile, testSeed);
      
      // Should have freedom-biased regions with higher unrest
      const freedomRegions = world.regions.filter(r => r.domainAffinities.freedom > 0.5);
      if (freedomRegions.length > 0) {
        const avgUnrest = freedomRegions.reduce((sum, r) => sum + r.unrest, 0) / freedomRegions.length;
        expect(avgUnrest).toBeGreaterThan(20); // Higher unrest in freedom regions
      }
      
      // Step 3: Generate goals
      const rng = new SeededRandom(testSeed + 1000);
      const goals = generateDynamicGoals(profile, rng, 5, 3);
      
      // Should have freedom-focused goals
      const liberationGoals = goals.nodes.filter(n => n.domains?.includes('freedom'));
      expect(liberationGoals.length).toBeGreaterThan(0);
    });
  });

  describe('Ambition Mutation Flow', () => {
    it('should mutate ambition based on action choices', () => {
      const initialText = "I wish to rule justly with honor";
      const profile = parseAmbition(initialText);
      
      // Mock action that increases power, decreases virtue
      const conquestAction = {
        id: 'conquest_action',
        label: 'Conquer Neighboring Territory',
        description: 'Use military force to expand your domain',
        satisfies: ['land'],
        costs: { gold: 200 },
        risks: { casualty: 0.3 },
        time: '3 turns',
        requirements: ['army'],
        mapRefs: ['region_1'],
        rewards: {},
        effects: []
      };
      
      // Apply mutation
      const result = applyActionMutation(profile, conquestAction, 1);
      
      // Should increase power, decrease virtue (based on mutation effects)
      expect(result.mutatedProfile.power).toBeGreaterThan(profile.power);
      expect(result.mutatedProfile.virtue).toBeLessThan(profile.virtue);
      expect(result.mutatedProfile.generation).toBe(profile.generation + 1);
      expect(result.mutatedProfile.mutations.length).toBe(1);
      
      // Check mutation record
      const mutation = result.mutatedProfile.mutations[0];
      expect(mutation).toBeDefined();
      expect(mutation!.actionId).toBe('conquest_action');
      expect(mutation!.tick).toBe(1);
    });

    it('should trigger dream reflections on threshold crossings', () => {
      // Start with low power ambition
      const profile = parseAmbition("I am but a humble servant of the people");
      expect(profile.power).toBeLessThan(0.3);
      
      // Mock multiple power-increasing actions
      const powerAction = {
        id: 'military_recruitment',
        label: 'Recruit Army',
        description: 'Build military forces',
        satisfies: ['army'],
        costs: { gold: 100 },
        risks: {},
        time: '2 turns',
        requirements: [],
        mapRefs: [],
        rewards: {},
        effects: []
      };
      
      let currentProfile = profile;
      let dreamEvents = [];
      
      // Apply multiple power actions to cross threshold
      for (let i = 0; i < 5; i++) {
        const result = applyActionMutation(currentProfile, powerAction, i + 1);
        currentProfile = result.mutatedProfile;
        
        if (result.dreamThresholds.length > 0) {
          dreamEvents.push(...result.dreamThresholds);
        }
      }
      
      // Should have crossed power thresholds and triggered dreams
      expect(currentProfile.power).toBeGreaterThan(profile.power);
      expect(dreamEvents.length).toBeGreaterThan(0);
      
      // Check that power crossed a threshold
      const powerDreams = dreamEvents.filter(d => d.domain === 'power');
      expect(powerDreams.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-System Determinism', () => {
    it('should produce identical results across all systems with same inputs', () => {
      const ambitionText = "Balanced wisdom guides my path to prosperity and honor";
      const seedValue = testSeed;
      
      // Run 1
      const profile1 = parseAmbition(ambitionText);
      const world1 = seed(profile1, seedValue);
      const rng1 = new SeededRandom(seedValue + 1000);
      const goals1 = generateDynamicGoals(profile1, rng1, 4, 2);
      const proposals1 = proposeDynamic(goals1, world1, profile1, knowledgeBase, seedValue);
      
      // Run 2
      const profile2 = parseAmbition(ambitionText);
      const world2 = seed(profile2, seedValue);
      const rng2 = new SeededRandom(seedValue + 1000);
      const goals2 = generateDynamicGoals(profile2, rng2, 4, 2);
      const proposals2 = proposeDynamic(goals2, world2, profile2, knowledgeBase, seedValue);
      
      // Everything should be identical
      expect(profile1).toEqual(profile2);
      expect(world1).toEqual(world2);
      expect(goals1).toEqual(goals2);
      expect(proposals1).toEqual(proposals2);
    });

    it('should maintain consistency across different ambition expressions', () => {
      const testCases = [
        "I will rule with justice and divine blessing",
        "Through trade and craft I shall build an empire",
        "Freedom and independence for all peoples",
        "Power through conquest and military might",
        "Sacred duty calls me to serve the gods"
      ];
      
      testCases.forEach((ambitionText, index) => {
        const seedValue = testSeed + index * 10000;
        
        // Parse ambition
        const profile = parseAmbition(ambitionText);
        
        // Generate world
        const world = seed(profile, seedValue);
        
        // Generate goals
        const rng = new SeededRandom(seedValue + 1000);
        const goals = generateDynamicGoals(profile, rng, 3, 2);
        
        // Generate proposals
        const proposals = proposeDynamic(goals, world, profile, knowledgeBase, seedValue);
        
        // Validate consistency
        expect(profile.power + profile.wealth + profile.faith + 
               profile.virtue + profile.freedom + profile.creation).toBeCloseTo(1.0, 2);
        expect(world.regions.length).toBeGreaterThan(0);
        expect(world.factions.length).toBeGreaterThan(0);
        expect(goals.nodes.length).toBeGreaterThanOrEqual(2);
        expect(proposals.length).toBeGreaterThan(0);
        
        // Check domain consistency
        world.regions.forEach(region => {
          expect(Object.keys(region.domainAffinities)).toHaveLength(6);
        });
        
        world.factions.forEach(faction => {
          expect(Object.keys(faction.domainAffinities)).toHaveLength(6);
        });
      });
    });
  });

  describe('Performance and Scale', () => {
    it('should handle large goal graphs efficiently', () => {
      const profile = parseAmbition("Complex ambitions spanning all domains of power");
      const rng = new SeededRandom(testSeed);
      
      const startTime = Date.now();
      const goals = generateDynamicGoals(profile, rng, 10, 5); // Larger graph
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
      expect(goals.nodes.length).toBeGreaterThanOrEqual(5);
      expect(goals.nodes.length).toBeLessThanOrEqual(10);
    });

    it('should handle world generation with many regions efficiently', () => {
      const profile = parseAmbition("Empire spanning vast territories");
      
      const startTime = Date.now();
      const world = seed(profile, testSeed);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // Should complete in < 0.5 seconds
      expect(world.regions.length).toBeGreaterThanOrEqual(6);
      expect(world.factions.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty ambition text gracefully', () => {
      const profile = parseAmbition("");
      
      // Should use default balanced weights
      expect(profile.power).toBeGreaterThan(0);
      expect(profile.virtue).toBeGreaterThan(0);
      
      // Should still generate valid world
      const world = seed(profile, testSeed);
      expect(world.regions.length).toBeGreaterThan(0);
    });

    it('should handle extreme single-domain ambitions', () => {
      const extremePowerText = "POWER POWER POWER DOMINATE CONQUER RULE AUTHORITY COMMAND CONTROL";
      const profile = parseAmbition(extremePowerText);
      
      // Should be heavily power-focused but still normalized
      expect(profile.power).toBeGreaterThan(0.7);
      
      const sum = profile.power + profile.wealth + profile.faith + 
                 profile.virtue + profile.freedom + profile.creation;
      expect(sum).toBeCloseTo(1.0, 2);
      
      // Should still generate valid content
      const world = seed(profile, testSeed);
      const rng = new SeededRandom(testSeed + 1000);
      const goals = generateDynamicGoals(profile, rng, 3, 2);
      
      expect(world.regions.length).toBeGreaterThan(0);
      expect(goals.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle nonsensical ambition text', () => {
      const nonsenseText = "xyz qwerty asdf zxcv banana helicopter refrigerator";
      const profile = parseAmbition(nonsenseText);
      
      // Should fall back to balanced default
      expect(profile.power).toBeCloseTo(0.25, 1);
      expect(profile.virtue).toBeCloseTo(0.25, 1);
      
      // Should still work with other systems
      const world = seed(profile, testSeed);
      expect(world.regions.length).toBeGreaterThan(0);
    });
  });
});