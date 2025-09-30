// server/server.js - ФИНАЛЬНАЯ ВЕРСИЯ С ОТКЛЮЧЕНИЕМ КЭША

// 1. Подключаем пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// 2. Инициализируем приложение
const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
    'https://glittering-panda-de3dbb.netlify.app'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));
app.use(bodyParser.json());

// 3. Пути к нашим JSON файлам
const usersPath = path.join(__dirname, 'users.json');
const contentPath = path.join(__dirname, 'content.json');

// 4. Эндпоинт для логина
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const credentials = JSON.parse(fs.readFileSync(usersPath));
        const user = credentials.find(u => u.username === username && u.password === password);
        if (user) {
            res.status(200).json({ success: true, token: 'secret-auth-token-for-' + user.username, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'Неверные данные.' });
        }
    } catch (error) {
        res.status(500).json({ message: "Ошибка на сервере." });
    }
});

// 5. Эндпоинт для получения контента (ИЗМЕНЕН)
app.get('/content', (req, res) => {
    try {
        // 🔥 НОВОЕ: Устанавливаем заголовки, чтобы запретить кэширование этого запроса
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
        res.status(200).json(content);
    } catch (error) {
        res.status(500).json({ message: "Ошибка при чтении контента." });
    }
});

// 6. Эндпоинт для ОБНОВЛЕНИЯ контента
app.post('/update-content', (req, res) => {
    const token = req.headers.authorization;
    const newContent = req.body;
    if (!token || !token.startsWith('secret-auth-token-for-')) {
        return res.status(401).json({ message: 'Неверный токен.' });
    }
    try {
        const username = token.replace('secret-auth-token-for-', '');
        const credentials = JSON.parse(fs.readFileSync(usersPath));
        const user = credentials.find(u => u.username === username);
        if (!user || user.role !== 'manager') {
            return res.status(403).json({ message: 'Доступ запрещен.' });
        }
        fs.writeFileSync(contentPath, JSON.stringify(newContent, null, 2));
        res.status(200).json({ success: true, message: 'Контент обновлен.' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка на сервере.' });
    }
});

// 7. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Server with roles is running on port ${port}`);
});