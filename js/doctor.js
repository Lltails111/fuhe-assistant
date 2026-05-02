// ==================== js/doctor.js ====================

const elements = {
    userName: () => document.getElementById('userName')?.value.trim(),
    universityName: () => document.getElementById('universityName')?.value.trim(),
    overseasMajor: () => document.getElementById('overseasMajor')?.value.trim(),
    researchDirection: () => document.getElementById('researchDirection')?.value.trim(),
    thesisTitle: () => document.getElementById('thesisTitle')?.value.trim(),
    masterMajor: () => document.getElementById('masterMajor')?.value.trim(),
    bachelorMajor: () => document.getElementById('bachelorMajor')?.value.trim(),
    courseList: () => document.getElementById('courseList')?.value.trim(),
    paperKeywords: () => document.getElementById('paperKeywords')?.value.trim(),
    useType: () => document.getElementById('useType')?.value
};

let currentState = {
    matchedDisciplines: [],
    selectedDiscipline: null,
    schoolRecommendations: [],
    compareTableRows: [],
    statementText: '',
    statementTargetMajor: ''
};

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tabId}`)?.classList.add('active');
        });
    });
}

async function waitForAgents() {
    let retries = 0;
    const requiredAgents = ['DoctorMatchAgent', 'DoctorSchoolAgent', 'DoctorCompareAgent', 'DoctorStatementAgent', 'FeedbackAgent'];
    
    while (retries < 50) {
        const allReady = requiredAgents.every(agent => window[agent]);
        if (allReady) {
            console.log('✅ 所有博士 Agent 已就绪');
            return true;
        }
        await new Promise(r => setTimeout(r, 100));
        retries++;
    }
    console.warn('⚠️ Agent 加载超时');
    return false;
}

async function startMatching() {
    const userData = {
        userName: elements.userName(),
        universityName: elements.universityName(),
        overseasMajor: elements.overseasMajor(),
        researchDirection: elements.researchDirection(),
        thesisTitle: elements.thesisTitle(),
        masterMajor: elements.masterMajor(),
        bachelorMajor: elements.bachelorMajor(),
        courseList: elements.courseList(),
        paperKeywords: elements.paperKeywords(),
        useType: elements.useType()
    };
    
    // 验证必填字段
    const required = ['userName', 'universityName', 'overseasMajor', 'researchDirection', 'masterMajor', 'bachelorMajor', 'courseList'];
    for (const key of required) {
        if (!userData[key]) {
            alert(`请填写${key}`);
            return;
        }
    }
    
    window.Tracker?.startSession({ ...userData, level: 'doctor' });
    window.Tracker?.trackEvent('start_matching', { level: 'doctor' });
    
    showLoading();
    
    try {
        updateMatchResult('正在匹配学科...');
        const matches = await window.DoctorMatchAgent.match(userData);
        currentState.matchedDisciplines = matches;
        renderMatchResult(matches);
        
        if (matches.length > 0) {
            currentState.selectedDiscipline = matches[0];
        }
        
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="match"]')?.click();
        }, 100);
        
    } catch (error) {
        console.error('匹配失败:', error);
        updateMatchResult(`<p style="color:red">匹配失败：${error.message}</p>`);
    } finally {
        hideLoading();
    }
}

async function recommendSchools() {
    if (!currentState.selectedDiscipline) {
        alert('请先完成学科匹配');
        return;
    }
    
    updateSchoolResult('正在推荐导师/高校...');
    
    try {
        const schools = await window.DoctorSchoolAgent.recommend(
            currentState.selectedDiscipline.name,
            elements.researchDirection()
        );
        currentState.schoolRecommendations = schools;
        renderSchoolResult(schools);
    } catch (error) {
        console.error('推荐失败:', error);
        updateSchoolResult(`<p style="color:red">推荐失败：${error.message}</p>`);
    }
}

async function generateCompareTable() {
    if (!currentState.selectedDiscipline) {
        alert('请先完成学科匹配');
        return;
    }
    
    updateTableResult('正在生成对比表...');
    
    try {
        const univContext = currentState.schoolRecommendations
            .slice(0, 2)
            .map(s => s.university)
            .join('、');
        
        const rows = await window.DoctorCompareAgent.generate(
            elements.overseasMajor(),
            currentState.selectedDiscipline.name,
            elements.researchDirection(),
            elements.courseList(),
            univContext
        );
        
        currentState.compareTableRows = rows;
        renderTableResult(rows);
    } catch (error) {
        console.error('生成对比表失败:', error);
        updateTableResult(`<p style="color:red">生成失败：${error.message}</p>`);
    }
}

async function generateStatement() {
    if (!currentState.selectedDiscipline) {
        alert('请先完成学科匹配');
        return;
    }
    
    updateStatementResult('正在生成自述...');
    
    try {
        const result = await window.DoctorStatementAgent.generate({
            userName: elements.userName(),
            universityName: elements.universityName(),
            overseasMajor: elements.overseasMajor(),
            researchDirection: elements.researchDirection(),
            thesisTitle: elements.thesisTitle(),
            masterMajor: elements.masterMajor(),
            bachelorMajor: elements.bachelorMajor(),
            targetMajor: currentState.selectedDiscipline.name,
            courseList: elements.courseList(),
            paperKeywords: elements.paperKeywords(),
            useType: elements.useType()
        });
        
        currentState.statementText = result.text;
        currentState.statementTargetMajor = result.targetMajor;
        renderStatementResult(result.text);
    } catch (error) {
        console.error('生成自述失败:', error);
        updateStatementResult(`<p style="color:red">生成失败：${error.message}</p>`);
    }
}

function renderMatchResult(matches) {
    if (!matches.length) {
        updateMatchResult('<p>未匹配到合适学科，请补充更多信息后重试</p>');
        return;
    }
    
    let html = '<div class="discipline-list">';
    matches.forEach((m, idx) => {
        html += `
            <div class="discipline-card ${idx === 0 ? 'selected' : ''}" onclick="window.selectDiscipline(${idx})">
                <div class="discipline-name">${escapeHtml(m.name)}</div>
                <div class="discipline-meta">
                    <span class="first-level">${escapeHtml(m.firstLevel || '')}</span>
                    <span class="match-badge ${m.match_level || '中'}">${m.match_level || '推荐'}</span>
                </div>
                <div class="discipline-reason">${escapeHtml(m.reason || '')}</div>
            </div>
        `;
    });
    html += '</div>';
    html += '<div style="display: flex; gap: 12px; margin-top: 16px;">';
    html += '<button class="btn-primary" onclick="window.confirmDiscipline()">✅ 确认选择并继续</button>';
    html += '<button class="btn-secondary" onclick="startMatching()">🔄 重新匹配</button>';
    html += '</div>';
    
    updateMatchResult(html);
}

function renderSchoolResult(schools) {
    if (!schools.length) {
        updateSchoolResult('<p>暂无推荐，请稍后重试</p>');
        return;
    }
    
    let html = '<div class="school-list">';
    schools.forEach(s => {
        const isDirectLink = s.isDirectLink === true || (s.url && s.url.startsWith('http'));
        
        html += `
            <div class="school-card">
                <div class="school-name">${escapeHtml(s.university)}</div>
                ${s.department ? `<div class="school-dept">📚 ${escapeHtml(s.department)}</div>` : ''}
                ${s.research_group ? `<div class="school-lab">🔬 ${escapeHtml(s.research_group)}</div>` : ''}
                <div class="school-link">
                    ${isDirectLink 
                        ? `🔗 <a href="${escapeHtml(s.url)}" target="_blank">查看详情</a>`
                        : `🔍 <span style="color:#a0724a;">${escapeHtml(s.search_suggestion || s.url || '建议在官网搜索')}</span>`
                    }
                    ${s.isVerified ? '<span class="verified-badge">✓ 已验证</span>' : ''}
                </div>
                <div class="school-reason">${escapeHtml(s.reason)}</div>
                <div class="feedback-section">
                    <input type="text" placeholder="补充培养方案/导师信息链接" class="feedback-input" data-school="${escapeHtml(s.university)}">
                    <button class="btn-small" onclick="window.submitSchoolLink(this)">📎 提交反馈</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    html += '<div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center;">';
    html += '<button class="btn-primary" onclick="generateCompareTable()">📊 生成对比表</button>';
    html += '<button class="btn-secondary" onclick="recommendSchools()">🔄 重新推荐</button>';
    html += '</div>';
    
    updateSchoolResult(html);
}

