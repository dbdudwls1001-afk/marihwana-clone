/**
 * T01: node --check app.js 문법 검사
 */
const { execSync } = require('child_process');
const path = require('path');

describe('T01: node --check 문법 검사', () => {
  test('app.js 문법 오류 없음', () => {
    const appPath = path.resolve(__dirname, '../app.js');
    expect(() => execSync(`node --check "${appPath}"`, { stdio: 'pipe' })).not.toThrow();
  });
});
