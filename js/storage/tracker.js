// ==================== 追踪与存储模块 ====================

let currentSessionId = null;
let sessionStartTime = null;
let behaviorQueue = [];

function generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

function startSession(formData) {
    currentSessionId = generateSessionId();
    sessionStartTime = Date.now();
    
    const session = {
        session_id: currentSessionId,
        level: "master",
        timestamp: new Date().toISOString(),
        user_input: {
            userName: formData.userName,
            universityName: formData.universityName,
            overseasMajor: formData.overseasMajor,
            bachelorMajor: formData.bachelorMajor,
            useType: formData.useType
        },
        behaviors: [],
        satisfaction_score: 50,
        completed: false
    };
    
    localStorage.setItem("current_session", JSON.stringify(session));
    console.log("📊 会话已开始:", currentSessionId);
}

function trackEvent(action, data = {}) {
    if (!currentSessionId) return;
    
    const event = {
        action: action,
        timestamp: Date.now() - (sessionStartTime || Date.now()),
        data: data
    };
    
    behaviorQueue.push(event);
    
    if (behaviorQueue.length >= 5) {
        flushEvents();
    }
    
    console.log("📊 事件记录:", action, data);
}

function flushEvents() {
    if (behaviorQueue.length === 0) return;
    
    const session = JSON.parse(localStorage.getItem("current_session") || '{}');
    if (session.session_id) {
        session.behaviors = [...(session.behaviors || []), ...behaviorQueue];
        localStorage.setItem("current_session", JSON.stringify(session));
    }
    
    behaviorQueue = [];
}

function completeSession(selectedMajor, satisfactionScore) {
    flushEvents();
    
    const session = JSON.parse(localStorage.getItem("current_session") || '{}');
    if (session.session_id) {
        session.selected_major = selectedMajor;
        session.satisfaction_score = satisfactionScore;
        session.completed = true;
        session.duration = Date.now() - (sessionStartTime || Date.now());
        
        saveToHistory(session);
        console.log("📊 会话完成，满意度:", satisfactionScore);
    }
}

function saveToHistory(session) {
    let history = JSON.parse(localStorage.getItem("session_history") || '[]');
    history.unshift(session);
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem("session_history", JSON.stringify(history));
}

function loadSessionHistory() {
    return JSON.parse(localStorage.getItem("session_history") || '[]');
}

function exportUserData() {
    const allData = {
        export_time: new Date().toISOString(),
        session_history: loadSessionHistory(),
        current_session: JSON.parse(localStorage.getItem("current_session") || 'null')
    };
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `留服助手_数据备份_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearHistory() {
    if (confirm("确定要清除所有历史记录吗？此操作不可恢复。")) {
        localStorage.removeItem("session_history");
        localStorage.removeItem("current_session");
        console.log("📊 历史记录已清除");
    }
}

window.Tracker = {
    startSession,
    trackEvent,
    completeSession,
    loadSessionHistory,
    exportUserData,
    clearHistory
};