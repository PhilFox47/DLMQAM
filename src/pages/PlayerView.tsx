import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { socket } from "../lib/socket";
import JeopardyBoard from "./JeopardyBoard";
import { Edit2 } from "lucide-react";
import ProfileEditor from "../components/ProfileEditor";

export default function PlayerView() {
  const [params] = useSearchParams();
  const name = params.get("name") || "Player";
  const guest = params.get("guest") === "1";

  const [gameState, setGameState] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<Record<string, any>>({});
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [buzzed, setBuzzed] = useState(false);
  const [answerContent, setAnswerContent] = useState("");
  const [riskBet, setRiskBet] = useState(0);

  const buzzerSoundRef = useRef<HTMLAudioElement | null>(null);

  const playTickSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (gameState?.countdownActive && !buzzed && gameState?.countdownSeconds > 0) {
       playTickSound();
    }
  }, [gameState?.countdownSeconds]);

  const fetchProfiles = () => {
    fetch("/api/profiles")
      .then(r => r.json())
      .then(data => {
        const profiles = data.profiles || [];
        const pMap: Record<string, any> = {};
        profiles.forEach((p: any) => {
          pMap[p.name] = p;
          if (p.name === name) {
            setMyProfile(p);
          }
        });
        setAllProfiles(pMap);
      });
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSaveProfile = (oldName: string, updatedProfile: any) => {
    // If name changed, we may need to reload or change URL. Keep it simple: update then update state
    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: oldName, ...updatedProfile })
    }).then(r => r.json()).then(data => {
      setShowProfileEditor(false);
      if (data.profile) {
        setMyProfile(data.profile);
        // If name changes, we should technically reconnect with new name, but let's just refresh to ensure consistency
        if (data.profile.name !== params.get("name")) {
          window.location.href = `/player?name=${encodeURIComponent(data.profile.name)}`;
        }
      }
    });
  };

  useEffect(() => {
    socket.connect();
    socket.emit("register", { role: "player", name, guest });

    socket.on("game_state", (state) => {
      setGameState(state);
    });

    socket.on("registered", (data) => {
      if (data.profile) setMyProfile(data.profile);
      if (data.profile?.buzzer) {
        buzzerSoundRef.current = new Audio(data.profile.buzzer);
        buzzerSoundRef.current.load();
      }
    });

    socket.on("question", ({ question_type }) => {
      setGameState(s => ({ ...s, questionMode: question_type, buzzLocked: false }));
      setBuzzed(false);
      setAnswerContent("");
    });
    
    socket.on("lock_status", ({ locked }) => {
      setGameState(s => ({ ...s, buzzLocked: locked }));
    });
    
    socket.on("scoreboard", ({ scoreboard }) => {
      setGameState(s => ({ ...s, scoreboard }));
    });

    socket.on("buzz_update", ({ records }) => {
      setGameState(s => ({ ...s, buzzRecords: records }));
      const myRecord = records.find(r => r.pid === socket.id);
      if (myRecord) setBuzzed(true);
    });
    
    socket.on("unbuzz", ({ player_id }) => {
      if (player_id === socket.id) setBuzzed(false);
    });

    socket.on("board", ({ board, revealed, playedValues }) => {
      setGameState(s => ({
        ...s,
        board,
        boardRevealed: revealed,
        boardPlayedValues: playedValues || {},
        boardCurrentTile: null,
        boardOpen: false,
        boardRiskActive: false
      }));
    });

    socket.on("board_selector", ({ player_id }) => {
      setGameState(s => ({ ...s, boardSelector: player_id }));
    });

    socket.on("board_tile_selected", (payload) => {
      setGameState(s => ({ 
        ...s, 
        boardCurrentTile: [payload.category_index, payload.tile_index],
        boardRiskActive: payload.tile?.risk || false,
        questionMode: payload.tile?.mode || 'buzzer'
      }));
      setBuzzed(false);
    });

    socket.on("board_show_question", (data) => {
      setGameState(s => ({ 
        ...s, 
        boardOpen: true, 
        questionMode: data.mode
      }));
    });

    socket.on("board_answer", (data) => {
      setGameState(s => ({ 
        ...s, 
        boardRevealed: data.revealed, 
        boardPlayedValues: data.playedValues || s.boardPlayedValues || {},
        boardCurrentTile: null, 
        boardOpen: false, 
        boardRiskActive: false,
        questionMode: null
      }));
      setBuzzed(false);
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
      setGameState(s => ({ ...s, finalRoundActive: true, isFinalist: finalists.some((f: any) => f.id === socket.id) }));
    });

    socket.on("final_stage_info", ({ type }) => {
      setGameState(s => ({ ...s, finalRoundCurrentStage: type }));
    });

    socket.on("final_quickfire_prepare", () => {
      setGameState(s => ({ ...s, finalPreparing: true }));
    });

    socket.on("final_question_show", ({ question }) => {
      setGameState(s => ({ ...s, finalPreparing: false, finalQuestion: question, questionMode: 'buzzer' }));
      setBuzzed(false);
    });

    socket.on("final_question_answer", ({ answer }) => {
      setGameState(s => ({ ...s, finalAnswer: answer }));
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
      socket.off("question");
      socket.off("lock_status");
      socket.off("scoreboard");
      socket.off("buzz_update");
      socket.off("unbuzz");
      socket.off("board_tile_selected");
      socket.off("countdown_start");
      socket.off("countdown_update");
      socket.off("countdown_end");
      socket.off("countdown_stop");
      socket.disconnect();
    };
  }, [name, guest]);

  if (!gameState) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Connecting to server...</div>;
  }

  const handleBuzz = (choice?: string) => {
    if (buzzed || gameState.buzzLocked || !gameState.questionMode) return;
    
    let answer = answerContent;
    if (choice) answer = choice;
    
    socket.emit("buzz", { answer });
    setBuzzed(true);

    if (buzzerSoundRef.current) {
      buzzerSoundRef.current.currentTime = 0;
      buzzerSoundRef.current.play().catch(() => {});
    }
  };

  const handlePlaceBet = () => {
    socket.emit("place_bet", { bet: riskBet });
  };

  const myScore = gameState.scoreboard?.[socket.id] || 0;
  
  const [showQuestionIntro, setShowQuestionIntro] = useState(false);
  const tCIdx = gameState?.boardCurrentTile?.[0];
  const tTIdx = gameState?.boardCurrentTile?.[1];

  useEffect(() => {
    if (tCIdx !== undefined && tTIdx !== undefined) {
       setShowQuestionIntro(true);
       const timer = setTimeout(() => setShowQuestionIntro(false), 3000);
       return () => clearTimeout(timer);
    } else {
       setShowQuestionIntro(false);
    }
  }, [tCIdx, tTIdx]);
  
  const renderInputArea = () => {
    if (gameState.boardCurrentTile && !gameState.boardOpen) {
      if (gameState.boardRiskActive && !gameState.betsConfirmed) {
        return (
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8">
            <p className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2">Configure Risk Wager</p>
            <input 
              type="number" 
              min="0"
              max={Math.max(myScore, 500)}
              value={riskBet}
              onChange={e => setRiskBet(parseInt(e.target.value) || 0)}
              className="w-full px-6 py-4 bg-yellow-100 brutal-border text-black font-black text-3xl text-center focus:outline-none focus:bg-yellow-200 uppercase tracking-tighter"
              placeholder="AMOUNT"
            />
            <button 
              disabled={gameState.buzzLocked || buzzed}
              onClick={handlePlaceBet}
              className="bg-red-500 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:border-zinc-300 font-black tracking-widest text-2xl py-6 brutal-border brutal-shadow-sm hover:brutal-shadow active:translate-y-1 transition-all text-black uppercase w-full"
            >
              COMMIT
            </button>
          </div>
        );
      }
    }
    
    const currentTile = gameState.boardCurrentTile && gameState.board ? 
      gameState.board.categories[gameState.boardCurrentTile[0]]?.tiles[gameState.boardCurrentTile[1]] : null;
    
    switch (gameState.questionMode) {
      case "choice":
        const letters = ["A", "B", "C", "D"];
        return (
          <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto items-center mt-8">
            {currentTile && currentTile.question && gameState.boardOpen && (
               <div className="bg-white brutal-border brutal-shadow text-black p-6 w-full text-left">
                  <span className="opacity-50 text-xs font-black uppercase tracking-widest block mb-2">Prompt</span>
                  <p className="text-2xl font-black">{currentTile.question.content}</p>
               </div>
            )}
            <div className="grid grid-cols-2 gap-6 w-full">
              {letters.map((letter, idx) => (
                <button
                  key={letter}
                  disabled={buzzed || gameState.buzzLocked}
                  className="bg-black disabled:bg-zinc-200 disabled:border-zinc-300 disabled:text-zinc-400 text-white text-xl sm:text-2xl font-black italic py-8 px-4 brutal-border brutal-shadow hover:bg-zinc-800 active:translate-y-2 transition-all uppercase leading-tight"
                  onClick={() => handleBuzz(letter)}
                >
                  <span className="text-4xl block mb-2">{letter}</span>
                  {currentTile && currentTile.choices && currentTile.choices[idx] && gameState.boardOpen && <span className="opacity-80 block">{currentTile.choices[idx]}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      case "guess":
      case "text":
        return (
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8 mt-8">
            {currentTile && currentTile.question && gameState.boardOpen && (
               <div className="text-left mb-4 border-b-4 border-black pb-4">
                  <p className="text-xl font-black uppercase italic">{currentTile.question.content}</p>
               </div>
            )}
            <p className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2">Input Query Terminal</p>
            <input 
               type={gameState.questionMode === "guess" ? "number" : "text"}
               value={answerContent}
               onChange={e => setAnswerContent(e.target.value)}
               placeholder={gameState.questionMode === "guess" ? "0000" : "QUERY"}
               className="w-full px-6 py-4 bg-yellow-100 brutal-border text-black font-black text-3xl text-center focus:outline-none focus:bg-yellow-200 uppercase tracking-tighter"
            />
            <button 
              disabled={!answerContent.trim() || buzzed || gameState.buzzLocked}
              onClick={() => handleBuzz()}
              className="bg-blue-500 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:border-zinc-300 font-black tracking-widest text-2xl py-6 brutal-border brutal-shadow hover:bg-blue-400 active:translate-y-1 transition-all text-black uppercase w-full"
            >
              SUBMIT
            </button>
          </div>
        );
      case "buzzer":
      default:
        return (
          <div className="flex flex-col justify-center items-center mt-8">
            {currentTile && currentTile.question && (
               <div className="bg-white brutal-border brutal-shadow text-black p-6 w-full max-w-2xl text-left mb-12">
                  <p className="text-2xl font-black uppercase italic">{currentTile.question.content}</p>
               </div>
            )}
            <button 
              disabled={buzzed || gameState.buzzLocked}
              onClick={() => handleBuzz()}
              style={{
                backgroundColor: buzzed || gameState.buzzLocked ? undefined : (myProfile?.color || '#3b82f6')
              }}
              className="w-64 h-64 bg-black disabled:bg-zinc-200 disabled:border-zinc-300 disabled:text-zinc-400 text-white font-black text-6xl italic tracking-tighter brutal-border brutal-shadow hover:scale-105 active:scale-95 active:translate-y-4 transition-transform flex items-center justify-center uppercase"
            >
              BUZZ
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-yellow-400 text-black p-6 font-sans flex flex-col selection:bg-white relative">
      <AnimatePresence>
        {showQuestionIntro && gameState.boardCurrentTile && gameState.board?.categories?.[gameState.boardCurrentTile[0]] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-yellow-400 z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="bg-white brutal-border brutal-shadow p-8 sm:p-12 max-w-3xl w-full relative border-8 border-black">
               {gameState.boardRiskActive && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white font-black px-6 py-2 text-xl uppercase tracking-widest border-b-8 border-l-8 border-black">Risk Wager</div>
               )}
               <h2 className="text-4xl sm:text-6xl font-black uppercase italic tracking-tighter mb-6 break-words">
                  {gameState.board.categories[gameState.boardCurrentTile[0]].name}
               </h2>
               <div className="text-7xl sm:text-[10rem] leading-none font-black mb-10 text-blue-600 drop-shadow-[5px_5px_0_rgba(0,0,0,1)]">
                  {gameState.boardPlayedValues?.[`${gameState.boardCurrentTile[0]}-${gameState.boardCurrentTile[1]}`] || 
                   gameState.board.categories[gameState.boardCurrentTile[0]].tiles[gameState.boardCurrentTile[1]].value * (gameState.doublePointsActive ? 2 : 1)
                  } <span className="text-4xl sm:text-6xl text-black drop-shadow-none tracking-tight">PTS</span>
               </div>
               <div className="inline-block px-8 py-4 bg-black text-white text-3xl font-black uppercase tracking-widest brutal-border shadow-[6px_6px_0_0_rgba(59,130,246,1)]">
                 {(() => {
                    const mode = gameState.board.categories[gameState.boardCurrentTile[0]].tiles[gameState.boardCurrentTile[1]].mode || "buzzer";
                    const modeMap: Record<string, string> = { buzzer: "Buzzer Question", choice: "Multiple Choice", guess: "Closest Guess", text: "Text Input" };
                    return modeMap[mode] || "Buzzer Question";
                 })()}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showProfileEditor && (
        <ProfileEditor
          profile={myProfile || { name }}
          onClose={() => setShowProfileEditor(false)}
          onSave={handleSaveProfile}
        />
      )}
      <div className="flex items-center justify-between bg-white brutal-border brutal-shadow px-6 py-4 mb-6 relative group cursor-pointer" onClick={() => setShowProfileEditor(true)}>
        <div className="flex items-center gap-6">
          <div className="relative">
            {myProfile?.avatar ? (
              <img src={myProfile.avatar} alt="Avatar" className="w-16 h-16 brutal-border bg-emerald-200 object-cover" />
            ) : (
              <div className="w-16 h-16 brutal-border bg-zinc-200 flex items-center justify-center text-3xl font-black text-black">?</div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Edit2 size={24}/>
            </div>
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">{myProfile?.name || name}</h2>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">CREDITS</p>
          <p className="text-5xl font-black tracking-tighter">{myScore}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row items-start gap-8 w-full">
         <div className="w-full xl:w-64 bg-white brutal-border brutal-shadow p-4 flex flex-col gap-3 shrink-0 order-last xl:order-first">
            <h3 className="text-sm font-black uppercase italic tracking-widest text-zinc-500 border-b-4 border-black pb-2 mb-2">Rankings</h3>
            {Object.values(gameState?.players || {}).sort((a: any, b: any) => (gameState.scoreboard?.[b.id] || 0) - (gameState.scoreboard?.[a.id] || 0)).map((p: any, idx: number) => (
              <div key={p.id} className="flex items-center gap-3">
                 <div className="w-6 h-6 bg-black text-white flex items-center justify-center text-xs font-black italic">{idx + 1}</div>
                 {allProfiles[p.name]?.avatar ? (
                   <img src={allProfiles[p.name].avatar} alt={p.name} className="w-8 h-8 brutal-border bg-emerald-200 object-cover" />
                 ) : (
                   <div className="w-8 h-8 brutal-border bg-zinc-200 flex items-center justify-center text-xs font-black uppercase">{p.name[0] || '?'}</div>
                 )}
                 <span className="font-black uppercase tracking-tighter truncate text-sm">{p.name} {p.id === socket.id && '(You)'}</span>
              </div>
            ))}
         </div>

         <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[50vh]">
           {gameState.countdownActive && (
              <div className="w-full max-w-2xl bg-yellow-400 border-4 border-black border-dashed p-6 mb-8 text-black text-center relative overflow-hidden">
                <span className="relative z-10 text-6xl font-black italic tracking-tighter">{gameState.countdownSeconds}s</span>
              </div>
           )}
           {gameState.showStandings && gameState.standingsLeaderboard && (
             <div className="w-full max-w-2xl bg-blue-200 brutal-border brutal-shadow-sm p-6 mb-8 text-black">
               <h3 className="text-2xl font-black uppercase italic mb-4">Current Standings</h3>
               {gameState.standingsLeaderboard.map((entry: any, i: number) => (
                 <div key={entry.player_id} className="flex justify-between font-bold text-xl">
                   <span>{i+1}. {entry.player_name}</span>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
           {gameState.showGameOver && gameState.gameOverLeaderboard && (
             <div className="w-full max-w-2xl bg-red-200 brutal-border brutal-shadow p-8 mb-8 text-black">
               <h3 className="text-3xl font-black uppercase italic mb-4 text-red-600">Game Over</h3>
               {gameState.gameOverLeaderboard.map((entry: any, i: number) => (
                 <div key={entry.player_id} className="flex justify-between font-bold text-2xl">
                   <span>{i+1}. {entry.player_name}</span>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
        {gameState.buzzLocked && <p className="bg-black text-yellow-400 brutal-border px-6 py-2 font-black uppercase tracking-widest mb-8 brutal-shadow-sm">🔒 SYSTEM LOCKED</p>}
        {buzzed && <p className="bg-emerald-400 text-black brutal-border px-6 py-2 font-black uppercase tracking-widest mb-8 brutal-shadow-sm">✓ INPUT REGISTERED</p>}
        
        {gameState.finalRoundActive ? (
           <div className="w-full max-w-2xl bg-white brutal-border brutal-shadow p-8 mt-8 text-black text-left">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4 text-purple-600">Final Round Active</h2>
              <p className="font-bold text-xl mb-6">Stage: {gameState.finalRoundCurrentStage || 'Preparing...'}</p>
              
              {!gameState.isFinalist && <div className="bg-zinc-200 p-4 font-bold border-l-4 border-black mb-4">You are spectators for this round.</div>}
              {gameState.finalPreparing && <div className="bg-yellow-200 p-4 font-black border-l-4 border-black animate-pulse text-2xl uppercase">GET READY TO BUZZ</div>}
              
              {gameState.finalQuestion && (
                <div className="bg-zinc-100 p-4 brutal-border mt-4">
                   <span className="opacity-50 text-xs font-black uppercase tracking-widest mb-2 block">Prompt</span>
                   <p className="text-2xl font-black">{gameState.finalQuestion.content}</p>
                </div>
              )}
              {gameState.finalAnswer && (
                <div className="bg-emerald-100 p-4 brutal-border mt-4">
                   <span className="opacity-50 text-xs font-black uppercase tracking-widest mb-2 block text-emerald-800">Answer</span>
                   <p className="text-2xl font-black text-emerald-900">{gameState.finalAnswer.content}</p>
                </div>
              )}
           </div>
        ) : gameState.board && !gameState.boardOpen && (
           <div className="w-full max-w-5xl flex flex-col items-center">
             {gameState.boardSelector === socket.id ? (
               <div className="bg-yellow-400 text-black px-6 py-2 mb-4 brutal-border brutal-shadow font-black uppercase text-xl animate-pulse">
                 Your turn to pick a question!
               </div>
             ) : (
               <div className="bg-white text-zinc-500 px-6 py-2 mb-4 brutal-border text-sm font-black uppercase">
                 {gameState.boardSelector ? `${gameState.players[gameState.boardSelector]?.name || 'Someone'} is picking...` : 'Waiting for host to select who picks...'}
               </div>
             )}
             <JeopardyBoard gameState={gameState} isHost={false} />
           </div>
        )}
        
        {(!gameState.finalRoundActive || gameState.isFinalist) && renderInputArea()}
         </div>
      </div>
    </div>
  );
}
