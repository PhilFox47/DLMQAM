import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { socket } from "../lib/socket";
import { Users, Trello, Lock, Unlock, Play, Settings2, SkipForward, X, RefreshCw } from "lucide-react";
import clsx from "clsx";

import JeopardyBoard from "./JeopardyBoard";

export default function HostView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get("name") || "Host";
  const password = params.get("password") || "";

  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    socket.connect();
    socket.emit("register", { role: "host", name, password });

    socket.on("game_state", (state) => {
      setGameState(state);
    });

    socket.on("registered", (data) => {
      // successful auth
    });
    
    socket.on("player_joined", ({ player, profile, scoreboard }) => {
      // handled by game_state sync. Wait, actually I should keep syncing full state or apply patches.
      // Usually, in backend I just emitted diffs, but for simplicity I will modify backend to always emit entire state or emit specific patches that I map.
      // Actually, my server.ts emits entire game_state on register, but other things like "scoreboard", "buzz_update" need to be implemented.
    });

    socket.on("buzz_update", ({ records }) => setGameState(s => ({ ...s, buzzRecords: records })));
    socket.on("scoreboard", ({ scoreboard }) => setGameState(s => ({ ...s, scoreboard })));
    socket.on("lock_status", ({ locked }) => setGameState(s => ({ ...s, buzzLocked: locked })));
    socket.on("unbuzz", ({ player_id }) => setGameState(s => ({ ...s, buzzRecords: s.buzzRecords.filter(r => r.pid !== player_id) })));

    socket.on("board_tile_selected", ({ category_index, tile_index, tile }) => {
      setGameState(s => ({ 
        ...s, 
        boardCurrentTile: [category_index, tile_index], 
        questionMode: tile.mode || 'buzzer',
        boardRiskActive: !!tile.risk,
        boardOpen: false,
        buzzRecords: []
      }));
    });

    return () => {
      socket.off("game_state");
      socket.off("registered");
      socket.off("player_joined");
      socket.off("buzz_update");
      socket.off("scoreboard");
      socket.off("lock_status");
      socket.off("unbuzz");
      socket.off("board_tile_selected");
      socket.disconnect();
    };
  }, [name, password]);

  if (!gameState) {
    return <div className="min-h-screen bg-neutral-950 flex items-center text-white justify-center">Authenticating...</div>;
  }

  const handleScore = (pid: string, delta: number) => {
    socket.emit("score", { player_id: pid, points: delta });
  };

  const handleLock = () => socket.emit("lock");
  const handleUnlock = () => socket.emit("unlock");
  const handleRemoveBuzz = (pid: string) => socket.emit("remove_buzz", { player_id: pid });

  const renderBuzzList = () => {
    return (
      <div className="bg-white brutal-border brutal-shadow p-6 mt-12">
        <h3 className="text-sm uppercase font-black text-black mb-6 tracking-widest block border-b-4 border-black pb-2">INPUT SEQUENCE</h3>
        <AnimatePresence>
          {gameState.buzzRecords.map((record: any, idx: number) => {
            const player = gameState.players[record.pid];
            if (!player) return null;
            return (
              <motion.div 
                key={record.pid} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-between p-4 bg-zinc-50 mb-4 border-l-8 border-black border border-y-black border-r-black brutal-shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-black text-xl italic tracking-tighter">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-black uppercase tracking-widest text-lg">{player.name}</span>
                    {record.answer && <span className="ml-2 text-blue-600 font-bold tracking-tight block">RAW_IN: {record.answer}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleScore(record.pid, 100)} className="px-4 py-2 bg-emerald-400 border-2 border-black text-black hover:bg-emerald-300 font-black tracking-widest uppercase">+100</button>
                  <button onClick={() => handleScore(record.pid, -100)} className="px-4 py-2 bg-red-400 border-2 border-black text-black hover:bg-red-300 font-black tracking-widest uppercase">-100</button>
                  <button onClick={() => handleRemoveBuzz(record.pid)} className="p-2 ml-4 text-white bg-black hover:bg-zinc-800 brutal-border transition-colors"><X size={20}/></button>
                </div>
              </motion.div>
            );
          })}
          {gameState.buzzRecords.length === 0 && <p className="text-zinc-500 font-black tracking-tighter italic text-center py-8 text-2xl">AWAITING INPUT...</p>}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-yellow-400 text-black flex flex-col md:flex-row selection:bg-white font-sans">
      <div className="w-full md:w-96 bg-white brutal-border brutal-shadow m-6 md:mr-0 flex flex-col items-stretch">
        <div className="p-8 pb-4 border-b-4 border-black bg-black text-white">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-6 flex items-center gap-3">
            <Settings2 size={32} /> SYS CONTROL
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              onClick={gameState.buzzLocked ? handleUnlock : handleLock}
              className={clsx(
                "flex items-center justify-center gap-2 py-4 font-black uppercase tracking-widest transition-colors brutal-border",
                gameState.buzzLocked 
                  ? "bg-red-500 text-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-red-400" 
                  : "bg-emerald-400 text-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-emerald-300"
              )}
            >
              {gameState.buzzLocked ? <Lock size={20} /> : <Unlock size={20} />}
              {gameState.buzzLocked ? "LOCKED" : "OPEN"}
            </button>
            <button 
               onClick={() => { socket.emit("reset_scores") }}
               className="flex items-center justify-center gap-2 py-4 bg-white text-black font-black uppercase tracking-widest brutal-border shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-zinc-100 transition-colors"
            >
              <RefreshCw size={20} /> RESET
            </button>
          </div>
          
          <h3 className="text-lg uppercase font-black text-zinc-400 tracking-widest mb-2">Connected Nodes</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-zinc-50">
           {Object.values(gameState.players).map((p: any) => (
             <div key={p.id} className="bg-white brutal-border brutal-shadow-sm p-4 flex flex-col mb-6">
               <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-3">
                   <div className={clsx("w-4 h-4 brutal-border", p.status === "online" ? "bg-emerald-400" : "bg-red-500")}></div>
                   <span className="font-black text-xl uppercase tracking-tighter">{p.name}</span>
                 </div>
                 <span className="font-black text-2xl tracking-tighter">{gameState.scoreboard[p.id] || 0}</span>
               </div>
               <div className="flex justify-end gap-2 mt-2 border-t-4 border-black pt-4">
                  <button onClick={() => handleScore(p.id, 500)} className="flex-1 py-2 text-sm font-black tracking-widest uppercase bg-emerald-400 brutal-border hover:bg-emerald-300 transition-colors active:translate-y-1">+500</button>
                  <button onClick={() => handleScore(p.id, -500)} className="flex-1 py-2 text-sm font-black tracking-widest uppercase bg-red-400 brutal-border hover:bg-red-300 transition-colors active:translate-y-1">-500</button>
               </div>
             </div>
           ))}
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col overflow-y-auto max-h-screen">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b-4 border-black">
           <div>
             <span className="text-xs font-black uppercase opacity-60 mb-1 tracking-widest block">Dashboard</span>
             <h1 className="text-5xl font-black uppercase italic tracking-tighter">Activity</h1>
           </div>
           <div>
              <button 
                onClick={() => navigate("/board-editor")}
                className="bg-black text-white brutal-border brutal-shadow hover:bg-zinc-800 px-8 py-4 text-sm font-black uppercase tracking-widest active:translate-y-1 transition-all mt-4 md:mt-0"
              >
                Access Editor →
              </button>
           </div>
         </div>

         <div className="flex-1">
            <JeopardyBoard gameState={gameState} isHost={true} />

            {gameState.questionMode ? (
              <div className="bg-white brutal-border brutal-shadow p-8 mt-12 mb-6">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Mode: {gameState.questionMode}</h2>
                <div className="flex flex-wrap gap-4 mt-8 border-t-4 border-black pt-8">
                   <button 
                     onClick={() => socket.emit("board_show_question")}
                     className="bg-blue-400 text-black brutal-border brutal-shadow-sm hover:brutal-shadow px-8 py-4 font-black uppercase tracking-widest active:translate-y-1 transition-all"
                   >
                     Reveal Prompt
                   </button>
                   <button 
                     onClick={() => socket.emit("board_reveal_answer")}
                     className="bg-emerald-400 text-black brutal-border brutal-shadow-sm hover:brutal-shadow px-8 py-4 font-black uppercase tracking-widest active:translate-y-1 transition-all"
                   >
                     Reveal Answer
                   </button>
                </div>
              </div>
            ) : (
               <div className="bg-white brutal-border brutal-shadow p-12 text-center text-black flex flex-col items-center justify-center mt-12">
                 <Trello size={80} className="mb-6 opacity-20" />
                 <p className="text-4xl font-black uppercase italic tracking-tighter">Idle State</p>
                 <p className="text-sm font-black uppercase tracking-widest max-w-sm mt-4 opacity-60">Initialize board via editor to begin.</p>
               </div>
            )}
            
            {renderBuzzList()}
         </div>
      </div>
    </div>
  );
}
