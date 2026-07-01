/* ================================================================
 *  Firebase 설정 (사용자가 직접 채우는 파일)
 * ----------------------------------------------------------------
 *  아래 값을 Firebase 콘솔에서 복사한 값으로 채우면
 *  '크로스디바이스 동기화(로그인)' 기능이 활성화됩니다.
 *
 *  값을 비워 두면(기본 상태) 동기화 기능은 자동으로 꺼진 채로,
 *  앱은 기존처럼 이 기기의 localStorage 만으로 정상 동작합니다(하위호환).
 *
 *  ※ Firebase 웹 apiKey 는 '비밀키'가 아니라 프로젝트 식별용 공개값입니다.
 *    실제 접근 보호는 Firestore 보안 규칙(firestore.rules) + 승인된 도메인이
 *    담당합니다. 그래도 저장소 공개가 꺼려지면 이 파일을 .gitignore 하고
 *    배포 시에만 채워 넣어도 됩니다.
 *
 *  채우는 방법은 FIREBASE_SETUP.md 체크리스트를 참고하세요.
 * ================================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCEkQ8Prj6fS8_7vY3oa4ekOt-W2IrmLbY",
  authDomain: "marihwana-clone-1758.firebaseapp.com",
  projectId: "marihwana-clone-1758",
  storageBucket: "marihwana-clone-1758.firebasestorage.app",
  messagingSenderId: "200289412967",
  appId: "1:200289412967:web:04a911e69fa66d1372f1c2"
};
