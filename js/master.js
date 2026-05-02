// ==================== js/master.js ====================

const elements = {
    userName: () => document.getElementById('userName')?.value.trim(),
    universityName: () => document.getElementById('universityName')?.value.trim(),
    overseasMajor: () => document.getElementById('overseasMajor')?.value.trim(),
    bachelorMajor: () => document.getElementById('bachelorMajor')?.value.trim(),
    courseList: () => document.getElementById('courseList')?.value.trim(),
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
    const requiredAgents = ['MatchAgent', 'SchoolAgent', 'CompareAgent', 'StatementAgent', 'FeedbackAgent'];
    
    while (retries < 50) {
        const allReady = requiredAgents.every(agent => window[agent]);
        if (allReady) {
            console.log('✅ 所有 Agent 已就绪');
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
        bachelorMajor: elements.bachelorMajor(),
        courseList: elements.courseList(),
        useType: elements.useType()
    };
    
    for (const [key, value] of Object.entries(userData)) {
        if (!value) {
            alert(`请填写${key}`);
            return;
        }
    }
    
    window.Tracker?.startSession(userData);
    window.Tracker?.trackEvent('start_matching', userData);
    
    showLoading();
    
    try {
        updateMatchResult('正在匹配学科...');
        const matches = await window.MatchAgent.match(userData);
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

// ==================== 高校推荐（支持重新生成） ====================
async function recommendSchools() {
    if (!currentState.selectedDiscipline) {
        alert('请先完成学科匹配');
        return;
    }
    
    updateSchoolResult('正在推荐高校...');
    
    try {
        const schools = await window.SchoolAgent.recommend(
            currentState.selectedDiscipline.name,
            'master'
        );
        currentState.schoolRecommendations = schools;
        renderSchoolResult(schools);
        window.Tracker?.trackEvent('schools_recommended', { count: schools.length });
    } catch (error) {
        console.error('高校推荐失败:', error);
        updateSchoolResult(`<p style="color:red">推荐失败：${error.message}</p>`);
    }
}

// ==================== 课程对比表（支持重新生成） ====================
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
        
        const rows = await window.CompareAgent.generate(
            elements.overseasMajor(),
            currentState.selectedDiscipline.name,
            elements.courseList(),
            univContext
        );
        
        currentState.compareTableRows = rows;
        renderTableResult(rows);
        window.Tracker?.trackEvent('compare_table_generated');
    } catch (error) {
        console.error('生成对比表失败:', error);
        updateTableResult(`<p style="color:red">生成失败：${error.message}</p>`);
    }
}

// ==================== 复核自述（支持重新生成） ====================
async function generateStatement() {
    if (!currentState.selectedDiscipline) {
        alert('请先完成学科匹配');
        return;
    }
    
    updateStatementResult('正在生成自述...');
    
    try {
        const result = await window.StatementAgent.generate({
            userName: elements.userName(),
            universityName: elements.universityName(),
            overseasMajor: elements.overseasMajor(),
            bachelorMajor: elements.bachelorMajor(),
            targetMajor: currentState.selectedDiscipline.name,
            courseList: elements.courseList(),
            useType: elements.useType()
        });
        
        currentState.statementText = result.text;
        currentState.statementTargetMajor = result.targetMajor;
        renderStatementResult(result.text);
        window.Tracker?.trackEvent('statement_generated');
    } catch (error) {
        console.error('生成自述失败:', error);
        updateStatementResult(`<p style="color:red">生成失败：${error.message}</p>`);
    }
}

// ==================== 渲染函数 ====================
function renderMatchResult(matches) {
    if (!matches.length) {
        updateMatchResult('<p>未匹配到合适学科，请补充更多课程信息后重试</p>');
        return;
    }
    
    let html = '<div class="discipline-list">';
    matches.forEach((m, idx) => {
        html += `
            <div class="discipline-card ${idx === 0 ? 'selected' : ''}" onclick="window.selectDiscipline(${idx})">
                <div class="discipline-name">${escapeHtml(m.name)}</div>
                <div class="discipline-meta">
                    <span class="first-level">${escapeHtml(m.firstLevel || m.first_level || '')}</span>
                    <span class="match-badge ${m.match_level || '中'}">${m.match_level || '推荐'}</span>
                </div>
                <div class="discipline-reason">${escapeHtml(m.reason || '')}</div>
            </div>
        `;
    });
    html += '</div>';
    html += '<div style="display: flex; gap: 12px; margin-top: 16px;">';
    html += '<button class="btn-primary" onclick="window.confirmDiscipline()">✅ 确认选择并继续</button>';
    html += '<button class="btn-secondary" onclick="startMatching()">🔄 重新匹配专业</button>';
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
        html += `
            <div class="school-card">
                <div class="school-name">${escapeHtml(s.university)}</div>
                <div class="school-link">
                    🔗 <a href="${escapeHtml(s.url)}" target="_blank">${escapeHtml(s.url.substring(0, 60))}</a>
                    ${s.isVerified ? '<span class="verified-badge">✓ 已验证</span>' : ''}
                    ${s.avgScore ? `<span class="score-badge">⭐ ${s.avgScore}</span>` : ''}
                </div>
                <div class="school-reason">${escapeHtml(s.reason)}</div>
                <div class="feedback-section">
                    <input type="text" placeholder="补充培养方案链接" class="feedback-input" data-school="${escapeHtml(s.university)}">
                    <button class="btn-small" onclick="window.submitSchoolLink(this)">📎 提交反馈</button>
                    ${s.linkId ? `
                    <div class="rating-stars" data-link-id="${s.linkId}">
                        ${[1,2,3,4,5].map(star => `<span class="star" data-score="${star}">★</span>`).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    html += '<div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center;">';
    html += '<button class="btn-primary" onclick="generateCompareTable()">📊 生成课程对比表</button>';
    html += '<button class="btn-secondary" onclick="recommendSchools()">🔄 重新推荐高校</button>';
    html += '</div>';
    
    updateSchoolResult(html);
    
    document.querySelectorAll('.rating-stars').forEach(el => {
        el.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async () => {
                const linkId = el.dataset.linkId;
                const score = parseInt(star.dataset.score);
                await window.FeedbackAgent.submitRating(linkId, score);
                alert('评分已提交，感谢反馈！');
                await recommendSchools();
            });
        });
    });
}

