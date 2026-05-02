// ==================== js/agents/statement_agent.js ====================

class StatementAgent {
    constructor() {
        this.name = '自述生成Agent';
    }
    
    async generate(params) {
        const { userName, universityName, overseasMajor, bachelorMajor, targetMajor, courseList, useType } = params;
        
        const chineseName = await this.translateMajor(overseasMajor);
        const fullTargetMajor = `${targetMajor}（${chineseName}）`;
        
        const prompt = `生成留服复核自述：

申请人：${userName}
海外院校：${universityName}
海外专业：${overseasMajor}
复核专业：${fullTargetMajor}
本科专业：${bachelorMajor}
核心课程：${courseList}
用途：${useType}

【自述格式要求】
尊敬的留服中心老师：

我是申请人${userName}，毕业于${universityName}，攻读${overseasMajor}专业。说明该专业的学术背景和培养目标。现需申请将专业复核为'${fullTargetMajor}(${overseasMajor})'。
结合${courseList === "考公" ? "公务员报考的专业分类要求" : "国内就业市场的专业认证需求"}，说明将海外专业复核为${fullTargetMajor}的必要性和合理性。

论证海外专业与国内${bachelorMajor}一级学科的核心关联性，从学科基础、研究方向、培养目标等维度阐述。

详细说明课程重合度，列举至少3门核心课程与国内对应课程的对比，论证专业内核一致性。同时说明本科专业与硕士专业的衔接逻辑。

结尾：恳请留服中心审核，附上海内外课程对比表、成绩单等辅助材料。此致敬礼。

【输出要求】
1. 语言正式、专业，符合留服复核官方要求
2. 字数控制在550-700字
3. 直接输出自述正文，不要有其他格式标记

请直接输出自述正文：`;

        const statement = await window.API.callDeepSeek([
            { role: 'system', content: '你是留服复核材料撰写专家' },
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
                { role: 'user', content: `将以下专业名称翻译为中文：${englishMajor}` }
            ]);
            return result.trim() || englishMajor;
        } catch (e) {
            return englishMajor;
        }
    }
}

window.StatementAgent = new StatementAgent();