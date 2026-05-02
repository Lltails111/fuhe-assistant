// Vercel serverless: /api/admin — stats, feedback list, delete
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

async function handleStats(req, res) {
    const supabase = getSupabase();

    const { count: total } = await supabase
        .from('user_feedback_links')
        .select('*', { count: 'exact', head: true });

    const { count: pending } = await supabase
        .from('user_feedback_links')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    const { count: approved } = await supabase
        .from('user_feedback_links')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

    const { count: rejected } = await supabase
        .from('user_feedback_links')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected');

    res.json({ total: total || 0, pending: pending || 0, approved: approved || 0, rejected: rejected || 0 });
}

async function handleFeedback(req, res) {
    const supabase = getSupabase();
    const { status, search } = req.query;

    let query = supabase
        .from('user_feedback_links')
        .select('*')
        .order('created_at', { ascending: false });

    if (status && status !== 'all') {
        query = query.eq('status', status);
    }
    if (search) {
        query = query.or(`university_name.ilike.%${search}%,target_major.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ feedback: data || [] });
}

async function handleDelete(req, res) {
    const supabase = getSupabase();
    const { link_id } = req.body;

    if (!link_id) {
        return res.status(400).json({ error: 'link_id is required' });
    }

    // Delete cascades to link_ratings and knowledge_base via FK
    const { error } = await supabase
        .from('user_feedback_links')
        .delete()
        .eq('id', link_id);

    if (error) throw error;

    res.json({ success: true });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname.replace('/api/admin', '');

        if (req.method === 'GET' && (path === '/stats' || path === '/stats/')) {
            return await handleStats(req, res);
        }
        if (req.method === 'GET' && (path === '/feedback' || path === '/feedback/')) {
            return await handleFeedback(req, res);
        }
        if (req.method === 'POST' && (path === '/delete-link' || path === '/delete-link/')) {
            return await handleDelete(req, res);
        }

        res.status(404).json({ error: 'Admin route not found' });
    } catch (error) {
        console.error('Admin error:', error);
        res.status(500).json({ error: error.message });
    }
};
