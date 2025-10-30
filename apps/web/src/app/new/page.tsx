'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const EXAMPLE_AMBITIONS = [
  "I want to be a just king who protects his people",
  "I want to be a great warrior feared by my enemies",
  "I want to be a wealthy merchant who controls trade",
  "I want to be a wise scholar who discovers hidden knowledge",
  "I want to be a compassionate ruler loved by all",
  "I want to be a cunning spy master who knows all secrets",
  "I want to be a legendary hero who saves the realm",
  "I want to be a powerful mage who masters the arcane arts",
];

export default function NewGamePage() {
  const [ambition, setAmbition] = useState('');
  const [useCustomSeed, setUseCustomSeed] = useState(false);
  const [seed, setSeed] = useState('');
  const router = useRouter();

  const startGameMutation = useMutation({
    mutationFn: ({ rawAmbition, seed }: { rawAmbition: string; seed?: number }) =>
      api.startGame(rawAmbition, seed),
    onSuccess: (data) => {
      router.push(`/play/${data.world.playerId}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ambition.trim()) return;

    const parsedSeed = useCustomSeed && seed ? parseInt(seed) : undefined;
    startGameMutation.mutate({ 
      rawAmbition: ambition.trim(), 
      seed: parsedSeed 
    });
  };

  const handleExampleClick = (example: string) => {
    setAmbition(example);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          Begin Your Journey
        </h1>
        <p className="text-lg text-secondary-600">
          Describe your ambition in natural language. The Oracle Engine will create your path to greatness.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <label htmlFor="ambition" className="block text-sm font-medium text-secondary-700 mb-2">
            What is your ambition?
          </label>
          <textarea
            id="ambition"
            value={ambition}
            onChange={(e) => setAmbition(e.target.value)}
            placeholder="I want to be..."
            rows={4}
            className="w-full p-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            required
          />
          <p className="mt-2 text-sm text-secondary-500">
            Be specific about your goals, virtues, and the kind of leader you want to be.
          </p>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-secondary-900 mb-4">
            Example Ambitions
          </h3>
          <div className="grid gap-3">
            {EXAMPLE_AMBITIONS.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleExampleClick(example)}
                className="text-left p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <span className="text-secondary-800">"{example}"</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <input
              type="checkbox"
              id="useCustomSeed"
              checked={useCustomSeed}
              onChange={(e) => setUseCustomSeed(e.target.checked)}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="useCustomSeed" className="text-sm font-medium text-secondary-700">
              Use custom seed (for reproducible worlds)
            </label>
          </div>
          
          {useCustomSeed && (
            <div>
              <label htmlFor="seed" className="block text-sm font-medium text-secondary-700 mb-2">
                Seed (number)
              </label>
              <input
                type="number"
                id="seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="12345"
                className="w-full p-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-secondary-500">
                Same seed + ambition = identical world generation
              </p>
            </div>
          )}
        </div>

        {startGameMutation.error && (
          <div className="card bg-red-50 border-red-200">
            <div className="text-red-800">
              <h4 className="font-medium mb-2">Error starting game:</h4>
              <p className="text-sm">
                {startGameMutation.error instanceof Error 
                  ? startGameMutation.error.message 
                  : 'Unknown error occurred'}
              </p>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            type="submit"
            disabled={!ambition.trim() || startGameMutation.isPending}
            className="btn btn-primary text-lg px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {startGameMutation.isPending ? (
              <span className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating your world...</span>
              </span>
            ) : (
              'Start Your Journey'
            )}
          </button>
        </div>
      </form>

      <div className="mt-12 p-6 bg-primary-50 rounded-lg">
        <h3 className="text-lg font-semibold text-primary-900 mb-3">
          How It Works
        </h3>
        <div className="space-y-2 text-sm text-primary-800">
          <p>
            <strong>1. Intent Parsing:</strong> Your ambition is analyzed for archetypes (king, warrior, scholar), 
            virtues (justice, courage), and vices (pride, greed).
          </p>
          <p>
            <strong>2. Graph Generation:</strong> A requirement graph is created showing what you need to achieve 
            your goals, with multiple paths to success.
          </p>
          <p>
            <strong>3. World Building:</strong> A living world is generated with regions, factions, resources, 
            and political dynamics based on your ambition.
          </p>
          <p>
            <strong>4. Action Planning:</strong> The Oracle Engine proposes specific actions you can take, 
            considering costs, risks, and utility.
          </p>
        </div>
      </div>
    </div>
  );
}