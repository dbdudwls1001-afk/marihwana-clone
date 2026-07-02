/**
 * T14: firestore.rules 보안 규칙 정적 검증
 * - users/{uid} 본인 read/write: request.auth.uid == userId
 * - catch-all deny: if false
 * - 기타 경로 노출 없음
 */
const fs = require('fs');
const path = require('path');

const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf-8');

describe('T14-1: 규칙 파일 기본 구조', () => {
  test('rules_version 선언', () => {
    expect(rules).toContain("rules_version = '2'");
  });
  test('service cloud.firestore 선언', () => {
    expect(rules).toContain('service cloud.firestore');
  });
  test('match /databases/{database}/documents', () => {
    expect(rules).toContain('match /databases/{database}/documents');
  });
});

describe('T14-2: users/{uid} 본인만 read/write', () => {
  test('match /users/{userId} 경로 존재', () => {
    expect(rules).toContain('match /users/{userId}');
  });
  test('request.auth != null 인증 체크', () => {
    expect(rules).toContain('request.auth != null');
  });
  test('request.auth.uid == userId 본인 확인', () => {
    expect(rules).toContain('request.auth.uid == userId');
  });
  test('allow read, write 명시', () => {
    expect(rules).toMatch(/allow\s+read\s*,\s*write/);
  });
  test('read/write 조건이 auth uid 일치에만 의존', () => {
    // auth 없이 열리는 패턴(allow read; allow write: if true 등) 없음
    expect(rules).not.toMatch(/allow\s+(read|write)\s*:\s*if\s+true/);
    expect(rules).not.toMatch(/allow\s+(read|write)\s*;/);
  });
});

describe('T14-3: catch-all deny 로직', () => {
  test('/{document=**} catch-all 패턴 존재', () => {
    expect(rules).toContain('{document=**}');
  });
  test('catch-all allow ... if false', () => {
    // 반드시 "if false" 로 닫아야 함
    const catchAll = rules.match(/\{document=\*\*\}[\s\S]+?allow[\s\S]+?if\s+false/);
    expect(catchAll).not.toBeNull();
  });
  test('catch-all read + write 모두 차단', () => {
    const block = rules.match(/\{document=\*\*\}[\s\S]+?\}/);
    expect(block).not.toBeNull();
    // "if false" 로 모든 접근 차단
    expect(block[0]).toContain('if false');
  });
});

describe('T14-4: 과도한 권한 부여 없음', () => {
  test('allow read, write: if true 없음', () => {
    expect(rules).not.toMatch(/allow\s+read\s*,\s*write\s*:\s*if\s+true/);
  });
  test('allow read 단독으로 조건 없이 열림 없음', () => {
    expect(rules).not.toMatch(/allow\s+read\s*;\s*\n/);
  });
  test('공개 read(request.auth 검사 없음) 없음', () => {
    // request.auth 체크 없이 allow read/write 가 나오면 안 됨
    // 정상 패턴: "allow read, write: if request.auth != null && ..."
    const authCheck = rules.match(/allow[^;]+:\s*if\s+request\.auth/g) || [];
    const openAllow = rules.match(/allow[^;]+:\s*if\s+(?!request\.auth)(?!false)/g) || [];
    expect(openAllow.length).toBe(0);
  });
});

describe('T14-5: users 컬렉션 외 경로 노출 없음', () => {
  test('users/ 이외의 named match 경로 없음', () => {
    // users/ 패턴 외의 구체 경로(예: /products/{id}) 없음
    const namedMatches = rules.match(/match\s+\/[a-zA-Z_][^{/\s]*/g) || [];
    const nonUserPaths = namedMatches.filter(m => !m.includes('/users') && !m.includes('/databases'));
    expect(nonUserPaths.length).toBe(0);
  });
});
