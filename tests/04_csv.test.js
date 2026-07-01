/**
 * T04: CSV 파싱·포맷 테스트
 * - parseCSVRows(): RFC 4180 파서
 * - toIntCSV(): 숫자 파싱
 * - fmtNum() / fmtDate(): 디스플레이 포맷
 */
const { parseCSVRows, toIntCSV, fmtNum, fmtDate } = require('./helpers');

describe('T04-1: parseCSVRows() CSV 파서', () => {
  test('기본 헤더+데이터 파싱', () => {
    const rows = parseCSVRows('채널명,구독자\n테스트채널,1000\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['채널명', '구독자']);
    expect(rows[1]).toEqual(['테스트채널', '1000']);
  });

  test('따옴표 안의 쉼표 처리', () => {
    const rows = parseCSVRows('"Kim, Jun",100\n');
    expect(rows[0][0]).toBe('Kim, Jun');
    expect(rows[0][1]).toBe('100');
  });

  test('따옴표 안의 따옴표 이스케이프 ("") 처리', () => {
    const rows = parseCSVRows('"say ""hello""",ok\n');
    expect(rows[0][0]).toBe('say "hello"');
  });

  test('CRLF 줄바꿈 처리', () => {
    const rows = parseCSVRows('a,b\r\nc,d\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(['c', 'd']);
  });

  test('빈 파일(헤더만) → 1행', () => {
    const rows = parseCSVRows('헤더1,헤더2\n');
    expect(rows).toHaveLength(1);
  });

  test('5개 탭 헤더 검증 - channel', () => {
    const csv = '채널명,구독자,영상수,조회수,평균조회수,유형,스크랩이유,레퍼런스,결,링크\n';
    const rows = parseCSVRows(csv);
    expect(rows[0]).toContain('채널명');
    expect(rows[0]).toContain('구독자');
    expect(rows[0]).toHaveLength(10);
  });

  test('5개 탭 헤더 검증 - source', () => {
    const csv = '제목,채널,업로드일,조회수,유형,스크랩이유,내용,결,링크\n';
    const rows = parseCSVRows(csv);
    expect(rows[0]).toHaveLength(9);
  });

  test('5개 탭 헤더 검증 - bgm', () => {
    const csv = '곡명,분위기,메모,링크\n';
    const rows = parseCSVRows(csv);
    expect(rows[0]).toHaveLength(4);
  });

  test('5개 탭 헤더 검증 - tchannel', () => {
    const csv = '플랫폼,채널명,링크,벤치마킹이유,스타일특징\n';
    const rows = parseCSVRows(csv);
    expect(rows[0]).toHaveLength(5);
  });

  test('5개 탭 헤더 검증 - tsource', () => {
    const csv = '플랫폼,제목내용,링크,스크랩이유,스타일유형\n';
    const rows = parseCSVRows(csv);
    expect(rows[0]).toHaveLength(5);
  });
});

describe('T04-2: toIntCSV() 숫자 파싱', () => {
  test('일반 숫자 문자열', () => expect(toIntCSV('1000')).toBe(1000));
  test('쉼표 포함 숫자 (엑셀 출력 형식)', () => expect(toIntCSV('7,800')).toBe(7800));
  test('공백 포함', () => expect(toIntCSV(' 500 ')).toBe(500));
  test('빈문자 → 0', () => expect(toIntCSV('')).toBe(0));
  test('null → 0', () => expect(toIntCSV(null)).toBe(0));
  test('문자 섞인 값 → 0 또는 숫자 부분', () => expect(toIntCSV('abc')).toBe(0));
});

describe('T04-3: fmtNum() 숫자 포맷', () => {
  test('1억 이상 → 억 단위', () => expect(fmtNum(150000000)).toContain('억'));
  test('1만 이상 → 만 단위', () => expect(fmtNum(50000)).toContain('만'));
  test('1천 이상 → 천 단위', () => expect(fmtNum(5000)).toContain('천'));
  test('1천 미만 → 그대로', () => expect(fmtNum(999)).toBe('999'));
  test('0 → "0"', () => expect(fmtNum(0)).toBe('0'));
});

describe('T04-4: fmtDate() 날짜 포맷', () => {
  test('ISO 형식 → YYYY.MM.DD', () => {
    const result = fmtDate('2024-03-15T00:00:00.000Z');
    expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });
  test('빈값 → -', () => expect(fmtDate('')).toBe('-'));
  test('null → -', () => expect(fmtDate(null)).toBe('-'));
});
