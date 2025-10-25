import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8070 });
const rooms = {};
const QUESTION_TIME = 10000; // 10 seconds

const questions = [
  { q: "2 + 2 = ?", a: "4" },
  { q: "Capital of France?", a: "paris" },
  { q: "5 * 3 = ?", a: "15" },
  { q: "Color of the sky?", a: "blue" },
];

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // --- Join or create room ---
    if (data.type === "join") {
      let room = Object.values(rooms).find(r => r.players.length < 2);
      if (!room) {
        room = {
          id: Date.now(),
          players: [],
          hp: {},
          currentQuestion: 0,
          answers: {},
          timer: null
        };
        rooms[room.id] = room;
      }

      const playerId = Math.random().toString(36).substring(2, 9);
      ws.id = playerId;
      room.players.push(ws);
      room.hp[playerId] = 100;

      // Start when both joined
      if (room.players.length === 2) {
        startQuestion(room);
      }
    }

    // --- Handle answer ---
    if (data.type === "answer") {
      const room = Object.values(rooms).find(r => r.players.includes(ws));
      if (!room) return;

      const q = questions[room.currentQuestion];
      const correct = data.answer.toLowerCase() === q.a.toLowerCase();
      room.answers[ws.id] = correct;
    }
  });

  ws.on("close", () => {
    const room = Object.values(rooms).find(r => r.players.includes(ws));
    if (!room) return;
    room.players.forEach(p => {
      if (p !== ws && p.readyState === 1)
        p.send(JSON.stringify({ type: "result", msg: "Opponent disconnected." }));
    });
    delete rooms[room.id];
  });
});

// --- Function to start a question round ---
function startQuestion(room) {
  const q = questions[room.currentQuestion];
  room.answers = {};

  // Send question to both players
  room.players.forEach(p => {
    const enemy = room.players.find(e => e !== p);
    p.send(JSON.stringify({
      type: "question",
      question: q.q,
      yourHp: room.hp[p.id],
      enemyHp: room.hp[enemy?.id] ?? 100,
      playerId: p.id,
      time: QUESTION_TIME / 1000
    }));
  });

  // Start timer
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(room), QUESTION_TIME);
}

// --- Function to process results after timer ---
function endRound(room) {
  const [p1, p2] = room.players;
  const a1 = room.answers[p1.id];
  const a2 = room.answers[p2.id];

  // Apply damage logic
  if (a1 && !a2) {
    room.hp[p2.id] -= 25;
  } else if (a2 && !a1) {
    room.hp[p1.id] -= 25;
  }

  // Check for game over
  for (const p of [p1, p2]) {
    if (room.hp[p.id] <= 0) {
      const winner = p === p1 ? p2 : p1;
      if (winner.readyState === 1) winner.send(JSON.stringify({ type: "result", msg: "You win!" }));
      if (p.readyState === 1) p.send(JSON.stringify({ type: "result", msg: "You lose!" }));
      clearTimeout(room.timer);
      delete rooms[room.id];
      return;
    }
  }

  // Next question
  room.currentQuestion = (room.currentQuestion + 1) % questions.length;
  startQuestion(room);
}
