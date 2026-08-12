/* 요이위젯 character engine
 * 픽셀 캐릭터 렌더링 + 애니메이션 상태머신. 모든 위젯이 이 엔진을 공유한다.
 * URL 파라미터:
 *   c     = 몸통 색 (hex, # 없이)          예: c=f5d7a8
 *   bg    = 배경 색 (hex 또는 생략=투명)
 *   s     = 픽셀 스케일 (1~24, 생략=자동)
 *   theme = light | dark (생략=OS 설정 따름 — 노션 인앱 테마는 감지 불가라 명시 지정용)
 */

const SPRITE_W = 16, SPRITE_H = 16;
const HEXRE = /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// 팔레트 인덱스: . 투명 / 1 몸통 / 2 외곽선 / 3 핑크(귀 안·코) / 4 눈 / 5 볼터치
const FRAMES = {
  idle1: [
    "................",
    "..2....2........",
    ".232..232.......",
    ".21122112.......",
    ".21111112.......",
    ".21411412.......",
    ".25131152.......",
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
    ".232..232.......",
    ".21122112.......",
    ".21111112.......",
    ".21411412.......",
    ".25131152.......",
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
    ".232..232.......",
    ".21122112.......",
    ".21111112.......",
    ".21211212.......",
    ".25131152.......",
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
    ".232..232.......",
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
    ".232..232.......",
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
    ".232..232.......",
    ".21122112.......",
    ".21211212.......",
    ".22122122.......",
    ".25131152.......",
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

// 이펙트도 픽셀 스프라이트로 — 벡터 글리프는 픽셀 감성을 깨트린다
const FX = {
  heart: [".1.1.", "11111", ".111.", "..1.."],
  z: ["111", ".1.", "111"]
};
const FX_COLOR = { heart: "#e5738f", z: "#8fa3b8" };

function qs(name, fallback) {
  const v = new URLSearchParams(location.search).get(name);
  return v === null || v === "" ? fallback : v;
}

function hexParam(name, fallback) {
  const v = qs(name, null);
  return v && HEXRE.test(v) ? "#" + v : fallback;
}

// theme 파라미터 > OS 설정. 노션 임베드에서는 OS와 노션 테마가 어긋날 수 있어 명시 지정이 필요하다.
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// s 파라미터(1~24)가 있으면 고정, 없으면 뷰포트 기준 자동.
// reserve = 캐릭터 아래 텍스트/버튼이 차지하는 높이(px)
function computeScale(reserve = 0, min = 2, max = 10) {
  const s = Math.floor(Number(qs("s", 0)));
  if (s >= 1 && s <= 24) return s;
  return Math.max(min, Math.min(max, Math.floor(Math.min(innerWidth, innerHeight - reserve) / 22)));
}

class Pet {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const dark = effectiveTheme() === "dark";
    this.palette = {
      "1": hexParam("c", opts.body || "#f5d7a8"),
      "2": dark ? "#8a7460" : "#5b4636", // 다크 페이지에서 실루엣이 녹지 않게
      "3": "#f2a6b8",
      "4": "#3a2f28",
      "5": "#f8c9d4"
    };
    this.state = "idle";        // idle | sleep | happy
    this.tick = 0;
    this.lastInteract = Date.now();
    this.sleepAfterMs = opts.sleepAfterMs ?? 45000;
    this.effects = [];          // {kind, x, y, life}
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.setScale(opts.scale || 8);
    canvas.style.cursor = "pointer";
    canvas.style.transition = "transform .12s ease-out";
    canvas.style.transformOrigin = "50% 100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "픽셀 고양이");
    canvas.addEventListener("pointerdown", () => this.poke());
    this.timer = setInterval(() => this.step(), this.reduced ? 1000 : 250);
  }

  setScale(s) {
    if (s === this.scale) return;
    this.scale = s;
    this.canvas.width = SPRITE_W * s;
    this.canvas.height = (SPRITE_H + 3) * s; // 위 3칸은 하트/Zzz 이펙트용
    this.ctx.imageSmoothingEnabled = false;  // canvas.width 변경이 컨텍스트를 리셋함
    this.draw();
  }

  poke() {
    this.lastInteract = Date.now();
    this.setState("happy");
    this.effects.push({ kind: "heart", x: 4 + Math.random() * 8, y: 2.5, life: 6 });
    this.happyUntil = Date.now() + 1500;
    if (!this.reduced) {
      this.canvas.style.transform = "scaleX(1.07) scaleY(.9)";
      setTimeout(() => { this.canvas.style.transform = ""; }, 120);
    }
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
      this.effects.push({ kind: "z", x: 9 + Math.random() * 3, y: 2.5, life: 8 });

    this.effects.forEach(e => { if (!this.reduced) e.y -= 0.3; e.life--; });
    this.effects = this.effects.filter(e => e.life > 0);
    this.draw();
  }

  currentFrame() {
    if (this.reduced)
      return this.state === "sleep" ? FRAMES.sleep1 : this.state === "happy" ? FRAMES.happy : FRAMES.idle1;
    if (this.state === "sleep") return this.tick % 8 < 4 ? FRAMES.sleep1 : FRAMES.sleep2;
    if (this.state === "happy") return FRAMES.happy;
    if (this.tick % 16 === 15) return FRAMES.blink;
    return this.tick % 4 < 2 ? FRAMES.idle1 : FRAMES.idle2;
  }

  draw() {
    const { ctx, scale } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const rows = this.currentFrame();
    const offY = 3;
    for (let y = 0; y < SPRITE_H; y++)
      for (let x = 0; x < SPRITE_W; x++) {
        const c = this.palette[rows[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, (y + offY) * scale, scale, scale);
      }
    // 이펙트: 절반 스케일 픽셀 스프라이트, 그리드 스냅
    const s2 = Math.max(1, Math.round(scale / 2));
    this.effects.forEach(e => {
      ctx.fillStyle = FX_COLOR[e.kind];
      FX[e.kind].forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++)
          if (row[dx] === "1")
            ctx.fillRect(Math.round(e.x * scale) + dx * s2, Math.round(e.y * scale) + dy * s2, s2, s2);
      });
    });
  }
}

// 공통 페이지 셋업: 테마/배경 처리. Pet 생성 전에 호출할 것 (팔레트가 테마를 읽는다).
function setupPage() {
  const theme = qs("theme", "");
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  const bg = qs("bg", "");
  if (bg && HEXRE.test(bg)) document.body.style.background = "#" + bg;
}

export { Pet, FRAMES, qs, hexParam, computeScale, effectiveTheme, setupPage };
