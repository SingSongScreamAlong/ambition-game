'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { GraphNode } from '@ambition/oracle-engine';
import { api } from '@/lib/api';
import { AmbitionGraph } from '@/components/AmbitionGraph';
import { AmbitionWheel } from '@/components/AmbitionWheel';
import { RequirementList } from '@/components/RequirementList';
import { EventFeed } from '@/components/EventFeed';
import { ResourcePanel } from '@/components/ResourcePanel';
import { LegitimacyPanel } from '@/components/LegitimacyPanel';
import { WorldPanel } from '@/components/WorldPanel';

export default function GamePlayPage() {
  const params = useParams();
  const playerId = params.id as string;
  const queryClient = useQueryClient();
  
  // Track newly added nodes for highlighting
  const [newlyAddedNodeIds, setNewlyAddedNodeIds] = React.useState<string[]>([]);
  const [ambitionDeltas, setAmbitionDeltas] = React.useState<Record<string, number>>({});

  // Fetch game state
  const { data: gameState, isLoading, error } = useQuery({
    queryKey: ['gameState', playerId],
    queryFn: () => api.getGameState(playerId),
    refetchInterval: false, // Only refetch on mutations
    enabled: !!playerId,
  });

  // Choose action mutation
  const chooseActionMutation = useMutation({
    mutationFn: ({ actionId }: { actionId: string }) => 
      api.chooseAction(playerId, actionId),
    onSuccess: (data) => {
      // Track ambition changes
      const oldProfile = (gameState?.world as any)?.ambitionProfile;
      const newProfile = (data.world as any)?.ambitionProfile;
      if (oldProfile && newProfile) {
        const deltas: Record<string, number> = {};
        for (const domain of ['power', 'wealth', 'faith', 'virtue', 'freedom', 'creation']) {
          const delta = (newProfile[domain] || 0) - (oldProfile[domain] || 0);
          if (Math.abs(delta) > 0.01) {
            deltas[domain] = delta;
          }
        }
        setAmbitionDeltas(deltas);
        // Clear deltas after animation
        setTimeout(() => setAmbitionDeltas({}), 3000);
      }

      // Update the game state with new data
      queryClient.setQueryData(['gameState', playerId], {
        graph: gameState?.graph, // Graph doesn't change in choose action response
        world: data.world,
        pendingActions: data.proposals,
        lastEvents: data.events,
      });
    },
  });

  // Advance time mutation
  const advanceTimeMutation = useMutation({
    mutationFn: () => api.advanceGame(playerId),
    onSuccess: (data) => {
      // Check for new graph nodes (Dream Reflection events)
      const oldNodes = gameState?.graph?.nodes || [];
      const newNodes = data.graph?.nodes || [];
      const newNodeIds = newNodes
        .filter((newNode: GraphNode) => !oldNodes.find((oldNode: GraphNode) => oldNode.id === newNode.id))
        .map((node: GraphNode) => node.id);
      
      if (newNodeIds.length > 0) {
        setNewlyAddedNodeIds(newNodeIds);
        // Auto-clear the highlighting after 10 seconds
        setTimeout(() => setNewlyAddedNodeIds([]), 10000);
      }

      // Track ambition changes from advance
      const oldProfile = (gameState?.world as any)?.ambitionProfile;
      const newProfile = (data.world as any)?.ambitionProfile;
      if (oldProfile && newProfile) {
        const deltas: Record<string, number> = {};
        for (const domain of ['power', 'wealth', 'faith', 'virtue', 'freedom', 'creation']) {
          const delta = (newProfile[domain] || 0) - (oldProfile[domain] || 0);
          if (Math.abs(delta) > 0.01) {
            deltas[domain] = delta;
          }
        }
        setAmbitionDeltas(deltas);
        setTimeout(() => setAmbitionDeltas({}), 3000);
      }

      queryClient.setQueryData(['gameState', playerId], {
        graph: data.graph || gameState?.graph,
        world: data.world,
        pendingActions: data.proposals,
        lastEvents: data.events,
      });
    },
  });

  // Choose event mutation (for event choices)
  const chooseEventMutation = useMutation({
    mutationFn: ({ eventId, choiceId }: { eventId: string; choiceId: string }) => 
      api.chooseAction(playerId, eventId, choiceId),
    onSuccess: (data) => {
      queryClient.setQueryData(['gameState', playerId], {
        graph: gameState?.graph,
        world: data.world,
        pendingActions: data.proposals,
        lastEvents: data.events,
      });
    },
  });

  const handleChooseAction = (actionId: string) => {
    chooseActionMutation.mutate({ actionId });
  };

  const handleAdvanceTick = () => {
    advanceTimeMutation.mutate();
  };

  const handleChooseEvent = (eventId: string, choiceId: string) => {
    chooseEventMutation.mutate({ eventId, choiceId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">Loading your world...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="card bg-red-50 border-red-200">
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Game Not Found
          </h2>
          <p className="text-red-700 mb-4">
            This game session could not be loaded. It may have expired or the ID is invalid.
          </p>
          <a href="/new" className="btn btn-primary">
            Start New Game
          </a>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return null;
  }

  const isAnyActionLoading = chooseActionMutation.isPending || 
                            advanceTimeMutation.isPending || 
                            chooseEventMutation.isPending;

  // Extract ambition profile from game state (if available)
  const ambitionProfile = (gameState.world as any).ambitionProfile || {
    power: 0.25,
    wealth: 0.15,
    faith: 0.15,
    virtue: 0.25,
    freedom: 0.10,
    creation: 0.10
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Left Column - Requirements List */}
      <div className="lg:col-span-3">
        <div className="card">
          <RequirementList 
            nodes={gameState.graph?.nodes || []}
            newlyAddedNodeIds={newlyAddedNodeIds}
            onNodeClick={(nodeId) => {
              // Remove from newly added when clicked
              setNewlyAddedNodeIds(prev => prev.filter(id => id !== nodeId));
            }}
          />
        </div>
      </div>

      {/* Center Column - Event Feed */}
      <div className="lg:col-span-6">
        <EventFeed 
          events={gameState.lastEvents}
          onChooseEvent={handleChooseEvent}
          playerResources={gameState.world.resources}
          isLoading={isAnyActionLoading}
        />
      </div>

      {/* Right Column - Resources, Legitimacy, and Ambition */}
      <div className="lg:col-span-3 space-y-6">
        <ResourcePanel 
          resources={gameState.world.resources}
          people={gameState.world.people}
          forces={gameState.world.forces}
          tick={gameState.world.tick}
        />
        
        <LegitimacyPanel 
          legitimacy={gameState.world.legitimacy}
        />

        {/* Ambition Wheel */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ambition Profile</h3>
          <div className="flex justify-center">
            <AmbitionWheel 
              traits={ambitionProfile}
              deltas={ambitionDeltas}
              size={180}
            />
          </div>
        </div>
      </div>

      {/* Full Width - World Panel (Actions, Territories, Factions) */}
      <div className="lg:col-span-12">
        <WorldPanel 
          world={gameState.world}
          proposals={gameState.pendingActions}
          onChooseAction={handleChooseAction}
          onAdvanceTick={handleAdvanceTick}
          isLoading={isAnyActionLoading}
        />
      </div>

      {/* Game Controls */}
      <div className="lg:col-span-12">
        <div className="card bg-secondary-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-secondary-600">
              <p>
                <strong>Game ID:</strong> {playerId}
              </p>
              <p className="mt-1">
                Share this ID to resume your game later, or bookmark this page.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <a 
                href="/"
                className="btn btn-secondary"
              >
                Home
              </a>
              <a 
                href="/new"
                className="btn btn-primary"
              >
                New Game
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="lg:col-span-12">
          <details className="card bg-yellow-50 border-yellow-200">
            <summary className="cursor-pointer font-medium text-yellow-800 mb-2">
              🐛 Debug Info
            </summary>
            <div className="text-xs">
              <p><strong>Seed:</strong> {gameState.world.seed}</p>
              <p><strong>Traits:</strong> {gameState.world.traits.join(', ') || 'None'}</p>
              <p><strong>Pending Actions:</strong> {gameState.pendingActions.length}</p>
              <p><strong>Last Events:</strong> {gameState.lastEvents.length}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}