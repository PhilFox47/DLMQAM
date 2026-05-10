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
    if (gameState.boardRiskActive && !gameState.boardOpen) {
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
    
    switch (gameState.questionMode) {
      case "choice":
        return (
          <div className="grid grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
            {["A", "B", "C", "D"].map(letter => (
              <button
                key={letter}
                disabled={buzzed || gameState.buzzLocked}
                className="bg-black disabled:bg-zinc-200 disabled:border-zinc-300 disabled:text-zinc-400 text-white text-6xl font-black italic py-12 brutal-border brutal-shadow hover:bg-zinc-800 active:translate-y-2 transition-all uppercase"
                onClick={() => handleBuzz(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        );
      case "guess":
      case "text":
        return (
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8">
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
          <div className="flex justify-center mt-12">
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
        {gameState.buzzLocked && <p className="bg-black text-yellow-400 brutal-border px-6 py-2 font-black uppercase tracking-widest mb-8 brutal-shadow-sm">🔒 SYSTEM LOCKED</p>}
        {buzzed && <p className="bg-emerald-400 text-black brutal-border px-6 py-2 font-black uppercase tracking-widest mb-8 brutal-shadow-sm">✓ INPUT REGISTERED</p>}
        
        {gameState.board && !gameState.boardOpen && !gameState.questionMode && (
           <div className="w-full max-w-5xl"><JeopardyBoard gameState={gameState} isHost={false} /></div>
        )}
        
        {renderInputArea()}
      </div>
    </div>
  );
}
