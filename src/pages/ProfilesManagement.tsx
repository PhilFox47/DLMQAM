import React, { useState, useEffect } from "react";
import ProfileEditor from "../components/ProfileEditor";

export default function ProfilesManagement({ onClose }: { onClose?: () => void }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = () => {
    fetch("/api/profiles")
      .then(res => res.json())
      .then(data => setProfiles(data.profiles || []));
  };

  const handleSaveProfile = (oldName: string, updatedProfile: any) => {
    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: oldName, ...updatedProfile })
    }).then(r => r.json()).then(() => {
      setEditingProfile(null);
      fetchProfiles();
    });
  };

  return (
    <div className="fixed inset-0 min-h-screen bg-yellow-400 p-8 md:p-16 text-black selection:bg-white font-sans relative z-50 overflow-y-auto w-full h-full">
      {editingProfile && (
        <ProfileEditor
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={handleSaveProfile}
        />
      )}
      <div className="max-w-6xl mx-auto pb-12">
        <div className="flex justify-between items-end mb-12 border-b-8 border-black pb-4">
          <h1 className="text-7xl font-black uppercase italic tracking-tighter">Actor Registry</h1>
          {onClose && (
            <button onClick={onClose} className="px-6 py-3 bg-white text-black font-black uppercase tracking-widest brutal-border hover:bg-zinc-100 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none">Close</button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {profiles.map(p => (
            <div key={p.name} className="bg-white brutal-border brutal-shadow p-6 flex flex-col hover:-translate-y-2 hover:shadow-[12px_12px_0_0_#000] transition-all relative">
              <button onClick={() => setEditingProfile(p)} className="absolute top-2 right-2 text-xs font-black uppercase tracking-widest bg-yellow-400 px-2 py-1 brutal-border hover:bg-yellow-300">Edit</button>
              {p.avatar ? (
                <img src={p.avatar} alt={p.name} className="w-24 h-24 brutal-border mb-6 self-start bg-emerald-200 object-cover" />
              ) : (
                <div className="w-24 h-24 brutal-border mb-6 self-start bg-zinc-200 flex items-center justify-center text-4xl font-black text-black">?</div>
              )}
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
