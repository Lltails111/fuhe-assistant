// ==================== js/agents/bachelor_statement_agent.js ====================

class BachelorStatementAgent {
    constructor() {
        this.name = '本科自述生成Agent';
    }
    
    async generate(params) {
        const { userName, universityName, overseasMajor, specialization, targetMajor, courseList, gpa, achievements, useType, highSchoolType, educationLength } = params;
        
        const chineseName = await this.translateMajor(overseasMajor);
        const fullTargetMajor = `${targetMajor}（${chineseName}）`;
        
        const prompt = `【本科复核自述生成】

申请人：${userName}
海外院校：${universityName}
海外专业：${overseasMajor}
复核专业：${fullTargetMajor}
专业方向：${specialization || '无'}
学制：${educationLength}
GPA/成绩：${gpa || '未提供'}
高中背景：${highSchoolType}
核心课程：${courseList}
获奖/项目：${achievements || '无'}
申请用途：${useType}

【自述要求】
1. 字数：500-600字
2. 结构：
   - 自我介绍及海外学习背景
   - 专业课程与国内${targetMajor}专业的核心关联
   - 课程重合度与学分对接说明
   - 高中至本科的学术成长路径
   - 结语与复核诉求
3. 语言正式、专业

直接输出自述正文，不要标题。`;

        const statement = await window.API.callDeepSeek([
            { role: 'system', content: '你是留服复核材料撰写专家，擅长本科层次的专业论证' },
            { role: 'user', content: prompt }
        ]);
        
        return {
            text: statement,
            targetMajor: fullTargetMajor
        };
    }
    
    async translateMajor(englishMajor) {
        if (/[\u4e00-\u9fa5]/.test(englishMajor)) return englishMajor;
        
        try {
            const result = await window.API.callDeepSeek([
                { role: 'system', content: '只输出中文译名，不要其他内容' },
                { role: 'user', content: `将以下本科专业名称翻译为中文：${englishMajor}` }
            ]);
            return result.trim() || englishMajor;
        } catch (e) {
            return englishMajor;
        }
    }
}

window.BachelorStatementAgent = new BachelorStatementAgent();