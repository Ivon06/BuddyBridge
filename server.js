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
      room.players.push(ws);
      room.hp[ws] = 100;

      if (room.players.length === 2) {
        const q = questions[room.currentQuestion];
        room.players.forEach(p => p.send(JSON.stringify({ type: "question", question: q.q })));
      }
    }

    // Handle answer
    if (data.type === "answer") {
      const room = Object.values(rooms).find(r => r.players.includes(ws));
      const q = questions[room.currentQuestion];

      if (data.answer.toLowerCase() === q.a.toLowerCase()) {
        const other = room.players.find(p => p !== ws);
        room.hp[other] -= 25;
        console.log(`Player: ${room.players.indexOf(ws) + 1} answered correctly. Opponent HP: ${room.hp[other]}`);

        if (room.hp[other] <= 0) {
          ws.send(JSON.stringify({ type: "result", msg: "You win!" }));
          other.send(JSON.stringify({ type: "result", msg: "You lose!" }));
          delete rooms[room.id];
          return;
        }

        // Next question
        room.currentQuestion = (room.currentQuestion + 1) % questions.length;
        const nextQ = questions[room.currentQuestion];
        room.players.forEach(p =>
          p.send(JSON.stringify({ type: "update", hp: room.hp[p], question: nextQ.q }))
        );
      }
    }
  });
});
