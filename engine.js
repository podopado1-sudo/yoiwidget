/* cute-widgets character engine
 * 픽셀 캐릭터 렌더링 + 애니메이션 상태머신.
 * 모든 위젯이 이 엔진을 공유한다. URL 파라미터로 커스터마이징:
 *   c  = 몸통 색 (hex, # 없이)  예: c=f5d7a8
 *   bg = 배경 색 (hex 또는 "transparent")
 */

const SPRITE_W = 16, SPRITE_H = 16;

// 팔레트 인덱스: . 투명 / 1 몸통 / 2 외곽선 / 3 핑크(귀·코) / 4 눈
const FRAMES = {
  idle1: [
    "................",
    "..2....2........",
    ".212..212.......",
    ".21122112.......",
    ".21111112.......",
    ".21411412.......",
    ".21131112.......",
    "..211122........",
    "..2111122.......",
    ".211111112..2...",
    ".211111112.212..",
    ".211111112.212..",
    ".2111111112112..",
    ".2111111112112..",
    "..22222222222...",
    "................"
  ],
  idle2: [ // 꼬리 흔들기
    "................",
    "..2....2........",
    ".212..212.......",
    ".21122112.......",
    ".21111112.......",
    ".21411412.......",
    ".21131112.......",
    "..211122........",
    "..2111122...2...",
    ".211111112.212..",
    ".211111112.212..",
    ".2111111121122..",
    ".2111111112112..",
    ".2111111112212..",
    "..22222222222...",
    "................"
  ],
  blink: [
    "................",
    "..2....2........",
    ".212..212.......",
    ".21122112.......",
    ".21111112.......",
    ".21211212.......",
    ".21131112.......",
    "..211122........",
    "..2111122.......",
    ".211111112..2...",
    ".211111112.212..",
    ".211111112.212..",
    ".2111111112112..",
    ".2111111112112..",
    "..22222222222...",
    "................"
  ],
  sleep1: [
    "................",
    "................",
    "................",
    "..2....2........",
    ".212..212.......",
    ".21122112.......",
    ".21111112.......",
    ".21221222.......",
    "..2111122.......",
    ".211111112..2...",
    ".211111112.212..",
    ".211111112.212..",
    ".2111111112112..",
    ".2111111112112..",
    "..22222222222...",
    "................"
  ],
  sleep2: [
    "................",
    "................",
    "................",
    "..2....2........",
    ".212..212.......",
    ".21122112.......",
    ".21111112.......",
    ".21221222.......",
    "..2111122...2...",
    ".211111112.212..",
    ".211111112.212..",
    ".2111111121122..",
    ".2111111112112..",
    ".2111111112212..",
    "..22222222222...",
    "................"
  ],
  happy: [ // ^^ 눈
    "................",
    "..2....2........",
    ".212..212.......",
    ".21122112.......",
    ".21211212.......",
    ".22121122.......",
    ".21131112.......",
    "..211122........",
    "..2111122.......",
    ".211111112..2...",
    ".211111112.212..",
    ".211111112.212..",
    ".2111111112112..",
    ".2111111112112..",
    "..22222222222...",
    "................"
  ]
};

function qs(name, fallback) {
  const v = new URLSearchParams(location.search).get(name);
  return v === null || v === "" ? fallback : v;
}

function hexParam(name, fallback) {
  const v = qs(name, null);
  return v && /^[0-9a-fA-F]{3,8}$/.test(v) ? "#" + v : fallback;
}

class Pet {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.scale = opts.scale || 8;
    canvas.width = SPRITE_W * this.scale;
    canvas.height = (SPRITE_H + 3) * this.scale; // 위 3칸은 하트/Zzz 이펙트용
    this.palette = {
      "1": hexParam("c", opts.body || "#f5d7a8"),
      "2": "#5b4636",
      "3": "#f2a6b8",
      "4": "#3a2f28"
    };
    this.state = "idle";        // idle | sleep | happy
    this.frame = 0;
    this.tick = 0;
    this.lastInteract = Date.now();
    this.sleepAfterMs = opts.sleepAfterMs ?? 45000;
    this.effects = [];          // {ch, x, y, life}

    canvas.style.cursor = "pointer";
    canvas.addEventListener("pointerdown", () => this.poke());
    this.timer = setInterval(() => this.step(), 250);
  }

  poke() {
    this.lastInteract = Date.now();
    this.setState("happy");
    this.effects.push({ ch: "♥", x: 4 + Math.random() * 8, y: 3, life: 6 });
    this.happyUntil = Date.now() + 1500;
  }

  setState(s) { if (this.state !== s) { this.state = s; this.tick = 0; } }

  forceSleep(on) { this.forcedSleep = on; }

  step() {
    this.tick++;
    const idleFor = Date.now() - this.lastInteract;
    if (this.forcedSleep) this.setState("sleep");
    else if (this.state === "happy" && Date.now() > this.happyUntil) this.setState("idle");
    else if (this.state === "idle" && idleFor > this.sleepAfterMs) this.setState("sleep");

    if (this.state === "sleep" && this.tick % 8 === 0)
      this.effects.push({ ch: "z", x: 10, y: 3, life: 8 });

    this.effects.forEach(e => { e.y -= 0.3; e.life--; });
    this.effects = this.effects.filter(e => e.life > 0);
    this.draw();
  }

  currentFrame() {
    if (this.state === "sleep") return this.tick % 8 < 4 ? FRAMES.sleep1 : FRAMES.sleep2;
    if (this.state === "happy") return FRAMES.happy;
    if (this.tick % 16 === 15) return FRAMES.blink;
    return this.tick % 8 < 4 ? FRAMES.idle1 : FRAMES.idle2;
  }

  draw() {
    const { ctx, scale } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const rows = this.currentFrame();
    const offY = 3; // 이펙트 공간
    for (let y = 0; y < SPRITE_H; y++)
      for (let x = 0; x < SPRITE_W; x++) {
        const c = this.palette[rows[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, (y + offY) * scale, scale, scale);
      }
    ctx.font = `${scale * 1.6}px monospace`;
    ctx.fillStyle = this.state === "happy" ? "#e5738f" : "#8fa3b8";
    this.effects.forEach(e => ctx.fillText(e.ch, e.x * scale, e.y * scale));
  }
}

// 공통 페이지 셋업: 배경 및 다크모드 대응
function setupPage() {
  const bg = qs("bg", "transparent");
  if (bg !== "transparent" && /^[0-9a-fA-F]{3,8}$/.test(bg))
    document.body.style.background = "#" + bg;
}

export { Pet, qs, hexParam, setupPage };
