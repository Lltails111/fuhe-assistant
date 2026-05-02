// server/routes/admin.js
const express = require('express');
const router = express.Router();
const { query, execute } = require('../db');

// 获取统计信息（增加 rejected 统计）
router.get('/stats', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const total = await query('SELECT COUNT(*) as count FROM user_feedback_links');
        const pending = await query("SELECT COUNT(*) as count FROM user_feedback_links WHERE status = 'pending'");
        const approved = await query("SELECT COUNT(*) as count FROM user_feedback_links WHERE status = 'approved'");
        const rejected = await query("SELECT COUNT(*) as count FROM user_feedback_links WHERE status = 'rejected'");
        
        res.json({
            total_feedback: total[0].count,
            pending: pending[0].count,
            approved: approved[0].count,
            rejected: rejected[0].count
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取反馈列表
router.get('/feedback', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { status, search } = req.query;
        
        let sql = `
            SELECT f.*
            FROM user_feedback_links f
            WHERE 1=1
        `;
        const params = [];
        
        if (status && status !== 'all') {
            sql += ' AND f.status = ?';
            params.push(status);
        }
        
        if (search) {
            sql += ' AND (f.university_name LIKE ? OR f.target_major LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        sql += ' ORDER BY f.created_at DESC';
        
        const links = await query(sql, params);
        res.json({ links });
    } catch (error) {
        console.error('Feedback list error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除链接（管理员功能）
router.post('/delete-link', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { link_id } = req.body;
        
        // 先删除关联的评分记录（外键会自动处理）
        await execute('DELETE FROM link_ratings WHERE link_id = ?', [link_id]);
        await execute('DELETE FROM knowledge_base WHERE link_id = ?', [link_id]);
        await execute('DELETE FROM user_feedback_links WHERE id = ?', [link_id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;