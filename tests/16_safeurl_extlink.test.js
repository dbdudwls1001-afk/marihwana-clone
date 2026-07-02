/**
 * T16: safeUrl() 스킴복구 + extLink() 렌더 검증
 *
 * 검증 범위:
 *   A) safeUrl() 유닛 — 스킴 누락 복구 / 원문 유지 / 차단 케이스
 *   B) extLink() 렌더 — 무효 URL → <span>, 유효 URL → <a target="_blank">
 */
const { safeUrl, extLink } = require('./helpers');

// ─────────────────────────────────────────────
// A) safeUrl() 유닛 테스트
// ─────────────────────────────────────────────
describe('T16-A: safeUrl() 스킴 복구 & 차단', () => {
  // 스킴 누락 복구
  test('www.x.com/y → https:// 복구', () => {
    expect(safeUrl('www.x.com/y')).toBe('https://www.x.com/y');
  });

  test('www.youtube.com/@handle → https:// 복구', () => {
    expect(safeUrl('www.youtube.com/@handle')).toBe('https://www.youtube.com/@handle');
  });

  // http/https 원문 유지
  test('https://x.com → 원문 유지', () => {
    expect(safeUrl('https://x.com')).toBe('https://x.com');
  });

  test('http://example.com → 원문 유지', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  // 차단 케이스
  test('빈 문자열 → #', () => {
    expect(safeUrl('')).toBe('#');
  });

  test('null/undefined → #', () => {
    expect(safeUrl(null)).toBe('#');
    expect(safeUrl(undefined)).toBe('#');
  });

  test('javascript:alert(1) → #', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
  });

  test('data:text/html,… → #', () => {
    expect(safeUrl('data:text/html,<h1>xss</h1>')).toBe('#');
  });

  test('mailto:a@b.com → #', () => {
    expect(safeUrl('mailto:a@b.com')).toBe('#');
  });

  test('순수 한글 텍스트(눈물한가득) → # (호스트에 점 없음)', () => {
    expect(safeUrl('눈물한가득')).toBe('#');
  });

  test('localhost → # (점 없음, TLD 없음)', () => {
    expect(safeUrl('localhost')).toBe('#');
  });

  test('상대경로(/path/to) → #', () => {
    expect(safeUrl('/path/to')).toBe('#');
  });
});

// ─────────────────────────────────────────────
// B) extLink() 렌더 테스트
// ─────────────────────────────────────────────
describe('T16-B: extLink() 렌더 — 유효 URL → <a>, 무효 → <span>', () => {
  // 유효 URL → <a>
  test('https URL → <a target="_blank" rel="noopener noreferrer">', () => {
    const out = extLink('https://example.com', '바로가기');
    expect(out).toContain('<a ');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('바로가기');
    expect(out).not.toContain('<a href="#"');
  });

  test('스킴 누락 URL(www.x.com) → 복구 후 <a>', () => {
    const out = extLink('www.x.com', '링크');
    expect(out).toContain('<a ');
    expect(out).toContain('href="https://www.x.com"');
    expect(out).not.toContain('<span');
  });

  // 무효 URL → <span> (href="#" 없음)
  test('빈값 → <span> (href="#" 없음)', () => {
    const out = extLink('', '소재없음');
    expect(out).toMatch(/^<span/);
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href="#"');
  });

  test('javascript:… → <span>', () => {
    const out = extLink('javascript:alert(1)', '클릭');
    expect(out).toMatch(/^<span/);
    expect(out).not.toContain('<a');
  });

  test('순수 한글(눈물한가득) → <span>', () => {
    const out = extLink('눈물한가득', '텍스트');
    expect(out).toMatch(/^<span/);
    expect(out).not.toContain('<a');
  });

  test('localhost → <span>', () => {
    const out = extLink('localhost', '로컬');
    expect(out).toMatch(/^<span/);
    expect(out).not.toContain('<a');
  });

  // attrs 전달 확인
  test('attrs(class="btn") 가 태그에 포함됨 — 유효 URL', () => {
    const out = extLink('https://x.com', '이동', 'class="btn"');
    expect(out).toContain('class="btn"');
    expect(out).toContain('<a ');
  });

  test('attrs(class="dead") 가 태그에 포함됨 — 무효 URL', () => {
    const out = extLink('', '없음', 'class="dead"');
    expect(out).toContain('class="dead"');
    expect(out).toMatch(/^<span/);
  });

  // innerHtml XSS 방어는 호출자 책임이지만 태그 구조 정합성 검증
  test('innerHtml 이 결과에 포함됨', () => {
    const out = extLink('https://a.com', '<img src="x">');
    expect(out).toContain('<img src="x">');
  });
});
