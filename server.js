// server/server.js - ПОЛНАЯ ВЕРСИЯ С API ДЛЯ СТАТИСТИКИ

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

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH'],
    credentials: true
}));
app.use(bodyParser.json());

function getUsernameFromToken(req) {
    const token = req.headers.authorization;
    if (!token || !token.startsWith('secret-auth-token-for-')) {
        return null;
    }
    return token.replace('secret-auth-token-for-', '');
}

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Необходимо указать имя пользователя и пароль.' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=username,role,password_hash&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0) return res.status(401).json({ success: false, message: 'Неверные данные.' });
        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (isPasswordCorrect) res.status(200).json({ success: true, token: 'secret-auth-token-for-' + user.username, role: user.role });
        else res.status(401).json({ success: false, message: 'Неверные данные.' });
    } catch (err) { res.status(500).json({ message: "Ошибка на сервере." }); }
});

app.get('/content', async (req, res) => {
    try {
        const { data } = await axios.get(`${SUPABASE_URL}/rest/v1/app_content?select=data&id=eq.${CONTENT_ROW_ID}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (data && data.length > 0) res.status(200).json(data[0].data);
        else res.status(404).json({ message: "Контент не найден." });
    } catch (error) { res.status(500).json({ message: "Ошибка при чтении контента." }); }
});

app.post('/update-content', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) return res.status(401).json({ message: 'Неверный токен.' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=role&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0 || users[0].role !== 'manager') return res.status(403).json({ message: 'Доступ запрещен.' });
        await axios.patch(`${SUPABASE_URL}/rest/v1/app_content?id=eq.${CONTENT_ROW_ID}`, { data: req.body }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'Контент обновлен.' });
    } catch (err) { res.status(500).json({ message: 'Ошибка на сервере при сохранении.' }); }
});

app.get('/api/favorites', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) return res.status(401).json({ message: 'Неверный токен.' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=favorite_buttons&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (users && users.length > 0) res.status(200).json({ favorites: users[0].favorite_buttons || [] });
        else res.status(404).json({ message: 'Пользователь не найден.' });
    } catch (error) { res.status(500).json({ message: 'Ошибка на сервере.' }); }
});

app.post('/api/favorites', async (req, res) => {
    const username = getUsernameFromToken(req);
    const { favorites } = req.body;
    if (!username) return res.status(401).json({ message: 'Неверный токен.' });
    if (!Array.isArray(favorites)) return res.status(400).json({ message: 'Неверный формат данных.' });
    try {
        await axios.patch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, { favorite_buttons: favorites }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'Избранное обновлено.' });
    } catch (error) { res.status(500).json({ message: 'Ошибка на сервере.' }); }
});

app.post('/api/track-click', async (req, res) => {
    const username = getUsernameFromToken(req);
    const { buttonId } = req.body;
    if (!username) return res.status(401).json({ message: 'Анонимный клик' });
    if (!buttonId) return res.status(400).json({ message: 'Не указан ID кнопки' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0) return res.status(404).json({ message: 'Пользователь не найден' });
        const userId = users[0].id;
        await axios.post(`${SUPABASE_URL}/rest/v1/clicks_analytics`, { button_id: buttonId, user_id: userId }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        res.status(201).json({ success: true });
    } catch (error) { res.status(500).json({ message: 'Ошибка на сервере при записи клика' }); }
});

app.get('/api/analytics', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) return res.status(401).json({ message: 'Неверный токен.' });

    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=role&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0 || users[0].role !== 'manager') {
            return res.status(403).json({ message: 'Доступ запрещен.' });
        }

        const period = req.query.period || 'all';
        let interval = '100 year';
        if (period === 'day') interval = '1 day';
        if (period === 'week') interval = '7 day';
        if (period === 'month') interval = '1 month';

        const rpcPayload = { period_interval: interval };

        const { data: stats, error } = await axios.post(
            `${SUPABASE_URL}/rest/v1/rpc/get_analytics`,
            rpcPayload,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );

        if (error) {
            throw new Error('Ошибка при получении аналитики из БД');
        }

        res.status(200).json(stats);

    } catch (err) {
        console.error("Ошибка при получении аналитики:", err.message);
        res.status(500).json({ message: 'Ошибка на сервере при получении аналитики.' });
    }
});

app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with Supabase integration`);
});