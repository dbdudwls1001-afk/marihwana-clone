/**
 * T05: localStorage dontong_* 13키 저장/유지/읽기 테스트
 */
const { LocalStorageMock, BACKUP_KEYS } = require('./helpers');

const EXPECTED_KEYS = [
  'dontong_channels',
  'dontong_sources',
  'dontong_bgms',
  'dontong_tchannels',
  'dontong_tsources',
  'dontong_ctypes',
  'dontong_favtypes',
  'dontong_bgm_moods',
  'dontong_bgm_favmoods',
  'dontong_apikey',
  'dontong_usage',
  'dontong_usage_reset',
  'dontong_exporter',
];

describe('T05-1: BACKUP_KEYS 목록 검증 (13개)', () => {
  test('BACKUP_KEYS 는 정확히 13개', () => {
    expect(BACKUP_KEYS).toHaveLength(13);
  });

  test('모든 예상 키가 BACKUP_KEYS 에 포함됨', () => {
    EXPECTED_KEYS.forEach(k => {
      expect(BACKUP_KEYS).toContain(k);
    });
  });
});

describe('T05-2: LocalStorageMock CRUD', () => {
  let ls;
  beforeEach(() => { ls = new LocalStorageMock(); });

  test('setItem/getItem 기본 동작', () => {
    ls.setItem('dontong_channels', '[]');
    expect(ls.getItem('dontong_channels')).toBe('[]');
  });

  test('없는 키 getItem → null', () => {
    expect(ls.getItem('dontong_channels')).toBeNull();
  });

  test('removeItem 삭제 후 null', () => {
    ls.setItem('dontong_channels', '[]');
    ls.removeItem('dontong_channels');
    expect(ls.getItem('dontong_channels')).toBeNull();
  });

  test('값을 덮어쓰기', () => {
    ls.setItem('dontong_channels', '[]');
    ls.setItem('dontong_channels', '[1,2,3]');
    expect(ls.getItem('dontong_channels')).toBe('[1,2,3]');
  });
});

describe('T05-3: JSON 데이터 배열 localStorage 저장/파싱', () => {
  let ls;
  beforeEach(() => { ls = new LocalStorageMock(); });

  test('채널 배열 저장 후 복원', () => {
    const channels = [{ id: 1, name: '테스트채널', url: 'https://youtube.com/@test' }];
    ls.setItem('dontong_channels', JSON.stringify(channels));
    const loaded = JSON.parse(ls.getItem('dontong_channels') || '[]');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('테스트채널');
  });

  test('소재 배열 저장 후 복원', () => {
    const sources = [{ id: 2, title: '테스트영상', channel: '채널A', views: 50000 }];
    ls.setItem('dontong_sources', JSON.stringify(sources));
    const loaded = JSON.parse(ls.getItem('dontong_sources') || '[]');
    expect(loaded[0].views).toBe(50000);
  });

  test('BGM 배열 저장 후 복원', () => {
    const bgms = [{ id: 3, title: '테스트BGM', mood: '긴장감', url: 'https://youtu.be/dQw4w9WgXcQ' }];
    ls.setItem('dontong_bgms', JSON.stringify(bgms));
    const loaded = JSON.parse(ls.getItem('dontong_bgms') || '[]');
    expect(loaded[0].mood).toBe('긴장감');
  });

  test('API 키 저장/조회', () => {
    ls.setItem('dontong_apikey', 'AIzaSy_test_key_12345');
    expect(ls.getItem('dontong_apikey')).toBe('AIzaSy_test_key_12345');
  });

  test('사용량 숫자 저장/조회', () => {
    ls.setItem('dontong_usage', '250');
    expect(parseInt(ls.getItem('dontong_usage') || '0')).toBe(250);
  });
});

describe('T05-4: 즐겨찾기(fav) 플래그 유지', () => {
  test('fav=true 저장 후 복원 시 유지', () => {
    const ls = new LocalStorageMock();
    const channels = [
      { id: 1, name: '채널A', fav: true },
      { id: 2, name: '채널B', fav: false },
    ];
    ls.setItem('dontong_channels', JSON.stringify(channels));
    const loaded = JSON.parse(ls.getItem('dontong_channels'));
    expect(loaded[0].fav).toBe(true);
    expect(loaded[1].fav).toBe(false);
  });
});
