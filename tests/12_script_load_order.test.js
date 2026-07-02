/**
 * T12: index.html 스크립트 로드 순서 검증
 * 요구 순서: app.js → firebase-app/auth/firestore-compat → firebase-config.js → sync.js
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

// <script src="..."> 태그를 문서 순서대로 추출
function extractScriptSrcs(html) {
  const pattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/g;
  const srcs = [];
  let m;
  while ((m = pattern.exec(html)) !== null) {
    srcs.push(m[1]);
  }
  return srcs;
}

const scripts = extractScriptSrcs(html);

describe('T12-1: 필수 스크립트 모두 로드', () => {
  test('app.js 로드', () => expect(scripts.some(s => s.includes('app.js'))).toBe(true));
  test('firebase-app-compat.js 로드', () => expect(scripts.some(s => s.includes('firebase-app-compat'))).toBe(true));
  test('firebase-auth-compat.js 로드', () => expect(scripts.some(s => s.includes('firebase-auth-compat'))).toBe(true));
  test('firebase-firestore-compat.js 로드', () => expect(scripts.some(s => s.includes('firebase-firestore-compat'))).toBe(true));
  test('firebase-config.js 로드', () => expect(scripts.some(s => s.includes('firebase-config.js'))).toBe(true));
  test('sync.js 로드', () => expect(scripts.some(s => s.includes('sync.js'))).toBe(true));
});

describe('T12-2: 스크립트 로드 순서', () => {
  const idx = {
    app:        scripts.findIndex(s => s.includes('app.js')),
    fbApp:      scripts.findIndex(s => s.includes('firebase-app-compat')),
    fbAuth:     scripts.findIndex(s => s.includes('firebase-auth-compat')),
    fbStore:    scripts.findIndex(s => s.includes('firebase-firestore-compat')),
    fbConfig:   scripts.findIndex(s => s.includes('firebase-config.js')),
    sync:       scripts.findIndex(s => s.includes('sync.js')),
  };

  test('app.js 가 firebase SDK 보다 먼저', () => {
    expect(idx.app).toBeGreaterThanOrEqual(0);
    expect(idx.fbApp).toBeGreaterThanOrEqual(0);
    expect(idx.app).toBeLessThan(idx.fbApp);
  });

  test('firebase-app-compat → auth-compat → firestore-compat 순', () => {
    expect(idx.fbApp).toBeLessThan(idx.fbAuth);
    expect(idx.fbAuth).toBeLessThan(idx.fbStore);
  });

  test('firebase SDK 3종 → firebase-config.js 순', () => {
    expect(idx.fbStore).toBeLessThan(idx.fbConfig);
  });

  test('firebase-config.js → sync.js 순', () => {
    expect(idx.fbConfig).toBeLessThan(idx.sync);
  });

  test('sync.js 가 마지막 스크립트', () => {
    expect(idx.sync).toBe(scripts.length - 1);
  });
});

describe('T12-3: Firebase SDK 버전 일관성', () => {
  const fbScripts = scripts.filter(s => s.includes('firebasejs'));

  test('Firebase SDK 3종 버전 동일', () => {
    const versions = fbScripts.map(s => {
      const m = s.match(/firebasejs\/([\d.]+)\//);
      return m ? m[1] : null;
    }).filter(Boolean);
    const unique = [...new Set(versions)];
    expect(unique.length).toBe(1); // 모두 같은 버전
  });

  test('Firebase SDK gstatic CDN 사용', () => {
    fbScripts.forEach(s => {
      expect(s).toContain('gstatic.com/firebasejs');
    });
  });
});
