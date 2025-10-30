import { type Legitimacy } from '@/lib/api';

interface LegitimacyPanelProps {
  legitimacy: Legitimacy;
}

function formatPercentage(num: number): string {
  return Math.round(num) + '%';
}

function getLegitimacyIcon(type: string): string {
  const icons: Record<string, string> = {
    law: '⚖️',
    faith: '🛐',
    lineage: '👑',
    might: '💪',
  };
  return icons[type] || '📊';
}

function getLegitimacyColor(value: number): string {
  if (value >= 75) return 'text-green-600';
  if (value >= 50) return 'text-yellow-600';
  if (value >= 25) return 'text-orange-600';
  return 'text-red-600';
}

function getLegitimacyBarColor(value: number): string {
  if (value >= 75) return 'bg-green-500';
  if (value >= 50) return 'bg-yellow-500';
  if (value >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function getLegitimacyDescription(type: string, value: number): string {
  const descriptions: Record<string, Record<string, string>> = {
    law: {
      high: 'Your legal authority is unquestioned. Bureaucrats and magistrates enforce your will efficiently.',
      medium: 'You maintain adequate legal control, though some question your administrative competence.',
      low: 'Your legal authority is weak. Laws are poorly enforced and bureaucracy struggles.',
      critical: 'Legal chaos threatens your realm. Your authority through law has nearly collapsed.',
    },
    faith: {
      high: 'The divine clearly favors your rule. Clergy and faithful see you as blessed by the gods.',
      medium: 'You maintain religious support, though some question your spiritual authority.',
      low: 'Religious leaders grow distant. Many doubt your divine mandate to rule.',
      critical: 'The gods seem to have abandoned you. Religious opposition grows stronger.',
    },
    lineage: {
      high: 'Your noble bloodline is beyond reproach. All acknowledge your hereditary right to rule.',
      medium: 'Your ancestry grants you respect, though some question your family\'s claims.',
      low: 'Your bloodline is contested. Many question your hereditary right to power.',
      critical: 'Your claim through birth is nearly worthless. Noble opposition mounts against you.',
    },
    might: {
      high: 'Your strength is legendary. All recognize your right to rule through conquest and power.',
      medium: 'Your military prowess is respected, though some challenge your authority.',
      low: 'Your strength is questioned. Rivals see weakness and opportunity.',
      critical: 'You appear powerless to your enemies. Military authority has collapsed.',
    },
  };

  const level = value >= 75 ? 'high' : value >= 50 ? 'medium' : value >= 25 ? 'low' : 'critical';
  return descriptions[type]?.[level] || 'Status unknown';
}

export function LegitimacyPanel({ legitimacy }: LegitimacyPanelProps) {
  const legitimacyEntries = [
    { key: 'law', label: 'Legal Authority', value: legitimacy.law },
    { key: 'faith', label: 'Divine Mandate', value: legitimacy.faith },
    { key: 'lineage', label: 'Noble Bloodline', value: legitimacy.lineage },
    { key: 'might', label: 'Power Through Force', value: legitimacy.might },
  ];

  const averageLegitimacy = Math.round(
    (legitimacy.law + legitimacy.faith + legitimacy.lineage + legitimacy.might) / 4
  );

  const lowestLegitimacy = Math.min(legitimacy.law, legitimacy.faith, legitimacy.lineage, legitimacy.might);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900">
          Legitimacy
        </h3>
        <div className="text-right">
          <div className={`text-sm font-medium ${getLegitimacyColor(averageLegitimacy)}`}>
            {formatPercentage(averageLegitimacy)} Overall
          </div>
          <div className="text-xs text-secondary-500">
            Rule by right
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {legitimacyEntries.map(({ key, label, value }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getLegitimacyIcon(key)}</span>
                <span className="text-sm font-medium text-secondary-700">{label}</span>
              </div>
              <span className={`text-sm font-bold ${getLegitimacyColor(value)}`}>
                {formatPercentage(value)}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-secondary-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getLegitimacyBarColor(value)}`}
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
              />
            </div>
            
            {/* Description */}
            <p className="text-xs text-secondary-600 leading-relaxed">
              {getLegitimacyDescription(key, value)}
            </p>
          </div>
        ))}
      </div>

      {/* Warning alerts */}
      {lowestLegitimacy < 25 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            ⚠️ Your legitimacy is critically low! Your right to rule is being questioned.
          </p>
        </div>
      )}

      {averageLegitimacy < 40 && lowestLegitimacy >= 25 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            📉 Your overall legitimacy is weakening. Consider actions to strengthen your authority.
          </p>
        </div>
      )}

      {averageLegitimacy >= 80 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            ✨ Your legitimacy is strong! Your right to rule is widely recognized and respected.
          </p>
        </div>
      )}
    </div>
  );
}