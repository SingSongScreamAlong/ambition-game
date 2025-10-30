import { type GameStartResponse } from '@/lib/api';

interface AmbitionGraphProps {
  graph: GameStartResponse['graph'];
}

export function AmbitionGraph({ graph }: AmbitionGraphProps) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-secondary-900 mb-4">
        Your Path: {graph.ambition}
      </h2>
      
      <div className="space-y-4">
        {graph.nodes.map((node) => (
          <div 
            key={node.id}
            className={`p-4 rounded-lg border-2 transition-colors ${
              node.status === 'met' 
                ? 'border-green-200 bg-green-50' 
                : 'border-secondary-200 bg-secondary-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${
                  node.status === 'met' 
                    ? 'bg-green-500' 
                    : 'bg-secondary-300'
                }`} />
                <h3 className="font-medium text-secondary-900">
                  {node.label}
                </h3>
              </div>
              
              <span className={`badge ${
                node.status === 'met' 
                  ? 'badge-success' 
                  : 'badge-secondary'
              }`}>
                {node.status === 'met' ? 'Complete' : 'Unmet'}
              </span>
            </div>
            
            {node.needs && node.needs.length > 0 && (
              <div className="mt-2 text-sm text-secondary-600">
                <span className="font-medium">Prerequisites:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {node.needs.map((need) => {
                    const prereqNode = graph.nodes.find(n => n.id === need);
                    return (
                      <span 
                        key={need}
                        className={`badge ${
                          prereqNode?.status === 'met' 
                            ? 'badge-success' 
                            : 'badge-warning'
                        }`}
                      >
                        {prereqNode?.label || need}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            
            {node.paths && node.paths.length > 0 && (
              <div className="mt-2 text-sm text-secondary-600">
                <span className="font-medium">Available paths:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {node.paths.map((path) => (
                    <span key={path} className="badge badge-primary">
                      {path.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-primary-50 rounded-lg">
        <p className="text-sm text-primary-700">
          💡 <strong>Tip:</strong> Complete requirements in order. Some actions may require prerequisites to be met first.
        </p>
      </div>
    </div>
  );
}