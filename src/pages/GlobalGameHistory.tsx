import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";

export default function GlobalGameHistory({ onClose }: { onClose: () => void }) {
  const [games, setGames] = useState<any[]>([]);

  const fetchGames = () => {
    fetch("/api/games")
      .then(res => res.json())
      .then(data => setGames(data || []));
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to completely delete this game from the global history AND remove the stats from all participants' profiles?")) {
      fetch("/api/games/" + id, { method: "DELETE" })
        .then(() => fetchGames());
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen bg-blue-400 p-8 md:p-16 text-black selection:bg-white font-sans relative z-50 overflow-y-auto w-full h-full">
      <div className="max-w-6xl mx-auto pb-12">
        <div className="flex justify-between items-end mb-12 border-b-8 border-black pb-4">
          <div>
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter drop-shadow-[5px_5px_0_rgba(255,255,255,1)]">
              GLOBAL HISTORY
            </h1>
            <p className="font-bold text-xl md:text-2xl mt-4 w-fit bg-black text-white px-3 py-1 -skew-x-6">
              ALL PLAYED GAMES
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-red-400 brutal-border hover:bg-red-500 active:translate-y-1 transition-all group"
          >
            <X size={32} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {games.length === 0 ? (
          <div className="text-center bg-white brutal-border brutal-shadow p-12">
            <h2 className="text-3xl font-black uppercase">No games played yet.</h2>
          </div>
        ) : (
          <div className="space-y-6">
            {games.map(game => (
              <div key={game.id} className="bg-white brutal-border brutal-shadow p-6 flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-black">{new Date(game.date).toLocaleString()}</h3>
                    <p className="text-zinc-500 font-bold tracking-widest text-sm uppercase mt-1">
                      {game.leaderboard.length} Participants
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(game.id)}
                    className="bg-red-400 text-white p-2 brutal-border hover:bg-red-500 active:translate-y-1 transition-all flex gap-2 items-center text-sm font-black uppercase tracking-widest"
                  >
                    <Trash2 size={16} /> Delete Game
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-black uppercase tracking-widest text-sm mb-2 border-b-2 border-black pb-1">Leaderboard</h4>
                    <div className="space-y-1">
                      {game.leaderboard.map((player: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="font-bold">{idx + 1}. {player.player_name}</span>
                          <span className="font-black">{player.score} PTS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black uppercase tracking-widest text-sm mb-2 border-b-2 border-black pb-1">Categories Played</h4>
                    <div className="flex flex-wrap gap-2">
                       {game.categories?.map((cat: string, idx: number) => (
                         <span key={idx} className="bg-zinc-200 px-2 py-1 text-xs font-bold uppercase tracking-wider brutal-border">
                           {cat}
                         </span>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
