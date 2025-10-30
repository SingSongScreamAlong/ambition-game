'use client';

import React, { useMemo } from 'react';

interface DomainWeights {
  power: number;
  wealth: number;
  faith: number;
  virtue: number;
  freedom: number;
  creation: number;
}

interface AmbitionWheelProps {
  traits: DomainWeights;
  deltas?: Partial<DomainWeights>; // For animation when values change
  size?: number;
}

export function AmbitionWheel({ traits, deltas, size = 200 }: AmbitionWheelProps) {
  const domains = useMemo(() => [
    { key: 'power', label: 'Power', value: traits.power, color: '#ef4444' },
    { key: 'wealth', label: 'Wealth', value: traits.wealth, color: '#f59e0b' },
    { key: 'faith', label: 'Faith', value: traits.faith, color: '#8b5cf6' },
    { key: 'virtue', label: 'Virtue', value: traits.virtue, color: '#10b981' },
    { key: 'freedom', label: 'Freedom', value: traits.freedom, color: '#06b6d4' },
    { key: 'creation', label: 'Creation', value: traits.creation, color: '#ec4899' }
  ] as const, [traits]);

  const center = size / 2;
  const radius = size * 0.35;
  const maxRadius = size * 0.4;

  // Generate paths for each domain slice
  const paths = useMemo(() => {
    return domains.map((domain, index) => {
      const angle = (index * 60) - 90; // Start from top, 60 degrees per domain
      const angleRad = (angle * Math.PI) / 180;
      const nextAngleRad = ((angle + 60) * Math.PI) / 180;
      
      const valueRadius = radius + (domain.value * (maxRadius - radius));
      
      const x1 = center + Math.cos(angleRad) * radius;
      const y1 = center + Math.sin(angleRad) * radius;
      const x2 = center + Math.cos(nextAngleRad) * radius;
      const y2 = center + Math.sin(nextAngleRad) * radius;
      
      const x3 = center + Math.cos(nextAngleRad) * valueRadius;
      const y3 = center + Math.sin(nextAngleRad) * valueRadius;
      const x4 = center + Math.cos(angleRad) * valueRadius;
      const y4 = center + Math.sin(angleRad) * valueRadius;

      const largeArcFlag = 0; // 60 degrees is always less than 180
      
      return `M ${x1} ${y1} 
              L ${x4} ${y4} 
              A ${valueRadius} ${valueRadius} 0 ${largeArcFlag} 1 ${x3} ${y3}
              L ${x2} ${y2}
              A ${radius} ${radius} 0 ${largeArcFlag} 0 ${x1} ${y1} Z`;
    });
  }, [domains, center, radius, maxRadius]);

  // Generate label positions
  const labels = useMemo(() => {
    return domains.map((domain, index) => {
      const angle = (index * 60) - 90 + 30; // Center of each slice
      const angleRad = (angle * Math.PI) / 180;
      const labelRadius = maxRadius + 20;
      
      const x = center + Math.cos(angleRad) * labelRadius;
      const y = center + Math.sin(angleRad) * labelRadius;
      
      return { ...domain, x, y };
    });
  }, [domains, center, maxRadius]);

  return (
    <div className="relative">
      <svg width={size} height={size} className="drop-shadow-sm">
        {/* Background circle */}
        <circle 
          cx={center} 
          cy={center} 
          r={maxRadius} 
          fill="none" 
          stroke="#e5e7eb" 
          strokeWidth="1"
          className="opacity-30"
        />
        
        {/* Inner circle */}
        <circle 
          cx={center} 
          cy={center} 
          r={radius} 
          fill="#f9fafb" 
          stroke="#e5e7eb" 
          strokeWidth="1"
        />

        {/* Domain slices */}
        {paths.map((path, index) => {
          const domain = domains[index];
          if (!domain) return null;
          const delta = deltas?.[domain.key as keyof DomainWeights];
          const hasDelta = delta && Math.abs(delta) > 0.01;
          
          return (
            <g key={domain.key}>
              <path
                d={path}
                fill={domain.color}
                opacity={0.7}
                stroke="white"
                strokeWidth="1"
                className={`transition-all duration-300 ${
                  hasDelta ? 'animate-pulse' : ''
                }`}
              />
              {/* Pulse effect for changes */}
              {hasDelta && (
                <path
                  d={path}
                  fill={domain.color}
                  opacity={0.9}
                  stroke="white"
                  strokeWidth="2"
                  className="animate-ping"
                />
              )}
            </g>
          );
        })}

        {/* Grid lines */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i * 60) - 90;
          const angleRad = (angle * Math.PI) / 180;
          const x = center + Math.cos(angleRad) * maxRadius;
          const y = center + Math.sin(angleRad) * maxRadius;
          
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}

        {/* Value rings */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(ratio => (
          <circle
            key={ratio}
            cx={center}
            cy={center}
            r={radius + ((maxRadius - radius) * ratio)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="2,2"
          />
        ))}
      </svg>

      {/* Domain labels */}
      <div className="absolute inset-0 pointer-events-none">
        {labels.map(label => (
          <div
            key={label.key}
            className="absolute text-xs font-medium text-gray-700 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: label.x,
              top: label.y,
            }}
          >
            <div className="text-center">
              <div>{label.label}</div>
              <div className="text-xs text-gray-500">
                {Math.round(label.value * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}