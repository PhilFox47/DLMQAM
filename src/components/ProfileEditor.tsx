import React, { useState, useRef, useEffect } from "react";
import { X, Upload, ChevronDown, ChevronUp } from "lucide-react";

interface ProfileEditorProps {
  profile: any;
  onClose: () => void;
  onSave: (oldName: string, updatedProfile: any) => void;
  isHost?: boolean;
}

export default function ProfileEditor({ profile, onClose, onSave, isHost = false }: ProfileEditorProps) {
  const [name, setName] = useState(profile.name || "");
  const [avatar, setAvatar] = useState(profile.avatar || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [globalGames, setGlobalGames] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/games").then(res => res.json()).then(data => setGlobalGames(data || []));
  }, []);

  const handleSave = () => {
    if (!name.trim()) return alert("Name is required");
    onSave(profile.name, {
      ...profile,
      new_name: name.trim(),
      avatar: avatar.trim()
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white brutal-border brutal-shadow w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-black hover:text-zinc-600"><X size={24} /></button>
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-6">{profile.name ? "Edit Profile" : "New Profile"}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-black tracking-widest uppercase mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-100 brutal-border px-4 py-2 font-bold focus:outline-none focus:bg-yellow-100"
            />
          </div>
          <div>
            <label className="block text-sm font-black tracking-widest uppercase mb-1">Avatar URL or File</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={avatar}
                onChange={e => setAvatar(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-100 brutal-border px-4 py-2 font-bold focus:outline-none focus:bg-yellow-100"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-black text-white px-4 brutal-border flex items-center justify-center hover:bg-zinc-800"
                title="Upload Image"
              >
                <Upload size={20} />
              </button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            {avatar && <img src={avatar} alt="Preview" className="w-16 h-16 object-cover mt-2 brutal-border" />}
          </div>
          {profile.stats && (
            <div className="pt-4 border-t-4 border-black space-y-2 mt-4">
              <h3 className="font-black uppercase tracking-widest text-sm text-zinc-500 mb-2">Statistics</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold uppercase">Net XP</span>
                <span className="text-lg font-black">{profile.stats.total_points || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold uppercase">Sessions</span>
                <span className="text-lg font-black">{profile.stats.games_played || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold uppercase">Wins</span>
                <span className="text-lg font-black text-yellow-500">{profile.stats.wins || 0}</span>
              </div>
            </div>
          )}
          {profile.stats && profile.history && profile.history.length > 0 && (
            <div className="pt-4 border-t-4 border-black mt-4 max-h-48 overflow-y-auto">
               <h3 className="font-black uppercase tracking-widest text-sm text-zinc-500 mb-2">Game History</h3>
               <div className="space-y-2 relative">
                 {profile.history.map((game: any, idx: number) => {
                   const isExpanded = expandedGameId === game.id;
                   const detailedGame = isExpanded ? globalGames.find(g => g.id === game.id) : null;
                   
                   return (
                     <div key={idx} className="bg-zinc-100 brutal-border text-sm flex flex-col group relative overflow-hidden">
                       <button
                         onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                         className="w-full p-2 text-left hover:bg-zinc-200 transition-colors"
                       >
                         <div className="flex justify-between font-bold items-center">
                           <span>{new Date(game.date).toLocaleDateString()}</span>
                           <div className="flex items-center gap-2">
                             <span>Position: {game.position}/{game.numPlayers}</span>
                             {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                           </div>
                         </div>
                         <div className="flex justify-between items-center text-xs mt-1">
                           <span className="truncate max-w-[200px] text-zinc-600">
                             {game.categories?.join(", ") || "No categories"}
                           </span>
                           <span className="font-black">{game.score} XP</span>
                         </div>
                       </button>

                       {isExpanded && detailedGame && (
                         <div className="p-3 border-t-2 border-black bg-white">
                           <h4 className="font-black uppercase text-xs mb-2">Detailed Leaderboard</h4>
                           <div className="space-y-1 mb-3">
                             {detailedGame.leaderboard.map((player: any, pIdx: number) => (
                               <div key={pIdx} className={clsx("flex justify-between items-center p-1", player.player_name === profile.name && "bg-yellow-200 brutal-border")}>
                                 <span className="font-bold">{pIdx + 1}. {player.player_name}</span>
                                 <span className="font-black">{player.score} PTS</span>
                               </div>
                             ))}
                           </div>
                           <h4 className="font-black uppercase text-xs mb-2">All Categories</h4>
                           <div className="flex flex-wrap gap-1">
                             {detailedGame.categories?.map((cat: string, cIdx: number) => (
                               <span key={cIdx} className="bg-zinc-100 border border-black px-1 py-0.5 text-[10px] font-bold uppercase">{cat}</span>
                             ))}
                           </div>
                         </div>
                       )}

                       {isHost && (
                         <button
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirm("Delete this game from history?")) {
                                const newHistory = [...profile.history];
                                const removed = newHistory.splice(idx, 1)[0];
                                const newStats = { ...profile.stats };
                                newStats.total_points -= removed.score;
                                newStats.games_played = Math.max(0, newStats.games_played - 1);
                                if (removed.position === 1) {
                                  newStats.wins = Math.max(0, (newStats.wins || 0) - 1);
                                }
                                onSave(profile.name, { ...profile, history: newHistory, stats: newStats });
                              }
                            }}
                            className="absolute top-1 right-1 bg-red-400 text-white text-[10px] px-1 font-black brutal-border hover:bg-red-500 opacity-0 group-hover:opacity-100 z-10"
                            title="Delete Game (Host only)"
                         >
                           DEL
                         </button>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
          <button
            onClick={handleSave}
            className="w-full py-3 bg-emerald-400 brutal-border font-black tracking-widest uppercase hover:bg-emerald-300 active:translate-y-1 transition-all mt-4"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
