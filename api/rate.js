// Vercel serverless: POST /api/rate — upsert rating + recompute knowledge_base
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { link_id, score, user_id } = req.body;
        if (!link_id || !score) {
            return res.status(400).json({ error: 'link_id and score are required' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Validate link exists
        const { data: link, error: linkError } = await supabase
            .from('user_feedback_links')
            .select('id')
            .eq('id', link_id)
            .maybeSingle();

        if (linkError || !link) {
            return res.status(404).json({ error: 'Link not found' });
        }

        // Upsert rating
        const { error: upsertError } = await supabase
            .from('link_ratings')
            .upsert({
                link_id,
                user_id: user_id || 'anonymous',
                score
            }, { onConflict: 'link_id,user_id' });

        if (upsertError) throw upsertError;

        // Compute new stats
        const { data: stats, error: statsError } = await supabase
            .from('link_ratings')
            .select('score')
            .eq('link_id', link_id);

        if (statsError) throw statsError;

        const avgScore = stats.length > 0
            ? stats.reduce((sum, r) => sum + r.score, 0) / stats.length
            : 0;
        const voteCount = stats.length;
        const isTrusted = voteCount >= 3 && avgScore >= 4;

        // Upsert knowledge_base
        const { data: linkData } = await supabase
            .from('user_feedback_links')
            .select('university_name, link_url, target_major, education_level')
            .eq('id', link_id)
            .single();

        if (linkData) {
            await supabase
                .from('knowledge_base')
                .upsert({
                    link_id,
                    university_name: linkData.university_name,
                    link_url: linkData.link_url,
                    target_major: linkData.target_major,
                    education_level: linkData.education_level,
                    avg_score: Math.round(avgScore * 100) / 100,
                    vote_count: voteCount,
                    is_trusted: isTrusted
                }, { onConflict: 'link_id' });
        }

        res.json({
            success: true,
            avg_score: Math.round(avgScore * 100) / 100,
            vote_count: voteCount,
            is_trusted: isTrusted
        });
    } catch (error) {
        console.error('Rate error:', error);
        res.status(500).json({ error: error.message });
    }
};
