import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { User, Key, Play, Shield } from "lucide-react";

export default function RoleSelection() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostPassword, setHostPassword] = useState("");

  useEffect(() => {
    fetch("/api/profiles").then(r => r.json()).then(data => {
      setProfiles(data.profiles || []);
    }).catch(e => console.error(e));
  }, []);

  const handlePlayerJoin = (asGuest = false) => {
    let name = playerName.trim();
    if (asGuest && !name) {
      name = "Gast_" + Math.floor(Date.now() / 1000);
    }
    if (!name) return alert("Please enter a name or select a profile.");
    navigate(`/player?name=${encodeURIComponent(name)}&guest=${asGuest ? 1 : 0}`);
  };

  const handleHostJoin = () => {
    if (!hostName.trim()) return alert("Please enter host name.");
    navigate(`/host?name=${encodeURIComponent(hostName.trim())}&password=${encodeURIComponent(hostPassword)}`);
  };

  return (
    <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center p-4 selection:bg-white">
      <div className="w-full max-w-5xl bg-white brutal-border brutal-shadow flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side Branding */}
        <div className="w-full md:w-1/2 p-12 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col justify-center bg-black text-white">
          <p className="text-xs font-black uppercase tracking-widest border-b-2 border-white pb-2 inline-block self-start mb-6">DLMQAM</p>
          <h1 className="text-7xl font-black leading-[0.85] tracking-tighter italic uppercase">Join<br/>The<br/>Game</h1>
        </div>

        {/* Right Side Forms */}
        <div className="w-full md:w-1/2 p-8 md:p-12 bg-zinc-50 flex flex-col justify-center space-y-12">
          
          {/* Player Login */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-black italic opacity-20">01</span>
              <h2 className="text-2xl font-black uppercase italic">Player Config</h2>
            </div>
            <div className="space-y-3 pl-12">
               <input
                list="profileNames"
                placeholder="PLAYER TAG"
                className="w-full bg-white brutal-border text-black rounded-none px-4 py-3 font-bold uppercase tracking-widest placeholder-zinc-400 focus:outline-none focus:bg-yellow-100 transition-colors"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
              />
              <datalist id="profileNames">
                {profiles.map(p => <option key={p.name} value={p.name} />)}
              </datalist>
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePlayerJoin(false)}
                  className="flex-1 bg-black text-white px-6 py-3 font-black text-xs uppercase tracking-widest hover:bg-zinc-800 brutal-border transition-colors active:translate-y-1"
                >
                  Join
                </button>
                <button 
                  onClick={() => handlePlayerJoin(true)}
                  className="flex-1 bg-white text-black px-6 py-3 font-black text-xs uppercase tracking-widest hover:bg-yellow-400 brutal-border transition-colors active:translate-y-1"
                >
                  Guest
                </button>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="h-1 bg-black w-full opacity-10"></div>

          {/* Host Login */}
          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-black italic opacity-20">02</span>
              <h2 className="text-2xl font-black uppercase italic">Host Access</h2>
            </div>
            <div className="space-y-3 pl-12">
              <input
                placeholder="HOST KEY"
                className="w-full bg-white brutal-border text-black rounded-none px-4 py-3 font-bold uppercase tracking-widest placeholder-zinc-400 focus:outline-none focus:bg-yellow-100 transition-colors"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
              />
              <input
                type="password"
                placeholder="ROOT PASSWORD"
                className="w-full bg-white brutal-border text-black rounded-none px-4 py-3 font-bold uppercase tracking-widest placeholder-zinc-400 focus:outline-none focus:bg-yellow-100 transition-colors"
                value={hostPassword}
                onChange={e => setHostPassword(e.target.value)}
              />
              <button 
                onClick={handleHostJoin}
                className="w-full bg-emerald-400 text-black px-6 py-3 font-black text-xs uppercase tracking-widest hover:bg-emerald-300 brutal-border transition-colors active:translate-y-1"
              >
                Authenticate
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
