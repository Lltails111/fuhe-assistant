// 根据环境自动切换后端地址
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '';  // Vercel 部署时使用相对路径（前后端同域）

async function post(endpoint, data) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function get(endpoint, params = {}) {
    const url = new URL(`${API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function callDeepSeek(messages, options = {}) {
    const { temperature = 0.3, model = 'deepseek-chat' } = options;
    const result = await post('/api/proxy', { model, messages, temperature, stream: false });
    return result.choices?.[0]?.message?.content || '';
}

window.API = { post, get, callDeepSeek };