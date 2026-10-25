const express = require('express');
const app = express();
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'starting' } }));
module.exports = app;
