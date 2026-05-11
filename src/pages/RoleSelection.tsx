import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Key, Play, Shield, Settings2 } from "lucide-react";

export default function RoleSelection() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [showHostLogin, setShowHostLogin] = useState(false);
  const [hostName, setHostName] = useState("");
  const [hostPassword, setHostPassword] = useState("");

  const filteredProfiles = profiles.filter(p => p.name.toLowerCase().startsWith(playerName.toLowerCase()));

  useEffect(() => {
    fetch("/api/profiles").then(r => r.json()).then(data => {
      setProfiles(data.profiles || []);
    }).catch(e => console.error(e));
  }, []);

  const handlePlayerJoin = () => {
    let name = playerName.trim();
    if (!name) return alert("Please enter a name or select a profile.");
    navigate(`/player?name=${encodeURIComponent(name)}`);
  };

  const handleHostJoin = () => {
    if (!hostName.trim()) return alert("Please enter host name.");
    navigate(`/host?name=${encodeURIComponent(hostName.trim())}&password=${encodeURIComponent(hostPassword)}`);
  };

  return (
    <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center p-4 selection:bg-white relative">
      
      {/* Hidden Host Toggle */}
      <button 
        onClick={() => setShowHostLogin(!showHostLogin)}
        className="absolute bottom-4 right-4 text-black/30 hover:text-black/80 transition-colors p-2"
        title="Host Access"
      >
        <Settings2 size={24} />
      </button>

      <div className="w-full max-w-5xl bg-white brutal-border brutal-shadow flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side Branding */}
        <div className="w-full md:w-1/2 p-12 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col justify-center bg-black text-white relative overflow-hidden">
          <p className="text-xs font-black uppercase tracking-widest border-b-2 border-white pb-2 inline-block self-start mb-6">DLMQAM</p>
          <h1 className="text-7xl font-black leading-[0.85] tracking-tighter italic uppercase relative z-10">Join<br/>The<br/>Game</h1>
        </div>

        {/* Right Side Forms */}
        <div className="w-full md:w-1/2 p-8 md:p-12 bg-zinc-50 flex flex-col justify-center space-y-12">
          
          {showHostLogin ? (
            /* Host Login */
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Shield className="w-8 h-8" />
                <h2 className="text-2xl font-black uppercase italic">Host Access</h2>
              </div>
              <div className="space-y-3">
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
                <button 
                  onClick={() => setShowHostLogin(false)}
                  className="w-full bg-white text-black px-6 py-3 font-black text-xs uppercase tracking-widest hover:bg-zinc-100 brutal-border transition-colors active:translate-y-1"
                >
                  Back to Player Login
                </button>
              </div>
            </div>
          ) : (
            /* Player Login */
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <User className="w-8 h-8" />
                <h2 className="text-2xl font-black uppercase italic">Player Login</h2>
              </div>
              
              <p className="text-sm font-bold text-zinc-600 mb-4">
                Select your existing profile below, or enter a new name and click "Join" to create one.
              </p>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    placeholder="PLAYER TAG"
                    className="w-full bg-white brutal-border text-black rounded-none px-4 py-3 font-bold uppercase tracking-widest placeholder-zinc-400 focus:outline-none focus:bg-yellow-100 transition-colors"
                    value={playerName}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    onChange={e => {
                      setPlayerName(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePlayerJoin();
                    }}
                  />
                  
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 max-h-48 overflow-y-auto bg-white brutal-border brutal-shadow z-50 mt-1">
                      {filteredProfiles.map(p => (
                        <div 
                          key={p.name} 
                          className="px-4 py-2 hover:bg-yellow-100 cursor-pointer font-bold uppercase tracking-widest flex items-center gap-3"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPlayerName(p.name);
                            setIsDropdownOpen(false);
                          }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-6 h-6 rounded-full border border-black" />
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-black bg-zinc-200 flex items-center justify-center text-xs font-black">?</div>
                          )}
                          {p.name}
                        </div>
                      ))}
                      {filteredProfiles.length === 0 && (
                        <div className="px-4 py-2 text-zinc-400 font-bold uppercase tracking-widest">No matching profiles</div>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => handlePlayerJoin()}
                  className="w-full bg-black text-white px-6 py-4 font-black flex items-center justify-center gap-2 text-lg uppercase tracking-widest hover:bg-zinc-800 brutal-border transition-colors active:translate-y-1 mt-4"
                >
                  <Play size={24} /> Join
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
