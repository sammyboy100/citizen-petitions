// main.js — VozCiudadana · Lógica del cliente SPA

const API = '/api/suggestions';
let currentPage = 1;
let currentSuggestionId = null;
const selectedFiles = [];

// ── Navegación entre vistas ───────────────────────────────────────────────────

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const view = document.getElementById(`view-${viewName}`);
  const nav  = document.getElementById(`nav-${viewName}`);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewName === 'home') {
    currentPage = 1;
    loadSuggestions();
    loadStats();
  }
}

// ── Estadísticas del Hero ─────────────────────────────────────────────────────

async function loadStats() {
  try {
    const res  = await fetch(`${API}/../stats`);

    // Usamos /api/stats directamente
    const res2 = await fetch('/api/suggestions/stats');
    if (!res2.ok) return;
    const { stats } = await res2.json();

    document.getElementById('stat-active').textContent    = stats.activeSuggestions.toLocaleString('es-PE');
    document.getElementById('stat-completed').textContent = stats.completedSuggestions.toLocaleString('es-PE');
    document.getElementById('stat-signatures').textContent = stats.totalSignatures.toLocaleString('es-PE');
  } catch (e) {
    console.warn('Stats no disponibles:', e.message);
  }
}

// ── Listar sugerencias ────────────────────────────────────────────────────────

async function loadSuggestions() {
  const status   = document.getElementById('filter-status').value;
  const category = document.getElementById('filter-category').value;
  const grid     = document.getElementById('suggestions-grid');
  const empty    = document.getElementById('suggestions-empty');
  const loading  = document.getElementById('suggestions-loading');
  const pagDiv   = document.getElementById('pagination');

  grid.innerHTML = '';
  empty.classList.add('hidden');
  loading.classList.remove('hidden');
  pagDiv.classList.add('hidden');

  try {
    const params = new URLSearchParams({ page: currentPage, limit: 9 });
    if (status)   params.set('status', status);
    if (category) params.set('category', category);

    const res  = await fetch(`${API}?${params}`);
    const data = await res.json();

    loading.classList.add('hidden');

    if (!data.success || data.docs.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    data.docs.forEach(s => grid.appendChild(buildCard(s)));
    renderPagination(data.totalPages, pagDiv);

  } catch (e) {
    loading.classList.add('hidden');
    grid.innerHTML = `<p style="color:var(--red);padding:2rem">Error al cargar sugerencias: ${e.message}</p>`;
  }
}

function buildCard(s) {
  const card = document.createElement('div');
  const isCompleted = s.status === 'completada';
  const isExpired   = s.status === 'vencida';
  const isUrgent    = s.isUrgent;

  card.className = `suggestion-card ${isCompleted ? 'completed' : ''} ${isExpired ? 'expired' : ''} ${isUrgent ? 'urgent' : ''}`;
  card.onclick = () => loadDetail(s._id);

  const catLabels = {
    infraestructura: '🏗 Infraestructura', educacion: '📚 Educación',
    salud: '🏥 Salud', medioambiente: '🌿 Medio Ambiente',
    seguridad: '🛡 Seguridad', otro: '📌 Otro',
  };

  card.innerHTML = `
    <span class="card-category">${catLabels[s.category] || s.category}</span>
    <h3 class="card-title">${escHtml(s.title)}</h3>
    <p class="card-desc">${escHtml(s.description)}</p>
    <div class="card-progress">
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill ${isCompleted ? 'complete' : ''}"
             style="width:${s.progressPct}%"></div>
      </div>
      <div class="progress-meta">
        <span>${s.signaturesCount.toLocaleString('es-PE')} firmas</span>
        <span class="progress-pct">${s.progressPct}%</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-status">${s.statusLabel}</span>
      ${!isCompleted && !isExpired
        ? `<button class="btn-primary card-sign-btn" onclick="openSignModal(event,'${s._id}','${escAttr(s.title)}')">✍ Firmar</button>`
        : ''}
    </div>`;

  return card;
}

function renderPagination(totalPages, container) {
  if (totalPages <= 1) return;
  container.classList.remove('hidden');
  container.innerHTML = '';

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => { currentPage = i; loadSuggestions(); };
    container.appendChild(btn);
  }
}

