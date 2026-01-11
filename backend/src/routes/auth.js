const express = require('express');
const { login, verifyToken } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const token = await login(password);

    if (!token) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/verify', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
