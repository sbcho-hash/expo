const STORAGE_KEY = 'vlux-expo-field-note-v1';
const DEFAULT_SETTINGS = {
  eventName: 'Interzoo 2026',
  purpose: '글로벌 펫 시장의 제품 설계 방식과 기능성 표현 트렌드를 확인하고, 향후 제품기획에 활용 가능한 인사이트를 확보한다.',
  focus: '기능성 표현, 신제형, 패키지, 수출전략, 프라이빗라벨'
};

const CHECKLIST = [
  '프라이빗 라벨 가능성',
  '자사와 유사 컨셉',
  '신제형/신포장',
  '기능성 표현 방식',
  '원료 조합 참고',
  '수출 전략 참고',
  '진열/패키지 우수',
  '내 반려동물에게 사용 의향'
];

const TAGS = [
  '신제형', '기능성 표현', '패키지', '수출전략', 'OEM/ODM', '원료', '구강케어', '피부/미용',
  '장/소화', '저지방/체중', 'OTC/약용', '습식/간식', '테크/서비스', '가격/채널', '재방문'
];

let state = loadState();
let deferredInstallPrompt = null;
let currentPhotoData = '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  eventEyebrow: $('#eventEyebrow'),
  installBtn: $('#installBtn'),
  metricsGrid: $('#metricsGrid'),
  recordsList: $('#recordsList'),
  emptyState: $('#emptyState'),
  searchInput: $('#searchInput'),
  statusFilter: $('#statusFilter'),
  tagFilter: $('#tagFilter'),
  quickAddBtn: $('#quickAddBtn'),
  dialog: $('#recordDialog'),
  form: $('#recordForm'),
  dialogTitle: $('#dialogTitle'),
  closeDialogBtn: $('#closeDialogBtn'),
  deleteRecordBtn: $('#deleteRecordBtn'),
  saveDraftBtn: $('#saveDraftBtn'),
  photoInput: $('#photoInput'),
  photoPreview: $('#photoPreview'),
  removePhotoBtn: $('#removePhotoBtn'),
  checklistGroup: $('#checklistGroup'),
  tagGroup: $('#tagGroup'),
  reportBox: $('#reportBox'),
  copyReportBtn: $('#copyReportBtn'),
  downloadReportBtn: $('#downloadReportBtn'),
  settingsForm: $('#settingsForm'),
  exportJsonBtn: $('#exportJsonBtn'),
  importJsonInput: $('#importJsonInput'),
  clearDataBtn: $('#clearDataBtn'),
  toast: $('#toast')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.records)) {
      return {
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
        records: saved.records
      };
    }
  } catch (error) {
    console.warn('Unable to load saved state', error);
  }
  return { settings: { ...DEFAULT_SETTINGS }, records: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function uid() {
  return `expo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function averageScore(record) {
  const scores = [record.scoreRelevance, record.scoreNovelty, record.scoreApplicability]
    .map(Number)
    .filter((score) => !Number.isNaN(score));
  if (!scores.length) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function makePillGroup(container, values, name) {
  container.innerHTML = values.map((value) => `
    <label class="pill-check">
      <input type="checkbox" name="${name}" value="${escapeHtml(value)}" />
      <span>${escapeHtml(value)}</span>
    </label>
  `).join('');
}

function getCheckedValues(name) {
  return $$(`input[name="${name}"]:checked`).map((input) => input.value);
}

function setCheckedValues(name, values = []) {
  $$(`input[name="${name}"]`).forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

function init() {
  makePillGroup(els.checklistGroup, CHECKLIST, 'checklist');
  makePillGroup(els.tagGroup, TAGS, 'tags');
  renderTagOptions();
  bindEvents();
  hydrateSettingsForm();
  renderAll();
  registerServiceWorker();
}

function bindEvents() {
  els.quickAddBtn.addEventListener('click', () => openRecordDialog());
  $$('[data-open-form]').forEach((button) => button.addEventListener('click', () => openRecordDialog()));
  els.closeDialogBtn.addEventListener('click', closeDialog);
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveRecord();
  });
  els.saveDraftBtn.addEventListener('click', saveRecord);
  els.deleteRecordBtn.addEventListener('click', deleteCurrentRecord);
  els.searchInput.addEventListener('input', renderRecords);
  els.statusFilter.addEventListener('change', renderRecords);
  els.tagFilter.addEventListener('change', renderRecords);

  $$('input[type="range"]').forEach((range) => {
    const output = range.parentElement.querySelector('output');
    const update = () => { output.value = range.value; output.textContent = range.value; };
    range.addEventListener('input', update);
    update();
  });

  els.photoInput.addEventListener('change', handlePhotoUpload);
  els.removePhotoBtn.addEventListener('click', () => {
    currentPhotoData = '';
    els.photoInput.value = '';
    updatePhotoPreview('');
  });

  $$('.nav-item').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });

  els.copyReportBtn.addEventListener('click', copyReport);
  els.downloadReportBtn.addEventListener('click', downloadReport);
  els.settingsForm.addEventListener('submit', saveSettings);
  els.exportJsonBtn.addEventListener('click', exportJson);
  els.importJsonInput.addEventListener('change', importJson);
  els.clearDataBtn.addEventListener('click', clearData);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function renderAll() {
  els.eventEyebrow.textContent = state.settings.eventName || '전시회 현장 기록';
  renderMetrics();
  renderTagOptions();
  renderRecords();
  renderReport();
}

function renderMetrics() {
  const total = state.records.length;
  const reportIncluded = state.records.filter((record) => record.status === '보고 포함').length;
  const highPriority = state.records.filter((record) => record.priority === 'A').length;
  const average = total ? (state.records.reduce((sum, record) => sum + averageScore(record), 0) / total).toFixed(1) : '0.0';

  const cards = [
    ['총 기록', total],
    ['보고 포함', reportIncluded],
    ['A 우선순위', highPriority],
    ['평균 점수', average]
  ];
  els.metricsGrid.innerHTML = cards.map(([label, value]) => `
    <div class="metric-card"><strong>${value}</strong><span>${label}</span></div>
  `).join('');
}

function renderTagOptions() {
  const selected = els.tagFilter.value || 'all';
  const usedTags = Array.from(new Set(state.records.flatMap((record) => record.tags || []))).sort();
  const allTags = usedTags.length ? usedTags : TAGS;
  els.tagFilter.innerHTML = '<option value="all">전체 태그</option>' + allTags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
  els.tagFilter.value = allTags.includes(selected) ? selected : 'all';
}

function getFilteredRecords() {
  const query = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const tag = els.tagFilter.value;

  return state.records
    .filter((record) => status === 'all' || record.status === status)
    .filter((record) => tag === 'all' || (record.tags || []).includes(tag))
    .filter((record) => {
      if (!query) return true;
      return [
        record.brandName, record.country, record.boothNo, record.category, record.oneLineRole,
        record.replacedAction, record.whyInteresting, record.notes, record.nextAction, record.contact,
        ...(record.tags || []), ...(record.checklist || [])
      ].join(' ').toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const priorityOrder = { A: 0, B: 1, C: 2 };
      const priorityDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
}

function renderRecords() {
  const records = getFilteredRecords();
  els.emptyState.classList.toggle('hidden', state.records.length > 0);

  if (!records.length && state.records.length > 0) {
    els.recordsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔎</div>
        <h3>조건에 맞는 기록이 없습니다.</h3>
        <p>검색어나 필터를 변경해보세요.</p>
      </div>
    `;
    return;
  }

  els.recordsList.innerHTML = records.map((record) => {
    const score = averageScore(record).toFixed(1);
    const tags = (record.tags || []).slice(0, 3).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('');
    const statusClass = record.status === '보고 포함' ? 'orange' : 'gray';
    const thumb = record.photoData
      ? `<img class="booth-thumb" src="${record.photoData}" alt="${escapeHtml(record.brandName)} 사진" />`
      : `<div class="booth-thumb">${escapeHtml((record.brandName || 'EXPO').slice(0, 8))}</div>`;

    return `
      <article class="booth-card">
        <div class="booth-card-inner">
          ${thumb}
          <div>
            <div class="card-row">
              <h3>${escapeHtml(record.brandName || '이름 없는 부스')}</h3>
              <span class="score-badge">★ ${score}</span>
            </div>
            <p class="booth-meta">${escapeHtml(record.category || '기타')} · ${escapeHtml(record.country || '국가 미입력')} · ${escapeHtml(record.boothNo || '부스 미입력')}</p>
            <p class="booth-role">${escapeHtml(record.oneLineRole || record.whyInteresting || '핵심 인사이트가 아직 입력되지 않았습니다.')}</p>
            <div class="chips">
              <span class="chip ${statusClass}">${escapeHtml(record.status || '후보')}</span>
              <span class="chip gray">${escapeHtml(record.priority || 'B')}</span>
              ${tags}
            </div>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" data-edit="${record.id}">수정</button>
          <button type="button" data-report="${record.id}">${record.status === '보고 포함' ? '보고 제외' : '보고 포함'}</button>
        </div>
      </article>
    `;
  }).join('');

  $$('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => openRecordDialog(button.dataset.edit));
  });
  $$('[data-report]').forEach((button) => {
    button.addEventListener('click', () => toggleReportStatus(button.dataset.report));
  });
}

