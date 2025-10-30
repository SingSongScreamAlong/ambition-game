import { type EventCard, type Resources } from '@/lib/api';

interface EventFeedProps {
  events: EventCard[];
  onChooseEvent?: (eventId: string, choiceId: string) => void;
  playerResources?: Resources;
  isLoading?: boolean;
}

function formatResourceCost(costs: Partial<Resources>): string {
  return Object.entries(costs)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(', ');
}

function canAffordChoice(costs: Partial<Resources>, playerResources: Resources): boolean {
  return Object.entries(costs).every(([resource, cost]) => {
    const available = playerResources[resource as keyof Resources];
    return available >= cost;
  });
}

export function EventFeed({ events, onChooseEvent, playerResources, isLoading }: EventFeedProps) {
  if (events.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-secondary-900 mb-4">
          Recent Events
        </h2>
        <div className="text-center py-8 text-secondary-500">
          <p className="text-lg">All is quiet for now...</p>
          <p className="text-sm mt-2">Events will appear here as your story unfolds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-secondary-900 mb-4">
        Recent Events
      </h2>
      
      <div className="space-y-6">
        {events.map((event) => (
          <div key={event.id} className="border border-secondary-200 rounded-lg p-6 bg-secondary-50">
            <div className="prose prose-sm max-w-none mb-6">
              <p className="text-secondary-800 leading-relaxed">
                {event.text}
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-secondary-900">
                What do you choose?
              </h4>
              
              {event.choices.map((choice) => {
                const canAfford = !choice.costs || !playerResources || canAffordChoice(choice.costs, playerResources);
                
                return (
                  <button
                    key={choice.id}
                    onClick={() => onChooseEvent?.(event.id, choice.id)}
                    disabled={!canAfford || isLoading}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      canAfford && !isLoading
                        ? 'border-primary-200 bg-primary-50 hover:border-primary-300 hover:bg-primary-100 cursor-pointer'
                        : 'border-secondary-200 bg-secondary-100 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="font-medium text-secondary-900 mb-2">
                      {choice.label}
                    </div>
                    
                    <div className="space-y-2">
                      {choice.costs && Object.keys(choice.costs).length > 0 && (
                        <div className="text-sm">
                          <span className="text-red-600 font-medium">Cost: </span>
                          <span className="text-red-700">
                            {formatResourceCost(choice.costs)}
                          </span>
                        </div>
                      )}
                      
                      {choice.effects && choice.effects.length > 0 && (
                        <div className="text-sm">
                          <span className="text-green-600 font-medium">Effects: </span>
                          <span className="text-green-700">
                            {choice.effects.join(', ')}
                          </span>
                        </div>
                      )}
                      
                      {choice.riskTags && choice.riskTags.length > 0 && (
                        <div className="text-sm">
                          <span className="text-yellow-600 font-medium">Risks: </span>
                          <span className="text-yellow-700">
                            {choice.riskTags.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {isLoading && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2 text-secondary-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            <span>Processing your choice...</span>
          </div>
        </div>
      )}
    </div>
  );
}