let ws, playerId, canAnswer = false;
let lastYourHp = 100, lastEnemyHp = 100;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("joinBtn").onclick = joinGame;
  document.getElementById("submitBtn").onclick = sendAnswer;
});

function joinGame() {
  const lang = document.getElementById("lang").value;
  const character = document.getElementById("character").value;

  ws = new WebSocket("ws://localhost:8070");
  ws.onopen = () => ws.send(JSON.stringify({ type: "join", language: lang, character }));
  ws.onmessage = handleMessage;

  document.getElementById("language-select").style.display = "none";
  document.getElementById("game").style.display = "block";
}

function handleMessage(e) {
  const data = JSON.parse(e.data);

  if (data.type === "waiting") {
    document.getElementById("question").textContent = data.msg;
  }

  if (data.type === "question") {
    document.getElementById("question").textContent = data.question;
    canAnswer = true;
    startTimer(data.time);

    if (!playerId) playerId = data.playerId;

    const yourChar = data.yourCharacter === "elprimo" ? "el_primo" : "mario";
    const enemyChar = data.enemyCharacter === "elprimo" ? "el_primo" : "mario";

    document.getElementById("leftMario").src = `${yourChar}_standing.png`;
    document.getElementById("rightMario").src = `${enemyChar}_standing.png`;

    window.characterImages = {
      you: { normal: `${yourChar}_standing.png`, attack: `${yourChar}_attack.png` },
      enemy: { normal: `${enemyChar}_standing.png`, attack: `${enemyChar}_attack.png` }
    };

    updateHpBars(data.yourHp, data.enemyHp);
  }

  if (data.type === "updateHp") {
    updateHpBars(data.yourHp, data.enemyHp);
  }

  if (data.type === "end") {
    document.getElementById("question").textContent = data.msg;
  }
}

function sendAnswer() {
  if (!canAnswer) return;
  const answer = document.getElementById("answer").value.trim();
  if (!answer) return;
  ws.send(JSON.stringify({ type: "answer", answer }));
  document.getElementById("answer").value = "";
  canAnswer = false;
}

function startTimer(seconds) {
  const timerEl = document.getElementById("timer");
  let time = seconds;
  timerEl.textContent = `Time left: ${time}s`;

  const interval = setInterval(() => {
    time--;
    timerEl.textContent = `Time left: ${time}s`;
    if (time <= 0) clearInterval(interval);
  }, 1000);
}

function updateHpBars(yourHp, enemyHp) {
  const yourBar = document.getElementById("yourHpFill");
  const enemyBar = document.getElementById("enemyHpFill");

  yourBar.style.width = `${yourHp}%`;
  enemyBar.style.width = `${enemyHp}%`;

  yourBar.style.background = yourHp > 50 ? "limegreen" : yourHp > 25 ? "orange" : "red";
  enemyBar.style.background = enemyHp > 50 ? "limegreen" : enemyHp > 25 ? "orange" : "red";

  // ✅ Animate attacks
  if (yourHp < lastYourHp) {
    // You got hit
    triggerAttack("rightMario", "leftMario", window.characterImages.enemy.attack, window.characterImages.enemy.normal);
  }
  if (enemyHp < lastEnemyHp) {
    // Enemy got hit
    triggerAttack("leftMario", "rightMario", window.characterImages.you.attack, window.characterImages.you.normal);
  }

  lastYourHp = yourHp;
  lastEnemyHp = enemyHp;
}

function triggerAttack(attackerId, defenderId, attackImg, normalImg) {
  const attacker = document.getElementById(attackerId);
  const defender = document.getElementById(defenderId);

  // Switch to attack image and animate
  attacker.src = attackImg;
  attacker.classList.add(attackerId === "leftMario" ? "attack-left" : "attack-right");

  // Defender flash
  defender.classList.add("hit");

  // Reset after short delay
  setTimeout(() => {
    attacker.src = normalImg;
    attacker.classList.remove("attack-left", "attack-right");
    defender.classList.remove("hit");
  }, 600);
}
