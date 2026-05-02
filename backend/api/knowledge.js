// backend/api/knowledge.js
const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res) => {
    try {
        const { target_major, education_level, limit = 10 } = req.query;
        
        let sql = `
            SELECT 
                f.id,
                f.university_name,
                f.link_url,
                f.target_major,
                f.education_level,
                f.ai_judgment,
                f.judgment_reason,
                f.status,
                f.created_at
            FROM user_feedback_links f
            WHERE f.status = 'approved'
        `;
        
        if (target_major && target_major.trim()) {
            sql += ` AND f.target_major LIKE '%${target_major}%'`;
        }
        
        if (education_level && education_level.trim()) {
            sql += ` AND f.education_level = '${education_level}'`;
        }
        
        sql += ` ORDER BY f.created_at DESC LIMIT ${parseInt(limit) || 10}`;
        
        const links = await query(sql, []);
        res.json({ links, count: links.length });
        
    } catch (error) {
        console.error('知识库查询错误:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;