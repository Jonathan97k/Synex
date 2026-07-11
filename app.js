(() => {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const IGNORE_DIRS = ['node_modules', '.git', '.vercel', '.next', 'dist', 'build'];
    const IGNORE_FILES = ['.env', '.env.local', '.DS_Store'];

    let state = { projects: [], activeProjectId: null, selectedFiles: [] };

    function log(msg) {
        const el = $('#pushLog');
        el.textContent += (el.textContent.endsWith('\n') || el.textContent === '' ? '' : '\n') + msg;
        el.scrollTop = el.scrollHeight;
    }
    function resetLog(msg) { $('#pushLog').textContent = msg || ''; }

    // ================= AUTH =================
    function showLogin() { $('#loginScreen').hidden = false; $('#appShell').hidden = true; }
    function showApp() { $('#loginScreen').hidden = true; $('#appShell').hidden = false; }

    $('#form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errBox = $('#loginError');
        errBox.hidden = true;
        const btn = $('#btnLogin');
        btn.disabled = true;
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: form.username.value.trim(), password: form.password.value })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Login failed');
            showApp();
            await loadProjects();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.hidden = false;
        } finally {
            btn.disabled = false;
        }
    });

    $('#btnLogout').addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
        showLogin();
    });

    // ================= PROJECTS =================
    async function loadProjects() {
        const res = await fetch('/api/projects', { cache: 'no-store' });
        if (res.status === 401) { showLogin(); return; }
        state.projects = await res.json();
        renderProjects();
    }

    function renderProjects() {
        const box = $('#projectList');
        if (state.projects.length === 0) {
            box.innerHTML = '<div class="empty-state">No projects yet — click "New Project" to add your first one.</div>';
            return;
        }
        box.innerHTML = '';
        state.projects.forEach(p => {
            const row = document.createElement('div');
            row.className = 'project-row';
            row.innerHTML = `
                <div class="info">
                    <strong>${escapeHtml(p.name)}</strong>
                    <span>${escapeHtml(p.owner)}/${escapeHtml(p.repo)} — branch: ${escapeHtml(p.branch)}</span>
                </div>
                <div class="actions">
                    <button class="btn" data-push="${p._id}">Push</button>
                    <button class="btn btn-ghost" data-edit="${p._id}">Edit</button>
                </div>`;
            box.appendChild(row);
        });
        $$('[data-push]').forEach(b => b.addEventListener('click', () => openPushPanel(b.dataset.push)));
        $$('[data-edit]').forEach(b => b.addEventListener('click', () => openProjectForm(b.dataset.edit)));
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    }

    function openProjectForm(id) {
        const form = $('#form-project');
        form.reset();
        $('#btnDeleteProject').hidden = true;
        form.id.value = '';
        $('#projectFormTitle').textContent = 'New Project';
        if (id) {
            const p = state.projects.find(x => x._id === id);
            if (p) {
                form.id.value = p._id;
                form.name.value = p.name;
                form.owner.value = p.owner;
                form.repo.value = p.repo;
                form.branch.value = p.branch;
                form.notes.value = p.notes || '';
                $('#projectFormTitle').textContent = 'Edit Project';
                $('#btnDeleteProject').hidden = false;
            }
        }
        $('#pushCard').hidden = true;
        $('#projectFormCard').hidden = false;
    }

    $('#btnNewProject').addEventListener('click', () => openProjectForm(null));
    $('#btnCancelProjectForm').addEventListener('click', () => { $('#projectFormCard').hidden = true; });

    $('#form-project').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.id.value;
        const payload = {
            name: form.name.value.trim(),
            owner: form.owner.value.trim(),
            repo: form.repo.value.trim(),
            branch: form.branch.value.trim() || 'main',
            notes: form.notes.value.trim()
        };
        const res = await fetch(id ? `/api/projects/${id}` : '/api/projects', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) { alert(json.error || 'Could not save project'); return; }
        $('#projectFormCard').hidden = true;
        await loadProjects();
    });

    $('#btnDeleteProject').addEventListener('click', async () => {
        const id = $('#form-project').id.value;
        if (!id) return;
        if (!confirm('Remove this project from Synex? (This does NOT delete anything on GitHub.)')) return;
        await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        $('#projectFormCard').hidden = true;
        await loadProjects();
    });

    // ================= PUSH PANEL =================
    function openPushPanel(id) {
        state.activeProjectId = id;
        state.selectedFiles = [];
        const p = state.projects.find(x => x._id === id);
        $('#pushProjectName').textContent = p ? `${p.name} (${p.owner}/${p.repo}@${p.branch})` : '';
        $('#fileSummary').hidden = true;
        $('#folderInput').value = '';
        $('#deletePaths').value = '';
        resetLog('Select a folder above, then click "Push to GitHub".');
        $('#projectFormCard').hidden = true;
        $('#pushCard').hidden = false;
    }
    $('#btnClosePush').addEventListener('click', () => { $('#pushCard').hidden = true; });

    $('#folderInput').addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => {
            const rel = f.webkitRelativePath || f.name;
            const parts = rel.split('/');
            if (parts.some(p => IGNORE_DIRS.includes(p))) return false;
            if (IGNORE_FILES.includes(parts[parts.length - 1])) return false;
            return true;
        });
        state.selectedFiles = files;
        const totalMB = (files.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(2);
        const box = $('#fileSummary');
        box.hidden = false;
        box.textContent = `${files.length} files selected (${totalMB} MB). node_modules/.git/.env are skipped automatically.`;
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function stripTopFolder(relPath) {
        const parts = relPath.split('/');
        return parts.slice(1).join('/'); // remove the root folder name itself
    }

    $('#btnPush').addEventListener('click', async () => {
        const id = state.activeProjectId;
        if (!id) return;
        if (state.selectedFiles.length === 0) {
            alert('Select a project folder first.');
            return;
        }
        const btn = $('#btnPush');
        btn.disabled = true;
        resetLog(`Starting push of ${state.selectedFiles.length} files...\n`);

        try {
            // 1) Read + base64-encode files, batch them to stay under request size limits.
            const BATCH_SIZE = 5;
            const allResults = [];
            for (let i = 0; i < state.selectedFiles.length; i += BATCH_SIZE) {
                const batch = state.selectedFiles.slice(i, i + BATCH_SIZE);
                const encoded = await Promise.all(batch.map(async (f) => ({
                    path: stripTopFolder(f.webkitRelativePath || f.name),
                    content: await fileToBase64(f)
                })));
                log(`Uploading batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.map(f => f.name).join(', ')})...`);
                const res = await fetch(`/api/push/${id}/blobs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ files: encoded })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Upload batch failed');
                allResults.push(...json.results);
                const failedInBatch = json.results.filter(r => !r.ok);
                failedInBatch.forEach(r => log(`  ✗ ${r.path}: ${r.error}`));
            }

            const successFiles = allResults.filter(r => r.ok).map(r => ({ path: r.path, sha: r.sha }));
            const failedCount = allResults.length - successFiles.length;
            if (failedCount > 0) {
                log(`\n${failedCount} file(s) failed to upload — they will be skipped in the commit.`);
            }
            if (successFiles.length === 0) {
                throw new Error('No files uploaded successfully — nothing to commit.');
            }

            const deletePaths = $('#deletePaths').value
                .split(',').map(s => s.trim()).filter(Boolean);

            log(`\nCommitting ${successFiles.length} file(s)${deletePaths.length ? ` and deleting ${deletePaths.length} path(s)` : ''}...`);
            const commitRes = await fetch(`/api/push/${id}/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: $('#commitMessage').value.trim() || 'Update via Synex',
                    files: successFiles,
                    deletePaths
                })
            });
            const commitJson = await commitRes.json();
            if (!commitRes.ok) throw new Error(commitJson.error || 'Commit failed');

            log(`\n✓ Pushed successfully — commit ${commitJson.commitSha.slice(0, 7)}`);
            log(`Vercel (or any connected host) should start redeploying automatically.`);
        } catch (err) {
            log(`\n✗ Error: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    });

    // ================= INIT =================
    (async function init() {
        try {
            const res = await fetch('/api/auth/me', { cache: 'no-store' });
            if (res.ok) { showApp(); await loadProjects(); }
            else showLogin();
        } catch { showLogin(); }
    })();
})();
