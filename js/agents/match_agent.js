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
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        return false;
    }

    async match(userData) {
        const { overseasMajor, bachelorMajor, courseList, useType } = userData;

        await this.waitForKnowledgeBase();

        const localMatches = this.localMatch(overseasMajor, bachelorMajor, courseList);
        let aiMatches = [];
        try {
            aiMatches = await this.aiMatch(overseasMajor, bachelorMajor, courseList, useType);
        } catch (e) {
            console.warn('AI 匹配失败，使用本地结果:', e.message);
        }

        return this.mergeResults(localMatches, aiMatches);
    }

    localMatch(overseasMajor, bachelorMajor, courseList) {
        let allDisciplines = [];
        if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
            allDisciplines = window.KnowledgeLoader.getAll();
        }
        if (allDisciplines.length === 0) return [];

        const overseasLower = (overseasMajor || '').toLowerCase();
        const bachelorLower = (bachelorMajor || '').toLowerCase();
        const courseLower = (courseList || '').toLowerCase();

        // English → Chinese keyword mapping
        const enCnMap = [
            ['art', '艺术'],
            ['fine art', '美术'],
            ['design', '设计'],
            ['music', '音乐'],
            ['drama', '戏剧'],
            ['film', '影视'],
            ['dance', '舞蹈'],
            ['computer', '计算机'],
            ['software', '软件'],
            ['data', '数据'],
            ['ai', '人工智能'],
            ['machine learning', '机器学习'],
            ['business', '工商'],
            ['management', '管理'],
            ['finance', '金融'],
            ['accounting', '会计'],
            ['economics', '经济'],
            ['law', '法'],
            ['education', '教育'],
            ['psychology', '心理'],
            ['sociology', '社会'],
            ['politics', '政治'],
            ['history', '历史'],
            ['philosophy', '哲学'],
            ['literature', '文学'],
            ['linguistics', '语言'],
            ['journalism', '新闻'],
            ['communication', '传播'],
            ['media', '媒体'],
            ['architecture', '建筑'],
            ['civil', '土木'],
            ['mechanical', '机械'],
            ['electrical', '电气'],
            ['electronic', '电子'],
            ['chemical', '化工'],
            ['material', '材料'],
            ['environmental', '环境'],
            ['biology', '生物'],
            ['chemistry', '化学'],
            ['physics', '物理'],
            ['math', '数学'],
            ['statistics', '统计'],
            ['medicine', '医学'],
            ['nursing', '护理'],
            ['pharmacy', '药学'],
            ['public health', '公共卫生']
        ];

        let expandedKeywords = overseasLower + ' ' + bachelorLower + ' ' + courseLower;

        // If overseas major is in English, add Chinese equivalents
        for (const [en, cn] of enCnMap) {
            if (overseasLower.includes(en)) {
                expandedKeywords += ' ' + cn;
            }
        }
        // Always add course content keywords
        expandedKeywords += ' ' + courseLower;

        const matches = [];

        for (const disc of allDisciplines) {
            const discNameLower = disc.name.toLowerCase();
            let score = 0;
            let reasons = [];

            // Exact discipline name match
            if (expandedKeywords.includes(discNameLower)) {
                score += 3;
                reasons.push('学科名称直接匹配');
            }

            // Individual character matching for short discipline names
            if (disc.name.length <= 3) {
                let charMatchCount = 0;
                for (const char of disc.name) {
                    if (expandedKeywords.includes(char)) charMatchCount++;
                }
                if (charMatchCount >= 2) {
                    score += charMatchCount;
                    reasons.push('关键词字符匹配');
                }
            }

            // Substring match in course content
            for (const course of (courseList || '').split('\n')) {
                const c = course.trim().toLowerCase();
                if (c && discNameLower.length >= 2 && c.includes(discNameLower)) {
                    score += 2;
                    reasons.push('课程内容包含学科名');
                }
                // Partial match: discipline name parts in course
                if (disc.name.length >= 4) {
                    for (let i = 0; i < disc.name.length - 1; i++) {
                        const part = disc.name.substring(i, i + 2);
                        if (c.includes(part)) {
                            score += 0.5;
                        }
                    }
                }
            }

            // First-level category match
            if (disc.firstLevelName && expandedKeywords.includes(disc.firstLevelName)) {
                score += 1;
                reasons.push('一级学科匹配');
            }

            if (score > 0) {
                matches.push({
                    name: disc.name,
                    code: disc.code,
                    firstLevel: disc.firstLevelName,
                    matchScore: Math.round(score * 10) / 10,
                    reason: reasons.join('；') || '综合匹配',
                    match_level: score >= 3 ? '高' : score >= 1.5 ? '中' : '低',
                    source: 'local'
                });
            }
        }

        return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
    }

    async aiMatch(overseasMajor, bachelorMajor, courseList, useType) {
        let validDisciplines = [];
        if (window.KnowledgeLoader && window.KnowledgeLoader.isReady()) {
            validDisciplines = window.KnowledgeLoader.getAll();
        }

        const validNames = validDisciplines.map(d => `${d.name}(${d.firstLevelName})`).join('、');

        const prompt = `【重要约束】只能从以下国内二级学科中选择：

可选学科：${validNames}

根据以下信息，推荐1-3个最匹配的国内二级学科：

海外专业名称：${overseasMajor}
本科专业：${bachelorMajor}
核心课程列表：${courseList}
用途：${useType}

注意：
1. 如果海外专业是英文，请先翻译理解其对应的中文学科含义
2. 优先根据课程内容匹配学科，其次参考专业名称
3. 只输出 JSON 数组，格式：[{"name":"艺术学理论","code":"1301","firstLevel":"艺术学","reason":"xxx","match_level":"高"}]
4. match_level 只能是 "高"、"中"、"低" 之一
5. name 必须从上面的可选学科列表中选择`;

        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '你是学科匹配专家，严格遵循约束，只输出 JSON。如果专业是英文，先翻译理解再匹配。' },
                { role: 'user', content: prompt }
            ]);

            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const matches = JSON.parse(jsonMatch[0]);
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
        // AI results take priority
        for (const item of ai) map.set(item.code || item.name, item);
        // Local results fill gaps
        for (const item of local) {
            const key = item.code || item.name;
            if (!map.has(key)) map.set(key, item);
        }
        return Array.from(map.values())
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 5);
    }
}

async function initMatchAgent() {
    if (window.KnowledgeLoader) {
        await window.KnowledgeLoader.load();
    }
    window.MatchAgent = new MatchAgent();
}

initMatchAgent();
