// ==================== js/agents/compare_agent.js ====================

class CompareAgent {
    constructor() {
        this.name = '课程对比Agent';
    }
    
    async generate(overseasMajor, targetMajor, courseList, universityContext = '') {
        // 将用户输入的课程列表转换为数组
        const courses = courseList.split('\n')
            .map(c => c.trim())
            .filter(c => c.length > 0);
        
        const courseCount = courses.length;
        
        // 动态构建课程对比的示例（根据用户实际输入的课程数量）
        let courseExamples = '';
        for (let i = 0; i < Math.min(courseCount, 5); i++) {
            const courseName = courses[i];
            courseExamples += `${courseName}｜请根据课程内容生成核心内容描述｜国内对应课程名称｜专业性理由\n`;
        }
        
        const prompt = `【重要】用户共提供了 ${courseCount} 门核心课程，请为每一门课程生成一行对比数据。

用户信息：
海外专业：${overseasMajor}
复核专业：${targetMajor}
参考高校：${universityContext}

用户输入的课程列表（共 ${courseCount} 门）：
${courses.map((c, i) => `${i+1}. ${c}`).join('\n')}

输出格式要求：
请严格按照以下格式输出，每行用｜分隔，不要输出任何其他解释文字。

海外大学课程｜海外课程核心内容｜国内高校对应课程｜近似性说明（核心契合点）
${courseExamples}

注意：
1. 必须输出 ${courseCount} 行数据，每一行对应一门课程
2. "海外大学课程" 列填写课程名称
3. "海外课程核心内容" 列根据课程名称推断核心知识点
4. "国内高校对应课程" 列填写国内高校的对应课程名称，并标注高校名称，格式如"数据结构（清华大学）"
5. "近似性说明" 列从专业角度说明核心契合点，50字左右
6. 不要遗漏任何一门课程`;

        const tableText = await window.API.callDeepSeek([
            { role: 'system', content: '你是课程对比专家，必须输出用户提供的所有课程的对比数据，不能遗漏' },
            { role: 'user', content: prompt }
        ]);
        
        console.log('AI 返回的原始内容:', tableText);
        
        return this.parseTable(tableText, courseCount);
    }
    
    parseTable(rawText, expectedCount = 0) {
        const rows = [];
        
        // 方法1：按行解析，查找包含｜的行
        const lines = rawText.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 跳过空行、表头行、分隔行
            if (!trimmedLine) continue;
            if (trimmedLine.includes('海外大学课程') && trimmedLine.includes('海外课程核心内容')) continue;
            if (trimmedLine.includes('---')) continue;
            if (trimmedLine.includes('【') && trimmedLine.includes('】')) continue;
            
            // 检查是否包含分隔符
            if (trimmedLine.includes('｜')) {
                const cells = trimmedLine.split('｜').map(c => c.trim());
                // 过滤掉空单元格
                const validCells = cells.filter(c => c.length > 0);
                if (validCells.length >= 4) {
                    rows.push(validCells.slice(0, 4));
                } else if (validCells.length === 3) {
                    // 如果只有3列，补充空列
                    rows.push([validCells[0], validCells[1], validCells[2], '']);
                }
            }
        }
        
        // 方法2：如果方法1解析出的行数少于预期，尝试更宽松的解析
        if (expectedCount > 0 && rows.length < expectedCount) {
            console.warn(`期望 ${expectedCount} 行，实际解析出 ${rows.length} 行，尝试备用解析...`);
            
            // 备用解析：按行分割，识别课程名称模式
            const fallbackRows = this.fallbackParse(rawText, expectedCount);
            if (fallbackRows.length > rows.length) {
                return fallbackRows;
            }
        }
        
        // 如果仍然没有解析到数据，生成默认表格
        if (rows.length === 0) {
            console.warn('表格解析失败，使用默认模板');
            return this.generateDefaultTable();
        }
        
        return rows;
    }
    
    fallbackParse(rawText, expectedCount) {
        const rows = [];
        const lines = rawText.split('\n');
        
        // 查找所有可能包含课程的行
        let currentRow = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 如果行包含｜，按标准方式解析
            if (trimmed.includes('｜')) {
                const cells = trimmed.split('｜').map(c => c.trim());
                if (cells.length >= 2) {
                    rows.push([
                        cells[0] || '',
                        cells[1] || '',
                        cells[2] || '',
                        cells[3] || ''
                    ]);
                }
            }
        }
        
        return rows;
    }
    
    
    toHtml(rows) {
        if (!rows || rows.length === 0) {
            return '<p>⚠️ 无法生成表格，请点击「重新生成对比表」重试</p>';
        }
        
        let html = `<table class="compare-table">
            <thead>
                <tr>
                    <th style="width: 20%">海外课程</th>
                    <th style="width: 30%">海外课程核心内容</th>
                    <th style="width: 25%">国内高校对应课程</th>
                    <th style="width: 25%">近似性说明</th>
                </tr>
            </thead>
            <tbody>`;
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            html += '<tr>';
            for (let j = 0; j < 4; j++) {
                const content = (j < row.length) ? (row[j] || '') : '';
                html += `<td contenteditable="true">${this.escapeHtml(content)}</td>`;
            }
            html += '</tr>';
        }
        
        html += `</tbody>
        </table>
        <div style="margin-top: 8px; font-size: 12px; color: #888;">
            💡 共 ${rows.length} 门课程对比 | 双击单元格可编辑
        </div>`;
        
        return html;
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

window.CompareAgent = new CompareAgent();