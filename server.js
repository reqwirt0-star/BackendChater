// server/server.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

// 1. Подключаем установленные пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 2. Инициализируем приложение
const app = express();
// Render сам предоставит порт через переменную окружения, это стандартная практика
const port = process.env.PORT || 3000; 

// 3. Используем "промежуточное ПО" (middleware)
app.use(cors());
app.use(bodyParser.json());

// 4. Подключаем пользователей из отдельного файла
const credentials = require('./users.json');

// 5. Создаём эндпоинт (адрес) для обработки логина
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const user = credentials.find(u => u.username === username && u.password === password);

    if (user) {
        // Пользователь найден
        console.log(`Successful login for user: ${username}`);
        res.status(200).json({
            success: true,
            token: 'secret-auth-token-for-' + username 
        });
    } else {
        // Пользователь не найден
        console.log(`Failed login attempt for user: ${username}`);
        res.status(401).json({
            success: false,
            message: 'Неверные данные. Свяжитесь с менеджером.'
        });
    }
});

// 6. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Secure server is running on port ${port}`);
});