function renderTableResult(rows) {
    const tableHtml = window.CompareAgent.toHtml(rows);
    
    updateTableResult(`
        ${tableHtml}
        <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center; flex-wrap: wrap;">
            <button class="btn-primary" onclick="generateStatement()">📝 生成复核自述</button>
            <button class="btn-secondary" onclick="generateCompareTable()">🔄 重新生成对比表</button>
            <button class="btn-secondary" onclick="downloadCSV()">📥 下载 CSV</button>
        </div>
    `);
}

function renderStatementResult(text) {
    updateStatementResult(`
        <textarea id="statementText" rows="15" class="statement-textarea" readonly style="background:#faf8f5">${escapeHtml(text)}</textarea>
        <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center; flex-wrap: wrap;">
            <button class="btn-primary" onclick="copyStatement()">📋 复制自述</button>
            <button class="btn-primary" onclick="downloadStatement()">📥 下载自述</button>
            <button class="btn-secondary" onclick="generateStatement()">🔄 重新生成自述</button>
        </div>
        <div class="statement-note">
            💡 自述中复核专业已按「一级学科（海外专业中文译名）」格式生成
        </div>
    `);
}

// ==================== 辅助函数 ====================
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

// ==================== 全局函数 ====================
window.selectDiscipline = function(idx) {
    currentState.selectedDiscipline = currentState.matchedDisciplines[idx];
    document.querySelectorAll('.discipline-card').forEach((card, i) => {
        card.classList.toggle('selected', i === idx);
    });
    window.Tracker?.trackEvent('select_discipline', { name: currentState.selectedDiscipline?.name });
};

window.confirmDiscipline = async function() {
    if (!currentState.selectedDiscipline) {
        alert('请先选择一个学科');
        return;
    }
    await recommendSchools();
    document.querySelector('.tab-btn[data-tab="school"]')?.click();
    window.Tracker?.trackEvent('confirm_discipline', { name: currentState.selectedDiscipline.name });
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
        
        // 显示提交结果
        let statusText = '';
        let statusColor = '';
        switch(result.status) {
            case 'approved':
                statusText = '✅ AI 已批准，链接已加入知识库';
                statusColor = '#4caf50';
                break;
            case 'pending':
                statusText = '⚠️ AI 判定为部分合理，已提交';
                statusColor = '#ff9800';
                break;
            case 'rejected':
                statusText = '❌ AI 判定为不合理，未采纳';
                statusColor = '#f44336';
                break;
            default:
                statusText = `📋 ${result.ai_judgment || '已提交'}`;
                statusColor = '#2196f3';
        }
        
        // 显示结果提示
        const feedbackDiv = card.querySelector('.feedback-result') || document.createElement('div');
        feedbackDiv.className = 'feedback-result';
        feedbackDiv.style.cssText = `margin-top: 8px; padding: 8px; background: ${statusColor}20; border-radius: 8px; font-size: 12px; color: ${statusColor};`;
        feedbackDiv.innerHTML = `${statusText}<br>${result.judgment_reason || ''}`;
        
        if (!card.querySelector('.feedback-result')) {
            card.querySelector('.feedback-section').after(feedbackDiv);
        }
        
        // 清空输入框
        input.value = '';
        
        // 【关键修复】如果 AI 批准了，立即刷新高校推荐区域
        if (result.status === 'approved' || result.ai_judgment === '合理') {
            alert(`✅ 链接已通过 AI 审核，将立即生效！\n\n判定：${result.ai_judgment}\n理由：${result.judgment_reason}`);
            // 刷新高校推荐
            await recommendSchools();
            // 切换到高校推荐 Tab
            document.querySelector('.tab-btn[data-tab="school"]')?.click();
        } else {
            alert(`提交完成！\nAI判定：${result.ai_judgment}\n${result.judgment_reason}\n\n${result.status === 'pending' ? '该链接将进入待观察区。' : '该链接未被采纳。'}`);
        }
        
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
        window.Tracker?.trackEvent('copy_statement');
    }
};

window.downloadStatement = function() {
    const text = document.getElementById('statementText')?.value || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `复核自述_${elements.userName() || '申请人'}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.Tracker?.trackEvent('download_statement');
};

window.downloadCSV = function() {
    const table = document.querySelector('.compare-table');
    if (!table) {
        alert('请先生成对比表');
        return;
    }
    
    let csv = '\uFEFF海外课程,核心内容,国内对应课程,近似性说明\n';
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
    link.download = `课程对比表_${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.Tracker?.trackEvent('download_csv');
};

// 暴露函数供全局调用
window.startMatching = startMatching;
window.recommendSchools = recommendSchools;
window.generateCompareTable = generateCompareTable;
window.generateStatement = generateStatement;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    await waitForAgents();
    console.log('✅ 硕士页面已加载');
});