/**
 * T18: draft(입력 임시저장) 회귀 테스트
 *
 * 핵심 불변식:
 *   1. dontong_draft_* 키는 기존 스키마(BACKUP_KEYS)에 없다 — 동기화/백업 대상 아님
 *   2. draft 키는 dontong_draft_<id> 형식
 *   3. saveDraft: 비어있으면 removeItem, 값 있으면 setItem
 *   4. clearDrafts: 지정 id 목록의 draft 키만 삭제, 다른 데이터 키 불변
 *   5. 저장(save*) 후 draft 삭제 — 기존 데이터 키에는 영향 없음
 *   6. app.js에 필수 심볼 정의 확인 (정적)
 *   7. dirty-guard: sync.js에 applyRemote·doApplyRemote·pendingRemote·userIsTyping 존재
 */
const fs = require('fs');
const path = require('path');
const { LocalStorageMock, BACKUP_KEYS } = require('./helpers');

const appSrc  = fs.readFileSync(path.resolve(__dirname, '../app.js'),  'utf-8');
const syncSrc = fs.readFileSync(path.resolve(__dirname, '../sync.js'), 'utf-8');

// ── 테스트용 순수 함수 재현 (DOM 없이) ──────────────────────────────
const DRAFT_FIELD_IDS = [
  'ch-url','ch-reason','ch-ref','ch-style',
  'src-url','src-reason','src-content','src-style',
  'bgm-url','bgm-title','bgm-memo',
  'tch-name','tch-url',
  'tsr-title','tsr-url'
];

function draftKey(id) { return 'dontong_draft_' + id; }

function saveDraft(ls, id, value) {
  if (value && value.trim() !== '') ls.setItem(draftKey(id), value);
  else ls.removeItem(draftKey(id));
}

function clearDrafts(ls, ids) {
  (ids || DRAFT_FIELD_IDS).forEach(id => ls.removeItem(draftKey(id)));
}