// ── Detalle de sugerencia ─────────────────────────────────────────────────────

async function loadDetail(id) {
  showView('detail');
  const container = document.getElementById('suggestion-detail-content');
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>`;

  try {
    const res  = await fetch(`${API}/${id}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    currentSuggestionId = id;
    container.innerHTML = buildDetailHTML(data.suggestion);
  } catch (e) {
    container.innerHTML = `<div class="form-error">Error al cargar la sugerencia: ${e.message}</div>`;
  }
}

function buildDetailHTML(s) {
  const catLabels = {
    infraestructura: '🏗 Infraestructura', educacion: '📚 Educación',
    salud: '🏥 Salud', medioambiente: '🌿 Medio Ambiente',
    seguridad: '🛡 Seguridad', otro: '📌 Otro',
  };

  const attachmentsHTML = s.attachments?.length
    ? `<div class="detail-section">
        <h3>📎 Archivos Adjuntos (${s.attachments.length})</h3>
        <div class="attachment-list">
          ${s.attachments.map(a => `
            <a class="attachment-item" href="/api/suggestions/attachments/${a.filename}" target="_blank" download="${escAttr(a.originalName)}">
              <span class="attachment-icon">${fileIcon(a.mimetype)}</span>
              <span>${escHtml(a.originalName)}</span>
              <span class="attachment-size">${formatSize(a.size)}</span>
            </a>`).join('')}
        </div>
      </div>`
    : '';

  const signBtnHTML = (s.status === 'activa')
    ? `<button class="btn-primary sign-section-btn" onclick="openSignModal(null,'${s._id}','${escAttr(s.title)}')">
        ✍ Firmar esta Sugerencia
       </button>`
    : `<p style="text-align:center;color:var(--text-lt);margin-top:1rem;">
        Esta sugerencia está ${s.status === 'completada' ? '🎉 completada' : '❌ vencida'} y no acepta más firmas.
       </p>`;

  return `
    <div class="detail-hero">
      <p class="detail-category">${catLabels[s.category] || s.category}</p>
      <h1 class="detail-title">${escHtml(s.title)}</h1>
      <div class="detail-meta">
        <span>✍ Por ${escHtml(s.authorName)}</span>
        <span>📅 Publicada el ${s.createdAtFormatted}</span>
        <span>⏰ Vence el ${s.expiresAtFormatted}</span>
      </div>
    </div>
    <div class="detail-body">
      <div class="detail-section">
        <h3>📊 Progreso de Firmas</h3>
        <div class="detail-progress-wrap">
          <div class="detail-progress-fill ${s.status === 'completada' ? 'complete' : ''}"
               style="width:${s.progressPct}%"></div>
        </div>
        <div class="progress-nums">
          <span><strong>${s.signaturesCount.toLocaleString('es-PE')}</strong> firmas recolectadas</span>
          <span>Meta: <strong>${s.signaturesGoal.toLocaleString('es-PE')}</strong></span>
        </div>
        <div style="text-align:center;margin-top:.75rem;font-size:.875rem;color:var(--text-lt);">
          ${s.statusLabel} &nbsp;·&nbsp; Faltan ${s.signaturesLeft.toLocaleString('es-PE')} firmas para la meta
        </div>
        ${signBtnHTML}
      </div>

      <div class="detail-section">
        <h3>📄 Descripción Completa</h3>
        <p class="detail-description">${escHtml(s.description)}</p>
      </div>

      ${attachmentsHTML}
    </div>`;
}

// ── Firma Modal ───────────────────────────────────────────────────────────────

function openSignModal(event, suggestionId, title) {
  if (event) event.stopPropagation();
  currentSuggestionId = suggestionId;
  document.getElementById('modal-suggestion-title').textContent = decodeHtml(title);
  document.getElementById('signer-name').value  = '';
  document.getElementById('signer-email').value = '';
  document.getElementById('sign-error').classList.add('hidden');
  document.getElementById('sign-success').classList.add('hidden');
  document.getElementById('sign-submit-btn').disabled = false;
  document.getElementById('sign-modal').classList.remove('hidden');
}

function closeSignModal() {
  document.getElementById('sign-modal').classList.add('hidden');
}

