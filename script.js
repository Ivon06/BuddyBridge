let ws;
let playerId;
let canAnswer = false;
let timerInterval;
let lastYourHp = 100;
let lastEnemyHp = 100;

function joinGame() {
  const lang = document.getElementById("lang").value;
  ws = new WebSocket("ws://localhost:8070");
  ws.onopen = () => ws.send(JSON.stringify({ type: "join", language: lang }));
  ws.onmessage = handleMessage;

  document.getElementById("language-select").style.display = "none";
  document.getElementById("game").style.display = "block";
}

function handleMessage(msg) {
  const data = JSON.parse(msg.data);

  if (data.type === "waiting") {
    document.getElementById("question").textContent = data.msg;
    return;
  }

  if (data.type === "question") {
    document.getElementById("question").textContent = data.question;
    canAnswer = true;
    startTimer(data.time);

    if (!playerId) playerId = data.playerId;

    updateHpBars(data.yourHp, data.enemyHp);
  } 
  else if (data.type === "result") {
    document.body.innerHTML = `<h1>${data.msg}</h1>`;
  }
}

function sendAnswer() {
  if (!canAnswer) return;
  const val = document.getElementById("answer").value.trim();
  if (!val) return;
  ws.send(JSON.stringify({ type: "answer", answer: val }));
  document.getElementById("answer").value = "";
  canAnswer = false;
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  let timeLeft = seconds;
  document.getElementById("timer").textContent = timeLeft;

  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      canAnswer = false;
    }
  }, 1000);
}

function updateHpBars(yourHp, enemyHp) {
  const yourBar = document.getElementById("yourHpFill");
  const enemyBar = document.getElementById("enemyHpFill");

  yourBar.style.width = `${yourHp}%`;
  enemyBar.style.width = `${enemyHp}%`;

  yourBar.style.background = yourHp > 50 ? "limegreen" : yourHp > 25 ? "orange" : "red";
  enemyBar.style.background = enemyHp > 50 ? "limegreen" : enemyHp > 25 ? "orange" : "red";

  if (yourHp < lastYourHp) {
    attack('rightMario', 'mario_fight_animation.png', 'mario_standing.png');
  }
  if (enemyHp < lastEnemyHp) {
    attack('leftMario', 'mario_fight_animation.png', 'mario_standing.png');
  }

  lastYourHp = yourHp;
  lastEnemyHp = enemyHp;
}

function attack(id, attackImg, normalImg) {
  const mario = document.getElementById(id);
  mario.src = attackImg;
  mario.style.transform += " translateY(-10px)";
  setTimeout(() => {
    mario.src = normalImg;
    mario.style.transform = mario.classList.contains("flipped")
      ? "scaleX(-1)"
      : "scaleX(1)";
  }, 1000);
}
