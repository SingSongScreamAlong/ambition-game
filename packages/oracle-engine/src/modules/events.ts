import { WorldState, EventCard, EventChoice, Legitimacy } from '../types/index.js';

/**
 * Convert state differences into readable event cards with choices
 */
export function alchemize(prevWorld: WorldState, nextWorld: WorldState): EventCard[] {
  const events: EventCard[] = [];

  // Analyze what changed between states
  const changes = analyzeWorldChanges(prevWorld, nextWorld);

  // Generate events based on changes
  events.push(...generateResourceEvents(changes, nextWorld));
  events.push(...generatePoliticalEvents(changes, nextWorld));
  events.push(...generateLegitimacyEvents(changes, nextWorld));
  events.push(...generateJusticeEvents(changes, nextWorld));
  events.push(...generateFaithEvents(changes, nextWorld));
  events.push(...generateOmenEvents(nextWorld));
  events.push(...generateRegionalEvents(changes, nextWorld));
  events.push(...generateFactionEvents(changes, nextWorld));

  // Limit to 1-3 events per tick
  return events.slice(0, 3);
}

interface WorldChanges {
  resourceChanges: Record<string, number>;
  loyaltyChange: number;
  unrestChange: number;
  legitimacyChanges: Partial<Legitimacy>;
  justiceChanges: Array<{ regionId: string; lawfulness: number; unrest: number }>;
  faithChanges: Array<{ regionId: string; piety: number; heresy: number }>;
  newTraits: string[];
  regionChanges: Array<{ id: string; type: string; value: any }>;
  factionChanges: Array<{ id: string; type: string; value: any }>;
}

function analyzeWorldChanges(prev: WorldState, next: WorldState): WorldChanges {
  const changes: WorldChanges = {
    resourceChanges: {},
    loyaltyChange: next.people.loyalty - prev.people.loyalty,
    unrestChange: next.people.unrest - prev.people.unrest,
    legitimacyChanges: {
      law: next.legitimacy.law - prev.legitimacy.law,
      faith: next.legitimacy.faith - prev.legitimacy.faith,
      lineage: next.legitimacy.lineage - prev.legitimacy.lineage,
      might: next.legitimacy.might - prev.legitimacy.might,
    },
    justiceChanges: [],
    faithChanges: [],
    newTraits: next.traits.filter(t => !prev.traits.includes(t)),
    regionChanges: [],
    factionChanges: [],
  };

  // Analyze resource changes
  for (const resource of ['gold', 'grain', 'iron', 'wood', 'stone'] as const) {
    const change = next.resources[resource] - prev.resources[resource];
    if (Math.abs(change) > 0) {
      changes.resourceChanges[resource] = change;
    }
  }

  // Analyze region changes
  for (let i = 0; i < next.regions.length; i++) {
    const prevRegion = prev.regions[i];
    const nextRegion = next.regions[i];
    
    if (!prevRegion || !nextRegion) continue;
    
    if (prevRegion.controlled !== nextRegion.controlled) {
      changes.regionChanges.push({
        id: nextRegion.id,
        type: 'control',
        value: nextRegion.controlled,
      });
    }

    if (Math.abs(prevRegion.security - nextRegion.security) > 0.05) {
      changes.regionChanges.push({
        id: nextRegion.id,
        type: 'security',
        value: nextRegion.security > prevRegion.security ? 'improved' : 'worsened',
      });
    }

    // Analyze justice & law changes (lawfulness and unrest)
    if (typeof nextRegion.lawfulness === 'number' && typeof prevRegion.lawfulness === 'number' &&
        typeof nextRegion.unrest === 'number' && typeof prevRegion.unrest === 'number') {
      const lawfulnessChange = nextRegion.lawfulness - prevRegion.lawfulness;
      const unrestChange = nextRegion.unrest - prevRegion.unrest;
      
      if (Math.abs(lawfulnessChange) >= 5 || Math.abs(unrestChange) >= 5) {
        changes.justiceChanges.push({
          regionId: nextRegion.id,
          lawfulness: lawfulnessChange,
          unrest: unrestChange,
        });
      }
    }

    // Analyze faith & omens changes (piety and heresy) - only if these properties exist
    if (typeof (nextRegion as any).piety === 'number' && typeof (prevRegion as any).piety === 'number' &&
        typeof (nextRegion as any).heresy === 'number' && typeof (prevRegion as any).heresy === 'number') {
      const pietyChange = (nextRegion as any).piety - (prevRegion as any).piety;
      const heresyChange = (nextRegion as any).heresy - (prevRegion as any).heresy;
      
      if (Math.abs(pietyChange) >= 5 || Math.abs(heresyChange) >= 5) {
        changes.faithChanges.push({
          regionId: nextRegion.id,
          piety: pietyChange,
          heresy: heresyChange,
        });
      }
    }
  }

  // Analyze faction changes
  for (let i = 0; i < next.factions.length; i++) {
    const prevFaction = prev.factions[i];
    const nextFaction = next.factions[i];
    
    if (!prevFaction || !nextFaction) continue;
    
    if (prevFaction.stance !== nextFaction.stance) {
      changes.factionChanges.push({
        id: nextFaction.id,
        type: 'stance',
        value: nextFaction.stance,
      });
    }
  }

  return changes;
}

function generateResourceEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];

  // Grain shortage event
  if (changes.resourceChanges.grain && changes.resourceChanges.grain < -20) {
    events.push({
      id: `grain_shortage_${world.tick}`,
      text: `Grain stores run dangerously low. Your people look to you with worried eyes as winter approaches. The granaries that once overflowed now echo with emptiness.`,
      choices: [
        {
          id: 'ration_grain',
          label: 'Implement strict rationing',
          effects: ['Reduce unrest but anger the wealthy'],
          riskTags: ['noble_displeasure'],
        },
        {
          id: 'buy_grain',
          label: 'Purchase grain from merchants',
          costs: { gold: 150 },
          effects: ['Maintain stability at great cost'],
        },
        {
          id: 'raid_neighbors',
          label: 'Raid neighboring granaries',
          effects: ['Gain grain but worsen faction relations'],
          riskTags: ['war', 'reputation_loss'],
        },
      ],
    });
  }

  // Unexpected wealth
  if (changes.resourceChanges.gold && changes.resourceChanges.gold > 100) {
    events.push({
      id: `wealth_discovered_${world.tick}`,
      text: `Your miners have struck a rich vein of gold! Word spreads quickly through the realm of your newfound wealth. Many eyes now turn toward your treasury with both hope and envy.`,
      choices: [
        {
          id: 'share_wealth',
          label: 'Share the wealth with your people',
          costs: { gold: 100 },
          effects: ['Greatly improve loyalty and reduce unrest'],
        },
        {
          id: 'hoard_wealth',
          label: 'Secure the gold in your treasury',
          effects: ['Keep the gold but risk resentment'],
          riskTags: ['loyalty_loss'],
        },
        {
          id: 'invest_military',
          label: 'Invest in military expansion',
          costs: { gold: 200 },
          effects: ['Increase army strength'],
        },
      ],
    });
  }

  return events;
}

function generatePoliticalEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];

  // Rising unrest
  if (changes.unrestChange > 0.2) {
    events.push({
      id: `unrest_rising_${world.tick}`,
      text: `Whispers of rebellion grow louder in the streets. Your advisors report that discontent spreads through the common folk like wildfire. Something must be done before it's too late.`,
      choices: [
        {
          id: 'address_grievances',
          label: 'Hold public hearings for grievances',
          costs: { gold: 50 },
          effects: ['Reduce unrest through dialogue'],
        },
        {
          id: 'show_force',
          label: 'Deploy troops to maintain order',
          effects: ['Suppress unrest through intimidation'],
          riskTags: ['loyalty_loss', 'escalation'],
        },
        {
          id: 'distraction',
          label: 'Organize public festivities',
          costs: { gold: 100, grain: 50 },
          effects: ['Temporarily reduce unrest with entertainment'],
        },
      ],
    });
  }

  // Loyalty surge
  if (changes.loyaltyChange > 0.15) {
    events.push({
      id: `loyalty_surge_${world.tick}`,
      text: `Your recent actions have inspired great devotion among your people. Spontaneous celebrations break out in the streets as citizens praise your leadership. This moment of unity could be leveraged.`,
      choices: [
        {
          id: 'call_militia',
          label: 'Call for volunteer militia',
          effects: ['Recruit additional forces at reduced cost'],
        },
        {
          id: 'request_tribute',
          label: 'Request voluntary tribute',
          effects: ['Gain resources from grateful citizens'],
        },
        {
          id: 'humble_response',
          label: 'Remain humble and gracious',
          effects: ['Maintain sustained loyalty boost'],
        },
      ],
    });
  }

  return events;
}

function generateLegitimacyEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];
  const { legitimacyChanges } = changes;

  // Find the meter with the largest positive change
  const significantChanges = Object.entries(legitimacyChanges)
    .filter(([, change]) => Math.abs(change || 0) >= 5)
    .sort(([, a], [, b]) => Math.abs(b || 0) - Math.abs(a || 0));

  if (significantChanges.length === 0) return events;

  const firstChange = significantChanges[0];
  if (!firstChange) return events;
  
  const [meterName, change] = firstChange;
  const isPositive = (change || 0) > 0;

  if (meterName === 'law' && isPositive) {
    events.push({
      id: `law_legitimacy_boost_${world.tick}`,
      text: `Your recent actions have strengthened your legal authority and administrative competence. Bureaucrats speak approvingly of your governance, and local magistrates enforce your decrees with renewed confidence. The machinery of law turns smoothly in your favor. **Law legitimacy increased by ${Math.abs(change || 0)}.**`,
      choices: [
        {
          id: 'codify_laws',
          label: 'Codify new laws to cement your authority',
          costs: { gold: 100 },
          effects: ['Further strengthen legal legitimacy', '+legitimacy.law = 3'],
        },
        {
          id: 'expand_courts',
          label: 'Establish new courts in distant regions',
          costs: { gold: 150, stone: 50 },
          effects: ['Extend legal authority across your realm', '+legitimacy.law = 5'],
        },
        {
          id: 'judicial_restraint',
          label: 'Exercise restraint and humble governance',
          effects: ['Maintain current momentum without overreach'],
        },
      ],
    });
  } else if (meterName === 'faith' && isPositive) {
    events.push({
      id: `faith_legitimacy_boost_${world.tick}`,
      text: `The clergy and faithful speak of divine favor shining upon your rule. Temples ring with prayers for your continued prosperity, and pilgrims journey from distant lands to witness your blessed reign. The gods themselves seem to smile upon your endeavors. **Faith legitimacy increased by ${Math.abs(change || 0)}.**`,
      choices: [
        {
          id: 'build_temple',
          label: 'Commission a grand temple',
          costs: { gold: 200, stone: 100 },
          effects: ['Demonstrate devotion through grand construction', '+legitimacy.faith = 8'],
        },
        {
          id: 'religious_ceremony',
          label: 'Host a great religious festival',
          costs: { gold: 100, grain: 75 },
          effects: ['Celebrate divine favor with the people', '+legitimacy.faith = 4'],
        },
        {
          id: 'humble_piety',
          label: 'Practice humble devotion',
          effects: ['Show humility before the divine'],
        },
      ],
    });
  } else if (meterName === 'lineage' && isPositive) {
    events.push({
      id: `lineage_legitimacy_boost_${world.tick}`,
      text: `Genealogists and herald masters proclaim the righteousness of your bloodline. Ancient claims and hereditary rights align in your favor, while court historians discover new evidence of your noble ancestry. Your legitimacy through birth becomes undeniable. **Lineage legitimacy increased by ${Math.abs(change || 0)}.**`,
      choices: [
        {
          id: 'commission_genealogy',
          label: 'Commission official genealogical records',
          costs: { gold: 75 },
          effects: ['Document your noble lineage for posterity', '+legitimacy.lineage = 3'],
        },
        {
          id: 'ancestral_ceremony',
          label: 'Hold ceremony honoring ancestors',
          costs: { gold: 150 },
          effects: ['Connect your rule to ancient tradition', '+legitimacy.lineage = 5'],
        },
        {
          id: 'modest_acknowledgment',
          label: 'Acknowledge heritage modestly',
          effects: ['Accept legitimacy without ostentation'],
        },
      ],
    });
  } else if (meterName === 'might' && isPositive) {
    events.push({
      id: `might_legitimacy_boost_${world.tick}`,
      text: `Your displays of strength echo throughout the realm. Warriors speak your name with respect, enemies whisper it with fear, and allies take comfort in your powerful protection. Through force of arms and will, you have proven your right to rule. **Might legitimacy increased by ${Math.abs(change || 0)}.**`,
      choices: [
        {
          id: 'military_parade',
          label: 'Hold grand military parade',
          costs: { gold: 100 },
          effects: ['Display military strength publicly', '+legitimacy.might = 4'],
        },
        {
          id: 'training_grounds',
          label: 'Establish elite training grounds',
          costs: { gold: 200, wood: 75 },
          effects: ['Strengthen military tradition', '+legitimacy.might = 6'],
        },
        {
          id: 'humble_strength',
          label: 'Let actions speak louder than words',
          effects: ['Maintain strength without boastfulness'],
        },
      ],
    });
  }

  return events;
}

function generateJusticeEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];
  
  // Generate events for significant justice & law changes
  for (const justiceChange of changes.justiceChanges) {
    const region = world.regions.find(r => r.id === justiceChange.regionId);
    if (!region || !region.controlled) continue; // Only controlled regions

    // Lawfulness increased significantly
    if (justiceChange.lawfulness >= 10) {
      events.push({
        id: `lawfulness_improved_${world.tick}`,
        text: `Order and justice flourish in ${region.name}. Your legal reforms have taken hold, creating a more lawful society. Citizens report increased safety and merchants speak of improved trade conditions. **Regional lawfulness increased by ${Math.abs(justiceChange.lawfulness)}.**`,
        choices: [
          {
            id: 'establish_courts',
            label: 'Establish additional courts',
            costs: { gold: 150, stone: 50 },
            effects: ['Expand judicial infrastructure', '+region.lawfulness = 8'],
          },
          {
            id: 'train_magistrates',
            label: 'Train more magistrates',
            costs: { gold: 100 },
            effects: ['Improve legal administration', '+legitimacy.law = 3'],
          },
          {
            id: 'celebrate_order',
            label: 'Celebrate the return of order',
            costs: { gold: 75 },
            effects: ['Boost regional morale', '+region.loyalty = 5'],
          },
        ],
      });
    }

    // Lawfulness decreased significantly  
    if (justiceChange.lawfulness <= -10) {
      events.push({
        id: `lawfulness_declined_${world.tick}`,
        text: `Lawlessness spreads through ${region.name}. Criminal activity increases as your authority weakens. Merchants fear to travel the roads, and citizens speak in hushed tones of corruption and crime. **Regional lawfulness decreased by ${Math.abs(justiceChange.lawfulness)}.**`,
        choices: [
          {
            id: 'martial_law',
            label: 'Declare martial law',
            costs: { gold: 100 },
            effects: ['Restore order through force', '+region.lawfulness = 15', '+legitimacy.might = 5', '-legitimacy.law = 3'],
            riskTags: ['authoritarian_rule'],
          },
          {
            id: 'judicial_reform',
            label: 'Implement judicial reforms',
            costs: { gold: 200 },
            effects: ['Reform the justice system', '+region.lawfulness = 12', '+legitimacy.law = 6'],
          },
          {
            id: 'ignore_problem',
            label: 'Let local authorities handle it',
            effects: ['Maintain current approach', '+region.unrest = 5'],
            riskTags: ['escalating_crime'],
          },
        ],
      });
    }

    // Regional unrest decreased significantly (good news)
    if (justiceChange.unrest <= -8) {
      events.push({
        id: `unrest_calmed_${world.tick}`,
        text: `Peace returns to ${region.name}. The tensions that once gripped the region have subsided, and your people speak gratefully of your leadership. Markets bustle with activity and children play safely in the streets once more. **Regional unrest decreased by ${Math.abs(justiceChange.unrest)}.**`,
        choices: [
          {
            id: 'prosperity_investment',
            label: 'Invest in regional prosperity',
            costs: { gold: 150, grain: 50 },
            effects: ['Strengthen economic foundation', '+region.loyalty = 8', '+region.lawfulness = 5'],
          },
          {
            id: 'maintain_vigilance',
            label: 'Maintain security vigilance',
            costs: { gold: 75 },
            effects: ['Prevent future unrest', '+region.security = 0.1'],
          },
          {
            id: 'reward_loyalty',
            label: 'Reward the loyal citizens',
            costs: { gold: 100 },
            effects: ['Strengthen citizen loyalty', '+region.loyalty = 10'],
          },
        ],
      });
    }
  }

  // Generate trait-based justice events
  if (changes.newTraits.includes('high_crime')) {
    const crimeRegion = world.regions.find(r => r.controlled && r.lawfulness < 30);
    if (crimeRegion) {
      events.push({
        id: `crime_crisis_${world.tick}`,
        text: `Criminal organizations grow bold in ${crimeRegion.name}. Thieves' guilds operate openly, corruption spreads through local officials, and honest citizens fear to leave their homes after dark. Your authority is being challenged by lawlessness itself.`,
        choices: [
          {
            id: 'crush_criminals',
            label: 'Launch military crackdown',
            costs: { gold: 200 },
            effects: ['Use military force against crime', '+region.lawfulness = 20', '+legitimacy.might = 6', '-region.loyalty = 3'],
            riskTags: ['civilian_casualties'],
          },
          {
            id: 'investigate_corruption',
            label: 'Root out official corruption',
            costs: { gold: 150 },
            effects: ['Purge corrupt officials', '+region.lawfulness = 15', '+legitimacy.law = 5'],
            riskTags: ['political_enemies'],
          },
          {
            id: 'negotiate_criminals',
            label: 'Negotiate with criminal leaders',
            costs: { gold: 100 },
            effects: ['Reach accommodation with criminals', '+region.security = 0.05', '-legitimacy.law = 5'],
            riskTags: ['legitimacy_damage'],
          },
        ],
      });
    }
  }

  return events;
}

function generateRegionalEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];

  // New territory acquired
  const newTerritories = changes.regionChanges.filter(c => c.type === 'control' && c.value === true);
  if (newTerritories.length > 0 && newTerritories[0]) {
    const region = world.regions.find(r => r.id === newTerritories[0]!.id);
    events.push({
      id: `territory_acquired_${world.tick}`,
      text: `The banner of ${region?.name || 'the new territory'} now flies your colors. However, the local population eyes your rule with uncertainty. How you handle this transition will set the tone for your reign here.`,
      choices: [
        {
          id: 'local_customs',
          label: 'Respect local customs and traditions',
          effects: ['Improve regional loyalty slowly but surely'],
        },
        {
          id: 'impose_order',
          label: 'Impose your laws immediately',
          effects: ['Establish control quickly but risk resistance'],
          riskTags: ['regional_unrest'],
        },
        {
          id: 'economic_incentives',
          label: 'Offer economic incentives',
          costs: { gold: 100 },
          effects: ['Win over locals with prosperity'],
        },
      ],
    });
  }

  return events;
}

function generateFactionEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];

  // Faction stance changes
  const stanceChanges = changes.factionChanges.filter(c => c.type === 'stance');
  for (const change of stanceChanges.slice(0, 1)) { // Only one faction event per tick
    const faction = world.factions.find(f => f.id === change.id);
    if (!faction) continue;

    if (change.value === 'hostile') {
      events.push({
        id: `faction_hostile_${world.tick}`,
        text: `${faction.name} has declared their hostility toward your rule. Their envoy delivered a formal denunciation before your court, citing your recent actions as cause for their enmity. War may be on the horizon.`,
        choices: [
          {
            id: 'prepare_defenses',
            label: 'Prepare defensive fortifications',
            costs: { wood: 50, stone: 30 },
            effects: ['Improve defenses against future attacks'],
          },
          {
            id: 'preemptive_strike',
            label: 'Launch preemptive attack',
            effects: ['Strike first but risk wider conflict'],
            riskTags: ['multiple_enemies', 'casualties'],
          },
          {
            id: 'diplomatic_solution',
            label: 'Seek diplomatic resolution',
            costs: { gold: 200 },
            effects: ['Attempt to mend relations through negotiation'],
            riskTags: ['weakness_perception'],
          },
        ],
      });
    } else if (change.value === 'allied') {
      events.push({
        id: `faction_allied_${world.tick}`,
        text: `${faction.name} has offered their friendship and support. Their ambassador speaks of mutual benefit and shared prosperity. This alliance could open new opportunities, but it may also bring new obligations.`,
        choices: [
          {
            id: 'formal_alliance',
            label: 'Formalize the alliance with ceremony',
            costs: { gold: 100 },
            effects: ['Strengthen the alliance with public commitment'],
          },
          {
            id: 'trade_agreement',
            label: 'Negotiate favorable trade terms',
            effects: ['Gain ongoing economic benefits'],
          },
          {
            id: 'cautious_acceptance',
            label: 'Accept but remain cautious',
            effects: ['Maintain flexibility while gaining basic support'],
          },
        ],
      });
    }
  }

  return events;
}

