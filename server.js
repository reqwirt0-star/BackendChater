// server/server.js - ФИНАЛЬНАЯ ВЕРСИЯ С БАЗОЙ ДАННЫХ SUPABASE

// 1. Подключаем пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs'); 
const path = require('path');
const axios = require('axios'); // Используем для работы с Supabase API

// --- ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ SUPABASE (для Render) ---
// ЭТИ КЛЮЧИ ДОЛЖНЫ БЫТЬ УСТАНОВЛЕНЫ В НАСТРОЙКАХ RENDER!
const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://awlbflsbkdlfmhixakwe.supabase.co
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; 
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; 
const CONTENT_ROW_ID = 1; // ID строки (наша таблица app_content)
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

// 5. Эндпоинт для получения контента (ЧТЕНИЕ из SUPABASE)
app.get('/content', async (req, res) => {
    // Проверка, что ключи установлены
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("Supabase ключи не установлены!");
        return res.status(500).json({ message: "Сервер не настроен для подключения к базе данных." });
    }
    
    try {
        // Запрос на чтение данных (SELECT) из таблицы app_content по ID=1
        const response = await axios.get(
            `${SUPABASE_URL}/rest/v1/app_content?select=data&id=eq.${CONTENT_ROW_ID}`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );
        
        // Supabase вернет массив: [{ data: {...} }]
        if (response.data && response.data.length > 0) {
            res.setHeader('Cache-Control', 'no-cache'); 
            res.status(200).json(response.data[0].data); // Отправляем содержимое поля 'data'
        } else {
            res.status(404).json({ message: "Контент не найден в базе данных. Проверьте, что строка с ID=1 заполнена." });
        }

    } catch (error) {
        console.error("Ошибка при получении контента из Supabase:", error.message);
        res.status(500).json({ message: "Ошибка при чтении контента." });
    }
});

// 6. Эндпоинт для ОБНОВЛЕНИЯ контента (ЗАПИСЬ в SUPABASE)
app.post('/update-content', async (req, res) => {
    const token = req.headers.authorization;
    const newContent = req.body;

    // Шаг 1: Проверяем, что пользователь - менеджер (логика аутентификации)
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
        
        // Проверка, что ключ установлен
        if (!SUPABASE_SERVICE_KEY) {
            console.error("Supabase Service Key не установлен!");
            return res.status(500).json({ message: "Сервер не настроен для записи в базу данных." });
        }


        // Шаг 2: Отправляем данные в Supabase (обновление строки с ID=1)
        const response = await axios.patch(
            // Используем PATCH для обновления существующей строки
            `${SUPABASE_URL}/rest/v1/app_content?id=eq.${CONTENT_ROW_ID}`, 
            { data: newContent }, // Обновляем столбец 'data'
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` // Используем SERVICE KEY для записи
                }
            }
        );

        // Проверяем статус ответа
        if (response.status >= 300) {
             throw new Error(`Ошибка при сохранении в базу данных: Статус ${response.status}`);
        }
        
        console.log(`Контент успешно обновлен менеджером: ${username}`);
        res.status(200).json({ success: true, message: 'Контент обновлен.' });

    } catch (error) {
        console.error("Ошибка при обновлении контента в Supabase:", error.message);
        res.status(500).json({ message: 'Ошибка на сервере при сохранении.' });
    }
});

// 7. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with Supabase integration`);
});