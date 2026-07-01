# Firebase 크로스디바이스 동기화 — 설정 체크리스트

이 문서는 **사용자(구글 계정 소유자)** 가 직접 수행해야 하는 단계입니다.
아래를 마치고 `firebase-config.js` 에 값을 채우면 여러 기기에서 같은 데이터가
자동 동기화됩니다. **값을 채우기 전까지 앱은 기존처럼 이 기기 localStorage 만으로
정상 동작**합니다(하위호환).

> 요금제: **Spark(무료)** 로 충분합니다. 결제수단 등록 불필요, 일시정지(pause) 없음.

---

## A. Firebase 프로젝트 만들기

- [ ] 1. https://console.firebase.google.com 접속 → 본인 구글 계정 로그인
- [ ] 2. **프로젝트 추가(Add project)** → 이름 예: `marihwana-clone` → 생성
       (Google Analytics 는 꺼도 됨)

## B. 웹 앱 등록 (firebaseConfig 획득)

- [ ] 3. 프로젝트 개요 화면에서 **웹 아이콘 `</>`** 클릭 → 앱 닉네임 예: `marihwana-web`
       입력 → **앱 등록**
       (⚠ "Firebase Hosting 설정"은 체크하지 않아도 됨 — 우리는 GitHub Pages 사용)
- [ ] 4. 표시되는 `firebaseConfig` 객체를 복사 (apiKey/authDomain/projectId/
       storageBucket/messagingSenderId/appId)

## C. Firestore 데이터베이스 생성

- [ ] 5. 좌측 메뉴 **빌드 → Firestore Database** → **데이터베이스 만들기**
- [ ] 6. 위치(location) 선택: 예 `asia-northeast3 (서울)` → 다음
- [ ] 7. 시작 모드: **프로덕션 모드**로 시작 (규칙은 8단계에서 교체)
- [ ] 8. 생성 후 상단 **규칙(Rules)** 탭 → 내용을 이 저장소의 `firestore.rules`
       파일 내용으로 **전체 교체** → **게시(Publish)**
       (본인 uid 문서만 read/write, 그 외 전면 차단)

## D. 인증(Authentication) — 구글 로그인 켜기

- [ ] 9. 좌측 **빌드 → Authentication** → **시작하기**
- [ ] 10. **Sign-in method** 탭 → **Google** 선택 → **사용 설정(Enable)** →
        지원 이메일 선택 → 저장

## E. 승인된 도메인 추가 (배포 URL 로그인 허용)

- [ ] 11. Authentication → **Settings → 승인된 도메인(Authorized domains)** 에
        아래를 **추가**:
        - `dbdudwls1001-afk.github.io`   ← 배포 URL 도메인 (필수)
        - `localhost`                    ← 로컬 테스트용 (이미 있을 수 있음)

## F. config 값 채우기

- [ ] 12. 로컬 소스의 `firebase-config.js` 를 열어 4단계에서 복사한 값으로 채우기:
        ```js
        window.FIREBASE_CONFIG = {
          apiKey: "AIza...",
          authDomain: "marihwana-clone.firebaseapp.com",
          projectId: "marihwana-clone",
          storageBucket: "marihwana-clone.appspot.com",
          messagingSenderId: "1234567890",
          appId: "1:1234567890:web:abcdef..."
        };
        ```
- [ ] 13. 저장 후 재배포:
        ```
        cd /mnt/c/01.project/00.프로젝트/marihwana-clone/
        git add firebase-config.js index.html styles.css sync.js firestore.rules FIREBASE_SETUP.md
        git commit -m "feat: enable cross-device sync (Firebase)"
        git push origin main
        ```
        → GitHub Pages 자동 재빌드

---

## 동작 확인 (배포 후)

1. https://dbdudwls1001-afk.github.io/marihwana-clone/ 접속
2. 헤더 우측 **☁️ 로그인** 버튼 클릭 → 구글 로그인 팝업 → 로그인
3. 데이터 몇 개 추가 → 상태 표시가 **"동기화 중… → 동기화됨 · HH:MM"** 로 바뀌는지 확인
4. **다른 기기/브라우저**에서 같은 구글 계정으로 로그인 → 같은 데이터가 나타나는지 확인
5. 한쪽에서 수정 → 다른 쪽에 자동 반영(실시간)되는지 확인

---

## 보안 / 프라이버시 메모

- **YouTube API 키·사용량 카운터는 동기화하지 않습니다**(기기별 로컬 유지). 클라우드에
  API 키가 저장되지 않도록 payload 에서 제외했습니다.
- Firestore 규칙으로 **로그인한 본인 문서(users/{uid})만** 읽기/쓰기가 허용됩니다.
- 충돌 처리: **LWW(마지막 저장 승)**. 한 사람이 기기를 번갈아 쓰는 개인용 시나리오에
  적합합니다. **첫 로그인 시 클라우드 데이터가 우선 적용**될 수 있으니, 로그인 전
  중요한 로컬 데이터는 헤더 💾 백업으로 JSON 을 먼저 내려받아 두세요.
- Firebase 웹 `apiKey` 는 비밀키가 아니라 공개 식별자입니다(규칙으로 보호). 저장소
  공개가 꺼려지면 `firebase-config.js` 를 `.gitignore` 하고 배포 환경에서만 채워도 됩니다.
