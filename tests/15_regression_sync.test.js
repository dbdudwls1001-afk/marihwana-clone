/**
 * T15: 회귀 — sync 도입 후 기존 CRUD·백업/복원 부작용 없음
 *
 * sync.js 의 localStorage 훅은 origSet/origRemove 를 먼저 호출하므로
 * 기존 앱 데이터 저장은 정상. 단, installStorageHook 은 sync 가 enabled 일 때만 실행.
 * 여기서는 "훅이 없을 때(disabled)"와 "훅이 있을 때(enabled)" 두 경로를 모두 검증한다.
 */
const { LocalStorageMock, collectBackup, validateBackup, applyBackup, BACKUP_KEYS } = require('./helpers');

// ===== installStorageHook 재현 =====
function installStorageHookSim(ls, syncKeysArr, onPushScheduled) {
  const origSet = ls.setItem.bind(ls);
  const origRemove = ls.removeItem.bind(ls);
  let applyingRemote = false;

  ls.setItem = function (k, v) {
    origSet(k, v);  // 데이터 먼저 저장
    if (!applyingRemote && syncKeysArr.indexOf(k) !== -1) {
      onPushScheduled && onPushScheduled(k, v);
    }
  };
  ls.removeItem = function (k) {
    origRemove(k);
    if (!applyingRemote && syncKeysArr.indexOf(k) !== -1) {
      onPushScheduled && onPushScheduled(k, null);
    }
  };

  return {
    setApplyingRemote: (v) => { applyingRemote = v; }
  };
}

const EXCLUDE_FROM_SYNC = ['dontong_apikey', 'dontong_usage', 'dontong_usage_reset'];
const syncKeysArr = BACKUP_KEYS.filter(k => !EXCLUDE_FROM_SYNC.includes(k));

// ===== 테스트 =====

describe('T15-1: 훅 없을 때(sync disabled) — 기존 CRUD 정상', () => {
  test('채널 저장/삭제 정상 동작', () => {
    const ls = new LocalStorageMock();
    const channels = [{ id: 1, name: '채널A', fav: false }];
    ls.setItem('dontong_channels', JSON.stringify(channels));
    const loaded = JSON.parse(ls.getItem('dontong_channels'));
    expect(loaded[0].name).toBe('채널A');

    // 삭제
    ls.removeItem('dontong_channels');
    expect(ls.getItem('dontong_channels')).toBeNull();
  });

  test('API 키 저장/삭제 정상 동작', () => {
    const ls = new LocalStorageMock();
    ls.setItem('dontong_apikey', 'AIza_test');
    expect(ls.getItem('dontong_apikey')).toBe('AIza_test');
    ls.removeItem('dontong_apikey');
    expect(ls.getItem('dontong_apikey')).toBeNull();
  });
});

describe('T15-2: 훅 있을 때(sync enabled) — 데이터 저장은 정상', () => {
  test('훅 설치 후 채널 저장 → 원본 값 정상 유지', () => {
    const ls = new LocalStorageMock();
    const pushLog = [];
    installStorageHookSim(ls, syncKeysArr, (k, v) => pushLog.push({ k, v }));

    const channels = [{ id: 1, name: '채널B', fav: true }];
    ls.setItem('dontong_channels', JSON.stringify(channels));

    // 실제 데이터 저장됨
    const loaded = JSON.parse(ls.getItem('dontong_channels'));
    expect(loaded[0].name).toBe('채널B');
    // 동기화 트리거도 발생
    expect(pushLog.some(p => p.k === 'dontong_channels')).toBe(true);
  });

  test('훅 설치 후 API 키 저장 → push 트리거 안 됨(EXCLUDE)', () => {
    const ls = new LocalStorageMock();
    const pushLog = [];
    installStorageHookSim(ls, syncKeysArr, (k, v) => pushLog.push({ k, v }));

    ls.setItem('dontong_apikey', 'AIza_should_not_sync');

    // API 키는 실제 저장은 됨
    expect(ls.getItem('dontong_apikey')).toBe('AIza_should_not_sync');
    // 하지만 push 트리거 안 됨
    expect(pushLog.some(p => p.k === 'dontong_apikey')).toBe(false);
  });

  test('dontong_usage 저장 → push 트리거 안 됨', () => {
    const ls = new LocalStorageMock();
    const pushLog = [];
    installStorageHookSim(ls, syncKeysArr, (k, v) => pushLog.push({ k, v }));
    ls.setItem('dontong_usage', '500');
    expect(pushLog.some(p => p.k === 'dontong_usage')).toBe(false);
    expect(ls.getItem('dontong_usage')).toBe('500');
  });
});