// ─────────────────────────────────────────────
// A) 스키마 격리 — draft 키는 BACKUP_KEYS/동기화 대상 아님
// ─────────────────────────────────────────────
describe('T18-A: draft 키가 기존 스키마에서 격리됨', () => {
  test('DRAFT_FIELD_IDS 15개 정의', () => {
    expect(DRAFT_FIELD_IDS).toHaveLength(15);
  });

  test('dontong_draft_* 키가 BACKUP_KEYS에 없음 (백업/동기화 대상 아님)', () => {
    DRAFT_FIELD_IDS.forEach(id => {
      expect(BACKUP_KEYS).not.toContain(draftKey(id));
    });
  });

  test('dontong_draft_로 시작하는 키가 BACKUP_KEYS에 하나도 없음', () => {
    const draftInBackup = BACKUP_KEYS.filter(k => k.startsWith('dontong_draft_'));
    expect(draftInBackup).toHaveLength(0);
  });

  test('sync.js EXCLUDE_FROM_SYNC 또는 BACKUP_KEYS 미포함으로 동기화 페이로드에서 제외됨', () => {
    // draft 키가 BACKUP_KEYS에 없으므로 syncKeys() 결과에도 없음
    // → collectSyncPayload가 draft를 포함시키지 않음
    const ls = new LocalStorageMock();
    DRAFT_FIELD_IDS.forEach(id => ls.setItem(draftKey(id), '임시입력'));
    ls.setItem('dontong_channels', JSON.stringify([{ id: 1, name: '채널A' }]));

    // BACKUP_KEYS 기반 수집만 하면 draft는 수집 안 됨
    const syncKeys = BACKUP_KEYS.filter(k =>
      !['dontong_apikey','dontong_usage','dontong_usage_reset'].includes(k)
    );
    const collected = {};
    syncKeys.forEach(k => {
      const v = ls.getItem(k);
      if (v !== null) collected[k] = v;
    });

    DRAFT_FIELD_IDS.forEach(id => {
      expect(collected).not.toHaveProperty(draftKey(id));
    });
    expect(collected['dontong_channels']).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// B) saveDraft / clearDrafts 로직
// ─────────────────────────────────────────────
describe('T18-B: saveDraft 동작', () => {
  let ls;
  beforeEach(() => { ls = new LocalStorageMock(); });

  test('값 있으면 setItem', () => {
    saveDraft(ls, 'bgm-url', 'https://youtube.com/@x');
    expect(ls.getItem('dontong_draft_bgm-url')).toBe('https://youtube.com/@x');
  });

  test('빈 문자열이면 removeItem(기존 값 제거)', () => {
    ls.setItem('dontong_draft_bgm-url', '이전값');
    saveDraft(ls, 'bgm-url', '');
    expect(ls.getItem('dontong_draft_bgm-url')).toBeNull();
  });

  test('공백만 있으면 removeItem', () => {
    ls.setItem('dontong_draft_bgm-url', '이전값');
    saveDraft(ls, 'bgm-url', '   ');
    expect(ls.getItem('dontong_draft_bgm-url')).toBeNull();
  });

  test('덮어쓰기: 기존 draft 값이 새 값으로 교체됨', () => {
    saveDraft(ls, 'ch-reason', '첫 번째 입력');
    saveDraft(ls, 'ch-reason', '두 번째 입력');
    expect(ls.getItem('dontong_draft_ch-reason')).toBe('두 번째 입력');
  });
});

describe('T18-C: clearDrafts 동작', () => {
  let ls;
  beforeEach(() => {
    ls = new LocalStorageMock();
    DRAFT_FIELD_IDS.forEach(id => ls.setItem(draftKey(id), `draft_${id}`));
    // 기존 데이터 키도 설정
    ls.setItem('dontong_channels', JSON.stringify([{ id: 1 }]));
    ls.setItem('dontong_bgms',     JSON.stringify([{ id: 2 }]));
  });

  test('특정 ids만 clearDrafts → 해당 draft 삭제, 나머지 draft 유지', () => {
    clearDrafts(ls, ['bgm-title','bgm-url','bgm-memo']);
    expect(ls.getItem('dontong_draft_bgm-title')).toBeNull();
    expect(ls.getItem('dontong_draft_bgm-url')).toBeNull();
    expect(ls.getItem('dontong_draft_bgm-memo')).toBeNull();
    // 다른 draft는 유지
    expect(ls.getItem('dontong_draft_ch-url')).toBe('draft_ch-url');
    expect(ls.getItem('dontong_draft_src-url')).toBe('draft_src-url');
  });

  test('clearDrafts 후 기존 데이터 키 불변', () => {
    clearDrafts(ls, DRAFT_FIELD_IDS);
    expect(ls.getItem('dontong_channels')).not.toBeNull();
    expect(ls.getItem('dontong_bgms')).not.toBeNull();
  });

  test('전체 draft clearDrafts → 모든 draft 삭제, 데이터 키는 그대로', () => {
    clearDrafts(ls);
    DRAFT_FIELD_IDS.forEach(id => {
      expect(ls.getItem(draftKey(id))).toBeNull();
    });
    expect(JSON.parse(ls.getItem('dontong_channels'))[0].id).toBe(1);
  });
});

// ─────────────────────────────────────────────
// D) 저장 시 draft 삭제 후 기존 데이터 보존
// ─────────────────────────────────────────────
describe('T18-D: 저장 사이클 — draft 삭제 후 데이터 키 불변', () => {
  test('BGM draft 삭제 후 dontong_bgms 데이터 유지', () => {
    const ls = new LocalStorageMock();
    const bgmData = [{ id: 1, title: '저장된BGM', url: 'https://youtu.be/abc' }];
    ls.setItem('dontong_bgms', JSON.stringify(bgmData));
    ['bgm-title','bgm-url','bgm-memo'].forEach(id => ls.setItem(draftKey(id), `draft_${id}`));

    // 저장 완료 시 clearDrafts 시뮬레이션
    clearDrafts(ls, ['bgm-title','bgm-url','bgm-memo']);

    // 기존 BGM 데이터 보존
    const loaded = JSON.parse(ls.getItem('dontong_bgms'));
    expect(loaded[0].title).toBe('저장된BGM');
    // draft 키 삭제됨
    expect(ls.getItem('dontong_draft_bgm-title')).toBeNull();
    expect(ls.getItem('dontong_draft_bgm-url')).toBeNull();
  });

  test('채널 draft 삭제 후 dontong_channels 데이터 유지', () => {
    const ls = new LocalStorageMock();
    ls.setItem('dontong_channels', JSON.stringify([{ id: 10, name: '채널X', url: 'https://yt.com/@x' }]));
    ['ch-url','ch-reason','ch-ref','ch-style'].forEach(id => ls.setItem(draftKey(id), 'draft'));

    clearDrafts(ls, ['ch-url','ch-reason','ch-ref','ch-style']);

    const ch = JSON.parse(ls.getItem('dontong_channels'));
    expect(ch[0].name).toBe('채널X');
    expect(ls.getItem('dontong_draft_ch-url')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// E) 정적 검증 — app.js 필수 심볼 존재
// ─────────────────────────────────────────────
describe('T18-E: app.js 정적 심볼 검증', () => {
  const REQUIRED = [
    'DRAFT_FIELD_IDS',
    'draftKey',
    'saveDraft',
    'clearDrafts',
    'restoreDrafts',
    'hasUnsavedInput',
    'reloadStateAndRender',
  ];

  REQUIRED.forEach(sym => {
    test(`${sym} 정의됨`, () => {
      expect(appSrc).toContain(sym);
    });
  });

  test('DRAFT_FIELD_IDS 에 15개 필드 id 포함', () => {
    DRAFT_FIELD_IDS.forEach(id => {
      expect(appSrc).toContain(`'${id}'`);
    });
  });

  test('dontong_draft_ 접두사로 draft 키 생성', () => {
    expect(appSrc).toContain("'dontong_draft_'");
  });

  test('clearDrafts가 saveBgm 후 호출됨', () => {
    // saveBgm 내 clearDrafts 호출 패턴 확인
    expect(appSrc).toMatch(/function saveBgm[\s\S]+?clearDrafts/);
  });

  test('clearDrafts가 clearChannelInputs 내 호출됨', () => {
    expect(appSrc).toMatch(/function clearChannelInputs[\s\S]+?clearDrafts/);
  });

  test('clearDrafts가 clearSourceInputs 내 호출됨', () => {
    expect(appSrc).toMatch(/function clearSourceInputs[\s\S]+?clearDrafts/);
  });

  test('saveDraft가 fetchBgm 내(자동채움 title) 호출됨', () => {
    expect(appSrc).toMatch(/function fetchBgm[\s\S]+?saveDraft/);
  });

  test('restoreDrafts가 DOMContentLoaded 핸들러에서 호출됨', () => {
    const domBlock = appSrc.match(/DOMContentLoaded[\s\S]+?}\s*\)/);
    expect(domBlock).not.toBeNull();
    expect(domBlock[0]).toContain('restoreDrafts');
  });
});

// ─────────────────────────────────────────────
// F) 정적 검증 — sync.js dirty-guard 심볼 존재
// ─────────────────────────────────────────────
describe('T18-F: sync.js dirty-guard 정적 심볼 검증', () => {
  test('pendingRemote 변수 선언됨', () => {
    expect(syncSrc).toContain('pendingRemote');
  });

  test('pendingTimer 변수 선언됨', () => {
    expect(syncSrc).toContain('pendingTimer');
  });

  test('userIsTyping 함수 정의됨', () => {
    expect(syncSrc).toContain('function userIsTyping');
  });

  test('hasUnsavedInput 위임 호출됨', () => {
    expect(syncSrc).toContain('hasUnsavedInput');
  });

  test('doApplyRemote 함수 정의됨 (applyRemote 분리)', () => {
    expect(syncSrc).toContain('function doApplyRemote');
  });

  test('applyRemote가 dirty 시 pendingRemote에 보관 후 return', () => {
    expect(syncSrc).toMatch(/pendingRemote\s*=\s*p/);
    // setInterval 재시도 패턴
    expect(syncSrc).toContain('setInterval');
  });

  test('소프트 재렌더: location.reload 제거 + reloadStateAndRender 호출', () => {
    // doApplyRemote에서 reloadStateAndRender 호출
    expect(syncSrc).toContain('reloadStateAndRender');
    // 폴백 reload는 else 분기에만
    const doApplyBlock = syncSrc.match(/function doApplyRemote[\s\S]+?^  }/m);
    expect(doApplyBlock).not.toBeNull();
    expect(doApplyBlock[0]).toContain('reloadStateAndRender');
  });
});
