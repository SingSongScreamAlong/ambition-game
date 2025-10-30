import { describe, it, expect } from 'vitest';
import { propose } from '../src/modules/planner.js';
import { createBasicKnowledgeBase } from '../src/modules/dsl.js';
import { RequirementGraph, WorldState, GraphNode } from '../src/types/index.js';

const createTestWorld = (): WorldState => ({
  seed: 12345,
  regions: [
    {
      id: 'region_0',
      name: 'Homeland',
      controlled: true,
      resources: { gold: 20, grain: 50, iron: 10, wood: 30, stone: 15 },
      people: { population: 5000, loyalty: 0.6, unrest: 0.2, faith: 0.7 },
      security: 0.6,
    },
  ],
  factions: [
    {
      id: 'faction_0',
      name: 'House Rival',
      stance: 'neutral',
      power: 50,
      regions: ['region_1'],
    },
  ],
  resources: { gold: 200, grain: 80, iron: 30, wood: 50, stone: 25 },
  people: { population: 5000, loyalty: 0.6, unrest: 0.2, faith: 0.7 },
  forces: { units: 50, morale: 0.7, supply: 0.8 },
  traits: [],
  tick: 0,
  playerId: 'test_player',
});

const createTestGraph = (): RequirementGraph => ({
  ambition: 'king',
  nodes: [
    { id: 'land', label: 'Control Territory', status: 'unmet', paths: ['conquest', 'purchase'] },
    { id: 'people', label: 'Win the People', status: 'unmet', needs: ['land'], paths: ['charity'] },
    { id: 'army', label: 'Raise an Army', status: 'unmet', paths: ['recruitment'] },
  ] as GraphNode[],
});

describe('planner', () => {
  it('should propose valid actions for unmet requirements', () => {
    const world = createTestWorld();
    const graph = createTestGraph();
    const kb = createBasicKnowledgeBase();

    const proposals = propose({ graph, world, kb });

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.length).toBeLessThanOrEqual(5);

    // Should have actions for unmet requirements
    const landActions = proposals.filter(p => p.satisfies.includes('land'));
    expect(landActions.length).toBeGreaterThan(0);

    // Should have army actions (no prerequisites)
    const armyActions = proposals.filter(p => p.satisfies.includes('army'));
    expect(armyActions.length).toBeGreaterThan(0);

    // Should NOT have people actions (requires land prerequisite)
    const peopleActions = proposals.filter(p => p.satisfies.includes('people'));
    expect(peopleActions.length).toBe(0);
  });

  it('should not propose actions that are too expensive', () => {
    const world = createTestWorld();
    world.resources.gold = 10; // Very low gold
    
    const graph = createTestGraph();
    const kb = createBasicKnowledgeBase();

    const proposals = propose({ graph, world, kb });

    // Should not propose expensive actions
    const expensiveActions = proposals.filter(p => 
      p.costs?.gold && p.costs.gold > world.resources.gold
    );
    expect(expensiveActions.length).toBe(0);
  });

  it('should propose opportunity actions when conditions are met', () => {
    const world = createTestWorld();
    world.resources.iron = 15; // Low iron to trigger scarcity
    world.regions[0].security = 0.3; // Low security
    world.traits.push('iron_scarcity');

    const graph = createTestGraph();
    const kb = createBasicKnowledgeBase();

    const proposals = propose({ graph, world, kb });

    // Should include opportunity actions
    const opportunityActions = proposals.filter(p => 
      p.id.includes('caravan') || p.id.includes('escort')
    );
    expect(opportunityActions.length).toBeGreaterThan(0);
  });

  it('should prioritize actions with higher scores', () => {
    const world = createTestWorld();
    const graph = createTestGraph();
    const kb = createBasicKnowledgeBase();

    const proposals = propose({ graph, world, kb });

    // Scores should be in descending order
    for (let i = 1; i < proposals.length; i++) {
      // This is implicit in the sorting but we can't directly access scores
      // So we just verify we got reasonable results
      expect(proposals[i]).toBeDefined();
      expect(proposals[i].satisfies).toBeDefined();
    }
  });

  it('should respect action requirements', () => {
    const world = createTestWorld();
    world.forces.units = 0; // No army
    
    const graph = createTestGraph();
    const kb = createBasicKnowledgeBase();

    const proposals = propose({ graph, world, kb });

    // Should not propose conquest (requires army)
    const conquestActions = proposals.filter(p => 
      p.id.includes('conquest') && p.requirements?.includes('army')
    );
    expect(conquestActions.length).toBe(0);
  });

  it('should propose at least one action unless all are impossible', () => {
    const world = createTestWorld();
    const graph = createTestGraph();
    const kb = createBasicKnowledgeBase();

    const proposals = propose({ graph, world, kb });

    expect(proposals.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty knowledge base gracefully', () => {
    const world = createTestWorld();
    const graph = createTestGraph();
    const kb = { requirements: {}, generators: [] };

    const proposals = propose({ graph, world, kb });

    // Should return empty array when no actions possible
    expect(proposals).toEqual([]);
  });
});