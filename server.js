import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const wss = new WebSocketServer({ port: 8070 });
const rooms = {};
const QUESTION_TIME = 10000; // 10 seconds

function loadQuestions(lang = "en") {
  const filePath = path.resolve(`./questions/${lang}.json`);
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading questions for ${lang}:`, err);
    return JSON.parse(fs.readFileSync("./questions/en.json", "utf8"));
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // --- Join or create room ---
    if (data.type === "join") {
      const lang = data.language || "en";
      let room = Object.values(rooms).find(
        r => r.players.length < 2 && r.language === lang
      );

      if (!room) {
        room = {
          id: Date.now(),
          players: [],
          hp: {},
          currentQuestion: 0,
          answers: {},
          timer: null,
          language: lang,
          questions: loadQuestions(lang)
        };
        rooms[room.id] = room;
      }

      const playerId = Math.random().toString(36).substring(2, 9);
      ws.id = playerId;
      room.players.push(ws);
      room.hp[playerId] = 100;

      if (room.players.length === 2) {
        startQuestion(room);
      } else {
        ws.send(JSON.stringify({ type: "waiting", msg: "Waiting for another player..." }));
      }
    }

    // --- Handle answer ---
    if (data.type === "answer") {
      const room = Object.values(rooms).find(r => r.players.includes(ws));
      if (!room) return;

      const q = room.questions[room.currentQuestion];
      const correct = data.answer.trim().toLowerCase() === q.a.toLowerCase();
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

function startQuestion(room) {
  const q = room.questions[room.currentQuestion];
  room.answers = {};

  room.players.forEach(p => {
    const enemy = room.players.find(e => e !== p);
    p.send(JSON.stringify({
      type: "question",
      question: q.q,
      yourHp: room.hp[p.id],
      enemyHp: room.hp[enemy?.id] ?? 100,
      playerId: p.id,
      time: QUESTION_TIME / 1000,
      language: room.language
    }));
  });

  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(room), QUESTION_TIME);
}

function endRound(room) {
  const [p1, p2] = room.players;
  const a1 = room.answers[p1.id];
  const a2 = room.answers[p2.id];

  if (a1 && !a2) room.hp[p2.id] -= 25;
  else if (a2 && !a1) room.hp[p1.id] -= 25;

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

  room.currentQuestion = (room.currentQuestion + 1) % room.questions.length;
  startQuestion(room);
}
