// ==================== js/agents/school_agent.js ====================

// Fallback: top Chinese universities by discipline category
const FALLBACK_SCHOOLS = {
    '哲学': [
        { university: '北京大学', reason: '哲学学科全国顶尖，拥有哲学系和多个研究中心' },
        { university: '中国人民大学', reason: '哲学学科实力雄厚，侧重中西哲学比较研究' },
        { university: '复旦大学', reason: '哲学学院历史悠久，外国哲学方向突出' },
        { university: '南京大学', reason: '哲学系为传统优势学科，马克思主义哲学见长' }
    ],
    '经济学': [
        { university: '北京大学', reason: '经济学科全国领先，理论经济学与应用经济学并重' },
        { university: '中国人民大学', reason: '经济学传统强校，应用经济学排名第一' },
        { university: '复旦大学', reason: '经济学院实力雄厚，国际经济学方向突出' },
        { university: '上海财经大学', reason: '财经类专门院校，经济学各方向齐全' }
    ],
    '法学': [
        { university: '中国政法大学', reason: '法学专门院校，各法学方向齐全' },
        { university: '北京大学', reason: '法学院全国顶尖，法学理论实力雄厚' },
        { university: '中国人民大学', reason: '法学院为传统优势学科，民商法突出' },
        { university: '武汉大学', reason: '法学院历史悠久，国际法方向为全国重点' }
    ],
    '教育学': [
        { university: '北京师范大学', reason: '教育学全国排名第一，教育学科门类齐全' },
        { university: '华东师范大学', reason: '教育学传统强校，课程与教学论方向突出' },
        { university: '南京师范大学', reason: '教育学实力雄厚，学前教育方向特色鲜明' }
    ],
    '文学': [
        { university: '北京大学', reason: '中国语言文学全国顶尖，外国语言文学实力雄厚' },
        { university: '北京外国语大学', reason: '外语类专门院校，语种最全' },
        { university: '复旦大学', reason: '中国语言文学传统强校，新闻传播学突出' },
        { university: '南京大学', reason: '文学院历史悠久，中国现当代文学方向领先' }
    ],
    '历史学': [
        { university: '北京大学', reason: '历史学全国排名第一，各断代方向齐全' },
        { university: '复旦大学', reason: '历史学传统强校，中国近现代史方向突出' },
        { university: '南京大学', reason: '历史学院实力雄厚，世界史方向有特色' }
    ],
    '理学': [
        { university: '北京大学', reason: '理学各学科均位列全国前茅' },
        { university: '中国科学技术大学', reason: '理学研究型大学，基础科学实力突出' },
        { university: '南京大学', reason: '理学传统强校，天文学、地质学全国领先' }
    ],
    '工学': [
        { university: '清华大学', reason: '工科全国第一，计算机、电子信息等方向顶尖' },
        { university: '浙江大学', reason: '工科综合实力强，控制、光电等方向突出' },
        { university: '上海交通大学', reason: '工科传统强校，机械、船舶等方向领先' },
        { university: '哈尔滨工业大学', reason: '工科强校，航天、机器人等方向特色鲜明' }
    ],
    '农学': [
        { university: '中国农业大学', reason: '农学全国第一，各农业方向齐全' },
        { university: '南京农业大学', reason: '农学传统强校，作物学方向突出' },
        { university: '华中农业大学', reason: '农学实力雄厚，园艺学方向为特色' }
    ],
    '医学': [
        { university: '北京协和医学院', reason: '医学最高学府，临床医学全国领先' },
        { university: '北京大学医学部', reason: '基础医学和临床医学实力雄厚' },
        { university: '复旦大学上海医学院', reason: '临床医学传统强校，肿瘤学方向突出' }
    ],
    '管理学': [
        { university: '北京大学', reason: '管理学综合实力强，公共管理方向突出' },
        { university: '清华大学', reason: '管理科学与工程全国领先' },
        { university: '中国人民大学', reason: '公共管理和工商管理均为优势学科' }
    ],
    '艺术学': [
        { university: '中央美术学院', reason: '美术学全国顶尖，造型艺术和设计艺术方向齐全' },
        { university: '中国美术学院', reason: '美术学和设计学实力雄厚，中国画方向突出' },
        { university: '中央音乐学院', reason: '音乐与舞蹈学全国领先' },
        { university: '北京电影学院', reason: '戏剧与影视学全国第一，电影学方向权威' },
        { university: '清华大学美术学院', reason: '设计学全国顶尖，艺术学理论实力雄厚' },
        { university: '南京艺术学院', reason: '综合艺术院校，艺术学理论方向有特色' },
        { university: '中国传媒大学', reason: '艺术学理论和戏剧与影视学实力突出' }
    ]
};

