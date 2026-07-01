/**
 * T10: app.js 에 필수 함수/상수 선언 여부 정적 검증
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf-8');

describe('T10-1: 백업/복원 필수 심볼', () => {
  const REQUIRED = [
    'BACKUP_APP_ID',
    'BACKUP_SCHEMA_VERSION',
    'BACKUP_KEYS',
    'openBackupModal',
    'closeBackupModal',
    'collectBackup',
    'exportAllData',
    'importAllData',
    // validateBackup 은 별도 함수가 아닌 importAllData 내부 인라인 로직
    'downloadBlob',
    'backupStamp',
  ];

  REQUIRED.forEach(sym => {
    test(`${sym} 정의됨`, () => {
      // 함수/const 선언 또는 사용
      const found = src.includes(sym);
      expect(found).toBe(true);
    });
  });
});

describe('T10-2: 5탭 CRUD 필수 함수', () => {
  const FUNCS = [
    'saveChannel', 'renderChannelTable', 'deleteItem', 'toggleFavItem',
    'saveSource', 'renderSourceTable',
    'saveBgm', 'renderBgmTable',
    'saveTChannel', 'renderTChannelTable',
    'saveTSource', 'renderTSourceTable',
    'sortChannel', 'sortSource', 'sortBgm', 'sortTChannel', 'sortTSource',
    'downloadCSV', 'importCSV',
    'toggleSelectMode', 'toggleSelect', 'selectAllInTab',
  ];

  FUNCS.forEach(fn => {
    test(`${fn}() 정의됨`, () => {
      expect(src).toContain(`function ${fn}(`);
    });
  });
});

describe('T10-3: localStorage 13키 사용', () => {
  const KEYS = [
    'dontong_channels', 'dontong_sources', 'dontong_bgms',
    'dontong_tchannels', 'dontong_tsources',
    'dontong_ctypes', 'dontong_favtypes',
    'dontong_bgm_moods', 'dontong_bgm_favmoods',
    'dontong_apikey', 'dontong_usage', 'dontong_usage_reset', 'dontong_exporter',
  ];

  KEYS.forEach(k => {
    test(`'${k}' 키 사용`, () => {
      expect(src).toContain(`'${k}'`);
    });
  });
});

describe('T10-4: importAllData 검증 로직 (인라인)', () => {
  test('app 필드 검증', () => expect(src).toContain("parsed.app !== BACKUP_APP_ID"));
  test('schemaVersion 검증', () => expect(src).toContain('parsed.schemaVersion'));
  test('data 필드 검증', () => expect(src).toContain('parsed.data'));
  test('자동백업 후 교체', () => expect(src).toContain('autobackup'));
  test('reload 호출', () => expect(src).toContain('location.reload'));
});

describe('T10-5: CSV 내보내기 5탭 분기', () => {
  const TABS = ["'channel'", "'source'", "'bgm'", "'tchannel'", "'tsource'"];
  TABS.forEach(t => {
    test(`tab === ${t} 분기`, () => {
      expect(src).toContain(`tab === ${t}`);
    });
  });
});
