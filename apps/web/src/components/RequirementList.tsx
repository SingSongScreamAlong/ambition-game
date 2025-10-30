'use client';

import React from 'react';

interface GraphNode {
  id: string;
  label: string;
  status: 'unmet' | 'met';
  needs?: string[];
  paths?: string[];
  domains?: string[];
  spawnThreshold?: number;
  spawnedAtTick?: number;
}

interface RequirementListProps {
  nodes: GraphNode[];
  newlyAddedNodeIds: string[];
  onNodeClick?: (nodeId: string) => void;
}

export function RequirementList({ nodes, newlyAddedNodeIds, onNodeClick }: RequirementListProps) {
  const getDomainColor = (domain: string): string => {
    const colors: Record<string, string> = {
      power: '#ef4444',
      wealth: '#f59e0b',
      faith: '#8b5cf6',
      virtue: '#10b981',
      freedom: '#06b6d4',
      creation: '#ec4899'
    };
    return colors[domain] || '#6b7280';
  };

  const getStatusIcon = (status: string): string => {
    return status === 'met' ? '✓' : '○';
  };

  const getStatusColor = (status: string): string => {
    return status === 'met' ? 'text-green-600' : 'text-gray-400';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Requirements</h3>
        {newlyAddedNodeIds.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {newlyAddedNodeIds.length} new
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎯</div>
            <p>No requirements yet</p>
            <p className="text-sm">Your ambitions will generate goals as you progress</p>
          </div>
        ) : (
          nodes.map(node => {
            const isNew = newlyAddedNodeIds.includes(node.id);
            const isDreamNode = node.spawnedAtTick !== undefined;
            
            return (
              <div
                key={node.id}
                className={`relative p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-sm ${
                  isNew 
                    ? 'bg-blue-50 border-blue-200 shadow-md animate-pulse' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                } ${
                  node.status === 'met' ? 'opacity-60' : ''
                }`}
                onClick={() => onNodeClick?.(node.id)}
              >
                {/* New badge */}
                {isNew && (
                  <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-bounce">
                    NEW
                  </div>
                )}

                {/* Dream reflection badge */}
                {isDreamNode && (
                  <div className="absolute -top-2 -left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    💭 Dream
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  {/* Status icon */}
                  <div className={`text-lg ${getStatusColor(node.status)} mt-0.5`}>
                    {getStatusIcon(node.status)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {node.label}
                    </h4>
                    
                    {/* Domain tags */}
                    {node.domains && node.domains.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {node.domains.map(domain => (
                          <span
                            key={domain}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: getDomainColor(domain) }}
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dependencies */}
                    {node.needs && node.needs.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        Needs: {node.needs.join(', ')}
                      </div>
                    )}

                    {/* Available paths */}
                    {node.paths && node.paths.length > 0 && node.status === 'unmet' && (
                      <div className="mt-1 text-xs text-blue-600">
                        {node.paths.length} path{node.paths.length !== 1 ? 's' : ''} available
                      </div>
                    )}

                    {/* Spawn threshold info */}
                    {node.spawnThreshold !== undefined && (
                      <div className="mt-1 text-xs text-purple-600">
                        Threshold: {Math.round(node.spawnThreshold * 100)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {nodes.length > 0 && (
        <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
          {nodes.filter(n => n.status === 'met').length} of {nodes.length} requirements met
        </div>
      )}
    </div>
  );
}