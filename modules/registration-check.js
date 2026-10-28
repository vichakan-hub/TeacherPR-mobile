/**
 * TeacherPR - ตรวจสอบการลงทะเบียน 2/2569 (โมดูลชั่วคราว)
 * ติดตั้ง: <script type="module" src="./modules/registration-check.js?v=2569-2-1"></script>
 * ถอดออก: ลบบรรทัด <script> ดังกล่าวใน index.html เพียงบรรทัดเดียว
 *
 * ความปลอดภัย:
 * - ห้ามแนบข้อมูลนักเรียน/ไฟล์ Excel นี้ไปเป็น JSON ที่เปิดสาธารณะ
 * - API ต้องตรวจ teacher session กับ Supabase และจำกัดห้องที่ครูได้รับสิทธิ์ฝั่ง SERVER
 * - ห้ามใช้ URL หน้าแบบฟอร์ม Google Apps Script เป็น API โดยยังไม่ตรวจรูปแบบผลลัพธ์และสิทธิ์
 */

const CONFIG = Object.freeze({
  academicYear: 2569,
  term: 2,
  // ใส่ URL หลังทำ API ที่ตรวจสิทธิ์แล้วเท่านั้น (เช่น Supabase Edge Function)
  apiUrl: ''
});

const id = x => document.getElementById(x);
const ui = { rows: [], hasLoaded: false, isLoading: false };

const CSS = `
.regcheck-launch .action-icon { background:#eaf2ff; color:#1d4ed8; }
.regcheck-view {
  position:fixed; z-index:110; inset:0; left:50%; transform:translateX(-50%);
  width:min(430px,100vw); height:100vh; height:100dvh;
  overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch;
  background:#f4f7fb; font-family:Kanit,sans-serif; color:#17263c;
}
.regcheck-hero {
  padding:calc(24px + env(safe-area-inset-top, 0px)) 16px 24px;
  background:linear-gradient(135deg,#1d4ed8,#2563eb 55%,#22b8cf);
  color:#fff; border-radius:0 0 28px 28px;
}
.regcheck-back {
  border:1px solid rgba(255,255,255,.3); border-radius:14px;
  background:rgba(255,255,255,.16); color:white;
  font:800 14px Kanit,sans-serif; padding:10px 14px; min-height:43px;
}
.regcheck-hero h2 { margin:16px 0 2px; font-size:26px; font-weight:800; }
.regcheck-hero p { margin:0; opacity:.88; font-size:13px; font-weight:600; }
.regcheck-body { padding:16px 15px 36px; }
.regcheck-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.regcheck-stat {
  padding:12px 8px; background:#fff; border:1px solid #e1e9f4;
  border-radius:17px; text-align:center;
}
.regcheck-stat b { display:block; font-size:23px; color:#1d4ed8; }
.regcheck-stat span { display:block; font-size:11px; font-weight:700; color:#64748b; }
.regcheck-panel {
  margin-top:13px; padding:15px; border-radius:20px; background:#fff;
  border:1px solid #e1e9f4; box-shadow:0 6px 16px rgba(15,23,42,.04);
}
.regcheck-control { display:grid; gap:4px; margin-bottom:11px; }
.regcheck-control label { font-size:12px; font-weight:800; color:#516178; }
.regcheck-control select,.regcheck-control input {
  width:100%; height:44px; padding:0 12px; border:1px solid #d6e1ec;
  border-radius:13px; background:#fff; color:#17324a; font:600 14px Kanit,sans-serif;
}
.regcheck-refresh {
  width:100%; min-height:45px; background:#2563eb; color:white;
  border:0; border-radius:14px; font:800 14px Kanit,sans-serif;
}
.regcheck-refresh:disabled { opacity:.6; }
.regcheck-status { padding:11px 12px; border-radius:13px; background:#fff7ed;
  color:#92400e; font-size:12px; font-weight:700; line-height:1.6; margin-top:12px; }
.regcheck-status.error { background:#fff1f2; color:#be123c; }
.regcheck-status.success { background:#effcf3; color:#166534; }
.regcheck-list { display:grid; gap:9px; margin-top:12px; }
.regcheck-item { background:#fff; border:1px solid #dfe8f1; border-radius:16px; padding:12px; }
.regcheck-item-head { display:flex; gap:10px; justify-content:space-between; align-items:flex-start; }
.regcheck-item-name { font-size:14px; font-weight:800; }
.regcheck-item-meta { font-size:12px; color:#64748b; line-height:1.65; }
.regcheck-chip { display:inline-flex; white-space:nowrap; border-radius:999px;
  padding:5px 9px; font-size:11px; font-weight:800; }
.regcheck-chip.ok { color:#15803d; background:#e9f8ef; }
.regcheck-chip.pending { color:#b45309; background:#fff7e8; }
.regcheck-item-extra { margin-top:7px; font-size:12px; color:#475569; line-height:1.65; }
.regcheck-empty { padding:22px 14px; background:#fff; border-radius:16px;
  color:#64748b; font-size:13px; text-align:center; }
.regcheck-count { margin-top:12px; font-size:11px; font-weight:700; color:#64748b; text-align:center; }
`;

