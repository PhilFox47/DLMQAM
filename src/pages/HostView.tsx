import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { socket } from "../lib/socket";
import { Users, Trello, Lock, Unlock, Play, Settings2, SkipForward, X, RefreshCw } from "lucide-react";
import clsx from "clsx";

import JeopardyBoard from "./JeopardyBoard";
import ProfilesManagement from "./ProfilesManagement";

export default function HostView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get("name") || "Host";
  const password = params.get("password") || "";

  const [gameState, setGameState] = useState<any>(null);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showingCorrectAnswer, setShowingCorrectAnswer] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<Record<string, any>>({});

  const playBuzzSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };

  const prevBuzzCountRef = useRef(0);

  useEffect(() => {
    if (gameState?.buzzRecords) {
      if (gameState.buzzRecords.length > prevBuzzCountRef.current) {
        playBuzzSound();
      }
      prevBuzzCountRef.current = gameState.buzzRecords.length;
    }
  }, [gameState?.buzzRecords]);

  const fetchProfiles = () => {
    fetch("/api/profiles")
      .then(r => r.json())
      .then(data => {
        const pMap: Record<string, any> = {};
        if (data.profiles) {
          data.profiles.forEach((p: any) => {
            pMap[p.name] = p;
          });
        }
        setAllProfiles(pMap);
      });
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

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
      setGameState(s => ({
        ...s,
        players: { ...s.players, [player.id]: player },
        scoreboard
      }));
      setAllProfiles(prev => ({ ...prev, [player.name]: profile }));
    });

    socket.on("buzz_update", ({ records }) => setGameState(s => ({ ...s, buzzRecords: records })));
    socket.on("scoreboard", ({ scoreboard }) => setGameState(s => ({ ...s, scoreboard })));
    socket.on("lock_status", ({ locked }) => setGameState(s => ({ ...s, buzzLocked: locked })));
    socket.on("unbuzz", ({ player_id }) => setGameState(s => ({ ...s, buzzRecords: s.buzzRecords.filter(r => r.pid !== player_id) })));

    socket.on("board", ({ board, revealed, playedValues }) => {
      setGameState(s => ({
        ...s,
        board,
        boardRevealed: revealed,
        boardPlayedValues: playedValues || {},
        boardCurrentTile: null,
        boardOpen: false,
        boardRiskActive: false,
        betsConfirmed: false,
        riskBets: {}
      }));
    });

    socket.on("board_selector", ({ player_id }) => {
      setGameState(s => ({ ...s, boardSelector: player_id }));
    });

    socket.on("board_tile_selected", ({ category_index, tile_index, tile }) => {
      setGameState(s => ({ 
        ...s, 
        boardCurrentTile: [category_index, tile_index], 
        questionMode: tile.mode || 'buzzer',
        boardRiskActive: !!tile.risk,
        boardOpen: false,
        buzzRecords: [],
        buzzLocked: false,
        betsConfirmed: false,
        riskBets: {}
      }));
    });

    socket.on("board_show_question", (data) => {
      setGameState(s => ({ ...s, boardOpen: true }));
    });

    socket.on("board_answer", (data) => {
      setGameState(s => {
        if (s.boardCurrentTile && s.board) {
          const [cIdx, tIdx] = s.boardCurrentTile;
          const tile = s.board.categories[cIdx]?.tiles[tIdx];
          if (tile) {
            setLastAnswer({
              content: tile.mode === 'choice' && tile.correctIndex !== undefined ? 
                `${["A", "B", "C", "D"][tile.correctIndex]}: ${tile.choices[tile.correctIndex]}` :
                (tile.mode === 'guess' && tile.correctValue !== undefined ? tile.correctValue : (tile.answer?.content || "???")),
              category: s.board.categories[cIdx].name
            });
          }
        }
        return { 
          ...s, 
          boardRevealed: data.revealed, 
          boardPlayedValues: data.playedValues || s.boardPlayedValues || {}
        };
      });
      setShowingCorrectAnswer(true);
      setTimeout(() => {
        setGameState(s => ({ ...s, boardCurrentTile: null, boardOpen: false }));
        setShowingCorrectAnswer(false);
      }, 5000);
    });

    socket.on("bets_confirmed", () => {
      setGameState(s => ({ ...s, betsConfirmed: true }));
    });

    socket.on("bet_update", ({ player_id, bet }) => {
      setGameState(s => ({ ...s, riskBets: { ...(s?.riskBets || {}), [player_id]: bet } }));
    });

    socket.on("standings", ({ leaderboard }) => {
      setGameState(s => ({ ...s, showStandings: true, standingsLeaderboard: leaderboard }));
      setTimeout(() => setGameState(s => ({ ...s, showStandings: false })), 5000);
    });

    socket.on("game_over", ({ leaderboard }) => {
      setGameState(s => ({ ...s, showGameOver: true, isGameOver: true, gameOverLeaderboard: leaderboard }));
    });

    socket.on("resume_game", () => {
      setGameState(s => ({ ...s, showGameOver: false, isGameOver: false }));
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

    socket.on("player_removed", ({ player_id, scoreboard }) => {
      setGameState(s => {
         const newPlayers = { ...s.players };
         delete newPlayers[player_id];
         return { ...s, players: newPlayers, scoreboard };
      });
    });

    socket.on("countdown_start", ({ seconds }) => setGameState(s => ({ ...s, countdownActive: true, countdownSeconds: seconds })));
    socket.on("countdown_update", ({ seconds }) => setGameState(s => ({ ...s, countdownSeconds: seconds })));
    socket.on("countdown_end", () => setGameState(s => ({ ...s, countdownActive: false })));
    socket.on("countdown_stop", () => setGameState(s => ({ ...s, countdownActive: false })));

    return () => {
      socket.off("game_state");
      socket.off("registered");
      socket.off("player_joined");
      socket.off("buzz_update");
      socket.off("scoreboard");
      socket.off("lock_status");
      socket.off("unbuzz");
      socket.off("board_tile_selected");
      socket.off("countdown_start");
      socket.off("countdown_update");
      socket.off("countdown_end");
      socket.off("countdown_stop");
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
      <div className="bg-white brutal-border brutal-shadow p-4 mt-6">
        <h3 className="text-xs uppercase font-black text-black mb-4 tracking-widest block border-b-4 border-black pb-2">INPUT SEQUENCE</h3>
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
                className="flex items-center justify-between p-3 bg-zinc-50 mb-3 border-l-8 border-black border border-y-black border-r-black brutal-shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-black text-sm italic tracking-tighter">
                    {idx + 1}
                  </div>
                  {allProfiles[player.name]?.avatar ? (
                    <img src={allProfiles[player.name].avatar} alt={player.name} className="w-8 h-8 brutal-border bg-emerald-200 object-cover" />
                  ) : (
                    <div className="w-8 h-8 brutal-border bg-zinc-200 flex items-center justify-center text-xs font-black text-black">?</div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase tracking-widest text-sm">{player.name}</span>
                      {idx > 0 && gameState.buzzRecords[0] && (
                        <span className="text-zinc-500 font-bold uppercase text-[10px] py-0.5 px-1.5 bg-zinc-200 border border-zinc-400">
                          +{Math.round(record.time - gameState.buzzRecords[0].time)}ms
                        </span>
                      )}
                    </div>
                    {record.answer && <span className="text-blue-600 font-bold tracking-tight text-xs block mt-0.5">RAW_IN: {record.answer}</span>}
                    {gameState.boardRiskActive && gameState.riskBets?.[record.pid] !== undefined && (
                      <span className="text-red-600 font-bold tracking-tight text-xs block mt-0.5">WAGER: {gameState.riskBets[record.pid]}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {gameState.boardRiskActive && gameState.riskBets?.[record.pid] !== undefined ? (
                    <>
                      <button onClick={() => handleScore(record.pid, gameState.riskBets[record.pid])} className="px-3 py-1 text-xs bg-emerald-400 border-2 border-black text-black hover:bg-emerald-300 font-black tracking-widest uppercase">+{gameState.riskBets[record.pid]}</button>
                      <button onClick={() => handleScore(record.pid, -gameState.riskBets[record.pid])} className="px-3 py-1 text-xs bg-red-400 border-2 border-black text-black hover:bg-red-300 font-black tracking-widest uppercase">-{gameState.riskBets[record.pid]}</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleScore(record.pid, pts)} className="px-3 py-1 text-xs bg-emerald-400 border-2 border-black text-black hover:bg-emerald-300 font-black tracking-widest uppercase">+{pts}</button>
                      <button onClick={() => handleScore(record.pid, -pts)} className="px-3 py-1 text-xs bg-red-400 border-2 border-black text-black hover:bg-red-300 font-black tracking-widest uppercase">-{pts}</button>
                    </>
                  )}
                  <button onClick={() => handleRemoveBuzz(record.pid)} className="p-1 ml-2 text-white bg-black hover:bg-zinc-800 brutal-border transition-colors"><X size={16}/></button>
                </div>
              </motion.div>
            );
          })}
          {gameState.buzzRecords.length === 0 && <p className="text-zinc-500 font-black tracking-tighter italic text-center py-4 text-lg">AWAITING INPUT...</p>}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-yellow-400 text-black flex flex-col md:flex-row selection:bg-white font-sans relative">
      {showProfiles && <ProfilesManagement onClose={() => setShowProfiles(false)} />}
      <div className="w-full md:w-80 bg-white brutal-border brutal-shadow m-4 md:mr-0 flex flex-col items-stretch">
        <div className="p-4 border-b-4 border-black bg-black text-white">
          <h2 className="text-xl font-black italic tracking-tighter uppercase mb-4 flex items-center gap-2">
            <Settings2 size={24} /> SYS CONTROL
          </h2>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button 
              onClick={gameState.buzzLocked ? handleUnlock : handleLock}
              className={clsx(
                "flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-widest transition-colors brutal-border",
                gameState.buzzLocked 
                  ? "bg-red-500 text-black shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-red-400" 
                  : "bg-emerald-400 text-black shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-emerald-300"
              )}
            >
              {gameState.buzzLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {gameState.buzzLocked ? "LOCKED" : "OPEN"}
            </button>
            <button 
               onClick={() => { socket.emit("reset_scores") }}
               className="flex items-center justify-center gap-1 py-2 text-xs bg-white text-black font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-zinc-100 transition-colors"
            >
              <RefreshCw size={14} /> RESET POINTS
            </button>
            <button 
               onClick={() => { socket.emit("double_points") }}
               className={clsx(
                 "flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-widest transition-colors brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none",
                 gameState.doublePointsActive ? "bg-purple-400 hover:bg-purple-300 text-black" : "bg-white hover:bg-zinc-100 text-black"
               )}
            >
              2X POINTS
            </button>
            <button 
               onClick={() => { socket.emit("random_player") }}
               className="flex items-center justify-center gap-1 py-2 text-xs bg-yellow-400 text-black font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-yellow-300 transition-colors"
            >
              RANDOM
            </button>
            <button 
               onClick={() => { socket.emit("show_standings") }}
               className="flex items-center justify-center gap-1 py-2 text-xs bg-blue-400 text-black font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-blue-300 transition-colors"
            >
              STANDINGS
            </button>
            <button 
               onClick={() => { setShowProfiles(true) }}
               className="flex items-center justify-center gap-1 py-2 text-xs bg-purple-400 text-black font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-purple-300 transition-colors"
            >
              PROFILES
            </button>
            <button 
               onClick={() => { socket.emit("end_game") }}
               className={clsx(
                 "flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none transition-colors",
                 gameState.isGameOver 
                   ? "bg-black text-white hover:bg-zinc-800" 
                   : "bg-red-600 text-white hover:bg-red-500"
               )}
            >
              {gameState.isGameOver ? "GAME ENDED" : "END GAME"}
            </button>
            {gameState.board && gameState.board.finalRound && (
               <button 
                  onClick={() => socket.emit("start_final_round")}
                  className="col-span-2 flex items-center justify-center gap-1 py-2 text-xs bg-black text-white font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#eab308] active:translate-y-px active:shadow-none hover:bg-zinc-800 transition-colors"
               >
                 <Play size={14} /> START FINAL ROUND
               </button>
            )}
          </div>
          
          <h3 className="text-xs uppercase font-black text-zinc-400 tracking-widest mb-1">Connected Nodes</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-zinc-50 space-y-3">
           {gameState.showStandings && gameState.standingsLeaderboard && !gameState.isGameOver && (
             <div className="bg-blue-200 brutal-border brutal-shadow-sm p-3 mb-2">
               <h3 className="text-sm font-black uppercase italic mb-2">Current Standings</h3>
               {gameState.standingsLeaderboard.map((entry: any, i: number) => (
                 <div key={entry.player_id} className="flex justify-between font-bold text-xs items-center mb-1 last:mb-0">
                   <div className="flex items-center gap-2">
                     <span className={i === 0 ? "text-yellow-600" : i === 1 ? "text-zinc-500" : i === 2 ? "text-amber-700" : "text-black"}>{i+1}.</span>
                     {allProfiles[entry.player_name]?.avatar ? (
                       <img src={allProfiles[entry.player_name].avatar} alt={entry.player_name} className="w-4 h-4 brutal-border bg-emerald-200 object-cover shrink-0" />
                     ) : (
                       <div className="w-4 h-4 brutal-border bg-zinc-200 flex items-center justify-center text-[8px] font-black uppercase text-black shrink-0">{entry.player_name[0] || '?'}</div>
                     )}
                     <span className="truncate max-w-[80px]" title={entry.player_name}>{entry.player_name}</span>
                   </div>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
           {gameState.isGameOver && (
             <div className="bg-red-200 brutal-border brutal-shadow-sm p-4 mb-2">
               <h3 className="text-xl font-black uppercase italic mb-3 text-red-600 text-center">Game Over</h3>
               {Object.keys(gameState?.players || {}).map(pid => ({
                  player_id: pid,
                  player_name: gameState.players[pid].name,
                  score: gameState.scoreboard[pid] || 0
               })).sort((a,b) => b.score - a.score).map((entry: any, i: number) => (
                 <div key={entry.player_id} className={`flex justify-between font-bold items-center mb-2 last:mb-0 ${i === 0 ? "text-lg text-yellow-600 border-2 border-yellow-600 p-2 bg-yellow-100 italic" : "text-sm text-black"}`}>
                   <div className="flex items-center gap-2">
                     <span className={i === 0 ? "text-yellow-600" : i === 1 ? "text-zinc-500" : i === 2 ? "text-amber-700" : "text-black"}>{i+1}.</span>
                     {allProfiles[entry.player_name]?.avatar ? (
                       <img src={allProfiles[entry.player_name].avatar} alt={entry.player_name} className={`${i === 0 ? "w-8 h-8" : "w-5 h-5"} brutal-border bg-emerald-200 object-cover shrink-0`} />
                     ) : (
                       <div className={`${i === 0 ? "w-8 h-8 text-xs" : "w-5 h-5 text-[10px]"} brutal-border bg-zinc-200 flex items-center justify-center font-black uppercase text-black shrink-0`}>{entry.player_name[0] || '?'}</div>
                     )}
                     <span className="truncate max-w-[100px]" title={entry.player_name}>{entry.player_name}</span>
                   </div>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
           {Object.values(gameState.players).map((p: any) => (
             <div key={p.id} className="bg-white brutal-border brutal-shadow-sm p-2 flex flex-col">
               <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2">
                   {allProfiles[p.name]?.avatar ? (
                     <img src={allProfiles[p.name].avatar} alt={p.name} className="w-5 h-5 brutal-border bg-emerald-200 object-cover shrink-0" />
                   ) : (
                     <div className="w-5 h-5 brutal-border bg-zinc-200 flex items-center justify-center text-[10px] font-black uppercase text-black shrink-0">{p.name[0] || '?'}</div>
                   )}
                   <div className={clsx("w-3 h-3 brutal-border shrink-0", p.status === "online" ? "bg-emerald-400" : "bg-red-500")}></div>
                   <span className="font-black text-sm uppercase tracking-tighter truncate max-w-[90px]" title={p.name}>{p.name}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-black text-lg tracking-tighter">{gameState.scoreboard[p.id] || 0}</span>
                   <button onClick={() => socket.emit("remove_player", { player_id: p.id })} className="text-red-600 bg-red-100 p-1 hover:bg-red-200 brutal-border"><X size={12}/></button>
                 </div>
               </div>
               <div className="flex flex-col gap-1 mt-1 border-t-2 border-black pt-2">
                 <div className="flex w-full gap-1">
                   {[100, 200, 300, 400, 500].map(val => (
                     <button key={`plus-${val}`} onClick={() => handleScore(p.id, gameState.doublePointsActive ? val * 2 : val)} className="flex-1 py-1 px-0.5 text-[10px] sm:text-xs font-black tracking-tighter uppercase bg-emerald-400 brutal-border hover:bg-emerald-300 transition-colors active:translate-y-px">
                       +{gameState.doublePointsActive ? val * 2 : val}
                     </button>
                   ))}
                 </div>
                 <div className="flex w-full gap-1">
                   {[100, 200, 300, 400, 500].map(val => (
                     <button key={`minus-${val}`} onClick={() => handleScore(p.id, gameState.doublePointsActive ? -val * 2 : -val)} className="flex-1 py-1 px-0.5 text-[10px] sm:text-xs font-black tracking-tighter uppercase bg-red-400 brutal-border hover:bg-red-300 transition-colors active:translate-y-px">
                       {gameState.doublePointsActive ? -val * 2 : -val}
                     </button>
                   ))}
                 </div>
               </div>
             </div>
           ))}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto max-h-screen">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 pb-4 border-b-4 border-black">
           <div>
             <span className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest block">Dashboard</span>
             <h1 className="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter">Activity</h1>
           </div>
           <div>
              <button 
                onClick={() => navigate("/board-editor")}
                className="bg-black text-white brutal-border brutal-shadow hover:bg-zinc-800 px-6 py-3 text-xs font-black uppercase tracking-widest active:translate-y-1 transition-all mt-4 md:mt-0"
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
                   
                   <div className="flex gap-4 mb-4">
                     {gameState.countdownActive ? (
                        <div className="flex items-center gap-4 border-2 border-black p-2 bg-yellow-300 w-fit">
                           <span className="font-black text-xl">{gameState.countdownSeconds}s</span>
                           <button onClick={() => socket.emit("stop_countdown")} className="px-4 py-1 bg-red-400 text-white font-black brutal-border hover:bg-black transition-colors">Stop</button>
                        </div>
                     ) : (
                        <button onClick={() => socket.emit("start_countdown", { seconds: 10 })} className="bg-yellow-400 p-4 brutal-border font-black uppercase tracking-widest hover:bg-yellow-300">Start 10s Timer</button>
                     )}
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
                <div className="flex flex-col xl:flex-row gap-6 w-full items-start">
                  {!gameState.boardCurrentTile && (
                     <div className="flex flex-col gap-6 w-full xl:w-1/2">
                       <div className="bg-white brutal-border brutal-shadow p-6 flex flex-col md:flex-row items-center gap-4 justify-between -mb-4 relative z-10 mx-6">
                         <span className="font-black uppercase tracking-widest text-zinc-500">Board Navigator</span>
                         <select
                           value={gameState.boardSelector || ""}
                           onChange={(e) => socket.emit("board_set_selector", { player_id: e.target.value })}
                           className="bg-yellow-100 border-2 border-black px-4 py-2 font-black uppercase"
                         >
                           <option value="">-- Host Control --</option>
                           {Object.values(gameState.players).map((p: any) => (
                             <option key={p.id} value={p.id}>{p.name}</option>
                           ))}
                         </select>
                       </div>
                       <JeopardyBoard gameState={gameState} isHost={true} />
                     </div>
                  )}

                  {lastAnswer && !gameState.boardCurrentTile && !gameState.finalRoundActive && (
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2 brutal-border brutal-shadow-sm flex items-center gap-3 z-40">
                       <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Last Answer</span>
                       <span className="font-bold text-sm truncate max-w-[300px]">{lastAnswer.category}: {lastAnswer.content}</span>
                    </div>
                  )}

                  <div className={clsx("flex flex-col gap-6", gameState.boardCurrentTile ? "w-full" : "w-full xl:w-1/2")}>
                    {gameState.boardCurrentTile ? (() => {
                      const [cIdx, tIdx] = gameState.boardCurrentTile;
                      const tile = gameState.board.categories[cIdx]?.tiles?.[tIdx];
                      if (!tile) return null;
                      
                      return (
                      <div className="bg-white brutal-border brutal-shadow p-6 mt-6">
                        <div className="flex justify-between items-start mb-6">
                          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Mode: {tile.mode || 'buzzer'}</h2>
                          <div className="text-right">
                             <span className="font-black text-lg bg-yellow-400 px-3 py-1 brutal-border block mb-2">{tile.value} POINTS</span>
                             {tile.double && <span className="font-black text-xs bg-purple-400 text-white px-2 py-1 brutal-border uppercase block mb-1">Double Trouble</span>}
                             {tile.risk && <span className="font-black text-xs bg-red-600 text-white px-2 py-1 brutal-border uppercase block">Risk Wager</span>}
                          </div>
                        </div>

                        <div className="bg-zinc-100 p-4 brutal-border mb-4">
                          <h3 className="text-xs uppercase font-black tracking-widest opacity-50 mb-2">Prompt</h3>
                          <p className="text-xl font-bold">{tile.question?.content || 'No text content'}</p>
                          {tile.question?.src && (
                             <img src={tile.question.src} alt="Question graphic" className="mt-4 max-h-64 object-contain mx-auto" />
                          )}
                          {tile.mode === 'choice' && tile.choices && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              {tile.choices.map((c: string, i: number) => (
                                <div key={i} className="bg-white p-2 brutal-border font-bold text-sm">
                                  {["A", "B", "C", "D"][i]}: {c}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-zinc-100 p-4 brutal-border">
                          <h3 className="text-xs uppercase font-black tracking-widest opacity-50 mb-2 border-b-2 border-zinc-200 pb-2">Admin Answer (Hidden)</h3>
                          {tile.answer?.content && <p className="text-lg font-bold text-emerald-700">{tile.answer.content}</p>}
                          {tile.answer?.src && (
                             <img src={tile.answer.src} alt="Answer graphic" className="mt-4 max-h-48 object-contain" />
                          )}
                          {tile.mode === 'choice' && tile.correctIndex !== undefined && (
                            <p className="text-lg font-bold text-emerald-700">Correct Choice: {["A", "B", "C", "D"][tile.correctIndex]}</p>
                          )}
                          {tile.mode === 'guess' && tile.correctValue !== undefined && (
                            <p className="text-lg font-bold text-emerald-700">Exact Value: {tile.correctValue}</p>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 mt-6 border-t-4 border-black pt-6">
                          {showingCorrectAnswer ? (
                            <div className="flex items-center gap-4 bg-emerald-100 p-3 brutal-border w-full justify-center">
                               <RefreshCw className="animate-spin text-emerald-600" size={24} />
                               <span className="font-black uppercase tracking-widest text-emerald-800 italic">NEXT ROUND TRANSITION... (5s)</span>
                            </div>
                          ) : (
                            <>
                              {!gameState.boardOpen && (
                                <button 
                                  disabled={tile.risk && !gameState.betsConfirmed}
                                  onClick={() => socket.emit("board_show_question")}
                                  className="bg-blue-400 disabled:bg-zinc-300 disabled:text-zinc-500 text-black brutal-border hover:brutal-shadow-sm px-6 py-3 font-black uppercase tracking-widest active:translate-y-px transition-all shadow-[2px_2px_0_0_#000]"
                                >
                                  Reveal Prompt
                                </button>
                              )}
                              {tile.risk && !gameState.boardOpen && !gameState.betsConfirmed && (
                                <button 
                                  onClick={() => socket.emit("confirm_bets")}
                                  className="bg-red-500 text-white brutal-border hover:brutal-shadow-sm px-6 py-3 font-black uppercase tracking-widest active:translate-y-px transition-all shadow-[2px_2px_0_0_#000]"
                                >
                                  Confirm Wagers
                                </button>
                              )}
                              {gameState.boardOpen && (
                                <>
                                  <button 
                                    onClick={() => socket.emit("board_reveal_answer")}
                                    className="bg-emerald-400 text-black brutal-border hover:brutal-shadow-sm px-6 py-3 font-black uppercase tracking-widest active:translate-y-px transition-all shadow-[2px_2px_0_0_#000]"
                                  >
                                    Reveal Answer & Complete
                                  </button>
                                  
                                  {gameState.countdownActive ? (
                                    <div className="flex items-center gap-4 border-2 border-black p-2 bg-yellow-300 w-fit">
                                       <span className="font-black text-xl">{gameState.countdownSeconds}s</span>
                                       <button onClick={() => socket.emit("stop_countdown")} className="px-4 py-1 bg-red-400 text-white font-black brutal-border hover:bg-black transition-colors">Stop</button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => socket.emit("start_countdown", { seconds: 10 })}
                                      className="bg-yellow-400 text-black brutal-border hover:brutal-shadow-sm px-6 py-3 font-black uppercase tracking-widest active:translate-y-px transition-all shadow-[2px_2px_0_0_#000]"
                                    >
                                      10s Timer
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      );
                    })() : (
                       <div className="bg-white brutal-border brutal-shadow p-8 text-center text-black flex flex-col items-center justify-center mt-6">
                         <Trello size={60} className="mb-4 opacity-20" />
                         <p className="text-2xl font-black uppercase italic tracking-tighter">Idle State</p>
                         <p className="text-xs font-black uppercase tracking-widest max-w-sm mt-2 opacity-60">Initialize board via editor to begin.</p>
                       </div>
                    )}
                    
                    {gameState.boardRiskActive && !gameState.boardOpen && (
                      <div className="bg-red-100 brutal-border brutal-shadow p-4 mb-4">
                        <h3 className="text-xs uppercase font-black text-red-600 mb-4 tracking-widest block border-b-4 border-red-600 pb-2">RISK WAGERS</h3>
                        {Object.entries(gameState.riskBets || {}).map(([pid, bet]) => {
                          const p = gameState.players[pid];
                          if (!p) return null;
                          return (
                            <div key={pid} className="flex justify-between items-center text-sm font-bold">
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
             )}
         </div>
      </div>
    </div>
  );
}
