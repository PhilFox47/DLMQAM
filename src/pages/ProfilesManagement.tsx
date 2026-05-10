import React, { useState, useEffect } from "react";

export default function ProfilesManagement() {
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/profiles")
      .then(res => res.json())
      .then(data => setProfiles(data.profiles || []));
  }, []);

  return (
    <div className="min-h-screen bg-yellow-400 p-8 md:p-16 text-black selection:bg-white font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-7xl font-black uppercase italic tracking-tighter mb-12 border-b-8 border-black pb-4">Actor Registry</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {profiles.map(p => (
            <div key={p.name} className="bg-white brutal-border brutal-shadow p-6 flex flex-col hover:-translate-y-2 hover:shadow-[12px_12px_0_0_#000] transition-all">
              <img src={p.avatar || "https://i.pravatar.cc/100"} alt={p.name} className="w-24 h-24 brutal-border mb-6 self-start bg-zinc-200 object-cover" />
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 truncate">{p.name}</h2>
              <div className="space-y-2 border-t-4 border-black pt-4 mt-auto">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Net XP</span>
                  <span className="text-xl font-black">{p.stats?.total_points || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Sessions</span>
                  <span className="text-xl font-black">{p.stats?.games_played || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
