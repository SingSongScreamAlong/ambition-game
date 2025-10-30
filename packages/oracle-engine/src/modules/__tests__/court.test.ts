import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initializeCourtState,
  generateCourtEvents,
  resolveCourtEvent,
  addToAudience,
  removeFromAudience,
  CourtState,
  CourtEvent
} from '../court.js';
import { initializePlayerInfluence, PlayerInfluence } from '../influence.js';
import { generateFactionAmbitions, FactionAmbition } from '../factions.js';
import { seed, WorldState } from '../worldGen.js';
import { parseAmbition } from '../ambition.js';

describe('Court System', () => {
  let world: WorldState;
  let playerInfluence: PlayerInfluence;
  let factionAmbitions: FactionAmbition[];
  let courtState: CourtState;

  beforeEach(() => {
    const ambitionProfile = parseAmbition("I shall hold court and rule with wisdom and authority");
    world = seed(ambitionProfile, 13579);
    playerInfluence = initializePlayerInfluence(world);
    factionAmbitions = generateFactionAmbitions(world, world.seed);
    courtState = initializeCourtState();
  });

  describe('Court State Initialization', () => {
    it('should initialize with empty audience and neutral prestige', () => {
      expect(courtState.audience).toEqual([]);
      expect(courtState.prestige).toBe(50); // Neutral starting prestige
      expect(courtState.currentEvents).toEqual([]);
      expect(courtState.lastSessionTick).toBe(0);
    });

    it('should have valid initial state', () => {
      expect(typeof courtState.prestige).toBe('number');
      expect(Array.isArray(courtState.audience)).toBe(true);
      expect(Array.isArray(courtState.currentEvents)).toBe(true);
    });
  });

  describe('Audience Management', () => {
    it('should add members to audience', () => {
      const factionId = world.factions[0].id;
      const updatedCourt = addToAudience(courtState, factionId, 'faction_leader', 'diplomacy');
      
      expect(updatedCourt.audience).toHaveLength(1);
      expect(updatedCourt.audience[0].factionId).toBe(factionId);
      expect(updatedCourt.audience[0].role).toBe('faction_leader');
      expect(updatedCourt.audience[0].purpose).toBe('diplomacy');
    });

    it('should remove members from audience', () => {
      const factionId = world.factions[0].id;
      let court = addToAudience(courtState, factionId, 'faction_leader', 'diplomacy');
      court = removeFromAudience(court, factionId);
      
      expect(court.audience).toHaveLength(0);
    });

    it('should handle multiple audience members', () => {
      let court = courtState;
      
      for (let i = 0; i < 3; i++) {
        court = addToAudience(court, world.factions[i].id, 'faction_leader', 'diplomacy');
      }
      
      expect(court.audience).toHaveLength(3);
      expect(new Set(court.audience.map(a => a.factionId))).toHaveProperty('size', 3);
    });

    it('should not add duplicate audience members', () => {
      const factionId = world.factions[0].id;
      let court = addToAudience(courtState, factionId, 'faction_leader', 'diplomacy');
      court = addToAudience(court, factionId, 'ambassador', 'trade'); // Try to add same faction again
      
      expect(court.audience).toHaveLength(1);
      // Should update the existing entry
      expect(court.audience[0].role).toBe('ambassador');
      expect(court.audience[0].purpose).toBe('trade');
    });
  });

  describe('Court Event Generation', () => {
    beforeEach(() => {
      // Add some audience members for events
      courtState = addToAudience(courtState, world.factions[0].id, 'faction_leader', 'diplomacy');
      courtState = addToAudience(courtState, world.factions[1].id, 'ambassador', 'trade');
    });

    it('should generate appropriate court events', () => {
      const events = generateCourtEvents(world, playerInfluence, factionAmbitions, courtState, world.seed);
      
      expect(Array.isArray(events)).toBe(true);
      
      if (events.length > 0) {
        events.forEach(event => {
          expect(event).toHaveProperty('id');
          expect(event).toHaveProperty('type');
          expect(event).toHaveProperty('title');
          expect(event).toHaveProperty('description');
          expect(event).toHaveProperty('participants');
          expect(event).toHaveProperty('choices');
          expect(event.choices.length).toBeGreaterThan(0);
        });
      }
    });

    it('should generate events based on audience composition', () => {
      // Court with diplomatic audience should generate diplomatic events
      const diplomaticCourt = addToAudience(
        initializeCourtState(), 
        world.factions[0].id, 
        'ambassador', 
        'diplomacy'
      );
      
      const events = generateCourtEvents(world, playerInfluence, factionAmbitions, diplomaticCourt, world.seed);
      
      if (events.length > 0) {
        const diplomaticEvents = events.filter(e => 
          e.type === 'diplomatic_petition' || 
          e.type === 'alliance_proposal' ||
          e.type === 'treaty_negotiation'
        );
        expect(diplomaticEvents.length).toBeGreaterThan(0);
      }
    });

    it('should consider player influence in event generation', () => {
      // High reputation should generate more positive events
      const highRepInfluence = { ...playerInfluence, reputation: 80 };
      
      const events = generateCourtEvents(world, highRepInfluence, factionAmbitions, courtState, world.seed);
      
      // Events should be generated (exact content depends on implementation)
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Court Event Resolution', () => {
    let testEvent: CourtEvent;

    beforeEach(() => {
      testEvent = {
        id: 'test_event_1',
        type: 'diplomatic_petition',
        title: 'Trade Agreement Proposal',
        description: 'The ambassador proposes a new trade agreement',
        participants: [world.factions[0].id],
        choices: [
          {
            id: 'accept',
            text: 'Accept the proposal',
            effects: {
              influence: { [world.factions[0].id]: { favor: 10 } },
              resources: { gold: 100 },
              prestige: 5
            }
          },
          {
            id: 'reject',
            text: 'Reject the proposal',
            effects: {
              influence: { [world.factions[0].id]: { favor: -5 } },
              prestige: -2
            }
          },
          {
            id: 'negotiate',
            text: 'Propose counter-terms',
            effects: {
              influence: { [world.factions[0].id]: { favor: 2 } },
              prestige: 2
            }
          }
        ],
        urgency: 'normal',
        consequences: {
          'accept': 'The trade agreement will boost your economy',
          'reject': 'Relations with this faction will deteriorate',
          'negotiate': 'Further negotiations will be required'
        }
      };

      courtState.currentEvents = [testEvent];
    });

    it('should resolve court events with choice effects', () => {
      const result = resolveCourtEvent(testEvent.id, 'accept', world, playerInfluence, factionAmbitions, courtState);
      
      expect(result.outcome).toBeDefined();
      expect(result.influenceChanges).toBeDefined();
      expect(result.resourceChanges).toBeDefined();
      expect(result.newEvents).toBeDefined();
      
      // Check that effects were applied
      expect(result.resourceChanges.gold).toBe(100);
      expect(result.influenceChanges[0].factionId).toBe(world.factions[0].id);
      expect(result.influenceChanges[0].type).toBe('favor');
      expect(result.influenceChanges[0].amount).toBe(10);
    });

    it('should handle different choice outcomes', () => {
      const acceptResult = resolveCourtEvent(testEvent.id, 'accept', world, playerInfluence, factionAmbitions, courtState);
      const rejectResult = resolveCourtEvent(testEvent.id, 'reject', world, playerInfluence, factionAmbitions, courtState);
      
      // Accept should give better resource outcomes
      expect(acceptResult.resourceChanges.gold || 0).toBeGreaterThan(rejectResult.resourceChanges.gold || 0);
      
      // Accept should give better influence outcomes
      const acceptFavor = acceptResult.influenceChanges.find(ic => ic.type === 'favor')?.amount || 0;
      const rejectFavor = rejectResult.influenceChanges.find(ic => ic.type === 'favor')?.amount || 0;
      expect(acceptFavor).toBeGreaterThan(rejectFavor);
    });

    it('should remove resolved events from court state', () => {
      const result = resolveCourtEvent(testEvent.id, 'accept', world, playerInfluence, factionAmbitions, courtState);
      
      expect(result.updatedCourt.currentEvents).not.toContain(testEvent);
    });

    it('should handle invalid event IDs gracefully', () => {
      const result = resolveCourtEvent('nonexistent_event', 'accept', world, playerInfluence, factionAmbitions, courtState);
      
      expect(result.outcome).toContain('not found');
      expect(result.influenceChanges).toEqual([]);
      expect(result.resourceChanges).toEqual({});
    });

    it('should handle invalid choice IDs gracefully', () => {
      const result = resolveCourtEvent(testEvent.id, 'invalid_choice', world, playerInfluence, factionAmbitions, courtState);
      
      expect(result.outcome).toContain('Invalid choice');
      expect(result.influenceChanges).toEqual([]);
    });
  });

  describe('Prestige System', () => {
    it('should modify prestige based on court events', () => {
      const prestigeEvent: CourtEvent = {
        id: 'prestige_test',
        type: 'ceremony',
        title: 'Royal Ceremony',
        description: 'A grand ceremony to show your power',
        participants: [],
        choices: [
          {
            id: 'grand',
            text: 'Hold a grand ceremony',
            effects: { prestige: 15, resources: { gold: -200 } }
          },
          {
            id: 'modest',
            text: 'Hold a modest ceremony',
            effects: { prestige: 5, resources: { gold: -50 } }
          }
        ],
        urgency: 'low',
        consequences: {}
      };

      courtState.currentEvents = [prestigeEvent];
      
      const result = resolveCourtEvent(prestigeEvent.id, 'grand', world, playerInfluence, factionAmbitions, courtState);
      
      expect(result.updatedCourt.prestige).toBe(courtState.prestige + 15);
    });

    it('should clamp prestige within valid bounds', () => {
      courtState.prestige = 95; // Near maximum
      
      const highPrestigeEvent: CourtEvent = {
        id: 'high_prestige',
        type: 'ceremony',
        title: 'Ultimate Display',
        description: 'The ultimate display of power',
        participants: [],
        choices: [
          {
            id: 'ultimate',
            text: 'Ultimate ceremony',
            effects: { prestige: 50 } // Would exceed 100
          }
        ],
        urgency: 'low',
        consequences: {}
      };

      courtState.currentEvents = [highPrestigeEvent];
      
      const result = resolveCourtEvent(highPrestigeEvent.id, 'ultimate', world, playerInfluence, factionAmbitions, courtState);
      
      expect(result.updatedCourt.prestige).toBeLessThanOrEqual(100);
    });
  });

  describe('Event Types and Variety', () => {
    it('should generate different types of events', () => {
      // Add diverse audience for variety
      let court = courtState;
      court = addToAudience(court, world.factions[0].id, 'ambassador', 'diplomacy');
      court = addToAudience(court, world.factions[1].id, 'merchant', 'trade');
      court = addToAudience(court, world.factions[2].id, 'noble', 'ceremony');
      
      const events = generateCourtEvents(world, playerInfluence, factionAmbitions, court, world.seed);
      
      if (events.length > 0) {
        const eventTypes = new Set(events.map(e => e.type));
        expect(eventTypes.size).toBeGreaterThan(0); // Should have at least some variety
      }
    });

    it('should respect event urgency levels', () => {
      const urgentEvent: CourtEvent = {
        id: 'urgent_test',
        type: 'crisis',
        title: 'Urgent Crisis',
        description: 'An urgent matter requires immediate attention',
        participants: [world.factions[0].id],
        choices: [
          {
            id: 'immediate',
            text: 'Act immediately',
            effects: { prestige: 10 }
          }
        ],
        urgency: 'high',
        consequences: {}
      };

      courtState.currentEvents = [urgentEvent];
      
      // Urgent events should be resolvable
      const result = resolveCourtEvent(urgentEvent.id, 'immediate', world, playerInfluence, factionAmbitions, courtState);
      expect(result.outcome).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty audience gracefully', () => {
      const emptyCourtState = initializeCourtState();
      
      const events = generateCourtEvents(world, playerInfluence, factionAmbitions, emptyCourtState, world.seed);
      
      // Should not crash with empty audience
      expect(Array.isArray(events)).toBe(true);
    });

    it('should handle missing faction data', () => {
      const invalidCourt = addToAudience(courtState, 'nonexistent_faction', 'ambassador', 'diplomacy');
      
      expect(() => {
        generateCourtEvents(world, playerInfluence, factionAmbitions, invalidCourt, world.seed);
      }).not.toThrow();
    });

    it('should handle extreme prestige values', () => {
      courtState.prestige = -50; // Below normal range
      
      const events = generateCourtEvents(world, playerInfluence, factionAmbitions, courtState, world.seed);
      
      expect(Array.isArray(events)).toBe(true);
      expect(courtState.prestige).toBeGreaterThanOrEqual(0); // Should be clamped
    });
  });

  describe('Performance', () => {
    it('should handle large audiences efficiently', () => {
      let court = initializeCourtState();
      
      // Add many audience members
      for (let i = 0; i < 50; i++) {
        const factionId = world.factions[i % world.factions.length].id;
        court = addToAudience(court, `${factionId}_${i}`, 'noble', 'ceremony');
      }
      
      const start = Date.now();
      const events = generateCourtEvents(world, playerInfluence, factionAmbitions, court, world.seed);
      const duration = Date.now() - start;
      
      expect(Array.isArray(events)).toBe(true);
      expect(duration).toBeLessThan(500); // Should be reasonably fast
    });

    it('should handle many concurrent events efficiently', () => {
      const manyEvents: CourtEvent[] = Array.from({ length: 20 }, (_, i) => ({
        id: `event_${i}`,
        type: 'petition',
        title: `Petition ${i}`,
        description: `A petition about matter ${i}`,
        participants: [world.factions[i % world.factions.length].id],
        choices: [
          {
            id: 'approve',
            text: 'Approve',
            effects: { prestige: 1 }
          }
        ],
        urgency: 'normal',
        consequences: {}
      }));

      courtState.currentEvents = manyEvents;
      
      const start = Date.now();
      
      // Resolve all events
      manyEvents.forEach(event => {
        resolveCourtEvent(event.id, 'approve', world, playerInfluence, factionAmbitions, courtState);
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should handle many events efficiently
    });
  });
});