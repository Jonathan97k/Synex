const API = 'https://api.github.com';

function headers() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set on the server.');
    return {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'synex-deploy-console'
    };
}

async function ghFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, { ...options, headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data.message || `GitHub API error (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

/** Create a git blob for one file's content (base64-encoded). Returns the blob sha. */
async function createBlob(owner, repo, contentBase64) {
    const data = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: contentBase64, encoding: 'base64' })
    });
    return data.sha;
}

/** Get the commit sha and tree sha currently at the tip of a branch. */
async function getBranchHead(owner, repo, branch) {
    const ref = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const commitSha = ref.object.sha;
    const commit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${commitSha}`);
    return { commitSha, treeSha: commit.tree.sha };
}

/**
 * Build a new tree on top of baseTreeSha:
 *   files: [{ path, sha }]        -> add/update these paths
 *   deletePaths: ['old/file.js']  -> remove these paths
 */
async function createTree(owner, repo, baseTreeSha, files, deletePaths) {
    const tree = [
        ...files.map(f => ({ path: f.path, mode: '100644', type: 'blob', sha: f.sha })),
        ...deletePaths.map(p => ({ path: p, mode: '100644', type: 'blob', sha: null }))
    ];
    const data = await ghFetch(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({ base_tree: baseTreeSha, tree })
    });
    return data.sha;
}

async function createCommit(owner, repo, message, treeSha, parentSha) {
    const data = await ghFetch(`/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
    });
    return data.sha;
}

async function updateRef(owner, repo, branch, commitSha) {
    await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commitSha, force: true })
    });
}

module.exports = { createBlob, getBranchHead, createTree, createCommit, updateRef };
