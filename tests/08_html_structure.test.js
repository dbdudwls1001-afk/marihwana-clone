/**
 * T08: index.html 구조 검증
 * - 5탭 SPA 구조
 * - backupModal 존재
 * - 헤더 💾 버튼
 * - 탭별 필수 요소 ID
 * - CSV import/export 버튼
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

describe('T08-1: 5탭 SPA 구조', () => {
  const TABS = ['channel', 'source', 'bgm', 'tchannel', 'tsource'];

  TABS.forEach(tab => {
    test(`탭 패널 #tab-${tab} 존재`, () => {
      expect(html).toContain(`id="tab-${tab}"`);
    });
    test(`탭 버튼 data-tab="${tab}" 존재`, () => {
      expect(html).toContain(`data-tab="${tab}"`);
    });
  });

  test('switchTab 함수 호출 (탭 클릭 연결)', () => {
    expect(html).toContain('switchTab(');
  });
});

describe('T08-2: 백업/복원 Modal 구조', () => {
  test('#backupModal 존재', () => {
    expect(html).toContain('id="backupModal"');
  });

  test('openBackupModal() 호출', () => {
    expect(html).toContain('openBackupModal()');
  });

  test('closeBackupModal() 호출', () => {
    expect(html).toContain('closeBackupModal()');
  });

  test('exportAllData() 호출', () => {
    expect(html).toContain('exportAllData()');
  });

  test('importAllData(this) 호출', () => {
    expect(html).toContain('importAllData(this)');
  });

  test('backup-restore-input 파일 input 존재', () => {
    expect(html).toContain('id="backup-restore-input"');
  });

  test('accept="application/json,.json" 속성', () => {
    expect(html).toContain('accept="application/json,.json"');
  });
});

describe('T08-3: 헤더 💾 버튼', () => {
  test('btn-backup 클래스 버튼', () => {
    expect(html).toContain('class="btn-backup"');
  });

  test('💾 이모지 존재', () => {
    expect(html).toContain('💾');
  });

  test('btn-backup-label 스팬 (반응형 라벨접힘용)', () => {
    expect(html).toContain('class="btn-backup-label"');
  });
});

describe('T08-4: 탭별 CSV 내보내기/가져오기 버튼', () => {
  const TABS_CSV = ['channel', 'source', 'bgm', 'tchannel', 'tsource'];
  const TAB_SHORT = { channel: 'ch', source: 'src', bgm: 'bgm', tchannel: 'tch', tsource: 'tsr' };

  TABS_CSV.forEach(tab => {
    const prefix = TAB_SHORT[tab];
    test(`${tab} 탭: downloadCSV('${tab}') 내보내기 버튼`, () => {
      expect(html).toContain(`downloadCSV('${tab}')`);
    });
    test(`${tab} 탭: ${prefix}-csv-input 파일 input`, () => {
      expect(html).toContain(`id="${prefix}-csv-input"`);
    });
    test(`${tab} 탭: importCSV('${tab}',this) 가져오기`, () => {
      expect(html).toContain(`importCSV('${tab}',this)`);
    });
  });
});

describe('T08-5: 탭별 검색·필터 요소', () => {
  test('ch-search 검색창', () => expect(html).toContain('id="ch-search"'));
  test('ch-filter 필터 셀렉트', () => expect(html).toContain('id="ch-filter"'));
  test('src-search 검색창', () => expect(html).toContain('id="src-search"'));
  test('bgm-search 검색창', () => expect(html).toContain('id="bgm-search"'));
  test('tch-search 검색창', () => expect(html).toContain('id="tch-search"'));
  test('tsr-search 검색창', () => expect(html).toContain('id="tsr-search"'));
});

// 정렬 헤더는 index.html의 onclick 속성에 있음
// 즐겨찾기·수정·삭제 버튼은 app.js의 동적 렌더 함수에서 생성됨 (app.js T10에서 검증)
const appSrc = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf-8');
describe('T08-6: 즐겨찾기·정렬·CRUD 연결', () => {
  test('sortChannel 정렬 호출 (HTML onclick)', () => expect(html).toContain("sortChannel('"));
  test('sortSource 정렬 호출 (HTML onclick)', () => expect(html).toContain("sortSource('"));
  test('sortBgm 정렬 호출 (HTML onclick)', () => expect(html).toContain("sortBgm('"));
  test('sortTChannel 정렬 호출 (HTML onclick)', () => expect(html).toContain("sortTChannel('"));
  test('sortTSource 정렬 호출 (HTML onclick)', () => expect(html).toContain("sortTSource('"));
  test('toggleFavItem 동적 렌더 (app.js)', () => expect(appSrc).toContain("toggleFavItem('"));
  test('editItem 동적 렌더 (app.js)', () => expect(appSrc).toContain("editItem('"));
  test('deleteItem 동적 렌더 (app.js)', () => expect(appSrc).toContain("deleteItem('"));
});

describe('T08-7: YouTube API 연동 UI', () => {
  test('#apiModal 존재', () => expect(html).toContain('id="apiModal"'));
  test('#apiDot 상태 인디케이터', () => expect(html).toContain('id="apiDot"'));
  test('saveApiKey() 호출', () => expect(html).toContain('saveApiKey()'));
  test('deleteApiKey() 호출', () => expect(html).toContain('deleteApiKey()'));
  test('fetchChannel() 호출', () => expect(html).toContain('fetchChannel()'));
  test('fetchSource() 호출', () => expect(html).toContain('fetchSource()'));
  test('fetchBgm() 호출', () => expect(html).toContain('fetchBgm()'));
});

describe('T08-8: 반응형 뷰포트 메타', () => {
  test('viewport meta 존재', () => {
    expect(html).toContain('name="viewport"');
    expect(html).toContain('width=device-width');
  });

  test('styles.css 링크', () => {
    expect(html).toContain('href="styles.css"');
  });
});
