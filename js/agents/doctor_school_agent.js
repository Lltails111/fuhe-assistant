// ==================== js/agents/doctor_school_agent.js ====================

class DoctorSchoolAgent {
    constructor() {
        this.name = '博士导师推荐Agent';
    }
    
    async recommend(targetMajor, researchDirection, educationLevel = 'doctor') {
        const knowledgeLinks = await this.queryKnowledgeBase(targetMajor, educationLevel);
        const aiRecommendations = await this.aiRecommend(targetMajor, researchDirection, knowledgeLinks);
        return this.mergeWithKnowledge(aiRecommendations, knowledgeLinks);
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
    
    async aiRecommend(targetMajor, researchDirection, knowledgeLinks) {
        const prompt = `【博士导师/高校推荐】
目标专业：${targetMajor}
研究方向：${researchDirection}

请推荐3所国内在该研究方向有较强实力的高校，并推荐相关导师或实验室。

输出 JSON 格式：
[
    {
        "university": "学校名称",
        "department": "学院/系所",
        "research_group": "实验室/课题组名称（可选）",
        "search_suggestion": "建议搜索方式，如：在XX大学官网搜索'教授姓名 研究方向'",
        "reason": "推荐理由"
    }
]

只输出 JSON 数组。`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是博士导师推荐专家，只输出 JSON，不编造具体链接' },
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

window.DoctorSchoolAgent = new DoctorSchoolAgent();