function openRecordDialog(id = '') {
  resetForm();
  if (id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    els.dialogTitle.textContent = '부스 기록 수정';
    $('#recordId').value = record.id;
    $('#brandName').value = record.brandName || '';
    $('#country').value = record.country || '';
    $('#boothNo').value = record.boothNo || '';
    $('#category').value = record.category || '기타';
    $('#contact').value = record.contact || '';
    $('#oneLineRole').value = record.oneLineRole || '';
    $('#replacedAction').value = record.replacedAction || '';
    $('#whyInteresting').value = record.whyInteresting || '';
    $('#scoreRelevance').value = record.scoreRelevance || 3;
    $('#scoreNovelty').value = record.scoreNovelty || 3;
    $('#scoreApplicability').value = record.scoreApplicability || 3;
    $('#status').value = record.status || '후보';
    $('#priority').value = record.priority || 'B';
    $('#notes').value = record.notes || '';
    $('#nextAction').value = record.nextAction || '';
    setCheckedValues('checklist', record.checklist || []);
    setCheckedValues('tags', record.tags || []);
    currentPhotoData = record.photoData || '';
    updatePhotoPreview(currentPhotoData);
    els.deleteRecordBtn.classList.remove('hidden');
    updateRangeOutputs();
  }
  if (typeof els.dialog.showModal === 'function') {
    els.dialog.showModal();
  } else {
    els.dialog.setAttribute('open', '');
  }
}

