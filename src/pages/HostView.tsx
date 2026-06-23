import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { socket } from "../lib/socket";
import { Users, Trello, Lock, Unlock, Play, Settings2, SkipForward, X, RefreshCw } from "lucide-react";
import clsx from "clsx";

import JeopardyBoard from "./JeopardyBoard";
import ProfilesManagement from "./ProfilesManagement";
import GlobalGameHistory from "./GlobalGameHistory";

export default function HostView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get("name") || "Host";
  const password = params.get("password") || "";

  const [gameState, setGameState] = useState<any>(null);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showingCorrectAnswer, setShowingCorrectAnswer] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<Record<string, any>>({});
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [lastUndo, setLastUndo] = useState<{ player_name: string, points: number } | null>(null);
  const [teams, setTeams] = useState<Record<string, any>>({});
  const [teamsMode, setTeamsMode] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [showTeams, setShowTeams] = useState(false);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [gameRoles, setGameRoles] = useState<Record<string, string[]>>({});
  const [showScrews, setShowScrews] = useState(false);
  const [screwNotification, setScrewNotification] = useState<string | null>(null);
  const [screwTypes, setScrewTypes] = useState<any[]>([]);
  const [renames, setRenames] = useState<Record<string, string>>({});

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
    fetch("/api/screw-types").then(r => r.json()).then(data => setScrewTypes(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    socket.connect();
    socket.emit("register", { role: "host", name, password });

    socket.on("game_state", (state) => {
      setGameState(state);
      if (state.renames) setRenames(state.renames);
    });

    socket.on("screw_applied", (data: any) => {
      const typeLabels: Record<string, string> = { forced_buzz: 'Forced Buzz', eula_trap: 'EULA Trap', flip: 'Flip', rename: 'Rename' };
      const label = typeLabels[data.type] || data.type;
      const msg = data.targetName
        ? `${data.sourceName} → ${label} → ${data.targetName}${data.data ? ` ("${data.data}")` : ''}`
        : `${data.sourceName} deployed ${label}`;
      setScrewNotification(msg);
      setTimeout(() => setScrewNotification(null), 5000);
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
              category: s.board.categories[cIdx].name,
              winners: data.winners,
              buzzRecords: s.buzzRecords,
              mode: tile.mode
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
    });

    socket.on("board_answer_update", (data) => {
      setLastAnswer((prev: any) => {
         if (!prev) return prev;
         return {
            ...prev,
            winners: data.winners,
            buzzRecords: data.buzzRecords
         };
      });
    });

    socket.on("board_close_question", () => {
      setGameState(s => ({ ...s, boardCurrentTile: null, boardOpen: false }));
      setShowingCorrectAnswer(false);
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

    socket.on("undo_applied", ({ player_name, points }) => {
      setLastUndo({ player_name, points });
      setTimeout(() => setLastUndo(null), 3000);
    });
    socket.on("teams_update", ({ teamsMode: tm, teams: t }) => {
      setTeamsMode(tm);
      setTeams(t);
    });

    socket.on("game_over", ({ leaderboard, season, gameRoles: roles }) => {
      setGameState(s => ({ ...s, showGameOver: true, isGameOver: true, gameOverLeaderboard: leaderboard }));
      if (season) setSeasonData(season);
      if (roles) setGameRoles(roles || {});
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
         if (!s) return s;
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
      socket.off("player_removed");
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
      {showHistory && <GlobalGameHistory onClose={() => setShowHistory(false)} />}
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
              onClick={() => socket.emit("undo_score")}
              className="flex items-center justify-center gap-1 py-2 text-xs bg-orange-300 text-black font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-orange-200 transition-colors"
            >
              ↩ UNDO
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
              onClick={() => setShowTeams(!showTeams)}
              className={clsx(
                "flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none transition-colors",
                teamsMode ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-zinc-600 text-white hover:bg-zinc-500"
              )}
            >
              TEAMS {teamsMode && "✓"}
            </button>
            <button
              onClick={() => setShowScrews(!showScrews)}
              className={clsx(
                "flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none transition-colors",
                showScrews ? "bg-red-400 text-black hover:bg-red-300" : "bg-zinc-600 text-white hover:bg-zinc-500"
              )}
            >
              🔩 SCREWS
            </button>
            <button
               onClick={() => { socket.emit("end_game") }}
               className={clsx(
                 "flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:opacity-90 transition-colors",
                 gameState.isGameOver ? "bg-emerald-400 text-black" : "bg-red-400 text-black"
               )}
            >
              {gameState.isGameOver ? "RESUME" : "END GAME"}
            </button>
            <button 
               onClick={() => { setShowHistory(true) }}
               className="flex items-center justify-center gap-1 py-2 text-xs bg-orange-400 text-black font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-orange-300 transition-colors"
            >
              HISTORY
            </button>
            <button 
               onClick={() => {
                 window.location.href = "/";
               }}
               className="col-span-2 flex items-center justify-center gap-1 py-2 text-xs bg-red-200 text-red-900 font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#000] active:translate-y-px active:shadow-none hover:bg-red-300 transition-colors"
            >
              QUIT TO LOGIN
            </button>
          </div>
          
          {lastUndo && (
            <div className="text-xs font-bold text-orange-300 text-center mt-2">
              ↩ Undid {lastUndo.points > 0 ? '+' : ''}{lastUndo.points} for {lastUndo.player_name}
            </div>
          )}

          {gameState.board && gameState.board.finalRound && (
             <div className="mb-4">
               <button
                  onClick={() => socket.emit("start_final_round")}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs bg-black text-white font-black uppercase tracking-widest brutal-border shadow-[2px_2px_0_0_#eab308] active:translate-y-px active:shadow-none hover:bg-zinc-800 transition-colors"
               >
                 <Play size={14} /> START FINAL ROUND
               </button>
             </div>
          )}

          {showTeams && (
            <div className="mb-4 p-3 bg-zinc-800 border-2 border-zinc-600">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Team Mode</span>
                <button
                  onClick={() => socket.emit("toggle_teams_mode")}
                  className={clsx("text-xs px-2 py-1 font-black uppercase brutal-border", teamsMode ? "bg-emerald-400 text-black" : "bg-zinc-600 text-white")}
                >
                  {teamsMode ? "ON" : "OFF"}
                </button>
              </div>
              {teamsMode && (
                <>
                  <div className="flex gap-2 mb-3">
                    <input
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      placeholder="Team name..."
                      className="flex-1 text-xs bg-zinc-700 text-white px-2 py-1 border border-zinc-500 font-bold"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTeamName.trim()) {
                          socket.emit("create_team", { name: newTeamName.trim(), color: '#facc15' });
                          setNewTeamName("");
                        }
                      }}
                    />
                    <button
                      onClick={() => { if (newTeamName.trim()) { socket.emit("create_team", { name: newTeamName.trim(), color: '#facc15' }); setNewTeamName(""); } }}
                      className="text-xs bg-yellow-400 text-black px-2 py-1 font-black brutal-border hover:bg-yellow-300"
                    >+ Add</button>
                  </div>
                  {Object.values(teams).map((team: any) => (
                    <div key={team.id} className="mb-2 p-2 bg-zinc-700 border border-zinc-500">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-white uppercase">{team.name}</span>
                        <button onClick={() => socket.emit("delete_team", { team_id: team.id })} className="text-[10px] bg-red-500 text-white px-1 font-black brutal-border hover:bg-red-600">✕</button>
                      </div>
                      <select
                        className="w-full text-xs bg-zinc-600 text-white border border-zinc-400 px-1 py-1"
                        defaultValue=""
                        onChange={e => { if (e.target.value) socket.emit("assign_player_team", { player_id: e.target.value, team_id: team.id }); e.target.value = ""; }}
                      >
                        <option value="">+ Add player...</option>
                        {Object.values(gameState.players).filter((p: any) => !Object.values(teams).some((t: any) => t.playerIds.includes(p.id))).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {team.playerIds.map((pid: string) => {
                        const p = gameState.players[pid];
                        if (!p) return null;
                        return (
                          <div key={pid} className="flex justify-between items-center mt-1 text-[10px] text-zinc-300 font-bold">
                            <span>{p.name}</span>
                            <button onClick={() => socket.emit("assign_player_team", { player_id: pid, team_id: null })} className="text-red-400 hover:text-red-300">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {showScrews && (
            <div className="p-4 bg-zinc-800 border-t-4 border-red-400">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-red-400 uppercase tracking-widest">🔩 Screw Assignments</span>
              </div>
              {screwNotification && (
                <div className="mb-3 bg-red-900 text-red-200 text-xs font-bold p-2 border border-red-400">
                  {screwNotification}
                </div>
              )}
              <p className="text-[10px] text-zinc-400 font-bold mb-3">Click + to give a player a screw token. They can use it any time during the game.</p>
              {Object.values(gameState.players || {}).map((p: any) => {
                const tokenCount = gameState.screwTokens?.[p.id] || 0;
                return (
                  <div key={p.id} className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-white font-bold truncate max-w-[120px]">{renames[p.id] || p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-black">{tokenCount > 0 ? `🔩×${tokenCount}` : '—'}</span>
                      <button
                        onClick={() => socket.emit("assign_screw", { player_id: p.id })}
                        className="text-[10px] bg-red-500 text-white px-2 py-1 font-black hover:bg-red-400 brutal-border"
                      >+ Screw</button>
                    </div>
                  </div>
                );
              })}
              {Object.keys(gameState.activeScrews || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-600">
                  <p className="text-[10px] text-zinc-400 font-black uppercase mb-2">Pending Screws</p>
                  {(gameState.activeScrews || []).map((s: any, i: number) => (
                    <div key={i} className="text-[10px] text-orange-300 font-bold mb-1">
                      {screwTypes.find(t => t.id === s.type)?.label || s.type} → {s.targetId ? (renames[s.targetId] || gameState.players[s.targetId]?.name || s.targetId) : 'all'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
               {gameRoles && Object.keys(gameRoles).length > 0 && (
                 <div className="mt-3 pt-3 border-t-2 border-red-300">
                   <h4 className="text-xs font-black uppercase tracking-widest text-red-700 mb-2">Game Awards</h4>
                   {Object.entries(gameRoles).map(([name, roles]) => (
                     <div key={name} className="flex flex-wrap gap-1 mb-1 items-center">
                       <span className="text-xs font-bold text-red-900 min-w-[60px]">{name}:</span>
                       {(roles as string[]).map(r => (
                         <span key={r} className={`text-[10px] font-black uppercase px-1.5 py-0.5 brutal-border ${
                           r === 'mvp' ? 'bg-yellow-400 text-black' :
                           r === 'speed_demon' ? 'bg-blue-400 text-white' :
                           r === 'risk_master' ? 'bg-red-500 text-white' : 'bg-zinc-300 text-black'
                         }`}>
                           {r === 'mvp' ? '👑 MVP' : r === 'speed_demon' ? '⚡ Speed Demon' : r === 'risk_master' ? '🎲 Risk Master' : r}
                         </span>
                       ))}
                     </div>
                   ))}
                 </div>
               )}
               {seasonData && seasonData.leaderboard && seasonData.leaderboard.length > 0 && (
                 <div className="mt-3 pt-3 border-t-2 border-red-300">
                   <h4 className="text-xs font-black uppercase tracking-widest text-red-700 mb-2">Season {seasonData.label} Standings</h4>
                   {seasonData.leaderboard.slice(0, 5).map((entry: any, i: number) => (
                     <div key={entry.name} className="flex justify-between text-xs font-bold items-center mb-1">
                       <div className="flex items-center gap-1">
                         <span className={i === 0 ? "text-yellow-600" : "text-red-800"}>{i+1}.</span>
                         <span className="truncate max-w-[80px]">{entry.name}</span>
                       </div>
                       <div className="text-right">
                         <span className="font-black">{entry.points}</span>
                         <span className="text-red-600 ml-1">({entry.games}G {entry.wins}W)</span>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           )}
           {Object.values(gameState.players).sort((a: any, b: any) => (gameState.scoreboard[b.id] || 0) - (gameState.scoreboard[a.id] || 0)).map((p: any) => (
             <div key={p.id} className="bg-white brutal-border brutal-shadow-sm p-2 flex flex-col">
               <div className="flex justify-between items-center mb-1">
                 <div className="flex items-center gap-2">
                   {allProfiles[p.name]?.avatar ? (
                     <img src={allProfiles[p.name].avatar} alt={p.name} className="w-5 h-5 brutal-border bg-emerald-200 object-cover shrink-0" />
                   ) : (
                     <div className="w-5 h-5 brutal-border bg-zinc-200 flex items-center justify-center text-[10px] font-black uppercase text-black shrink-0">{p.name[0] || '?'}</div>
                   )}
                   <div className={clsx("w-3 h-3 brutal-border shrink-0", p.status === "online" ? "bg-emerald-400" : "bg-red-500")}></div>
                   <span className="font-black text-sm uppercase tracking-tighter truncate max-w-[90px]" title={p.name}>{p.name}</span>
                   {teamsMode && (() => {
                     const team = Object.values(teams).find((t: any) => t.playerIds.includes(p.id)) as any;
                     return team ? <span className="text-[9px] font-black uppercase px-1 bg-yellow-400 border border-black">{team.name}</span> : null;
                   })()}
                 </div>
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => editingScoreId === p.id ? setEditingScoreId(null) : setEditingScoreId(p.id)} 
                     className="text-[10px] font-black uppercase bg-yellow-200 px-1 py-0.5 brutal-border hover:bg-yellow-300"
                   >
                     Edit
                   </button>
                   <span className="font-black text-lg tracking-tighter">{gameState.scoreboard[p.id] || 0}</span>
                   <button onClick={() => socket.emit("remove_player", { player_id: p.id })} className="text-red-600 bg-red-100 p-1 hover:bg-red-200 brutal-border"><X size={12}/></button>
                 </div>
               </div>
               {editingScoreId === p.id && (
                 <div className="flex items-center gap-2 mt-1 border-t-2 border-black pt-2">
                   <input 
                     type="number"
                     placeholder="Points to add/sub (+/-)"
                     className="flex-1 w-full text-xs p-1 brutal-border font-bold text-center bg-zinc-50"
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         const val = parseInt(e.currentTarget.value, 10);
                         if (!isNaN(val)) {
                           handleScore(p.id, val);
                           e.currentTarget.value = "";
                           setEditingScoreId(null);
                         }
                       }
                     }}
                   />
                 </div>
               )}
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
                        <div className="flex gap-2">
                           <button onClick={() => socket.emit("start_countdown", { seconds: 10 })} className="bg-yellow-400 p-4 brutal-border font-black uppercase tracking-widest hover:bg-yellow-300">10s Timer</button>
                           <button onClick={() => socket.emit("start_countdown", { seconds: 5 })} className="bg-yellow-400 p-4 brutal-border font-black uppercase tracking-widest hover:bg-yellow-300">5s Timer</button>
                        </div>
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
                      
                      const hostColorMap: Record<string, string> = {
                        choice: "bg-blue-400",
                        guess: "bg-red-400",
                        text: "bg-emerald-400",
                        buzzer: "bg-yellow-400"
                      };
                      const bgTileColor = hostColorMap[tile.mode || "buzzer"] || "bg-yellow-400";
                      
                      return (
                      <div className={clsx(bgTileColor, "brutal-border brutal-shadow p-6 mt-6")}>
                        <div className="flex justify-between items-start mb-6">
                          <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                             Mode: 
                             <span className="px-3 py-1 text-sm tracking-widest brutal-border bg-white text-black">
                               {tile.mode || 'buzzer'}
                             </span>
                          </h2>
                          <div className="text-right">
                             <span className="font-black text-lg bg-white text-black px-3 py-1 brutal-border block mb-2">{tile.value} POINTS</span>
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
                            <div className="flex flex-col gap-4 w-full">
                              <button 
                                onClick={() => socket.emit("board_next_question")}
                                className="bg-emerald-500 hover:bg-emerald-400 text-black py-4 px-8 font-black uppercase text-xl brutal-border brutal-shadow active:translate-y-1 transition-all w-full flex items-center justify-center gap-2"
                              >
                                NEXT QUESTION
                              </button>
                              {lastAnswer?.mode === 'guess' && lastAnswer?.winners && lastAnswer.winners.length > 0 && (
                                <div className="mt-4 pt-4 border-t-2 border-emerald-300">
                                   <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800 mb-2">Closest Guesses</h4>
                                   <div className="space-y-1">
                                     {lastAnswer.buzzRecords?.filter((r: any) => lastAnswer.winners.includes(r.pid)).map((r: any) => (
                                       <div key={r.pid} className="flex justify-between items-center text-emerald-900 font-bold bg-emerald-200/50 px-3 py-2 brutal-border">
                                         <span>{allProfiles[gameState.players[r.pid]?.name]?.name || gameState.players[r.pid]?.name || "Unknown"}</span>
                                         <span className="font-black text-xl">{r.answer}</span>
                                       </div>
                                     ))}
                                   </div>
                                </div>
                              )}
                              {(lastAnswer?.mode === 'choice' || lastAnswer?.mode === 'text' || lastAnswer?.mode === 'buzzer') && lastAnswer?.winners && lastAnswer.winners.length > 0 && (
                                <div className="mt-4 pt-4 border-t-2 border-emerald-300">
                                   <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800 mb-2">Winners</h4>
                                   <div className="flex flex-wrap gap-2">
                                     {lastAnswer.winners.map((pid: string) => (
                                       <span key={pid} className="px-3 py-1 text-sm font-black uppercase brutal-border bg-emerald-300 text-emerald-900">
                                         {gameState.players[pid]?.name || "Unknown"}
                                       </span>
                                     ))}
                                   </div>
                                </div>
                              )}
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
                                    <div className="flex gap-2 w-full max-w-md">
                                      <button 
                                        onClick={() => socket.emit("start_countdown", { seconds: 10 })}
                                        className="flex-1 bg-yellow-400 text-black brutal-border hover:brutal-shadow-sm px-6 py-3 font-black uppercase tracking-widest active:translate-y-px transition-all shadow-[2px_2px_0_0_#000]"
                                      >
                                        10s
                                      </button>
                                      <button 
                                        onClick={() => socket.emit("start_countdown", { seconds: 5 })}
                                        className="flex-1 bg-yellow-400 text-black brutal-border hover:brutal-shadow-sm px-6 py-3 font-black uppercase tracking-widest active:translate-y-px transition-all shadow-[2px_2px_0_0_#000]"
                                      >
                                        5s
                                      </button>
                                    </div>
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
