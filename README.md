# 요이위젯 (yoiwidget)

귀여운 픽셀 캐릭터 노션 임베드 위젯 모음. 순수 정적 사이트 — 빌드 없음, 의존성 없음.

## 구조

- `engine.js` — 공통 캐릭터 엔진 (32×32 픽셀 고양이 "요이", 치즈 줄무늬 기본 + 스킨 4종, 캔버스 렌더링, 상태머신)
- `tools/gen-assets.mjs` — 스프라이트 검증 시트 + favicon.svg 재생성 (`npm run assets`)
- `pet.html` / `dday.html` / `timer.html` — 위젯 (엔진 위의 얇은 껍데기)
- `index.html` — 랜딩 + 임베드 URL 생성기
- `widget.css` — 위젯 공통 스타일 (노션 라이트/다크 대응)

## 위젯 URL 파라미터

| 파라미터 | 의미 | 예 |
|---|---|---|
| `skin` | 스킨: `cheese`(기본)·`cream`·`gray`·`tux` | `skin=tux` |
| `c` | 몸통 색 커스텀 (hex, # 없이, 줄무늬 자동 파생) | `c=f2c4cf` |
| `bg` | 배경 색 (생략 = 투명) | `bg=ffffff` |
| `s` | 픽셀 스케일 1~12 (생략 = 자동) | `s=4` |
| `theme` | `light` / `dark` (생략 = OS 따름) | `theme=dark` |
| `title`, `date` | 디데이 전용 | `date=2026-11-19` |
| `w`, `b` | 타이머 집중/휴식 분 | `w=50&b=10` |

## 로컬 개발

```bash
npx -y http-server . -p 5173 -c-1
```

주의: `serve` 패키지는 cleanUrls 301 리다이렉트가 쿼리스트링을 날리므로 쓰지 말 것.

## 배포

Vercel 정적 호스팅 (프로젝트 루트 그대로). 추가 헤더 설정 불필요 — X-Frame-Options를 넣으면 노션 임베드가 깨지므로 절대 추가하지 말 것.

### 커스텀 도메인 전환 체크리스트

현재 `https://yoiwidget.vercel.app`이 다음 위치에 하드코딩되어 있음:

1. `index.html` — canonical, og:url, og:image, JSON-LD url
2. `robots.txt` — Sitemap 라인
3. `sitemap.xml` — loc

도메인 전환 시: 위 3개 파일 갱신 → Vercel에서 기존 .vercel.app 도메인 유지(자동 308 리다이렉트로 기존 임베드 URL 보호) → 네이버 서치어드바이저·구글 서치콘솔에 새 도메인 재등록 + 사이트맵 재제출 (네이버는 리다이렉트를 새 사이트로 취급함).

### 배포 후 1회 작업

- 네이버 서치어드바이저 (searchadvisor.naver.com): 사이트 등록 → HTML 태그 인증 메타를 index.html에 추가 → 사이트맵 제출 + 웹 페이지 수집 요청
- 구글 서치콘솔: 동일 흐름
- 카카오 공유 디버거 (developers.kakao.com/tool/debugger/sharing)에서 OG 카드 확인