function closeDialog() {
  els.dialog.close?.();
  els.dialog.removeAttribute('open');
}

function resetForm() {
  els.form.reset();
  $('#recordId').value = '';
  els.dialogTitle.textContent = '부스 기록';
  els.deleteRecordBtn.classList.add('hidden');
  currentPhotoData = '';
  updatePhotoPreview('');
  setCheckedValues('checklist', []);
  setCheckedValues('tags', []);
  ['scoreRelevance', 'scoreNovelty', 'scoreApplicability'].forEach((id) => { $(`#${id}`).value = 3; });
  updateRangeOutputs();
}

function updateRangeOutputs() {
  $$('input[type="range"]').forEach((range) => {
    const output = range.parentElement.querySelector('output');
    output.textContent = range.value;
    output.value = range.value;
  });
}

function collectRecord() {
  const now = new Date().toISOString();
  const id = $('#recordId').value || uid();
  const existing = state.records.find((item) => item.id === id);
  return {
    id,
    brandName: $('#brandName').value.trim(),
    country: $('#country').value.trim(),
    boothNo: $('#boothNo').value.trim(),
    category: $('#category').value,
    contact: $('#contact').value.trim(),
    oneLineRole: $('#oneLineRole').value.trim(),
    replacedAction: $('#replacedAction').value.trim(),
    whyInteresting: $('#whyInteresting').value.trim(),
    checklist: getCheckedValues('checklist'),
    tags: getCheckedValues('tags'),
    scoreRelevance: Number($('#scoreRelevance').value),
    scoreNovelty: Number($('#scoreNovelty').value),
    scoreApplicability: Number($('#scoreApplicability').value),
    status: $('#status').value,
    priority: $('#priority').value,
    notes: $('#notes').value.trim(),
    nextAction: $('#nextAction').value.trim(),
    photoData: currentPhotoData,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function saveRecord() {
  const record = collectRecord();
  if (!record.brandName) {
    showToast('브랜드/업체명을 입력해주세요.');
    $('#brandName').focus();
    return;
  }
  const index = state.records.findIndex((item) => item.id === record.id);
  if (index >= 0) state.records[index] = record;
  else state.records.unshift(record);
  saveState();
  closeDialog();
  showToast('부스 기록을 저장했습니다.');
}

function deleteCurrentRecord() {
  const id = $('#recordId').value;
  if (!id) return;
  const ok = confirm('이 부스 기록을 삭제할까요?');
  if (!ok) return;
  state.records = state.records.filter((record) => record.id !== id);
  saveState();
  closeDialog();
  showToast('삭제했습니다.');
}

function toggleReportStatus(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  record.status = record.status === '보고 포함' ? '후보' : '보고 포함';
  record.updatedAt = new Date().toISOString();
  saveState();
  showToast(record.status === '보고 포함' ? '보고서에 포함했습니다.' : '보고서에서 제외했습니다.');
}

async function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    currentPhotoData = await resizeImage(file, 1200, 0.78);
    updatePhotoPreview(currentPhotoData);
  } catch (error) {
    console.error(error);
    showToast('사진을 불러오지 못했습니다.');
  }
}