async function submitSignature(event) {
  event.preventDefault();
  const errorDiv   = document.getElementById('sign-error');
  const successDiv = document.getElementById('sign-success');
  const submitBtn  = document.getElementById('sign-submit-btn');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Procesando...';

  const signerName  = document.getElementById('signer-name').value.trim();
  const signerEmail = document.getElementById('signer-email').value.trim();

  try {
    const res  = await fetch(`${API}/${currentSuggestionId}/sign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ signerName, signerEmail }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al firmar');

    successDiv.textContent = `✅ ¡Firma registrada exitosamente! Gracias, ${signerName}. Ahora la sugerencia tiene ${data.suggestion.signaturesCount.toLocaleString('es-PE')} firmas.`;
    successDiv.classList.remove('hidden');

    // Cerrar modal tras 2 segundos
    setTimeout(() => {
      closeSignModal();
      // Refrescar el detalle si estamos en esa vista
      if (document.getElementById('view-detail').classList.contains('active')) {
        loadDetail(currentSuggestionId);
      }
    }, 2500);

  } catch (e) {
    errorDiv.textContent = `❌ ${e.message}`;
    errorDiv.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = '✍ Firmar Ahora';
  }
}

// ── Crear sugerencia ──────────────────────────────────────────────────────────

document.getElementById('f-title').addEventListener('input', function () {
  document.getElementById('title-count').textContent = `${this.value.length} / 200`;
});
document.getElementById('f-description').addEventListener('input', function () {
  document.getElementById('desc-count').textContent = `${this.value.length} caracteres (mínimo 50)`;
});

function handleFileSelect(input) {
  const newFiles = Array.from(input.files);
  newFiles.forEach(f => {
    if (selectedFiles.length < 5 && !selectedFiles.find(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.push(f);
    }
  });
  renderFileList();
  input.value = '';
}

function renderFileList() {
  const list = document.getElementById('file-list');
  list.innerHTML = '';
  selectedFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span>${fileIcon(f.type)}</span>
      <span>${escHtml(f.name)}</span>
      <span style="color:var(--text-lt);font-size:.78rem">${formatSize(f.size)}</span>
      <button class="file-remove" onclick="removeFile(${i})" title="Eliminar">✕</button>`;
    list.appendChild(item);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

// Drag & Drop
const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const fakeInput = { files: e.dataTransfer.files };
  handleFileSelect(fakeInput);
});

async function submitSuggestion(event) {
  event.preventDefault();
  const errorDiv   = document.getElementById('form-error');
  const successDiv = document.getElementById('form-success');
  const submitBtn  = document.getElementById('submit-btn');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Publicando...';

  const formData = new FormData();
  formData.append('title',       document.getElementById('f-title').value.trim());
  formData.append('description', document.getElementById('f-description').value.trim());
  formData.append('category',    document.getElementById('f-category').value);
  formData.append('authorName',  document.getElementById('f-author-name').value.trim());
  formData.append('authorEmail', document.getElementById('f-author-email').value.trim());
  selectedFiles.forEach(f => formData.append('attachments', f));

  try {
    const res  = await fetch(API, { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.details?.join(' · ') || data.error || 'Error desconocido';
      throw new Error(msg);
    }

    successDiv.innerHTML = `✅ <strong>¡Sugerencia publicada!</strong> Se ha creado correctamente. Puedes verla en el inicio.`;
    successDiv.classList.remove('hidden');
    document.getElementById('suggestion-form').reset();
    selectedFiles.length = 0;
    renderFileList();
    document.getElementById('title-count').textContent = '0 / 200';
    document.getElementById('desc-count').textContent = '0 caracteres (mínimo 50)';

    setTimeout(() => showView('home'), 2500);

  } catch (e) {
    errorDiv.textContent = `❌ ${e.message}`;
    errorDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Publicar Sugerencia';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str = '') {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
function decodeHtml(str = '') {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fileIcon(mime = '') {
  if (mime.startsWith('image/'))         return '🖼';
  if (mime === 'application/pdf')        return '📑';
  if (mime.includes('word'))             return '📝';
  return '📄';
}

// ── Cerrar modal con Escape ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSignModal();
});
document.getElementById('sign-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('sign-modal')) closeSignModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────
showView('home');