function setStatus(message, type='warn') {
  const el = id('regcheckStatus');
  if (!el) return;
  el.textContent = message;
  el.className = 'regcheck-status' + (type === 'error' || type === 'success' ? ` ${type}` : '');
}

function getTeacherToken() {
  // ใช้ชื่อ storage token เดิมใน TeacherPR Mobile เท่านั้น
  return String(
    sessionStorage.getItem('teacherMobileSessionToken') ||
    localStorage.getItem('teacherMobileSessionToken') || ''
  ).trim();
}

function textEl(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = String(value ?? '');
  return node;
}

function closeRegistrationCheck() {
  const view = id('registrationCheckView');
  if (!view) return;
  view.classList.add('hidden');
  view.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = view.dataset.previousBodyOverflow || '';
}

function openRegistrationCheck() {
  const view = id('registrationCheckView');
  if (!view) return;
  view.dataset.previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  view.classList.remove('hidden');
  view.setAttribute('aria-hidden', 'false');
  if (!ui.hasLoaded) void loadRegistrationCheck();
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) throw new Error('รูปแบบ API ไม่ถูกต้อง: ต้องมี rows เป็น Array');
  return rows.map(raw => ({
    student_code: String(raw.student_code ?? '').trim(),
    student_name: String(raw.student_name ?? '').trim(),
    class_room: String(raw.class_room ?? '').trim(),
    student_no: raw.student_no == null ? '' : String(raw.student_no),
    registered: raw.registered === true,
    study_plan: String(raw.study_plan ?? '').trim(),
    international_language: String(raw.international_language ?? '').trim(),
    repeat_subject_count: Number(raw.repeat_subject_count) || 0
  })).filter(r => r.student_code);
}

function updateRooms() {
  const select = id('regcheckRoom');
  const oldValue = select.value;
  select.replaceChildren(new Option('ทุกห้องที่ได้รับสิทธิ์', ''));
  const rooms = [...new Set(ui.rows.map(row => row.class_room).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'th', {numeric:true}));
  rooms.forEach(room => select.add(new Option(room, room)));
  if (rooms.includes(oldValue)) select.value = oldValue;
}

function renderRows() {
  const filterRoom = id('regcheckRoom').value;
  const keyword = id('regcheckSearch').value.trim().toLocaleLowerCase('th');
  const scopeRows = ui.rows.filter(row => !filterRoom || row.class_room === filterRoom);
  const rows = scopeRows.filter(row => !keyword ||
    row.student_code.toLocaleLowerCase('th').includes(keyword) ||
    row.student_name.toLocaleLowerCase('th').includes(keyword));

  id('regcheckTotal').textContent = ui.hasLoaded ? scopeRows.length : '–';
  id('regcheckDone').textContent = ui.hasLoaded ? scopeRows.filter(x=>x.registered).length : '–';
  id('regcheckPending').textContent = ui.hasLoaded ? scopeRows.filter(x=>!x.registered).length : '–';
  const list = id('regcheckList');
  list.replaceChildren();

  if (!ui.hasLoaded) {
    list.append(textEl('div','regcheck-empty','ยังไม่เชื่อมต่อข้อมูล Google Sheets'));
    id('regcheckCount').textContent = '';
    return;
  }
  if (!rows.length) {
    list.append(textEl('div','regcheck-empty','ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก'));
    id('regcheckCount').textContent = '';
    return;
  }
  const maxItems = 120;
  rows.slice(0,maxItems).forEach(row => {
    const card = textEl('div','regcheck-item','');
    const head = textEl('div','regcheck-item-head','');
    const nameWrap = document.createElement('div');
    nameWrap.append(textEl('div','regcheck-item-name',row.student_name || 'ไม่ระบุชื่อ'));
    nameWrap.append(textEl('div','regcheck-item-meta',`${row.student_code} • ${row.class_room || '-'} • เลขที่ ${row.student_no || '-'}`));
    head.append(nameWrap);
    head.append(textEl('span',`regcheck-chip ${row.registered ? 'ok' : 'pending'}`,
      row.registered ? 'ลงทะเบียนแล้ว' : 'ยังไม่ลงทะเบียน'));
    card.append(head);
    if (row.registered && row.study_plan) card.append(textEl('div','regcheck-item-extra',`แผนการเรียน: ${row.study_plan}`));
    if (row.registered && row.international_language) card.append(textEl('div','regcheck-item-extra',`ภาษานานาชาติ: ${row.international_language}`));
    if (row.repeat_subject_count > 0) card.append(textEl('div','regcheck-item-extra',`ลงทะเบียนเรียนซ้ำ: ${row.repeat_subject_count} วิชา`));
    list.append(card);
  });
  id('regcheckCount').textContent = rows.length > maxItems
    ? `แสดง ${maxItems} จาก ${rows.length} คน กรุณาเลือกห้องหรือค้นหาเพื่อจำกัดรายการ`
    : `แสดง ${rows.length} คน`;
}

