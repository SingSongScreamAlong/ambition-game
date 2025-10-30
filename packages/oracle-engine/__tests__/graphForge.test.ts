import { describe, it, expect } from 'vitest';
import { fromAmbition } from '../src/modules/graphForge.js';
import { AmbitionCanonical } from '../src/types/index.js';

describe('graphForge', () => {
  it('should create king requirement graph', () => {
    const ambition: AmbitionCanonical = {
      archetypes: ['king'],
      virtues: [],
      vices: [],
      weights: { king: 1.0 },
    };

    const graph = fromAmbition(ambition);

    expect(graph.ambition).toBe('king');
    expect(graph.nodes).toHaveLength(5);
    
    const landNode = graph.nodes.find(n => n.id === 'land');
    expect(landNode).toBeDefined();
    expect(landNode?.status).toBe('unmet');
    expect(landNode?.paths).toContain('conquest');
    expect(landNode?.paths).toContain('marriage');
  });

  it('should create warrior requirement graph', () => {
    const ambition: AmbitionCanonical = {
      archetypes: ['warrior'],
      virtues: [],
      vices: [],
      weights: { warrior: 1.0 },
    };

    const graph = fromAmbition(ambition);

    expect(graph.nodes).toHaveLength(5);
    
    const strengthNode = graph.nodes.find(n => n.id === 'strength');
    expect(strengthNode).toBeDefined();
    expect(strengthNode?.label).toBe('Personal Strength');
    
    const gloryNode = graph.nodes.find(n => n.id === 'glory');
    expect(gloryNode).toBeDefined();
    expect(gloryNode?.needs).toContain('reputation');
    expect(gloryNode?.needs).toContain('followers');
  });

  it('should modify graph based on virtues', () => {
    const ambition: AmbitionCanonical = {
      archetypes: ['king'],
      virtues: ['honor', 'compassion'],
      vices: [],
      weights: { king: 0.5, honor: 0.25, compassion: 0.25 },
    };

    const graph = fromAmbition(ambition);

    // Should add honor-based paths
    const legitNode = graph.nodes.find(n => n.id === 'legitimacy');
    expect(legitNode?.paths).toContain('honor_code');

    // Should add compassion-based paths
    const peopleNode = graph.nodes.find(n => n.id === 'people');
    expect(peopleNode?.paths).toContain('benevolence');
  });

  it('should remove paths based on vices', () => {
    const ambition: AmbitionCanonical = {
      archetypes: ['king'],
      virtues: [],
      vices: ['pride', 'greed'],
      weights: { king: 0.5, pride: 0.25, greed: 0.25 },
    };

    const graph = fromAmbition(ambition);

    // Should not contain humble/charitable paths
    graph.nodes.forEach(node => {
      if (node.paths) {
        expect(node.paths).not.toContain('submission');
        expect(node.paths).not.toContain('charity');
        expect(node.paths).not.toContain('sacrifice');
      }
    });
  });

  it('should default to king template for unknown archetype', () => {
    const ambition: AmbitionCanonical = {
      archetypes: ['unknown_archetype'],
      virtues: [],
      vices: [],
      weights: { unknown_archetype: 1.0 },
    };

    const graph = fromAmbition(ambition);

    // Should use king template as fallback
    expect(graph.nodes).toHaveLength(5);
    expect(graph.nodes.find(n => n.id === 'land')).toBeDefined();
    expect(graph.nodes.find(n => n.id === 'legitimacy')).toBeDefined();
  });

  it('should use highest weighted archetype', () => {
    const ambition: AmbitionCanonical = {
      archetypes: ['king', 'warrior'],
      virtues: [],
      vices: [],
      weights: { king: 0.3, warrior: 0.7 },
    };

    const graph = fromAmbition(ambition);

    // Should use warrior template (higher weight)
    expect(graph.nodes.find(n => n.id === 'strength')).toBeDefined();
    expect(graph.nodes.find(n => n.id === 'glory')).toBeDefined();
  });
});