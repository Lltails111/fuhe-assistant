// ==================== js/agents/bachelor_school_agent.js ====================

class BachelorSchoolAgent {
    constructor() {
        this.name = '本科高校推荐Agent';
    }
    
    async recommend(targetMajor, educationLevel = 'bachelor') {
        const knowledgeLinks = await this.queryKnowledgeBase(targetMajor, educationLevel);
        const aiSchools = await this.aiRecommend(targetMajor, knowledgeLinks);
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
            return [];
        }
    }
    
    async aiRecommend(targetMajor, knowledgeLinks) {
        const prompt = `【本科高校推荐】
目标专业：${targetMajor}

请推荐3所国内在该专业领域实力强劲的高校，并提供搜索建议。

输出 JSON 格式：
[
    {
        "university": "学校名称",
        "search_suggestion": "建议搜索方式，如：在XX大学教务处网站搜索'专业名称 本科培养方案'",
        "reason": "推荐理由"
    }
]

只输出 JSON 数组。`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是本科高校推荐专家，只输出学校名称和搜索建议' },
                { role: 'user', content: prompt }
            ]);
            
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const schools = JSON.parse(jsonMatch[0]);
                return schools.map(s => ({
                    ...s,
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
        
        for (const kb of knowledgeLinks) {
            result.push({
                university: kb.university_name,
                url: kb.link_url,
                reason: kb.judgment_reason || `AI 判定：${kb.ai_judgment}`,
                isVerified: true,
                linkId: kb.id,
                isDirectLink: true
            });
        }
        
        for (const school of aiSchools) {
            if (!result.some(r => r.university === school.university)) {
                result.push({ ...school, isVerified: false });
            }
        }
        
        return result.slice(0, 5);
    }
}

window.BachelorSchoolAgent = new BachelorSchoolAgent();