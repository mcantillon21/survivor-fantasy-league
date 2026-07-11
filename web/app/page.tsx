import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-9xl md:text-[10rem] font-survivor font-black text-orange-500 mb-8 tracking-tighter uppercase leading-none">
          SURVIVOR
        </h1>
        <p className="text-xl text-gray-400 mb-12 uppercase tracking-[0.2em] font-medium">
          Fantasy League
        </p>
        <p className="text-gray-400 mb-16 max-w-lg mx-auto text-base leading-relaxed">
          AI-hosted game. Compete in challenges, form alliances, vote players out. Claude AI refs the entire thing.
        </p>
        <div className="space-y-4 max-w-md mx-auto">
          <Link
            href="/challenge"
            className="block bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-8 rounded-lg transition-all uppercase tracking-wide active:scale-[0.96]"
          >
            Enter Challenge Arena
          </Link>
          <Link
            href="/standings"
            className="block bg-transparent hover:bg-white/5 border border-orange-500/50 text-orange-400 font-bold py-4 px-8 rounded-lg transition-all uppercase tracking-wide active:scale-[0.96]"
          >
            View Standings
          </Link>
        </div>
        <p className="text-gray-600 text-sm mt-16 tracking-wide">
          Register via Discord • /register to join
        </p>
      </div>
    </div>
  );
}