function generateFaithEvents(changes: WorldChanges, world: WorldState): EventCard[] {
  const events: EventCard[] = [];
  
  // Generate events for significant faith changes
  for (const faithChange of changes.faithChanges) {
    const region = world.regions.find(r => r.id === faithChange.regionId);
    if (!region || !region.controlled) continue; // Only controlled regions

    // Piety increased significantly
    if (faithChange.piety >= 10) {
      events.push({
        id: `piety_surge_${world.tick}`,
        text: `Religious devotion flourishes in ${region.name}. Your recent spiritual leadership has inspired profound faith among the people. Churches overflow with worshippers, and religious festivals celebrate your divine mandate. **Regional piety increased by ${Math.abs(faithChange.piety)}.**`,
        choices: [
          {
            id: 'build_shrine',
            label: 'Commission new shrines',
            costs: { gold: 200, stone: 50 },
            effects: ['Strengthen religious infrastructure', '+region.piety = 8', '+legitimacy.faith = 5'],
          },
          {
            id: 'ordain_clergy',
            label: 'Ordain new clergy',
            costs: { gold: 150 },
            effects: ['Expand religious administration', '+legitimacy.faith = 6'],
          },
          {
            id: 'humble_acceptance',
            label: 'Accept blessings humbly',
            effects: ['Maintain spiritual momentum'],
          },
        ],
      });
    }

    // Piety decreased significantly  
    if (faithChange.piety <= -10) {
      events.push({
        id: `piety_decline_${world.tick}`,
        text: `Faith wanes in ${region.name}. Your people turn away from religious observance, attending services less frequently. Some question divine support for your rule, while others abandon traditional practices altogether. **Regional piety decreased by ${Math.abs(faithChange.piety)}.**`,
        choices: [
          {
            id: 'religious_revival',
            label: 'Launch religious revival campaign',
            costs: { gold: 300 },
            effects: ['Restore faith through preaching', '+region.piety = 15', '+legitimacy.faith = 8'],
          },
          {
            id: 'tolerance_policy',
            label: 'Show religious tolerance',
            effects: ['Accept diverse beliefs', '+region.loyalty = 5', '-legitimacy.faith = 3'],
          },
          {
            id: 'ignore_decline',
            label: 'Focus on secular matters',
            effects: ['Let faith find its own way', '+region.heresy = 5'],
            riskTags: ['religious_decline'],
          },
        ],
      });
    }

    // Heresy increased significantly
    if (faithChange.heresy >= 8) {
      events.push({
        id: `heresy_rise_${world.tick}`,
        text: `Heterodox beliefs spread through ${region.name}. Alternative religious interpretations gain followers, challenging orthodox doctrine. Some preachers openly question established religious authority, creating theological discord. **Regional heresy increased by ${Math.abs(faithChange.heresy)}.**`,
        choices: [
          {
            id: 'theological_debate',
            label: 'Organize theological debates',
            costs: { gold: 100 },
            effects: ['Address heresy through discussion', '-region.heresy = 10', '+legitimacy.faith = 4'],
          },
          {
            id: 'suppress_heretics',
            label: 'Suppress heretical teachings',
            costs: { gold: 150 },
            effects: ['Use force against heresy', '-region.heresy = 15', '+legitimacy.might = 3', '-legitimacy.faith = 2'],
            riskTags: ['religious_persecution'],
          },
          {
            id: 'religious_accommodation',
            label: 'Accommodate different beliefs',
            effects: ['Allow theological diversity', '+region.loyalty = 5', '+region.heresy = 3'],
          },
        ],
      });
    }
  }

  // Generate trait-based faith events
  if (changes.newTraits.includes('heresy_pressure')) {
    const hereticalRegion = world.regions.find(r => r.controlled && r.heresy > 70);
    if (hereticalRegion) {
      events.push({
        id: `heresy_crisis_${world.tick}`,
        text: `A heretical movement in ${hereticalRegion.name} openly challenges religious orthodoxy. Charismatic leaders preach alternative doctrines, drawing crowds away from traditional services. The established clergy demands immediate action to preserve spiritual unity.`,
        choices: [
          {
            id: 'inquisition',
            label: 'Launch religious inquisition',
            costs: { gold: 250 },
            effects: ['Root out heresy systematically', '-region.heresy = 25', '+legitimacy.faith = 12', '-region.loyalty = 8'],
            riskTags: ['religious_oppression'],
          },
          {
            id: 'reform_church',
            label: 'Reform church teachings',
            costs: { gold: 200 },
            effects: ['Address legitimate concerns', '-region.heresy = 15', '+legitimacy.faith = 8', '+region.piety = 5'],
          },
          {
            id: 'council_dialogue',
            label: 'Convene religious council',
            costs: { gold: 100 },
            effects: ['Seek theological compromise', '-region.heresy = 10', '+region.loyalty = 5'],
          },
        ],
      });
    }
  }

  return events;
}

