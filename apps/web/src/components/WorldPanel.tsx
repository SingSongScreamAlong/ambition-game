import { type WorldState, type ActionProposal, type Resources } from '@/lib/api';

interface WorldPanelProps {
  world: WorldState;
  proposals: ActionProposal[];
  onChooseAction?: (actionId: string) => void;
  onAdvanceTick?: () => void;
  isLoading?: boolean;
}

function formatResourceCost(costs: Partial<Resources>): string {
  return Object.entries(costs)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(', ');
}

function canAffordAction(costs: Partial<Resources>, playerResources: Resources): boolean {
  return Object.entries(costs).every(([resource, cost]) => {
    const available = playerResources[resource as keyof Resources];
    return available >= cost;
  });
}

function formatRisks(risks: Record<string, number>): string {
  return Object.entries(risks)
    .map(([risk, probability]) => `${Math.round(probability * 100)}% ${risk.replace('_', ' ')}`)
    .join(', ');
}

export function WorldPanel({ world, proposals, onChooseAction, onAdvanceTick, isLoading }: WorldPanelProps) {
  const controlledRegions = world.regions.filter(r => r.controlled);
  const uncontrolledRegions = world.regions.filter(r => !r.controlled);

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-secondary-900">
            Available Actions
          </h3>
          <button
            onClick={onAdvanceTick}
            disabled={isLoading}
            className="btn btn-secondary text-sm"
          >
            {isLoading ? 'Processing...' : 'Pass Time'}
          </button>
        </div>
        
        {proposals.length === 0 ? (
          <div className="text-center py-6 text-secondary-500">
            <p>No actions available at the moment.</p>
            <p className="text-sm mt-1">Try advancing time to see new opportunities.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((action) => {
              const canAfford = !action.costs || canAffordAction(action.costs, world.resources);
              
              return (
                <div
                  key={action.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    canAfford && !isLoading
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-secondary-200 bg-secondary-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-secondary-900">
                      {action.label}
                    </h4>
                    <span className="badge badge-secondary text-xs">
                      {action.time}
                    </span>
                  </div>
                  
                  <p className="text-sm text-secondary-700 mb-3">
                    {action.description}
                  </p>
                  
                  <div className="space-y-2 mb-4">
                    {action.satisfies.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-green-600">Advances: </span>
                        <span className="text-green-700">
                          {action.satisfies.join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {action.costs && Object.keys(action.costs).length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-red-600">Cost: </span>
                        <span className="text-red-700">
                          {formatResourceCost(action.costs)}
                        </span>
                      </div>
                    )}
                    
                    {action.rewards && Object.keys(action.rewards).length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-green-600">Rewards: </span>
                        <span className="text-green-700">
                          {formatResourceCost(action.rewards)}
                        </span>
                      </div>
                    )}
                    
                    {action.risks && Object.keys(action.risks).length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-yellow-600">Risks: </span>
                        <span className="text-yellow-700">
                          {formatRisks(action.risks)}
                        </span>
                      </div>
                    )}
                    
                    {action.requirements && action.requirements.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-blue-600">Requires: </span>
                        <span className="text-blue-700">
                          {action.requirements.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => onChooseAction?.(action.id)}
                    disabled={!canAfford || isLoading}
                    className={`w-full btn ${
                      canAfford && !isLoading 
                        ? 'btn-primary' 
                        : 'bg-secondary-300 text-secondary-500 cursor-not-allowed'
                    }`}
                  >
                    {!canAfford ? 'Cannot Afford' : isLoading ? 'Processing...' : 'Choose This Action'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Territories */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">
          Territories
        </h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-green-700 mb-2">
              Controlled ({controlledRegions.length})
            </h4>
            {controlledRegions.length === 0 ? (
              <p className="text-sm text-secondary-500">No territories under your control</p>
            ) : (
              <div className="space-y-2">
                {controlledRegions.map((region) => (
                  <div key={region.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-green-800">{region.name}</span>
                      <span className="text-sm text-green-600">
                        {Math.round(region.security * 100)}% secure
                      </span>
                    </div>
                    <div className="text-xs text-green-700">
                      Pop: {region.people.population.toLocaleString()} | 
                      Loyalty: {Math.round(region.people.loyalty * 100)}% | 
                      Law: <span className={
                        region.lawfulness >= 70 ? 'text-green-600' :
                        region.lawfulness >= 40 ? 'text-yellow-600' :
                        'text-red-600'
                      }>{Math.round(region.lawfulness)}%</span> | 
                      Unrest: <span className={
                        region.unrest <= 30 ? 'text-green-600' :
                        region.unrest <= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }>{Math.round(region.unrest)}%</span>
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      Piety: <span className={
                        region.piety >= 70 ? 'text-blue-600' :
                        region.piety >= 50 ? 'text-blue-500' :
                        region.piety >= 30 ? 'text-yellow-600' :
                        'text-red-600'
                      }>{Math.round(region.piety)}%</span> | 
                      Heresy: <span className={
                        region.heresy <= 20 ? 'text-green-600' :
                        region.heresy <= 40 ? 'text-yellow-600' :
                        region.heresy <= 60 ? 'text-orange-600' :
                        'text-red-600'
                      }>{Math.round(region.heresy)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <h4 className="font-medium text-secondary-700 mb-2">
              Other Territories ({uncontrolledRegions.length})
            </h4>
            {uncontrolledRegions.length === 0 ? (
              <p className="text-sm text-secondary-500">You control all known territories</p>
            ) : (
              <div className="space-y-2">
                {uncontrolledRegions.slice(0, 3).map((region) => (
                  <div key={region.id} className="p-3 bg-secondary-50 border border-secondary-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-secondary-800">{region.name}</span>
                      <span className="text-sm text-secondary-600">
                        {Math.round(region.security * 100)}% secure
                      </span>
                    </div>
                    <div className="text-xs text-secondary-700">
                      Pop: {region.people.population.toLocaleString()}
                    </div>
                  </div>
                ))}
                {uncontrolledRegions.length > 3 && (
                  <p className="text-sm text-secondary-500">
                    ...and {uncontrolledRegions.length - 3} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Factions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">
          Faction Relations
        </h3>
        
        <div className="space-y-3">
          {world.factions.map((faction) => (
            <div key={faction.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
              <div>
                <div className="font-medium text-secondary-900">{faction.name}</div>
                <div className="text-sm text-secondary-600">
                  Power: {faction.power} | Regions: {faction.regions.length}
                </div>
              </div>
              <span className={`badge ${
                faction.stance === 'allied' ? 'badge-success' :
                faction.stance === 'hostile' ? 'badge-danger' :
                'badge-secondary'
              }`}>
                {faction.stance}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Traits */}
      {world.traits.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">
            Current Conditions
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {world.traits.map((trait) => (
              <span key={trait} className={`badge ${
                trait.includes('scarcity') || trait.includes('shortage') ? 'badge-danger' :
                trait.includes('winter') ? 'badge-secondary' :
                trait.includes('heresy_pressure') ? 'bg-purple-500 text-white' :
                trait.includes('high_crime') ? 'badge-danger' :
                trait.includes('high_bureaucracy') ? 'bg-blue-500 text-white' :
                'badge-primary'
              }`}>
                {trait.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}