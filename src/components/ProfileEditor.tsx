import React, { useState } from "react";
import { X } from "lucide-react";

interface ProfileEditorProps {
  profile: any;
  onClose: () => void;
  onSave: (oldName: string, updatedProfile: any) => void;
}

export default function ProfileEditor({ profile, onClose, onSave }: ProfileEditorProps) {
  const [name, setName] = useState(profile.name || "");
  const [avatar, setAvatar] = useState(profile.avatar || "");

  const handleSave = () => {
    if (!name.trim()) return alert("Name is required");
    onSave(profile.name, {
      ...profile,
      new_name: name.trim(),
      avatar: avatar.trim()
    });
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
            <label className="block text-sm font-black tracking-widest uppercase mb-1">Avatar URL</label>
            <input
              type="text"
              value={avatar}
              onChange={e => setAvatar(e.target.value)}
              className="w-full bg-zinc-100 brutal-border px-4 py-2 font-bold focus:outline-none focus:bg-yellow-100"
            />
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
