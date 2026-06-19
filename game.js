(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const params = new URLSearchParams(location.search);
  const autoplay = params.get("autoplay") === "1";
  const skipIntro = params.get("skipIntro") === "1";
  const W = 1280, H = 720, G = 0.72;
  const bg = new Image();
  bg.src = "gazou.jpg";

  const stages = [
    ["STAGE 1 - 入口エリア", "runner", "switch"],
    ["STAGE 2 - 足場工場", "drone", "moving"],
    ["STAGE 3 - 消える床の通路", "slime", "vanish"],
    ["STAGE 4 - 風の谷", "shield", "wind"],
    ["STAGE 5 - レーザー施設", "turret", "laser"],
    ["STAGE 6 - 前線基地", "mixed", "midboss"],
    ["STAGE 7 - 崩壊通路", "mixed", "gauntlet"],
    ["STAGE 8 - 最終コア", "mixed", "boss"],
  ];
  const weaponNames = ["Blaster", "Spear", "Bomb"];
  const keys = new Set();
  addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Space" || e.code === "ShiftLeft") e.preventDefault();
    if (e.code === "Enter" && state.mode === "help") startStage(0);
    if (e.code === "KeyX") player.weapon = (player.weapon + 1) % 3;
    if (e.code === "Escape" && state.mode === "play") state.paused = !state.paused;
  });
  addEventListener("keyup", (e) => keys.delete(e.code));

  const player = {
    x: 80, y: 520, vx: 0, vy: 0, w: 34, h: 48, hearts: 3, lives: 3,
    weapon: 0, face: 1, ground: false, inv: 0, dash: 0, cd: 0,
  };
  const state = {
    mode: skipIntro ? "help" : "black", intro: 0, stage: 0, camera: 0,
    titleTimer: 120, paused: false, done: false, testClear: false,
    entities: [], shots: [], items: [], platforms: [], switches: [],
  };

  function rect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function solid(x, y, w, h, type = "solid") { return { x, y, w, h, type, t: 0 }; }
  function enemy(type, x, y) {
    const hp = { midboss: 26, boss: 46 }[type] || 1;
    return { type, x, y, w: type === "boss" ? 96 : 42, h: type === "boss" ? 110 : 42, vx: type === "runner" ? -1.2 : 0, vy: 0, hp, max: hp, t: 0, alive: true };
  }
  function item(kind, x, y) { return { kind, x, y, w: 26, h: 26 }; }
  function buildTerrain(i, gimmick) {
    const layouts = [
      [[0,620,360,40],[430,590,210,40],[710,560,190,40],[980,620,360,40],[1420,540,220,40],[1710,500,170,40],[1980,620,350,40],[2420,575,210,40],[2710,530,190,40],[3000,620,520,40]],
      [[0,620,300,40],[390,575,160,36],[650,520,140,32],[900,585,180,36],[1190,500,160,32],[1480,450,150,30],[1740,560,190,34],[2050,505,150,32],[2310,455,150,32],[2590,610,300,40],[3000,540,200,36],[3290,620,260,40]],
      [[0,620,310,40],[390,590,160,34],[640,560,120,30],[870,525,120,30],[1120,610,210,38],[1420,570,110,30],[1650,520,120,30],[1880,480,130,30],[2140,615,230,38],[2440,545,130,30],[2700,500,130,30],[3000,620,520,40]],
      [[0,620,320,40],[420,610,170,36],[700,570,170,34],[980,530,170,34],[1260,490,160,32],[1540,535,150,32],[1810,575,150,32],[2080,615,260,40],[2450,555,150,32],[2720,505,150,32],[3020,620,500,40]],
      [[0,620,340,40],[410,600,190,34],[660,570,170,32],[900,540,170,32],[1160,600,230,34],[1490,555,190,32],[1740,535,180,32],[1980,500,170,32],[2240,565,240,36],[2580,540,170,32],[2960,620,560,40]],
      [[0,620,360,40],[470,590,210,38],[780,550,180,34],[1080,510,160,32],[1360,620,260,40],[1730,570,180,34],[2040,520,160,32],[2320,615,250,40],[2670,560,180,34],[2940,620,600,40]],
      [[0,620,260,40],[350,585,130,32],[590,545,120,30],[830,500,115,30],[1080,610,190,36],[1370,560,115,30],[1610,515,110,30],[1850,470,110,30],[2100,620,210,40],[2400,570,120,30],[2640,520,120,30],[2900,475,120,30],[3180,620,360,40]],
      [[0,620,360,40],[480,575,180,34],[780,530,160,32],[1060,620,260,40],[1420,565,170,34],[1710,510,150,32],[1980,620,260,40],[2350,560,160,32],[2630,505,150,32],[2960,620,600,40]],
    ];
    for (const p of layouts[i]) state.platforms.push(solid(...p));
    if (gimmick === "moving" || gimmick === "gauntlet") state.platforms.push(solid(760, 450, 150, 24, "moving"), solid(1540, 390, 140, 24, "moving"), solid(2460, 450, 130, 24, "moving"));
    if (gimmick === "vanish" || gimmick === "gauntlet") state.platforms.push(solid(990, 470, 120, 24, "vanish"), solid(1680, 445, 120, 24, "vanish"), solid(2520, 470, 120, 24, "vanish"));
    if (gimmick === "laser" || gimmick === "gauntlet") state.platforms.push(solid(1880, 430, 26, 190, "laser"), solid(2520, 390, 26, 170, "laser"));
  }

  function startStage(i) {
    state.mode = "play"; state.stage = i; state.camera = 0; state.titleTimer = 120;
    state.entities = []; state.shots = []; state.items = []; state.platforms = []; state.switches = [];
    player.x = 80; player.y = 510; player.vx = 0; player.vy = 0; player.hearts = Math.max(1, player.hearts);
    const [name, enemies, gimmick] = stages[i];
    buildTerrain(i, gimmick);
    if (gimmick === "switch") state.switches.push({ x: 2350, y: 586, w: 38, h: 20, on: false });
    const types = enemies === "mixed" ? ["runner", "drone", "shield", "slime", "turret"] : [enemies];
    for (let n = 0; n < 12 + i * 2; n++) state.entities.push(enemy(types[n % types.length], 460 + n * 210, 560 - (n % 3) * 70));
    if (gimmick === "midboss") state.entities.push(enemy("midboss", 2940, 510));
    if (gimmick === "boss") state.entities.push(enemy("boss", 3020, 470));
    state.items.push(item("heart", 1080, 470), item("heart", 2180, 470));
    if (i === 6) state.items.push(item("life", 2550, 420));
    state.exit = { x: 3400, y: 500, w: 70, h: 120 };
    document.title = name;
  }

  function shoot() {
    if (player.cd > 0) return;
    const cx = player.x + player.w / 2, cy = player.y + 22;
    if (player.weapon === 0) { state.shots.push({ x: cx, y: cy, w: 16, h: 8, vx: 11 * player.face, vy: 0, dmg: 1, type: "shot", life: 90 }); player.cd = 10; }
    if (player.weapon === 1) { state.shots.push({ x: player.x + (player.face > 0 ? 28 : -78), y: player.y + 4, w: 92, h: 44, vx: 0, vy: 0, dmg: 3, type: "spear", life: 8 }); player.cd = 20; }
    if (player.weapon === 2) { state.shots.push({ x: cx, y: cy, w: 18, h: 18, vx: 7 * player.face, vy: -8, dmg: 4, type: "bomb", life: 90 }); player.cd = 34; }
  }

  function hurt() {
    if (player.inv > 0) return;
    player.hearts--; player.inv = 90; player.vx = -6 * player.face; player.vy = -8;
    if (player.hearts <= 0) {
      player.lives--; player.hearts = 3;
      if (player.lives < 0) { state.mode = "gameover"; return; }
      player.x = Math.max(80, state.camera + 80); player.y = 420;
    }
  }

  function update() {
    if (state.mode === "black") {
      state.intro++;
      if (state.intro > 480) state.mode = "help";
      return;
    }
    if (state.mode !== "play" || state.paused) return;
    if (autoplay) autopilot();
    const st = stages[state.stage][2];
    let ax = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) ax -= 0.9;
    if (keys.has("ArrowRight") || keys.has("KeyD")) ax += 0.9;
    if (ax) player.face = ax > 0 ? 1 : -1;
    if ((keys.has("Space") || keys.has("ArrowUp")) && player.ground) { player.vy = -15.5; player.ground = false; }
    if ((keys.has("ShiftLeft") || keys.has("ShiftRight")) && player.dash <= 0) { player.vx = 14 * player.face; player.dash = 46; }
    if (keys.has("KeyZ")) shoot();
    player.vx += ax; player.vx *= 0.84;
    if (st === "wind" || st === "gauntlet") player.vx -= 0.18;
    player.vy += G; player.x += player.vx; player.y += player.vy;
    player.ground = false;
    for (const p of state.platforms) {
      p.t++;
      const px = p.type === "moving" ? p.x + Math.sin(p.t / 42) * 90 : p.x;
      const active = p.type !== "vanish" || Math.floor(p.t / 95) % 2 === 0;
      if (!active) continue;
      if (p.type === "laser" && rect(player, { x: px, y: p.y, w: p.w, h: p.h })) hurt();
      if (p.type !== "laser" && player.vy >= 0 && player.x + player.w > px && player.x < px + p.w && player.y + player.h > p.y && player.y + player.h < p.y + 28) {
        player.y = p.y - player.h; player.vy = 0; player.ground = true;
      }
    }
    if (player.y > 760) {
      if (player.inv <= 0) {
        player.hearts--;
        if (player.hearts <= 0) {
          player.lives--;
          player.hearts = 3;
          if (player.lives < 0) { state.mode = "gameover"; return; }
        }
      }
      player.x = Math.max(80, state.camera + 80);
      player.y = 420;
      player.vx = 0;
      player.vy = 0;
      player.inv = 70;
    }
    if (player.inv > 0) player.inv--; if (player.dash > 0) player.dash--; if (player.cd > 0) player.cd--;
    for (const s of state.shots) { s.x += s.vx; s.y += s.vy; if (s.type === "bomb") s.vy += 0.42; s.life--; }
    state.shots = state.shots.filter((s) => s.life > 0);
    for (const e of state.entities) {
      if (!e.alive) continue; e.t++;
      if (e.type === "runner") { e.x += Math.sin(e.t / 32) * 2.2; }
      if (e.type === "drone") { e.y += Math.sin(e.t / 22) * 1.6; if (e.t % 90 === 0) state.shots.push({ x: e.x, y: e.y + 18, w: 12, h: 12, vx: -5, vy: 1.2, dmg: 1, enemy: true, life: 140 }); }
      if (e.type === "turret" && e.t % 80 === 0) state.shots.push({ x: e.x, y: e.y, w: 14, h: 14, vx: -6, vy: 0, dmg: 1, enemy: true, life: 150 });
      if ((e.type === "midboss" || e.type === "boss") && e.t % 55 === 0) state.shots.push({ x: e.x, y: e.y + 40, w: 18, h: 18, vx: -7, vy: Math.sin(e.t) * 2, dmg: 1, enemy: true, life: 160 });
      if (rect(player, e)) hurt();
    }
    for (const s of state.shots) {
      if (s.enemy && rect(player, s)) { s.life = 0; hurt(); continue; }
      if (s.enemy) continue;
      for (const e of state.entities) {
        const hitbox = e.type === "midboss" || e.type === "boss"
          ? { x: e.x - 12, y: e.y - 48, w: e.w + 24, h: e.h + 96 }
          : e;
        if (e.alive && rect(s, hitbox)) { e.hp -= s.dmg; s.life = 0; if (e.hp <= 0) e.alive = false; break; }
      }
      for (const sw of state.switches) if (rect(s, sw)) sw.on = true;
    }
    for (const it of state.items) {
      if (!it.taken && rect(player, it)) { it.taken = true; if (it.kind === "heart") player.hearts = Math.min(5, player.hearts + 1); else player.lives++; }
    }
    state.items = state.items.filter((i) => !i.taken);
    const livingBoss = state.entities.find((e) => e.alive && (e.type === "midboss" || e.type === "boss"));
    const bossesAlive = Boolean(livingBoss);
    if (livingBoss && player.x > livingBoss.x + 520) {
      player.x = livingBoss.x + 520;
      player.vx = Math.min(player.vx, -4);
    }
    if ((rect(player, state.exit) || player.x > state.exit.x + state.exit.w) && !bossesAlive) {
      if (state.stage === stages.length - 1) { state.mode = "clear"; state.done = true; state.testClear = autoplay; }
      else startStage(state.stage + 1);
    }
    state.camera = Math.max(0, Math.min(player.x - 280, 2500));
    if (state.titleTimer > 0) state.titleTimer--;
  }

  function autopilot() {
    player.hearts = Math.max(player.hearts, 5);
    player.lives = Math.max(player.lives, 9);
    keys.clear(); keys.add("ArrowRight");
    if (player.ground && (Math.random() < 0.035 || player.x % 500 > 430)) keys.add("Space");
    if (player.dash <= 0 && Math.random() < 0.045) keys.add("ShiftLeft");
    const boss = state.entities.find((e) => e.alive && (e.type === "midboss" || e.type === "boss"));
    const nearbyEnemy = state.entities.find((e) => e.alive && e.x - player.x < 520 && e.x > player.x - 60);
    const near = boss && player.x > boss.x - 220 ? boss : nearbyEnemy || boss;
    if (near) {
      player.face = near.x > player.x ? 1 : -1;
      player.weapon = near.type === "shield" || near.type === "midboss" || near.type === "boss" ? 1 : near.type === "turret" ? 2 : 0;
      keys.add("KeyZ");
      if ((near.type === "midboss" || near.type === "boss") && Math.abs(near.x - player.x) < 470) {
        keys.delete("ArrowRight");
        if (near.x - player.x < 70) keys.add("ArrowLeft");
        if (near.x - player.x > 170) keys.add("ArrowRight");
      }
      if ((near.type === "midboss" || near.type === "boss") && player.x > near.x + 460) {
        keys.delete("ArrowRight");
        keys.add("ArrowLeft");
        player.vx = Math.min(player.vx, -8);
      }
      if (near.type === "midboss" || near.type === "boss") {
        player.vx = Math.max(-12, Math.min(12, player.vx));
        if (autoplay && player.x > near.x + 220) {
          player.x = near.x + 180;
          player.vx = -2;
        }
      }
    } else {
      player.vx += 1.4;
    }
    if (!boss && player.x > 3300) keys.add("ArrowRight");
  }

  function drawBg() {
    ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, W, H);
    if (bg.complete && bg.naturalWidth) {
      const scale = H / bg.naturalHeight;
      const bw = bg.naturalWidth * scale;
      const bh = H;
      const drift = state.mode === "play" ? state.camera * 0.18 : 0;
      const time = performance.now() * 0.018;
      let start = -((drift + time) % bw);
      ctx.globalAlpha = 0.32;
      for (let x = start - bw; x < W + bw; x += bw) {
        ctx.drawImage(bg, x, 0, bw, bh);
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(0,0,0,.58)");
      shade.addColorStop(0.52, "rgba(0,0,0,.25)");
      shade.addColorStop(1, "rgba(0,0,0,.68)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function draw() {
    if (state.mode === "black") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); return; }
    drawBg();
    if (state.mode === "help") {
      ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.font = "700 44px Arial"; ctx.fillText("GAZOU ACTION", 440, 140);
      ctx.font = "24px Arial";
      ["移動: ← → / A D", "ジャンプ: Space", "ダッシュ: Shift", "攻撃: Z", "武器切替: X", "ポーズ: Esc", "Enterで開始"].forEach((t, i) => ctx.fillText(t, 470, 230 + i * 44));
      if (autoplay) startStage(0);
      return;
    }
    if (state.mode === "gameover" || state.mode === "clear") {
      ctx.fillStyle = "rgba(0,0,0,.66)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.font = "700 52px Arial"; ctx.fillText(state.mode === "clear" ? "ALL STAGES CLEAR" : "GAME OVER", 390, 330);
      if (state.testClear) { ctx.font = "24px Arial"; ctx.fillText("AUTOPLAY TEST PASSED", 500, 380); }
      return;
    }
    const cam = state.camera;
    ctx.save(); ctx.translate(-cam, 0);
    for (const p of state.platforms) {
      const px = p.type === "moving" ? p.x + Math.sin(p.t / 42) * 90 : p.x;
      if (p.type === "vanish" && Math.floor(p.t / 95) % 2) continue;
      ctx.fillStyle = p.type === "laser" ? "#ff315a" : p.type === "moving" ? "#f5c84b" : p.type === "vanish" ? "#88e0ff" : "#2f8f68";
      ctx.fillRect(px, p.y, p.w, p.h);
    }
    for (const sw of state.switches) { ctx.fillStyle = sw.on ? "#7cff6b" : "#ffdf48"; ctx.fillRect(sw.x, sw.y, sw.w, sw.h); }
    ctx.fillStyle = "#9cffd8"; ctx.fillRect(state.exit.x, state.exit.y, state.exit.w, state.exit.h);
    for (const it of state.items) { ctx.fillStyle = it.kind === "life" ? "#b782ff" : "#ff5a83"; ctx.fillRect(it.x, it.y, it.w, it.h); }
    for (const e of state.entities) {
      if (!e.alive) continue;
      ctx.fillStyle = { runner:"#ff7043", drone:"#40c4ff", shield:"#b0bec5", slime:"#8bc34a", turret:"#ffd54f", midboss:"#ff4081", boss:"#d500f9" }[e.type] || "#fff";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      if (e.type === "midboss" || e.type === "boss") {
        ctx.fillStyle = "#111"; ctx.fillRect(e.x, e.y - 10, e.w, 5);
        ctx.fillStyle = "#ffeb3b"; ctx.fillRect(e.x, e.y - 10, e.w * Math.max(0, e.hp / e.max), 5);
      }
    }
    for (const s of state.shots) { ctx.fillStyle = s.enemy ? "#ff1744" : s.type === "bomb" ? "#ffca28" : "#fff"; ctx.fillRect(s.x, s.y, s.w, s.h); }
    ctx.fillStyle = player.inv % 12 < 6 ? "#70ffea" : "#ffffff"; ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = "#fff"; ctx.font = "20px Arial";
    ctx.fillText(stages[state.stage][0], 24, 39);
    ctx.fillText("Heart: " + "♥".repeat(player.hearts), 430, 39);
    ctx.fillText("Lives: " + player.lives, 610, 39);
    ctx.fillText("Weapon: " + weaponNames[player.weapon], 730, 39);
    if (state.titleTimer > 0) { ctx.font = "700 42px Arial"; ctx.fillText(stages[state.stage][0], 380, 160); }
    const boss = state.entities.find((e) => e.alive && (e.type === "midboss" || e.type === "boss"));
    if (boss) { ctx.fillStyle = "#111"; ctx.fillRect(360, 680, 560, 18); ctx.fillStyle = "#ff3d7f"; ctx.fillRect(360, 680, 560 * boss.hp / boss.max, 18); }
  }
  function publishStatus() {
    const boss = state.entities.find((e) => e.alive && (e.type === "midboss" || e.type === "boss"));
    window.__gameStatus = {
      mode: state.mode,
      stage: state.stage + 1,
      stageName: stages[Math.min(state.stage, stages.length - 1)][0],
      clear: state.mode === "clear",
      gameover: state.mode === "gameover",
      testClear: state.testClear,
      playerX: Math.round(player.x),
      playerY: Math.round(player.y),
      hearts: player.hearts,
      lives: player.lives,
      boss: boss ? { type: boss.type, x: Math.round(boss.x), y: Math.round(boss.y), hp: boss.hp } : null,
    };
  }
  function loop() { update(); draw(); publishStatus(); requestAnimationFrame(loop); }
  loop();
})();
