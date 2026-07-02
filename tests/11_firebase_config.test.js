/**
 * T11: firebase-config.js 검증
 * - 6필드 실값 주입(빈값 없음)
 * - projectId=marihwana-clone-1758 정합
 * - node --check 문법
 * - window.FIREBASE_CONFIG 전역 할당 구조
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const configPath = path.resolve(__dirname, '../firebase-config.js');
const configSrc = fs.readFileSync(configPath, 'utf-8');

// firebase-config.js 는 window.FIREBASE_CONFIG = {...} 형태
// Node.js 에서 window 를 주입해 값을 추출
const window = {};
eval(configSrc.replace(/^\/\*[\s\S]*?\*\//m, '')); // 블록 주석 제거 후 eval
const cfg = window.FIREBASE_CONFIG;

describe('T11-1: node --check 문법', () => {
  test('firebase-config.js 문법 오류 없음', () => {
    expect(() => execSync(`node --check "${configPath}"`, { stdio: 'pipe' })).not.toThrow();
  });
});

describe('T11-2: window.FIREBASE_CONFIG 구조', () => {
  test('window.FIREBASE_CONFIG 객체 존재', () => {
    expect(cfg).toBeDefined();
    expect(typeof cfg).toBe('object');
    expect(cfg).not.toBeNull();
    expect(Array.isArray(cfg)).toBe(false);
  });
});

describe('T11-3: 6필드 실값 주입 (빈값 없음)', () => {
  const REQUIRED_FIELDS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

  REQUIRED_FIELDS.forEach(field => {
    test(`${field} 존재하고 비어 있지 않음`, () => {
      expect(cfg).toHaveProperty(field);
      const val = cfg[field];
      expect(typeof val).toBe('string');
      expect(val.trim()).not.toBe('');
      // 플레이스홀더 패턴 거부: 'YOUR_...', '<...>', 'xxx', '...'
      expect(val).not.toMatch(/^(YOUR_|<|xxx|\.\.\.)/i);
    });
  });

  test('정확히 6개 이상의 필드(최소 요건 충족)', () => {
    const presentFields = REQUIRED_FIELDS.filter(f => cfg[f] && cfg[f].trim() !== '');
    expect(presentFields.length).toBe(6);
  });
});

describe('T11-4: projectId 정합', () => {
  test('projectId === "marihwana-clone-1758"', () => {
    expect(cfg.projectId).toBe('marihwana-clone-1758');
  });

  test('authDomain 에 projectId 포함', () => {
    expect(cfg.authDomain).toContain('marihwana-clone-1758');
  });

  test('storageBucket 에 projectId 포함', () => {
    expect(cfg.storageBucket).toContain('marihwana-clone-1758');
  });
});

describe('T11-5: apiKey 형식', () => {
  test('apiKey 는 "AIza" 로 시작 (Google API Key 패턴)', () => {
    expect(cfg.apiKey).toMatch(/^AIza/);
  });

  test('apiKey 길이 ≥ 20자', () => {
    expect(cfg.apiKey.length).toBeGreaterThanOrEqual(20);
  });
});

describe('T11-6: appId 형식', () => {
  test('appId 는 "1:숫자:web:hex" 패턴', () => {
    expect(cfg.appId).toMatch(/^1:\d+:web:[0-9a-f]+$/i);
  });

  test('messagingSenderId 숫자 문자열', () => {
    expect(cfg.messagingSenderId).toMatch(/^\d+$/);
  });
});
