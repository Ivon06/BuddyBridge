import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8070 });
const QUESTION_TIME = 10000;
const rooms = {};

const allQuestions = [
  { q: "What is 2 + 2?", a: "4" },
  { q: "What color is the sky?", a: "blue" },
  { q: "How many days are in a week?", a: "7" },
  { q: "What is the capital of France?", a: "paris" },
  { q: "What planet do we live on?", a: "earth" },
  { q: "What is the opposite of hot?", a: "cold" },
  { q: "How many legs does a spider have?", a: "8" },
  { q: "What gas do humans need to breathe?", a: "oxygen" },
  { q: "What do bees make?", a: "honey" },
  { q: "What is 5 x 5?", a: "25" },
  { q: "What comes after Tuesday?", a: "wednesday" },
  { q: "What is the first month of the year?", a: "january" },
  { q: "What is H2O commonly known as?", a: "water" },
  { q: "How many continents are there?", a: "7" },
  { q: "Which animal says 'moo'?", a: "cow" },
];

// 🧩 Helper: pick 10 random unique questions
function getRandomQuestions() {
  const shuffled = allQuestions.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 10);
}

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // --- Player joins ---
    if (data.type === "join") {
      const character = data.character || "mario";

      let room = Object.values(rooms).find((r) => r.players.length < 2);
      if (!room) {
        room = {
          id: Date.now(),
          players: [],
          hp: {},
          currentQuestion: 0,
          answers: {},
          characters: {},
          timer: null,
          questions: getRandomQuestions(),
        };
        rooms[room.id] = room;
      }

      const playerId = Math.random().toString(36).substring(2, 9);
      ws.id = playerId;
      room.players.push(ws);
      room.hp[playerId] = 100;
      room.characters[playerId] = character;

      if (room.players.length === 2) startQuestion(room);
      else ws.send(JSON.stringify({ type: "waiting", msg: "Waiting for another player..." }));
    }

    // --- Handle answer ---
    if (data.type === "answer") {
      const room = Object.values(rooms).find((r) => r.players.includes(ws));
      if (!room) return;

      const playerAnswer = data.answer.trim().toLowerCase();
      room.answers[ws.id] = playerAnswer;

      // If both players answered, end the round
      if (Object.keys(room.answers).length === 2) endRound(room);
    }
  });
});

// 🧩 Ask the next question
function startQuestion(room) {
  if (room.currentQuestion >= room.questions.length) {
    endGame(room, "No more questions! It's a draw!");
    return;
  }

  const q = room.questions[room.currentQuestion];
  room.answers = {};

  room.players.forEach((p) => {
    const enemy = room.players.find((e) => e !== p);
    p.send(
      JSON.stringify({
        type: "question",
        question: q.q,
        yourHp: room.hp[p.id],
        enemyHp: room.hp[enemy?.id] ?? 100,
        yourCharacter: room.characters[p.id],
        enemyCharacter: room.characters[enemy?.id],
        playerId: p.id,
        time: QUESTION_TIME / 1000,
      })
    );
  });

  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(room), QUESTION_TIME);
}

// 🧩 End of round logic
function endRound(room) {
  const q = room.questions[room.currentQuestion];
  const correct = q.a.toLowerCase();
  const [p1, p2] = room.players;

  if (!p1 || !p2) return;

  const a1 = room.answers[p1.id]?.toLowerCase() ?? "";
  const a2 = room.answers[p2.id]?.toLowerCase() ?? "";

  if (a1 !== correct) room.hp[p1.id] -= 20;
  if (a2 !== correct) room.hp[p2.id] -= 20;

  room.players.forEach((p) => {
    const enemy = room.players.find((e) => e !== p);
    p.send(
      JSON.stringify({
        type: "updateHp",
        yourHp: room.hp[p.id],
        enemyHp: room.hp[enemy.id],
      })
    );
  });

  // 🧩 Someone lost?
  if (room.hp[p1.id] <= 0 || room.hp[p2.id] <= 0) {
    const winner = room.hp[p1.id] > room.hp[p2.id] ? p1 : p2;
    winner.send(JSON.stringify({ type: "end", msg: "You won!" }));
    room.players.find((p) => p !== winner)?.send(JSON.stringify({ type: "end", msg: "You lost!" }));
    delete rooms[room.id];
  } else {
    room.currentQuestion++;
    startQuestion(room);
  }
}

// 🧩 End game helper
function endGame(room, msg) {
  room.players.forEach((p) => {
    p.send(JSON.stringify({ type: "end", msg }));
  });
  delete rooms[room.id];
}

console.log("✅ Quiz Battle server running on ws://localhost:8070");
