// Vercel serverless: monolithic API handler (all routes in one file)
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

async function callDeepSeek(messages, options = {}) {
    const { temperature = 0.3, model = 'deepseek-chat' } = options;
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model, messages, temperature, stream: false })
    });
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

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
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000);
    } catch { return null; }
}

function cors(res, methods = 'GET, POST, OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ==================== ROUTE HANDLERS ====================

async function handleProxy(req, res) {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { model, messages, temperature } = req.body;
        const content = await callDeepSeek(messages, { model, temperature });
        res.json({ choices: [{ message: { content } }] });
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleJudgeLink(req, res) {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { link_url, university_name, target_major } = req.body;
        if (!link_url) return res.status(400).json({ error: 'link_url is required' });

        let pageContent = '', pageFetched = false;
        try { pageContent = await fetchPageContent(link_url) || ''; pageFetched = !!pageContent; } catch {}

        const prompt = `你是一个留服复核链接判定专家。请判定以下链接是否可以作为专业复核的参考依据。

学校：${university_name || '未知'}
目标专业：${target_major || '未知'}
链接：${link_url}
${pageFetched ? `页面内容摘要：${pageContent}` : '(无法获取页面内容，请仅根据链接和学校信息判断)'}

请给出判定：
- 合理：链接指向该学校该专业的培养方案/课程设置官方页面
- 部分合理：链接指向该学校的相关页面但不够精确
- 不合理：链接与目标专业无关或指向其他学校

请以 JSON 格式回复：{"judgment": "合理|部分合理|不合理", "reason": "判断理由"}`;

        const aiResponse = await callDeepSeek([
            { role: 'system', content: '你是专业复核链接判定专家。只输出 JSON，不要其他内容。' },
            { role: 'user', content: prompt }
        ]);

        let judgment = '未知', reason = 'AI 未能给出判断';
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) { const p = JSON.parse(jsonMatch[0]); judgment = p.judgment || '未知'; reason = p.reason || '无'; }
        } catch {
            if (aiResponse.includes('合理')) judgment = '合理';
            else if (aiResponse.includes('部分合理')) judgment = '部分合理';
            else if (aiResponse.includes('不合理')) judgment = '不合理';
            reason = aiResponse;
        }
        const statusMap = { '合理': 'approved', '部分合理': 'pending', '不合理': 'rejected', '未知': 'pending' };
        res.json({ status: statusMap[judgment] || 'pending', ai_judgment: judgment, reason, page_fetched: pageFetched });
    } catch (error) {
        console.error('Judge-link error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleFeedback(req, res) {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { link_url, university_name, target_major, education_level, user_reason, submitter_id } = req.body;
        if (!link_url || !university_name) return res.status(400).json({ error: 'link_url and university_name are required' });

        const supabase = getSupabase();

        const { data: existing } = await supabase.from('user_feedback_links').select('id, status').eq('link_url', link_url).maybeSingle();
        if (existing) return res.json({ id: existing.id, status: existing.status, duplicate: true });

        let pageContent = '';
        try { pageContent = await fetchPageContent(link_url) || ''; } catch {}

        const prompt = `你是一个留服复核链接判定专家。请判定以下链接是否可以作为专业复核的参考依据。

学校：${university_name}
目标专业：${target_major || '未知'}
链接：${link_url}
${pageContent ? `页面内容摘要：${pageContent}` : '(无法获取页面内容)'}

请以 JSON 格式回复：{"judgment": "合理|部分合理|不合理", "reason": "判断理由"}`;

        let aiJudgment = '未知', judgmentReason = '';
        try {
            const aiResponse = await callDeepSeek([
                { role: 'system', content: '你是专业复核链接判定专家。只输出 JSON。' },
                { role: 'user', content: prompt }
            ]);
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) { const p = JSON.parse(jsonMatch[0]); aiJudgment = p.judgment || '未知'; judgmentReason = p.reason || ''; }
        } catch { judgmentReason = 'AI 判定失败'; }

        const statusMap = { '合理': 'approved', '部分合理': 'pending', '不合理': 'rejected', '未知': 'pending' };
        const status = statusMap[aiJudgment] || 'pending';

        const { data: inserted, error: insertError } = await supabase.from('user_feedback_links').insert({
            link_url, university_name,
            target_major: target_major || null,
            education_level: education_level || 'master',
            submitter_id: submitter_id || null,
            ai_judgment: aiJudgment,
            judgment_reason: judgmentReason,
            user_reason: user_reason || null,
            status
        }).select('id').single();
        if (insertError) throw insertError;

        if (status === 'approved') {
            await supabase.from('knowledge_base').upsert({
                link_id: inserted.id, university_name, link_url,
                target_major: target_major || null,
                education_level: education_level || 'master',
                avg_score: 0, vote_count: 0, is_trusted: true
            }, { onConflict: 'link_id' });
        }

        res.json({ id: inserted.id, status, ai_judgment: aiJudgment, judgment_reason: judgmentReason });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleRate(req, res) {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { link_id, score, user_id } = req.body;
        if (!link_id || !score) return res.status(400).json({ error: 'link_id and score are required' });

        const supabase = getSupabase();

        const { data: link } = await supabase.from('user_feedback_links').select('id').eq('id', link_id).maybeSingle();
        if (!link) return res.status(404).json({ error: 'Link not found' });

        await supabase.from('link_ratings').upsert({
            link_id, user_id: user_id || 'anonymous', score
        }, { onConflict: 'link_id,user_id' });

        const { data: stats } = await supabase.from('link_ratings').select('score').eq('link_id', link_id);
        const avgScore = stats.length > 0 ? stats.reduce((s, r) => s + r.score, 0) / stats.length : 0;
        const voteCount = stats.length;
        const isTrusted = voteCount >= 3 && avgScore >= 4;

        const { data: linkData } = await supabase.from('user_feedback_links')
            .select('university_name, link_url, target_major, education_level').eq('id', link_id).single();

        if (linkData) {
            await supabase.from('knowledge_base').upsert({
                link_id, university_name: linkData.university_name, link_url: linkData.link_url,
                target_major: linkData.target_major, education_level: linkData.education_level,
                avg_score: Math.round(avgScore * 100) / 100, vote_count: voteCount, is_trusted: isTrusted
            }, { onConflict: 'link_id' });
        }

        res.json({ success: true, avg_score: Math.round(avgScore * 100) / 100, vote_count: voteCount, is_trusted: isTrusted });
    } catch (error) {
        console.error('Rate error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleKnowledge(req, res) {
    cors(res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { target_major, education_level, limit } = req.query;
        const supabase = getSupabase();

        let query = supabase
            .from('user_feedback_links')
            .select('id, university_name, link_url, target_major, education_level, ai_judgment, judgment_reason, status, created_at')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit) || 10);

        if (target_major) query = query.ilike('target_major', `%${target_major}%`);
        if (education_level) query = query.eq('education_level', education_level);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ links: data || [] });
    } catch (error) {
        console.error('Knowledge error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleAdmin(req, res) {
    cors(res, 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace('/api/admin', '');

    try {
        if (req.method === 'GET' && (path === '/stats' || path === '/stats/')) {
            const supabase = getSupabase();
            const [{ count: total }, { count: pending }, { count: approved }, { count: rejected }] = await Promise.all([
                supabase.from('user_feedback_links').select('*', { count: 'exact', head: true }),
                supabase.from('user_feedback_links').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('user_feedback_links').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
                supabase.from('user_feedback_links').select('*', { count: 'exact', head: true }).eq('status', 'rejected')
            ]);
            return res.json({ total: total || 0, pending: pending || 0, approved: approved || 0, rejected: rejected || 0 });
        }

        if (req.method === 'GET' && (path === '/feedback' || path === '/feedback/')) {
            const supabase = getSupabase();
            const { status, search } = req.query;
            let query = supabase.from('user_feedback_links').select('*').order('created_at', { ascending: false });
            if (status && status !== 'all') query = query.eq('status', status);
            if (search) query = query.or(`university_name.ilike.%${search}%,target_major.ilike.%${search}%`);
            const { data, error } = await query;
            if (error) throw error;
            return res.json({ feedback: data || [] });
        }

        if (req.method === 'POST' && (path === '/delete-link' || path === '/delete-link/')) {
            const supabase = getSupabase();
            const { link_id } = req.body;
            if (!link_id) return res.status(400).json({ error: 'link_id is required' });
            const { error } = await supabase.from('user_feedback_links').delete().eq('id', link_id);
            if (error) throw error;
            return res.json({ success: true });
        }

        res.status(404).json({ error: 'Admin route not found' });
    } catch (error) {
        console.error('Admin error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleTrack(req, res) {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (process.env.ENABLE_TRACKING !== 'true') return res.json({ success: true, tracked: false });
    try {
        const { action, action_data, user_id } = req.body;
        if (!action) return res.status(400).json({ error: 'action is required' });
        const supabase = getSupabase();
        const { error } = await supabase.from('user_tracks').insert({
            user_id: user_id || null, action,
            action_data: action_data ? JSON.stringify(action_data) : null
        });
        if (error) throw error;
        res.json({ success: true, tracked: true });
    } catch (error) {
        console.error('Track error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ==================== MAIN ROUTER ====================

const ROUTES = {
    '/api/proxy': handleProxy,
    '/api/judge-link': handleJudgeLink,
    '/api/feedback': handleFeedback,
    '/api/rate': handleRate,
    '/api/knowledge': handleKnowledge,
    '/api/track': handleTrack,
};

module.exports = async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Admin routes (sub-routes)
    if (pathname.startsWith('/api/admin')) return handleAdmin(req, res);

    // Exact route match
    const handler = ROUTES[pathname];
    if (handler) return handler(req, res);

    // Health check
    if (pathname === '/api/health' || pathname === '/') {
        return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    res.status(404).json({ error: 'API route not found' });
};
