import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-black flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-orange-400 mb-4">
          SURVIVOR
        </h1>
        <p className="text-2xl text-gray-300 mb-8">
          Online Fantasy League
        </p>
        <p className="text-gray-400 mb-12 max-w-md mx-auto">
          AI-hosted Survivor game. Compete in challenges, form alliances, vote players out.
          Claude AI refs the entire game.
        </p>
        <div className="space-y-4">
          <Link
            href="/challenge"
            className="block bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded transition"
          >
            Enter Challenge Arena
          </Link>
          <Link
            href="/standings"
            className="block bg-black/60 hover:bg-black/80 border border-orange-500/30 text-orange-400 font-bold py-3 px-8 rounded transition"
          >
            View Standings
          </Link>
        </div>
        <p className="text-gray-600 text-sm mt-12">
          Register via Discord • /register to join
        </p>
      </div>
    </div>
  );
}
