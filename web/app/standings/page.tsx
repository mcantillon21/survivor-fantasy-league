'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Player {
  id: string;
  discord_id: string;
  username: string;
  tribe: string | null;
  is_eliminated: boolean;
  has_immunity: boolean;
  created_at: string;
}

export default function StandingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch players:', error);
    } else {
      setPlayers(data || []);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-black flex items-center justify-center">
        <p className="text-white text-xl">Loading standings...</p>
      </div>
    );
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const eliminated = players.filter((p) => p.is_eliminated);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-6xl font-survivor font-black text-orange-400 mb-12 text-center tracking-tight">
          🌴 SURVIVOR STANDINGS
        </h1>

        <div className="bg-black/40 backdrop-blur-sm border border-orange-500/20 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6 tracking-wide">
            Still in the game ({alive.length})
          </h2>
          {alive.length === 0 ? (
            <p className="text-gray-400">No players registered yet.</p>
          ) : (
            <div className="space-y-3">
              {alive.map((player) => (
                <div
                  key={player.id}
                  className="bg-black/60 border border-orange-500/30 rounded px-4 py-3 flex items-center justify-between"
                >
                  <span className="text-white font-medium">
                    {player.username}
                  </span>
                  <div className="flex gap-2">
                    {player.has_immunity && (
                      <span className="text-orange-400 text-sm bg-orange-900/30 px-2 py-1 rounded">
                        🛡️ Immunity
                      </span>
                    )}
                    {player.tribe && (
                      <span className="text-gray-300 text-sm bg-gray-800/50 px-2 py-1 rounded">
                        {player.tribe}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {eliminated.length > 0 && (
          <div className="bg-black/40 backdrop-blur-sm border border-orange-500/20 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-400 mb-6 tracking-wide">
              Eliminated ({eliminated.length})
            </h2>
            <div className="space-y-2">
              {eliminated.map((player) => (
                <div
                  key={player.id}
                  className="bg-black/60 border border-gray-700/30 rounded px-4 py-2 flex items-center justify-between opacity-60"
                >
                  <span className="text-gray-400 line-through">
                    {player.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
