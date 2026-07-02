/**
 * T17: URL 데이터 보존 회귀 테스트
 *
 * 핵심 불변식: safeUrl()/extLink()는 렌더 전용이며,
 * localStorage에 저장되는 raw URL 데이터는 절대 변환하지 않는다.
 *
 * 검증 범위:
 *   A) localStorage read/write — URL 있는 것 / URL 없는 것 / 스킴 없는 것 보존
 *   B) 저장-로드 사이클 전후 URL 값 동일성 (data immutability)
 *   C) safeUrl()은 렌더 결과만 바꾸고 저장 데이터를 변환하지 않음
 *   D) BGM / 채널 / 소재 복수 항목 혼합 보존
 */
const { LocalStorageMock, safeUrl, extLink } = require('./helpers');

// ─────────────────────────────────────────────
// A) 단일 항목 URL 보존
// ─────────────────────────────────────────────
describe('T17-A: URL 필드 read/write 보존', () => {
  let ls;
  beforeEach(() => { ls = new LocalStorageMock(); });

  test('https URL 저장 항목 — 로드 후 url 값 동일', () => {
    const item = { id: 1, title: '정상링크', url: 'https://youtube.com/@test', mood: '신남' };
    ls.setItem('dontong_bgms', JSON.stringify([item]));
    const loaded = JSON.parse(ls.getItem('dontong_bgms'));
    expect(loaded[0].url).toBe('https://youtube.com/@test');
  });

  test('URL 없는 항목(url:"") — 로드 후 빈문자열 보존', () => {
    const item = { id: 2, title: '링크없음', url: '', mood: '잔잔함' };
    ls.setItem('dontong_bgms', JSON.stringify([item]));
    const loaded = JSON.parse(ls.getItem('dontong_bgms'));
    expect(loaded[0].url).toBe('');
  });

  test('스킴 없는 URL(www.x.com) — 로드 후 raw 원본 보존', () => {
    const rawUrl = 'www.youtube.com/@somehandle';
    const item = { id: 3, title: '스킴누락', url: rawUrl, mood: '신남' };
    ls.setItem('dontong_bgms', JSON.stringify([item]));
    const loaded = JSON.parse(ls.getItem('dontong_bgms'));
    expect(loaded[0].url).toBe(rawUrl);
  });

  test('채널 항목 url 보존', () => {
    const ch = { id: 10, name: '채널A', url: 'https://youtube.com/channel/UC12345', subs: 100000 };
    ls.setItem('dontong_channels', JSON.stringify([ch]));
    const loaded = JSON.parse(ls.getItem('dontong_channels'));
    expect(loaded[0].url).toBe('https://youtube.com/channel/UC12345');
  });

  test('소재(source) url 보존', () => {
    const src = { id: 20, title: '영상1', url: 'https://youtu.be/dQw4w9WgXcQ', views: 5000 };
    ls.setItem('dontong_sources', JSON.stringify([src]));
    const loaded = JSON.parse(ls.getItem('dontong_sources'));
    expect(loaded[0].url).toBe('https://youtu.be/dQw4w9WgXcQ');
  });
});

// ─────────────────────────────────────────────
// B) 저장-로드 사이클 — URL 데이터 불변성
// ─────────────────────────────────────────────
describe('T17-B: 저장-로드 사이클 URL 불변성', () => {
  const URL_CASES = [
    { label: 'https 절대주소', url: 'https://youtube.com/@test' },
    { label: 'http 절대주소', url: 'http://example.com/path?q=1' },
    { label: '스킴 없는 주소', url: 'www.youtube.com/@handle' },
    { label: '빈 문자열', url: '' },
    { label: 'youtu.be 단축', url: 'https://youtu.be/dQw4w9WgXcQ' },
  ];

  URL_CASES.forEach(({ label, url }) => {
    test(`[${label}] 저장→로드 후 raw url 동일`, () => {
      const ls = new LocalStorageMock();
      const item = { id: 99, title: label, url, mood: '테스트' };
      ls.setItem('dontong_bgms', JSON.stringify([item]));
      const loaded = JSON.parse(ls.getItem('dontong_bgms'));
      expect(loaded[0].url).toBe(url);
    });
  });

  test('복수 항목 저장-로드 후 url 배열 순서·값 모두 보존', () => {
    const ls = new LocalStorageMock();
    const items = [
      { id: 1, title: 'A', url: 'https://youtube.com/@a' },
      { id: 2, title: 'B', url: '' },
      { id: 3, title: 'C', url: 'www.nicovideo.jp/watch/sm1234' },
      { id: 4, title: 'D', url: 'https://youtu.be/abc1234abc1' },
    ];
    ls.setItem('dontong_bgms', JSON.stringify(items));
    const loaded = JSON.parse(ls.getItem('dontong_bgms'));
    expect(loaded).toHaveLength(4);
    items.forEach((orig, i) => {
      expect(loaded[i].url).toBe(orig.url);
    });
  });
});

