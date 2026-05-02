// backend/api/feedback.js
const express = require('express');
const router = express.Router();
const { query, execute } = require('../db');

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
            temperature: 0.3
        })
    });
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

async function judgeLinkWithAI(linkUrl, universityName, targetMajor, pageContent = '') {
    const prompt = `判断以下链接是否包含有效的培养方案信息：

URL：${linkUrl}
学校：${universityName}
目标专业：${targetMajor}

${pageContent ? `页面内容摘要：${pageContent.substring(0, 2000)}` : '请仅根据 URL 结构判断'}

输出 JSON：{"status":"合理/部分合理/不合理","reason":"判断理由"}`;

    const result = await callDeepSeek([
        { role: 'system', content: '你是留学认证材料审核专家，只输出 JSON' },
        { role: 'user', content: prompt }
    ]);
    
    try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { status: '未知', reason: '解析失败' };
    } catch {
        return { status: '未知', reason: result.substring(0, 200) };
    }
}

async function fetchPageContent(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'CSCSE-Assistant/1.0' } });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        const html = await response.text();
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
        return text.substring(0, 3000);
    } catch { return null; }
}

router.post('/', async (req, res) => {
    try {
        const { link_url, university_name, target_major, education_level = 'master', user_reason = '', submitter_id } = req.body;
        
        if (!link_url || !university_name) {
            return res.status(400).json({ error: 'link_url 和 university_name 为必填字段' });
        }
        
        // 检查是否已存在
        const existing = await query('SELECT id, status FROM user_feedback_links WHERE link_url = ?', [link_url]);
        if (existing.length > 0) {
            return res.json({ id: existing[0].id, isNew: false, status: existing[0].status });
        }
        
        // 抓取页面内容
        let pageContent = null;
        try { pageContent = await fetchPageContent(link_url); } catch(e) {}
        
        // AI 判定
        const judgment = await judgeLinkWithAI(link_url, university_name, target_major, pageContent);
        
        let finalStatus = 'rejected';
        if (judgment.status === '合理') {
            finalStatus = 'approved';
        } else if (judgment.status === '部分合理') {
            finalStatus = 'pending';
        }
        
        // 保存
        const result = await execute(
            `INSERT INTO user_feedback_links 
             (link_url, university_name, target_major, education_level, 
              submitter_id, ai_judgment, judgment_reason, user_reason, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [link_url, university_name, target_major, education_level,
             submitter_id || null, judgment.status, judgment.reason, user_reason, finalStatus]
        );
        
        // 如果合理，直接加入知识库
        if (finalStatus === 'approved') {
            await execute(
                `INSERT INTO knowledge_base (link_id, university_name, link_url, target_major, education_level, avg_score, vote_count, is_trusted)
                 VALUES (?, ?, ?, ?, ?, 0, 0, TRUE)
                 ON DUPLICATE KEY UPDATE is_trusted = TRUE`,
                [result.insertId, university_name, link_url, target_major, education_level]
            );
        }
        
        res.json({
            id: result.insertId,
            isNew: true,
            status: finalStatus,
            ai_judgment: judgment.status,
            judgment_reason: judgment.reason
        });
        
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;