function generateOmenEvents(world: WorldState): EventCard[] {
  const events: EventCard[] = [];
  
  // Generate omens for each controlled region
  for (const region of world.regions) {
    if (!region.controlled) continue;
    
    // Calculate omen probability
    let omenChance = 0.02; // Base 2%
    if (region.piety > 70) omenChance += 0.02; // +2% if piety > 70
    if (world.legitimacy.faith < 40) omenChance += 0.03; // +3% if faith < 40
    
    // Check for omen (using deterministic approach based on tick and region)
    const omenSeed = world.seed + world.tick + parseInt(region.id.replace(/\D/g, ''));
    const omenRoll = (omenSeed * 9301 + 49297) % 233280 / 233280;
    
    if (omenRoll < omenChance) {
      // Determine omen type
      const omenType = omenRoll < omenChance * 0.4 ? 'good_sign' : 
                      omenRoll < omenChance * 0.8 ? 'dire_sign' : 'false_prophet';
      
      let omenEvent: EventCard;
      
      switch (omenType) {
        case 'good_sign':
          omenEvent = {
            id: `good_omen_${world.tick}_${region.id}`,
            text: `A miraculous sign appears in ${region.name}! Witnesses report divine light illuminating the local temple at dawn, and a spring of pure water bursts forth from barren ground. The faithful see this as blessing upon your rule, but skeptics question its authenticity.`,
            choices: [
              {
                id: 'honor_sign',
                label: 'Honor the divine sign',
                costs: { gold: 150, grain: 50 },
                effects: ['Celebrate the divine blessing', '+region.piety = 12', '+legitimacy.faith = 8', '-region.unrest = 5'],
              },
              {
                id: 'ignore_sign',
                label: 'Ignore the superstition',
                effects: ['Focus on practical matters', '-legitimacy.faith = 5', '-region.piety = 8'],
              },
              {
                id: 'investigate_sign',
                label: 'Investigate the phenomenon',
                costs: { gold: 100 },
                effects: ['Seek rational explanation', '+legitimacy.law = 3'],
                riskTags: ['disillusionment'],
              },
            ],
          };
          break;
          
        case 'dire_sign':
          omenEvent = {
            id: `dire_omen_${world.tick}_${region.id}`,
            text: `Ominous portents manifest in ${region.name}. Blood-red rain falls from clear skies, livestock behave strangely, and prophetic dreams trouble the sleep of the faithful. Many interpret these signs as warnings of divine displeasure with current leadership.`,
            choices: [
              {
                id: 'appease_divine',
                label: 'Perform appeasement rituals',
                costs: { gold: 200, grain: 75 },
                effects: ['Seek divine forgiveness', '+legitimacy.faith = 10', '+region.piety = 8', '-region.unrest = 8'],
              },
              {
                id: 'dismiss_superstition',
                label: 'Dismiss as superstition',
                effects: ['Reject fearful interpretations', '-legitimacy.faith = 8', '+region.heresy = 5'],
                riskTags: ['loss_of_faith'],
              },
              {
                id: 'scientific_investigation',
                label: 'Commission scientific study',
                costs: { gold: 150 },
                effects: ['Seek natural explanations', '+legitimacy.law = 5', '-region.piety = 3'],
              },
            ],
          };
          break;
          
        case 'false_prophet':
          omenEvent = {
            id: `false_prophet_${world.tick}_${region.id}`,
            text: `A charismatic preacher in ${region.name} claims to receive divine visions, attracting growing crowds with prophecies and miraculous healings. While many believe in their divine calling, others suspect deception. The established clergy views this challenger with deep suspicion.`,
            choices: [
              {
                id: 'expose_charlatan',
                label: 'Expose the false prophet',
                costs: { gold: 100 },
                effects: ['Reveal deception', '+legitimacy.faith = 8', '-region.heresy = 10'],
                riskTags: ['religious_conflict'],
              },
              {
                id: 'co_opt_prophet',
                label: 'Incorporate into clergy',
                costs: { gold: 200 },
                effects: ['Channel their influence', '+legitimacy.faith = 5', '+region.piety = 8'],
              },
              {
                id: 'tolerate_preacher',
                label: 'Allow them to preach',
                effects: ['Permit religious diversity', '+region.loyalty = 3', '+region.heresy = 5'],
              },
            ],
          };
          break;
      }
      
      events.push(omenEvent);
    }
  }
  
  return events;
}