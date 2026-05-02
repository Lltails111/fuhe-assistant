// ==================== js/agents/doctor_compare_agent.js ====================

class DoctorCompareAgent {
    constructor() {
        this.name = '博士课程对比Agent';
    }
    
    async generate(overseasMajor, targetMajor, researchDirection, courseList, universityContext = '') {
        const courses = courseList.split('\n').filter(c => c.trim());
        
        const prompt = `【博士培养方案对比】
海外博士专业：${overseasMajor}
复核专业：${targetMajor}
研究方向：${researchDirection}
核心课程/研究经历：
${courses.map((c, i) => `${i+1}. ${c}`).join('\n')}
参考高校：${universityContext || '清华大学、北京大学'}

请生成对比表，对比海外课程/研究与国内对应课程，格式：
| 海外课程/研究方向 | 核心内容 | 国内对应课程/研究方向 | 近似性说明 |
|---|---|---|---|

要求：
1. 为每一门课程或研究经历生成一行
2. 国内对应课程需标注高校名称
3. 近似性说明需体现研究方向契合度

直接输出表格，使用 | 分隔。`;

        const tableText = await window.API.callDeepSeek([
            { role: 'system', content: '你是博士培养对比专家，输出格式整洁的表格' },
            { role: 'user', content: prompt }
        ]);
        
        return this.parseTable(tableText);
    }
    
    parseTable(rawText) {
        const rows = [];
        const lines = rawText.split('\n');
        
        for (const line of lines) {
            if (line.includes('|') && !line.includes('---') && !line.includes('海外课程') && !line.includes('研究方向')) {
                const cells = line.split('|').filter(c => c.trim());
                if (cells.length >= 4) {
                    rows.push(cells.map(c => c.trim()));
                }
            }
        }
        
        return rows;
    }
    
    toHtml(rows) {
        if (rows.length === 0) return '<p>无法生成对比表</p>';
        
        let html = `<table class="compare-table">
            <thead>
                <tr>
                    <th>海外课程/研究方向</th>
                    <th>核心内容</th>
                    <th>国内对应课程/研究方向</th>
                    <th>近似性说明</th>
                </tr>
            </thead>
            <tbody>`;
        
        for (const row of rows) {
            html += '<tr>';
            for (let i = 0; i < 4; i++) {
                html += `<td contenteditable="true">${this.escapeHtml(row[i] || '')}</td>`;
            }
            html += '</tr>';
        }
        
        html += `</tbody>
        </table>
        <small>💡 双击单元格可编辑</small>`;
        
        return html;
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
}

window.DoctorCompareAgent = new DoctorCompareAgent();