async function loadRegistrationCheck() {
  if (ui.isLoading) return;
  if (!CONFIG.apiUrl) {
    setStatus('ติดตั้งเมนูสำเร็จแล้ว แต่ยังไม่ได้เชื่อม API ที่อ่าน Google Sheets แบบตรวจสิทธิ์ครู จึงยังไม่แสดงข้อมูลนักเรียน');
    return;
  }
  const token = getTeacherToken();
  if (!token) {
    setStatus('ไม่พบ Teacher Session กรุณาเข้าสู่ระบบใหม่', 'error');
    return;
  }
  ui.isLoading = true;
  const button = id('regcheckRefresh');
  button.disabled = true;
  button.textContent = 'กำลังโหลด...';
  setStatus('กำลังโหลดข้อมูลลงทะเบียน...');
  try {
    // Endpoint ต้อง validate p_token ฝั่ง server และส่งข้อมูลเฉพาะห้องที่ครูมีสิทธิ์
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, academic_year: CONFIG.academicYear, term: CONFIG.term }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`API ตอบกลับ HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.ok !== true) throw new Error(payload?.message || 'API ไม่อนุญาตให้ดูข้อมูล');
    ui.rows = normalizeRows(payload.rows);
    ui.hasLoaded = true;
    updateRooms();
    renderRows();
    setStatus(`โหลดข้อมูลลงทะเบียน ภาคเรียน ${CONFIG.term}/${CONFIG.academicYear} แล้ว`, 'success');
  } catch (error) {
    setStatus(error?.message || 'โหลดข้อมูล Google Sheets ไม่สำเร็จ', 'error');
  } finally {
    button.disabled = false;
    button.textContent = '↻ โหลดข้อมูลล่าสุด';
    ui.isLoading = false;
  }
}

function initRegistrationCheck() {
  const afterButton = id('goBookingBtn');
  const app = id('appView');
  if (!afterButton || !app || id('goRegistrationCheckBtn')) return;

  const style = document.createElement('style');
  style.id = 'registration-check-module-style';
  style.textContent = CSS;
  document.head.append(style);

  const button = document.createElement('button');
  button.id = 'goRegistrationCheckBtn';
  button.type = 'button';
  button.className = 'action-card regcheck-launch';
  button.innerHTML = `
    <div class="action-inner">
      <div class="action-icon">📋</div>
      <div><div class="action-title">ตรวจสอบลงทะเบียน</div>
      <div class="action-text">ตรวจสอบสถานะลงทะเบียนรายวิชา ภาคเรียน 2/2569</div></div>
    </div>`;
  afterButton.insertAdjacentElement('afterend', button);

  const page = document.createElement('section');
  page.id = 'registrationCheckView';
  page.className = 'regcheck-view hidden';
  page.setAttribute('role','dialog');
  page.setAttribute('aria-modal','true');
  page.setAttribute('aria-hidden','true');
  page.innerHTML = `
    <header class="regcheck-hero">
      <button id="regcheckBack" type="button" class="regcheck-back">← กลับหน้าแรก</button>
      <h2>📋 ตรวจสอบลงทะเบียน</h2>
      <p>ภาคเรียนที่ 2 ปีการศึกษา 2569 • ข้อมูลจาก Google Sheets</p>
    </header>
    <div class="regcheck-body">
      <div class="regcheck-stats">
        <div class="regcheck-stat"><b id="regcheckTotal">–</b><span>นักเรียนทั้งหมด</span></div>
        <div class="regcheck-stat"><b id="regcheckDone">–</b><span>ลงทะเบียนแล้ว</span></div>
        <div class="regcheck-stat"><b id="regcheckPending">–</b><span>ยังไม่ลงทะเบียน</span></div>
      </div>
      <div class="regcheck-panel">
        <div class="regcheck-control"><label for="regcheckRoom">ห้องเรียน</label>
          <select id="regcheckRoom"><option value="">ทุกห้องที่ได้รับสิทธิ์</option></select></div>
        <div class="regcheck-control"><label for="regcheckSearch">ค้นหานักเรียน</label>
          <input id="regcheckSearch" placeholder="รหัสนักเรียน / ชื่อ-นามสกุล" autocomplete="off" /></div>
        <button type="button" id="regcheckRefresh" class="regcheck-refresh">↻ โหลดข้อมูลล่าสุด</button>
        <div id="regcheckStatus" class="regcheck-status" role="status" aria-live="polite">ยังไม่ได้โหลดข้อมูล</div>
      </div>
      <div id="regcheckList" class="regcheck-list"></div>
      <div id="regcheckCount" class="regcheck-count"></div>
    </div>`;
  app.append(page);

  button.addEventListener('click',openRegistrationCheck);
  id('regcheckBack').addEventListener('click',closeRegistrationCheck);
  id('regcheckRefresh').addEventListener('click',loadRegistrationCheck);
  id('regcheckRoom').addEventListener('change',renderRows);
  id('regcheckSearch').addEventListener('input',renderRows);
  page.addEventListener('keydown', event => { if(event.key === 'Escape') closeRegistrationCheck(); });
  renderRows();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRegistrationCheck, {once:true});
} else {
  initRegistrationCheck();
}

export { initRegistrationCheck };