function resizeImage(file, maxSize = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function updatePhotoPreview(src) {
  els.photoPreview.src = src || '';
  els.photoPreview.classList.toggle('hidden', !src);
  els.removePhotoBtn.classList.toggle('hidden', !src);
}

function switchView(view) {
  $$('.view').forEach((section) => section.classList.remove('active'));
  $(`#view-${view}`).classList.add('active');
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'report') renderReport();
  if (view === 'settings') hydrateSettingsForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function importantRecords() {
  const selected = state.records.filter((record) => record.status === '보고 포함' || record.priority === 'A');
  return (selected.length ? selected : state.records)
    .slice()
    .sort((a, b) => averageScore(b) - averageScore(a));
}

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const values = getter(item);
    (Array.isArray(values) ? values : [values]).filter(Boolean).forEach((value) => {
      acc[value] = (acc[value] || 0) + 1;
    });
    return acc;
  }, {});
}

function topEntries(countMap, limit = 5) {
  return Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function buildReportText() {
  const records = importantRecords();
  const settings = state.settings;
  if (!state.records.length) {
    return `${settings.eventName || '전시회'} 참관 기록이 아직 없습니다.\n\n부스 기록을 추가하면 대표님 보고용 요약이 자동으로 생성됩니다.`;
  }

  const topTags = topEntries(countBy(records, (record) => record.tags || []), 6);
  const topCategories = topEntries(countBy(records, (record) => record.category), 5);
  const topRecords = records.slice(0, 5);
  const actionRecords = records.filter((record) => record.nextAction).slice(0, 6);

  const lines = [];
  lines.push(`[${settings.eventName || '전시회'} 참관 요약]`);
  lines.push('');
  lines.push('1. 결론');
  lines.push(`이번 참관은 단순 도입 제품 탐색보다는, ${settings.purpose || DEFAULT_SETTINGS.purpose}`);
  if (topTags.length) {
    lines.push(`현재 기록 기준으로는 ${topTags.map(([tag]) => tag).join(', ')} 관련 신호가 반복적으로 확인됩니다.`);
  }
  lines.push('');

  lines.push('2. 주요 반복 신호');
  if (topTags.length || topCategories.length) {
    topTags.forEach(([tag, count]) => lines.push(`- ${tag}: ${count}건`));
    if (topCategories.length) lines.push(`- 주요 카테고리: ${topCategories.map(([cat, count]) => `${cat} ${count}건`).join(' / ')}`);
  } else {
    lines.push('- 아직 반복 신호를 판단하기에는 기록이 부족합니다.');
  }
  lines.push('');

  lines.push('3. 우선 검토 부스');
  topRecords.forEach((record, index) => {
    const summary = record.oneLineRole || record.whyInteresting || '추가 검토 필요';
    const tags = (record.tags || []).slice(0, 3).join(', ');
    lines.push(`${index + 1}) ${record.brandName || '이름 없는 부스'} (${record.country || '국가 미입력'} / ${record.category || '기타'} / 평균 ${averageScore(record).toFixed(1)})`);
    lines.push(`   - 핵심: ${summary}`);
    if (tags) lines.push(`   - 태그: ${tags}`);
    if (record.replacedAction) lines.push(`   - 줄여주는 행동: ${record.replacedAction}`);
  });
  lines.push('');

  lines.push('4. 당사 적용 관점');
  lines.push('- 제품 자체보다 “사용자의 반복 행동을 얼마나 줄여주는가”를 중심으로 제품 설계와 문구를 확인할 필요가 있습니다.');
  lines.push('- 기능성 제품은 성분명 나열보다 사용 상황, 급여 편의성, 체감 포인트를 함께 제시하는 방식이 참고됩니다.');
  lines.push('- 패키지는 예쁜 디자인보다, 전면에서 기능·상황·차별점을 빠르게 이해시키는 구조를 우선 검토할 필요가 있습니다.');
  lines.push('');

  lines.push('5. 후속 조치');
  if (actionRecords.length) {
    actionRecords.forEach((record) => lines.push(`- ${record.brandName}: ${record.nextAction}`));
  } else {
    lines.push('- 보고 포함 부스 중 샘플 요청, 카탈로그 확보, 원료/표시 검토 필요 항목을 추가로 정리할 예정입니다.');
  }

  return lines.join('\n');
}

function renderReport() {
  const text = buildReportText();
  els.reportBox.textContent = text;
}

async function copyReport() {
  const text = buildReportText();
  try {
    await navigator.clipboard.writeText(text);
    showToast('보고서 내용을 복사했습니다.');
  } catch (error) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
    showToast('보고서 내용을 복사했습니다.');
  }
}

