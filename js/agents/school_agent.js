// ==================== js/agents/school_agent.js ====================

class SchoolAgent {
    constructor() {
        this.name = '高校推荐Agent';
    }
    
    async recommend(targetMajor, educationLevel = 'master') {
        const knowledgeLinks = await this.queryKnowledgeBase(targetMajor, educationLevel);
        const aiSchools = await this.aiRecommend(targetMajor, educationLevel, knowledgeLinks);
        return this.mergeWithKnowledge(aiSchools, knowledgeLinks);
    }
    
    async queryKnowledgeBase(targetMajor, educationLevel) {
        try {
            const result = await window.API.get('/api/knowledge', {
                target_major: targetMajor,
                education_level: educationLevel,
                limit: 3
            });
            return result.links || [];
        } catch (e) {
            console.warn('知识库查询失败:', e);
            return [];
        }
    }
    
    async aiRecommend(targetMajor, educationLevel, knowledgeLinks) {
        const context = knowledgeLinks.length > 0 
            ? `\n\n已验证的优质来源参考：\n${knowledgeLinks.map(l => `- ${l.university_name}: ${l.link_url}`).join('\n')}`
            : '';
        
        const prompt = `推荐3所国内${educationLevel === 'master' ? '硕士' : '本科'}层次高校，专业：${targetMajor}${context}

【重要约束】：
1. 不要编造任何具体的链接地址，如果你无法知道真实的培养方案URL
2. 只输出【学校名称】和【搜索建议】，让用户自行搜索培养方案
3. 搜索建议应该具体到：在哪个网站搜索、用什么关键词

输出 JSON 格式：
[
    {
        "university": "学校名称",
        "search_suggestion": "建议搜索方式，例如：在XX大学研究生院网站搜索'专业名称 培养方案'",
        "reason": "推荐理由"
    }
]

只输出 JSON 数组，不要输出具体URL链接。`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是高校推荐专家，只输出学校名称和搜索建议，不编造任何链接' },
                { role: 'user', content: prompt }
            ]);
            
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const schools = JSON.parse(jsonMatch[0]);
                return schools.map(s => ({
                    university: s.university,
                    url: s.search_suggestion || s.url,  // url 字段实际存储搜索建议
                    reason: s.reason,
                    isVerified: false,
                    isSearchSuggestion: true
                }));
            }
            return [];
        } catch (e) {
            console.error('AI 推荐失败:', e);
            return [];
        }
    }
    
    mergeWithKnowledge(aiSchools, knowledgeLinks) {
        const result = [];

    // 【关键修改】：优先处理知识库中已验证的『真实』培养方案链接
        for (const kb of knowledgeLinks) {
        // 增加更严格的判断，确保链接有效且状态为已批准
            if (kb.link_url && (kb.status === 'approved' || kb.is_trusted)) {
                result.push({
                    university: kb.university_name,
                    url: kb.link_url,
                    reason: `【已验证培养方案】${kb.judgment_reason || 'AI判定：' + kb.ai_judgment}`,
                    isVerified: true,
                    linkId: kb.id,
                    avgScore: kb.avg_score,
                    linkType: '培养方案' // 标记为真实培养方案链接
                });
            }
        }

    // 再处理 AI 推荐的『搜索建议』，并避免与已验证链接重复
        for (const school of aiSchools) {
            // 检查是否已存在相同大学的已验证链接
            const alreadyExists = result.some(r => r.university === school.university && r.isVerified === true);
            if (!alreadyExists && !result.some(r => r.university === school.university)) {
                result.push({
                    ...school,
                    isVerified: false,
                    linkType: '搜索建议',
                    // 确保 AI 推荐的不再是假URL，而是一个明确的搜索提示
                    url: school.search_suggestion || `建议在${school.university}研究生院官网搜索“${currentState.selectedDiscipline?.name || '相关专业'} 培养方案”`
                });
            }
        }

    // 最终结果中，已验证链接（你提交的）将始终排在最前
        return result.slice(0, 8);
    }
}

window.SchoolAgent = new SchoolAgent();