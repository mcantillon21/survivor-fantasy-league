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
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-7xl font-survivor font-black text-orange-500 mb-16 text-center tracking-tighter uppercase">
          Standings
        </h1>

        <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-bold text-white mb-8 uppercase tracking-wider">
            In the Game ({alive.length})
          </h2>
          {alive.length === 0 ? (
            <p className="text-gray-500 text-sm">No players registered yet.</p>
          ) : (
            <div className="space-y-2">
              {alive.map((player) => (
                <div
                  key={player.id}
                  className="bg-black border border-orange-500/30 rounded-lg px-6 py-4 flex items-center justify-between"
                >
                  <span className="text-white font-medium">
                    {player.username}
                  </span>
                  <div className="flex gap-3">
                    {player.has_immunity && (
                      <span className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                        Immunity
                      </span>
                    )}
                    {player.tribe && (
                      <span className="text-gray-500 text-xs uppercase tracking-wider">
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
          <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-gray-500 mb-8 uppercase tracking-wider">
              Eliminated ({eliminated.length})
            </h2>
            <div className="space-y-2">
              {eliminated.map((player) => (
                <div
                  key={player.id}
                  className="bg-black border border-orange-500/20 rounded-lg px-6 py-4 opacity-40"
                >
                  <span className="text-gray-600 line-through">
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
