// Vercel serverless: POST /api/proxy — DeepSeek API forward

async function callDeepSeek(messages, options = {}) {
    const { temperature = 0.3, model = 'deepseek-chat' } = options;
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

    if (!DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({ model, messages, temperature, stream: false })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { model, messages, temperature } = req.body;
        const content = await callDeepSeek(messages, { model, temperature });
        res.json({ choices: [{ message: { content } }] });
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
};
