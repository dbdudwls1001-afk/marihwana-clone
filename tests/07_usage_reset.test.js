/**
 * T07: YouTube API 사용량 추적 · 리셋 로직
 */
const { LocalStorageMock, checkUsageReset } = require('./helpers');

const USAGE_RESET_HOUR = 8; // UTC

describe('T07-1: checkUsageReset() 사용량 리셋', () => {
  test('첫 실행 시 usage 0, reset 키 세팅', () => {
    const ls = new LocalStorageMock();
    checkUsageReset(ls);
    expect(ls.getItem('dontong_usage')).toBe('0');
    expect(ls.getItem('dontong_usage_reset')).toBeTruthy();
  });

  test('같은 리셋 경계 내 재호출 → usage 유지', () => {
    const ls = new LocalStorageMock();
    checkUsageReset(ls);
    ls.setItem('dontong_usage', '500');

    // 두 번째 호출 (같은 날, 리셋 시각 이후)
    checkUsageReset(ls);
    expect(ls.getItem('dontong_usage')).toBe('500'); // 유지
  });

  test('리셋 경계가 바뀌면 usage 0으로 초기화', () => {
    const ls = new LocalStorageMock();
    ls.setItem('dontong_usage', '3000');
    // 과거 리셋 키 세팅
    ls.setItem('dontong_usage_reset', '2020-01-01T08');

    checkUsageReset(ls);
    expect(ls.getItem('dontong_usage')).toBe('0');
  });

  test('usage_reset 키는 UTC 날짜+시 형식(13자)', () => {
    const ls = new LocalStorageMock();
    checkUsageReset(ls);
    const resetKey = ls.getItem('dontong_usage_reset');
    expect(resetKey).toHaveLength(13);
    expect(resetKey).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });
});
