/* 요이위젯 character engine — 32×32 치즈 줄무늬 고양이 "요이" (+16×16 미니)
 * 픽셀 캐릭터 렌더링 + 애니메이션 상태머신. 모든 위젯이 이 엔진을 공유한다.
 * URL 파라미터:
 *   skin  = cheese | cream | gray | tux (기본 cheese)
 *   c     = 몸통 색 커스텀 (hex, # 없이) — 줄무늬는 자동으로 어두운 톤 파생
 *   px    = 16 이면 미니 16×16 스프라이트 (기본 32)
 *   bg    = 배경 색 (hex 또는 생략=투명)
 *   s     = 픽셀 스케일 1~12 (생략=자동)
 *   theme = light | dark (생략=OS 설정 따름 — 노션 인앱 테마는 감지 불가라 명시 지정용)
 */

const HEXRE = /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/* 팔레트 문자: O외곽선 B몸통 S줄무늬 W가슴·발 P핑크(귀·코·혀) L볼터치 E눈 H하이라이트 */
const SKINS = {
  cheese: { O: "7a4a28", B: "f5c37e", S: "e09b52", W: "fdf0dc", P: "f2a6b8", L: "f0a090", E: "3a2f28", H: "ffffff" },
  cream:  { O: "5b4636", B: "f5d7a8", S: "e8c58f", W: "fdf4e3", P: "f2a6b8", L: "f8c9d4", E: "3a2f28", H: "ffffff" },
  gray:   { O: "4f4a45", B: "c7c1ba", S: "a49d95", W: "f4f1ed", P: "f2a6b8", L: "e8b8c0", E: "33302c", H: "ffffff" },
  tux:    { O: "26262c", B: "45454e", S: "35353d", W: "f6f4f0", P: "f2a6b8", L: "d98a96", E: "d9a441", H: "ffffff" }
};

const BASE = [
  "................................",
  "......O..................O......",
  ".....OBO................OBO.....",
  ".....OPBO..............OBPO.....",
  "....OBPPBO............OBPPBO....",
  "....OBPPBO............OBPPBO....",
  "....OBBBBOOOOOOOOOOOOOOBBBBO....",
  "....OBBBBBBBBSBSSBSBBBBBBBBO....",
  "...OBBBBBBBBBSBSSBSBBBBBBBBBO...",
  "...OBBBBBBBBBBBSSBBBBBBBBBBBO...",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "..OBBBBEHEBBBBBBBBBBBBEHEBBBBO..",
  "..OBBBBEEEBBBBBBBBBBBBEEEBBBBO..",
  "OOOLLBBEEEBBBBBBBBBBBBEEEBBLLOOO",
  "..OLLBBBBBBBBBBPPBBBBBBBBBBLLO..",
  "OOOBBBBBBBBBBBOBBOBBBBBBBBBBBOOO",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "...OBBBBBBBBBBBBBBBBBBBBBBBBO...",
  "....OBBBBBBBBBBBBBBBBBBBBBBO....",
  "....OBBBBBBWWWWWWWWWWBBBBBBO....",
  "...OSSBBBBWWWWWWWWWWWWBBBBSSO...",
  "...OSBBBBBWWWWWWWWWWWWBBBBBSO...",
  "..OBBBBBBBWWWWWWWWWWWWBBBBBBBOO.",
  "..OBBBBBBBWWWWWWWWWWWWBBBBBBOBBO",
  "..OBBBBBBBWWWWWWWWWWWWBBBBBBOSSO",
  "..OBBBBBBBBWWWWWWWWWWBBBBBBBOBBO",
  "..OBBBBBBBBBBWWWWWWBBBBBBBBOBBO.",
  "..OBBBBBBBOWWWWWWWWWWOBBBBBOBO..",
  "...OOOOOOOOOOOOOOOOOOOOOOOOOO...",
  "................................",
  "................................",
  "................................"
];

// 프레임 = BASE + 픽셀 편집 [row, xStart, xEnd, char]
function variant(rows, edits) {
  const out = rows.map(r => [...r]);
  for (const [r, x1, x2, ch] of edits) for (let x = x1; x <= x2; x++) out[r][x] = ch;
  return out.map(a => a.join(""));
}

const CLOSED_EYES = [
  [11, 7, 9, "B"], [11, 22, 24, "B"],
  [13, 7, 9, "B"], [13, 22, 24, "B"]
];
const TAIL_UP = [
  [21, 29, 30, "O"],
  [22, 29, 30, "B"], [22, 31, 31, "O"],
  [26, 28, 31, "."],
  [27, 28, 29, "."]
];

