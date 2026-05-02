// ==================== js/agents/match_agent.js ====================

class MatchAgent {
    constructor() {
        this.name = '学科匹配Agent';
        this.isReady = false;
    }
    
    async waitForKnowledgeBase() {
        let retries = 0;
        while (retries < 30) {
            if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
                console.log('✅ 知识库已就绪');
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        console.warn('⚠️ 知识库加载超时，将使用 AI 匹配');
        return false;
    }
    
    async match(userData) {
        const { overseasMajor, bachelorMajor, courseList, useType } = userData;
        
        await this.waitForKnowledgeBase();
        
        const localMatches = this.localMatch(overseasMajor, courseList);
        const aiMatches = await this.aiMatch(overseasMajor, bachelorMajor, courseList, useType);
        
        return this.mergeResults(localMatches, aiMatches);
    }
    
    localMatch(overseasMajor, courseList) {
        let allDisciplines = [];
        
        if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
            allDisciplines = window.KnowledgeLoader.getAll();
        }
        
        if (allDisciplines.length === 0) return [];
        
        const keywords = (overseasMajor + ' ' + courseList).toLowerCase();
        const matches = [];
        
        for (const disc of allDisciplines) {
            let score = 0;
            if (keywords.includes(disc.name.toLowerCase())) score += 2;
            if (overseasMajor.toLowerCase().includes(disc.name.toLowerCase())) score += 1;
            
            if (score > 0) {
                matches.push({ 
                    name: disc.name, 
                    code: disc.code,
                    firstLevel: disc.firstLevelName,
                    matchScore: score, 
                    reason: '课程名称匹配',
                    match_level: score >= 2 ? '高' : '中',
                    source: 'local' 
                });
            }
        }
        
        return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
    }
    
    async aiMatch(overseasMajor, bachelorMajor, courseList, useType) {
        // 获取本地学科列表作为可选范围
        let validDisciplines = [];
        if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
            validDisciplines = window.KnowledgeLoader.getAll();
        }
        
        const validNames = validDisciplines.map(d => d.name).join('、');
        
        const prompt = `【重要约束】只能从以下国内二级学科中选择，不能输出这些之外的学科：

可选学科列表：${validNames}

根据以下信息，推荐1-3个最匹配的国内二级学科：

海外专业：${overseasMajor}
本科专业：${bachelorMajor}
核心课程：${courseList}
用途：${useType}

只输出 JSON 数组，格式：[{"name":"计算机科学与技术","code":"0812","firstLevel":"工学","reason":"xxx","match_level":"高"}]

match_level 只能是 "高"、"中"、"低" 之一。
name 必须从上面的可选学科列表中选择。`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是学科匹配专家，严格遵循约束，只输出 JSON' },
                { role: 'user', content: prompt }
            ]);
            
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const matches = JSON.parse(jsonMatch[0]);
                // 过滤掉不在本地知识库中的结果
                const validCodes = new Set(validDisciplines.map(d => d.code));
                const filtered = matches.filter(m => validCodes.has(m.code) || validDisciplines.some(d => d.name === m.name));
                return filtered.map(m => ({ ...m, source: 'ai' }));
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

async function initMatchAgent() {
    if (window.KnowledgeLoader) {
        await window.KnowledgeLoader.load();
    }
    window.MatchAgent = new MatchAgent();
    console.log('✅ MatchAgent 已初始化');
}

initMatchAgent();