function downloadReport() {
  const filename = `${sanitizeFileName(state.settings.eventName || 'expo')}-report.txt`;
  downloadFile(filename, buildReportText(), 'text/plain;charset=utf-8');
}

function hydrateSettingsForm() {
  $('#settingEventName').value = state.settings.eventName || '';
  $('#settingPurpose').value = state.settings.purpose || '';
  $('#settingFocus').value = state.settings.focus || '';
}

function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    eventName: $('#settingEventName').value.trim() || DEFAULT_SETTINGS.eventName,
    purpose: $('#settingPurpose').value.trim() || DEFAULT_SETTINGS.purpose,
    focus: $('#settingFocus').value.trim() || DEFAULT_SETTINGS.focus
  };
  saveState();
  showToast('설정을 저장했습니다.');
}

function exportJson() {
  const filename = `${sanitizeFileName(state.settings.eventName || 'expo')}-backup.json`;
  downloadFile(filename, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.records)) throw new Error('Invalid file');
      state = {
        settings: { ...DEFAULT_SETTINGS, ...(imported.settings || {}) },
        records: imported.records
      };
      saveState();
      hydrateSettingsForm();
      showToast('백업 데이터를 불러왔습니다.');
    } catch (error) {
      showToast('올바른 백업 파일이 아닙니다.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function clearData() {
  const ok = confirm('모든 전시 참관 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.');
  if (!ok) return;
  state = { settings: { ...DEFAULT_SETTINGS }, records: [] };
  localStorage.removeItem(STORAGE_KEY);
  hydrateSettingsForm();
  renderAll();
  showToast('전체 데이터를 삭제했습니다.');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(name) {
  return String(name).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1900);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed', error));
    });
  }
}

init();
