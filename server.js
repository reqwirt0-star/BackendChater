// server/server.js - ВЕРСИЯ С КЛЮЧАМИ ДЛЯ ПЕРЕВОДА СООБЩЕНИЙ

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

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'PATCH'], credentials: true }));
app.use(bodyParser.json());

function getUsernameFromToken(req) {
    const token = req.headers.authorization;
    if (!token || !token.startsWith('secret-auth-token-for-')) return null;
    return token.replace('secret-auth-token-for-', '');
}

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'username_and_password_required' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=username,role,password_hash&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0) return res.status(401).json({ success: false, message: 'invalid_credentials' });
        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (isPasswordCorrect) res.status(200).json({ success: true, token: 'secret-auth-token-for-' + user.username, role: user.role });
        else res.status(401).json({ success: false, message: 'invalid_credentials' });
    } catch (err) { res.status(500).json({ message: "server_error" }); }
});

app.get('/content', async (req, res) => {
    try {
        const { data } = await axios.get(`${SUPABASE_URL}/rest/v1/app_content?select=data&id=eq.${CONTENT_ROW_ID}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (data && data.length > 0) res.status(200).json(data[0].data);
        else res.status(404).json({ message: "content_not_found" });
    } catch (error) { res.status(500).json({ message: "content_read_error" }); }
});

app.post('/update-content', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) return res.status(401).json({ message: 'invalid_token' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=role&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0 || users[0].role !== 'manager') return res.status(403).json({ message: 'access_denied' });
        await axios.patch(`${SUPABASE_URL}/rest/v1/app_content?id=eq.${CONTENT_ROW_ID}`, { data: req.body }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'content_updated_successfully' });
    } catch (err) { res.status(500).json({ message: 'server_error_on_save' }); }
});

app.get('/api/favorites', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) return res.status(401).json({ message: 'invalid_token' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=favorite_buttons&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (users && users.length > 0) res.status(200).json({ favorites: users[0].favorite_buttons || [] });
        else res.status(404).json({ message: 'user_not_found' });
    } catch (error) { res.status(500).json({ message: 'server_error' }); }
});

app.post('/api/favorites', async (req, res) => {
    const username = getUsernameFromToken(req);
    const { favorites } = req.body;
    if (!username) return res.status(401).json({ message: 'invalid_token' });
    if (!Array.isArray(favorites)) return res.status(400).json({ message: 'invalid_data_format' });
    try {
        await axios.patch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, { favorite_buttons: favorites }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        res.status(200).json({ success: true, message: 'favorites_updated' });
    } catch (error) { res.status(500).json({ message: 'server_error' }); }
});

app.post('/api/track-click', async (req, res) => {
    const username = getUsernameFromToken(req);
    const { buttonId } = req.body;
    if (!username) return res.status(401).json({ message: 'anonymous_click' });
    if (!buttonId) return res.status(400).json({ message: 'button_id_not_specified' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0) return res.status(404).json({ message: 'user_not_found' });
        const userId = users[0].id;
        await axios.post(`${SUPABASE_URL}/rest/v1/clicks_analytics`, { button_id: buttonId, user_id: userId }, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        res.status(201).json({ success: true });
    } catch (error) { res.status(500).json({ message: 'click_tracking_error' }); }
});

app.get('/api/analytics', async (req, res) => {
    const username = getUsernameFromToken(req);
    if (!username) return res.status(401).json({ message: 'invalid_token' });
    try {
        const { data: users } = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=role&username=eq.${username}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!users || users.length === 0 || users[0].role !== 'manager') return res.status(403).json({ message: 'access_denied' });
        const period = req.query.period || 'day';
        let interval = '100 year';
        if (period === 'day') interval = '1 day';
        if (period === 'week') interval = '7 day';
        if (period === 'month') interval = '1 month';
        const { data: stats, error } = await axios.post(`${SUPABASE_URL}/rest/v1/rpc/get_detailed_analytics`,{ period_interval: interval },{ headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
        if (error) throw new Error('analytics_db_error');
        res.status(200).json(stats);
    } catch (err) { res.status(500).json({ message: 'analytics_server_error' }); }
});

app.listen(port, () => {
    console.log(`✅ Server is running on port ${port} with Supabase integration`);
});