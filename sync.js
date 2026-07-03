/* ================================================================
 *  크로스디바이스 동기화 모듈 (옵션 B: Firebase Auth + Firestore 문서 blob)
 * ----------------------------------------------------------------
 *  설계: notes/arch-marihwana-sync.md (민준)
 *  - 기존 collectBackup() 백업 JSON 덩어리를 그대로 동기화 payload 로 사용
 *  - 기존 5탭 CRUD·백업/복원 로직은 건드리지 않고 "저장 위치만 추가"
 *  - Firestore users/{uid} 문서 1개 + onSnapshot 실시간 + 오프라인 캐시
 *  - 충돌: LWW(마지막 저장 승) — 개인 다기기용
 *  - 보안: YouTube API 키/사용량은 payload 에서 제외(기기별 로컬 유지)
 *
 *  이 파일은 classic script 로 app.js 뒤에 로드되어 app.js 의 전역
 *  (toast, collectBackup, BACKUP_KEYS 등)을 공유한다. Firebase compat SDK
 *  (firebase-app/auth/firestore-compat) 와 firebase-config.js 가 선행 로드돼야 한다.
 * ================================================================ */
(function () {
  'use strict';

  // ---- 동기화 대상 키: 전체 백업키에서 민감/기기별 항목 제외 ----
  // 제외: dontong_apikey(YouTube API 키), dontong_usage / dontong_usage_reset(기기별 호출 카운터)
  var EXCLUDE_FROM_SYNC = ['dontong_apikey', 'dontong_usage', 'dontong_usage_reset'];
  var SYNC_META_KEY = 'dontong_sync_applied';   // 로컬 상태가 이미 반영한 exportedAt 워터마크(에코 억제/루프 방지)

  // ---- 런타임 상태 ----
  var enabled = false;      // firebaseConfig 가 유효한가
  var fb = null;            // firebase app
  var auth = null;
  var db = null;
  var currentUser = null;
  var unsubDoc = null;      // onSnapshot 해제 함수
  var pushTimer = null;     // debounce 타이머
  var applyingRemote = false;
  var pendingRemote = null; // 사용자가 입력 중이라 보류된 원격 payload (dirty-guard)
  var pendingTimer = null;  // 보류분 재시도 타이머

  function syncKeys() {
    // BACKUP_KEYS 는 app.js 전역. 없으면 안전 폴백.
    var all = (typeof BACKUP_KEYS !== 'undefined' && Array.isArray(BACKUP_KEYS))
      ? BACKUP_KEYS
      : ['dontong_channels','dontong_sources','dontong_bgms','dontong_tchannels',
         'dontong_tsources','dontong_ctypes','dontong_favtypes','dontong_bgm_moods',
         'dontong_bgm_favmoods','dontong_apikey','dontong_usage','dontong_usage_reset','dontong_exporter'];
    return all.filter(function (k) { return EXCLUDE_FROM_SYNC.indexOf(k) === -1; });
  }

  function notify(msg, type) {
    if (typeof toast === 'function') toast(msg, type || '');
  }

  // ---- 동기화 payload 수집 (collectBackup 재사용 + 민감키 제거) ----
  function collectSyncPayload() {
    var wrapper;
    if (typeof collectBackup === 'function') {
      wrapper = collectBackup();                 // {app, schemaVersion, exportedAt, data:{...전체}}
    } else {
      wrapper = { app: 'marihwana-clone', schemaVersion: 1, exportedAt: new Date().toISOString(), data: {} };
    }
    var data = {};
    syncKeys().forEach(function (k) {
      if (wrapper.data && wrapper.data[k] != null) data[k] = wrapper.data[k];
    });
    return { app: wrapper.app, schemaVersion: wrapper.schemaVersion, exportedAt: wrapper.exportedAt, data: data };
  }

  // ---- 원격 payload 검증 (기존 복원 로직과 동일 기준) ----
  function isValidPayload(p) {
    if (!p || typeof p !== 'object') return false;
    if (p.app !== 'marihwana-clone') return false;
    if (typeof p.schemaVersion !== 'number') return false;
    if (!p.data || typeof p.data !== 'object') return false;
    return true;
  }

  // 사용자가 데이터 입력 필드에 작성 중인지(app.js 의 hasUnsavedInput 위임)
  function userIsTyping() {
    return (typeof hasUnsavedInput === 'function') && hasUnsavedInput();
  }

  // ---- 원격 → 로컬 적용 ----
  // (a) dirty-guard: 사용자가 입력 중이면 즉시 반영하지 않고 보류했다가, 입력이 끝나면 반영.
  // (b) 전체 페이지 리로드 대신 상태변수 재적용 + 재렌더(작성 중 텍스트/포커스 보존).
  function applyRemote(p) {
    if (!isValidPayload(p)) { return; }
    if (userIsTyping()) {
      // 최신 원격 상태만 보관(LWW). 입력 종료 감지되면 반영.
      pendingRemote = p;
      setStatus('syncing');
      if (!pendingTimer) {
        pendingTimer = setInterval(function () {
          if (userIsTyping() || !pendingRemote) return;
          var q = pendingRemote;
          pendingRemote = null;
          clearInterval(pendingTimer); pendingTimer = null;
          doApplyRemote(q);
        }, 1000);
      }
      return;
    }
    doApplyRemote(p);
  }

  function doApplyRemote(p) {
    if (!isValidPayload(p)) { return; }
    try {
      applyingRemote = true;
      var keys = syncKeys();
      keys.forEach(function (k) {
        if (p.data[k] != null) localStorage.setItem(k, p.data[k]);
        else localStorage.removeItem(k);        // 원격에 없는 동기화키는 로컬에서도 제거
      });
      localStorage.setItem(SYNC_META_KEY, p.exportedAt || '');
      setStatus('applied', p.exportedAt);
      // (b) 리로드 대신 앱 상태변수 재적용 + 재렌더 — 작성 중 입력·포커스·스크롤 보존
      if (typeof reloadStateAndRender === 'function') {
        reloadStateAndRender();
        notify('다른 기기의 변경을 불러왔습니다.', 'success');
        applyingRemote = false;
        setStatus('synced', p.exportedAt);
      } else {
        // 폴백: 재렌더 훅이 없으면 기존 방식(전체 리로드)
        notify('다른 기기의 변경을 불러왔습니다. 새로고침합니다…', 'success');
        setTimeout(function () { location.reload(); }, 600);
      }
    } catch (e) {
      applyingRemote = false;
      notify('동기화 적용 실패: ' + (e && e.message ? e.message : e), 'error');
    }
  }

  // ---- 로컬 → 원격 push (debounce) ----
  function schedulePush() {
    if (!enabled || !currentUser || applyingRemote) return;
    if (pushTimer) clearTimeout(pushTimer);
    setStatus('syncing');
    pushTimer = setTimeout(pushNow, 1200);
  }

  function pushNow() {
    if (!enabled || !currentUser) return;
    var payload = collectSyncPayload();
    var docRef = db.collection('users').doc(currentUser.uid);
    var toWrite = {
      app: payload.app,
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt,
      data: payload.data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    docRef.set(toWrite)
      .then(function () {
        // 우리가 방금 쓴 상태를 워터마크로 기록 → 곧 도착할 자기 에코 스냅샷 무시
        localStorage.setItem(SYNC_META_KEY, payload.exportedAt);
        setStatus('synced', payload.exportedAt);
      })
      .catch(function (e) {
        setStatus('error');
        notify('클라우드 저장 실패: ' + (e && e.message ? e.message : e), 'error');
      });
  }

  // ---- onSnapshot 구독 ----
  function subscribe() {
    if (!currentUser) return;
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
    var docRef = db.collection('users').doc(currentUser.uid);
    unsubDoc = docRef.onSnapshot({ includeMetadataChanges: false }, function (snap) {
      if (!snap.exists) {
        // 원격 문서 없음 → 이 기기 로컬 데이터를 최초 업로드
        pushNow();
        return;
      }
      var remote = snap.data();
      if (!isValidPayload(remote)) return;
      var applied = localStorage.getItem(SYNC_META_KEY) || '';
      if (remote.exportedAt && remote.exportedAt === applied) {
        // 우리가 반영/전송한 바로 그 상태 → 에코, 무시
        setStatus('synced', remote.exportedAt);
        return;
      }
      // 다른(더 최신) 원격 상태 → 적용
      applyRemote(remote);
    }, function (err) {
      setStatus('error');
      notify('실시간 동기화 오류: ' + (err && err.message ? err.message : err), 'error');
    });
  }

  // ================= 인증 =================
  function signIn() {
    if (!enabled) return;
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function (e) {
      notify('로그인 실패: ' + (e && e.message ? e.message : e), 'error');
    });
  }

  function signOutUser() {
    if (!enabled) return;
    auth.signOut().catch(function (e) {
      notify('로그아웃 실패: ' + (e && e.message ? e.message : e), 'error');
    });
  }

  // 헤더 버튼 onclick 진입점 (전역 노출)
  window.syncAuthToggle = function () {
    if (!enabled) {
      notify('동기화가 설정되지 않았습니다. FIREBASE_SETUP.md 를 참고하세요.', 'error');
      return;
    }
    if (currentUser) signOutUser();
    else signIn();
  };

  // ================= UI =================
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function setStatus(state, stamp) {
    var el = document.getElementById('syncStatus');
    if (!el) return;
    var map = {
      syncing: { t: '동기화 중…', c: 'syncing' },
      synced:  { t: '동기화됨 · ' + fmtTime(stamp), c: 'ok' },
      applied: { t: '불러오는 중…', c: 'syncing' },
      error:   { t: '동기화 오류', c: 'err' },
      off:     { t: '', c: '' }
    };
    var s = map[state] || map.off;
    el.textContent = s.t;
    el.className = 'sync-status ' + s.c;
  }

  function renderAuthUI() {
    var btn = document.getElementById('syncAuthBtn');
    var label = document.getElementById('syncAuthLabel');
    var icon = document.getElementById('syncAuthIcon');
    var status = document.getElementById('syncStatus');
    if (!btn) return;

    if (!enabled) {
      // 동기화 미설정 → 버튼/상태 숨김, 앱은 로컬 단독 동작(하위호환)
      btn.style.display = 'none';
      if (status) status.style.display = 'none';
      return;
    }
    btn.style.display = '';
    if (status) status.style.display = '';

    if (currentUser) {
      if (label) label.textContent = '로그아웃';
      if (icon) icon.textContent = '☁️';
      btn.title = (currentUser.email || currentUser.displayName || '로그인됨') + ' · 클릭하면 로그아웃';
      btn.classList.add('signed-in');
    } else {
      if (label) label.textContent = '로그인';
      if (icon) icon.textContent = '☁️';
      btn.title = '구글 계정으로 로그인하여 여러 기기 동기화';
      btn.classList.remove('signed-in');
      setStatus('off');
    }
  }

  // ================= 로컬 변경 감지 훅 =================
  // 기존 코드를 수정하지 않기 위해 localStorage.setItem/removeItem 을 감싼다.
  // 동기화 대상 키가 바뀌면 debounce push 예약.
  function installStorageHook() {
    var origSet = localStorage.setItem.bind(localStorage);
    var origRemove = localStorage.removeItem.bind(localStorage);
    var keys = syncKeys();
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      if (!applyingRemote && keys.indexOf(k) !== -1) schedulePush();
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      if (!applyingRemote && keys.indexOf(k) !== -1) schedulePush();
    };
  }

  // ================= 초기화 =================
  function configValid(cfg) {
    return cfg && typeof cfg.apiKey === 'string' && cfg.apiKey.trim() !== '' &&
           typeof cfg.projectId === 'string' && cfg.projectId.trim() !== '';
  }

  function init() {
    var cfg = window.FIREBASE_CONFIG;
    enabled = !!(typeof firebase !== 'undefined' && configValid(cfg));

    if (!enabled) {
      renderAuthUI();   // 버튼 숨김
      return;           // 앱은 기존 localStorage 단독으로 정상 동작
    }

    try {
      fb = firebase.initializeApp(cfg);
      auth = firebase.auth();
      db = firebase.firestore();
      // 오프라인 캐시(가능하면). 다중 탭 미지원 브라우저 대비 try/catch.
      db.enablePersistence({ synchronizeTabs: true }).catch(function () { /* 무시 */ });
    } catch (e) {
      enabled = false;
      renderAuthUI();
      notify('Firebase 초기화 실패: ' + (e && e.message ? e.message : e), 'error');
      return;
    }

    installStorageHook();
    renderAuthUI();

    auth.onAuthStateChanged(function (user) {
      currentUser = user || null;
      renderAuthUI();
      if (currentUser) {
        setStatus('syncing');
        subscribe();
      } else {
        if (unsubDoc) { unsubDoc(); unsubDoc = null; }
        setStatus('off');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
