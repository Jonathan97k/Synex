const express = require('express');
const Project = require('../models/Project');
const { requireAuth } = require('../middleware/auth');
const gh = require('../lib/github');

const router = express.Router();
router.use(requireAuth);

async function loadProject(req, res, next) {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
}

// Create blobs for a batch of files. Body: { files: [{ path, content }] }
// `content` must be base64-encoded (client encodes before sending).
router.post('/:projectId/blobs', loadProject, async (req, res) => {
    const { files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No files provided.' });
    }
    const { owner, repo } = req.project;
    const results = [];
    const CONCURRENCY = 6;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async (f) => {
            try {
                const sha = await gh.createBlob(owner, repo, f.content);
                return { path: f.path, sha, ok: true };
            } catch (err) {
                return { path: f.path, ok: false, error: err.message };
            }
        }));
        results.push(...batchResults);
    }
    const failed = results.filter(r => !r.ok);
    res.json({ ok: failed.length === 0, results, failed });
});

// Finalize the push: build a tree from already-created blobs, commit, update the branch.
// Body: { message, files: [{ path, sha }], deletePaths: [] }
router.post('/:projectId/commit', loadProject, async (req, res) => {
    try {
        const { owner, repo, branch } = req.project;
        const { message, files, deletePaths } = req.body || {};
        const fileList = Array.isArray(files) ? files : [];
        const deleteList = Array.isArray(deletePaths) ? deletePaths : [];
        if (fileList.length === 0 && deleteList.length === 0) {
            return res.status(400).json({ error: 'Nothing to commit.' });
        }
        const { commitSha, treeSha } = await gh.getBranchHead(owner, repo, branch);
        const newTreeSha = await gh.createTree(owner, repo, treeSha, fileList, deleteList);
        const newCommitSha = await gh.createCommit(
            owner, repo,
            message || 'Update via Synex',
            newTreeSha,
            commitSha
        );
        await gh.updateRef(owner, repo, branch, newCommitSha);
        res.json({ ok: true, commitSha: newCommitSha });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
