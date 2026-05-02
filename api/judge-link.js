// Vercel serverless: POST /api/judge-link — AI link judgment (no DB)

async function fetchPageContent(url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FuheAssistant/1.0)' }
        });
        clearTimeout(timeout);

        if (!response.ok) return null;

        const html = await response.text();
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000);

        return text;
    } catch {
        return null;
    }
}

async function callDeepSeek(messages, options = {}) {
    const { temperature = 0.3 } = options;
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
        body: JSON.stringify({ model: 'deepseek-chat', messages, temperature, stream: false })
    });

    if (!response.ok) {
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
        const { link_url, university_name, target_major } = req.body;
        if (!link_url) {
            return res.status(400).json({ error: 'link_url is required' });
        }

        let pageContent = '';
        let pageFetched = false;

        try {
            pageContent = await fetchPageContent(link_url);
            pageFetched = !!pageContent;
        } catch {
            // page fetch failed, continue with AI judgment only
        }

        const prompt = `你是一个留服复核链接判定专家。请判定以下链接是否可以作为专业复核的参考依据。

学校：${university_name || '未知'}
目标专业：${target_major || '未知'}
链接：${link_url}
${pageFetched ? `页面内容摘要：${pageContent}` : '(无法获取页面内容，请仅根据链接和学校信息判断)'}

请给出判定：
- 合理：链接指向该学校该专业的培养方案/课程设置官方页面
- 部分合理：链接指向该学校的相关页面但不够精确
- 不合理：链接与目标专业无关或指向其他学校

请以 JSON 格式回复：
{"judgment": "合理|部分合理|不合理", "reason": "判断理由"}`;

        const aiResponse = await callDeepSeek([
            { role: 'system', content: '你是专业复核链接判定专家。只输出 JSON，不要其他内容。' },
            { role: 'user', content: prompt }
        ]);

        let judgment = '未知';
        let reason = 'AI 未能给出判断';

        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                judgment = parsed.judgment || '未知';
                reason = parsed.reason || '无';
            }
        } catch {
            if (aiResponse.includes('合理')) judgment = '合理';
            else if (aiResponse.includes('部分合理')) judgment = '部分合理';
            else if (aiResponse.includes('不合理')) judgment = '不合理';
            reason = aiResponse;
        }

        const statusMap = { '合理': 'approved', '部分合理': 'pending', '不合理': 'rejected', '未知': 'pending' };

        res.json({
            status: statusMap[judgment] || 'pending',
            ai_judgment: judgment,
            reason: reason,
            page_fetched: pageFetched
        });
    } catch (error) {
        console.error('Judge-link error:', error);
        res.status(500).json({ error: error.message });
    }
};
