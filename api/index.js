// Vercel serverless: catch-all API router
const proxyHandler = require('./proxy');
const feedbackHandler = require('./feedback');
const rateHandler = require('./rate');
const knowledgeHandler = require('./knowledge');
const adminHandler = require('./admin');
const judgeLinkHandler = require('./judge-link');
const trackHandler = require('./track');

const routes = {
    '/api/proxy': proxyHandler,
    '/api/feedback': feedbackHandler,
    '/api/rate': rateHandler,
    '/api/knowledge': knowledgeHandler,
    '/api/admin': adminHandler,
    '/api/judge-link': judgeLinkHandler,
    '/api/track': trackHandler,
};

module.exports = async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Match /api/admin and sub-routes
    if (pathname.startsWith('/api/admin')) {
        return adminHandler(req, res);
    }

    // Match exact route
    const handler = routes[pathname];
    if (handler) {
        return handler(req, res);
    }

    // Health check
    if (pathname === '/api/health' || pathname === '/') {
        return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    res.status(404).json({ error: 'API route not found' });
};
