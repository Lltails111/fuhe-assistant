// ==================== js/agents/doctor_match_agent.js ====================

class DoctorMatchAgent {
    constructor() {
        this.name = '博士学科匹配Agent';
    }
    
    async match(userData) {
        const { overseasMajor, researchDirection, thesisTitle, masterMajor, bachelorMajor, courseList, paperKeywords, useType } = userData;
        
        await this.waitForKnowledgeBase();
        
        const localMatches = this.localMatch(overseasMajor, researchDirection, paperKeywords);
        const aiMatches = await this.aiMatch(overseasMajor, researchDirection, thesisTitle, masterMajor, bachelorMajor, courseList, paperKeywords, useType);
        
        return this.mergeResults(localMatches, aiMatches);
    }
    
    async waitForKnowledgeBase() {
        let retries = 0;
        while (retries < 30) {
            if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        return false;
    }
    
    localMatch(overseasMajor, researchDirection, paperKeywords) {
        let allDisciplines = [];
        if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
            allDisciplines = window.KnowledgeLoader.getAll();
        }
        
        const combined = (overseasMajor + ' ' + researchDirection + ' ' + paperKeywords).toLowerCase();
        const matches = [];
        
        for (const disc of allDisciplines) {
            let score = 0;
            if (combined.includes(disc.name.toLowerCase())) score += 2;
            if (researchDirection.toLowerCase().includes(disc.name.toLowerCase())) score += 1;
            
            if (score > 0) {
                matches.push({
                    name: disc.name,
                    code: disc.code,
                    firstLevel: disc.firstLevelName,
                    matchScore: score,
                    reason: `研究方向「${researchDirection}」匹配`,
                    match_level: score >= 2 ? '高' : '中',
                    source: 'local'
                });
            }
        }
        
        return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
    }
    
    async aiMatch(overseasMajor, researchDirection, thesisTitle, masterMajor, bachelorMajor, courseList, paperKeywords, useType) {
        let validDisciplines = [];
        if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
            validDisciplines = window.KnowledgeLoader.getAll();
        }
        
        const validNames = validDisciplines.map(d => d.name).join('、');
        
        const prompt = `【博士专业复核】请从以下国内二级学科中推荐最匹配的学科：

可选学科：${validNames}

申请信息：
海外博士专业：${overseasMajor}
研究方向：${researchDirection}
博士论文题目：${thesisTitle || '未提供'}
硕士专业：${masterMajor}
本科专业：${bachelorMajor}
核心课程/研究经历：${courseList}
发表论文关键词：${paperKeywords || '未提供'}
申请用途：${useType}

输出 JSON 格式：
[
    {
        "name": "学科名称（必须从可选学科中选择）",
        "code": "学科代码",
        "firstLevel": "一级学科",
        "match_level": "高/中/低",
        "reason": "匹配理由（重点说明研究方向契合度）"
    }
]

只输出 JSON 数组。`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是博士学科匹配专家，擅长分析研究方向与国内学科的对应关系，只输出 JSON' },
                { role: 'user', content: prompt }
            ]);
            
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const matches = JSON.parse(jsonMatch[0]);
                const validCodes = new Set(validDisciplines.map(d => d.code));
                return matches.filter(m => validCodes.has(m.code) || validDisciplines.some(d => d.name === m.name));
            }
            return [];
        } catch (e) {
            console.error('AI 匹配失败:', e);
            return [];
        }
    }
    
    mergeResults(local, ai) {
        const map = new Map();
        for (const item of ai) map.set(item.code || item.name, item);
        for (const item of local) {
            const key = item.code || item.name;
            if (!map.has(key)) map.set(key, item);
        }
        return Array.from(map.values()).slice(0, 3);
    }
}

window.DoctorMatchAgent = new DoctorMatchAgent();