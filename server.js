// server/server.js - ВЕРСИЯ С ДОБАВЛЕНИЕМ API ДЛЯ ИЗБРАННОГО

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CONTENT_ROW_ID = 1;

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
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH'], // Добавлен PATCH
    credentials: true
}));
app.use(bodyParser.json());

// Middleware для извлечения username из токена
function getUsernameFromToken(req) {
    const token = req.headers.authorization;
    if (!token || !token.startsWith('secret-auth-token-for-')) {
        return null;
    }
    return token.replace('secret-auth-token-for-', '');
}

// Эндпоинт для логина
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Необходимо указать имя пользователя и пароль.' });
    }

    try {
        const { data: users, error } = await axios.get(
            `${SUPABASE_URL}/rest/v1/users?select=username,role,password_hash&username=eq.${username}`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );

        if (error) throw new Error(error.message);
        if (!users || users.length === 0) {
            return res.status(401).json({ success: false, message: 'Неверные данные.' });
        }

        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

        if (isPasswordCorrect) {
            res.status(200).json({ success: true, token: 'secret-auth-token-for-' + user.username, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'Неверные данные.' });
        }

    } catch (err) {
        console.error("Ошибка при аутентификации:", err.message);
        res.status(500).json({ message: "Ошибка на сервере." });
    }
});

// Эндпоинт для получения контента
app.get('/content', async (req, res) => {
    try {
        const response = await axios.get(
            `${SUPABASE_URL}/rest/v1/app_content?select=data&id=eq.${CONTENT_ROW_ID}`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        
        if (response.data && response.data.length > 0) {
            res.setHeader('Cache-Control', 'no-cache'); 
            res.status(200).json(response.data[0].data);
        } else {
            res.status(404).json({ message: "Контент не найден." });
        }

    } catch (error) {
        console.error("Ошибка при получении контента:", error.message);
        res.status(500).json({ message: "Ошибка при чтении контента." });
    }
});

// Эндпоинт для ОБНОВЛЕНИЯ контента
app.post('/update-content', async (req, res) => {
    const newContent = req.body;
    const username = getUsernameFromToken(req);

    if (!username) {
        return res.status(401).json({ message: 'Неверный токен.' });
    }

    try {
        const { data: users } = await axios.get(
            `${SUPABASE_URL}/rest/v1/users?select=role&username=eq.${username}`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
       
        if (!users || users.length === 0 || users[0].role !== 'manager') {
            return res.status(403).json({ message: 'Доступ запрещен.' });
        }
        
        await axios.patch(
            `${SUPABASE_URL}/rest/v1/app_content?id=eq.${CONTENT_ROW_ID}`, 
            { data: newContent },
            { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        
        console.log(`Контент успешно обновлен менеджером: ${username}`);
        res.status(200).json({ success: true, message: 'Контент обновлен.' });

    } catch (err) {
        console.error("Ошибка при обновлении контента:", err.message);
        res.status(500).json({ message: 'Ошибка на сервере при сохранении.' });
    }
});


// ================== НАЧАЛО: API ДЛЯ ИЗБРАННОГО ==================

// 1. Получить список избранных кнопок пользователя
app.get('/api/favorites', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) {
        return res.status(401).json({ message: 'Неверный токен.' });
    }

    try {
        const { data: users } = await axios.get(
            `${SUPABASE_URL}/rest/v1/users?select=favorite_buttons&username=eq.${username}`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );

        if (users && users.length > 0) {
            // Возвращаем массив ID кнопок или пустой массив, если null
            res.status(200).json({ favorites: users[0].favorite_buttons || [] });
        } else {
            res.status(404).json({ message: 'Пользователь не найден.' });
        }
    } catch (error) {
        console.error("Ошибка при получении избранного:", error.message);
        res.status(500).json({ message: 'Ошибка на сервере.' });
    }
});

// 2. Сохранить (обновить) список избранных кнопок
app.post('/api/favorites', async (req, res) => {
    const username = getUsernameFromToken(req);
    const { favorites } = req.body; // Ожидаем массив ID кнопок

    if (!username) {
        return res.status(401).json({ message: 'Неверный токен.' });
    }
    if (!Array.isArray(favorites)) {
        return res.status(400).json({ message: 'Неверный формат данных.' });
    }

    try {
        await axios.patch(
            `${SUPABASE_URL}/rest/v1/users?username=eq.${username}`,
            { favorite_buttons: favorites }, // Обновляем поле
            { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        res.status(200).json({ success: true, message: 'Избранное обновлено.' });
    } catch (error) {
        console.error("Ошибка при сохранении избранного:", error.message);
        res.status(500).json({ message: 'Ошибка на сервере.' });
    }
});

// ================== КОНЕЦ: API ДЛЯ ИЗБРАННОГО ===================


// Запускаем сервер
app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with Supabase integration`);
});