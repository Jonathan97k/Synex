const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { COOKIE_NAME, requireAuth } = require('../middleware/auth');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };

// Hash the admin password once per server start (cheap; single user, no DB needed for this).
let cachedHash = null;
async function getAdminHash() {
    if (!cachedHash) cachedHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || '', 10);
    return cachedHash;
}

router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    const expectedUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (String(username).trim().toLowerCase() !== expectedUser) {
        return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    const hash = await getAdminHash();
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect username or password.' });

    const token = jwt.sign({ admin: true, username: expectedUser }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, cookieOpts);
    res.json({ ok: true, username: expectedUser });
});

router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
    res.json({ username: req.admin.username });
});

module.exports = router;
