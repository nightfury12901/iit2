// admin.js - CMS Controller for Admin Dashboard
const API = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

// ============================================================
// TAB NAVIGATION
// ============================================================
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'team') loadTeam();
        if (btn.dataset.tab === 'gallery') loadGallery();
        if (btn.dataset.tab === 'projects') loadProjects();
    });
});

// ============================================================
// UTILS
// ============================================================
function toast(el, msg, cls) {
    el.textContent = msg;
    el.className = cls;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}
function makeDeleteBtn(type, id, onDelete) {
    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = '🗑 Delete';
    btn.addEventListener('click', async () => {
        if (!confirm('Delete this item?')) return;
        btn.disabled = true;
        try {
            await fetch(`${API}/admin/content/${type}/${id}`, { method: 'DELETE' });
            onDelete();
        } catch (e) { alert('Delete failed: ' + e.message); btn.disabled = false; }
    });
    return btn;
}

// ============================================================
// PUBLICATIONS SYNC
// ============================================================
const syncBtn = document.getElementById('admin-sync-btn');
const syncStatus = document.getElementById('sync-status');

if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
        if (!confirm('Fetch fresh data from Google Scholar? This takes 1–2 minutes.')) return;
        syncBtn.disabled = true;
        syncBtn.textContent = '⏳ Syncing...';
        syncStatus.style.display = 'block';
        syncStatus.className = '';
        syncStatus.textContent = 'Fetching publications from Google Scholar…';
        try {
            const res = await fetch(`${API}/admin/sync-scholar`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sync failed');
            toast(syncStatus, `✅ Success! Synced ${data.total_publications} publications.`, 'ok');
        } catch (e) {
            toast(syncStatus, `❌ ${e.message}`, 'err');
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Sync Google Scholar Data';
        }
    });
}

// ============================================================
// TEAM
// ============================================================
async function loadTeam() {
    const list = document.getElementById('team-list');
    list.innerHTML = '<p>Loading…</p>';
    try {
        const res = await fetch(`${API}/content/team`);
        const members = await res.json();
        if (!members.length) { list.innerHTML = '<p>No team members added yet.</p>'; return; }
        list.innerHTML = '';
        members.forEach(m => {
            const row = document.createElement('div');
            row.className = 'item-row';
            if (m.image_url) {
                const img = document.createElement('img');
                img.src = m.image_url;
                img.alt = m.name;
                row.appendChild(img);
            }
            const info = document.createElement('div');
            info.className = 'item-info';
            info.innerHTML = `<strong>${m.name}</strong><small>${m.role} · ${m.category}</small>`;
            row.appendChild(info);
            row.appendChild(makeDeleteBtn('team', m.id, loadTeam));
            list.appendChild(row);
        });
    } catch (e) { list.innerHTML = `<p style="color:red">Error: ${e.message}</p>`; }
}

document.getElementById('team-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('.form-submit');
    btn.disabled = true; btn.textContent = 'Saving…';
    const fd = new FormData(e.target);
    try {
        const res = await fetch(`${API}/admin/content/team`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        e.target.reset();
        loadTeam();
    } catch (err) { alert('Error: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'Add Member'; }
});

// ============================================================
// GALLERY
// ============================================================
async function loadGallery() {
    const list = document.getElementById('gallery-list');
    list.innerHTML = '<p>Loading…</p>';
    try {
        const res = await fetch(`${API}/content/gallery`);
        const items = await res.json();
        if (!items.length) { list.innerHTML = '<p>No gallery photos yet.</p>'; return; }
        list.innerHTML = '';
        items.forEach(g => {
            const row = document.createElement('div');
            row.className = 'item-row';
            const img = document.createElement('img');
            img.src = g.image_url;
            img.alt = g.caption || 'Gallery';
            row.appendChild(img);
            const info = document.createElement('div');
            info.className = 'item-info';
            info.innerHTML = `<strong>${g.caption || '(no caption)'}</strong><small>Category: ${g.category}</small>`;
            row.appendChild(info);
            row.appendChild(makeDeleteBtn('gallery', g.id, loadGallery));
            list.appendChild(row);
        });
    } catch (e) { list.innerHTML = `<p style="color:red">Error: ${e.message}</p>`; }
}

document.getElementById('gallery-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('.form-submit');
    btn.disabled = true; btn.textContent = 'Uploading…';
    const fd = new FormData(e.target);
    try {
        const res = await fetch(`${API}/admin/content/gallery`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        e.target.reset();
        loadGallery();
    } catch (err) { alert('Error: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'Upload Photo'; }
});

// ============================================================
// PROJECTS / PATENTS
// ============================================================
async function loadProjects() {
    const list = document.getElementById('projects-list');
    list.innerHTML = '<p>Loading…</p>';
    try {
        const res = await fetch(`${API}/content/projects`);
        const items = await res.json();
        if (!items.length) { list.innerHTML = '<p>No projects added yet.</p>'; return; }
        list.innerHTML = '';
        items.forEach(p => {
            const row = document.createElement('div');
            row.className = 'item-row';
            const info = document.createElement('div');
            info.className = 'item-info';
            info.innerHTML = `<strong>${p.title}</strong><small>${p.type} · ${p.role}${p.agency ? ' · ' + p.agency : ''}${p.duration ? ' · ' + p.duration : ''}</small>`;
            row.appendChild(info);
            row.appendChild(makeDeleteBtn('projects', p.id, loadProjects));
            list.appendChild(row);
        });
    } catch (e) { list.innerHTML = `<p style="color:red">Error: ${e.message}</p>`; }
}

document.getElementById('projects-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('.form-submit');
    btn.disabled = true; btn.textContent = 'Saving…';
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
        const res = await fetch(`${API}/admin/content/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        e.target.reset();
        loadProjects();
    } catch (err) { alert('Error: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'Add Entry'; }
});
