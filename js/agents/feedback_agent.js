// ==================== js/agents/feedback_agent.js ====================

class FeedbackAgent {
    constructor() {
        this.name = '链接判定Agent';
    }
    
    async submitAndJudge(linkUrl, universityName, targetMajor, reason = '') {
        const judgment = await this.judgeLink(linkUrl, universityName, targetMajor);
        const saved = await this.saveToDatabase(linkUrl, universityName, targetMajor, judgment, reason);
        
        return {
            linkId: saved.id,
            status: judgment.status,
            ai_judgment: judgment.status,
            reason: judgment.reason,
            judgment_reason: saved.judgment_reason
        };
    }
    
    async judgeLink(linkUrl, universityName, targetMajor) {
        try {
            const result = await window.API.post('/api/judge-link', {
                link_url: linkUrl,
                university_name: universityName,
                target_major: targetMajor
            });
            return result;
        } catch (e) {
            return await this.aiJudgeFallback(linkUrl, universityName, targetMajor);
        }
    }
    
    async aiJudgeFallback(linkUrl, universityName, targetMajor) {
        const prompt = `判断这个链接是否可能包含有效的培养方案信息：

链接：${linkUrl}
学校：${universityName}
专业：${targetMajor}

输出 JSON：{"status":"合理/部分合理/不合理","reason":"理由"}`;

        try {
            const result = await window.API.callDeepSeek([{ role: 'user', content: prompt }]);
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : { status: '未知', reason: '无法判断' };
        } catch {
            return { status: '未知', reason: '无法自动判断，请手动审核' };
        }
    }
    
    async saveToDatabase(linkUrl, universityName, targetMajor, judgment, reason) {
        return await window.API.post('/api/feedback', {
            link_url: linkUrl,
            university_name: universityName,
            target_major: targetMajor,
            ai_judgment: judgment.status,
            judgment_reason: judgment.reason,
            user_reason: reason
        });
    }
    
    async submitRating(linkId, score) {
        return await window.API.post('/api/rate', {
            link_id: linkId,
            score: score
        });
    }
}

window.FeedbackAgent = new FeedbackAgent();