// server/routes/judge-link.js
const express = require('express');
const router = express.Router();

async function callDeepSeek(messages) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.3,
            stream: false
        })
    });
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

async function fetchPageContent(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'CSCSE-Assistant/1.0' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) return null;
        
        const html = await response.text();
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        return text.substring(0, 3000);
    } catch (error) {
        console.warn('抓取页面失败:', error.message);
        return null;
    }
}

router.post('/', async (req, res) => {
    try {
        const { link_url, university_name, target_major } = req.body;
        
        if (!link_url) {
            return res.status(400).json({ error: 'link_url 为必填字段' });
        }
        
        // 尝试抓取页面内容
        let pageContent = null;
        try {
            pageContent = await fetchPageContent(link_url);
        } catch (e) {
            console.warn('页面抓取失败');
        }
        
        const prompt = `判断以下链接是否包含有效的培养方案信息：

URL：${link_url}
学校：${university_name || '未知'}
目标专业：${target_major || '未知'}

${pageContent ? `页面内容摘要：${pageContent.substring(0, 1500)}` : '无法获取页面内容，请仅根据 URL 结构判断'}

输出 JSON：{"status":"合理/部分合理/不合理","reason":"理由"}`;

        const result = await callDeepSeek([
            { role: 'system', content: '你是留学认证材料审核专家，只输出 JSON' },
            { role: 'user', content: prompt }
        ]);
        
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            const judgment = jsonMatch ? JSON.parse(jsonMatch[0]) : { status: '未知', reason: result.substring(0, 200) };
            
            res.json({
                status: judgment.status,
                reason: judgment.reason,
                page_fetched: !!pageContent
            });
        } catch {
            res.json({ status: '未知', reason: result.substring(0, 200) });
        }
        
    } catch (error) {
        console.error('Judge link error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;