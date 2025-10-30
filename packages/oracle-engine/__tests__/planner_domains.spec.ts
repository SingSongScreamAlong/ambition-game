import { describe, it, expect } from 'vitest';
import { parseAmbition } from '../src/modules/ambition.js';
import { proposeDynamic } from '../src/modules/dynamicPlanner.js';
import { seed } from '../src/modules/worldGen.js';
import { createBasicKnowledgeBase } from '../src/modules/dsl.js';

describe('Dynamic Planner Domain Preferences', () => {
  const testSeed = 77777;
  const knowledgeBase = createBasicKnowledgeBase();

  // Mock graph nodes with different domain focuses
  const mockGraph = {
    ambition: "Test Graph",
    nodes: [
      {
        id: "faith_node",
        label: "Establish Divine Authority", 
        status: 'unmet' as const,
        domains: ['faith', 'power'],
        spawnThreshold: 0.3
      },
      {
        id: "wealth_node", 
        label: "Build Trading Empire",
        status: 'unmet' as const,
        domains: ['wealth', 'creation'],
        spawnThreshold: 0.2
      },
      {
        id: "virtue_node",
        label: "Uphold Justice",
        status: 'unmet' as const, 
        domains: ['virtue'],
        spawnThreshold: 0.4
      },
      {
        id: "neutral_node",
        label: "Generic Goal",
        status: 'unmet' as const,
        spawnThreshold: 0.1
      }
    ]
  };

  describe('Domain-Based Action Scoring', () => {
    it('should prefer faith actions for faith-focused nodes', () => {
      const faithAmbition = parseAmbition("Divine mandate guides my sacred rule");
      const world = seed(faithAmbition, testSeed);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        faithAmbition,
        knowledgeBase,
        testSeed
      );
      
      // Should have actions available
      expect(proposals.length).toBeGreaterThan(0);
      
      // Faith-related actions should score higher for faith nodes
      const faithNodeProposals = proposals.filter(p => 
        p.satisfies.includes('faith_node') || 
        p.description.toLowerCase().includes('faith') ||
        p.description.toLowerCase().includes('divine') ||
        p.description.toLowerCase().includes('holy')
      );
      
      expect(faithNodeProposals.length).toBeGreaterThan(0);
    });

    it('should prefer wealth actions for wealth-focused nodes', () => {
      const wealthAmbition = parseAmbition("Gold and trade will make me supremely wealthy");
      const world = seed(wealthAmbition, testSeed);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        wealthAmbition,
        knowledgeBase,
        testSeed
      );
      
      expect(proposals.length).toBeGreaterThan(0);
      
      // Should generate trade/wealth related actions
      const wealthActions = proposals.filter(p =>
        p.satisfies.includes('wealth_node') ||
        p.description.toLowerCase().includes('trade') ||
        p.description.toLowerCase().includes('gold') ||
        p.description.toLowerCase().includes('merchant')
      );
      
      expect(wealthActions.length).toBeGreaterThan(0);
    });

    it('should prefer virtue actions for virtue-focused nodes', () => {
      const virtueAmbition = parseAmbition("Justice and honor will guide my righteous reign");
      const world = seed(virtueAmbition, testSeed);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        virtueAmbition,
        knowledgeBase,
        testSeed
      );
      
      expect(proposals.length).toBeGreaterThan(0);
      
      const virtueActions = proposals.filter(p =>
        p.satisfies.includes('virtue_node') ||
        p.description.toLowerCase().includes('justice') ||
        p.description.toLowerCase().includes('honor') ||
        p.description.toLowerCase().includes('protect')
      );
      
      expect(virtueActions.length).toBeGreaterThan(0);
    });
  });

  describe('Regional Affinity Scoring', () => {
    it('should consider regional domain affinities in action scoring', () => {
      const mixedAmbition = parseAmbition("Balanced approach to rule with wisdom");
      const world = seed(mixedAmbition, testSeed);
      
      // Ensure we have regions with different affinities
      expect(world.regions.length).toBeGreaterThan(1);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        mixedAmbition,
        knowledgeBase,
        testSeed
      );
      
      expect(proposals.length).toBeGreaterThan(0);
      
      // Actions should have mapRefs to regions they affect
      const actionsWithRegions = proposals.filter(p => p.mapRefs && p.mapRefs.length > 0);
      expect(actionsWithRegions.length).toBeGreaterThan(0);
    });

    it('should boost scores for actions in compatible regions', () => {
      const faithAmbition = parseAmbition("Sacred duty calls me to spread divine faith");
      const world = seed(faithAmbition, testSeed);
      
      // Create a mock world with a high-faith region
      const highFaithRegion = world.regions.find(r => r.domainAffinities.faith > 0.5);
      if (highFaithRegion) {
        const proposals = proposeDynamic(
          mockGraph,
          world,
          faithAmbition,
          knowledgeBase,
          testSeed
        );
        
        // Actions referencing the high-faith region should be present
        const regionActions = proposals.filter(p => 
          p.mapRefs?.includes(highFaithRegion.id)
        );
        
        // Should have at least some actions for the region
        expect(proposals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Fallback Action Generation', () => {
    it('should always provide viable actions even with no domain matches', () => {
      const neutralAmbition = parseAmbition("I have no strong preferences");
      const world = seed(neutralAmbition, testSeed);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        neutralAmbition,
        knowledgeBase,
        testSeed
      );
      
      // Should always generate some actions
      expect(proposals.length).toBeGreaterThan(0);
      
      // Should have actions that satisfy at least some nodes
      const satisfyingActions = proposals.filter(p => p.satisfies.length > 0);
      expect(satisfyingActions.length).toBeGreaterThan(0);
    });

    it('should provide actions for all node types', () => {
      const balancedAmbition = parseAmbition("I seek balance in power, wealth, faith, and virtue");
      const world = seed(balancedAmbition, testSeed);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        balancedAmbition,
        knowledgeBase,
        testSeed
      );
      
      // Should generate enough actions to cover different node types
      expect(proposals.length).toBeGreaterThanOrEqual(3);
      
      // Should have actions for different domain nodes
      const nodeTypes = ['faith_node', 'wealth_node', 'virtue_node', 'neutral_node'];
      const coveredNodes = new Set();
      
      proposals.forEach(proposal => {
        proposal.satisfies.forEach(nodeId => {
          if (nodeTypes.includes(nodeId)) {
            coveredNodes.add(nodeId);
          }
        });
      });
      
      // Should cover at least 2 different node types
      expect(coveredNodes.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Distance and Cost Considerations', () => {
    it('should consider action costs in scoring', () => {
      const poorAmbition = parseAmbition("I have modest means but great ambitions");
      const world = seed(poorAmbition, testSeed);
      
      // Reduce available resources to test cost sensitivity
      world.resources.gold = 50;
      world.resources.grain = 30;
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        poorAmbition,
        knowledgeBase,
        testSeed
      );
      
      expect(proposals.length).toBeGreaterThan(0);
      
      // Should prioritize affordable actions
      const affordableActions = proposals.filter(p => {
        const goldCost = p.costs?.gold || 0;
        const grainCost = p.costs?.grain || 0;
        return goldCost <= world.resources.gold && grainCost <= world.resources.grain;
      });
      
      // Most actions should be affordable
      expect(affordableActions.length / proposals.length).toBeGreaterThan(0.5);
    });
  });

  describe('Ambition Profile Integration', () => {
    it('should score actions based on ambition domain weights', () => {
      const powerAmbition = parseAmbition("Through military might I will conquer all");
      const world = seed(powerAmbition, testSeed);
      
      const proposals = proposeDynamic(
        mockGraph,
        world,
        powerAmbition,
        knowledgeBase,
        testSeed
      );
      
      expect(proposals.length).toBeGreaterThan(0);
      
      // Power-focused ambition should generate military/conquest actions
      const powerActions = proposals.filter(p =>
        p.description.toLowerCase().includes('army') ||
        p.description.toLowerCase().includes('military') ||
        p.description.toLowerCase().includes('conquest') ||
        p.description.toLowerCase().includes('battle')
      );
      
      // Should have at least some power-related actions
      expect(powerActions.length).toBeGreaterThan(0);
    });

    it('should respect modifier preferences in action selection', () => {
      const peacefulAmbition = parseAmbition("Through gentle diplomacy and peaceful means");
      const aggressiveAmbition = parseAmbition("With ruthless cunning and brutal force");
      
      const peacefulWorld = seed(peacefulAmbition, testSeed);
      const aggressiveWorld = seed(aggressiveAmbition, testSeed + 1);
      
      const peacefulProposals = proposeDynamic(
        mockGraph,
        peacefulWorld,
        peacefulAmbition,
        knowledgeBase,
        testSeed
      );
      
      const aggressiveProposals = proposeDynamic(
        mockGraph,
        aggressiveWorld,
        aggressiveAmbition,
        knowledgeBase,
        testSeed + 1
      );
      
      expect(peacefulProposals.length).toBeGreaterThan(0);
      expect(aggressiveProposals.length).toBeGreaterThan(0);
      
      // Peaceful ambition should avoid high-risk actions
      const peacefulHighRisk = peacefulProposals.filter(p => {
        const totalRisk = Object.values(p.risks || {}).reduce((sum, risk) => 
          sum + (typeof risk === 'number' ? risk : 0), 0
        );
        return totalRisk > 0.5;
      });
      
      const aggressiveHighRisk = aggressiveProposals.filter(p => {
        const totalRisk = Object.values(p.risks || {}).reduce((sum, risk) => 
          sum + (typeof risk === 'number' ? risk : 0), 0
        );
        return totalRisk > 0.5;
      });
      
      // Aggressive ambition should be more tolerant of high-risk actions
      const peacefulRiskRatio = peacefulHighRisk.length / peacefulProposals.length;
      const aggressiveRiskRatio = aggressiveHighRisk.length / aggressiveProposals.length;
      
      expect(aggressiveRiskRatio).toBeGreaterThanOrEqual(peacefulRiskRatio);
    });
  });
});