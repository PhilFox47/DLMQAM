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
  } catch (err) {
    console.error("Failed to initialize data files", err);
  }
}

async function startServer() {
  await ensureDataFiles();
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  // API Routes
  app.use(express.json({ limit: "50mb" }));
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
      const { name, new_name, avatar, buzzer, color, stats, achievements } = req.body;
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

  app.post("/api/board/import", async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.categories) return res.status(400).json({ error: "Invalid board" });
      gameState.board = data;
      gameState.boardRevealed = [];
      gameState.boardSelector = null;
      gameState.boardCurrentTile = null;
      gameState.boardOpen = false;
      io.emit("board", { board: gameState.board, revealed: [] });
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
    boardSelector: null as string | null,
    boardCurrentTile: null as [number, number] | null,
    boardOpen: false,
    boardRiskActive: false,
    riskBets: {} as Record<string, number>,
    
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
    preFinalists: [] as string[]
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
        const profile = profiles[name];

        socket.emit("registered", { role: "player", id: socket.id, name, guest: !!guest, profile });
        socket.emit("game_state", gameState);

        emitToHost("player_joined", { player: gameState.players[socket.id], profile, scoreboard: gameState.scoreboard });
      }
    });

    socket.on("ping_test", (data) => {
      // Estimate ping
      const rtt = Date.now() - data.timestamp;
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

      const adjustedTime = Date.now() + p.pingMs;
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

    // Select Tile
    socket.on("select_tile", (data) => {
      const { category_index, tile_index } = data;
      const isHost = socket.id === gameState.hostId;
      const isSelector = socket.id === gameState.boardSelector;
      
      if (!isHost && !isSelector) return;
      
      if (gameState.boardCurrentTile) return;
      
      const key = `${category_index}-${tile_index}`;
      if (gameState.boardRevealed.includes(key)) return;

      const tile = gameState.board.categories[category_index].tiles[tile_index];

      gameState.boardCurrentTile = [category_index, tile_index];
      gameState.questionMode = tile.mode || 'buzzer';
      gameState.boardOpen = false;
      gameState.boardRiskActive = !!tile.risk;
      gameState.riskBets = {};
      gameState.buzzRecords = [];
      gameState.buzzLocked = false;

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

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
