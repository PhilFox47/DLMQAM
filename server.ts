import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

async function ensureDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Initialize profiles
    try {
      await fs.access(path.join(DATA_DIR, "profiles.json"));
    } catch {
      await fs.writeFile(path.join(DATA_DIR, "profiles.json"), JSON.stringify({}));
    }
    // Initialize scoreboard
    try {
      await fs.access(path.join(DATA_DIR, "scoreboard.json"));
    } catch {
      await fs.writeFile(path.join(DATA_DIR, "scoreboard.json"), JSON.stringify({}));
    }
    // Initialize games
    try {
      await fs.access(path.join(DATA_DIR, "games.json"));
    } catch {
      await fs.writeFile(path.join(DATA_DIR, "games.json"), JSON.stringify([]));
    }
  } catch (err) {
    console.error("Failed to initialize data files", err);
  }
}

async function startServer() {
  await ensureDataFiles();
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  // API Routes
  app.use(express.json({ limit: "50mb" }));
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/games", async (req, res) => {
    try {
      const data = await fs.readFile(path.join(DATA_DIR, "games.json"), "utf8");
      res.json(JSON.parse(data));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load games" });
    }
  });

  app.delete("/api/games/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = await fs.readFile(path.join(DATA_DIR, "games.json"), "utf8");
      let games = JSON.parse(data);
      const gameIndex = games.findIndex((g: any) => g.id === id);
      if (gameIndex === -1) return res.status(404).json({ error: "Game not found" });
      
      const game = games[gameIndex];
      games.splice(gameIndex, 1);
      await fs.writeFile(path.join(DATA_DIR, "games.json"), JSON.stringify(games, null, 2));

      // Also need to remove stats from profiles
      const profilesData = await fs.readFile(path.join(DATA_DIR, "profiles.json"), "utf8");
      const profiles = JSON.parse(profilesData);
      
      game.leaderboard.forEach(({ player_name, score }: any, index: number) => {
         if (profiles[player_name]) {
            if (profiles[player_name].stats) {
               profiles[player_name].stats.total_points = Math.max(0, profiles[player_name].stats.total_points - score);
               profiles[player_name].stats.games_played = Math.max(0, profiles[player_name].stats.games_played - 1);
               if (index === 0) {
                  profiles[player_name].stats.wins = Math.max(0, (profiles[player_name].stats.wins || 0) - 1);
               }
            }
            if (profiles[player_name].history) {
               profiles[player_name].history = profiles[player_name].history.filter((h: any) => h.id !== id);
            }
         }
      });
      await fs.writeFile(path.join(DATA_DIR, "profiles.json"), JSON.stringify(profiles, null, 2));
      io.emit("profiles_updated", Object.entries(profiles).map(([name, p]) => ({ name, ...(p as any) })));

      res.json({ status: "ok" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete game" });
    }
  });

  app.get("/api/profiles", async (req, res) => {
    try {
      const data = await fs.readFile(path.join(DATA_DIR, "profiles.json"), "utf8");
      const profiles = JSON.parse(data);
      res.json({ profiles: Object.entries(profiles).map(([name, data]) => ({ name, ...data as any })) });
    } catch (e) {
      res.status(500).json({ error: "Failed to load profiles" });
    }
  });

  app.post("/api/profiles", async (req, res) => {
    try {
      const { name, new_name, avatar, buzzer, color, stats, achievements, history } = req.body;
      if (!name) return res.status(400).json({ error: "Name required" });

      const profilesPath = path.join(DATA_DIR, "profiles.json");
      const profilesData = await fs.readFile(profilesPath, "utf8");
      const profiles = JSON.parse(profilesData);

      let targetName = new_name && new_name !== name ? new_name : name;
      
      const profile = profiles[name] || { stats: { total_points: 0, games_played: 0 }, achievements: {} };
      if (avatar !== undefined) profile.avatar = avatar;
      if (buzzer !== undefined) profile.buzzer = buzzer;
      if (color !== undefined) profile.color = color;
      if (stats !== undefined) profile.stats = { ...profile.stats, ...stats };
      if (achievements !== undefined) profile.achievements = { ...profile.achievements, ...achievements };
      if (history !== undefined) profile.history = history;

      if (targetName && targetName !== name) {
        profiles[targetName] = profile;
        delete profiles[name];
      } else {
        profiles[targetName] = profile;
      }

      await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
      res.json({ status: "ok", profile: { name: targetName, ...profile } });
    } catch (e) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/profiles/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const profilesPath = path.join(DATA_DIR, "profiles.json");
      const profilesData = await fs.readFile(profilesPath, "utf8");
      const profiles = JSON.parse(profilesData);
      
      if (profiles[name]) {
        delete profiles[name];
        await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
      }
      res.json({ status: "ok" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  app.post("/api/board/import", async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.categories) return res.status(400).json({ error: "Invalid board" });
      gameState.board = data;
      gameState.boardRevealed = [];
      gameState.boardPlayedValues = {};
      gameState.boardSelector = null;
      gameState.boardCurrentTile = null;
      gameState.boardOpen = false;
      io.emit("board", { board: gameState.board, revealed: [], playedValues: {} });
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to import board" });
    }
  });

  app.get("/api/board/export", (req, res) => {
    res.json(gameState.board || {});
  });

  // Socket.IO Game State & Logic
  const gameState = {
    hostId: null as string | null,
    players: {} as Record<string, { id: string, name: string, role: 'player', isGuest: boolean, pingMs: number, status: string }>,
    nameToScore: {} as Record<string, number>,
    scoreboard: {} as Record<string, number>,
    doublePointsActive: false,
    questionMode: null as 'buzzer' | 'guess' | 'choice' | 'text' | null,
    buzzLocked: false,
    buzzRecords: [] as Array<{ pid: string, time: number, answer?: any, bet?: number }>,
    correctAnswer: null as any,
    answersRevealed: false,
    
    board: null as any,
    boardRevealed: [] as string[],
    boardPlayedValues: {} as Record<string, number>,
    boardSelector: null as string | null,
    boardCurrentTile: null as [number, number] | null,
    boardOpen: false,
    boardRiskActive: false,
    betsConfirmed: false,
    riskBets: {} as Record<string, number>,
    questionPointReceivers: new Set<string>(),
    isGameOver: false,
    
    finalRoundActive: false,
    finalistIds: [] as string[],
    finalRounds: [] as any[],
    finalStageIdx: 0,
    finalQuestionIdx: -1,
    finalTurnIdx: -1,
    finalTurnOrder: [] as string[],
    pendingFinalQuestion: null as any,
    finalStats: { quickfire: {} as Record<string, number>, turnlist: {} as Record<string, number>, discussion: {} as Record<string, number> },

    tieBreakerActive: false,
    tieBreakerPlayers: [] as string[],
    tieBreakerSlots: 0,
    tieBreakerQuestion: null as any,
    tieBreakerAnswerValue: null as number | null,
    tieBreakerGuesses: {} as Record<string, number>,
    preFinalists: [] as string[],
    
    countdownActive: false,
    countdownSeconds: 0,
    countdownInterval: null as NodeJS.Timeout | null,
  };

  async function loadScores() {
    try {
      const data = await fs.readFile(path.join(DATA_DIR, "scoreboard.json"), "utf8");
      gameState.nameToScore = JSON.parse(data);
    } catch (e) {}
  }
  await loadScores();

  async function saveScores() {
    try {
      await fs.writeFile(path.join(DATA_DIR, "scoreboard.json"), JSON.stringify(gameState.nameToScore));
    } catch (e) {}
  }

  function emitToHost(event: string, payload: any) {
    if (gameState.hostId) io.to(gameState.hostId).emit(event, payload);
  }

  function emitToPlayers(event: string, payload: any) {
    io.emit(event, payload);
  }

  io.on("connection", (socket) => {
    socket.on("register", async (data: { role: "host" | "player", name?: string, guest?: boolean }) => {
      const { role, name, guest } = data;
      
      if (role === "host") {
        gameState.hostId = socket.id;
        
        socket.emit("registered", { role: "host", id: socket.id, name: name || "Host" });
        socket.emit("game_state", gameState);
      } else if (role === "player" && name) {
        // Find existing player with the same name
        const existingPid = Object.keys(gameState.players).find(pid => gameState.players[pid].name === name);
        if (existingPid && existingPid !== socket.id) {
          delete gameState.players[existingPid];
          delete gameState.scoreboard[existingPid];
          emitToHost("player_removed", { player_id: existingPid, scoreboard: gameState.scoreboard });
        }

        // Player
        gameState.players[socket.id] = { id: socket.id, name, role: "player", isGuest: !!guest, pingMs: 0, status: "online" };
        
        // Initialize scores
        if (!(name in gameState.nameToScore)) {
          gameState.nameToScore[name] = 0;
          saveScores();
        }
        gameState.scoreboard[socket.id] = gameState.nameToScore[name];

        const profilesData = await fs.readFile(path.join(DATA_DIR, "profiles.json"), "utf8");
        const profiles = JSON.parse(profilesData);
        let profile = profiles[name];

        if (!profile) {
           profile = { stats: { total_points: 0, games_played: 0 }, achievements: {} };
           profiles[name] = profile;
           await fs.writeFile(path.join(DATA_DIR, "profiles.json"), JSON.stringify(profiles, null, 2));
        }

        socket.emit("registered", { role: "player", id: socket.id, name, guest: !!guest, profile });
        socket.emit("game_state", gameState);

        io.emit("player_joined", { player: gameState.players[socket.id], profile, scoreboard: gameState.scoreboard });
      }
    });

    socket.on("server_pong", (data) => {
      const rtt = Date.now() - data.time;
      const pingMs = rtt / 2;
      const p = gameState.players[socket.id];
      if (p) {
        p.pingMs = pingMs;
        emitToHost("player_ping", { id: socket.id, pingMs });
      }
    });

    socket.on("status_change", (data) => {
      const p = gameState.players[socket.id];
      if (p && data.status) {
        p.status = data.status;
        emitToHost("player_status", { player_id: socket.id, status: data.status });
      }
    });

    // Handle buzzing
    socket.on("buzz", (data) => {
      const p = gameState.players[socket.id];
      if (!p) return;
      if (gameState.buzzLocked || !gameState.questionMode) return;
      if (gameState.buzzRecords.some(r => r.pid === socket.id)) return;
      if (gameState.finalRoundActive && !gameState.finalistIds.includes(socket.id)) return;

      const adjustedTime = Date.now() - p.pingMs;
      gameState.buzzRecords.push({ pid: socket.id, time: adjustedTime, answer: data.answer });
      gameState.buzzRecords.sort((a, b) => a.time - b.time);

      io.emit("buzz_update", { records: gameState.buzzRecords });
    });

    // Score modification
    socket.on("score", (data) => {
      if (socket.id !== gameState.hostId) return; // Host only
      const { player_id, points } = data;
      if (!gameState.scoreboard[player_id]) gameState.scoreboard[player_id] = 0;
      gameState.scoreboard[player_id] += points;
      
      const p = gameState.players[player_id];
      if (p) {
        gameState.nameToScore[p.name] = gameState.scoreboard[player_id];
        saveScores();
      }

      // If positive points are awarded, this person probably got the question right, so they get to pick next
      if (points > 0) {
         gameState.boardSelector = player_id;
         gameState.questionPointReceivers.add(player_id);
         io.emit("board_selector", { player_id, player_name: p?.name });
         
         // If answers are already revealed and this is a mode where we track winners this way, emit an update so the "Winners" section updates
         if (gameState.answersRevealed && (gameState.questionMode === "text" || gameState.questionMode === "buzzer")) {
            const answerMsg = {
               winners: Array.from(gameState.questionPointReceivers),
               buzzRecords: gameState.buzzRecords
            };
            io.emit("board_answer_update", answerMsg);
         }
      }

      io.emit("scoreboard", { scoreboard: gameState.scoreboard });
    });

    // Lock buzzers
    socket.on("lock", () => {
      if (socket.id === gameState.hostId) {
        gameState.buzzLocked = true;
        io.emit("lock_status", { locked: true });
      }
    });

    socket.on("unlock", () => {
      if (socket.id === gameState.hostId) {
        gameState.buzzLocked = false;
        io.emit("lock_status", { locked: false });
      }
    });

    socket.on("remove_buzz", (data) => {
       if (socket.id !== gameState.hostId) return;
       gameState.buzzRecords = gameState.buzzRecords.filter(r => r.pid !== data.player_id);
       io.emit("buzz_update", { records: gameState.buzzRecords });
       io.emit("unbuzz", { player_id: data.player_id });
    });

    socket.on("reset_scores", () => {
       if (socket.id !== gameState.hostId) return;
       for (const pid of Object.keys(gameState.scoreboard)) {
          gameState.scoreboard[pid] = 0;
       }
       for (const name of Object.keys(gameState.nameToScore)) {
          gameState.nameToScore[name] = 0;
       }
       saveScores();
       io.emit("scoreboard", { scoreboard: gameState.scoreboard });
    });

    socket.on("remove_player", (data) => {
      if (socket.id !== gameState.hostId) return;
      const pid = data.player_id;
      delete gameState.players[pid];
      delete gameState.scoreboard[pid];
      io.emit("player_removed", { player_id: pid, scoreboard: gameState.scoreboard });
    });

    socket.on("random_player", () => {
      if (socket.id !== gameState.hostId) return;
      const pids = Object.keys(gameState.players);
      if (pids.length === 0) return;
      const randomPid = pids[Math.floor(Math.random() * pids.length)];
      const p = gameState.players[randomPid];
      if (p) emitToHost("random_player", { player_id: randomPid, player_name: p.name });
    });

    socket.on("board_set_selector", (data) => {
      if (socket.id !== gameState.hostId && socket.id !== gameState.boardSelector) return;
      gameState.boardSelector = data.player_id;
      const p = gameState.players[data.player_id];
      io.emit("board_selector", { player_id: data.player_id, player_name: p ? p.name : null });
    });

    socket.on("board_show_question", () => {
      if (socket.id !== gameState.hostId) return;
      if (!gameState.boardCurrentTile) return;
      gameState.boardOpen = true;
      const [cIdx, tIdx] = gameState.boardCurrentTile;
      const tile = gameState.board.categories[cIdx].tiles[tIdx];
      io.emit("board_show_question", {
        category_index: cIdx,
        tile_index: tIdx,
        question: tile.question,
        mode: tile.mode || "buzzer",
        choices: tile.choices,
        correct_index: tile.correctIndex,
        correct_value: tile.correctValue
      });
    });

    socket.on("board_reveal_answer", () => {
      if (socket.id !== gameState.hostId) return;
      if (!gameState.boardCurrentTile) return;
      const [cIdx, tIdx] = gameState.boardCurrentTile;
      const tile = gameState.board.categories[cIdx].tiles[tIdx];
      
      if (gameState.countdownInterval) {
         clearInterval(gameState.countdownInterval);
         gameState.countdownInterval = null;
      }
      gameState.countdownActive = false;
      io.emit("countdown_stop");
      
      const key = `${cIdx}-${tIdx}`;
      gameState.boardRevealed.push(key);
      const displayPts = (tile.value || 0) * (gameState.doublePointsActive ? 2 : 1);
      gameState.boardPlayedValues[key] = displayPts;
      
      let winners: string[] = [];
      if (tile.mode === "choice" && typeof tile.correctIndex === "number") {
         const letter = ["A", "B", "C", "D"][tile.correctIndex];
         winners = gameState.buzzRecords.filter(r => String(r.answer).toUpperCase() === letter).map(r => r.pid);
      } else if (tile.mode === "guess" && typeof tile.correctValue === "number") {
         let minDiff = Infinity;
         const diffs = gameState.buzzRecords.map(r => {
            const val = parseFloat(r.answer);
            if (isNaN(val)) return { pid: r.pid, diff: Infinity };
            return { pid: r.pid, diff: Math.abs(val - tile.correctValue) };
         });
         diffs.forEach(d => { if (d.diff < minDiff) minDiff = d.diff; });
         if (minDiff < Infinity) {
            winners = diffs.filter(d => d.diff === minDiff).map(d => d.pid);
         }
      } else {
         winners = Array.from(gameState.questionPointReceivers);
      }

      if (gameState.boardRiskActive) {
         Object.keys(gameState.riskBets).forEach(pid => {
            const bet = gameState.riskBets[pid] || 0;
            const pResponded = gameState.buzzRecords.some(r => r.pid === pid);
            if (winners.includes(pid)) {
               gameState.scoreboard[pid] += bet;
               if (gameState.players[pid]) gameState.nameToScore[gameState.players[pid].name] += bet;
            } else if (pResponded && (tile.mode === "choice" || tile.mode === "guess")) {
               gameState.scoreboard[pid] -= bet;
               if (gameState.players[pid]) gameState.nameToScore[gameState.players[pid].name] -= bet;
            }
         });
      } else if (tile.mode === "choice") {
         const basePoints = tile.value || 0;
         const pts = basePoints * (gameState.doublePointsActive ? 2 : 1) * (tile.double ? 2 : 1);
         gameState.buzzRecords.forEach(r => {
            const pid = r.pid;
            if (!gameState.scoreboard[pid]) gameState.scoreboard[pid] = 0;
            if (winners.includes(pid)) {
               gameState.scoreboard[pid] += pts;
               if (gameState.players[pid]) gameState.nameToScore[gameState.players[pid].name] += pts;
            } else {
               gameState.scoreboard[pid] -= pts;
               if (gameState.players[pid]) gameState.nameToScore[gameState.players[pid].name] -= pts;
            }
         });
      } else if (winners.length > 0) {
         const basePoints = tile.value || 0;
         const pts = basePoints * (gameState.doublePointsActive ? 2 : 1) * (tile.double ? 2 : 1);
         winners.forEach(pid => {
            if (!gameState.scoreboard[pid]) gameState.scoreboard[pid] = 0;
            gameState.scoreboard[pid] += pts;
            if (gameState.players[pid]) gameState.nameToScore[gameState.players[pid].name] += pts;
         });
      }

      const answerMsg = {
        category_index: cIdx,
        tile_index: tIdx,
        answer: tile.answer,
        revealed: gameState.boardRevealed,
        playedValues: gameState.boardPlayedValues,
        winners
      };

      if (winners.length > 0) {
         const fastest = gameState.buzzRecords.find(r => winners.includes(r.pid));
         if (fastest) {
            gameState.boardSelector = fastest.pid;
            io.emit("board_selector", { player_id: fastest.pid, player_name: gameState.players[fastest.pid]?.name });
         }
      }

      saveScores();
      io.emit("scoreboard", { scoreboard: gameState.scoreboard });

      gameState.answersRevealed = true;
      io.emit("board_answer", answerMsg);
    });

    socket.on("board_next_question", () => {
      if (socket.id !== gameState.hostId) return;
      gameState.boardCurrentTile = null;
      gameState.boardOpen = false;
      gameState.boardRiskActive = false;
      gameState.questionMode = null;
      gameState.answersRevealed = false;
      gameState.questionPointReceivers.clear();
      
      io.emit("board_close_question");
    });

    socket.on("place_bet", (data) => {
      if (!gameState.boardRiskActive) return;
      let bet = parseInt(data.bet, 10);
      if (isNaN(bet) || bet < 0) bet = 0;
      const maxAllowed = Math.max(500, gameState.scoreboard[socket.id] || 0);
      if (bet > maxAllowed) bet = maxAllowed;
      gameState.riskBets[socket.id] = bet;
      io.emit("bet_update", { player_id: socket.id, bet });
    });

    socket.on("confirm_bets", () => {
      if (socket.id !== gameState.hostId) return;
      gameState.betsConfirmed = true;
      io.emit("bets_confirmed");
    });

    socket.on("start_final_round", () => {
      if (socket.id !== gameState.hostId) return;
      if (!gameState.board || !gameState.board.finalRound) return;
      
      const numPlayers = parseInt(gameState.board.finalRound.numPlayers) || 2;
      const scores = Object.entries(gameState.scoreboard).sort((a,b) => b[1] - a[1]);
      const preFinalists = scores.slice(0, numPlayers).map(x => x[0]);
      
      // Simplifying: just grab top N without tie breaker for now
      gameState.finalRoundActive = true;
      gameState.finalistIds = preFinalists;
      gameState.finalRounds = gameState.board.finalRound.rounds || [{ type: "quickfire", questions: gameState.board.finalRound.quickfire || [] }];
      gameState.finalStageIdx = 0;
      gameState.finalQuestionIdx = -1;
      gameState.finalTurnIdx = -1;
      gameState.boardCurrentTile = null;

      io.emit("final_round_started", { 
         finalists: gameState.finalistIds.map(pid => ({ id: pid, name: gameState.players[pid]?.name }))
      });
      // Start first stage
      io.emit("final_stage_info", { type: gameState.finalRounds[0].type });
    });

    socket.on("next_final_question", () => {
      if (socket.id !== gameState.hostId) return;
      gameState.finalQuestionIdx++;
      const stage = gameState.finalRounds[gameState.finalStageIdx];
      if (gameState.finalQuestionIdx >= stage.questions.length) {
         gameState.finalStageIdx++;
         if (gameState.finalStageIdx >= gameState.finalRounds.length) {
            gameState.finalRoundActive = false;
            io.emit("final_round_end", { finalStats: gameState.finalStats });
            return;
         }
         io.emit("final_stage_info", { type: gameState.finalRounds[gameState.finalStageIdx].type });
         gameState.finalQuestionIdx = -1;
         return;
      }
      const q = stage.questions[gameState.finalQuestionIdx];
      gameState.pendingFinalQuestion = q;
      gameState.questionMode = "buzzer";
      gameState.buzzRecords = [];
      gameState.buzzLocked = false;
      emitToHost("final_question", { question: q.question, answer: q.answer });
      io.emit("final_quickfire_prepare");
    });

    socket.on("show_final_question", () => {
      if (socket.id !== gameState.hostId || !gameState.pendingFinalQuestion) return;
      io.emit("final_question_show", { question: gameState.pendingFinalQuestion.question });
    });

    socket.on("show_final_answer", () => {
      if (socket.id !== gameState.hostId || !gameState.pendingFinalQuestion) return;
      io.emit("final_question_answer", { answer: gameState.pendingFinalQuestion.answer });
      gameState.pendingFinalQuestion = null;
    });

    socket.on("next_final_turn", () => {
      if (socket.id !== gameState.hostId) return;
      gameState.finalTurnIdx = (gameState.finalTurnIdx + 1) % gameState.finalistIds.length;
      io.emit("final_turn", { 
         player_id: gameState.finalistIds[gameState.finalTurnIdx], 
         player_name: gameState.players[gameState.finalistIds[gameState.finalTurnIdx]]?.name,
         prompt: gameState.finalRounds[gameState.finalStageIdx]?.prompt 
      });
    });

    socket.on("choose_turnlist_winner", (data) => {
       if (socket.id !== gameState.hostId) return;
       gameState.finalStats.turnlist[data.player_id] = (gameState.finalStats.turnlist[data.player_id] || 0) + 1;
       gameState.finalStageIdx++;
       if (gameState.finalStageIdx >= gameState.finalRounds.length) {
          gameState.finalRoundActive = false;
          io.emit("final_round_end", { finalStats: gameState.finalStats });
          return;
       }
       io.emit("final_stage_info", { type: gameState.finalRounds[gameState.finalStageIdx].type });
       gameState.finalTurnIdx = -1;
    });

    socket.on("choose_discussion_winner", (data) => {
       if (socket.id !== gameState.hostId) return;
       gameState.finalStats.discussion[data.player_id] = (gameState.finalStats.discussion[data.player_id] || 0) + 1;
       gameState.finalStageIdx++;
       if (gameState.finalStageIdx >= gameState.finalRounds.length) {
          gameState.finalRoundActive = false;
          io.emit("final_round_end", { finalStats: gameState.finalStats });
          return;
       }
       io.emit("final_stage_info", { type: gameState.finalRounds[gameState.finalStageIdx].type });
    });

    socket.on("choose_final_ranking", (data) => {
       if (socket.id !== gameState.hostId) return;
       const ranking = data.ranking.map((pid: string) => ({
          id: pid,
          name: gameState.players[pid]?.name,
          score: gameState.scoreboard[pid] || 0
       }));
       io.emit("final_winners_result", { ranking, finalStats: gameState.finalStats });
    });
    
    socket.on("double_points", () => {
       if (socket.id !== gameState.hostId) return;
       gameState.doublePointsActive = !gameState.doublePointsActive;
       io.emit("game_state", gameState);
    });

    socket.on("show_standings", () => {
      if (socket.id !== gameState.hostId) return;
      const leaderboard = Object.keys(gameState.players).map(pid => {
         return {
            player_id: pid,
            player_name: gameState.players[pid].name,
            score: gameState.scoreboard[pid] || 0
         };
      }).sort((a,b) => b.score - a.score);
      io.emit("standings", { leaderboard });
    });

    socket.on("end_game", async () => {
      if (socket.id !== gameState.hostId) return;
      gameState.isGameOver = !gameState.isGameOver;
      if (gameState.isGameOver) {
        const leaderboard = Object.keys(gameState.players).map(pid => {
           return {
              player_id: pid,
              player_name: gameState.players[pid].name,
              score: gameState.scoreboard[pid] || 0
           };
        }).sort((a,b) => b.score - a.score);
        io.emit("game_over", { leaderboard });

        try {
          const profilesData = await fs.readFile(path.join(DATA_DIR, "profiles.json"), "utf8");
          const profiles = JSON.parse(profilesData);
          const date = new Date().toISOString();
          const categories = gameState.board?.categories?.map((c: any) => c.name) || [];
          const gameId = date + "-" + Math.random().toString(36).substr(2, 9);
          
          leaderboard.forEach(({ player_name, score }, index) => {
            if (profiles[player_name]) {
              const profile = profiles[player_name];
              if (!profile.history) profile.history = [];
              profile.history.push({
                id: gameId,
                date,
                score,
                position: index + 1,
                numPlayers: leaderboard.length,
                categories
              });

              if (!profile.stats) profile.stats = { total_points: 0, games_played: 0 };
              profile.stats.total_points += score;
              profile.stats.games_played += 1;
              if (index === 0) {
                 profile.stats.wins = (profile.stats.wins || 0) + 1;
              }
            }
          });
          await fs.writeFile(path.join(DATA_DIR, "profiles.json"), JSON.stringify(profiles, null, 2));

          try {
            const gamesData = await fs.readFile(path.join(DATA_DIR, "games.json"), "utf8");
            let games = JSON.parse(gamesData);
            games.push({ id: gameId, date, categories, leaderboard });
            await fs.writeFile(path.join(DATA_DIR, "games.json"), JSON.stringify(games, null, 2));
          } catch(err) {
            console.error("Failed to update games.json", err);
          }

          io.emit("profiles_updated", Object.entries(profiles).map(([name, data]) => ({ name, ...(data as any) })));
        } catch (e) {
          console.error("Failed to update profile histories", e);
        }
      } else {
        io.emit("resume_game");
      }
    });

    socket.on("start_countdown", (data) => {
      if (socket.id !== gameState.hostId) return;
      const seconds = data?.seconds || 10; // default 10
      gameState.countdownActive = true;
      gameState.countdownSeconds = seconds;
      
      if (gameState.countdownInterval) {
         clearInterval(gameState.countdownInterval);
      }

      io.emit("countdown_start", { seconds });

      gameState.countdownInterval = setInterval(() => {
         gameState.countdownSeconds--;
         io.emit("countdown_update", { seconds: gameState.countdownSeconds });
         if (gameState.countdownSeconds <= 0) {
            if (gameState.countdownInterval) clearInterval(gameState.countdownInterval);
            gameState.countdownInterval = null;
            gameState.countdownActive = false;
            // Lock out players from buzzing / submitting
            gameState.buzzLocked = true;
            io.emit("countdown_end");
            io.emit("lock_status", { locked: true });
         }
      }, 1000);
    });

    socket.on("stop_countdown", () => {
      if (socket.id !== gameState.hostId) return;
      if (gameState.countdownInterval) {
         clearInterval(gameState.countdownInterval);
         gameState.countdownInterval = null;
      }
      gameState.countdownActive = false;
      io.emit("countdown_stop");
    });

    // Select Tile
    socket.on("select_tile", (data) => {
      const { category_index, tile_index } = data;
      const isHost = socket.id === gameState.hostId;
      const isSelector = socket.id === gameState.boardSelector;
      
      if (!isHost && !isSelector) return;
      
      if (gameState.boardCurrentTile) return;
      
      gameState.questionPointReceivers.clear();
      
      const key = `${category_index}-${tile_index}`;
      if (gameState.boardRevealed.includes(key)) return;

      const tile = gameState.board.categories[category_index].tiles[tile_index];

      gameState.boardCurrentTile = [category_index, tile_index];
      gameState.questionMode = tile.mode || 'buzzer';
      gameState.boardOpen = false;
      gameState.boardRiskActive = !!tile.risk;
      gameState.betsConfirmed = false;
      gameState.riskBets = {};
      gameState.buzzRecords = [];
      gameState.buzzLocked = false;
      
      if (gameState.countdownInterval) {
         clearInterval(gameState.countdownInterval);
         gameState.countdownInterval = null;
      }
      gameState.countdownActive = false;
      io.emit("countdown_stop");

      // Broadcast changes
      io.emit("board_tile_selected", { category_index, tile_index, tile });
      if (gameState.boardSelector) {
         gameState.boardSelector = null;
         io.emit("board_selector", { player_id: null });
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      const p = gameState.players[socket.id];
      if (p) {
        p.status = "offline";
        emitToHost("player_status", { player_id: socket.id, status: "offline" });
      }
    });
  });

  setInterval(() => {
    io.emit("server_ping", { time: Date.now() });
  }, 2000);

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: PORT + 1 },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
