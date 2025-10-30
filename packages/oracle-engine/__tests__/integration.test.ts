import { describe, it, expect } from 'vitest';
import { 
  intentParser, 
  graphForge, 
  worldGen, 
  dsl, 
  planner, 
  sim, 
  events 
} from '../src/index.js';

describe('Oracle Engine Integration', () => {
  it('should complete full workflow: ambition -> graph -> world -> proposals', () => {
    const seed = 12345;
    const rawAmbition = "I want to be a just king who protects his people";

    // 1. Parse ambition
    const ambition = intentParser.parse({ raw: rawAmbition });
    expect(ambition.archetypes).toContain('king');
    expect(ambition.virtues).toContain('justice');

    // 2. Generate requirement graph
    const graph = graphForge.fromAmbition(ambition);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.every(n => n.status === 'unmet')).toBe(true);

    // 3. Generate world
    const world = worldGen.seed(ambition, seed);
    expect(world.seed).toBe(seed);
    expect(world.regions.length).toBeGreaterThanOrEqual(6);
    expect(world.factions.length).toBe(4);

    // 4. Load knowledge base
    const kb = dsl.createBasicKnowledgeBase();
    expect(Object.keys(kb.requirements).length).toBeGreaterThan(0);
    expect(kb.generators.length).toBeGreaterThan(0);

    // 5. Generate proposals
    const proposals = planner.propose({ graph, world, kb });
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.length).toBeLessThanOrEqual(5);

    // All proposals should be valid
    proposals.forEach(proposal => {
      expect(proposal.id).toBeDefined();
      expect(proposal.description).toBeDefined();
      expect(proposal.time).toBeDefined();
      expect(proposal.satisfies).toBeDefined();
    });
  });

  it('should maintain deterministic results with same seed', () => {
    const seed = 42;
    const rawAmbition = "I want to be a warrior";

    // First run
    const ambition1 = intentParser.parse({ raw: rawAmbition });
    const graph1 = graphForge.fromAmbition(ambition1);
    const world1 = worldGen.seed(ambition1, seed);

    // Second run with same seed
    const ambition2 = intentParser.parse({ raw: rawAmbition });
    const graph2 = graphForge.fromAmbition(ambition2);
    const world2 = worldGen.seed(ambition2, seed);

    // Results should be identical
    expect(world1.seed).toBe(world2.seed);
    expect(world1.regions.length).toBe(world2.regions.length);
    expect(world1.regions[0].name).toBe(world2.regions[0].name);
    expect(world1.resources.gold).toBe(world2.resources.gold);
    expect(world1.factions[0].name).toBe(world2.factions[0].name);
  });

  it('should simulate world progression over multiple ticks', () => {
    const seed = 123;
    const ambition = intentParser.parse({ raw: "I want to be a merchant king" });
    let world = worldGen.seed(ambition, seed);
    const graph = graphForge.fromAmbition(ambition);
    const kb = dsl.createBasicKnowledgeBase();

    const initialTick = world.tick;
    const initialGold = world.resources.gold;

    // Simulate several ticks
    for (let i = 0; i < 3; i++) {
      const proposals = planner.propose({ graph, world, kb });
      
      // Pick a cheap action if available
      const action = proposals.find(p => 
        !p.costs?.gold || p.costs.gold <= world.resources.gold
      );
      
      const actionsToResolve = action ? [action] : [];
      const prevWorld = JSON.parse(JSON.stringify(world));
      
      world = sim.tick(world, actionsToResolve);
      
      // Generate events from the changes
      const eventCards = events.alchemize(prevWorld, world);
      expect(Array.isArray(eventCards)).toBe(true);
      expect(eventCards.length).toBeLessThanOrEqual(3);
    }

    // World should have progressed
    expect(world.tick).toBe(initialTick + 3);
    
    // Some changes should have occurred (resources, loyalty, etc.)
    const totalChanges = 
      Math.abs(world.resources.gold - initialGold) +
      Math.abs(world.people.loyalty - 0.5) +
      Math.abs(world.people.unrest);
    
    expect(totalChanges).toBeGreaterThan(0);
  });

  it('should generate meaningful events from world changes', () => {
    const ambition = intentParser.parse({ raw: "I want to be a king" });
    const prevWorld = worldGen.seed(ambition, 456);
    
    // Create next world with significant changes
    const nextWorld = JSON.parse(JSON.stringify(prevWorld));
    nextWorld.tick += 1;
    nextWorld.resources.gold -= 200; // Major resource loss
    nextWorld.people.unrest += 0.3; // Major unrest increase
    nextWorld.regions[0].controlled = false; // Lost territory

    const eventCards = events.alchemize(prevWorld, nextWorld);

    expect(eventCards.length).toBeGreaterThan(0);
    
    // Events should have meaningful content
    eventCards.forEach(event => {
      expect(event.id).toBeDefined();
      expect(event.text.length).toBeGreaterThan(50); // Substantial description
      expect(event.choices.length).toBeGreaterThan(0);
      
      event.choices.forEach(choice => {
        expect(choice.id).toBeDefined();
        expect(choice.label).toBeDefined();
      });
    });
  });

  it('should handle edge case: no viable actions', () => {
    const ambition = intentParser.parse({ raw: "I want to be a king" });
    const world = worldGen.seed(ambition, 789);
    
    // Create impossible situation - no resources
    world.resources.gold = 0;
    world.resources.grain = 0;
    world.resources.iron = 0;
    world.resources.wood = 0;
    world.resources.stone = 0;
    world.forces.units = 0;
    
    const graph = graphForge.fromAmbition(ambition);
    const kb = dsl.createBasicKnowledgeBase();

    const proposals = planner.propose({ graph, world, kb });

    // Should either return empty array or only free actions
    if (proposals.length > 0) {
      proposals.forEach(proposal => {
        const totalCost = Object.values(proposal.costs || {}).reduce((sum, cost) => sum + cost, 0);
        expect(totalCost).toBe(0); // Only free actions should be available
      });
    }
  });

  it('should provide consistent DSL loading and parsing', () => {
    const kb1 = dsl.createBasicKnowledgeBase();
    const kb2 = dsl.createBasicKnowledgeBase();

    // Should be identical
    expect(Object.keys(kb1.requirements)).toEqual(Object.keys(kb2.requirements));
    expect(kb1.generators.length).toBe(kb2.generators.length);

    // Should have expected structure
    expect(kb1.requirements.land).toBeDefined();
    expect(kb1.requirements.army).toBeDefined();
    expect(kb1.requirements.people).toBeDefined();
    expect(kb1.generators.some(g => g.id === 'iron_caravan')).toBe(true);
  });
});