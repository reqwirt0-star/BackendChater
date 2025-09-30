// server/server.js - ФИНАЛЬНАЯ ВЕРСИЯ БЭКЕНДА

// 1. Подключаем пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs'); // Модуль для работы с файлами
const path = require('path'); // Модуль для работы с путями

// 2. Инициализируем приложение
const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
    'https://glittering-panda-de3dbb.netlify.app' // Убедись, что это твой актуальный адрес
];

app.use(cors({
    origin: function (origin, callback) {
        // Позволяет запросы без origin (например, с мобильных приложений или Postman)
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

// 4. Эндпоинт для логина (МОДИФИЦИРОВАН)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    try {
        const credentials = JSON.parse(fs.readFileSync(usersPath));
        const user = credentials.find(u => u.username === username && u.password === password);

        if (user) {
            console.log(`Successful login for user: ${username}, role: ${user.role}`);
            res.status(200).json({
                success: true,
                token: 'secret-auth-token-for-' + user.username,
                role: user.role
            });
        } else {
            console.log(`Failed login attempt for user: ${username}`);
            res.status(401).json({
                success: false,
                message: 'Неверные данные. Свяжитесь с менеджером.'
            });
        }
    } catch (error) {
        console.error("Error reading users file:", error);
        res.status(500).json({ message: "Ошибка на сервере." });
    }
});

// 5. НОВЫЙ эндпоинт для получения контента (для всех)
app.get('/content', (req, res) => {
    try {
        const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
        res.status(200).json(content);
    } catch (error) {
        console.error("Could not read content file:", error);
        res.status(500).json({ message: "Ошибка на сервере при чтении контента." });
    }
});

// 6. НОВЫЙ эндпоинт для ОБНОВЛЕНИЯ контента (только для менеджеров)
app.post('/update-content', (req, res) => {
    const token = req.headers.authorization;
    const newContent = req.body;

    if (!token || !token.startsWith('secret-auth-token-for-')) {
        return res.status(401).json({ message: 'Отсутствует или неверный токен аутентификации.' });
    }
    
    try {
        const username = token.replace('secret-auth-token-for-', '');
        const credentials = JSON.parse(fs.readFileSync(usersPath));
        const user = credentials.find(u => u.username === username);

        if (!user || user.role !== 'manager') {
            console.log(`Forbidden attempt to update content by user: ${username || 'unknown'}`);
            return res.status(403).json({ message: 'Доступ запрещен. Требуются права менеджера.' });
        }

        fs.writeFileSync(contentPath, JSON.stringify(newContent, null, 2));
        console.log(`Content updated successfully by manager: ${username}`);
        res.status(200).json({ success: true, message: 'Контент успешно обновлен.' });

    } catch (error) {
        console.error("Error during content update:", error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера.' });
    }
});

// 7. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Server with roles is running on port ${port}`);
});