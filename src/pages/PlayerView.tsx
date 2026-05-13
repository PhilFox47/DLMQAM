import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { socket } from "../lib/socket";
import JeopardyBoard from "./JeopardyBoard";
import { Edit2, HelpCircle, X, LogOut } from "lucide-react";
import ProfileEditor from "../components/ProfileEditor";

export default function PlayerView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get("name") || "Player";
  const guest = params.get("guest") === "1";

  const [gameState, setGameState] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<Record<string, any>>({});
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showingCorrectAnswer, setShowingCorrectAnswer] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<any>(null);
  const [buzzed, setBuzzed] = useState(false);
  const [answerContent, setAnswerContent] = useState("");
  const [riskBet, setRiskBet] = useState(0);
  const [hasPlacedBet, setHasPlacedBet] = useState(false);

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

  const playHappySound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);     // A4
      osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1); // C#5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);    // A5
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.error(e);
    }
  };

  const playSadSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.error(e);
    }
  };

  const playDoublePointsSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "square";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
      
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {}
  };

  const prevScoreRef = useRef<number | null>(null);
  const prevDoublePointsRef = useRef<boolean>(false);
  const prevGameOverRef = useRef<boolean>(false);

  const playVictorySound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
      osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.45); // C6
      
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.5);
    } catch(e) {}
  };

  useEffect(() => {
    if (gameState?.doublePointsActive && !prevDoublePointsRef.current) {
      playDoublePointsSound();
    }
    if (gameState !== null) {
      prevDoublePointsRef.current = gameState.doublePointsActive;
    }
    
    if (gameState?.isGameOver && !prevGameOverRef.current) {
      // check if I am the winner
      const sorted = Object.keys(gameState?.players || {}).map(pid => ({
        id: pid,
        score: gameState?.scoreboard?.[pid] || 0
      })).sort((a,b) => b.score - a.score);
      if (sorted.length > 0 && sorted[0].id === socket.id) {
        playVictorySound();
      }
    }
    if (gameState !== null) {
      prevGameOverRef.current = gameState.isGameOver;
    }
  }, [gameState?.doublePointsActive, gameState?.isGameOver]);

  useEffect(() => {
    if (!gameState || !socket.id || !gameState.scoreboard) return;
    const currentScore = gameState.scoreboard[socket.id];
    if (currentScore !== undefined && prevScoreRef.current !== null && currentScore !== prevScoreRef.current) {
      if (currentScore > prevScoreRef.current) {
        playHappySound();
      } else if (currentScore < prevScoreRef.current) {
        playSadSound();
      }
    }
    if (currentScore !== undefined) {
      prevScoreRef.current = currentScore;
    }
  }, [gameState?.scoreboard, socket.id]);

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
      const myRecord = state.buzzRecords?.find((r: any) => r.pid === socket.id);
      if (myRecord) {
        setBuzzed(true);
        if (myRecord.answer) {
          setAnswerContent(myRecord.answer);
        }
      } else {
        setBuzzed(false);
        setAnswerContent("");
      }
      if (state.riskBets?.[socket.id] !== undefined) {
        setHasPlacedBet(true);
        setRiskBet(state.riskBets[socket.id]);
      } else {
        setHasPlacedBet(false);
      }
    });

    socket.on("registered", (data) => {
      if (data.profile) setMyProfile({ ...data.profile, name });
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

    socket.on("profiles_updated", (profilesList) => {
      const pMap: Record<string, any> = {};
      profilesList.forEach((p: any) => {
        pMap[p.name] = p;
        if (p.name === name) {
          setMyProfile(p);
        }
      });
      setAllProfiles(pMap);
    });

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

    socket.on("board_tile_selected", (payload) => {
      setGameState(s => ({ 
        ...s, 
        boardCurrentTile: [payload.category_index, payload.tile_index],
        boardRiskActive: payload.tile?.risk || false,
        questionMode: payload.tile?.mode || 'buzzer',
        buzzLocked: false,
        betsConfirmed: false,
        riskBets: {}
      }));
      setBuzzed(false);
      setAnswerContent("");
      setHasPlacedBet(false);
    });

    socket.on("board_show_question", (data) => {
      setGameState(s => ({ 
        ...s, 
        boardOpen: true, 
        questionMode: data.mode
      }));
    });

    socket.on("board_answer", (data) => {
      setGameState(s => {
        if (s.questionMode === "choice" || s.questionMode === "multiple_choice") {
          const myRecord = s.buzzRecords?.find((r: any) => r.pid === socket.id);
          if (myRecord) {
            if (!data.winners.includes(socket.id)) {
              playSadSound();
            }
          }
        }
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
      setGameState(s => ({ ...s, showGameOver: true, isGameOver: true, gameOverLeaderboard: leaderboard }));
    });

    socket.on("resume_game", () => {
      setGameState(s => ({ ...s, showGameOver: false, isGameOver: false }));
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
         if (!s) return s;
         const newPlayers = { ...s.players };
         delete newPlayers[player_id];
         return { ...s, players: newPlayers, scoreboard };
      });
    });

    socket.on("player_joined", ({ player, profile, scoreboard }) => {
      setGameState(s => {
         if (!s) return s;
         const newPlayers = { ...s.players, [player.id]: player };
         return { ...s, players: newPlayers, scoreboard };
      });
    });

    socket.on("countdown_start", ({ seconds }) => setGameState(s => ({ ...s, countdownActive: true, countdownSeconds: seconds })));
    socket.on("countdown_update", ({ seconds }) => setGameState(s => ({ ...s, countdownSeconds: seconds })));
    socket.on("countdown_end", () => {
       setGameState(s => ({ ...s, countdownActive: false }));
       try {
           const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
           if (AudioContextClass) {
              const ctx = new AudioContextClass();
              
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);
              
              gain.gain.setValueAtTime(0.2, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
              
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);
           }
       } catch (e) { console.error("Audio error", e) }
    });
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
      socket.off("player_removed");
      socket.off("player_joined");
      socket.off("countdown_start");
      socket.off("countdown_update");
      socket.off("countdown_end");
      socket.off("countdown_stop");
      socket.disconnect();
    };
  }, [name, guest]);

  const [showQuestionIntro, setShowQuestionIntro] = useState(false);
  const tCIdx = gameState?.boardCurrentTile?.[0];
  const tTIdx = gameState?.boardCurrentTile?.[1];

  useEffect(() => {
    if (tCIdx !== undefined && tTIdx !== undefined) {
       setShowQuestionIntro(true);
       
       const tile = gameState?.board?.categories?.[tCIdx]?.tiles?.[tTIdx];
       if (tile) {
         const mode = tile.mode || "buzzer";
         const isDouble = tile.double || gameState?.doublePointsActive;
         const isRisk = tile.risk || gameState?.boardRiskActive;
         
         try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
               const ctx = new AudioContextClass();
               const playTone = (freq: number, type: OscillatorType, time: number, duration: number, vol = 0.5) => {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = type;
                  osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
                  gain.gain.setValueAtTime(vol, ctx.currentTime + time);
                  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
                  osc.start(ctx.currentTime + time);
                  osc.stop(ctx.currentTime + time + duration);
               };

               if (mode === "buzzer") {
                  playTone(800, 'square', 0, 0.2);
                  playTone(1200, 'square', 0.1, 0.4);
               } else if (mode === "guess") {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(300, ctx.currentTime);
                  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);
                  gain.gain.setValueAtTime(0.5, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.4);
               } else if (mode === "choice") {
                  playTone(523.25, 'triangle', 0, 0.2);
                  playTone(659.25, 'triangle', 0.15, 0.2);
                  playTone(783.99, 'triangle', 0.3, 0.4);
               } else if (mode === "text") {
                  playTone(1000, 'square', 0, 0.1, 0.2);
                  playTone(1200, 'square', 0.1, 0.1, 0.2);
                  playTone(1000, 'square', 0.2, 0.1, 0.2);
                  playTone(1500, 'square', 0.3, 0.2, 0.2);
               }

               let modStart = 0.6;
               if (tile.double) {
                  playTone(1200, 'sine', modStart, 0.3, 0.6);
                  playTone(1600, 'sine', modStart + 0.15, 0.5, 0.6);
               }
               if (isRisk) {
                  playTone(400, 'square', modStart + (tile.double ? 0.3 : 0), 0.2, 0.2);
                  playTone(600, 'square', modStart + 0.15 + (tile.double ? 0.3 : 0), 0.2, 0.2);
                  playTone(800, 'square', modStart + 0.3 + (tile.double ? 0.3 : 0), 0.2, 0.4);
               }
            }
         } catch(e) {
            console.error("Audio block failed", e);
         }
       }

       const timer = setTimeout(() => setShowQuestionIntro(false), 3000);
       return () => clearTimeout(timer);
    } else {
       setShowQuestionIntro(false);
    }
  }, [tCIdx, tTIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (gameState?.questionMode === "buzzer" && !gameState.buzzLocked && !buzzed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (buzzed || gameState.buzzLocked || !gameState.questionMode) return;
          
          let answer = answerContent;
          
          socket.emit("buzz", { answer });
          setBuzzed(true);

          if (buzzerSoundRef.current) {
            buzzerSoundRef.current.currentTime = 0;
            buzzerSoundRef.current.play().catch(() => {});
          } else {
            playTickSound();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState?.questionMode, gameState?.buzzLocked, buzzed, answerContent, buzzerSoundRef]);

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
    } else {
      playTickSound();
    }
  };

  const handlePlaceBet = () => {
    socket.emit("place_bet", { bet: riskBet });
    setHasPlacedBet(true);
  };

  const myScore = gameState.scoreboard?.[socket.id] || 0;

  const renderInputArea = () => {
    if (gameState.boardCurrentTile && !gameState.boardOpen) {
      if (gameState.boardRiskActive && !gameState.betsConfirmed) {
        if (hasPlacedBet) {
          return (
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8 mt-8 text-center">
              <p className="text-xl font-black uppercase italic text-emerald-600">Wager Committed: {riskBet}</p>
              <p className="text-sm font-bold opacity-60">Waiting for Host...</p>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8">
            <p className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2">Configure Risk Wager</p>
            <input 
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={riskBet || ''}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                let parsed = val ? parseInt(val) : 0;
                let maxBet = Math.max(myScore, 500);
                if (parsed > maxBet) parsed = maxBet;
                setRiskBet(parsed);
              }}
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
      
    const renderCorrectAnswerDetails = (tile: any) => {
      if (!showingCorrectAnswer || !tile) return null;
      return (
        <div className="mt-4 pt-4 border-t-4 border-emerald-400 bg-emerald-100 p-4 brutal-border">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-800 mb-2">Correct Answer</h3>
          <p className="text-2xl font-black uppercase italic tracking-tighter text-emerald-900">
            {tile.mode === 'choice' && tile.correctIndex !== undefined ? 
              `${["A", "B", "C", "D"][tile.correctIndex]}: ${tile.choices[tile.correctIndex]}` :
              (tile.mode === 'guess' && tile.correctValue !== undefined ? tile.correctValue : (tile.answer?.content || "???"))
            }
          </p>
          {tile.answer?.src && (
            <img src={tile.answer.src} alt="Correct answer" className="mt-4 max-h-48 brutal-border bg-white p-2 object-contain" />
          )}
          {lastAnswer?.mode === 'guess' && lastAnswer?.winners && lastAnswer.winners.length > 0 && (
            <div className="mt-4 pt-4 border-t-2 border-emerald-300">
               <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800 mb-2">Closest Guesses</h4>
               <div className="space-y-1">
                 {lastAnswer.buzzRecords?.filter((r: any) => lastAnswer.winners.includes(r.pid)).map((r: any) => (
                   <div key={r.pid} className="flex justify-between items-center text-emerald-900 font-bold bg-emerald-200/50 px-3 py-2 brutal-border">
                     <span className="flex items-center gap-2">
                       {r.pid === socket.id && <span className="text-lg">⭐</span>}
                       {gameState.players[r.pid]?.name || "Unknown"}
                     </span>
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
                   <span key={pid} className={`px-3 py-1 text-sm font-black uppercase brutal-border flex items-center gap-1 ${pid === socket.id ? 'bg-yellow-400 text-black' : 'bg-emerald-300 text-emerald-900'}`}>
                     {pid === socket.id && <span>⭐</span>}
                     {gameState.players[pid]?.name || "Unknown"}
                   </span>
                 ))}
               </div>
            </div>
          )}
        </div>
      );
    };
    
    switch (gameState.questionMode) {
      case "choice":
        const letters = ["A", "B", "C", "D"];
        return (
          <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto items-center mt-8">
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
            {currentTile && (currentTile.question || showingCorrectAnswer) && gameState.boardOpen && (
               <div className="bg-white brutal-border brutal-shadow text-black p-6 w-full text-left">
                  <span className="opacity-50 text-xs font-black uppercase tracking-widest block mb-2">Prompt</span>
                  <p className="text-2xl font-black">{currentTile.question?.content || "???"}</p>
                  {currentTile.question?.src && (
                     <img src={currentTile.question.src} alt="Question graphic" className="mt-4 max-h-64 object-contain mx-auto" />
                  )}
                  {renderCorrectAnswerDetails(currentTile)}
               </div>
            )}
          </div>
        );
      case "guess":
      case "text":
        return (
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto bg-white brutal-border brutal-shadow p-8 mt-8">
            <p className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2">Input Query Terminal</p>
            <input 
               type="text"
               inputMode={gameState.questionMode === "guess" ? "decimal" : "text"}
               pattern={gameState.questionMode === "guess" ? "[0-9.,\\-]*" : undefined}
               value={answerContent}
               onChange={e => {
                  let val = e.target.value;
                  if (gameState.questionMode === "guess") {
                     val = val.replace(/[^0-9.,\-]/g, '');
                     val = val.replace(',', '.');
                  }
                  setAnswerContent(val);
               }}
               onKeyDown={e => {
                 if (e.key === 'Enter') {
                   e.preventDefault();
                   if (answerContent.trim() && !buzzed && !gameState.buzzLocked) {
                     handleBuzz();
                   }
                 }
               }}
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
            {currentTile && (currentTile.question || showingCorrectAnswer) && gameState.boardOpen && (
               <div className="text-left mt-4 pt-4 border-t-4 border-black">
                  <p className="text-xl font-black uppercase italic">{currentTile.question?.content || "???"}</p>
                  {currentTile.question?.src && (
                     <img src={currentTile.question.src} alt="Question graphic" className="mt-4 max-h-64 object-contain mx-auto" />
                  )}
                  {renderCorrectAnswerDetails(currentTile)}
               </div>
            )}
          </div>
        );
      case "buzzer":
      default:
        return (
          <div className="flex flex-col flex-col-reverse justify-center items-center mt-8 gap-12">
            {currentTile && (currentTile.question || showingCorrectAnswer) && gameState.boardOpen && (
               <div className="bg-white brutal-border brutal-shadow text-black p-6 w-full max-w-2xl text-left">
                  <p className="text-2xl font-black uppercase italic">{currentTile.question?.content || "???"}</p>
                  {currentTile.question?.src && (
                     <img src={currentTile.question.src} alt="Question graphic" className="mt-4 max-h-64 object-contain mx-auto" />
                  )}
                  {renderCorrectAnswerDetails(currentTile)}
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

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const myBuzzRank = gameState?.buzzRecords?.findIndex((r: any) => r.pid === socket.id);
  const buzzedPositionText = myBuzzRank !== undefined && myBuzzRank >= 0
    ? `✓ INPUT REGISTERED (${getOrdinal(myBuzzRank + 1)})`
    : `✓ INPUT REGISTERED`;

  return (
    <div className="min-h-screen bg-yellow-400 text-black p-6 font-sans flex flex-col selection:bg-white relative">
      <AnimatePresence>
        {showQuestionIntro && gameState.boardCurrentTile && gameState.board?.categories?.[gameState.boardCurrentTile[0]] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className={clsx(
              "fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center",
              (() => {
                 const category = gameState.board.categories[gameState.boardCurrentTile[0]];
                 const tile = category?.tiles?.[gameState.boardCurrentTile[1]];
                 const mode = tile?.mode || "buzzer";
                 const colorMap: Record<string, string> = { choice: "bg-blue-400", guess: "bg-red-400", text: "bg-emerald-400", buzzer: "bg-yellow-400" };
                 return colorMap[mode] || "bg-yellow-400";
              })()
            )}
          >
            <div className="bg-white brutal-border brutal-shadow p-8 sm:p-12 max-w-3xl w-full relative border-8 border-black">
               {gameState.boardRiskActive && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white font-black px-6 py-2 text-xl uppercase tracking-widest border-b-8 border-l-8 border-black">Risk Wager</div>
               )}
               <h2 className="text-4xl sm:text-6xl font-black uppercase italic tracking-tighter mb-6 break-words">
                  {gameState.board.categories[gameState.boardCurrentTile[0]].name}
               </h2>
               {(() => {
                 const mode = gameState.board.categories[gameState.boardCurrentTile[0]].tiles[gameState.boardCurrentTile[1]].mode || "buzzer";
                 const textColorMap: Record<string, string> = {
                    choice: "text-blue-400",
                    guess: "text-red-400",
                    text: "text-emerald-400",
                    buzzer: "text-yellow-400"
                 };
                 return (
                   <div className={`text-7xl sm:text-[10rem] leading-none font-black mb-10 ${textColorMap[mode] || "text-yellow-400"} drop-shadow-[5px_5px_0_rgba(0,0,0,1)]`}>
                      {gameState.boardPlayedValues?.[`${gameState.boardCurrentTile[0]}-${gameState.boardCurrentTile[1]}`] || 
                       gameState.board.categories[gameState.boardCurrentTile[0]].tiles[gameState.boardCurrentTile[1]].value * (gameState.doublePointsActive ? 2 : 1)
                      } <span className="text-4xl sm:text-6xl text-black drop-shadow-none tracking-tight">PTS</span>
                   </div>
                 );
               })()}
               {(() => {
                  const mode = gameState.board.categories[gameState.boardCurrentTile[0]].tiles[gameState.boardCurrentTile[1]].mode || "buzzer";
                  const modeMap: Record<string, string> = { buzzer: "Buzzer Question", choice: "Multiple Choice", guess: "Closest Guess", text: "Text Input" };
                  const colorMap: Record<string, string> = {
                     choice: "bg-blue-400 text-black",
                     guess: "bg-red-400 text-black",
                     text: "bg-emerald-400 text-black",
                     buzzer: "bg-yellow-400 text-black"
                  };
                  return (
                     <div className={`inline-block px-8 py-4 ${colorMap[mode] || colorMap.buzzer} text-3xl font-black uppercase tracking-widest brutal-border shadow-[6px_6px_0_0_#000]`}>
                       {modeMap[mode] || "Buzzer Question"}
                     </div>
                  );
               })()}
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
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-yellow-400 z-50 overflow-y-auto p-4 sm:p-8"
          >
            <div className="bg-white brutal-border brutal-shadow p-6 sm:p-10 max-w-4xl mx-auto border-8 border-black relative mb-12">
              <button 
                onClick={() => setShowHelpModal(false)}
                className="absolute top-4 right-4 bg-red-400 text-white p-2 brutal-border hover:bg-red-500 hover:-translate-y-1 transition-all"
              >
                <X size={24} />
              </button>
              
              <h1 className="text-4xl sm:text-6xl font-black uppercase italic tracking-tighter mb-8 bg-black text-yellow-400 p-4 inline-block transform -rotate-1">
                Tutorial
              </h1>
              
              <div className="space-y-8 text-black">
                <section className="bg-zinc-100 p-6 brutal-border">
                  <h2 className="text-2xl font-black uppercase tracking-widest mb-4 border-b-4 border-black pb-2">Welcome to DLMQAM</h2>
                  <p className="font-bold text-lg leading-relaxed">
                    Das lustige Mittwochsquiz am Mittwoch (The Funny Wednesday Quiz on Wednesday)
                  </p>
                  <p className="text-lg leading-relaxed mt-2">
                    Every Wednesday, the CS DACH Team meets up to conquer one of my quizzes. It's nice to have you on board!
                  </p>
                </section>

                <section>
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4">
                    <span className="bg-black text-white px-4 py-2">4</span>
                    Question Types
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-400 p-6 brutal-border relative group hover:-translate-y-1 transition-transform">
                      <div className="absolute -top-3 -left-3 bg-black text-white text-xs font-black px-2 py-1 uppercase tracking-widest transform -rotate-6">Type 1</div>
                      <h3 className="text-xl font-black uppercase tracking-widest mb-2 mt-2 text-black">Multiple Choice</h3>
                      <p className="font-bold text-slate-900">Easy and Straightforward. I ask a question, you pick one of four answers. Get it right, you get points! Get it wrong, and you'll lose some points instead. If you do not submit an answer, you keep your current score.</p>
                    </div>
                    
                    <div className="bg-red-400 p-6 brutal-border relative group hover:-translate-y-1 transition-transform">
                      <div className="absolute -top-3 -left-3 bg-black text-white text-xs font-black px-2 py-1 uppercase tracking-widest transform -rotate-6">Type 2</div>
                      <h3 className="text-xl font-black uppercase tracking-widest mb-2 mt-2 text-black">Guessing Question</h3>
                      <p className="font-bold text-slate-900">I am looking for a number. Closest player(s) to correct number wins the points! (All others keep their current score) It's risk free!</p>
                    </div>

                    <div className="bg-emerald-400 p-6 brutal-border relative group hover:-translate-y-1 transition-transform">
                      <div className="absolute -top-3 -left-3 bg-black text-white text-xs font-black px-2 py-1 uppercase tracking-widest transform -rotate-6">Type 3</div>
                      <h3 className="text-xl font-black uppercase tracking-widest mb-2 mt-2 text-black">Text Question</h3>
                      <p className="font-bold text-slate-900">I ask you a question and you have to type in your answer yourself. If I deem the answer correct, you get some points. No points lost if you get it wrong!</p>
                    </div>

                    <div className="bg-yellow-400 p-6 brutal-border relative group hover:-translate-y-1 transition-transform">
                      <div className="absolute -top-3 -left-3 bg-black text-white text-xs font-black px-2 py-1 uppercase tracking-widest transform -rotate-6">Type 4</div>
                      <h3 className="text-xl font-black uppercase tracking-widest mb-2 mt-2 text-black">Buzzer Question</h3>
                      <p className="font-bold text-slate-900">Here you have to be fast! Who buzzes first has the right to answer the question. Get it right and you earn some points. Get it wrong and you'll lose those points.</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4">
                    <span className="bg-black text-white px-4 py-2">2</span>
                    Modifiers
                  </h2>
                  <div className="space-y-4">
                    <div className="bg-purple-100 p-6 brutal-border flex flex-col sm:flex-row gap-6 items-start sm:items-center hover:-translate-y-1 transition-transform">
                      <div className="bg-white border-2 border-black p-3 font-black text-xl italic uppercase min-w-[200px] text-center">Double Trouble</div>
                      <p className="font-medium">The Points for this questions are doubled (Double the reward, but also double the risk!)</p>
                    </div>
                    
                    <div className="bg-red-100 p-6 brutal-border flex flex-col sm:flex-row gap-6 items-start sm:items-center hover:-translate-y-1 transition-transform">
                      <div className="bg-white border-2 border-black p-3 font-black text-xl italic uppercase min-w-[200px] text-center">Risk Wager</div>
                      <p className="font-medium">Risk some of your hard earned points. Any amount, it's up to you! Double your Wager if you get the next question right, lose your wager if you get it wrong.</p>
                    </div>
                  </div>
                </section>

                <section className="bg-black text-yellow-500 p-8 brutal-border">
                  <h2 className="text-3xl font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                    <span className="bg-yellow-500 text-black px-4 py-2">!</span>
                    One more thing...
                  </h2>
                  <p className="text-xl font-bold leading-relaxed">
                    At 17:20 all Point amounts will be doubled! So a 500 Point Question is now worth 1000 Points! 
                    If there is a Category you think you might be good at, it could be a good idea to keep those questions for later...
                  </p>
                </section>

                <div className="text-center pt-8">
                  <button 
                    onClick={() => setShowHelpModal(false)}
                    className="bg-blue-400 text-white px-12 py-4 text-2xl font-black uppercase tracking-widest brutal-border brutal-shadow hover:bg-blue-500 hover:-translate-y-1 transition-all"
                  >
                    Got It!
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 items-stretch mb-6">
        <div className="flex-1 flex items-center justify-between bg-white brutal-border brutal-shadow px-6 py-4 relative group cursor-pointer" onClick={() => setShowProfileEditor(true)}>
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
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">POINTS</p>
            <p className="text-5xl font-black tracking-tighter">{myScore}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            window.location.href = "/";
          }}
          className="bg-red-200 text-red-900 brutal-border brutal-shadow w-24 flex flex-col items-center justify-center gap-1 hover:bg-red-300 hover:-translate-y-1 transition-all group"
          title="Return to Login"
        >
          <LogOut size={32} className="group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Quit</span>
        </button>
        <button 
          onClick={() => setShowHelpModal(true)} 
          className="bg-blue-200 text-blue-900 brutal-border brutal-shadow w-24 flex flex-col items-center justify-center gap-1 hover:bg-blue-300 hover:-translate-y-1 transition-all group"
          title="Tutorial & Help"
        >
          <HelpCircle size={32} className="group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Help</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row items-start gap-8 w-full">
         <div className="w-full xl:w-64 bg-white brutal-border brutal-shadow p-4 flex flex-col gap-3 shrink-0 order-last xl:order-first">
            <h3 className="text-sm font-black uppercase italic tracking-widest text-zinc-500 border-b-4 border-black pb-2 mb-2">Rankings</h3>
            {Object.values(gameState?.players || {}).sort((a: any, b: any) => (gameState.scoreboard?.[b.id] || 0) - (gameState.scoreboard?.[a.id] || 0)).map((p: any, idx: number) => (
              <div key={p.id} className="flex items-center gap-3">
                 <div className={`w-8 h-8 flex items-center justify-center text-lg font-black italic ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-zinc-400" : idx === 2 ? "text-amber-700" : "text-black"}`}>{idx + 1}.</div>
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
              <div className="fixed top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-yellow-400 border-4 border-black border-dashed p-4 text-black text-center z-50 brutal-shadow pointer-events-none">
                <span className="text-5xl font-black italic tracking-tighter">{gameState.countdownSeconds}s</span>
              </div>
           )}
           {gameState.showStandings && gameState.standingsLeaderboard && !gameState.isGameOver && (
             <div className="w-full max-w-2xl bg-blue-200 brutal-border brutal-shadow-sm p-6 mb-8 text-black">
               <h3 className="text-2xl font-black uppercase italic mb-4">Current Standings</h3>
               {gameState.standingsLeaderboard.map((entry: any, i: number) => (
                 <div key={entry.player_id} className="flex justify-between font-bold text-xl items-center mb-2 last:mb-0">
                   <div className="flex items-center gap-4">
                     <span className={i === 0 ? "text-yellow-600" : i === 1 ? "text-zinc-500" : i === 2 ? "text-amber-700" : "text-black"}>{i+1}.</span>
                     {allProfiles[entry.player_name]?.avatar ? (
                       <img src={allProfiles[entry.player_name].avatar} alt={entry.player_name} className="w-8 h-8 object-cover brutal-border bg-emerald-200" />
                     ) : (
                       <div className="w-8 h-8 brutal-border bg-zinc-200 flex items-center justify-center text-xs font-black uppercase">{entry.player_name[0] || '?'}</div>
                     )}
                     <span>{entry.player_name}</span>
                   </div>
                   <span>{entry.score}</span>
                 </div>
               ))}
             </div>
           )}
           {gameState.isGameOver && (
             <div className="w-full max-w-4xl bg-red-200 brutal-border brutal-shadow p-8 mb-8 text-black">
               <h3 className="text-5xl font-black uppercase italic mb-8 text-red-600 text-center">Game Over</h3>
               {Object.keys(gameState?.players || {}).map(pid => ({
                  player_id: pid,
                  player_name: gameState.players[pid].name,
                  score: gameState.scoreboard[pid] || 0
               })).sort((a,b) => b.score - a.score).map((entry: any, i: number) => (
                 <div key={entry.player_id} className={`flex justify-between font-bold items-center mb-4 last:mb-0 ${i === 0 ? "text-4xl text-yellow-600 border-4 border-yellow-600 p-4 bg-yellow-100 italic" : "text-2xl"}`}>
                   <div className="flex items-center gap-4">
                     <span className={i === 0 ? "text-yellow-600" : i === 1 ? "text-zinc-500" : i === 2 ? "text-amber-700" : "text-black"}>{i+1}.</span>
                     {allProfiles[entry.player_name]?.avatar ? (
                       <img src={allProfiles[entry.player_name].avatar} alt={entry.player_name} className={`${i === 0 ? "w-16 h-16" : "w-10 h-10"} object-cover brutal-border bg-emerald-200`} />
                     ) : (
                       <div className={`${i === 0 ? "w-16 h-16" : "w-10 h-10"} brutal-border bg-zinc-200 flex items-center justify-center text-sm font-black uppercase text-black`}>{entry.player_name[0] || '?'}</div>
                     )}
                     <span className="text-black">{entry.player_name}</span>
                   </div>
                   <span className="text-black">{entry.score}</span>
                 </div>
               ))}
             </div>
           )}

        {!gameState.isGameOver && (
          <>
        {gameState.buzzLocked && !showingCorrectAnswer && <p className="bg-black text-yellow-400 brutal-border px-6 py-2 font-black uppercase tracking-widest mb-8 brutal-shadow-sm">🔒 SYSTEM LOCKED</p>}
        {buzzed && !showingCorrectAnswer && <p className="bg-emerald-400 text-black brutal-border px-6 py-2 font-black uppercase tracking-widest mb-8 brutal-shadow-sm">{buzzedPositionText}</p>}
        
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
        ) : gameState.board && !gameState.boardOpen && !gameState.boardCurrentTile && (
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
        
        {lastAnswer && !gameState.boardCurrentTile && !gameState.finalRoundActive && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2 brutal-border brutal-shadow-sm flex items-center gap-3 z-40">
             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Last Answer</span>
             <span className="font-bold text-sm truncate max-w-[300px]">{lastAnswer.category}: {lastAnswer.content}</span>
          </div>
        )}

        {(!gameState.finalRoundActive || gameState.isFinalist) && renderInputArea()}
          </>
        )}
         </div>
      </div>
    </div>
  );
}