function renderTableResult(rows) {
    const tableHtml = window.DoctorCompareAgent.toHtml(rows);
    
    updateTableResult(`
        ${tableHtml}
        <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center;">
            <button class="btn-primary" onclick="generateStatement()">📝 生成复核自述</button>
            <button class="btn-secondary" onclick="generateCompareTable()">🔄 重新生成</button>
            <button class="btn-secondary" onclick="downloadCSV()">📥 下载 CSV</button>
        </div>
    `);
}

function renderStatementResult(text) {
    updateStatementResult(`
        <textarea id="statementText" rows="18" class="statement-textarea" readonly style="background:#faf8f5">${escapeHtml(text)}</textarea>
        <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center;">
            <button class="btn-primary" onclick="copyStatement()">📋 复制自述</button>
            <button class="btn-primary" onclick="downloadStatement()">📥 下载自述</button>
            <button class="btn-secondary" onclick="generateStatement()">🔄 重新生成</button>
        </div>
        <div class="statement-note">
            💡 自述已按博士层次生成，突出研究方向和学术深度
        </div>
    `);
}

function showLoading() {
    const btn = document.getElementById('submitBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ AI 处理中...';
    }
}

function hideLoading() {
    const btn = document.getElementById('submitBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 开始匹配专业';
    }
}