// More specific fallback by discipline name
const FALLBACK_BY_DISCIPLINE = {
    '艺术学理论': [
        { university: '北京大学', reason: '艺术学院拥有艺术学理论博士点，注重跨学科艺术研究' },
        { university: '东南大学', reason: '艺术学理论为国家重点学科，艺术史论方向突出' },
        { university: '南京艺术学院', reason: '艺术学理论研究所实力雄厚，涵盖艺术美学、艺术史等方向' },
        { university: '中国传媒大学', reason: '艺术学理论方向侧重媒介艺术与数字艺术研究' }
    ],
    '美术学': [
        { university: '中央美术学院', reason: '美术学全国第一，中国画、油画、雕塑等方向齐全' },
        { university: '中国美术学院', reason: '美术学实力顶尖，书法、跨媒体艺术方向特色鲜明' },
        { university: '南京艺术学院', reason: '美术学方向齐全，美术史论研究有传统优势' }
    ],
    '设计学': [
        { university: '清华大学', reason: '设计学全国第一，工业设计和信息设计方向领先' },
        { university: '中央美术学院', reason: '设计学实力雄厚，视觉传达和数字媒体方向突出' },
        { university: '江南大学', reason: '设计学传统强校，产品设计和交互设计方向为特色' }
    ],
    '计算机科学与技术': [
        { university: '清华大学', reason: '计算机学科全国第一，人工智能和体系结构方向顶尖' },
        { university: '北京大学', reason: '计算机学科实力雄厚，软件工程和AI方向突出' },
        { university: '浙江大学', reason: '计算机学科传统强校，图形学和CAD方向领先' }
    ],
    '电子科学与技术': [
        { university: '电子科技大学', reason: '电子信息领域专门院校，电子科学与技术全国领先' },
        { university: '清华大学', reason: '电子科学与技术方向实力顶尖' },
        { university: '北京大学', reason: '微电子和集成电路方向突出' }
    ],
    '工商管理': [
        { university: '北京大学', reason: '光华管理学院全国顶尖，各管理方向齐全' },
        { university: '清华大学', reason: '经济管理学院实力雄厚，创新创业方向突出' },
        { university: '中国人民大学', reason: '商学院在组织管理和市场营销方向有传统优势' }
    ]
};

class SchoolAgent {
    constructor() {
        this.name = '高校推荐Agent';
    }

    async recommend(targetMajor, educationLevel = 'master') {
        // 1. Query knowledge base for verified links
        let knowledgeLinks = [];
        try {
            knowledgeLinks = await this.queryKnowledgeBase(targetMajor, educationLevel);
        } catch (e) {
            console.warn('知识库查询失败:', e);
        }

        // 2. Get AI recommendations
        let aiSchools = [];
        try {
            aiSchools = await this.aiRecommend(targetMajor, educationLevel, knowledgeLinks);
        } catch (e) {
            console.warn('AI 推荐失败:', e);
        }

        // 3. Merge with fallback
        return this.mergeResults(targetMajor, aiSchools, knowledgeLinks);
    }

    async queryKnowledgeBase(targetMajor, educationLevel) {
        try {
            const result = await window.API.get('/api/knowledge', {
                target_major: targetMajor,
                education_level: educationLevel,
                limit: 5
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

        const prompt = `推荐3-5所国内${educationLevel === 'master' ? '硕士' : '本科'}层次高校，专业：${targetMajor}${context}

【重要约束】：
1. 推荐真实存在的中国高校
2. 不要编造具体的培养方案URL链接
3. 推荐理由简短说明该学校此专业的优势

输出 JSON 格式：
[
    {
        "university": "学校名称",
        "search_suggestion": "建议搜索方式，例如：在XX大学研究生院网站搜索'专业名称 培养方案'",
        "reason": "推荐理由（20字以内）"
    }
]

只输出 JSON 数组。`;

        const result = await window.API.callDeepSeek([
            { role: 'system', content: '你是高校推荐专家，只输出 JSON 数组' },
            { role: 'user', content: prompt }
        ]);

        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const schools = JSON.parse(jsonMatch[0]);
            return schools.map(s => ({
                university: s.university,
                url: s.search_suggestion || '',
                reason: s.reason,
                isVerified: false,
                isSearchSuggestion: true
            }));
        }
        return [];
    }

    mergeResults(targetMajor, aiSchools, knowledgeLinks) {
        const result = [];

        // 1. Verified knowledge base links first
        for (const kb of knowledgeLinks) {
            if (kb.link_url && kb.status === 'approved') {
                result.push({
                    university: kb.university_name,
                    url: kb.link_url,
                    reason: `【已验证培养方案】${kb.judgment_reason || kb.ai_judgment || ''}`,
                    isVerified: true,
                    linkId: kb.id,
                    avgScore: kb.avg_score,
                    linkType: '培养方案'
                });
            }
        }

        // 2. AI recommendations
        for (const school of aiSchools) {
            if (!result.some(r => r.university === school.university)) {
                result.push({
                    ...school,
                    isVerified: false,
                    linkType: '搜索建议',
                    url: school.search_suggestion || school.url || ''
                });
            }
        }

        // 3. Fallback: if we have fewer than 3 results, add from fallback database
        if (result.length < 3) {
            const fallback = this.getFallback(targetMajor);
            for (const fb of fallback) {
                if (!result.some(r => r.university === fb.university)) {
                    result.push({
                        university: fb.university,
                        url: `建议在${fb.university}研究生院官网搜索"${targetMajor} 培养方案"`,
                        reason: fb.reason,
                        isVerified: false,
                        linkType: '推荐参考'
                    });
                }
                if (result.length >= 5) break;
            }
        }

        return result.slice(0, 8);
    }

    getFallback(targetMajor) {
        // Check specific discipline mapping first
        if (FALLBACK_BY_DISCIPLINE[targetMajor]) {
            return FALLBACK_BY_DISCIPLINE[targetMajor];
        }

        // Then check first-level category
        for (const [category, schools] of Object.entries(FALLBACK_SCHOOLS)) {
            if (targetMajor.includes(category) || category.includes(targetMajor)) {
                return schools;
            }
        }

        // Default: recommend top comprehensive universities
        return [
            { university: '北京大学', reason: '综合性大学，学科门类齐全' },
            { university: '清华大学', reason: '综合性研究型大学，各学科实力均衡' },
            { university: '浙江大学', reason: '综合性大学，学科覆盖面广' },
            { university: '复旦大学', reason: '综合性大学，文理医工协调发展' },
            { university: '南京大学', reason: '综合性大学，基础学科实力雄厚' }
        ];
    }
}

window.SchoolAgent = new SchoolAgent();
