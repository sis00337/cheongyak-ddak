# 청약딱 — 내 조건 맞춤 청약 필터 (전국판)

청약홈(applyhome.co.kr)의 **전국 공고**를 **무주택·유주택 여부, 거주지, 청약통장 예치금**으로
걸러서 "지금 신청 가능한 공고"와 "안 되는 이유"를 같이 보여주는 정적 웹앱입니다.

- 데이터 기준일: **2026-11-25** — 청약홈 활성 공고 **38건 / 전국 12개 시도**
  (APT 분양정보 285건 + APT 잔여세대 508건 + 오피스텔·민간임대 124건을 전수로 훑어
  접수중·접수예정만 남긴 결과)
- 완전 정적(서버·DB 없음), 외부 라이브러리 0개, 폰트는 시스템 폰트 사용

## 실행

```bash
cd cheongyak-filter-app
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

`index.html`을 더블클릭하면 브라우저 보안(CORS) 때문에 JSON을 읽지 못합니다.
`app.js`는 `window.__CHEONGYAK_DATA__`가 있으면 그 데이터를 먼저 쓰므로, 오프라인 배포용으로는 CSS·JS·JSON을 인라인한 단일 HTML로 묶어 쓸 수 있습니다.

## 파일 구조

```
cheongyak-filter-app/
├── index.html              화면 마크업 (+ 아이콘·OG 메타)
├── styles.css              디자인 (모바일 우선 → 980px 이상 2단 레이아웃)
├── app.js                  필터·판정 로직, 드로어, 관심/중복 체크
├── data/listings.json      전국 활성 공고 38건 (이 파일만 갈아끼우면 갱신)
├── favicon.svg               파비콘 (파란 집 + 체크)
├── favicon-32x32.png / favicon-16x16.png
├── apple-touch-icon.png      180×180 (iOS 홈 화면)
├── icon-192.png / icon-512.png  PWA·안드로이드(maskable 안전영역)
├── og-image.png            1200×630 링크 미리보기(카카오톡·SNS)
├── manifest.webmanifest    홈 화면에 추가할 때 쓰는 앱 정보
├── scripts/sync_applyhome.py   청약홈 수집·판정 스크립트 (매일 갱신용)
├── scripts/fill_winners.py     당첨자 발표일만 빠르게 재동기화
├── tmp/build_icons.py      아이콘·OG 이미지 재생성
├── tmp/check_links.py      공고 상세·신청 화면 링크 HTTP 점검
├── tmp/patch_apply_links.py  기존 listings.json 에 청약홈 링크 필드 채우기
├── tmp/verify.py           헤드리스 Chromium 검증 + 스크린샷
└── preview-*.png           화면 캡처
```

## 되는 것

| 기능 | 설명 |
|---|---|
| 내 조건 3초 입력 | 주택 수 / 거주지(8개 광역권) / 예치금 / 세대주 여부 → `localStorage`에 저장 |
| 예치금 입력 3단 | **50만 원 단위 칩**(없음·200만~500만+) + **10만 원 단위 슬라이더**(0~1,500만+) + **원 단위 직접 입력**(예: `3,500,000 원`)이 서로 동기화. 초기값은 무주택·경기·**2,000,000원** |
| 청약홈 신청 연결 | 카드·드로어에서 공고 유형에 맞는 청약홈 **청약신청 화면**으로 바로 이동(APT 1순위·2순위 / 무순위·잔여세대 / 임의공급 / 불법행위재공급 / 오피스텔 / 공공지원민간임대). 접수 예정·마감·조건 미달은 버튼이 **공고 보기**로 바뀌고 상태를 함께 표시 |
| 전국 필터 | 서울·경기·인천·부산·울산·경남·대구·경북·대전·세종·충청·광주·전라·강원·제주를 8개 광역권 칩으로 선택, 판정은 시도 단위 |
| 스마트 필터 | 지원 가능·조건 미달·관심·전체, 마감 임박·발표일·분양가·물량·지역 정렬 |
| 불가 사유 배지 | `예치금 50만 원 부족 (300만 원 필요)`, `부산·울산·경남 거주자만 신청 가능 (현재 서울)` 처럼 이유를 그대로 표시 |
| 해당지역 우선 표시 | `서울·경기·인천 거주 — 기타지역` + `경기 해당지역 우선 — 남은 물량만` |
| 당첨자 발표일 중복 | 관심 체크한 공고의 **당첨자 발표일**(`winnersDate`)이 겹치면 경고 배너 + 카드 배지 (1인 1건 규칙). 모집공고일과는 다른 날짜로 판정 |
| 상세 드로어 | 공고문 원문 근거 인용, 일정 타임라인(모집공고 → 접수 → 당첨자 발표 → 계약 → 입주), 주택형별 공급 금액, 예치금·거주지·세대주 조건, 시행사·문의처, 공고문 PDF·청약홈 공고 상세·청약신청 화면 링크, 하단 고정 **청약홈에서 신청** 버튼 |
| 수익화 슬롯 | 상단·카드 사이 네이티브·하단·사이드 광고 자리 (`[광고/제휴 슬롯 예시]` 라벨) |
| 원문 미확인 표시 | 공고문에서 자격을 확인하지 못한 공고는 `원문 미확인` 배지 + `조건 미달`로 표시(추정으로 통과시키지 않음) |

## 데이터 갱신

```bash
python3 scripts/sync_applyhome.py              # 오늘 기준 활성 공고 → data/listings.json
python3 scripts/sync_applyhome.py --review      # 판정 근거를 사람이 읽는 표로 출력
python3 scripts/sync_applyhome.py --days 30     # 30일 안에 접수 시작하는 공고까지
python3 scripts/sync_applyhome.py --no-pdf      # 공고문 PDF 생략(빠른 점검)
python3 scripts/sync_applyhome.py --refresh     # 캐시 무시하고 새로 받기
python3 scripts/fill_winners.py                 # 당첨자 발표일·모집공고일만 다시 받아 갱신
```

동작 방식

1. 청약홈의 세 목록(APT 분양정보 / APT 잔여세대 / 오피스텔·민간임대)을 끝 페이지까지 읽어
   모집공고일 8개월 전 ~ 4개월 후 구간의 공고를 모읍니다.
2. `접수 종료일 >= 오늘` 인 공고만 남깁니다(= 접수중·접수예정).
3. 각 공고의 **주요정보 팝업**에서 공급위치·공급규모·청약일정·주택형별 공급금액·입주예정월을 읽습니다.
4. 첨부된 **입주자모집공고문 PDF**를 내려받아 `신청자격` 문구에서
   무주택 여부·거주지 요건·세대주 요건을 뽑고, 근거 문장을 `evidence`로 남깁니다.
5. 예치금은 「주택공급에 관한 규칙」 85㎡ 이하 1순위 기준을 시도로 계산합니다
   (서울·부산 300만 / 인천·대구·광주·대전·울산 250만 / 그 밖의 지역 200만).
   임의공급·무순위·잔여세대·불법행위재공급·오피스텔·민간임대는 요건이 없어 0입니다.

`data/listings.json` 항목 필드:

```jsonc
{
  "id": "ah2026000576",
  "name": "아르뮤제자이",
  "region": "경기",                       // 시도
  "regionGroup": "경기",                  // 앱의 광역권
  "district": "안산시 상록구 성포동",
  "supplyType": "민영 1순위",              // 민영 1순위 | 공공분양 | 무순위 | 임의공급 |
                                          // 불법행위재공급 | 잔여세대 | 오피스텔 | 민간임대
  "housingRequirement": "1주택 가능",      // 무주택 전용 | 1주택 가능 | 무관 | 확인 필요
  "requiredDeposit": 200,                 // 만 원. 0이면 예치금 요건 없음
  "depositNote": "그 밖의 지역 기준 — 85㎡ 이하 1순위 200만 원 (85㎡ 초과는 배액)",
  "residenceRequirement": "수도권",        // 전국 | 수도권 | 해당지역 | 확인 필요
  "eligibleRegions": ["서울", "경기", "인천"],  // 신청 가능한 시도
  "priorityRegions": ["경기"],            // 해당지역 우선(남은 물량은 기타지역)
  "householderOnly": null,                // true | false | null(공고문 확인)
  "priceLabel": "분양가",                  // 민간임대는 "임대보증금"
  "priceMin": 109900, "priceMax": 140840, "priceRange": "10억 9,900만 ~ 14억 840만",
  "units": 984,
  "applyStart": "2026-11-23", "applyEnd": "2026-11-25", "applyDates": "...",
  "announceDate": "2026-11-12",              // 모집공고일(공고가 난 날)
  "winnersDate": "2026-12-01",               // 당첨자 발표일 — 카드·드로어의 '발표', 중복 판정 기준
  "contractStart": "2026-12-13", "moveIn": "2031.03",
  "types": [{ "label": "84A", "price": 110500 }],
  "pdfUrl": "https://static.applyhome.co.kr/...",   // 입주자모집공고문 PDF
  "category": "apt",                       // apt | remndr(APT 잔여세대) | other(오피스텔·민간임대)
  "houseManageNo": "2026000457", "houseSecd": null,  // 청약홈 상세 조회 키 (other는 02 오피스텔 / 03 민간임대)
  "detailUrl": "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?...",  // 공고 상세(주요정보)
  "applyUrl": "https://www.applyhome.co.kr/ap/aph/reqst/selectSubscrtReqstAptMainView.do?se=01&ty=10",  // 유형별 청약신청 화면
  "applyPath": "APT 1순위·2순위",            // 청약신청 메뉴 이름
  "verified": true,                       // 공고문에서 자격 근거를 확보했는지
  "evidence": { "housing": "...", "residence": "..." },  // 인용 문장
  "ruleNote": "재당첨제한 … 전매제한 …",     // 무순위류 자격요건 표 발췌
  "extraRequirements": ["소득·자산 기준 있음"]
}
```

## 브랜드 아이콘 · 공유 미리보기

파비콘과 OG 이미지는 `tmp/build_icons.py`가 그립니다(파란 라운드 사각형 + 흰 집 + 체크).
헤더 로고(`.brand-mark` 인라인 SVG)와 같은 도형이라 브라우저 탭·홈 화면·카카오톡 미리보기가 한 세트로 보입니다.

```bash
PLAYWRIGHT_BROWSERS_PATH=<system browsers> python3 tmp/build_icons.py
```

- `favicon.svg` — SVG를 지원하는 브라우저의 기본 파비콘
- `favicon-32x32.png` / `favicon-16x16.png` — 16px은 집+체크가 뭉개져서 체크만 크게 남긴 마이크로 심볼
- `apple-touch-icon.png` (180) / `icon-192.png` / `icon-512.png` — iOS·안드로이드 홈 화면, maskable 안전영역 확보
- `og-image.png` (1200×630) — `og:image`·`twitter:image` 절대 URL로 연결

## 배포 (다음 단계)

정적 파일이라 어디든 5분이면 올라갑니다.

1. **Cloudflare Pages** — 폴더를 그대로 업로드. 무료, 커스텀 도메인, 캐시 빠름. (추천)
2. **GitHub Pages** — 저장소에 올리고 Settings → Pages → `/root` 지정.
3. **Vercel** — `vercel deploy` (프레임워크 preset: Other).

### 매일 자동 갱신 구조

```
[매일 09:30 크론]  →  scripts/sync_applyhome.py  →  data/listings.json 커밋  →  Pages 자동 배포
```

`sync_applyhome.py`가 청약홈 목록·상세·공고문 PDF를 모두 읽으므로, 크론에서는 이 스크립트만
실행하면 됩니다(첫 실행은 PDF 다운로드 때문에 3~5분, 이후 캐시로 1분 이내).

## 검증

```bash
PLAYWRIGHT_BROWSERS_PATH=... LD_LIBRARY_PATH=... python3 tmp/verify.py
python3 tmp/check_links.py      # 38건의 청약홈 공고 상세·신청 화면이 200으로 열리는지
```

1440·390 두 폭에서 콘솔/페이지 오류 0, 가로 스크롤 0, 8개 권역 × 예치금 경계 판정,
규제지역(투기과열) 1주택 탈락, 경기 전용 공고의 타지역 탈락, 드로어·중복 배너,
카드·드로어의 발표일이 `winnersDate`인지, 예치금 3단 입력(칩·슬라이더·원 단위 직접 입력)과
`204만` 저장값의 원 단위 이전, 카드·드로어의 청약홈 링크, 아이콘·매니페스트·OG 메타 응답까지 확인하고
`preview-*.png`를 다시 찍습니다. (2026-11-25 실행: 56/56 통과)

## 주의

- 이 앱은 **정보 제공용**이며 청약 대행이 아닙니다. 최종 자격은 공고문 원문으로 확인해야 합니다.
- 자격 판정은 공고문의 '신청자격' 문구를 규칙으로 옮긴 것입니다. `1주택 가능`은
  비규제지역 민영 일반공급 1순위에 무주택 제한이 없다는 뜻이고, 투기과열·청약과열지구는
  `무주택 전용`으로 판정합니다.
- 공공분양·민간임대는 소득·자산 기준이 함께 있습니다(`extraRequirements`에 표시). 이 앱은
  소득·자산을 입력받지 않으므로 통과 판정이 곧 자격 충족은 아닙니다.
- 공고가 마감되면 카드에 `접수 마감`으로 표시되고 정렬에서 뒤로 밀립니다.