function updateMatchResult(html) {
    const el = document.getElementById('matchResult');
    if (el) el.innerHTML = html;
}

function updateSchoolResult(html) {
    const el = document.getElementById('pdfArea');
    if (el) el.innerHTML = html;
}

function updateTableResult(html) {
    const el = document.getElementById('finalArea');
    if (el) el.innerHTML = html;
}

function updateStatementResult(html) {
    const el = document.getElementById('statementArea');
    if (el) el.innerHTML = html;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

window.selectDiscipline = function(idx) {
    currentState.selectedDiscipline = currentState.matchedDisciplines[idx];
    document.querySelectorAll('.discipline-card').forEach((card, i) => {
        card.classList.toggle('selected', i === idx);
    });
};

window.confirmDiscipline = async function() {
    if (!currentState.selectedDiscipline) {
        alert('请先选择一个学科');
        return;
    }
    await recommendSchools();
    document.querySelector('.tab-btn[data-tab="school"]')?.click();
};

window.submitSchoolLink = async function(btn) {
    const card = btn.closest('.school-card');
    const input = card.querySelector('.feedback-input');
    const linkUrl = input.value.trim();
    const universityName = card.querySelector('.school-name').innerText;
    const targetMajor = currentState.selectedDiscipline?.name || '';
    
    if (!linkUrl) {
        alert('请输入链接地址');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = '提交中...';
    
    try {
        const result = await window.FeedbackAgent.submitAndJudge(linkUrl, universityName, targetMajor);
        
        if (result.status === 'approved' || result.ai_judgment === '合理') {
            alert(`✅ 链接已通过 AI 审核！\n\n判定：${result.ai_judgment}\n${result.judgment_reason}`);
            await recommendSchools();
        } else {
            alert(`提交完成！\nAI判定：${result.ai_judgment}\n${result.judgment_reason}`);
        }
        
        input.value = '';
    } catch (error) {
        alert('提交失败：' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '提交反馈';
    }
};

window.copyStatement = function() {
    const textarea = document.getElementById('statementText');
    if (textarea) {
        textarea.select();
        document.execCommand('copy');
        alert('已复制到剪贴板');
    }
};

window.downloadStatement = function() {
    const text = document.getElementById('statementText')?.value || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `博士复核自述_${elements.userName() || '申请人'}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
};

window.downloadCSV = function() {
    const table = document.querySelector('.compare-table');
    if (!table) {
        alert('请先生成对比表');
        return;
    }
    
    let csv = '\uFEFF海外课程/研究方向,核心内容,国内对应,近似性说明\n';
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).slice(0, 4).map(td => {
            let text = td.innerText.replace(/"/g, '""');
            return `"${text}"`;
        }).join(',');
        csv += rowData + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `博士对比表_${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
};

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    await waitForAgents();
    console.log('✅ 博士页面已加载');
});

window.startMatching = startMatching;
window.recommendSchools = recommendSchools;
window.generateCompareTable = generateCompareTable;
window.generateStatement = generateStatement;