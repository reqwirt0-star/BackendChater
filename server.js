// server/server.js - ВЕРСИЯ С МИГРАЦИЕЙ ПОЛЬЗОВАТЕЛЕЙ В SUPABASE

// 1. Подключаем пакеты
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); // Используем для работы с Supabase API
const bcrypt = require('bcryptjs'); // <<< ДОБАВЛЕНО для хеширования паролей

// --- ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ SUPABASE (для Render) ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CONTENT_ROW_ID = 1;
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

// 3. Путь к файлу пользователей (УДАЛЕНО, больше не используется)
// const usersPath = path.join(__dirname, 'users.json');

// 4. Эндпоинт для логина (ПОЛНОСТЬЮ ПЕРЕРАБОТАН)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Необходимо указать имя пользователя и пароль.' });
    }

    try {
        // Ищем пользователя в таблице 'users' в Supabase по имени
        const { data: users, error } = await axios.get(
            `${SUPABASE_URL}/rest/v1/users?select=username,role,password_hash&username=eq.${username}`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (error) throw new Error(error.message);
        
        if (!users || users.length === 0) {
            return res.status(401).json({ success: false, message: 'Неверные данные.' });
        }

        const user = users[0];

        // Сравниваем предоставленный пароль с хешем в базе данных
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

        if (isPasswordCorrect) {
            // Пароль верный, отправляем токен
            res.status(200).json({ success: true, token: 'secret-auth-token-for-' + user.username, role: user.role });
        } else {
            // Пароль неверный
            res.status(401).json({ success: false, message: 'Неверные данные.' });
        }

    } catch (err) {
        console.error("Ошибка при аутентификации:", err.message);
        res.status(500).json({ message: "Ошибка на сервере." });
    }
});


// 5. Эндпоинт для получения контента (без изменений)
app.get('/content', async (req, res) => {
    // ... (код остается прежним)
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("Supabase ключи не установлены!");
        return res.status(500).json({ message: "Сервер не настроен для подключения к базе данных." });
    }
    
    try {
        const response = await axios.get(
            `${SUPABASE_URL}/rest/v1/app_content?select=data&id=eq.${CONTENT_ROW_ID}`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );
        
        if (response.data && response.data.length > 0) {
            res.setHeader('Cache-Control', 'no-cache'); 
            res.status(200).json(response.data[0].data);
        } else {
            res.status(404).json({ message: "Контент не найден в базе данных. Проверьте, что строка с ID=1 заполнена." });
        }

    } catch (error) {
        console.error("Ошибка при получении контента из Supabase:", error.message);
        res.status(500).json({ message: "Ошибка при чтении контента." });
    }
});

// 6. Эндпоинт для ОБНОВЛЕНИЯ контента (Аутентификация изменена)
app.post('/update-content', async (req, res) => {
    const token = req.headers.authorization;
    const newContent = req.body;

    if (!token || !token.startsWith('secret-auth-token-for-')) {
        return res.status(401).json({ message: 'Неверный токен.' });
    }

    try {
        const username = token.replace('secret-auth-token-for-', '');
        
        // Теперь проверяем роль пользователя в базе данных, а не в файле
        const { data: users, error } = await axios.get(
            `${SUPABASE_URL}/rest/v1/users?select=role&username=eq.${username}`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );

        if (error || !users || users.length === 0) {
             return res.status(403).json({ message: 'Пользователь не найден.' });
        }
       
        const user = users[0];
        if (user.role !== 'manager') {
            return res.status(403).json({ message: 'Доступ запрещен.' });
        }
        
        if (!SUPABASE_SERVICE_KEY) {
            console.error("Supabase Service Key не установлен!");
            return res.status(500).json({ message: "Сервер не настроен для записи в базу данных." });
        }

        const response = await axios.patch(
            `${SUPABASE_URL}/rest/v1/app_content?id=eq.${CONTENT_ROW_ID}`, 
            { data: newContent },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );

        if (response.status >= 300) {
             throw new Error(`Ошибка при сохранении в базу данных: Статус ${response.status}`);
        }
        
        console.log(`Контент успешно обновлен менеджером: ${username}`);
        res.status(200).json({ success: true, message: 'Контент обновлен.' });

    } catch (err) {
        console.error("Ошибка при обновлении контента в Supabase:", err.message);
        res.status(500).json({ message: 'Ошибка на сервере при сохранении.' });
    }
});


// 7. Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with Supabase integration`);
});