// server/routes/track.js
const express = require('express');
const router = express.Router();
const { execute } = require('../db');

router.post('/', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { action, action_data, user_id } = req.body;
        
        const ENABLE_TRACKING = process.env.ENABLE_TRACKING === 'true';
        
        if (ENABLE_TRACKING && action) {
            await execute(
                `INSERT INTO user_tracks (user_id, action, action_data)
                 VALUES (?, ?, ?)`,
                [user_id || null, action, action_data ? JSON.stringify(action_data) : null]
            );
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Track error:', error);
        res.json({ success: false });
    }
});

module.exports = router;