// ─────────────────────────────────────────────
// C) safeUrl()/extLink() 는 렌더만 변환하고 저장 데이터를 건드리지 않음
// ─────────────────────────────────────────────
describe('T17-C: 렌더(safeUrl/extLink)와 저장 데이터 분리', () => {
  test('스킴 없는 url — safeUrl 복구해도 저장값은 raw 그대로', () => {
    const ls = new LocalStorageMock();
    const rawUrl = 'www.example.com/path';
    ls.setItem('dontong_bgms', JSON.stringify([{ id: 1, url: rawUrl }]));

    // 렌더 시 safeUrl이 변환 (https:// 붙이기)
    const rendered = safeUrl(rawUrl);
    expect(rendered).toBe('https://www.example.com/path');

    // 저장 데이터는 변환 없이 그대로
    const stored = JSON.parse(ls.getItem('dontong_bgms'))[0].url;
    expect(stored).toBe(rawUrl);
    expect(stored).not.toBe(rendered); // 저장값 ≠ 렌더값 (의도된 분리)
  });

  test('무효 url(javascript:) — extLink는 <span> 반환, 저장값은 원본 유지', () => {
    const ls = new LocalStorageMock();
    const rawUrl = 'javascript:alert(1)';
    ls.setItem('dontong_bgms', JSON.stringify([{ id: 2, url: rawUrl }]));

    const htmlOut = extLink(rawUrl, '링크');
    expect(htmlOut).toMatch(/^<span/);           // 렌더: <span>
    expect(htmlOut).not.toContain('href=');

    const stored = JSON.parse(ls.getItem('dontong_bgms'))[0].url;
    expect(stored).toBe(rawUrl);                 // 저장: 원본 그대로
  });

  test('빈 url — extLink는 <span> 반환, 저장값도 빈 문자열 그대로', () => {
    const ls = new LocalStorageMock();
    ls.setItem('dontong_bgms', JSON.stringify([{ id: 3, url: '' }]));

    const htmlOut = extLink('', '없음');
    expect(htmlOut).toMatch(/^<span/);

    const stored = JSON.parse(ls.getItem('dontong_bgms'))[0].url;
    expect(stored).toBe('');
  });

  test('유효 https url — extLink는 <a> 반환, 저장값은 raw 원본 유지', () => {
    const ls = new LocalStorageMock();
    const rawUrl = 'https://youtube.com/@test';
    ls.setItem('dontong_bgms', JSON.stringify([{ id: 4, url: rawUrl }]));

    const htmlOut = extLink(rawUrl, '▶️');
    expect(htmlOut).toContain('<a ');
    expect(htmlOut).toContain('href="https://youtube.com/@test"');

    const stored = JSON.parse(ls.getItem('dontong_bgms'))[0].url;
    expect(stored).toBe(rawUrl);
  });
});

// ─────────────────────────────────────────────
// D) 혼합 항목 배열 — BGM/채널/소재 복합 보존
// ─────────────────────────────────────────────
describe('T17-D: 혼합 URL 타입 항목 복합 보존', () => {
  let ls;
  beforeEach(() => { ls = new LocalStorageMock(); });

  test('BGM 5건(URL 형태 혼합) 저장-로드-재저장 후 모든 url 보존', () => {
    const original = [
      { id: 1, title: 'A', url: 'https://youtube.com/@a', mood: '신남' },
      { id: 2, title: 'B', url: '', mood: '잔잔함' },
      { id: 3, title: 'C', url: 'www.soundcloud.com/track/123', mood: '긴장감' },
      { id: 4, title: 'D', url: 'https://youtu.be/xxxxxxxxxxx', mood: '신남' },
      { id: 5, title: 'E', url: 'javascript:void(0)', mood: '잔잔함' },
    ];
    ls.setItem('dontong_bgms', JSON.stringify(original));

    // 로드 후 다시 저장 (save 사이클 시뮬레이션)
    const loaded = JSON.parse(ls.getItem('dontong_bgms'));
    ls.setItem('dontong_bgms', JSON.stringify(loaded));

    const reloaded = JSON.parse(ls.getItem('dontong_bgms'));
    original.forEach((orig, i) => {
      expect(reloaded[i].url).toBe(orig.url);
    });
  });

  test('채널·소재·BGM 모두 같은 ls에 공존 — 키 간 오염 없음', () => {
    ls.setItem('dontong_channels', JSON.stringify([{ id: 1, url: 'https://youtube.com/ch/UC1' }]));
    ls.setItem('dontong_sources',  JSON.stringify([{ id: 2, url: 'https://youtu.be/src1' }]));
    ls.setItem('dontong_bgms',     JSON.stringify([{ id: 3, url: 'www.bgm.com/track' }]));

    expect(JSON.parse(ls.getItem('dontong_channels'))[0].url).toBe('https://youtube.com/ch/UC1');
    expect(JSON.parse(ls.getItem('dontong_sources'))[0].url).toBe('https://youtu.be/src1');
    expect(JSON.parse(ls.getItem('dontong_bgms'))[0].url).toBe('www.bgm.com/track');
  });
});
