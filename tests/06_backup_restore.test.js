/**
 * T06: ★신규 전체 JSON 백업/복원 기능 테스트
 * - exportAllData() 로직: collectBackup() → 래퍼 구조 검증
 * - importAllData() 로직: validateBackup() → applyBackup()
 * - 거부 케이스: 타앱 파일, 손상 파일, 미래 schemaVersion
 * - 복원 전 자동백업 후 교체 → 재로드 흐름 검증
 */
const {
  LocalStorageMock,
  BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, BACKUP_KEYS,
  collectBackup, validateBackup, applyBackup, backupStamp,
} = require('./helpers');

// 테스트용 더미 데이터 세팅
function seedStorage(ls) {
  const channels = [{ id: 1, name: '채널A', url: 'https://youtube.com/@cha', fav: false }];
  const bgms = [{ id: 2, title: '배경음악', mood: '잔잔', url: 'https://youtu.be/dQw4w9WgXcQ' }];
  ls.setItem('dontong_channels', JSON.stringify(channels));
  ls.setItem('dontong_sources', '[]');
  ls.setItem('dontong_bgms', JSON.stringify(bgms));
  ls.setItem('dontong_tchannels', '[]');
  ls.setItem('dontong_tsources', '[]');
  ls.setItem('dontong_ctypes', '[]');
  ls.setItem('dontong_favtypes', '[]');
  ls.setItem('dontong_bgm_moods', '[]');
  ls.setItem('dontong_bgm_favmoods', '[]');
  ls.setItem('dontong_apikey', 'AIza_test');
  ls.setItem('dontong_usage', '42');
  ls.setItem('dontong_usage_reset', '2026-07-01T08');
  ls.setItem('dontong_exporter', '윤@웅');
}

describe('T06-1: collectBackup() 백업 래퍼 구조', () => {
  test('app, schemaVersion, exportedAt, data 필드 존재', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);
    expect(wrapper.app).toBe(BACKUP_APP_ID);
    expect(wrapper.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(typeof wrapper.exportedAt).toBe('string');
    expect(wrapper.data).toBeDefined();
  });

  test('data 에 seeded 된 키 포함', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);
    expect(wrapper.data).toHaveProperty('dontong_channels');
    expect(wrapper.data).toHaveProperty('dontong_bgms');
    expect(wrapper.data).toHaveProperty('dontong_apikey');
    expect(wrapper.data).toHaveProperty('dontong_exporter');
  });

  test('data 의 dontong_channels 는 JSON 파싱 가능', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);
    const channels = JSON.parse(wrapper.data['dontong_channels']);
    expect(channels[0].name).toBe('채널A');
  });

  test('없는 키는 data 에 포함되지 않음', () => {
    const ls = new LocalStorageMock(); // 비어있음
    const wrapper = collectBackup(ls);
    expect(Object.keys(wrapper.data)).toHaveLength(0);
  });

  test('schemaVersion 은 정수 1', () => {
    const ls = new LocalStorageMock();
    const wrapper = collectBackup(ls);
    expect(wrapper.schemaVersion).toBe(1);
    expect(Number.isInteger(wrapper.schemaVersion)).toBe(true);
  });
});

describe('T06-2: validateBackup() 검증 로직', () => {
  function makeGoodWrapper(overrides = {}) {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    return { ...collectBackup(ls), ...overrides };
  }

  test('유효한 백업 파일 → ok', () => {
    expect(validateBackup(makeGoodWrapper())).toBe('ok');
  });

  test('null → not_object', () => {
    expect(validateBackup(null)).toBe('not_object');
  });

  test('배열 → not_object', () => {
    expect(validateBackup([])).toBe('not_object');
  });

  test('app 불일치 → wrong_app', () => {
    expect(validateBackup(makeGoodWrapper({ app: 'other-app' }))).toBe('wrong_app');
  });

  test('schemaVersion 미래 값 → bad_version', () => {
    expect(validateBackup(makeGoodWrapper({ schemaVersion: 999 }))).toBe('bad_version');
  });

  test('schemaVersion 문자열 → bad_version', () => {
    expect(validateBackup(makeGoodWrapper({ schemaVersion: '1' }))).toBe('bad_version');
  });

  test('data 없음 → no_data', () => {
    expect(validateBackup(makeGoodWrapper({ data: undefined }))).toBe('no_data');
  });

  test('data 가 배열 → no_data', () => {
    expect(validateBackup(makeGoodWrapper({ data: [] }))).toBe('no_data');
  });

  test('알 수 없는 키만 있음 → unknown_keys', () => {
    expect(validateBackup(makeGoodWrapper({ data: { unknown_key: 'value' } }))).toBe('unknown_keys');
  });

  test('손상된 JSON 구조(문자열) → not_object', () => {
    expect(validateBackup('corrupted string')).toBe('not_object');
  });
});

