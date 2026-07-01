/**
 * T02: XSS/보안 함수 테스트
 * - esc(): HTML 이스케이프
 * - cleanLabel(): 라벨 안전화 (' " < > 제거)
 * - safeUrl(): 위험 스킴 차단
 * - csvCell(): CSV 인젝션 방지
 * - safeFileName(): 파일명 위험 문자 제거
 */
const { esc, cleanLabel, safeUrl, csvCell, safeFileName } = require('./helpers');

describe('T02-1: esc() HTML 이스케이프', () => {
  test('& → &amp;', () => expect(esc('a&b')).toBe('a&amp;b'));
  test('< → &lt;', () => expect(esc('<script>')).toBe('&lt;script&gt;'));
  test('> → &gt;', () => expect(esc('a>b')).toBe('a&gt;b'));
  test('" → &quot;', () => expect(esc('"hello"')).toBe('&quot;hello&quot;'));
  test("' → &#39;", () => expect(esc("it's")).toBe('it&#39;s'));
  test('null/undefined → 빈문자', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc('')).toBe('');
  });
  test('숫자도 안전하게 처리', () => expect(esc(42)).toBe('42'));
});

describe('T02-2: cleanLabel() 라벨 안전화', () => {
  test("' 제거", () => expect(cleanLabel("it's")).toBe('its'));
  test('" 제거', () => expect(cleanLabel('"hello"')).toBe('hello'));
  test('< > 제거', () => expect(cleanLabel('<b>text</b>')).toBe('btext/b'));
  test('이모지·한글·기호는 통과', () => expect(cleanLabel('긴장감·신남~!')).toBe('긴장감·신남~!'));
  test('앞뒤 공백 trim', () => expect(cleanLabel('  abc  ')).toBe('abc'));
});

describe('T02-3: safeUrl() 위험 스킴 차단', () => {
  test('https: 통과', () => expect(safeUrl('https://youtube.com')).toBe('https://youtube.com'));
  test('http: 통과', () => expect(safeUrl('http://example.com')).toBe('http://example.com'));
  test('javascript: 차단 → #', () => expect(safeUrl('javascript:alert(1)')).toBe('#'));
  test('data: 차단 → #', () => expect(safeUrl('data:text/html,<h1>xss</h1>')).toBe('#'));
  test('빈값 → #', () => expect(safeUrl('')).toBe('#'));
  test('상대경로 → #', () => expect(safeUrl('/path/to')).toBe('#'));
});

describe('T02-4: csvCell() CSV 인젝션 방지', () => {
  test('= 로 시작하면 앞에 \' 추가', () => expect(csvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`));
  test('+ 로 시작하면 앞에 \'', () => expect(csvCell('+1')).toBe(`"'+1"`));
  test('- 로 시작하면 앞에 \'', () => expect(csvCell('-1')).toBe(`"'-1"`));
  test('@ 로 시작하면 앞에 \'', () => expect(csvCell('@handle')).toBe(`"'@handle"`));
  test('따옴표는 ""로 이스케이프', () => expect(csvCell('say "hi"')).toBe('"say ""hi"""'));
  test('일반 텍스트는 따옴표로만 감싸기', () => expect(csvCell('hello')).toBe('"hello"'));
});

describe('T02-5: safeFileName() 파일명 위험 문자 제거', () => {
  test('윈도우 금지문자 제거', () => expect(safeFileName('file:name*?')).toBe('filename'));
  test('슬래시 제거', () => expect(safeFileName('a/b\\c')).toBe('abc'));
  test('꺾쇠 제거', () => expect(safeFileName('a<b>c')).toBe('abc'));
  test('파이프 제거', () => expect(safeFileName('a|b')).toBe('ab'));
  test('연속 공백 → 단일 공백', () => expect(safeFileName('a  b')).toBe('a b'));
  test('한글·이모지는 통과', () => expect(safeFileName('에셋_백업_2024')).toBe('에셋_백업_2024'));
});
