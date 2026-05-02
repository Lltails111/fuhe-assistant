// backend/app.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（前端页面）
app.use(express.static(path.join(__dirname, '..')));

// 健康检查
app.get('/', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 导入路由
const proxyRoute = require('./api/proxy');
const feedbackRoute = require('./api/feedback');
const rateRoute = require('./api/rate');
const knowledgeRoute = require('./api/knowledge');
const judgeLinkRoute = require('./api/judge-link');
const trackRoute = require('./api/track');
const adminRoute = require('./api/admin');

// 注册路由
app.use('/api/proxy', proxyRoute);
app.use('/api/feedback', feedbackRoute);
app.use('/api/rate', rateRoute);
app.use('/api/knowledge', knowledgeRoute);
app.use('/api/judge-link', judgeLinkRoute);
app.use('/api/track', trackRoute);
app.use('/api/admin', adminRoute);

// 数据库初始化
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS user_feedback_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    link_url VARCHAR(500) NOT NULL,
    university_name VARCHAR(200) NOT NULL,
    target_major VARCHAR(200),
    education_level VARCHAR(20) DEFAULT 'master',
    submitter_id VARCHAR(100),
    ai_judgment VARCHAR(20) DEFAULT '未知',
    judgment_reason TEXT,
    user_reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_target_major (target_major),
    INDEX idx_education_level (education_level),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS link_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    link_id INT NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    score TINYINT CHECK (score BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES user_feedback_links(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_link (link_id, user_id),
    INDEX idx_link_id (link_id),
    INDEX idx_score (score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_base (
    id INT PRIMARY KEY AUTO_INCREMENT,
    link_id INT UNIQUE,
    university_name VARCHAR(200) NOT NULL,
    link_url VARCHAR(500) NOT NULL,
    target_major VARCHAR(200),
    education_level VARCHAR(20) DEFAULT 'master',
    avg_score DECIMAL(3,2) DEFAULT 0,
    vote_count INT DEFAULT 0,
    is_trusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES user_feedback_links(id) ON DELETE CASCADE,
    INDEX idx_target_major (target_major),
    INDEX idx_education_level (education_level),
    INDEX idx_is_trusted (is_trusted),
    INDEX idx_avg_score (avg_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_tracks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    action_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

app.get('/api/init-db', async (req, res) => {
    try {
        const { query } = require('./db');
        const statements = INIT_SQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const results = [];
        for (const stmt of statements) {
            try {
                await query(stmt);
                results.push({ ok: true });
            } catch (err) {
                results.push({ error: err.message });
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器（非 Vercel 环境）
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 后端服务已启动`);
        console.log(`📍 地址: http://localhost:${PORT}`);
    });
}

module.exports = app;