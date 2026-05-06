# VLUX 전시참관노트 PWA

전시회 현장에서 휴대폰으로 부스를 빠르게 기록하고, 귀국 후 대표님 보고용 요약으로 정리하기 위한 모바일 우선 PWA입니다.

## 주요 기능

- 모바일 우선 화면 구성
- 부스명, 국가, 홀/부스번호, 카테고리 기록
- 현장 사진 촬영/첨부 및 자동 압축 저장
- 30초 체크리스트
  - 프라이빗 라벨 가능성
  - 자사와 유사 컨셉
  - 신제형/신포장
  - 기능성 표현 방식
  - 원료 조합 참고
  - 수출 전략 참고
- 태그 관리
  - 신제형, 기능성 표현, 패키지, 수출전략, OEM/ODM 등
- 사업 연관성, 새로움, 적용 가능성 점수화
- 보고 포함/후보/자료 요청/재방문 필요/보류 상태 관리
- 대표님 보고용 요약 자동 생성
- TXT 보고서 저장
- JSON 백업/복원
- 오프라인 사용 지원
- 홈 화면 설치 지원

## GitHub Pages 업로드 방법

1. GitHub에서 새 repository를 만듭니다.
   - 예: `vlux-expo-field-note`

2. 이 압축 파일을 풀고, 안의 파일 전체를 repository 최상단에 업로드합니다.
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.webmanifest`
   - `sw.js`
   - `icon.svg`
   - `icon-192.png`
   - `icon-512.png`

3. GitHub repository에서 아래 메뉴로 이동합니다.
   - `Settings` → `Pages`

4. Source를 아래처럼 설정합니다.
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`

5. 저장 후 생성된 GitHub Pages 주소로 접속합니다.

6. 갤럭시/안드로이드 기준 설치 방법
   - Chrome 또는 Whale에서 GitHub Pages 주소 접속
   - 브라우저 메뉴 `⋮` 클릭
   - `홈 화면에 추가` 또는 `앱 설치` 선택

## 기존 PWA와 충돌 방지

이 앱은 아래 값을 별도로 설정했습니다.

- 앱 이름: `VLUX 전시참관노트`
- short name: `전시참관노트`
- manifest id: `vlux-expo-field-note-pwa-v1`
- cache name: `vlux-expo-field-note-cache-v1`
- localStorage key: `vlux-expo-field-note-v1`

따라서 기존 DM 계산기, 가격구조 계산기, 제품기획 검토 보드와 별도 앱으로 설치되도록 구성했습니다.

## 사용 팁

전시장에서는 모든 내용을 자세히 쓰기보다 아래 3가지만 먼저 저장해도 충분합니다.

1. 브랜드/업체명
2. 왜 눈에 띄었는가
3. 사진

이후 숙소나 귀국 후 태그, 점수, 다음 액션을 보완하면 보고서 품질이 좋아집니다.
