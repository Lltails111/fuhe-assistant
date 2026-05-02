// Vercel serverless: POST /api/feedback — AI judge + DB insert
const { createClient } = require('@supabase/supabase-js');

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

async function callDeepSeek(messages) {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.3, stream: false })
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
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
        const { link_url, university_name, target_major, education_level, user_reason, submitter_id } = req.body;
        if (!link_url || !university_name) {
            return res.status(400).json({ error: 'link_url and university_name are required' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Check for duplicate
        const { data: existing } = await supabase
            .from('user_feedback_links')
            .select('id, status')
            .eq('link_url', link_url)
            .maybeSingle();

        if (existing) {
            return res.json({ id: existing.id, status: existing.status, duplicate: true });
        }

        // Fetch page content
        let pageContent = '';
        try {
            pageContent = await fetchPageContent(link_url) || '';
        } catch {
            // continue without page content
        }

        // AI judgment
        const prompt = `你是一个留服复核链接判定专家。请判定以下链接是否可以作为专业复核的参考依据。

学校：${university_name}
目标专业：${target_major || '未知'}
链接：${link_url}
${pageContent ? `页面内容摘要：${pageContent}` : '(无法获取页面内容)'}

请以 JSON 格式回复：{"judgment": "合理|部分合理|不合理", "reason": "判断理由"}`;

        let aiJudgment = '未知';
        let judgmentReason = '';

        try {
            const aiResponse = await callDeepSeek([
                { role: 'system', content: '你是专业复核链接判定专家。只输出 JSON。' },
                { role: 'user', content: prompt }
            ]);

            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                aiJudgment = parsed.judgment || '未知';
                judgmentReason = parsed.reason || '';
            }
        } catch {
            judgmentReason = 'AI 判定失败';
        }

        const statusMap = { '合理': 'approved', '部分合理': 'pending', '不合理': 'rejected', '未知': 'pending' };
        const status = statusMap[aiJudgment] || 'pending';

        // Insert into user_feedback_links
        const { data: inserted, error: insertError } = await supabase
            .from('user_feedback_links')
            .insert({
                link_url,
                university_name,
                target_major: target_major || null,
                education_level: education_level || 'master',
                submitter_id: submitter_id || null,
                ai_judgment: aiJudgment,
                judgment_reason: judgmentReason,
                user_reason: user_reason || null,
                status
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        // If approved, also add to knowledge_base
        if (status === 'approved') {
            const { error: kbError } = await supabase
                .from('knowledge_base')
                .upsert({
                    link_id: inserted.id,
                    university_name,
                    link_url,
                    target_major: target_major || null,
                    education_level: education_level || 'master',
                    avg_score: 0,
                    vote_count: 0,
                    is_trusted: true
                }, { onConflict: 'link_id' });

            if (kbError) console.error('Knowledge base insert error:', kbError);
        }

        res.json({
            id: inserted.id,
            status,
            ai_judgment: aiJudgment,
            judgment_reason: judgmentReason
        });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ error: error.message });
    }
};