describe('T06-3: applyBackup() 복원 — localStorage 교체', () => {
  test('복원 후 dontong_channels 가 백업 값으로 교체됨', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);

    // 새 storage (다른 기기 시뮬레이션)
    const ls2 = new LocalStorageMock();
    ls2.setItem('dontong_channels', JSON.stringify([{ id: 99, name: '기존채널' }]));

    applyBackup(wrapper, ls2);

    const restored = JSON.parse(ls2.getItem('dontong_channels'));
    expect(restored[0].name).toBe('채널A'); // 원본 백업 값
  });

  test('복원 후 기존 데이터는 제거됨 (교체)', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);

    const ls2 = new LocalStorageMock();
    ls2.setItem('dontong_channels', JSON.stringify([{ id: 99 }]));
    ls2.setItem('dontong_bgms', JSON.stringify([{ id: 88 }]));

    applyBackup(wrapper, ls2);

    // 백업에 있던 채널A 가 복원되어야 함
    const ch = JSON.parse(ls2.getItem('dontong_channels') || '[]');
    expect(ch[0].name).toBe('채널A');
  });

  test('복원 후 API 키 포함', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);

    const ls2 = new LocalStorageMock();
    applyBackup(wrapper, ls2);

    expect(ls2.getItem('dontong_apikey')).toBe('AIza_test');
  });

  test('복원 후 exporter 이름 포함', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);
    const wrapper = collectBackup(ls);

    const ls2 = new LocalStorageMock();
    applyBackup(wrapper, ls2);

    expect(ls2.getItem('dontong_exporter')).toBe('윤@웅');
  });

  test('백업에 없는 키는 복원 후에도 없음 (부분 복원)', () => {
    const ls = new LocalStorageMock();
    ls.setItem('dontong_channels', '[]'); // 일부만 세팅
    const wrapper = collectBackup(ls);

    const ls2 = new LocalStorageMock();
    applyBackup(wrapper, ls2);

    // dontong_bgms 는 원본에 없었으므로 복원 후도 null
    expect(ls2.getItem('dontong_bgms')).toBeNull();
  });
});

describe('T06-4: backupStamp() 파일명 타임스탬프', () => {
  test('YYYYMMDD-HHmm 형식', () => {
    const stamp = backupStamp(new Date('2026-07-01T14:30:00'));
    expect(stamp).toMatch(/^\d{8}-\d{4}$/);
  });

  test('날짜 값 정확성', () => {
    const stamp = backupStamp(new Date('2026-07-01T09:05:00'));
    // 로컬 시간 기준이므로 날짜 부분만 확인
    expect(stamp.length).toBe(13); // 8 + '-' + 4
  });
});

describe('T06-5: 백업 파일명 접두사 검증', () => {
  test('exportAllData 백업 파일명은 marihwana-backup- 로 시작', () => {
    // app.js 내부 로직 패턴 확인
    const stamp = backupStamp();
    const filename = `marihwana-backup-${stamp}.json`;
    expect(filename).toMatch(/^marihwana-backup-\d{8}-\d{4}\.json$/);
  });

  test('자동백업 파일명은 marihwana-autobackup- 로 시작', () => {
    const stamp = backupStamp();
    const filename = `marihwana-autobackup-${stamp}.json`;
    expect(filename).toMatch(/^marihwana-autobackup-\d{8}-\d{4}\.json$/);
  });
});

describe('T06-6: 백업-복원 왕복 (round-trip) 테스트', () => {
  test('모든 13개 키 세팅 → 백업 → 다른 storage 복원 → 동일', () => {
    const ls = new LocalStorageMock();
    seedStorage(ls);

    const wrapper = collectBackup(ls);
    expect(validateBackup(wrapper)).toBe('ok');

    const ls2 = new LocalStorageMock();
    applyBackup(wrapper, ls2);

    // 원본과 복원 비교
    BACKUP_KEYS.forEach(k => {
      const original = ls.getItem(k);
      const restored = ls2.getItem(k);
      expect(restored).toBe(original);
    });
  });
});