describe('T15-3: applyingRemote 플래그 — 적용 중 push 억제', () => {
  test('applyingRemote=true 시 채널 write 도 push 안 됨', () => {
    const ls = new LocalStorageMock();
    const pushLog = [];
    const hook = installStorageHookSim(ls, syncKeysArr, (k, v) => pushLog.push({ k, v }));

    hook.setApplyingRemote(true);
    ls.setItem('dontong_channels', JSON.stringify([{ id: 99 }]));

    // 데이터는 저장됨
    expect(ls.getItem('dontong_channels')).not.toBeNull();
    // push는 없음
    expect(pushLog.length).toBe(0);
  });
});

describe('T15-4: 기존 백업/복원 round-trip 회귀', () => {
  test('훅 설치 후 collectBackup → applyBackup 왕복 정상', () => {
    const ls = new LocalStorageMock();
    installStorageHookSim(ls, syncKeysArr, () => {});

    // 데이터 세팅
    ls.setItem('dontong_channels', JSON.stringify([{ id: 1, name: '채널Z' }]));
    ls.setItem('dontong_bgms', JSON.stringify([{ id: 2, title: '음악Y' }]));
    ls.setItem('dontong_apikey', 'AIza_should_not_in_backup');

    const wrapper = collectBackup(ls);

    // 복원
    const ls2 = new LocalStorageMock();
    expect(validateBackup(wrapper)).toBe('ok');
    applyBackup(wrapper, ls2);

    const ch = JSON.parse(ls2.getItem('dontong_channels'));
    expect(ch[0].name).toBe('채널Z');

    const bgm = JSON.parse(ls2.getItem('dontong_bgms'));
    expect(bgm[0].title).toBe('음악Y');

    // API 키도 백업에 포함(collectBackup은 ALL BACKUP_KEYS)
    expect(ls2.getItem('dontong_apikey')).toBe('AIza_should_not_in_backup');
  });
});

describe('T15-5: sync.js node --check', () => {
  const { execSync } = require('child_process');
  const path = require('path');
  test('sync.js 문법 오류 없음', () => {
    const syncPath = path.resolve(__dirname, '../sync.js');
    expect(() => execSync(`node --check "${syncPath}"`, { stdio: 'pipe' })).not.toThrow();
  });
});

describe('T15-6: dontong_sync_applied 메타키 — BACKUP_KEYS 외부(백업에 포함 안 됨)', () => {
  test('SYNC_META_KEY는 BACKUP_KEYS 에 없음', () => {
    expect(BACKUP_KEYS).not.toContain('dontong_sync_applied');
  });

  test('collectBackup 결과에 sync_applied 없음', () => {
    const ls = new LocalStorageMock();
    ls.setItem('dontong_sync_applied', '2026-07-01T10:00:00Z');
    ls.setItem('dontong_channels', '[]');
    const wrapper = collectBackup(ls);
    expect(wrapper.data).not.toHaveProperty('dontong_sync_applied');
  });
});

describe('T15-7: 5탭 CRUD 데이터 형식 무결성 (훅 있을 때)', () => {
  const tabKeys = ['dontong_channels','dontong_sources','dontong_bgms','dontong_tchannels','dontong_tsources'];

  tabKeys.forEach(key => {
    test(`${key}: 저장 후 JSON 파싱 가능`, () => {
      const ls = new LocalStorageMock();
      installStorageHookSim(ls, syncKeysArr, () => {});
      const data = [{ id: 1, test: true }];
      ls.setItem(key, JSON.stringify(data));
      const loaded = JSON.parse(ls.getItem(key) || '[]');
      expect(loaded[0].test).toBe(true);
    });
  });
});
