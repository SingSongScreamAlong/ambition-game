import { type Resources, type People, type Forces } from '@/lib/api';

interface ResourcePanelProps {
  resources: Resources;
  people: People;
  forces: Forces;
  tick: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatPercentage(num: number): string {
  return Math.round(num * 100) + '%';
}

function getResourceIcon(resource: string): string {
  const icons: Record<string, string> = {
    gold: '💰',
    grain: '🌾',
    iron: '⚔️',
    wood: '🪵',
    stone: '🏗️',
  };
  return icons[resource] || '📦';
}

function getStatusColor(value: number, thresholds: { good: number; warning: number }): string {
  if (value >= thresholds.good) return 'text-green-600';
  if (value >= thresholds.warning) return 'text-yellow-600';
  return 'text-red-600';
}

export function ResourcePanel({ resources, people, forces, tick }: ResourcePanelProps) {
  return (
    <div className="space-y-6">
      {/* Turn Counter */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-3">
          Turn {tick}
        </h3>
        <div className="text-sm text-secondary-600">
          Time advances with each action you take
        </div>
      </div>

      {/* Resources */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">
          Resources
        </h3>
        <div className="space-y-3">
          {Object.entries(resources).map(([resource, amount]) => (
            <div key={resource} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getResourceIcon(resource)}</span>
                <span className="capitalize text-secondary-700">{resource}</span>
              </div>
              <span className={`font-medium ${
                amount < 50 ? 'text-red-600' : 
                amount < 100 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {formatNumber(amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* People */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">
          Your People
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">👥</span>
              <span className="text-secondary-700">Population</span>
            </div>
            <span className="font-medium text-secondary-900">
              {formatNumber(people.population)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">❤️</span>
              <span className="text-secondary-700">Loyalty</span>
            </div>
            <span className={`font-medium ${getStatusColor(people.loyalty, { good: 0.7, warning: 0.4 })}`}>
              {formatPercentage(people.loyalty)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">😠</span>
              <span className="text-secondary-700">Unrest</span>
            </div>
            <span className={`font-medium ${getStatusColor(1 - people.unrest, { good: 0.7, warning: 0.4 })}`}>
              {formatPercentage(people.unrest)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🙏</span>
              <span className="text-secondary-700">Faith</span>
            </div>
            <span className={`font-medium ${getStatusColor(people.faith, { good: 0.7, warning: 0.4 })}`}>
              {formatPercentage(people.faith)}
            </span>
          </div>
        </div>
        
        {people.loyalty < 0.3 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              ⚠️ Your people's loyalty is dangerously low!
            </p>
          </div>
        )}
        
        {people.unrest > 0.7 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              🔥 Unrest is spreading among your people!
            </p>
          </div>
        )}
      </div>

      {/* Forces */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">
          Military Forces
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">⚔️</span>
              <span className="text-secondary-700">Units</span>
            </div>
            <span className={`font-medium ${
              forces.units < 20 ? 'text-red-600' : 
              forces.units < 50 ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {formatNumber(forces.units)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">💪</span>
              <span className="text-secondary-700">Morale</span>
            </div>
            <span className={`font-medium ${getStatusColor(forces.morale, { good: 0.7, warning: 0.4 })}`}>
              {formatPercentage(forces.morale)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📦</span>
              <span className="text-secondary-700">Supply</span>
            </div>
            <span className={`font-medium ${getStatusColor(forces.supply, { good: 0.7, warning: 0.4 })}`}>
              {formatPercentage(forces.supply)}
            </span>
          </div>
        </div>
        
        {forces.units === 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              ⚠️ You have no military forces!
            </p>
          </div>
        )}
        
        {forces.morale < 0.3 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              😔 Your troops' morale is critically low!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}