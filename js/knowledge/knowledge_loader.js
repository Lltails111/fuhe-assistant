// ==================== 知识库加载器 ====================

let disciplineDatabase = null;

async function loadDisciplineDatabase() {
    try {
        const response = await fetch('./js/knowledge/disciplines_master.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        disciplineDatabase = await response.json();
        console.log(`✅ 学科库加载成功：${Object.keys(disciplineDatabase.second_level).length} 个二级学科`);
        return disciplineDatabase;
    } catch (error) {
        console.error('❌ 学科库加载失败：', error);
        return { second_level: {} };
    }
}

function findSecondLevelByCode(code) {
    if (!disciplineDatabase) return null;
    return disciplineDatabase.second_level[code] || null;
}

function searchSecondLevelByName(keyword) {
    if (!disciplineDatabase || !keyword) return [];
    
    const results = [];
    const lowerKeyword = keyword.toLowerCase();
    
    for (const [code, info] of Object.entries(disciplineDatabase.second_level)) {
        if (info.name.toLowerCase().includes(lowerKeyword)) {
            results.push({ code, ...info });
        }
    }
    
    return results;
}

function getAllSecondLevels() {
    if (!disciplineDatabase) return [];
    return Object.entries(disciplineDatabase.second_level).map(([code, info]) => ({
        code,
        name: info.name,
        firstLevelName: info.first_level_name
    }));
}

window.KnowledgeLoader = {
    getAll: getAllSecondLevels,
    search: searchSecondLevelByName,
    findByCode: findSecondLevelByCode,
    isReady: () => disciplineDatabase !== null,
    load: loadDisciplineDatabase
};

loadDisciplineDatabase();