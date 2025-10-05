// server/server.js - ФИНАЛЬНАЯ ВЕРСИЯ С JWT, ЛОГИРОВАНИЕМ И ОГРАНИЧЕНИЕМ CORS

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const CONTENT_ROW_ID = 1;

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
// Обновлено: поддержка нескольких фронтенд-доменов (новый Vercel + локальная разработка)
const allowedOrigins = [
    'https://frontendnew-swart.vercel.app',
    'https://glittering-panda-de3dbb.netlify.app',
    'https://frontendnew-swart.vercel.app/',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS: Origin not allowed'));
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Явно обрабатываем preflight-запросы для всех маршрутов
app.options('*', cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS: Origin not allowed'));
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// --- JWT MIDDLEWARE ДЛЯ ПРОВЕРКИ ТОКЕНА И РОЛИ ---
const verifyTokenAndRole = (allowedRoles) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token == null) {
            return res.status(401).json({ message: 'token_not_provided' });
        }

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ message: 'invalid_token' });
            }
            if (allowedRoles && !allowedRoles.includes(user.role)) {
                return res.status(403).json({ message: 'access_denied' });
            }
            req.user = user;
            next();
        });
    };
};

// --- МАРШРУТЫ (ENDPOINTS) ---

// --- Публичные маршруты ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'username_and_password_required' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=username,role,password_hash&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0) return res.status(401).json({ success: false, message: 'invalid_credentials' });
        
        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

        if (isPasswordCorrect) {
            const payload = { username: user.username, role: user.role };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            res.status(200).json({ success: true, token: token, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'invalid_credentials' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: "server_error" });
    }
});

app.get('/content', async (req, res) => {
    try {
        const { data } = await axios.get(`${SUPABASE_URL}/rest/v1/app_content?select=data&id=eq.${CONTENT_ROW_ID}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (data && data.length > 0) res.status(200).json(data[0].data);
        else res.status(404).json({ message: "content_not_found" });
    } catch (error) {
        console.error('Content read error:', error);
        res.status(500).json({ message: "content_read_error" });
    }
});


// --- Защищенные маршруты для всех авторизованных пользователей ---
const anyUser = ['manager', 'employee'];

app.get('/api/favorites', verifyTokenAndRole(anyUser), async (req, res) => {
    const username = req.user.username;
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=favorite_buttons&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (users && users.length > 0) res.status(200).json({ favorites: users[0].favorite_buttons || [] });
        else res.status(404).json({ message: 'user_not_found' });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ message: 'server_error' });
    }
});

app.post('/api/favorites', verifyTokenAndRole(anyUser), async (req, res) => {
    const username = req.user.username;
    const { favorites } = req.body;
    if (!Array.isArray(favorites)) return res.status(400).json({ message: 'invalid_data_format' });
    try {
        await axios.patch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, { favorite_buttons: favorites }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'favorites_updated' });
    } catch (error) {
        console.error('Error saving favorites:', error);
        res.status(500).json({ message: 'server_error' });
    }
});

app.post('/api/track-click', verifyTokenAndRole(anyUser), async (req, res) => {
    const username = req.user.username;
    const { buttonId } = req.body;
    if (!buttonId) return res.status(400).json({ message: 'button_id_not_specified' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0) return res.status(404).json({ message: 'user_not_found' });
        const userId = users[0].id;
        await axios.post(`${SUPABASE_URL}/rest/v1/clicks_analytics`, { button_id: buttonId, user_id: userId }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error tracking click:', error);
        res.status(500).json({ message: 'click_tracking_error' });
    }
});


// --- Защищенные маршруты только для менеджеров ---
const managerOnly = ['manager'];

app.post('/update-content', verifyTokenAndRole(managerOnly), async (req, res) => {
    try {
        await axios.patch(`${SUPABASE_URL}/rest/v1/app_content?id=eq.${CONTENT_ROW_ID}`, { data: req.body }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'content_updated_successfully' });
    } catch (err) {
        console.error('Error updating content:', err);
        res.status(500).json({ message: 'server_error_on_save' });
    }
});

app.get('/api/analytics', verifyTokenAndRole(managerOnly), async (req, res) => {
    try {
        const period = req.query.period || 'day';
        let interval = '100 year';
        if (period === 'day') interval = '1 day';
        if (period === 'week') interval = '7 day';
        if (period === 'month') interval = '1 month';
        const { data: stats, error } = await axios.post(`${SUPABASE_URL}/rest/v1/rpc/get_detailed_analytics`,{ period_interval: interval },{ headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        if (error) throw new Error('analytics_db_error');
        res.status(200).json(stats);
    } catch (err) {
        console.error('Error fetching analytics:', err);
        res.status(500).json({ message: 'analytics_server_error' });
    }
});

app.get('/api/users', verifyTokenAndRole(managerOnly), async (req, res) => {
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id,username,role`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'server_error_fetching_users' });
    }
});

app.post('/api/users/create', verifyTokenAndRole(managerOnly), async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: 'missing_user_data' });
    if (role !== 'manager' && role !== 'employee') return res.status(400).json({ message: 'invalid_role' });
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = { username, password_hash, role };
        await axios.post(`${SUPABASE_URL}/rest/v1/users`, newUser, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' } });
        res.status(201).json({ success: true, message: 'user_created_successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.response && error.response.data && error.response.data.message.includes('duplicate key value')) {
            return res.status(409).json({ message: 'user_already_exists' });
        }
        res.status(500).json({ message: 'server_error_creating_user' });
    }
});

app.post('/api/users/delete', verifyTokenAndRole(managerOnly), async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'username_not_provided' });
    
    const managerUsername = req.user.username;
    if (username === managerUsername) {
        return res.status(400).json({ message: 'cannot_delete_self' });
    }
    try {
        await axios.delete(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'user_deleted_successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'server_error_deleting_user' });
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with Supabase integration`);
});