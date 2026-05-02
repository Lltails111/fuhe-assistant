// ==================== js/agents/doctor_statement_agent.js ====================

class DoctorStatementAgent {
    constructor() {
        this.name = '博士自述生成Agent';
    }
    
    async generate(params) {
        const { userName, universityName, overseasMajor, researchDirection, thesisTitle, masterMajor, bachelorMajor, targetMajor, courseList, paperKeywords, useType } = params;
        
        const chineseName = await this.translateMajor(overseasMajor);
        const fullTargetMajor = `${targetMajor}（${chineseName}）`;
        
        const prompt = `【博士复核自述生成】

申请人：${userName}
海外院校：${universityName}
海外专业：${overseasMajor}
复核专业：${fullTargetMajor}
研究方向：${researchDirection}
博士论文题目：${thesisTitle || '未提供'}
硕士专业：${masterMajor}
本科专业：${bachelorMajor}
核心课程/研究经历：${courseList}
发表论文关键词：${paperKeywords || '未提供'}
申请用途：${useType}

【自述要求】
1. 字数：600-700字
2. 结构：
   - 自我介绍及博士研究背景
   - 研究方向与国内${targetMajor}学科的核心关联
   - 课程与研究经历的重合度论证
   - 本硕博学术衔接逻辑
   - 结语与申请诉求
3. 语言正式、专业，突出研究能力和学术深度

直接输出自述正文，不要标题。`;

        const statement = await window.API.callDeepSeek([
            { role: 'system', content: '你是留服复核材料撰写专家，擅长博士层次的专业论证' },
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
                { role: 'user', content: `将以下博士专业名称翻译为中文：${englishMajor}` }
            ]);
            return result.trim() || englishMajor;
        } catch (e) {
            return englishMajor;
        }
    }
}

window.DoctorStatementAgent = new DoctorStatementAgent();