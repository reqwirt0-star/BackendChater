// server/server.js - ФИНАЛЬНАЯ ВЕРСИЯ С БАЗОЙ ДАННЫХ JSONBin

// 1. Подключаем пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs'); // fs нужен только для чтения users.json
const path = require('path');

// --- ВАЖНО: Вставь сюда свои данные из JSONBin ---
const JSONBIN_API_KEY = '$2a$10$zYvDQk9drvX9HmsQuIz0WO6i.pahvE86hPhXO2tybjYrVfyjjyWhG'; // Вставь сюда Master Key
const JSONBIN_BIN_ID = '68dbbcf143b1c97be955565b';             // Вставь сюда ID твоего "бина"
// ----------------------------------------------------


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

// 3. Путь к файлу пользователей (остается локальным)
const usersPath = path.join(__dirname, 'users.json');


// 4. Эндпоинт для логина (без изменений)
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

// 5. Эндпоинт для получения контента (🔥 ИЗМЕНЕН для работы с JSONBin)
app.get('/content', async (req, res) => {
    try {
        // Делаем запрос к JSONBin, чтобы получить последнюю версию нашего контента
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_API_KEY }
        });
        if (!response.ok) {
            throw new Error('Не удалось загрузить контент из базы данных');
        }
        
        const data = await response.json();
        
        // Отправляем клиенту контент из "бина"
        res.setHeader('Cache-Control', 'no-cache'); // Заголовки от кэша оставляем, это полезно
        res.status(200).json(data.record);

    } catch (error) {
        console.error("Ошибка при получении контента из JSONBin:", error);
        res.status(500).json({ message: "Ошибка при чтении контента." });
    }
});

// 6. Эндпоинт для ОБНОВЛЕНИЯ контента (🔥 ИЗМЕНЕН для работы с JSONBin)
app.post('/update-content', async (req, res) => {
    const token = req.headers.authorization;
    const newContent = req.body;

    // Шаг 1: Проверяем, что пользователь - менеджер (эта логика не меняется)
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

        // Шаг 2: Если проверка пройдена, отправляем данные в JSONBin
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify(newContent)
        });

        if (!response.ok) {
            throw new Error('Ошибка при сохранении в базу данных');
        }
        
        console.log(`Контент успешно обновлен менеджером: ${username}`);
        res.status(200).json({ success: true, message: 'Контент обновлен.' });

    } catch (error) {
        console.error("Ошибка при обновлении контента в JSONBin:", error);
        res.status(500).json({ message: 'Ошибка на сервере при сохранении.' });
    }
});

// 7. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with JSONBin integration`);
});