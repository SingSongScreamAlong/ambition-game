import { describe, it, expect } from 'vitest';
import * as worldGen from '../src/modules/worldGen.js';
import * as sim from '../src/modules/sim.js';
import * as events from '../src/modules/events.js';
import * as dsl from '../src/modules/dsl.js';
import { AmbitionCanonical, WorldState } from '../src/types/index.js';

describe('Justice & Law System', () => {
  const testAmbition: AmbitionCanonical = {
    archetypes: ['king'],
    virtues: ['justice'],
    vices: [],
    weights: { king: 0.7, justice: 0.3 },
  };

  describe('World Generation', () => {
    it('should generate regions with lawfulness and unrest values', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      for (const region of world.regions) {
        expect(region.lawfulness).toBeGreaterThanOrEqual(0);
        expect(region.lawfulness).toBeLessThanOrEqual(100);
        expect(region.unrest).toBeGreaterThanOrEqual(0);
        expect(region.unrest).toBeLessThanOrEqual(100);
      }
    });

    it('should generate lawfulness around 60 ± 10', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      for (const region of world.regions) {
        expect(region.lawfulness).toBeGreaterThanOrEqual(50);
        expect(region.lawfulness).toBeLessThanOrEqual(70);
      }
    });

    it('should generate unrest around 25 ± 10', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      for (const region of world.regions) {
        expect(region.unrest).toBeGreaterThanOrEqual(15);
        expect(region.unrest).toBeLessThanOrEqual(35);
      }
    });

    it('should generate deterministic lawfulness with same seed', () => {
      const world1 = worldGen.seed(testAmbition, 42);
      const world2 = worldGen.seed(testAmbition, 42);
      
      for (let i = 0; i < world1.regions.length; i++) {
        expect(world1.regions[i].lawfulness).toBe(world2.regions[i].lawfulness);
        expect(world1.regions[i].unrest).toBe(world2.regions[i].unrest);
      }
    });
  });

  describe('Simulation Tick', () => {
    let testWorld: WorldState;

    beforeEach(() => {
      testWorld = worldGen.seed(testAmbition, 12345);
      // Ensure first region is controlled
      testWorld.regions[0].controlled = true;
    });

    it('should drift lawfulness and unrest toward 50', () => {
      // Set extreme values
      testWorld.regions[0].lawfulness = 80;
      testWorld.regions[0].unrest = 20;
      
      const newWorld = sim.tick(testWorld);
      
      // Should drift toward 50
      expect(newWorld.regions[0].lawfulness).toBeLessThan(80);
      expect(newWorld.regions[0].unrest).toBeGreaterThan(20);
    });

    it('should decay lawfulness when law legitimacy is low', () => {
      testWorld.legitimacy.law = 30; // Below 40 threshold
      testWorld.regions[0].lawfulness = 60;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.regions[0].lawfulness).toBeLessThan(60);
    });

    it('should not decay lawfulness when law legitimacy is adequate', () => {
      testWorld.legitimacy.law = 50; // Above 40 threshold
      testWorld.regions[0].lawfulness = 60;
      
      const newWorld = sim.tick(testWorld);
      
      // Should only drift toward 50, not decay
      expect(newWorld.regions[0].lawfulness).toBe(59); // 60 - 1 (drift)
    });

    it('should add high_crime trait when lawfulness < 30', () => {
      testWorld.regions[0].lawfulness = 25;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.traits).toContain('high_crime');
    });

    it('should remove high_crime trait when lawfulness improves', () => {
      testWorld.traits.push('high_crime');
      testWorld.regions[0].lawfulness = 50;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.traits).not.toContain('high_crime');
    });

    it('should reduce security and loyalty when lawfulness is low', () => {
      testWorld.regions[0].lawfulness = 20;
      const originalSecurity = testWorld.regions[0].security;
      const originalLoyalty = testWorld.regions[0].people.loyalty;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.regions[0].security).toBeLessThan(originalSecurity);
      expect(newWorld.regions[0].people.loyalty).toBeLessThan(originalLoyalty);
    });

    it('should apply bureaucracy costs when lawfulness > 70', () => {
      testWorld.regions[0].lawfulness = 80;
      const originalGold = testWorld.resources.gold;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.resources.gold).toBeLessThan(originalGold);
      expect(newWorld.traits).toContain('high_bureaucracy');
    });

    it('should not apply bureaucracy costs to uncontrolled regions', () => {
      testWorld.regions[0].controlled = false;
      testWorld.regions[0].lawfulness = 80;
      const originalGold = testWorld.resources.gold;
      
      const newWorld = sim.tick(testWorld);
      
      // Gold should only change due to other factors, not bureaucracy
      expect(newWorld.traits).not.toContain('high_bureaucracy');
    });
  });

  describe('DSL Regional Effects', () => {
    it('should parse regional lawfulness effects', () => {
      const yamlWithRegional = `
requirements:
  governance:
    label: "Governance Actions"
    paths:
      fair_trials:
        costs:
          gold: 100
        time: "1 turn"
        effects: ["+legitimacy.law = 5", "+region.lawfulness = 10", "-region.unrest = 5"]
`;

      const kb = dsl.load(yamlWithRegional);
      const path = kb.requirements.governance.paths.fair_trials;
      
      expect(path.effects).toHaveLength(3);
      
      // Check legitimacy effect
      const legitimacyEffect = path.effects?.find((effect: any) => 
        effect.type === 'legitimacy' && effect.meter === 'law'
      );
      expect(legitimacyEffect).toEqual({
        type: 'legitimacy',
        meter: 'law',
        change: 5
      });
      
      // Check regional lawfulness effect
      const lawfulnessEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'lawfulness'
      );
      expect(lawfulnessEffect).toEqual({
        type: 'region',
        property: 'lawfulness',
        change: 10
      });
      
      // Check regional unrest effect
      const unrestEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'unrest'
      );
      expect(unrestEffect).toEqual({
        type: 'region',
        property: 'unrest',
        change: -5
      });
    });

    it('should handle negative regional effects', () => {
      const yamlWithNegative = `
requirements:
  harsh_rule:
    label: "Harsh Rule"
    paths:
      suspend_justice:
        effects: ["-legitimacy.law = 8", "-region.lawfulness = 15"]
`;

      const kb = dsl.load(yamlWithNegative);
      const path = kb.requirements.harsh_rule.paths.suspend_justice;
      
      const lawfulnessEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'lawfulness'
      );
      expect(lawfulnessEffect?.change).toBe(-15);
    });

    it('should parse regional effects in generator actions', () => {
      const yamlWithGenerator = `
generators:
  - id: "crime_wave"
    conditions: ["high_crime"]
    action:
      id: "deal_with_crime"
      label: "Deal with Crime"
      description: "Crime wave hits"
      satisfies: []
      effects: ["+region.lawfulness = 5", "-region.unrest = 3"]
`;

      const kb = dsl.load(yamlWithGenerator);
      const action = kb.generators[0].action;
      
      expect(action.effects).toHaveLength(2);
      
      const lawfulnessEffect = action.effects?.[0];
      expect(lawfulnessEffect).toEqual({
        type: 'region',
        property: 'lawfulness',
        change: 5
      });
    });
  });

  describe('Event Generation', () => {
    let baseWorld: WorldState;
    let modifiedWorld: WorldState;

    beforeEach(() => {
      baseWorld = worldGen.seed(testAmbition, 12345);
      modifiedWorld = JSON.parse(JSON.stringify(baseWorld));
    });

    it('should generate events for significant lawfulness increases', () => {
      modifiedWorld.regions[0].lawfulness = baseWorld.regions[0].lawfulness + 15;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const lawfulnessEvent = generatedEvents.find(event => 
        event.text.includes('lawfulness increased')
      );
      
      expect(lawfulnessEvent).toBeDefined();
      expect(lawfulnessEvent?.text).toContain('15');
    });

    it('should generate events for significant lawfulness decreases', () => {
      modifiedWorld.regions[0].lawfulness = baseWorld.regions[0].lawfulness - 12;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const lawfulnessEvent = generatedEvents.find(event => 
        event.text.includes('lawfulness decreased')
      );
      
      expect(lawfulnessEvent).toBeDefined();
      expect(lawfulnessEvent?.text).toContain('12');
    });

    it('should generate events for significant unrest decreases', () => {
      modifiedWorld.regions[0].unrest = baseWorld.regions[0].unrest - 10;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const unrestEvent = generatedEvents.find(event => 
        event.text.includes('unrest decreased')
      );
      
      expect(unrestEvent).toBeDefined();
      expect(unrestEvent?.text).toContain('10');
    });

    it('should generate crime crisis events when high_crime trait appears', () => {
      modifiedWorld.traits.push('high_crime');
      modifiedWorld.regions[0].lawfulness = 25; // Low lawfulness
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const crimeEvent = generatedEvents.find(event => 
        event.text.includes('Criminal organizations')
      );
      
      expect(crimeEvent).toBeDefined();
      expect(crimeEvent?.choices).toHaveLength(3);
      
      // Check choice effects include regional improvements
      const crackdownChoice = crimeEvent?.choices.find(choice => 
        choice.label.includes('crackdown')
      );
      expect(crackdownChoice?.effects?.some(effect => 
        typeof effect === 'string' && effect.includes('+region.lawfulness')
      )).toBe(true);
    });

    it('should provide choices with regional effect syntax', () => {
      modifiedWorld.regions[0].lawfulness = baseWorld.regions[0].lawfulness + 12;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const lawfulnessEvent = generatedEvents.find(event => 
        event.text.includes('lawfulness increased')
      );
      
      const courtChoice = lawfulnessEvent?.choices.find(choice => 
        choice.label.includes('courts')
      );
      expect(courtChoice?.effects?.some(effect => 
        typeof effect === 'string' && effect.includes('+region.lawfulness')
      )).toBe(true);
    });

    it('should not generate justice events for uncontrolled regions', () => {
      modifiedWorld.regions[0].controlled = false;
      modifiedWorld.regions[0].lawfulness = baseWorld.regions[0].lawfulness + 15;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const justiceEvent = generatedEvents.find(event => 
        event.text.includes('lawfulness')
      );
      
      expect(justiceEvent).toBeUndefined();
    });
  });

  describe('Base Rules Integration', () => {
    it('should include governance actions in base rules', () => {
      const kb = dsl.createBasicKnowledgeBase();
      
      expect(kb.requirements.governance).toBeDefined();
      expect(kb.requirements.governance.paths.pass_fair_trial).toBeDefined();
      expect(kb.requirements.governance.paths.enforce_harsh_punishment).toBeDefined();
      expect(kb.requirements.governance.paths.codify_tax_edict).toBeDefined();
      expect(kb.requirements.governance.paths.suspend_justice).toBeDefined();
    });

    it('should include crime and corruption generators', () => {
      const kb = dsl.createBasicKnowledgeBase();
      
      const crimeGenerator = kb.generators.find(gen => gen.id === 'crime_wave');
      expect(crimeGenerator).toBeDefined();
      expect(crimeGenerator?.conditions).toContain('high_crime');
      
      const corruptionGenerator = kb.generators.find(gen => gen.id === 'judicial_corruption');
      expect(corruptionGenerator).toBeDefined();
      expect(corruptionGenerator?.conditions).toContain('high_bureaucracy');
    });

    it('should have balanced governance action effects', () => {
      const kb = dsl.createBasicKnowledgeBase();
      
      // Fair trials should boost law legitimacy and lawfulness
      const fairTrials = kb.requirements.governance.paths.pass_fair_trial;
      expect(fairTrials.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'legitimacy' && effect.meter === 'law'
      )).toBe(true);
      expect(fairTrials.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'region' && effect.property === 'lawfulness'
      )).toBe(true);
      
      // Harsh punishment should have trade-offs
      const harshPunishment = kb.requirements.governance.paths.enforce_harsh_punishment;
      expect(harshPunishment.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'legitimacy' && effect.meter === 'might'
      )).toBe(true);
      expect(harshPunishment.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'legitimacy' && effect.meter === 'law' && effect.change < 0
      )).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should maintain justice system through full workflow', () => {
      // 1. Generate world with justice system
      const world = worldGen.seed(testAmbition, 12345);
      expect(world.regions[0].lawfulness).toBeDefined();
      expect(world.regions[0].unrest).toBeDefined();
      
      // 2. Simulate tick with justice system
      const newWorld = sim.tick(world);
      expect(newWorld.regions[0].lawfulness).toBeDefined();
      expect(newWorld.regions[0].unrest).toBeDefined();
      
      // 3. Generate events for justice changes
      const generatedEvents = events.alchemize(world, newWorld);
      expect(generatedEvents).toBeDefined();
      
      // 4. Load DSL with regional effects
      const kb = dsl.createBasicKnowledgeBase();
      expect(kb.requirements.governance).toBeDefined();
    });

    it('should create realistic justice scenarios', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      // Simulate declining law legitimacy
      world.legitimacy.law = 30;
      world.regions[0].lawfulness = 60;
      
      // Multiple ticks should show lawfulness decay
      let currentWorld = world;
      for (let i = 0; i < 5; i++) {
        currentWorld = sim.tick(currentWorld);
      }
      
      // Lawfulness should have decayed
      expect(currentWorld.regions[0].lawfulness).toBeLessThan(world.regions[0].lawfulness);
      
      // Crime trait should appear if lawfulness gets too low
      if (currentWorld.regions[0].lawfulness < 30) {
        expect(currentWorld.traits).toContain('high_crime');
      }
    });

    it('should provide meaningful player choices for justice crises', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      // Create a crime crisis scenario
      const crimeWorld = JSON.parse(JSON.stringify(world));
      crimeWorld.traits.push('high_crime');
      crimeWorld.regions[0].lawfulness = 20;
      
      const generatedEvents = events.alchemize(world, crimeWorld);
      const crimeEvent = generatedEvents.find(event => 
        event.text.includes('Criminal organizations')
      );
      
      if (crimeEvent) {
        expect(crimeEvent.choices.length).toBeGreaterThan(0);
        
        // Should have different approaches (force, reform, negotiation)
        const approaches = crimeEvent.choices.map(choice => choice.label.toLowerCase());
        expect(approaches.some(label => label.includes('military') || label.includes('crackdown'))).toBe(true);
        expect(approaches.some(label => label.includes('reform') || label.includes('corruption'))).toBe(true);
      }
    });
  });
});