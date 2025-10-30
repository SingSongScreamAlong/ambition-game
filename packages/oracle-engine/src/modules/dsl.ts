import * as yaml from 'js-yaml';
import { KnowledgeBase, RequirementRule, GeneratorRule } from '../types/index.js';

/**
 * Load knowledge base from YAML string or file content
 */
export function load(yamlContent: string): KnowledgeBase {
  try {
    const data = yaml.load(yamlContent) as any;
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid YAML structure: expected object');
    }

    const requirements: Record<string, RequirementRule> = {};
    const generators: GeneratorRule[] = [];

    // Parse requirements section
    if (data.requirements && typeof data.requirements === 'object') {
      for (const [reqId, reqData] of Object.entries(data.requirements)) {
        if (typeof reqData === 'object' && reqData !== null) {
          const reqRule = parseRequirementRule(reqId, reqData as any);
          requirements[reqId] = reqRule;
        }
      }
    }

    // Parse generators section
    if (data.generators && Array.isArray(data.generators)) {
      for (const genData of data.generators) {
        if (typeof genData === 'object' && genData !== null) {
          const genRule = parseGeneratorRule(genData);
          generators.push(genRule);
        }
      }
    }

    return { requirements, generators };
  } catch (error) {
    throw new Error(`Failed to parse knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseRequirementRule(id: string, data: any): RequirementRule {
  const rule: RequirementRule = {
    id,
    label: data.label || id,
    paths: {},
  };

  if (data.paths && typeof data.paths === 'object') {
    for (const [pathId, pathData] of Object.entries(data.paths)) {
      if (typeof pathData === 'object' && pathData !== null) {
        const pathDataTyped = pathData as any;
        
        // Parse legitimacy, regional, ambition, and modifier effects from the effects array
        const effects = pathDataTyped.effects || [];
        const parsedEffects = effects.map((effect: string) => {
          // Parse legitimacy syntax: "+legitimacy.law = 5" or "-legitimacy.might = 3"
          const legitimacyMatch = effect.match(/([+-])legitimacy\.([a-z]+)\s*=\s*(\d+)/);
          if (legitimacyMatch && legitimacyMatch[1] && legitimacyMatch[2] && legitimacyMatch[3]) {
            const [, operator, meter, value] = legitimacyMatch;
            return {
              type: 'legitimacy',
              meter,
              change: operator === '+' ? parseInt(value) : -parseInt(value)
            };
          }
          
          // Parse regional syntax: "+region.lawfulness = 10" or "-region.unrest = 5"
          const regionMatch = effect.match(/([+-])region\.([a-z]+)\s*=\s*(\d+)/);
          if (regionMatch && regionMatch[1] && regionMatch[2] && regionMatch[3]) {
            const [, operator, property, value] = regionMatch;
            return {
              type: 'region',
              property,
              change: operator === '+' ? parseInt(value) : -parseInt(value)
            };
          }
          
          // Parse ambition syntax: "+ambition.power = 0.05" or "-ambition.virtue = 0.02"
          const ambitionMatch = effect.match(/([+-])ambition\.([a-z]+)\s*=\s*([\d.]+)/);
          if (ambitionMatch && ambitionMatch[1] && ambitionMatch[2] && ambitionMatch[3]) {
            const [, operator, domain, value] = ambitionMatch;
            return {
              type: 'ambition',
              domain,
              change: operator === '+' ? parseFloat(value) : -parseFloat(value)
            };
          }
          
          // Parse modifier syntax: "+modifier.peaceful = 0.03" or "-modifier.ruthless = 0.01"
          const modifierMatch = effect.match(/([+-])modifier\.([a-z]+)\s*=\s*([\d.]+)/);
          if (modifierMatch && modifierMatch[1] && modifierMatch[2] && modifierMatch[3]) {
            const [, operator, modifier, value] = modifierMatch;
            return {
              type: 'modifier',
              modifier,
              change: operator === '+' ? parseFloat(value) : -parseFloat(value)
            };
          }
          
          // Return original effect if not recognized syntax
          return effect;
        });

        rule.paths[pathId] = {
          id: pathId,
          label: pathDataTyped.label,
          description: pathDataTyped.description,
          requirements: pathDataTyped.requirements || [],
          costs: pathDataTyped.costs || {},
          rewards: pathDataTyped.rewards || {},
          time: pathDataTyped.time || '1 turn',
          risks: pathDataTyped.risks || {},
          effects: parsedEffects,
          domains: pathDataTyped.domains,
          modifierRequirements: pathDataTyped.modifierRequirements,
          scaleRequirement: pathDataTyped.scaleRequirement,
        };
      }
    }
  }

  // Add DAS extensions to the rule
  rule.domains = data.domains;
  rule.spawnConditions = data.spawnConditions;
  
  return rule;
}

function parseGeneratorRule(data: any): GeneratorRule {
  // Parse all effects including ambition and modifier effects
  const effects = data.action?.effects || [];
  const parsedEffects = effects.map((effect: string) => {
    // Parse legitimacy syntax
    const legitimacyMatch = effect.match(/([+-])legitimacy\.([a-z]+)\s*=\s*(\d+)/);
    if (legitimacyMatch && legitimacyMatch[1] && legitimacyMatch[2] && legitimacyMatch[3]) {
      const [, operator, meter, value] = legitimacyMatch;
      return {
        type: 'legitimacy',
        meter,
        change: operator === '+' ? parseInt(value) : -parseInt(value)
      };
    }
    
    // Parse regional syntax
    const regionMatch = effect.match(/([+-])region\.([a-z]+)\s*=\s*(\d+)/);
    if (regionMatch && regionMatch[1] && regionMatch[2] && regionMatch[3]) {
      const [, operator, property, value] = regionMatch;
      return {
        type: 'region',
        property,
        change: operator === '+' ? parseInt(value) : -parseInt(value)
      };
    }
    
    // Parse ambition syntax: "+ambition.power = 0.05"
    const ambitionMatch = effect.match(/([+-])ambition\.([a-z]+)\s*=\s*([\d.]+)/);
    if (ambitionMatch && ambitionMatch[1] && ambitionMatch[2] && ambitionMatch[3]) {
      const [, operator, domain, value] = ambitionMatch;
      return {
        type: 'ambition',
        domain,
        change: operator === '+' ? parseFloat(value) : -parseFloat(value)
      };
    }
    
    // Parse modifier syntax: "+modifier.peaceful = 0.03"
    const modifierMatch = effect.match(/([+-])modifier\.([a-z]+)\s*=\s*([\d.]+)/);
    if (modifierMatch && modifierMatch[1] && modifierMatch[2] && modifierMatch[3]) {
      const [, operator, modifier, value] = modifierMatch;
      return {
        type: 'modifier',
        modifier,
        change: operator === '+' ? parseFloat(value) : -parseFloat(value)
      };
    }
    
    return effect;
  });

  return {
    id: data.id || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    conditions: data.conditions || [],
    action: {
      id: data.action?.id || `action_${Date.now()}`,
      label: data.action?.label || 'Unknown Action',
      description: data.action?.description || 'No description available',
      satisfies: data.action?.satisfies || [],
      costs: data.action?.costs || {},
      rewards: data.action?.rewards || {},
      risks: data.action?.risks || {},
      time: data.action?.time || '1 turn',
      requirements: data.action?.requirements || [],
      mapRefs: data.action?.mapRefs || [],
      effects: parsedEffects,
    },
    // DAS extensions
    domains: data.domains,
    ambitionConditions: data.ambitionConditions,
    modifierConditions: data.modifierConditions,
  };
}

/**
 * Create a basic knowledge base for testing/development
 */
export function createBasicKnowledgeBase(): KnowledgeBase {
  const basicYaml = `
requirements:
  land:
    label: "Control Territory"
    paths:
      conquest:
        costs:
          gold: 200
          wood: 50
        time: "3 turns"
        risks:
          casualty: 0.3
          failure: 0.2
        requirements: ["army"]
      purchase:
        costs:
          gold: 500
        time: "1 turn"
        risks:
          rejection: 0.1
      grant:
        requirements: ["legitimacy"]
        time: "2 turns"
        risks:
          conditions: 0.2
      marriage:
        costs:
          gold: 300
        time: "2 turns"
        requirements: ["reputation"]
        risks:
          scandal: 0.1

  army:
    label: "Raise an Army"
    paths:
      recruitment:
        costs:
          gold: 100
          grain: 50
        time: "2 turns"
        requirements: ["people"]
      mercenaries:
        costs:
          gold: 300
        time: "1 turn"
        risks:
          desertion: 0.2
      conscription:
        costs:
          grain: 100
        time: "1 turn"
        risks:
          unrest: 0.4
        requirements: ["land"]

  people:
    label: "Win the People"
    paths:
      charity:
        costs:
          gold: 150
          grain: 100
        time: "1 turn"
      justice:
        time: "2 turns"
        requirements: ["legitimacy"]
      protection:
        costs:
          gold: 100
        time: "1 turn"
        requirements: ["army"]

generators:
  - id: "iron_caravan"
    conditions: ["iron_scarcity", "road_security < 0.5"]
    action:
      id: "escort_iron_caravan"
      label: "Escort Iron Caravan"
      description: "A merchant offers good pay to escort an iron shipment through dangerous territory."
      satisfies: []
      costs:
        wood: 10
      rewards:
        gold: 150
        iron: 20
      risks:
        ambush: 0.3
      time: "1 turn"
      requirements: ["army"]
      mapRefs: ["trade_route_north"]

  - id: "grain_shortage"
    conditions: ["grain < 50", "winter"]
    action:
      id: "emergency_grain_purchase"
      label: "Emergency Grain Purchase"
      description: "A neighboring lord offers grain at premium prices due to the shortage."
      satisfies: []
      costs:
        gold: 200
      rewards:
        grain: 100
      time: "1 turn"

  - id: "bandit_threat"
    conditions: ["unrest > 0.3", "security < 0.4"]
    action:
      id: "clear_bandits"
      label: "Clear Bandit Camp"
      description: "Bandits threaten trade routes. Clearing them would improve security and reputation."
      satisfies: ["people"]
      costs:
        gold: 50
      rewards:
        gold: 100
      risks:
        casualty: 0.2
      time: "2 turns"
      requirements: ["army"]
      mapRefs: ["bandit_camp"]
`;

  return load(basicYaml);
}