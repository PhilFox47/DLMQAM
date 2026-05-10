import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { socket } from "../lib/socket";
import JeopardyBoard from "./JeopardyBoard";

export default function PlayerView() {
  const [params] = useSearchParams();
  const name = params.get("name") || "Player";
  const guest = params.get("guest") === "1";

  const [gameState, setGameState] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [buzzed, setBuzzed] = useState(false);
  const [answerContent, setAnswerContent] = useState("");
  const [riskBet, setRiskBet] = useState(0);

  const buzzerSoundRef = useRef<HTMLAudioElement | null>(null);

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
        currentQuestion: data.question,
        questionMode: data.mode,
        choices: data.choices
      }));
    });

    socket.on("board_answer", (data) => {
      setGameState(s => ({ 
        ...s, 
        boardRevealed: data.revealed, 
        boardCurrentTile: null, 
        boardOpen: false, 
        boardRiskActive: false,
        currentQuestion: null,
        choices: null,
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

    return () => {
      socket.off("game_state");
      socket.off("registered");
      socket.off("question");
      socket.off("lock_status");
      socket.off("scoreboard");
      socket.off("buzz_update");
      socket.off("unbuzz");
      socket.off("board_tile_selected");
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

  const myScore = gameState.scoreboard[socket.id] || 0;
  
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
      return <div className="text-white text-2xl font-black italic mt-12 bg-black px-6 py-4 brutal-shadow uppercase">Tile selected. Waiting for prompt...</div>;
    }
    
    switch (gameState.questionMode) {
      case "choice":
        const letters = ["A", "B", "C", "D"];
        return (
          <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto items-center mt-8">
            {gameState.currentQuestion && (
               <div className="bg-white brutal-border brutal-shadow text-black p-6 w-full text-left">
                  <span className="opacity-50 text-xs font-black uppercase tracking-widest block mb-2">Prompt</span>
                  <p className="text-2xl font-black">{gameState.currentQuestion.content}</p>
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
                  {gameState.choices && gameState.choices[idx] && <span className="opacity-80 block">{gameState.choices[idx]}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      case "guess":
      case "text":
        return (
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8 mt-8">
            {gameState.currentQuestion && (
               <div className="text-left mb-4 border-b-4 border-black pb-4">
                  <p className="text-xl font-black uppercase italic">{gameState.currentQuestion.content}</p>
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
              EXECUTE
            </button>
          </div>
        );
      case "buzzer":
      default:
        return (
          <div className="flex flex-col justify-center items-center mt-8">
            {gameState.currentQuestion && (
               <div className="bg-white brutal-border brutal-shadow text-black p-6 w-full max-w-2xl text-left mb-12">
                  <p className="text-2xl font-black uppercase italic">{gameState.currentQuestion.content}</p>
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
              HIT
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-yellow-400 text-black p-6 font-sans flex flex-col selection:bg-white">
      <div className="flex items-center justify-between bg-white brutal-border brutal-shadow px-6 py-4 mb-12">
        <div className="flex items-center gap-6">
          <img src={myProfile?.avatar || "https://i.pravatar.cc/100"} alt="Avatar" className="w-16 h-16 brutal-border" />
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">{name}</h2>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">CREDITS</p>
          <p className="text-5xl font-black tracking-tighter">{myScore}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center -mt-12">
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
        ) : gameState.board && !gameState.boardOpen && !gameState.questionMode && (
           <div className="w-full max-w-5xl"><JeopardyBoard gameState={gameState} isHost={false} /></div>
        )}
        
        {(!gameState.finalRoundActive || gameState.isFinalist) && renderInputArea()}
      </div>
    </div>
  );
}
