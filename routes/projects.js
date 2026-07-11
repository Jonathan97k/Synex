const express = require('express');
const Project = require('../models/Project');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // everything here is admin-only

router.get('/', async (_req, res) => {
    const projects = await Project.find().sort({ name: 1 }).lean();
    res.json(projects);
});

router.post('/', async (req, res) => {
    const { name, owner, repo, branch, notes } = req.body || {};
    if (!name || !owner || !repo) {
        return res.status(400).json({ error: 'Name, GitHub owner, and repo are required.' });
    }
    const project = await Project.create({
        name: String(name).trim(),
        owner: String(owner).trim(),
        repo: String(repo).trim().replace(/\.git$/, ''),
        branch: String(branch || 'main').trim(),
        notes: String(notes || '').trim()
    });
    res.status(201).json(project);
});

router.put('/:id', async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { name, owner, repo, branch, notes } = req.body || {};
    if (name != null) project.name = String(name).trim();
    if (owner != null) project.owner = String(owner).trim();
    if (repo != null) project.repo = String(repo).trim().replace(/\.git$/, '');
    if (branch != null) project.branch = String(branch).trim();
    if (notes != null) project.notes = String(notes).trim();
    await project.save();
    res.json(project);
});

router.delete('/:id', async (req, res) => {
    const removed = await Project.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true });
});

module.exports = router;
