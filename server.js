// server/server.js

// 1. Подключаем установленные пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 2. Инициализируем приложение
const app = express();
const port = 3000; // Порт, на котором будет работать наш сервер

// 3. Используем "промежуточное ПО" (middleware)
app.use(cors()); // Разрешает запросы с других доменов (с вашего index.html)
app.use(bodyParser.json()); // Позволяет серверу читать JSON из тела запроса

// 4. 🔥 ГЛАВНОЕ: Учётные данные теперь хранятся здесь, на сервере!
// Они больше НЕ доступны в браузере.
// СТАЛО:
const credentials = require('./users.json');
];

// 5. Создаём эндпоинт (адрес) для обработки логина
app.post('/login', (req, res) => {
    // Получаем логин и пароль из тела запроса, который пришлёт клиент
    const { username, password } = req.body;

    // Ищем пользователя в нашем массиве
    const user = credentials.find(u => u.username === username && u.password === password);

    if (user) {
        // Пользователь найден. Отправляем успешный ответ (200 OK)
        console.log(`Successfull login for user: ${username}`);
        res.status(200).json({
            success: true,
            // В реальном приложении здесь генерируется уникальный и временный токен (JWT)
            token: 'secret-auth-token-for-' + username
        });
    } else {
        // Пользователь не найден. Отправляем ошибку (401 Unauthorized)
        console.log(`Failed login attempt for user: ${username}`);
        res.status(401).json({
            success: false,
            message: 'Неверные данные. Свяжитесь с менеджером.'
        });
    }
});

// 6. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Secure server is running at http://localhost:${port}`);
});