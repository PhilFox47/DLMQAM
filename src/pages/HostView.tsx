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

    socket.on("board_show_question", (data) => {
      setGameState(s => ({ ...s, boardOpen: true }));
    });

    socket.on("board_answer", (data) => {
      setGameState(s => ({ 
        ...s, 
        boardRevealed: data.revealed, 
        boardCurrentTile: null, 
        boardOpen: false, 
        boardRiskActive: false,
        riskBets: {}
      }));
    });

    socket.on("bets_confirmed", () => {
      setGameState(s => ({ ...s, betsConfirmed: true }));
    });

    socket.on("standings", ({ leaderboard }) => {
      setGameState(s => ({ ...s, showStandings: true, standingsLeaderboard: leaderboard }));
      setTimeout(() => setGameState(s => ({ ...s, showStandings: false })), 5000);
    });

    socket.on("game_over", ({ leaderboard }) => {
      setGameState(s => ({ ...s, showGameOver: true, gameOverLeaderboard: leaderboard }));
    });

    socket.on("final_round_started", ({ finalists }) => {
      setGameState(s => ({ ...s, finalRoundActive: true, finalistIds: finalists.map((f: any) => f.id) }));
    });

    socket.on("final_stage_info", ({ type }) => {
      setGameState(s => ({ ...s, finalRoundCurrentStage: type }));
    });

    socket.on("final_round_end", ({ finalStats }) => {
      setGameState(s => ({ ...s, finalRoundActive: false, showFinalStats: true, finalStats }));
    });

    socket.on("final_question", ({ question, answer }) => {
      setGameState(s => ({ ...s, finalQuestion: question, finalAnswer: answer }));
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
    let basePoints = 100;
    let isDouble = false;
    if (gameState.boardCurrentTile && gameState.board) {
      const [cIdx, tIdx] = gameState.boardCurrentTile;
      const tile = gameState.board.categories?.[cIdx]?.tiles?.[tIdx];
      if (tile) {
        basePoints = tile.value || 100;
        isDouble = !!tile.double;
      }
    }
    const pts = basePoints * (gameState.doublePointsActive ? 2 : 1) * (isDouble ? 2 : 1);

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
                    {gameState.boardRiskActive && gameState.riskBets?.[record.pid] !== undefined && (
                      <span className="ml-2 text-red-600 font-bold tracking-tight block">WAGER: {gameState.riskBets[record.pid]}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {gameState.boardRiskActive && gameState.riskBets?.[record.pid] !== undefined ? (
                    <>
                      <button onClick={() => handleScore(record.pid, gameState.riskBets[record.pid])} className="px-4 py-2 bg-emerald-400 border-2 border-black text-black hover:bg-emerald-300 font-black tracking-widest uppercase">+{gameState.riskBets[record.pid]}</button>
                      <button onClick={() => handleScore(record.pid, -gameState.riskBets[record.pid])} className="px-4 py-2 bg-red-400 border-2 border-black text-black hover:bg-red-300 font-black tracking-widest uppercase">-{gameState.riskBets[record.pid]}</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleScore(record.pid, pts)} className="px-4 py-2 bg-emerald-400 border-2 border-black text-black hover:bg-emerald-300 font-black tracking-widest uppercase">+{pts}</button>
                      <button onClick={() => handleScore(record.pid, -pts)} className="px-4 py-2 bg-red-400 border-2 border-black text-black hover:bg-red-300 font-black tracking-widest uppercase">-{pts}</button>
                    </>
                  )}
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
            <button 
               onClick={() => { socket.emit("double_points") }}
               className={clsx(
                 "flex items-center justify-center gap-2 py-4 font-black uppercase tracking-widest transition-colors brutal-border shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none",
                 gameState.doublePointsActive ? "bg-purple-400 hover:bg-purple-300 text-black" : "bg-white hover:bg-zinc-100 text-black"
               )}
            >
              2X POINTS
            </button>
            <button 
               onClick={() => { socket.emit("random_player") }}
               className="flex items-center justify-center gap-2 py-4 bg-yellow-400 text-black font-black uppercase tracking-widest brutal-border shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-yellow-300 transition-colors"
            >
              RANDOM
            </button>
            <button 
               onClick={() => { socket.emit("show_standings") }}
               className="flex items-center justify-center gap-2 py-4 bg-blue-400 text-black font-black uppercase tracking-widest brutal-border shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-blue-300 transition-colors"
            >
              STANDINGS
            </button>
            <button 
               onClick={() => { socket.emit("end_game") }}
               className="flex items-center justify-center gap-2 py-4 bg-red-600 text-white font-black uppercase tracking-widest brutal-border shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-red-500 transition-colors"
            >
              END GAME
            </button>
            {gameState.board && gameState.board.finalRound && (
               <button 
                  onClick={() => socket.emit("start_final_round")}
                  className="col-span-2 flex items-center justify-center gap-2 py-4 bg-black text-white font-black uppercase tracking-widest brutal-border shadow-[4px_4px_0_0_#eab308] active:translate-y-1 active:shadow-none hover:bg-zinc-800 transition-colors"
               >
                 <Play size={20} /> START FINAL ROUND
               </button>
            )}
          </div>
          
          <h3 className="text-lg uppercase font-black text-zinc-400 tracking-widest mb-2">Connected Nodes</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-zinc-50">
           {gameState.showStandings && gameState.standingsLeaderboard && (
             <div className="bg-blue-200 brutal-border brutal-shadow-sm p-4 mb-6">
               <h3 className="text-xl font-black uppercase italic mb-2">Current Standings</h3>
               {gameState.standingsLeaderboard.map((entry: any, i: number) => (
                 <div key={entry.player_id} className="flex justify-between font-bold">
                   <span>{i+1}. {entry.player_name}</span>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
           {gameState.showGameOver && gameState.gameOverLeaderboard && (
             <div className="bg-red-200 brutal-border brutal-shadow-sm p-4 mb-6">
               <h3 className="text-2xl font-black uppercase italic mb-2 text-red-600">Game Over</h3>
               {gameState.gameOverLeaderboard.map((entry: any, i: number) => (
                 <div key={entry.player_id} className="flex justify-between font-bold text-xl text-black">
                   <span>{i+1}. {entry.player_name}</span>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
           {Object.values(gameState.players).map((p: any) => (
             <div key={p.id} className="bg-white brutal-border brutal-shadow-sm p-4 flex flex-col mb-6">
               <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-3">
                   <div className={clsx("w-4 h-4 brutal-border", p.status === "online" ? "bg-emerald-400" : "bg-red-500")}></div>
                   <span className="font-black text-xl uppercase tracking-tighter">{p.name}</span>
                 </div>
                 <div className="flex items-center gap-4">
                   <span className="font-black text-2xl tracking-tighter">{gameState.scoreboard[p.id] || 0}</span>
                   <button onClick={() => socket.emit("remove_player", { player_id: p.id })} className="text-red-600 bg-red-100 p-1 hover:bg-red-200 brutal-border"><X size={16}/></button>
                 </div>
               </div>
               <div className="flex justify-end gap-2 mt-2 border-t-4 border-black pt-4">
                  <button onClick={() => handleScore(p.id, gameState.doublePointsActive ? 1000 : 500)} className="flex-1 py-2 text-sm font-black tracking-widest uppercase bg-emerald-400 brutal-border hover:bg-emerald-300 transition-colors active:translate-y-1">+{gameState.doublePointsActive ? 1000 : 500}</button>
                  <button onClick={() => handleScore(p.id, gameState.doublePointsActive ? -1000 : -500)} className="flex-1 py-2 text-sm font-black tracking-widest uppercase bg-red-400 brutal-border hover:bg-red-300 transition-colors active:translate-y-1">{gameState.doublePointsActive ? -1000 : -500}</button>
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
             {gameState.finalRoundActive ? (
                <div className="bg-white brutal-border brutal-shadow p-8 mt-12 mb-6 text-black">
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-6">Final Round Active</h2>
                   
                   <div className="flex gap-4 mb-4">
                     <button onClick={() => socket.emit("next_final_question")} className="bg-blue-400 p-4 brutal-border flex-1 font-black uppercase tracking-widest hover:bg-blue-300">Next Question</button>
                     <button onClick={() => socket.emit("show_final_question")} className="bg-emerald-400 p-4 brutal-border flex-1 font-black uppercase tracking-widest hover:bg-emerald-300">Show Question</button>
                     <button onClick={() => socket.emit("show_final_answer")} className="bg-purple-400 p-4 brutal-border flex-1 font-black uppercase tracking-widest hover:bg-purple-300">Show Answer</button>
                     <button onClick={() => socket.emit("next_final_turn")} className="bg-yellow-400 p-4 brutal-border flex-1 font-black uppercase tracking-widest hover:bg-yellow-300">Next Turn</button>
                   </div>
                   
                   <p className="text-zinc-500 font-bold mb-4">Choose a winner to progress the stage:</p>
                   <div className="flex gap-4">
                     {gameState.finalistIds?.map((pid: string) => (
                        <button key={pid} onClick={() => socket.emit("choose_turnlist_winner", { player_id: pid })} className="bg-zinc-200 p-4 brutal-border flex-1 font-black uppercase tracking-widest hover:bg-zinc-300">
                          {gameState.players[pid]?.name || pid}
                        </button>
                     ))}
                   </div>
                </div>
             ) : (
                <JeopardyBoard gameState={gameState} isHost={true} />
             )}

            {gameState.boardCurrentTile ? (() => {
              const [cIdx, tIdx] = gameState.boardCurrentTile;
              const tile = gameState.board.categories[cIdx]?.tiles?.[tIdx];
              if (!tile) return null;
              
              return (
              <div className="bg-white brutal-border brutal-shadow p-8 mt-12 mb-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter">Mode: {tile.mode || 'buzzer'}</h2>
                  <div className="text-right">
                     <span className="font-black text-xl bg-yellow-400 px-4 py-1 brutal-border block mb-2">{tile.value} POINTS</span>
                     {tile.double && <span className="font-black text-sm bg-purple-400 text-white px-2 py-1 brutal-border uppercase block mb-1">Double Trouble</span>}
                     {tile.risk && <span className="font-black text-sm bg-red-600 text-white px-2 py-1 brutal-border uppercase block">Risk Wager</span>}
                  </div>
                </div>

                <div className="bg-zinc-100 p-6 brutal-border mb-6">
                  <h3 className="text-sm uppercase font-black tracking-widest opacity-50 mb-2">Prompt</h3>
                  <p className="text-2xl font-bold">{tile.question?.content || 'No text content'}</p>
                  {tile.mode === 'choice' && tile.choices && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {tile.choices.map((c: string, i: number) => (
                        <div key={i} className="bg-white p-3 brutal-border font-bold">
                          {["A", "B", "C", "D"][i]}: {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-zinc-100 p-6 brutal-border">
                  <h3 className="text-sm uppercase font-black tracking-widest opacity-50 mb-2 border-b-2 border-zinc-200 pb-2">Admin Answer (Hidden)</h3>
                  {tile.answer?.content && <p className="text-xl font-bold text-emerald-700">{tile.answer.content}</p>}
                  {tile.mode === 'choice' && tile.correctIndex !== undefined && (
                    <p className="text-xl font-bold text-emerald-700">Correct Choice: {["A", "B", "C", "D"][tile.correctIndex]}</p>
                  )}
                  {tile.mode === 'guess' && tile.correctValue !== undefined && (
                    <p className="text-xl font-bold text-emerald-700">Exact Value: {tile.correctValue}</p>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-4 mt-8 border-t-4 border-black pt-8">
                   {!gameState.boardOpen && (
                     <button 
                       disabled={tile.risk && !gameState.betsConfirmed}
                       onClick={() => socket.emit("board_show_question")}
                       className="bg-blue-400 disabled:bg-zinc-300 disabled:text-zinc-500 text-black brutal-border hover:brutal-shadow px-8 py-4 font-black uppercase tracking-widest active:translate-y-1 transition-all shadow-[4px_4px_0_0_#000]"
                     >
                       Reveal Prompt
                     </button>
                   )}
                   {tile.risk && !gameState.boardOpen && !gameState.betsConfirmed && (
                     <button 
                       onClick={() => socket.emit("confirm_bets")}
                       className="bg-red-500 text-white brutal-border hover:brutal-shadow px-8 py-4 font-black uppercase tracking-widest active:translate-y-1 transition-all shadow-[4px_4px_0_0_#000]"
                     >
                       Confirm Wagers
                     </button>
                   )}
                   {gameState.boardOpen && (
                     <button 
                       onClick={() => socket.emit("board_reveal_answer")}
                       className="bg-emerald-400 text-black brutal-border hover:brutal-shadow px-8 py-4 font-black uppercase tracking-widest active:translate-y-1 transition-all shadow-[4px_4px_0_0_#000]"
                     >
                       Reveal Answer & Complete
                     </button>
                   )}
                </div>
              </div>
              );
            })() : (
               <div className="bg-white brutal-border brutal-shadow p-12 text-center text-black flex flex-col items-center justify-center mt-12">
                 <Trello size={80} className="mb-6 opacity-20" />
                 <p className="text-4xl font-black uppercase italic tracking-tighter">Idle State</p>
                 <p className="text-sm font-black uppercase tracking-widest max-w-sm mt-4 opacity-60">Initialize board via editor to begin.</p>
               </div>
            )}
            
            {gameState.boardRiskActive && !gameState.boardOpen && (
              <div className="bg-red-100 brutal-border brutal-shadow p-6 mt-12 mb-6">
                <h3 className="text-sm uppercase font-black text-red-600 mb-6 tracking-widest block border-b-4 border-red-600 pb-2">RISK WAGERS</h3>
                {Object.entries(gameState.riskBets || {}).map(([pid, bet]) => {
                  const p = gameState.players[pid];
                  if (!p) return null;
                  return (
                    <div key={pid} className="flex justify-between items-center text-lg font-bold">
                       <span>{p.name}</span>
                       <span className="text-red-600">{Number(bet)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {renderBuzzList()}
         </div>
      </div>
    </div>
  );
}