const FRAMES = {
  idle1: BASE,
  idle2: variant(BASE, TAIL_UP),
  blink: variant(BASE, CLOSED_EYES),
  sleep1: variant(BASE, CLOSED_EYES),
  sleep2: variant(BASE, [...CLOSED_EYES, ...TAIL_UP]),
  happy: variant(BASE, [
    // ^^ 눈
    [11, 7, 9, "B"], [11, 8, 8, "E"], [12, 7, 9, "B"], [12, 7, 7, "E"], [12, 9, 9, "E"], [13, 7, 9, "B"],
    [11, 22, 24, "B"], [11, 23, 23, "E"], [12, 22, 24, "B"], [12, 22, 22, "E"], [12, 24, 24, "E"], [13, 22, 24, "B"],
    // 벌린 입 + 혀
    [15, 15, 16, "O"], [16, 15, 16, "P"]
  ])
};

/* 16×16 미니 요이 — ?px=16. 가슴털은 3-4-4-3 타원 */
const FRAMES16 = {
  idle1: [
    "................",
    "..O....O........",
    ".OPO..OPO.......",
    ".OBBOOBBO.......",
    ".OBBSSBBO.......",
    ".OBEBBEBO.......",
    ".OLBPBBLO.......",
    "..OBBBOO........",
    "..OBBBBOO.......",
    ".OBBBBBBBO..O...",
    ".OBBWWWBBO.OBO..",
    ".OBWWWWBBO.OSO..",
    ".OBWWWWBBBOBBO..",
    ".OBBWWWBBBOBBO..",
    "..OOOOOOOOOOO...",
    "................"
  ],
  idle2: [
    "................",
    "..O....O........",
    ".OPO..OPO.......",
    ".OBBOOBBO.......",
    ".OBBSSBBO.......",
    ".OBEBBEBO.......",
    ".OLBPBBLO.......",
    "..OBBBOO........",
    "..OBBBBOO...O...",
    ".OBBBBBBBO.OBO..",
    ".OBBWWWBBO.OBO..",
    ".OBWWWWBBBOBBOO.",
    ".OBWWWWBBBOBBO..",
    ".OBBWWWBBBOOBO..",
    "..OOOOOOOOOOO...",
    "................"
  ],
  blink: [
    "................",
    "..O....O........",
    ".OPO..OPO.......",
    ".OBBOOBBO.......",
    ".OBBSSBBO.......",
    ".OBOBBOBO.......",
    ".OLBPBBLO.......",
    "..OBBBOO........",
    "..OBBBBOO.......",
    ".OBBBBBBBO..O...",
    ".OBBWWWBBO.OBO..",
    ".OBWWWWBBO.OSO..",
    ".OBWWWWBBBOBBO..",
    ".OBBWWWBBBOBBO..",
    "..OOOOOOOOOOO...",
    "................"
  ],
  sleep1: [
    "................",
    "................",
    "................",
    "..O....O........",
    ".OPO..OPO.......",
    ".OBBOOBBO.......",
    ".OBBSSBBO.......",
    ".OBOOBOOO.......",
    "..OBBBBOO.......",
    ".OBBBBBBBO..O...",
    ".OBBWWWBBO.OBO..",
    ".OBWWWWBBO.OSO..",
    ".OBWWWWBBBOBBO..",
    ".OBBWWWBBBOBBO..",
    "..OOOOOOOOOOO...",
    "................"
  ],
  sleep2: [
    "................",
    "................",
    "................",
    "..O....O........",
    ".OPO..OPO.......",
    ".OBBOOBBO.......",
    ".OBBSSBBO.......",
    ".OBOOBOOO.......",
    "..OBBBBOO...O...",
    ".OBBBBBBBO.OBO..",
    ".OBBWWWBBO.OBO..",
    ".OBWWWWBBBOBBOO.",
    ".OBWWWWBBBOBBO..",
    ".OBBWWWBBBOOBO..",
    "..OOOOOOOOOOO...",
    "................"
  ],
  happy: [
    "................",
    "..O....O........",
    ".OPO..OPO.......",
    ".OBBOOBBO.......",
    ".OBOBBOBO.......",
    ".OOBOOBOO.......",
    ".OLBPBBLO.......",
    "..OBBBOO........",
    "..OBBBBOO.......",
    ".OBBBBBBBO..O...",
    ".OBBWWWBBO.OBO..",
    ".OBWWWWBBO.OSO..",
    ".OBWWWWBBBOBBO..",
    ".OBBWWWBBBOBBO..",
    "..OOOOOOOOOOO...",
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

function darken(hex, amount) {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = c => Math.max(0, Math.round(c * (1 - amount))).toString(16).padStart(2, "0");
  return "#" + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

// theme 파라미터 > OS 설정. 노션 임베드에서는 OS와 노션 테마가 어긋날 수 있어 명시 지정이 필요하다.
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isMini() { return qs("px", "") === "16"; }

// s 파라미터(1~12)가 있으면 고정, 없으면 뷰포트 기준 자동.
// reserve = 캐릭터 아래 텍스트/버튼이 차지하는 높이(px)
function computeScale(reserve = 0, min = 1, max = 0) {
  const mini = isMini();
  if (!max) max = mini ? 12 : 6;
  const s = Math.floor(Number(qs("s", 0)));
  if (s >= 1 && s <= 12) return s;
  const div = mini ? 22 : 44;
  return Math.max(min, Math.min(max, Math.floor(Math.min(innerWidth, innerHeight - reserve) / div)));
}

function buildPalette(opts = {}) {
  const skinName = opts.skin || qs("skin", "cheese");
  const skin = { ...(SKINS[skinName] || SKINS.cheese) };
  const custom = hexParam("c", opts.body || null);
  const dark = effectiveTheme() === "dark";
  const pal = {
    O: "#" + skin.O, B: "#" + skin.B, S: "#" + skin.S, W: "#" + skin.W,
    P: "#" + skin.P, L: "#" + skin.L, E: "#" + skin.E, H: "#" + skin.H
  };
  if (custom) {
    pal.B = custom;
    pal.S = darken(custom, 0.18); // 줄무늬는 몸통색에서 자동 파생
  }
  if (dark && (skinName === "cheese" || skinName === "cream"))
    pal.O = "#8a6a48"; // 다크 페이지에서 실루엣이 녹지 않게
  return pal;
}

class Pet {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.palette = buildPalette(opts);
    this.mini = opts.mini ?? isMini();
    this.size = this.mini ? 16 : 32;           // 스프라이트 한 변
    this.effectRows = this.mini ? 3 : 5;       // 위 이펙트 공간
    this.frames = this.mini ? FRAMES16 : FRAMES;
    this.state = "idle";        // idle | sleep | happy
    this.tick = 0;
    this.lastInteract = Date.now();
    this.sleepAfterMs = opts.sleepAfterMs ?? 45000;
    this.effects = [];          // {kind, x, y, life}
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.setScale(opts.scale || (this.mini ? 8 : 4));
    canvas.style.cursor = "pointer";
    canvas.style.transition = "transform .12s ease-out";
    canvas.style.transformOrigin = "50% 100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "픽셀 고양이 요이");
    canvas.addEventListener("pointerdown", () => this.poke());
    this.timer = setInterval(() => this.step(), this.reduced ? 1000 : 250);
  }

  setScale(s) {
    if (s === this.scale) return;
    this.scale = s;
    this.canvas.width = this.size * s;
    this.canvas.height = (this.size + this.effectRows) * s; // 위 칸은 하트/Zzz 이펙트용
    this.ctx.imageSmoothingEnabled = false;  // canvas.width 변경이 컨텍스트를 리셋함
    this.draw();
  }

  poke() {
    this.lastInteract = Date.now();
    this.setState("happy");
    const half = this.size / 2;
    this.effects.push({ kind: "heart", x: half / 2 + Math.random() * half, y: this.effectRows - 1, life: 6 });
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
      this.effects.push({ kind: "z", x: this.size * 0.62 + Math.random() * (this.size / 5), y: this.effectRows - 1, life: 8 });

    this.effects.forEach(e => { if (!this.reduced) e.y -= 0.5; e.life--; });
    this.effects = this.effects.filter(e => e.life > 0);
    this.draw();
  }

  currentFrame() {
    const F = this.frames;
    if (this.reduced)
      return this.state === "sleep" ? F.sleep1 : this.state === "happy" ? F.happy : F.idle1;
    if (this.state === "sleep") return this.tick % 8 < 4 ? F.sleep1 : F.sleep2;
    if (this.state === "happy") return F.happy;
    if (this.tick % 16 === 15) return F.blink;
    return this.tick % 4 < 2 ? F.idle1 : F.idle2;
  }

  draw() {
    const { ctx, scale } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const rows = this.currentFrame();
    const offY = this.effectRows;
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const c = this.palette[rows[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, (y + offY) * scale, scale, scale);
      }
    // 이펙트: 스프라이트 스케일 그대로(32그리드 기준), 그리드 스냅
    this.effects.forEach(e => {
      ctx.fillStyle = FX_COLOR[e.kind];
      FX[e.kind].forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++)
          if (row[dx] === "1")
            ctx.fillRect(Math.round(e.x + dx) * scale, Math.round(e.y + dy) * scale, scale, scale);
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

export { Pet, FRAMES, FRAMES16, SKINS, BASE, variant, qs, hexParam, computeScale, effectiveTheme, setupPage };
