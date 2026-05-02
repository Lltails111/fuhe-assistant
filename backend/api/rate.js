// server/routes/rate.js
const express = require('express');
const router = express.Router();
const { query, execute } = require('../db');

router.post('/', async (req, res) => {
    try {
        const { link_id, score, user_id } = req.body;
        
        if (!link_id || !score) {
            return res.status(400).json({ error: 'link_id 和 score 为必填字段' });
        }
        
        if (score < 1 || score > 5) {
            return res.status(400).json({ error: 'score 必须在 1-5 之间' });
        }
        
        // 检查链接是否存在
        const linkExists = await query(
            'SELECT id FROM user_feedback_links WHERE id = ?',
            [link_id]
        );
        
        if (linkExists.length === 0) {
            return res.status(404).json({ error: '链接不存在' });
        }
        
        const userId = user_id || `anonymous_${Date.now()}`;
        
        await execute(
            `INSERT INTO link_ratings (link_id, user_id, score)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE score = ?`,
            [link_id, userId, score, score]
        );
        
        // 获取最新统计
        const stats = await query(
            'SELECT AVG(score) as avg_score, COUNT(*) as vote_count FROM link_ratings WHERE link_id = ?',
            [link_id]
        );
        
        const avgScore = parseFloat(stats[0]?.avg_score || 0);
        const voteCount = stats[0]?.vote_count || 0;
        const isTrusted = voteCount >= 3 && avgScore >= 4;
        
        // 更新知识库
        await execute(
            `INSERT INTO knowledge_base (link_id, university_name, link_url, target_major, education_level, avg_score, vote_count, is_trusted)
             SELECT id, university_name, link_url, target_major, education_level, ?, ?, ?
             FROM user_feedback_links
             WHERE id = ?
             ON DUPLICATE KEY UPDATE
                 avg_score = VALUES(avg_score),
                 vote_count = VALUES(vote_count),
                 is_trusted = VALUES(is_trusted)`,
            [avgScore, voteCount, isTrusted, link_id]
        );
        
        res.json({
            success: true,
            link_id: link_id,
            avg_score: avgScore,
            vote_count: voteCount,
            is_trusted: isTrusted
        });
        
    } catch (error) {
        console.error('Rate error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;