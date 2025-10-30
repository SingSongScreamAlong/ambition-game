import { describe, it, expect } from 'vitest';
import { parseAmbition } from '../src/modules/ambition.js';
import { seed } from '../src/modules/worldGen.js';

describe('World Generation Domain Bias', () => {
  const baseSeed = 42000;

  describe('Faith Domain Bias', () => {
    it('should generate higher regional piety with faith-dominant ambition', () => {
      const faithAmbition = parseAmbition("I wish to serve the divine and spread holy faith to all corners of the realm");
      const neutralAmbition = parseAmbition("I want to live a balanced life");
      
      const faithWorld = seed(faithAmbition, baseSeed);
      const neutralWorld = seed(neutralAmbition, baseSeed + 1);
      
      const avgFaithPiety = faithWorld.regions.reduce((sum, r) => sum + r.piety, 0) / faithWorld.regions.length;
      const avgNeutralPiety = neutralWorld.regions.reduce((sum, r) => sum + r.piety, 0) / neutralWorld.regions.length;
      
      expect(avgFaithPiety).toBeGreaterThan(avgNeutralPiety);
      
      // Should have at least one high-faith region
      const highFaithRegions = faithWorld.regions.filter(r => r.piety > 80);
      expect(highFaithRegions.length).toBeGreaterThan(0);
    });

    it('should generate clergy-focused factions with faith ambition', () => {
      const faithAmbition = parseAmbition("Divine mandate guides my rule, blessed by the gods");
      const world = seed(faithAmbition, baseSeed);
      
      // Should have at least one faction with high faith affinity
      const faithFactions = world.factions.filter(f => f.domainAffinities.faith > 0.6);
      expect(faithFactions.length).toBeGreaterThanOrEqual(1);
      
      // Faith factions should have appropriate names
      const faithFaction = faithFactions[0];
      if (faithFaction) {
        const nameContainsFaith = faithFaction.name.toLowerCase().includes('sacred') ||
                                 faithFaction.name.toLowerCase().includes('divine') ||
                                 faithFaction.name.toLowerCase().includes('holy') ||
                                 faithFaction.name.toLowerCase().includes('phoenix') ||
                                 faithFaction.name.toLowerCase().includes('light') ||
                                 faithFaction.name.toLowerCase().includes('covenant');
        expect(nameContainsFaith).toBe(true);
      }
    });

    it('should have lower heresy in faith-biased regions', () => {
      const faithAmbition = parseAmbition("Sacred duty calls me to preserve divine order");
      const world = seed(faithAmbition, baseSeed);
      
      const avgHeresy = world.regions.reduce((sum, r) => sum + r.heresy, 0) / world.regions.length;
      expect(avgHeresy).toBeLessThan(30); // Should be relatively low
    });
  });

  describe('Wealth Domain Bias', () => {
    it('should generate trade-focused regions with wealth ambition', () => {
      const wealthAmbition = parseAmbition("Gold and trade will make me the richest merchant king");
      const world = seed(wealthAmbition, baseSeed);
      
      // Should have regions with high wealth affinity
      const wealthyRegions = world.regions.filter(r => r.domainAffinities.wealth > 0.6);
      expect(wealthyRegions.length).toBeGreaterThanOrEqual(1);
      
      // Should have higher average gold resources
      const avgGold = world.regions.reduce((sum, r) => sum + (r.resources.gold || 0), 0) / world.regions.length;
      expect(avgGold).toBeGreaterThan(20);
    });

    it('should generate merchant guilds with wealth ambition', () => {
      const wealthAmbition = parseAmbition("Trade routes and commerce will bring prosperity");
      const world = seed(wealthAmbition, baseSeed);
      
      const merchantFactions = world.factions.filter(f => f.domainAffinities.wealth > 0.6);
      expect(merchantFactions.length).toBeGreaterThanOrEqual(1);
      
      // Check for trade-related names
      const merchantFaction = merchantFactions[0];
      if (merchantFaction) {
        const nameContainsTrade = merchantFaction.name.toLowerCase().includes('merchant') ||
                                 merchantFaction.name.toLowerCase().includes('guild') ||
                                 merchantFaction.name.toLowerCase().includes('golden') ||
                                 merchantFaction.name.toLowerCase().includes('trade') ||
                                 merchantFaction.name.toLowerCase().includes('prosperity') ||
                                 merchantFaction.name.toLowerCase().includes('coin');
        expect(nameContainsTrade).toBe(true);
      }
    });

    it('should generate higher starting resources for wealthy ambitions', () => {
      const wealthAmbition = parseAmbition("I shall accumulate vast riches through shrewd business");
      const poorAmbition = parseAmbition("I care not for material wealth, only honor");
      
      const wealthWorld = seed(wealthAmbition, baseSeed);
      const poorWorld = seed(poorAmbition, baseSeed + 1);
      
      expect(wealthWorld.resources.gold).toBeGreaterThan(poorWorld.resources.gold);
    });
  });

  describe('Power Domain Bias', () => {
    it('should generate higher security regions with power ambition', () => {
      const powerAmbition = parseAmbition("I will conquer all lands and rule with iron fist");
      const world = seed(powerAmbition, baseSeed);
      
      const avgSecurity = world.regions.reduce((sum, r) => sum + r.security, 0) / world.regions.length;
      expect(avgSecurity).toBeGreaterThan(50);
      
      // Should have military-focused factions
      const militaryFactions = world.factions.filter(f => f.domainAffinities.power > 0.6);
      expect(militaryFactions.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate larger starting forces for power ambitions', () => {
      const powerAmbition = parseAmbition("Through military might I shall establish my dominion");
      const peacefulAmbition = parseAmbition("Peace and diplomacy will guide my reign");
      
      const powerWorld = seed(powerAmbition, baseSeed);
      const peacefulWorld = seed(peacefulAmbition, baseSeed + 1);
      
      expect(powerWorld.forces.units).toBeGreaterThan(peacefulWorld.forces.units);
    });
  });

  describe('Virtue Domain Bias', () => {
    it('should generate lower unrest with virtue ambition', () => {
      const virtueAmbition = parseAmbition("Justice and honor will guide my righteous rule");
      const world = seed(virtueAmbition, baseSeed);
      
      const avgUnrest = world.regions.reduce((sum, r) => sum + r.unrest, 0) / world.regions.length;
      expect(avgUnrest).toBeLessThan(25);
      
      // Should have higher lawfulness
      const avgLawfulness = world.regions.reduce((sum, r) => sum + r.lawfulness, 0) / world.regions.length;
      expect(avgLawfulness).toBeGreaterThan(60);
    });

    it('should generate higher people loyalty with virtue ambition', () => {
      const virtueAmbition = parseAmbition("I shall protect the innocent and uphold justice");
      const world = seed(virtueAmbition, baseSeed);
      
      expect(world.people.loyalty).toBeGreaterThan(60);
      expect(world.people.unrest).toBeLessThan(25);
    });
  });

  describe('Freedom Domain Bias', () => {
    it('should generate regions with independence themes', () => {
      const freedomAmbition = parseAmbition("Break the chains! Freedom for all oppressed peoples!");
      const world = seed(freedomAmbition, baseSeed);
      
      // Freedom-focused regions should have higher unrest but lower security
      const freedomRegions = world.regions.filter(r => r.domainAffinities.freedom > 0.6);
      if (freedomRegions.length > 0) {
        const avgUnrest = freedomRegions.reduce((sum, r) => sum + r.unrest, 0) / freedomRegions.length;
        expect(avgUnrest).toBeGreaterThan(20);
      }
    });
  });

  describe('Creation Domain Bias', () => {
    it('should generate artisan-focused regions with creation ambition', () => {
      const creationAmbition = parseAmbition("I will build wonders and craft beauty that lasts forever");
      const world = seed(creationAmbition, baseSeed);
      
      // Should have higher crafting resources
      const avgIron = world.regions.reduce((sum, r) => sum + (r.resources.iron || 0), 0) / world.regions.length;
      const avgStone = world.regions.reduce((sum, r) => sum + (r.resources.stone || 0), 0) / world.regions.length;
      const avgWood = world.regions.reduce((sum, r) => sum + (r.resources.wood || 0), 0) / world.regions.length;
      
      expect(avgIron + avgStone + avgWood).toBeGreaterThan(40);
    });

    it('should generate builder factions with creation ambition', () => {
      const creationAmbition = parseAmbition("Through craft and creation I will leave an eternal legacy");
      const world = seed(creationAmbition, baseSeed);
      
      const builderFactions = world.factions.filter(f => f.domainAffinities.creation > 0.6);
      expect(builderFactions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Regional Domain Compatibility', () => {
    it('should assign regions to compatible factions', () => {
      const mixedAmbition = parseAmbition("Balance of power, wealth, and virtue guides my path");
      const world = seed(mixedAmbition, baseSeed);
      
      // Check faction-region assignments for domain compatibility
      world.factions.forEach(faction => {
        faction.regions.forEach(regionId => {
          const region = world.regions.find(r => r.id === regionId);
          if (region && faction.regions.length > 0) {
            // Calculate compatibility score
            const domains = ['power', 'wealth', 'faith', 'virtue', 'freedom', 'creation'] as const;
            let compatibility = 0;
            
            domains.forEach(domain => {
              const diff = Math.abs(region.domainAffinities[domain] - faction.domainAffinities[domain]);
              compatibility += 1 - diff;
            });
            compatibility /= domains.length;
            
            // Should have reasonable compatibility (not perfect due to randomness)
            expect(compatibility).toBeGreaterThan(0.3);
          }
        });
      });
    });
  });

  describe('Deterministic Bias Application', () => {
    it('should apply bias consistently with same seed', () => {
      const ambition = parseAmbition("Faith and virtue guide my divine mandate to rule");
      
      const world1 = seed(ambition, baseSeed);
      const world2 = seed(ambition, baseSeed);
      
      // Should be identical
      expect(world1.regions).toEqual(world2.regions);
      expect(world1.factions).toEqual(world2.factions);
      
      // Domain affinities should be identical
      world1.regions.forEach((region, index) => {
        expect(region.domainAffinities).toEqual(world2.regions[index]?.domainAffinities);
      });
      
      world1.factions.forEach((faction, index) => {
        expect(faction.domainAffinities).toEqual(world2.factions[index]?.domainAffinities);
      });
    });

    it('should create different bias patterns with different seeds', () => {
      const ambition = parseAmbition("Faith and virtue guide my divine mandate to rule");
      
      const world1 = seed(ambition, baseSeed);
      const world2 = seed(ambition, baseSeed + 1);
      
      // Should be different
      expect(world1.regions).not.toEqual(world2.regions);
      
      // But should both reflect the faith/virtue bias
      const faith1 = world1.regions.reduce((sum, r) => sum + r.domainAffinities.faith, 0) / world1.regions.length;
      const faith2 = world2.regions.reduce((sum, r) => sum + r.domainAffinities.faith, 0) / world2.regions.length;
      const virtue1 = world1.regions.reduce((sum, r) => sum + r.domainAffinities.virtue, 0) / world1.regions.length;
      const virtue2 = world2.regions.reduce((sum, r) => sum + r.domainAffinities.virtue, 0) / world2.regions.length;
      
      // Both should have above-average faith and virtue
      expect(faith1).toBeGreaterThan(0.4);
      expect(faith2).toBeGreaterThan(0.4);
      expect(virtue1).toBeGreaterThan(0.4);
      expect(virtue2).toBeGreaterThan(0.4);
    });
  });
});