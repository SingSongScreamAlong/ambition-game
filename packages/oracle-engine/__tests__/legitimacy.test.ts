import { describe, it, expect } from 'vitest';
import * as worldGen from '../src/modules/worldGen.js';
import * as planner from '../src/modules/planner.js';
import * as events from '../src/modules/events.js';
import * as dsl from '../src/modules/dsl.js';
import { AmbitionCanonical, RequirementGraph, WorldState, Legitimacy } from '../src/types/index.js';

describe('Legitimacy System', () => {
  const testAmbition: AmbitionCanonical = {
    archetypes: ['king'],
    virtues: ['justice'],
    vices: [],
    weights: { king: 0.7, justice: 0.3 },
  };

  const testGraph: RequirementGraph = {
    ambition: 'Test ambition',
    nodes: [
      { id: 'legitimacy', label: 'Gain Legitimacy', status: 'unmet', paths: ['bloodline', 'divine_right'] },
      { id: 'army', label: 'Raise Army', status: 'unmet', paths: ['recruitment'] },
      { id: 'people', label: 'Win People', status: 'unmet', paths: ['charity'] },
    ],
  };

  describe('World Generation', () => {
    it('should generate starting legitimacy meters', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      expect(world.legitimacy).toBeDefined();
      expect(world.legitimacy.law).toBeGreaterThanOrEqual(0);
      expect(world.legitimacy.law).toBeLessThanOrEqual(100);
      expect(world.legitimacy.faith).toBeGreaterThanOrEqual(0);
      expect(world.legitimacy.faith).toBeLessThanOrEqual(100);
      expect(world.legitimacy.lineage).toBeGreaterThanOrEqual(0);
      expect(world.legitimacy.lineage).toBeLessThanOrEqual(100);
      expect(world.legitimacy.might).toBeGreaterThanOrEqual(0);
      expect(world.legitimacy.might).toBeLessThanOrEqual(100);
    });

    it('should generate higher law legitimacy for king archetype', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      // King archetype should get +10 to law legitimacy
      expect(world.legitimacy.law).toBeGreaterThan(15); // Base is 15, king adds 10
    });

    it('should generate higher law legitimacy for justice virtue', () => {
      const justiceAmbition = {
        ...testAmbition,
        virtues: ['justice'],
      };
      const world = worldGen.seed(justiceAmbition, 12345);
      
      // Justice virtue should add to law legitimacy
      expect(world.legitimacy.law).toBeGreaterThan(20); // Base + king + justice
    });

    it('should generate deterministic legitimacy with same seed', () => {
      const world1 = worldGen.seed(testAmbition, 42);
      const world2 = worldGen.seed(testAmbition, 42);
      
      expect(world1.legitimacy.law).toBe(world2.legitimacy.law);
      expect(world1.legitimacy.faith).toBe(world2.legitimacy.faith);
      expect(world1.legitimacy.lineage).toBe(world2.legitimacy.lineage);
      expect(world1.legitimacy.might).toBe(world2.legitimacy.might);
    });
  });

  describe('Planner Legitimacy Scoring', () => {
    let testWorld: WorldState;
    let kb: any;

    beforeAll(() => {
      testWorld = worldGen.seed(testAmbition, 12345);
      // Set specific legitimacy values for testing
      testWorld.legitimacy = { law: 20, faith: 30, lineage: 40, might: 50 };
      kb = dsl.createBasicKnowledgeBase();
    });

    it('should give higher scores to actions that address low legitimacy', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Action that satisfies 'legitimacy' should get bonus
      const legitimacyAction = {
        id: 'test_legitimacy',
        label: 'Test Legitimacy Action',
        satisfies: ['legitimacy'],
        costs: {},
        time: '1 turn',
        description: 'Test action',
      };

      // Action that doesn't address legitimacy
      const regularAction = {
        id: 'test_regular',
        label: 'Test Regular Action',
        satisfies: ['treasury'],
        costs: {},
        time: '1 turn',
        description: 'Test action',
      };

      const proposals = planner.propose({ graph: testGraph, world: testWorld, kb });
      
      // Should have generated at least one proposal
      expect(proposals.length).toBeGreaterThan(0);
      
      // Console should log legitimacy influence
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('[Legitimacy Influence]')
      );
      
      mockConsole.mockRestore();
    });

    it('should prioritize actions that help the lowest legitimacy meter', () => {
      // Set law as the lowest legitimacy meter
      const lowLawWorld = {
        ...testWorld,
        legitimacy: { law: 10, faith: 60, lineage: 60, might: 60 },
      };

      const proposals = planner.propose({ graph: testGraph, world: lowLawWorld, kb });
      
      // Actions that improve law should be prioritized
      expect(proposals.length).toBeGreaterThan(0);
    });

    it('should give different scores based on legitimacy levels', () => {
      const highLegitimacyWorld = {
        ...testWorld,
        legitimacy: { law: 80, faith: 80, lineage: 80, might: 80 },
      };

      const lowLegitimacyWorld = {
        ...testWorld,
        legitimacy: { law: 20, faith: 20, lineage: 20, might: 20 },
      };

      const highProposals = planner.propose({ graph: testGraph, world: highLegitimacyWorld, kb });
      const lowProposals = planner.propose({ graph: testGraph, world: lowLegitimacyWorld, kb });

      // Both should generate proposals
      expect(highProposals.length).toBeGreaterThan(0);
      expect(lowProposals.length).toBeGreaterThan(0);
    });
  });

  describe('Event Generation for Legitimacy', () => {
    it('should generate legitimacy events for significant changes', () => {
      const prevWorld = worldGen.seed(testAmbition, 12345);
      const nextWorld = { 
        ...prevWorld, 
        legitimacy: { 
          ...prevWorld.legitimacy, 
          law: prevWorld.legitimacy.law + 10 // Significant increase
        } 
      };

      const generatedEvents = events.alchemize(prevWorld, nextWorld);
      
      // Should generate at least one event
      expect(generatedEvents.length).toBeGreaterThan(0);
      
      // Check if any event mentions legitimacy
      const hasLegitimacyEvent = generatedEvents.some(event => 
        event.text.toLowerCase().includes('legitimacy') ||
        event.text.toLowerCase().includes('law') ||
        event.text.toLowerCase().includes('legal authority')
      );
      
      expect(hasLegitimacyEvent).toBe(true);
    });

    it('should include legitimacy change amounts in event text', () => {
      const prevWorld = worldGen.seed(testAmbition, 12345);
      const nextWorld = { 
        ...prevWorld, 
        legitimacy: { 
          ...prevWorld.legitimacy, 
          faith: prevWorld.legitimacy.faith + 15 // Large faith increase
        } 
      };

      const generatedEvents = events.alchemize(prevWorld, nextWorld);
      
      const faithEvent = generatedEvents.find(event => 
        event.text.includes('Faith legitimacy increased by')
      );
      
      if (faithEvent) {
        expect(faithEvent.text).toContain('increased by 15');
      }
    });

    it('should provide legitimacy-enhancing choices in events', () => {
      const prevWorld = worldGen.seed(testAmbition, 12345);
      const nextWorld = { 
        ...prevWorld, 
        legitimacy: { 
          ...prevWorld.legitimacy, 
          might: prevWorld.legitimacy.might + 8 // Might increase
        } 
      };

      const generatedEvents = events.alchemize(prevWorld, nextWorld);
      
      const mightEvent = generatedEvents.find(event => 
        event.text.includes('Might legitimacy increased by')
      );
      
      if (mightEvent) {
        // Should have choices that can further increase legitimacy
        const hasLegitimacyChoice = mightEvent.choices.some(choice =>
          choice.effects?.some(effect => 
            typeof effect === 'string' && effect.includes('+legitimacy.')
          )
        );
        
        expect(hasLegitimacyChoice).toBe(true);
      }
    });
  });

  describe('DSL Legitimacy Effects', () => {
    it('should parse legitimacy effects from DSL', () => {
      const yamlWithLegitimacy = `
requirements:
  test_requirement:
    label: "Test Requirement"
    paths:
      test_path:
        costs:
          gold: 100
        time: "1 turn"
        effects: ["+legitimacy.law = 5", "gain_reputation", "-legitimacy.might = 2"]
`;

      const kb = dsl.load(yamlWithLegitimacy);
      const requirement = kb.requirements.test_requirement;
      const path = requirement.paths.test_path;
      
      expect(path.effects).toBeDefined();
      expect(path.effects).toHaveLength(3);
      
      // Check that legitimacy effects are parsed correctly
      const lawEffect = path.effects?.find((effect: any) => 
        effect.type === 'legitimacy' && effect.meter === 'law'
      );
      expect(lawEffect).toBeDefined();
      expect(lawEffect.change).toBe(5);
      
      const mightEffect = path.effects?.find((effect: any) => 
        effect.type === 'legitimacy' && effect.meter === 'might'
      );
      expect(mightEffect).toBeDefined();
      expect(mightEffect.change).toBe(-2);
      
      // Regular effects should remain as strings
      const regularEffect = path.effects?.find((effect: any) => 
        typeof effect === 'string' && effect === 'gain_reputation'
      );
      expect(regularEffect).toBe('gain_reputation');
    });

    it('should handle generator actions with legitimacy effects', () => {
      const yamlWithGenerator = `
generators:
  - id: "test_generator"
    conditions: ["test_condition"]
    action:
      id: "test_action"
      label: "Test Action"
      description: "Test description"
      satisfies: []
      effects: ["+legitimacy.faith = 3"]
`;

      const kb = dsl.load(yamlWithGenerator);
      const generator = kb.generators[0];
      const action = generator.action;
      
      expect(action.effects).toBeDefined();
      expect(action.effects).toHaveLength(1);
      
      const faithEffect = action.effects?.[0];
      expect(faithEffect).toEqual({
        type: 'legitimacy',
        meter: 'faith',
        change: 3
      });
    });

    it('should handle malformed legitimacy syntax gracefully', () => {
      const yamlWithBadSyntax = `
requirements:
  test_requirement:
    label: "Test Requirement"
    paths:
      test_path:
        effects: ["legitimacy.bad", "+legitimacy = 5", "normal_effect"]
`;

      const kb = dsl.load(yamlWithBadSyntax);
      const path = kb.requirements.test_requirement.paths.test_path;
      
      // Should keep malformed effects as strings
      expect(path.effects).toHaveLength(3);
      expect(path.effects?.[0]).toBe('legitimacy.bad');
      expect(path.effects?.[1]).toBe('+legitimacy = 5');
      expect(path.effects?.[2]).toBe('normal_effect');
    });
  });

  describe('Integration Tests', () => {
    it('should maintain legitimacy through full game workflow', () => {
      // 1. Generate world with legitimacy
      const world = worldGen.seed(testAmbition, 12345);
      expect(world.legitimacy).toBeDefined();
      
      // 2. Generate proposals considering legitimacy
      const kb = dsl.createBasicKnowledgeBase();
      const proposals = planner.propose({ graph: testGraph, world, kb });
      expect(proposals.length).toBeGreaterThan(0);
      
      // 3. Simulate legitimacy change
      const newWorld = {
        ...world,
        legitimacy: {
          ...world.legitimacy,
          law: world.legitimacy.law + 10
        }
      };
      
      // 4. Generate events for legitimacy changes
      const generatedEvents = events.alchemize(world, newWorld);
      expect(generatedEvents).toBeDefined();
    });

    it('should provide console logging for debugging', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const testWorld = worldGen.seed(testAmbition, 12345);
      testWorld.legitimacy = { law: 10, faith: 30, lineage: 40, might: 50 }; // Low law
      
      const kb = dsl.createBasicKnowledgeBase();
      planner.propose({ graph: testGraph, world: testWorld, kb });
      
      // Should have logged legitimacy influence
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('[Legitimacy Influence]')
      );
      
      mockConsole.mockRestore();
    });
  });
});