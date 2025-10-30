import { describe, it, expect, beforeEach } from 'vitest';
import * as worldGen from '../src/modules/worldGen.js';
import * as sim from '../src/modules/sim.js';
import * as events from '../src/modules/events.js';
import * as dsl from '../src/modules/dsl.js';
import * as planner from '../src/modules/planner.js';
import { AmbitionCanonical, WorldState } from '../src/types/index.js';

describe('Faith & Omens System', () => {
  const testAmbition: AmbitionCanonical = {
    archetypes: ['priest'],
    virtues: ['wisdom'],
    vices: [],
    weights: { priest: 0.6, wisdom: 0.4 },
  };

  describe('World Generation', () => {
    it('should generate regions with piety and heresy values', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      for (const region of world.regions) {
        expect(region.piety).toBeGreaterThanOrEqual(0);
        expect(region.piety).toBeLessThanOrEqual(100);
        expect(region.heresy).toBeGreaterThanOrEqual(0);
        expect(region.heresy).toBeLessThanOrEqual(100);
      }
    });

    it('should generate piety around 55 ± 10', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      for (const region of world.regions) {
        expect(region.piety).toBeGreaterThanOrEqual(45);
        expect(region.piety).toBeLessThanOrEqual(65);
      }
    });

    it('should generate heresy around 20 ± 8', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      for (const region of world.regions) {
        expect(region.heresy).toBeGreaterThanOrEqual(12);
        expect(region.heresy).toBeLessThanOrEqual(28);
      }
    });

    it('should generate deterministic piety/heresy with same seed', () => {
      const world1 = worldGen.seed(testAmbition, 42);
      const world2 = worldGen.seed(testAmbition, 42);
      
      for (let i = 0; i < world1.regions.length; i++) {
        expect(world1.regions[i].piety).toBe(world2.regions[i].piety);
        expect(world1.regions[i].heresy).toBe(world2.regions[i].heresy);
      }
    });
  });

  describe('Faith Simulation', () => {
    let testWorld: WorldState;

    beforeEach(() => {
      testWorld = worldGen.seed(testAmbition, 12345);
      // Ensure first region is controlled
      testWorld.regions[0].controlled = true;
    });

    it('should drift piety and heresy toward 50', () => {
      // Set extreme values
      testWorld.regions[0].piety = 80;
      testWorld.regions[0].heresy = 20;
      
      const newWorld = sim.tick(testWorld);
      
      // Should drift toward 50
      expect(newWorld.regions[0].piety).toBeLessThan(80);
      expect(newWorld.regions[0].heresy).toBeGreaterThan(20);
    });

    it('should decay piety when faith legitimacy is low', () => {
      testWorld.legitimacy.faith = 30; // Below 40 threshold
      testWorld.regions[0].piety = 60;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.regions[0].piety).toBeLessThan(60);
    });

    it('should increase heresy when faith legitimacy is low', () => {
      testWorld.legitimacy.faith = 30; // Below 40 threshold
      const originalHeresy = testWorld.regions[0].heresy;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.regions[0].heresy).toBeGreaterThan(originalHeresy);
    });

    it('should reduce unrest when piety > 70', () => {
      testWorld.regions[0].piety = 75;
      testWorld.regions[0].unrest = 50;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.regions[0].unrest).toBeLessThan(50);
    });

    it('should cost gold for festival upkeep when piety > 70', () => {
      testWorld.regions[0].piety = 75;
      const originalGold = testWorld.resources.gold;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.resources.gold).toBeLessThan(originalGold);
    });

    it('should add heresy_pressure trait when heresy > 70', () => {
      testWorld.regions[0].heresy = 80;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.traits).toContain('heresy_pressure');
    });

    it('should reduce loyalty when heresy > 70', () => {
      testWorld.regions[0].heresy = 80;
      const originalLoyalty = testWorld.regions[0].people.loyalty;
      
      const newWorld = sim.tick(testWorld);
      
      expect(newWorld.regions[0].people.loyalty).toBeLessThan(originalLoyalty);
    });

    it('should not apply faith effects to uncontrolled regions', () => {
      testWorld.regions[0].controlled = false;
      testWorld.legitimacy.faith = 30;
      testWorld.regions[0].piety = 60;
      const originalPiety = testWorld.regions[0].piety;
      
      const newWorld = sim.tick(testWorld);
      
      // Should only drift, not decay from faith legitimacy
      expect(newWorld.regions[0].piety).toBe(originalPiety - 1); // Only drift
    });
  });

  describe('DSL Piety/Heresy Effects', () => {
    it('should parse piety and heresy effects', () => {
      const yamlWithFaith = `
requirements:
  faith:
    label: "Faith Actions"
    paths:
      donate_temple:
        costs:
          gold: 200
        time: "1 turn"
        effects: ["+legitimacy.faith = 8", "+region.piety = 12", "-region.heresy = 5"]
`;

      const kb = dsl.load(yamlWithFaith);
      const path = kb.requirements.faith.paths.donate_temple;
      
      expect(path.effects).toHaveLength(3);
      
      // Check piety effect
      const pietyEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'piety'
      );
      expect(pietyEffect).toEqual({
        type: 'region',
        property: 'piety',
        change: 12
      });
      
      // Check heresy effect
      const heresyEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'heresy'
      );
      expect(heresyEffect).toEqual({
        type: 'region',
        property: 'heresy',
        change: -5
      });
    });

    it('should handle negative faith effects', () => {
      const yamlWithNegative = `
requirements:
  apostasy:
    label: "Apostasy"
    paths:
      abandon_faith:
        effects: ["-region.piety = 20", "+region.heresy = 15"]
`;

      const kb = dsl.load(yamlWithNegative);
      const path = kb.requirements.apostasy.paths.abandon_faith;
      
      const pietyEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'piety'
      );
      expect(pietyEffect?.change).toBe(-20);
      
      const heresyEffect = path.effects?.find((effect: any) => 
        effect.type === 'region' && effect.property === 'heresy'
      );
      expect(heresyEffect?.change).toBe(15);
    });

    it('should parse faith effects in generator actions', () => {
      const yamlWithGenerator = `
generators:
  - id: "heresy_outbreak"
    conditions: ["heresy_pressure"]
    action:
      id: "deal_with_heresy"
      label: "Deal with Heresy"
      description: "Heresy spreads"
      satisfies: ["faith"]
      effects: ["-region.heresy = 10", "+region.piety = 8"]
`;

      const kb = dsl.load(yamlWithGenerator);
      const action = kb.generators[0].action;
      
      expect(action.effects).toHaveLength(2);
      
      const heresyEffect = action.effects?.[0];
      expect(heresyEffect).toEqual({
        type: 'region',
        property: 'heresy',
        change: -10
      });
    });
  });

  describe('Faith Event Generation', () => {
    let baseWorld: WorldState;
    let modifiedWorld: WorldState;

    beforeEach(() => {
      baseWorld = worldGen.seed(testAmbition, 12345);
      modifiedWorld = JSON.parse(JSON.stringify(baseWorld));
    });

    it('should generate events for significant piety increases', () => {
      modifiedWorld.regions[0].piety = baseWorld.regions[0].piety + 15;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const pietyEvent = generatedEvents.find(event => 
        event.text.includes('Religious devotion flourishes')
      );
      
      expect(pietyEvent).toBeDefined();
      expect(pietyEvent?.text).toContain('15');
    });

    it('should generate events for significant piety decreases', () => {
      modifiedWorld.regions[0].piety = baseWorld.regions[0].piety - 12;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const pietyEvent = generatedEvents.find(event => 
        event.text.includes('Faith wanes')
      );
      
      expect(pietyEvent).toBeDefined();
      expect(pietyEvent?.text).toContain('12');
    });

    it('should generate events for significant heresy increases', () => {
      modifiedWorld.regions[0].heresy = baseWorld.regions[0].heresy + 10;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const heresyEvent = generatedEvents.find(event => 
        event.text.includes('Heterodox beliefs spread')
      );
      
      expect(heresyEvent).toBeDefined();
      expect(heresyEvent?.text).toContain('10');
    });

    it('should generate heresy crisis events when heresy_pressure trait appears', () => {
      modifiedWorld.traits.push('heresy_pressure');
      modifiedWorld.regions[0].heresy = 75; // High heresy
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const crisisEvent = generatedEvents.find(event => 
        event.text.includes('heretical movement')
      );
      
      expect(crisisEvent).toBeDefined();
      expect(crisisEvent?.choices).toHaveLength(3);
      
      // Check choice effects include regional improvements
      const inquisitionChoice = crisisEvent?.choices.find(choice => 
        choice.label.includes('inquisition')
      );
      expect(inquisitionChoice?.effects?.some(effect => 
        typeof effect === 'string' && effect.includes('-region.heresy')
      )).toBe(true);
    });

    it('should not generate faith events for uncontrolled regions', () => {
      modifiedWorld.regions[0].controlled = false;
      modifiedWorld.regions[0].piety = baseWorld.regions[0].piety + 15;
      
      const generatedEvents = events.alchemize(baseWorld, modifiedWorld);
      
      const faithEvent = generatedEvents.find(event => 
        event.text.includes('piety') || event.text.includes('faith')
      );
      
      expect(faithEvent).toBeUndefined();
    });
  });

  describe('Omen Event Generation', () => {
    let testWorld: WorldState;

    beforeEach(() => {
      testWorld = worldGen.seed(testAmbition, 12345);
      testWorld.regions[0].controlled = true;
    });

    it('should have higher omen probability with high piety', () => {
      testWorld.regions[0].piety = 80; // High piety should increase chance
      
      // Test multiple ticks to check probability
      let omenFound = false;
      for (let tick = 0; tick < 50; tick++) {
        testWorld.tick = tick;
        const omenEvents = events.alchemize(testWorld, testWorld);
        if (omenEvents.some(event => event.id.includes('omen') || event.id.includes('prophet'))) {
          omenFound = true;
          break;
        }
      }
      
      // With high piety and 50 iterations, should find at least one omen
      expect(omenFound).toBe(true);
    });

    it('should have higher omen probability with low faith legitimacy', () => {
      testWorld.legitimacy.faith = 30; // Low faith should increase chance
      
      // Test multiple ticks to check probability  
      let omenFound = false;
      for (let tick = 0; tick < 50; tick++) {
        testWorld.tick = tick;
        const omenEvents = events.alchemize(testWorld, testWorld);
        if (omenEvents.some(event => event.id.includes('omen') || event.id.includes('prophet'))) {
          omenFound = true;
          break;
        }
      }
      
      // With low faith and 50 iterations, should find at least one omen
      expect(omenFound).toBe(true);
    });

    it('should generate different omen types', () => {
      testWorld.legitimacy.faith = 20; // Very low faith for high omen chance
      testWorld.regions[0].piety = 80; // High piety
      
      const omenTypes = new Set<string>();
      for (let tick = 0; tick < 100; tick++) {
        testWorld.tick = tick;
        const omenEvents = events.alchemize(testWorld, testWorld);
        for (const event of omenEvents) {
          if (event.id.includes('good_omen')) omenTypes.add('good_sign');
          if (event.id.includes('dire_omen')) omenTypes.add('dire_sign');
          if (event.id.includes('false_prophet')) omenTypes.add('false_prophet');
        }
      }
      
      // Should generate at least 2 different omen types
      expect(omenTypes.size).toBeGreaterThan(1);
    });

    it('should provide meaningful choices for omen events', () => {
      testWorld.legitimacy.faith = 20;
      testWorld.tick = 1; // Force omen generation
      
      const omenEvents = events.alchemize(testWorld, testWorld);
      const omenEvent = omenEvents.find(event => 
        event.id.includes('omen') || event.id.includes('prophet')
      );
      
      if (omenEvent) {
        expect(omenEvent.choices.length).toBeGreaterThanOrEqual(2);
        
        // Should have different approaches
        const choiceLabels = omenEvent.choices.map(choice => choice.label.toLowerCase());
        expect(choiceLabels.some(label => 
          label.includes('honor') || label.includes('appease') || label.includes('incorporate')
        )).toBe(true);
        expect(choiceLabels.some(label => 
          label.includes('ignore') || label.includes('dismiss') || label.includes('expose')
        )).toBe(true);
      }
    });
  });

  describe('Planner Faith Scoring', () => {
    let testWorld: WorldState;
    let kb: any;

    beforeEach(() => {
      testWorld = worldGen.seed(testAmbition, 12345);
      testWorld.regions[0].controlled = true;
      kb = dsl.createBasicKnowledgeBase();
    });

    it('should prioritize faith actions when faith legitimacy is low', () => {
      testWorld.legitimacy.faith = 25; // Very low faith
      
      const proposals = planner.propose({
        graph: { ambition: 'Test', nodes: [{ id: 'faith', label: 'Faith', status: 'unmet' }] },
        world: testWorld,
        kb
      });
      
      // Should include faith actions when faith legitimacy is low
      expect(proposals.some(action => 
        action.satisfies?.includes('faith') || action.id.includes('faith')
      )).toBe(true);
    });

    it('should prioritize faith actions when heresy is high', () => {
      testWorld.regions[0].heresy = 80; // Very high heresy
      
      const proposals = planner.propose({
        graph: { ambition: 'Test', nodes: [{ id: 'faith', label: 'Faith', status: 'unmet' }] },
        world: testWorld,
        kb
      });
      
      // Should prioritize actions that can address heresy
      expect(proposals.some(action => 
        action.satisfies?.includes('faith')
      )).toBe(true);
    });

    it('should leverage high piety regions', () => {
      testWorld.regions[0].piety = 85; // Very high piety
      
      const proposals = planner.propose({
        graph: { ambition: 'Test', nodes: [{ id: 'faith', label: 'Faith', status: 'unmet' }] },
        world: testWorld,
        kb
      });
      
      // Should include faith actions that can leverage high piety
      expect(proposals.some(action => 
        action.satisfies?.includes('faith')
      )).toBe(true);
    });

    it('should prioritize heresy_pressure trait resolution', () => {
      testWorld.traits.push('heresy_pressure');
      
      const proposals = planner.propose({
        graph: { ambition: 'Test', nodes: [{ id: 'faith', label: 'Faith', status: 'unmet' }] },
        world: testWorld,
        kb
      });
      
      // Should prioritize actions that address heresy pressure
      expect(proposals.some(action => 
        action.satisfies?.includes('faith')
      )).toBe(true);
    });
  });

  describe('Base Rules Integration', () => {
    it('should include faith actions in base rules', () => {
      const kb = dsl.createBasicKnowledgeBase();
      
      expect(kb.requirements.faith).toBeDefined();
      expect(kb.requirements.faith.paths.donate_to_temple).toBeDefined();
      expect(kb.requirements.faith.paths.host_pilgrimage).toBeDefined();
      expect(kb.requirements.faith.paths.seek_holy_relic).toBeDefined();
      expect(kb.requirements.faith.paths.public_fast).toBeDefined();
      expect(kb.requirements.faith.paths.denounce_heresy).toBeDefined();
    });

    it('should include faith generators', () => {
      const kb = dsl.createBasicKnowledgeBase();
      
      const heresyGenerator = kb.generators.find(gen => gen.id === 'heresy_outbreak');
      expect(heresyGenerator).toBeDefined();
      expect(heresyGenerator?.conditions).toContain('heresy_pressure');
      
      const prophetGenerator = kb.generators.find(gen => gen.id === 'false_prophet');
      expect(prophetGenerator).toBeDefined();
      
      const festivalGenerator = kb.generators.find(gen => gen.id === 'religious_festival');
      expect(festivalGenerator).toBeDefined();
    });

    it('should have balanced faith action effects', () => {
      const kb = dsl.createBasicKnowledgeBase();
      
      // Donate to temple should boost faith legitimacy and piety
      const donateAction = kb.requirements.faith.paths.donate_to_temple;
      expect(donateAction.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'legitimacy' && effect.meter === 'faith'
      )).toBe(true);
      expect(donateAction.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'region' && effect.property === 'piety'
      )).toBe(true);
      
      // Denounce heresy should reduce heresy
      const denounceAction = kb.requirements.faith.paths.denounce_heresy;
      expect(denounceAction.effects?.some(effect => 
        typeof effect === 'object' && effect.type === 'region' && effect.property === 'heresy' && effect.change < 0
      )).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should maintain faith system through full workflow', () => {
      // 1. Generate world with faith system
      const world = worldGen.seed(testAmbition, 12345);
      expect(world.regions[0].piety).toBeDefined();
      expect(world.regions[0].heresy).toBeDefined();
      
      // 2. Simulate tick with faith system
      const newWorld = sim.tick(world);
      expect(newWorld.regions[0].piety).toBeDefined();
      expect(newWorld.regions[0].heresy).toBeDefined();
      
      // 3. Generate events for faith changes
      const generatedEvents = events.alchemize(world, newWorld);
      expect(generatedEvents).toBeDefined();
      
      // 4. Load DSL with faith effects
      const kb = dsl.createBasicKnowledgeBase();
      expect(kb.requirements.faith).toBeDefined();
    });

    it('should create realistic faith scenarios', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      // Simulate declining faith legitimacy
      world.legitimacy.faith = 30;
      world.regions[0].piety = 60;
      
      // Multiple ticks should show piety decline and heresy increase
      let currentWorld = world;
      for (let i = 0; i < 5; i++) {
        currentWorld = sim.tick(currentWorld);
      }
      
      // Piety should have declined
      expect(currentWorld.regions[0].piety).toBeLessThan(world.regions[0].piety);
      
      // Heresy should have increased
      expect(currentWorld.regions[0].heresy).toBeGreaterThan(world.regions[0].heresy);
      
      // Heresy pressure trait should appear if heresy gets too high
      if (currentWorld.regions[0].heresy > 70) {
        expect(currentWorld.traits).toContain('heresy_pressure');
      }
    });

    it('should provide meaningful player choices for faith crises', () => {
      const world = worldGen.seed(testAmbition, 12345);
      
      // Create a heresy crisis scenario
      const heresyWorld = JSON.parse(JSON.stringify(world));
      heresyWorld.traits.push('heresy_pressure');
      heresyWorld.regions[0].heresy = 80;
      
      const generatedEvents = events.alchemize(world, heresyWorld);
      const heresyEvent = generatedEvents.find(event => 
        event.text.includes('heretical movement')
      );
      
      if (heresyEvent) {
        expect(heresyEvent.choices.length).toBeGreaterThan(0);
        
        // Should have different approaches (force, reform, dialogue)
        const approaches = heresyEvent.choices.map(choice => choice.label.toLowerCase());
        expect(approaches.some(label => label.includes('inquisition') || label.includes('force'))).toBe(true);
        expect(approaches.some(label => label.includes('reform') || label.includes('teaching'))).toBe(true);
        expect(approaches.some(label => label.includes('council') || label.includes('dialogue'))).toBe(true);
      }
    });
  });
});