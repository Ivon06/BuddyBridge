import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8070 });
const rooms = {};
const questions = [
  { q: "2 + 2 = ?", a: "4" },
  { q: "Capital of France?", a: "paris" },
  { q: "5 * 3 = ?", a: "15" },
];

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // Join or create room
    if (data.type === "join") {
      let room = Object.values(rooms).find(r => r.players.length < 2);
      if (!room) {
        room = { id: Date.now(), players: [], hp: {}, currentQuestion: 0 };
        rooms[room.id] = room;
      }

      const playerId = Math.random().toString(36).substring(2, 9); // unique id
      ws.id = playerId;
      room.players.push(ws);
      room.hp[playerId] = 100;

      // Start when both joined
      if (room.players.length === 2) {
        const q = questions[room.currentQuestion];
        room.players.forEach(p =>
          p.send(JSON.stringify({
            type: "question",
            question: q.q,
            hp: room.hp[p.id],
            playerId: p.id
          }))
        );
      }
    }

    // Handle answer
    if (data.type === "answer") {
      const room = Object.values(rooms).find(r => r.players.includes(ws));
      if (!room) return;

      const q = questions[room.currentQuestion];
      if (data.answer.toLowerCase() === q.a.toLowerCase()) {
        const other = room.players.find(p => p !== ws);

        room.hp[other.id] -= 25;
        console.log(`Player ${ws.id} hit ${other.id}. HP left: ${room.hp[other.id]}`);

        if (room.hp[other.id] <= 0) {
          ws.send(JSON.stringify({ type: "result", msg: "You win!" }));
          other.send(JSON.stringify({ type: "result", msg: "You lose!" }));
          delete rooms[room.id];
          return;
        }

        // Next question
        room.currentQuestion = (room.currentQuestion + 1) % questions.length;
        const nextQ = questions[room.currentQuestion];

        room.players.forEach(p => {
          const enemyId = room.players.find(e => e !== p).id;
          p.send(JSON.stringify({
            type: "update",
            question: nextQ.q,
            hp: room.hp[enemyId],
            playerId: p.id
          }));
        });
      }
    }
  });
});
