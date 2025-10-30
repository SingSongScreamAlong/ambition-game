import { describe, it, expect } from 'vitest';
import { parse } from '../src/modules/intentParser.js';
import samples from '../fixtures/seeds/ambition.samples.json';

describe('intentParser', () => {
  it('should parse king ambition correctly', () => {
    const result = parse({ raw: samples.king.input });
    
    expect(result.archetypes).toContain('king');
    expect(result.virtues).toContain('wisdom');
    expect(result.virtues).toContain('justice');
    expect(result.vices).toHaveLength(0);
  });

  it('should parse warrior ambition correctly', () => {
    const result = parse({ raw: samples.warrior.input });
    
    expect(result.archetypes).toContain('warrior');
    expect(result.archetypes).toHaveLength(1);
  });

  it('should parse good man ambition correctly', () => {
    const result = parse({ raw: samples.good_man.input });
    
    expect(result.virtues).toContain('compassion');
    // Should default to king if no archetype found
    expect(result.archetypes).toContain('king');
  });

  it('should parse complex ambition with multiple traits', () => {
    const result = parse({ raw: samples.complex_ambition.input });
    
    expect(result.archetypes).toContain('king');
    expect(result.archetypes).toContain('warrior');
    expect(result.virtues).toContain('justice');
    expect(result.virtues).toContain('honor');
    expect(result.vices).toContain('pride');
  });

  it('should normalize weights to sum to 1', () => {
    const result = parse({ raw: samples.king.input });
    
    const totalWeight = Object.values(result.weights).reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it('should handle empty input gracefully', () => {
    const result = parse({ raw: '' });
    
    expect(result.archetypes).toContain('king'); // Default fallback
    expect(result.weights.king).toBe(1.0);
  });
});