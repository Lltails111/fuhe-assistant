// Vercel serverless: POST /api/track — user tracking
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (process.env.ENABLE_TRACKING !== 'true') {
        return res.json({ success: true, tracked: false });
    }

    try {
        const { action, action_data, user_id } = req.body;
        if (!action) {
            return res.status(400).json({ error: 'action is required' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase.from('user_tracks').insert({
            user_id: user_id || null,
            action: action,
            action_data: action_data ? JSON.stringify(action_data) : null
        });

        if (error) throw error;

        res.json({ success: true, tracked: true });
    } catch (error) {
        console.error('Track error:', error);
        res.status(500).json({ error: error.message });
    }
};
