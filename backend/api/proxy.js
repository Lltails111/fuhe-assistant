// backend/api/proxy.js
const express = require('express');
const router = express.Router();

async function callDeepSeek(messages, options = {}) {
    const { temperature = 0.3, model = 'deepseek-chat' } = options;
    
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY 未配置');
    }
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: temperature,
            stream: false
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API 错误: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

router.post('/', async (req, res) => {
    try {
        const { model, messages, temperature } = req.body;
        const content = await callDeepSeek(messages, { model, temperature });
        res.json({ choices: [{ message: { content } }] });
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;