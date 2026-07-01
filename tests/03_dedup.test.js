/**
 * T03: 중복 판정 로직
 * - channelDedupKey(): 채널 정규화 키
 * - bgmDedupMatch(): BGM 중복 매칭
 * - extractYouTubeId(): 유튜브 ID 추출
 */
const { channelDedupKey, bgmDedupMatch, extractYouTubeId } = require('./helpers');

describe('T03-1: extractYouTubeId()', () => {
  test('watch?v= 형식', () => expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ'));
  test('youtu.be 형식', () => expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ'));
  test('shorts 형식', () => expect(extractYouTubeId('https://www.youtube.com/shorts/F4F1H7Js3T4')).toBe('F4F1H7Js3T4'));
  test('embed 형식', () => expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ'));
  test('11자 ID 단독', () => expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ'));
  test('빈값 → 빈문자', () => expect(extractYouTubeId('')).toBe(''));
  test('유효하지 않은 URL → 빈문자', () => expect(extractYouTubeId('https://example.com')).toBe(''));
});

describe('T03-2: channelDedupKey() 채널 중복 키', () => {
  test('/channel/UC... → id: 키', () => {
    const k = channelDedupKey('https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx', '테스트');
    expect(k).toMatch(/^id:/);
  });
  test('@핸들 → handle: 키', () => {
    const k = channelDedupKey('https://www.youtube.com/@hothagun', '핫하군');
    expect(k).toBe('handle:hothagun');
  });
  test('뒤에 /videos 있어도 같은 handle 키', () => {
    const k1 = channelDedupKey('https://www.youtube.com/@hothagun', '핫하군');
    const k2 = channelDedupKey('https://www.youtube.com/@hothagun/videos', '핫하군');
    expect(k1).toBe(k2);
  });
  test('같은 channelId면 같은 키', () => {
    const k1 = channelDedupKey('https://www.youtube.com/channel/UCabcde12345', 'A');
    const k2 = channelDedupKey('https://www.youtube.com/channel/UCabcde12345', 'B');
    expect(k1).toBe(k2);
  });
  test('링크 없으면 채널명 기반 name: 키', () => {
    const k = channelDedupKey('', '채널A');
    expect(k).toBe('name:채널a');
  });
  test('대소문자 구분 없음', () => {
    const k1 = channelDedupKey('https://www.youtube.com/@TestChannel', 'TC');
    const k2 = channelDedupKey('https://www.youtube.com/@testchannel', 'TC');
    expect(k1).toBe(k2);
  });
});

describe('T03-3: bgmDedupMatch() BGM 중복 매칭', () => {
  test('같은 유튜브 ID → 중복', () => {
    const a = { url: 'https://youtu.be/dQw4w9WgXcQ' };
    const b = { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
    expect(bgmDedupMatch(a, b)).toBe(true);
  });
  test('다른 유튜브 ID → 비중복', () => {
    const a = { url: 'https://youtu.be/aaaaaaaaaaa' };
    const b = { url: 'https://youtu.be/bbbbbbbbbbb' };
    expect(bgmDedupMatch(a, b)).toBe(false);
  });
  test('링크 없으면 중복 판정 안 함', () => {
    const a = { url: '' };
    const b = { url: '' };
    expect(bgmDedupMatch(a, b)).toBe(false);
  });
  test('한쪽만 링크 없으면 비중복', () => {
    const a = { url: 'https://youtu.be/dQw4w9WgXcQ' };
    const b = { url: '' };
    expect(bgmDedupMatch(a, b)).toBe(false);
  });
  test('유튜브 아닌 동일 링크 → 중복', () => {
    const a = { url: 'https://soundcloud.com/track/abc' };
    const b = { url: 'https://soundcloud.com/track/abc' };
    expect(bgmDedupMatch(a, b)).toBe(true);
  });
});
