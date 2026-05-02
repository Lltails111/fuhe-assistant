// Vercel serverless: GET /api/knowledge — query approved links (parameterized, no SQL injection)
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { target_major, education_level, limit } = req.query;

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        let query = supabase
            .from('user_feedback_links')
            .select('id, university_name, link_url, target_major, education_level, ai_judgment, judgment_reason, status, created_at')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit) || 10);

        // Parameterized filters — safe from SQL injection
        if (target_major) {
            query = query.ilike('target_major', `%${target_major}%`);
        }
        if (education_level) {
            query = query.eq('education_level', education_level);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ links: data || [] });
    } catch (error) {
        console.error('Knowledge error:', error);
        res.status(500).json({ error: error.message });
    }
};
