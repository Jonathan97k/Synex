require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { connectDB } = require('../models/db');

const authRoutes = require('../routes/auth');
const projectRoutes = require('../routes/projects');
const pushRoutes = require('../routes/push');

const ROOT_DIR = path.join(__dirname, '..');
const app = express();

// Push payloads can carry base64 file content — allow generous size,
// but keep it well under typical serverless body limits.
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

app.use('/api', async (_req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database unavailable: ' + err.message });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/push', pushRoutes);

if (!process.env.VERCEL) {
    app.use(express.static(path.join(ROOT_DIR, 'public')));
}

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

module.exports = app;
