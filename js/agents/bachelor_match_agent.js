// ==================== js/agents/bachelor_match_agent.js ====================

class BachelorMatchAgent {
    constructor() {
        this.name = '本科专业匹配Agent';
        this.disciplineDB = null;
    }
    
    async loadDisciplines() {
        if (this.disciplineDB) return this.disciplineDB;
        
        try {
            const response = await fetch('./js/knowledge/disciplines_bachelor.json');
            const data = await response.json();
            this.disciplineDB = data;
            console.log('✅ 本科专业库加载成功');
            return data;
        } catch (error) {
            console.error('❌ 本科专业库加载失败:', error);
            this.disciplineDB = { categories: {}, majors: {} };
            return this.disciplineDB;
        }
    }
    
    async match(userData) {
        const { overseasMajor, specialization, courseList, useType } = userData;
        
        await this.loadDisciplines();
        
        const localMatches = this.localMatch(overseasMajor, specialization, courseList);
        const aiMatches = await this.aiMatch(overseasMajor, specialization, courseList, useType);
        
        return this.mergeResults(localMatches, aiMatches);
    }
    
    localMatch(overseasMajor, specialization, courseList) {
        const matches = [];
        const allSubjects = [];
        
        // 收集所有本科专业
        for (const [code, category] of Object.entries(this.disciplineDB.categories || {})) {
            if (category.subjects && Array.isArray(category.subjects)) {
                for (const subject of category.subjects) {
                    allSubjects.push({
                        name: subject,
                        category: category.name,
                        categoryCode: code
                    });
                }
            }
        }
        
        const combined = (overseasMajor + ' ' + specialization + ' ' + courseList).toLowerCase();
        
        for (const subject of allSubjects) {
            let score = 0;
            if (combined.includes(subject.name.toLowerCase())) score += 2;
            if (overseasMajor.toLowerCase().includes(subject.name.toLowerCase())) score += 1;
            
            if (score > 0) {
                matches.push({
                    name: subject.name,
                    category: subject.category,
                    matchScore: score,
                    reason: `课程/专业名称匹配`,
                    match_level: score >= 2 ? '高' : '中',
                    source: 'local'
                });
            }
        }
        
        return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
    }
    
    async aiMatch(overseasMajor, specialization, courseList, useType) {
        const prompt = `【本科专业复核】请推荐1-3个最匹配的国内本科专业：

海外本科专业：${overseasMajor}
专业方向：${specialization || '无'}
核心课程：${courseList}
申请用途：${useType}

输出 JSON 格式：
[
    {
        "name": "国内本科专业名称",
        "category": "所属专业类",
        "match_level": "高/中/低",
        "reason": "匹配理由"
    }
]

只输出 JSON 数组。`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是本科专业匹配专家，熟悉国内本科专业目录，只输出 JSON' },
                { role: 'user', content: prompt }
            ]);
            
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]).map(m => ({ ...m, source: 'ai' }));
            }
            return [];
        } catch (e) {
            console.error('AI 匹配失败:', e);
            return [];
        }
    }
    
    mergeResults(local, ai) {
        const map = new Map();
        for (const item of ai) map.set(item.name, item);
        for (const item of local) {
            if (!map.has(item.name)) map.set(item.name, item);
        }
        return Array.from(map.values()).slice(0, 3);
    }
}

window.BachelorMatchAgent = new BachelorMatchAgent();