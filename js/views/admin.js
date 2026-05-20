import { db, isMock, mockData, storage } from '../firebase-config.js';
import {
    collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc, limit, serverTimestamp, getCountFromServer
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { showToast, logout, getCached, setCache, clearCache, showModal, toggleTheme, initTheme } from '../utils.js';

let activeTab = 'dashboard';
let currentSubView = 'main';
let subViewParams = {};

export async function renderAdmin(container) {
    initTheme();

    container.innerHTML = `
        <div class="admin-layout animate-fade">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">
                    <div class="icon-circle primary" style="width:45px; height:45px; margin-bottom:0"><i data-lucide="brain"></i></div>
                    <span class="logo-text">PsyBoard</span>
                </div>
                <nav class="sidebar-nav">
                    <button class="sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard"><i data-lucide="layout"></i> <span>Dashboard</span></button>
                    <button class="sidebar-link ${activeTab === 'tests' ? 'active' : ''}" data-tab="tests"><i data-lucide="clipboard-list"></i> <span>Testlar</span></button>
                    <button class="sidebar-link ${activeTab === 'groups' ? 'active' : ''}" data-tab="groups"><i data-lucide="component"></i> <span>Struktura</span></button>
                    <button class="sidebar-link ${activeTab === 'tutors' ? 'active' : ''}" data-tab="tutors"><i data-lucide="shield-check"></i> <span>Tyutorlar</span></button>
                    <button class="sidebar-link ${activeTab === 'students' ? 'active' : ''}" data-tab="students"><i data-lucide="graduation-cap"></i> <span>Talabalar</span></button>
                    <button class="sidebar-link ${activeTab === 'assign' ? 'active' : ''}" data-tab="assign"><i data-lucide="share-2"></i> <span>Biriktirish</span></button>
                    <button class="sidebar-link ${activeTab === 'results' ? 'active' : ''}" data-tab="results"><i data-lucide="activity"></i> <span>Analitika</span></button>
                </nav>
                <div class="sidebar-footer">
                    <button class="sidebar-link" id="theme-toggle-btn"><i data-lucide="sun"></i> <span>Rejim</span></button>
                    <button class="sidebar-link" id="admin-logout" style="color: #FF5B5B"><i data-lucide="log-out"></i> <span>Chiqish</span></button>
                </div>
            </aside>
            <main class="admin-main">
                <header class="flex-between mb-4">
                    <div><h1 id="page-title">Dashboard</h1><p id="page-subtitle" class="text-muted">Psixologik xizmat markazi</p></div>
                    <div class="flex-gap">
                        <div class="badge badge-info">${isMock ? 'Demo' : 'Live'}</div>
                        <div class="icon-circle primary" style="width:40px; height:40px; margin-bottom:0; cursor:pointer"><i data-lucide="bell"></i></div>
                    </div>
                </header>
                <div id="admin-content" class="animate-scale"></div>
            </main>
        </div>
    `;

    const contentArea = document.getElementById('admin-content');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    document.getElementById('theme-toggle-btn').addEventListener('click', () => { toggleTheme(); if (window.lucide) window.lucide.createIcons(); });
    document.getElementById('admin-logout').addEventListener('click', logout);

    container.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
        link.addEventListener('click', () => {
            activeTab = link.dataset.tab;
            currentSubView = 'main';
            container.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderTab();
        });
    });

    async function fetchData(col) {
        const cached = getCached(col);
        if (cached) return cached;
        const snap = await getDocs(collection(db, col));
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCache(col, data);
        return data;
    }

    async function renderTab() {
        contentArea.innerHTML = `<div class="loader-container animate-fade"><div class="loader"></div></div>`;
        try {
            switch (activeTab) {
                case 'dashboard': await renderDashboard(contentArea); break;
                case 'tests': await renderTestsTab(contentArea); break;
                case 'groups': await renderGroupsTab(contentArea); break;
                case 'tutors': await renderTyutorsTab(contentArea); break;
                case 'students': await renderStudentsTab(contentArea); break;
                case 'assign': await renderAssignTab(contentArea); break;
                case 'results': await renderResultsTab(contentArea); break;
            }
        } catch (e) { contentArea.innerHTML = `<div class="card text-danger"><h3>Xato</h3><p>${e.message}</p></div>`; }
        if (window.lucide) window.lucide.createIcons();
    }

    // --- HELPERS ---
    async function hardResetDatabase() {
        if (!confirm("DIQQAT! Barcha guruhlar, talabalar va test natijalari butunlay o'chib ketadi. Bu amalni ortga qaytarib bo'lmaydi. Davom etasizmi?")) return;
        const password = prompt("Tasdiqlash uchun 'RESET' so'zini yozing:");
        if (password !== 'RESET') return;

        const cols = ['groups', 'submissions', 'assignments'];
        const progressToast = showToast("Tozalanmoqda...", "info", Infinity);

        try {
            for (const colName of cols) {
                const snap = await getDocs(collection(db, colName));
                const total = snap.docs.length;
                let count = 0;
                for (const d of snap.docs) {
                    await deleteDoc(doc(db, colName, d.id));
                    count++;
                    progressToast.update(`${colName}: ${count}/${total} o'chirilmoqda...`);
                }
            }
            progressToast.close();
            showToast("Barcha ma'lumotlar o'chirildi!", "success");
        } catch (e) {
            progressToast.close();
            showToast("Xato: " + e.message, "error");
        }
        clearCache(); renderTab();
    }

    async function seedIIAUData() {
        if (!confirm("Diqat! Bu amal tizimga IIAU standart strukturasi (Fakultetlar, Yo'nalishlar) qo'shadi. Davom etasizmi?")) return;
        const structure = [
            { fac: 'IIXM', dirs: ['JIXIM', 'Turizm', 'XM', 'AXB'] },
            { fac: 'Islomshunoslik', dirs: ['Manbashunolik', 'Dinshunoslik', 'islomshunoslik'] },
            { fac: 'MSHF', dirs: ['Xorijiy tilllar', 'Filologiya', 'Psixologiya'] }
        ];

        let total = 0;
        structure.forEach(f => total += f.dirs.length * 4);
        const progressToast = showToast(`0/${total} guruh yaratilmoqda...`, "info", Infinity);

        let count = 0;
        for (const item of structure) {
            for (const dir of item.dirs) {
                for (let c = 1; c <= 4; c++) {
                    await addDoc(collection(db, "groups"), {
                        faculty: item.fac,
                        direction: dir,
                        course: c,
                        name: `${dir}-${c}01`,
                        students: [{ name: 'Namuna Talaba', completedTests: [] }]
                    });
                    count++;
                    progressToast.update(`${count}/${total} guruh yaratilmoqda...`);
                }
            }
        }
        progressToast.close();
        showToast("IIAU strukturasi muvaffaqiyatli yuklandi!", "success");
        clearCache(); renderTab();
    }

    // --- DASHBOARD ---
    async function renderDashboard(area) {
        pageTitle.innerText = "IIAU Dashboard";

        const now = new Date();
        const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        let tests = [];
        let groups = [];
        let totalSubsCount = 0;
        let todaySubs = 0;
        let recentSubs = [];
        let recentActivitySubs = [];

        if (isMock) {
            tests = mockData.tests;
            groups = mockData.groups;
            totalSubsCount = 0;
            todaySubs = 0;
            recentSubs = [];
            recentActivitySubs = [];
        } else {
            const [tData, gData, totalSubsSnap, todaySubsSnap, recentSubsSnap, recentActivitySnap] = await Promise.all([
                fetchData("tests"),
                fetchData("groups"),
                getCountFromServer(collection(db, "submissions")),
                getCountFromServer(query(collection(db, "submissions"), where("timestamp", ">=", last24h))),
                getDocs(query(collection(db, "submissions"), orderBy("timestamp", "desc"), limit(10))),
                getDocs(query(collection(db, "submissions"), orderBy("timestamp", "desc"), limit(100)))
            ]);
            tests = tData;
            groups = gData;
            totalSubsCount = totalSubsSnap.data().count;
            todaySubs = todaySubsSnap.data().count;
            recentSubs = recentSubsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            recentActivitySubs = recentActivitySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        let sCount = 0; groups.forEach(g => sCount += (g.students?.length || 0));

        // Calculate stats based on recent activity (last 100 submissions)
        const testStats = {};
        recentActivitySubs.forEach(s => testStats[s.testTitle] = (testStats[s.testTitle] || 0) + 1);
        const topTests = Object.entries(testStats).sort((a, b) => b[1] - a[1]).slice(0, 3);

        const groupStats = {};
        recentActivitySubs.forEach(s => {
            const g = groups.find(gx => gx.id === s.groupId);
            const gName = g?.name || 'Noma\'lum';
            groupStats[gName] = (groupStats[gName] || 0) + 1;
        });
        const topGroups = Object.entries(groupStats).sort((a, b) => b[1] - a[1]).slice(0, 3);

        area.innerHTML = `
            <div class="grid grid-4 mb-4">
                <div class="card stat-card animate-scale" style="animation-delay: 0.1s"><div class="icon-circle primary"><i data-lucide="brain"></i></div><div><p class="text-muted small">Metodikalar</p><h3>${tests.length}</h3></div></div>
                <div class="card stat-card animate-scale" style="animation-delay: 0.2s"><div class="icon-circle secondary"><i data-lucide="component"></i></div><div><p class="text-muted small">Guruhlar</p><h3>${groups.length}</h3></div></div>
                <div class="card stat-card animate-scale" style="animation-delay: 0.3s"><div class="icon-circle accent"><i data-lucide="graduation-cap"></i></div><div><p class="text-muted small">Talabalar</p><h3>${sCount}</h3></div></div>
                <div class="card stat-card animate-scale" style="animation-delay: 0.4s"><div class="icon-circle success"><i data-lucide="activity"></i></div><div><p class="text-muted small">Jami Natijalar</p><h3>${totalSubsCount}</h3></div></div>
            </div>

            <div class="grid grid-2">
                <div class="card animate-fade">
                    <div class="flex-between mb-4">
                        <h3 class="flex-gap"><i data-lucide="trending-up" class="text-primary"></i> Tizim Faolligi</h3>
                        <div class="badge badge-success">+${todaySubs} bugun</div>
                    </div>
                    
                    <div class="grid grid-2" style="gap:20px">
                        <div>
                            <p class="text-muted small uppercase font-weight-800 mb-3">Ommabop Testlar</p>
                            ${topTests.length ? topTests.map(([title, count]) => `
                                <div class="flex-between mb-2 p-2 hover-card" style="border-radius:10px; background:rgba(67, 24, 255, 0.03)">
                                    <span class="small font-weight-700" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${title}</span>
                                    <span class="badge badge-primary" style="font-size:0.7rem">${count}</span>
                                </div>
                            `).join('') : '<p class="text-muted small">Ma\'lumot yo\'q</p>'}
                        </div>
                        <div>
                            <p class="text-muted small uppercase font-weight-800 mb-3">Eng Faol Guruhlar</p>
                            ${topGroups.length ? topGroups.map(([name, count]) => `
                                <div class="flex-between mb-2 p-2 hover-card" style="border-radius:10px; background:rgba(5, 205, 153, 0.03)">
                                    <span class="small font-weight-700">${name}</span>
                                    <span class="badge badge-success" style="font-size:0.7rem">${count}</span>
                                </div>
                            `).join('') : '<p class="text-muted small">Ma\'lumot yo\'q</p>'}
                        </div>
                    </div>

                </div>

                <div class="card animate-fade">
                    <div class="flex-between mb-3"><h3>Oxirgi Topshirganlar</h3><button class="btn btn-sm btn-outline" id="btn-view-all-res">Barchasi</button></div>
                    <div class="mt-2">${recentSubs.length ? recentSubs.map(d => `<div class="flex-between mb-3 p-2 border-bottom hover-card">
                        <div class="flex-gap">
                            <div class="icon-circle primary" style="width:35px; height:35px; font-size:0.9rem">${d.studentName[0]}</div>
                            <div><strong>${d.studentName}</strong><p class="text-muted small">${d.testTitle}</p></div>
                        </div>
                        <div class="badge ${d.score > 20 ? 'badge-danger' : (d.score > 10 ? 'badge-warning' : 'badge-success')}">${d.score} ball</div>
                    </div>`).join('') : '<p class="text-muted">Harakatlar yo\'q</p>'}</div>
                </div>
            </div>
        `;

        document.getElementById('btn-view-all-res').onclick = () => { activeTab = 'results'; renderTab(); };
        if (window.lucide) window.lucide.createIcons();
    }

    // --- TESTS TAB ---
    async function renderTestsTab(area) {
        pageTitle.innerText = "Testlar Boshqaruvi";
        const tests = await fetchData("tests");
        area.innerHTML = `
            <div class="flex-between mb-4">
                <div class="flex-gap">
                    <button class="btn btn-primary" id="btn-new-test">+ Yangi Test</button>
                    <button class="btn btn-outline" id="btn-add-merged">+ Birlashtirilgan test</button>
                    <button class="btn btn-outline" id="btn-import-tests"><i data-lucide="upload"></i> Import JSON</button>
                </div>
                <button class="btn btn-outline" id="btn-export-tests"><i data-lucide="download"></i> Export JSON</button>
            </div>
            <div class="grid grid-3">${tests.map(t => `
                <div class="card animate-scale" style="position:relative">
                    ${t.type === 'merged' ? '<span class="badge badge-info" style="position:absolute; top:10px; right:10px; font-size:0.6rem">Birlashtirilgan</span>' : ''}
                    <div class="flex-between mb-3">
                        <div class="icon-circle primary"><i data-lucide="${t.type === 'merged' ? 'layers' : 'clipboard-list'}"></i></div>
                        <div class="flex-gap">
                            <button class="btn-icon ${t.type === 'merged' ? 'edit-merged' : 'edit-test'}" data-id="${t.id}"><i data-lucide="edit-3"></i></button>
                            <button class="btn-icon text-danger del-test" data-id="${t.id}"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                    <h3>${t.title}</h3>
                    <p class="text-muted small mt-1">${t.type === 'merged' ? (t.testIds?.length || 0) + ' ta test' : (t.questions?.length || 0) + ' ta savol'}</p>
                </div>
            `).join('')}</div>
        `;

        document.getElementById('btn-new-test').onclick = () => renderTestCreator(area);
        document.getElementById('btn-add-merged').onclick = () => renderMergedTestCreator(area);
        document.getElementById('btn-export-tests').onclick = () => {
            const blob = new Blob([JSON.stringify(tests, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `tests_${new Date().toLocaleDateString()}.json`; a.click();
        };
        document.getElementById('btn-import-tests').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        const testList = Array.isArray(imported) ? imported : [imported];
                        const total = testList.length;
                        const progressToast = showToast(`0/${total} test yuklanmoqda...`, "info", Infinity);

                        let count = 0;
                        for (const t of testList) {
                            const { id, ...cleanT } = t;
                            await addDoc(collection(db, "tests"), { ...cleanT, createdAt: new Date() });
                            count++;
                            progressToast.update(`${count}/${total} test yuklanmoqda...`);
                        }
                        progressToast.close();
                        showToast("Testlar import qilindi", "success"); clearCache(); renderTab();
                    } catch (err) { showToast("Xato: " + err.message, "error"); }
                };
                reader.readAsText(file);
            };
            input.click();
        };
        area.querySelectorAll('.edit-test').forEach(b => b.onclick = () => renderTestCreator(area, tests.find(t => t.id === b.dataset.id)));
        area.querySelectorAll('.edit-merged').forEach(b => b.onclick = () => renderMergedTestCreator(area, tests.find(t => t.id === b.dataset.id)));
        area.querySelectorAll('.del-test').forEach(b => b.onclick = async () => { if (confirm("O'chirilsinmi?")) { await deleteDoc(doc(db, "tests", b.dataset.id)); clearCache(); renderTab(); } });
    }

    async function renderTestCreator(area, existing = null) {
        area.innerHTML = `
            <div class="animate-fade" style="max-width: 1200px; margin: 0 auto;">
                <header class="flex-between mb-4 sticky-header" style="background: var(--surface); padding: 15px 20px; border-radius: 20px; box-shadow: var(--shadow); position: sticky; top: 10px; z-index: 100;">
                    <div class="flex-gap">
                        <div class="icon-circle primary" style="width:40px; height:40px"><i data-lucide="edit-3"></i></div>
                        <div>
                            <h2 style="font-size: 1.2rem; margin:0">${existing ? 'Testni Tahrirlash' : 'Yangi Test Yaratish'}</h2>
                            <p class="text-muted small" style="margin:0">Barcha maydonlarni to'ldiring</p>
                        </div>
                    </div>
                    <div class="flex-gap">
                        <button class="btn btn-outline btn-sm" id="btn-back"><i data-lucide="arrow-left"></i> Orqaga</button>
                        <button type="submit" form="t-form" class="btn btn-primary btn-sm" style="box-shadow: 0 5px 15px rgba(67, 24, 255, 0.2)">
                            <i data-lucide="save"></i> Saqlash
                        </button>
                    </div>
                </header>

                <form id="t-form" class="grid grid-3" style="gap: 20px; align-items: start;">
                    <!-- Sidebar: General Info & Interpretations -->
                    <div style="grid-column: span 1; display: flex; flex-direction: column; gap: 20px; position: sticky; top: 90px; max-height: calc(100vh - 110px); overflow-y: auto; padding-right: 5px;">
                        <div class="card" style="padding: 20px;">
                            <h4 class="mb-3 flex-gap"><i data-lucide="info" style="width:16px"></i> Umumiy ma'lumot</h4>
                            <div class="input-group mb-3">
                                <label class="small">Test Nomi</label>
                                <input type="text" id="t-title" required value="${existing?.title || ''}" placeholder="Masalan: Temperament testi">
                            </div>
                            <div class="input-group mb-3">
                                <label class="small">Test Tavsifi (Faqat adminga ko'rinadi)</label>
                                <textarea id="t-desc" placeholder="Test haqida qisqacha ma'lumot..." style="font-size:0.8rem; min-height:80px; padding:10px; border-radius:12px; border:1px solid var(--border); background:rgba(0,0,0,0.01); resize:none">${existing?.description || ''}</textarea>
                            </div>
                            <div class="input-group mb-3">
                                <label class="small">Vaqt Chegarasi (daqiqa)</label>
                                <input type="number" id="t-time" value="${existing?.timeLimit || 30}">
                            </div>
                            <label class="flex-gap hover-card p-2" style="cursor:pointer; border-radius:12px; border: 1px solid var(--border)">
                                <input type="checkbox" id="t-important" style="width:18px; height:18px" ${existing?.isProfileData ? 'checked' : ''}>
                                <div>
                                    <strong class="small" style="color:var(--primary)">Muhim (Profil uchun)</strong>
                                    <p class="text-muted" style="font-size:0.65rem; margin:0">Natijalar profilga saqlanadi</p>
                                </div>
                            </label>
                            <label class="flex-gap hover-card p-2" style="cursor:pointer; border-radius:12px; border: 1px solid var(--border)">
                                <input type="checkbox" id="t-hide-res" style="width:18px; height:18px" ${existing?.hideResults ? 'checked' : ''}>
                                <div>
                                    <strong class="small" style="color:var(--danger)">Natijani yashirish</strong>
                                    <p class="text-muted" style="font-size:0.65rem; margin:0">Talabaga ball va xulosa ko'rsatilmaydi</p>
                                </div>
                            </label>
                        </div>

                        <div class="card" style="padding: 20px;">
                            <div class="flex-between mb-3">
                                <h4 style="margin:0" class="flex-gap"><i data-lucide="pie-chart" style="width:16px"></i> Xulosalar</h4>
                                <button type="button" class="btn btn-icon primary" id="add-i" style="width:24px; height:24px"><i data-lucide="plus"></i></button>
                            </div>
                            <div id="i-container" style="display: flex; flex-direction: column; gap: 10px;"></div>
                        </div>
                    </div>

                    <!-- Main: Questions -->
                    <div style="grid-column: span 2;">
                        <div class="flex-between mb-3" style="padding: 0 10px;">
                            <div class="flex-gap">
                                <h3 style="margin:0">Savollar</h3>
                                <div class="badge badge-info" id="q-count-badge">0 savol</div>
                            </div>
                            <button type="button" class="btn btn-primary btn-sm" id="add-q" style="border-radius: 12px;">
                                <i data-lucide="plus-circle"></i> Yangi Savol
                            </button>
                        </div>
                        <div id="q-container" style="display: flex; flex-direction: column; gap: 15px;"></div>
                        
                        <div class="mt-4 p-5 text-center" id="empty-qs" style="display:none; border: 2px dashed var(--border); border-radius: 20px; opacity:0.5">
                            <i data-lucide="help-circle" style="width:40px; height:40px; margin-bottom:10px"></i>
                            <p>Hozircha savollar yo'q. "Yangi Savol" tugmasini bosing.</p>
                        </div>
                    </div>
                </form>
            </div>`;

        const qC = document.getElementById('q-container');
        const iC = document.getElementById('i-container');

        const updateQCount = () => {
            const count = qC.children.length;
            const badge = document.getElementById('q-count-badge');
            const empty = document.getElementById('empty-qs');
            if (badge) badge.innerText = `${count} savol`;
            if (empty) empty.style.display = count === 0 ? 'block' : 'none';
        };

        const addQ = (d = null) => {
            const div = document.createElement('div');
            div.className = 'card animate-fade';
            div.style = 'background:white; border: 1px solid var(--border); box-shadow: 0 4px 20px rgba(0,0,0,0.02); padding: 16px; border-radius: 16px; transition: all 0.3s ease; position:relative';

            div.innerHTML = `
                <div class="flex-between mb-3 q-header" style="cursor:pointer">
                    <div class="flex-gap">
                        <span class="q-number" style="background:var(--primary); color:white; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:0.75rem; font-weight:800">1</span>
                        <strong style="color:var(--text); font-size: 0.85rem;">Savol</strong>
                        <i data-lucide="chevron-down" class="toggle-icon" style="width:16px; transition: transform 0.3s ease;"></i>
                    </div>
                    <div class="flex-gap" style="background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 10px;">
                        <button type="button" class="btn-icon move-up" title="Yuqoriga" style="padding: 2px;"><i data-lucide="chevron-up" style="width:16px"></i></button>
                        <button type="button" class="btn-icon move-down" title="Pastga" style="padding: 2px;"><i data-lucide="chevron-down" style="width:16px"></i></button>
                        <div style="width:1px; height:12px; background:rgba(0,0,0,0.1); margin:0 4px"></div>
                        <button type="button" class="btn-icon text-danger del-q" style="padding: 2px;">
                            <i data-lucide="trash-2" style="width:16px"></i>
                        </button>
                    </div>
                </div>
                
                <div class="q-body animate-fade" style="transition: all 0.3s ease;">
                    <div class="input-group mb-3">
                        <textarea class="q-text cozy-input" required placeholder="Savol matnini bu yerga kiriting..." style="font-size: 0.9rem; min-height: 50px; padding: 12px; border-radius: 12px; font-weight: 700; line-height:1.4; border-color: rgba(67, 24, 255, 0.15); background: rgba(67, 24, 255, 0.01); resize:none">${d?.text || ''}</textarea>
                    </div>

                    <div class="grid grid-2 mb-3" style="gap:15px">
                        <div class="input-group">
                            <label class="small text-muted mb-1">Savol Turi</label>
                            <select class="q-type cozy-input" style="padding: 8px; font-size: 0.8rem; border-radius:10px">
                                <option value="single" ${d?.type === 'single' ? 'selected' : ''}>Yagona tanlov</option>
                                <option value="weighted" ${d?.type === 'weighted' ? 'selected' : ''}>Balli (Psixologik)</option>
                                <option value="text" ${d?.type === 'text' ? 'selected' : ''}>Ochiq javob (Text)</option>
                                <option value="date" ${d?.type === 'date' ? 'selected' : ''}>Sana (Date)</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label class="small text-muted mb-1">Qo'shimcha</label>
                            <button type="button" class="btn btn-sm btn-outline toggle-adv w-100" style="padding: 8px; border-radius: 10px; font-size:0.75rem">
                                <i data-lucide="settings" style="width:14px; margin-right:4px"></i> Sozlamalar
                            </button>
                        </div>
                    </div>

                    <div class="adv-fields animate-fade" style="display:${(d?.qComment || d?.image) ? 'block' : 'none'}; background: rgba(244, 247, 254, 0.8); padding: 15px; border-radius: 14px; margin-bottom: 15px; border: 1px dashed var(--primary-light)">
                        <div class="input-group mb-3">
                            <label class="small text-muted mb-1">Profil uchun izoh (Savol kategoriyasi)</label>
                            <input type="text" class="q-comment-label cozy-input" value="${d?.qComment || ''}" placeholder="Masalan: Oilaviy holati" style="font-size: 0.8rem; background:white">
                        </div>
                        <div class="input-group">
                            <label class="small text-muted mb-1">Rasm (Ixtiyoriy)</label>
                            <select class="q-image cozy-input" style="font-size:0.8rem; background:white">
                                <option value="">Rasm yo'q</option>
                                <option value="Picture1.png" ${d?.image === 'Picture1.png' ? 'selected' : ''}>Rasm 1</option>
                                <option value="Picture2.png" ${d?.image === 'Picture2.png' ? 'selected' : ''}>Rasm 2</option>
                            </select>
                        </div>
                        <div class="q-image-preview mt-3" style="${d?.image ? 'block' : 'none'}; text-align:center">
                            <img src="${d?.image || ''}" style="max-height: 100px; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm)">
                        </div>
                    </div>

                    <div class="opt-area" style="display: flex; flex-direction: column; gap: 8px;"></div>
                    
                    <div class="mt-3 flex-center">
                        <button type="button" class="btn btn-sm btn-outline add-opt" style="border-radius: 10px; padding: 6px 20px; font-size: 0.75rem; background:white; ${(d?.type === 'text' || d?.type === 'date') ? 'display:none' : ''}">
                            <i data-lucide="plus" style="width:14px; margin-right:4px"></i> Variant Qo'shish
                        </button>
                    </div>
                </div>
            `;

            qC.appendChild(div);
            if (window.lucide) window.lucide.createIcons();
            updateQCount();

            const qHeader = div.querySelector('.q-header');
            const qBody = div.querySelector('.q-body');
            const toggleIcon = div.querySelector('.toggle-icon');

            qHeader.onclick = (e) => {
                if (e.target.closest('.flex-gap:last-child')) return; // Don't toggle if buttons clicked
                const isCollapsed = qBody.style.display === 'none';
                qBody.style.display = isCollapsed ? 'block' : 'none';
                toggleIcon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
            };

            div.querySelector('.del-q').onclick = () => { div.remove(); updateNumbers(); updateQCount(); };

            const oA = div.querySelector('.opt-area');
            const qTypeSelect = div.querySelector('.q-type');
            const addOptBtn = div.querySelector('.add-opt');

            const addO = (od = null) => {
                const type = qTypeSelect.value;
                const odD = document.createElement('div');
                odD.className = 'animate-fade';
                odD.style = 'background: white; padding: 10px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.06); margin-bottom: 8px; box-shadow:0 2px 5px rgba(0,0,0,0.02)';

                odD.innerHTML = `
                    <div class="flex-gap mb-2">
                        <input type="text" class="o-text cozy-input" value="${od?.text || ''}" required placeholder="Javob varianti..." style="background:rgba(0,0,0,0.02); border-color:transparent; flex: 1; padding: 8px 12px; font-size: 0.8rem; border-radius:8px">
                        ${type === 'weighted' ? `<input type="number" class="o-points cozy-input" value="${od?.points || 0}" style="width:55px; text-align:center; padding: 8px; font-size: 0.8rem; border-radius:8px" title="Ball">` : ''}
                        <button type="button" class="btn-icon" onclick="this.parentElement.parentElement.remove()" style="color:var(--text-muted); padding: 4px; background:rgba(0,0,0,0.03); border-radius:8px"><i data-lucide="x" style="width:14px"></i></button>
                    </div>
                    <div class="profile-comment-area" style="padding-top: 6px; margin-top: 6px; border-top: 1px dashed rgba(0,0,0,0.05)">
                        <div class="flex-gap">
                            <i data-lucide="user-plus" style="width:14px; color:var(--success); opacity:0.6"></i>
                            <input type="text" class="o-comment cozy-input" value="${od?.profileComment || ''}" placeholder="Profil uchun izoh (Masalan: O'ziga ishongan)" style="font-size: 0.7rem; padding: 6px 10px; background: transparent; border-color: transparent;">
                        </div>
                    </div>
                `;
                oA.appendChild(odD);
                if (window.lucide) window.lucide.createIcons();
            };

            // Re-render options when type changes to maintain data
            const getOptionsData = () => Array.from(oA.querySelectorAll(':scope > div')).map(odD => ({
                text: odD.querySelector('.o-text').value,
                points: parseFloat(odD.querySelector('.o-points')?.value || 0),
                profileComment: odD.querySelector('.o-comment')?.value || ''
            }));

            // Type change logic
            qTypeSelect.onchange = () => {
                const type = qTypeSelect.value;
                if (type === 'text' || type === 'date') {
                    addOptBtn.style.display = 'none';
                    oA.innerHTML = '';
                } else {
                    addOptBtn.style.display = 'block';
                    if (oA.children.length === 0) addO();
                    else {
                        const currentOpts = getOptionsData();
                        oA.innerHTML = '';
                        currentOpts.forEach(o => addO(o));
                    }
                }
            };

            // Image select change logic
            div.querySelector('.q-image').onchange = (e) => {
                const preview = div.querySelector('.q-image-preview');
                const previewImg = preview.querySelector('img');
                if (e.target.value) {
                    previewImg.src = e.target.value;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            };

            // Reordering logic
            div.querySelector('.move-up').onclick = () => {
                const prev = div.previousElementSibling;
                if (prev) { qC.insertBefore(div, prev); updateNumbers(); }
            };
            div.querySelector('.move-down').onclick = () => {
                const next = div.nextElementSibling;
                if (next) { qC.insertBefore(next, div); updateNumbers(); }
            };

            // Toggle advanced fields
            div.querySelector('.toggle-adv').onclick = () => {
                const adv = div.querySelector('.adv-fields');
                adv.style.display = adv.style.display === 'none' ? 'block' : 'none';
            };

            div.querySelector('.add-opt').onclick = () => addO();
            if (d?.options) d.options.forEach(o => addO(o)); else if (d?.type !== 'text' && d?.type !== 'date') addO();
        };

        const updateNumbers = () => {
            qC.querySelectorAll(':scope > .card').forEach((c, i) => {
                c.querySelector('.q-number').innerText = i + 1;
            });
        };

        const addI = (d = null) => {
            const div = document.createElement('div'); div.className = 'animate-fade';
            div.style = 'background: linear-gradient(to right, rgba(67,24,255,0.02), rgba(67,24,255,0)); border: 1px dashed rgba(67,24,255,0.2); padding:15px; border-radius:14px; margin-bottom:12px';
            div.innerHTML = `
                <div class="flex-between mb-2">
                    <div class="flex-gap" style="background:white; padding:8px 15px; border-radius:12px; border:1px solid rgba(0,0,0,0.1); box-shadow: 0 2px 8px rgba(0,0,0,0.03)">
                        <span class="small font-weight-800 text-muted" style="margin-right:5px">BALL:</span>
                        <input type="number" class="i-min" value="${d?.min || 0}" placeholder="Min" style="width:65px; border:1px solid rgba(67,24,255,0.1); background:rgba(67,24,255,0.02); border-radius:8px; font-size:0.95rem; text-align:center; font-weight:800; color:var(--primary); padding:4px">
                        <span style="opacity:0.3; font-weight:800; margin:0 5px">-</span>
                        <input type="number" class="i-max" value="${d?.max || 10}" placeholder="Max" style="width:65px; border:1px solid rgba(67,24,255,0.1); background:rgba(67,24,255,0.02); border-radius:8px; font-size:0.95rem; text-align:center; font-weight:800; color:var(--primary); padding:4px">
                    </div>
                    <button type="button" class="btn-icon text-danger" onclick="this.closest('.animate-fade').remove()" style="background: rgba(255,91,91,0.1); border-radius:8px"><i data-lucide="trash-2" style="width:16px"></i></button>
                </div>
                <textarea class="i-text cozy-input" placeholder="Bu ball oraliģi uchun xulosa matnini kiriting..." style="font-size:0.85rem; min-height:60px; border-radius:10px; background:white; font-weight:600" required>${d?.text || ''}</textarea>
            `;
            iC.appendChild(div);
            if (window.lucide) window.lucide.createIcons();
        };

        if (existing?.questions) existing.questions.forEach(q => addQ(q)); else addQ();
        if (existing?.interpretations) existing.interpretations.forEach(i => addI(i)); else addI({ min: 0, max: 10, text: 'Normal' });

        document.getElementById('add-q').onclick = () => addQ();
        document.getElementById('add-i').onclick = () => addI();
        document.getElementById('btn-back').onclick = () => renderTab();
        document.getElementById('t-form').onsubmit = async (e) => {
            e.preventDefault();
            const qs = Array.from(qC.querySelectorAll(':scope > .card')).map(c => {
                const type = c.querySelector('.q-type').value;
                const options = (type === 'text' || type === 'date') ? [] :
                    Array.from(c.querySelectorAll('.opt-area > div')).map(o => ({
                        text: o.querySelector('.o-text').value,
                        points: parseFloat(o.querySelector('.o-points')?.value || 0),
                        profileComment: o.querySelector('.o-comment')?.value || ''
                    }));

                return {
                    text: c.querySelector('.q-text').value,
                    qComment: c.querySelector('.q-comment-label').value,
                    type: type,
                    image: c.querySelector('.q-image').value,
                    options: options
                };
            });

            const is = Array.from(iC.querySelectorAll(':scope > .animate-fade')).map(c => ({ min: parseFloat(c.querySelector('.i-min').value), max: parseFloat(c.querySelector('.i-max').value), text: c.querySelector('.i-text').value }));
            const isProfileData = document.getElementById('t-important').checked;
            const hideResults = document.getElementById('t-hide-res').checked;
            const p = {
                title: document.getElementById('t-title').value,
                description: document.getElementById('t-desc').value,
                timeLimit: parseInt(document.getElementById('t-time').value),
                questions: qs,
                interpretations: is,
                isProfileData,
                hideResults
            };
            if (existing) {
                await updateDoc(doc(db, "tests", existing.id), p);
                // Update testTitle in existing assignments
                if (existing.title !== p.title) {
                    const qA = query(collection(db, "assignments"), where("testId", "==", existing.id));
                    const snapA = await getDocs(qA);
                    for (const d of snapA.docs) {
                        await updateDoc(doc(db, "assignments", d.id), { testTitle: p.title });
                    }
                }
            } else {
                await addDoc(collection(db, "tests"), { ...p, createdAt: new Date() });
            }
            showToast("Test saqlandi", "success"); clearCache(); renderTab();
        };
    }

    async function renderMergedTestCreator(area, existing = null) {
        const tests = (await fetchData("tests")).filter(t => t.type !== 'merged');
        let selectedIds = existing?.testIds || [];

        const render = () => {
            area.innerHTML = `
                <div class="animate-fade" style="max-width: 800px; margin: 0 auto;">
                    <header class="flex-between mb-4 sticky-header" style="background: var(--surface); padding: 15px 20px; border-radius: 20px; box-shadow: var(--shadow); position: sticky; top: 10px; z-index: 100;">
                        <div class="flex-gap">
                            <div class="icon-circle primary" style="width:40px; height:40px"><i data-lucide="layers"></i></div>
                            <div>
                                <h2 style="font-size: 1.2rem; margin:0">${existing ? 'Birlashtirilgan testni tahrirlash' : 'Birlashtirilgan test yaratish'}</h2>
                                <p class="text-muted small" style="margin:0">Bir nechta testlarni bitta linkka birlashtiring</p>
                            </div>
                        </div>
                        <div class="flex-gap">
                            <button class="btn btn-outline btn-sm" id="btn-back"><i data-lucide="arrow-left"></i> Orqaga</button>
                            <button class="btn btn-primary btn-sm" id="btn-save-merged" style="box-shadow: 0 5px 15px rgba(67, 24, 255, 0.2)">
                                <i data-lucide="save"></i> Saqlash
                            </button>
                        </div>
                    </header>

                    <div class="grid grid-2" style="gap:20px; align-items: start;">
                        <div class="card p-3">
                            <h4 class="mb-3">Umumiy ma'lumot</h4>
                            <div class="input-group mb-3">
                                <label class="small">Birlashtirilgan Test Nomi</label>
                                <input type="text" id="mt-title" value="${existing?.title || ''}" placeholder="Masalan: Kompleks so'rovnoma">
                            </div>
                            <div class="input-group mb-3">
                                <label class="small">Testlarni tanlang</label>
                                <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius:12px; padding:10px; background:rgba(0,0,0,0.01)">
                                    ${tests.map(t => `
                                        <label class="flex-gap p-2 hover-card" style="cursor:pointer; border-bottom: 1px solid rgba(0,0,0,0.05); border-radius:8px">
                                            <input type="checkbox" class="t-select" value="${t.id}" ${selectedIds.includes(t.id) ? 'checked' : ''}>
                                            <span class="small">${t.title}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div class="card p-3">
                            <h4 class="mb-3">Testlar ketma-ketligi</h4>
                            <div id="mt-order-list" style="display:flex; flex-direction:column; gap:10px">
                                ${selectedIds.map((id, i) => {
                const t = tests.find(x => x.id === id);
                return `
                                        <div class="flex-between p-3" style="background:white; border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow-sm)">
                                            <span class="small"><strong>${i + 1}.</strong> ${t?.title}</span>
                                            <div class="flex-gap">
                                                <button class="btn-icon move-up-m" data-idx="${i}"><i data-lucide="chevron-up" style="width:16px"></i></button>
                                                <button class="btn-icon move-down-m" data-idx="${i}"><i data-lucide="chevron-down" style="width:16px"></i></button>
                                            </div>
                                        </div>`;
            }).join('') || '<div class="p-4 text-center text-muted small border-dashed">Hali testlar tanlanmagan</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();

            document.getElementById('btn-back').onclick = () => renderTab();

            area.querySelectorAll('.t-select').forEach(cb => {
                cb.onchange = () => {
                    if (cb.checked) { if (!selectedIds.includes(cb.value)) selectedIds.push(cb.value); }
                    else { selectedIds = selectedIds.filter(id => id !== cb.value); }
                    render();
                };
            });

            area.querySelectorAll('.move-up-m').forEach(b => {
                b.onclick = () => {
                    const idx = parseInt(b.dataset.idx);
                    if (idx > 0) {
                        const temp = selectedIds[idx];
                        selectedIds[idx] = selectedIds[idx - 1];
                        selectedIds[idx - 1] = temp;
                        render();
                    }
                };
            });

            area.querySelectorAll('.move-down-m').forEach(b => {
                b.onclick = () => {
                    const idx = parseInt(b.dataset.idx);
                    if (idx < selectedIds.length - 1) {
                        const temp = selectedIds[idx];
                        selectedIds[idx] = selectedIds[idx + 1];
                        selectedIds[idx + 1] = temp;
                        render();
                    }
                };
            });

            document.getElementById('btn-save-merged').onclick = async () => {
                const title = document.getElementById('mt-title').value;
                if (!title || selectedIds.length < 2) return showToast("Kamida 2 ta test tanlang va nom bering", "warning");

                const data = { title, type: 'merged', testIds: selectedIds };
                if (existing) await updateDoc(doc(db, "tests", existing.id), data);
                else await addDoc(collection(db, "tests"), { ...data, createdAt: serverTimestamp() });

                showToast("Muvaffaqiyatli saqlandi", "success");
                clearCache(); renderTab();
            };
        };

        render();
    }

    // --- STRUKTURA (GROUPS) TAB ---
    async function renderGroupsTab(area) {
        pageTitle.innerText = "Struktura";
        const groups = await fetchData("groups");
        if (currentSubView === 'main') {
            const facs = [...new Set(groups.map(g => g.faculty || 'Akademiya'))].sort();
            area.innerHTML = `
                <div class="flex-between mb-3">
                    <h2><i data-lucide="building"></i> Fakultetlar</h2>
                    <div class="flex-gap">
                        <button class="btn btn-outline" id="btn-import-students"><i data-lucide="upload"></i> CSV Import</button>
                        <button class="btn btn-primary" id="btn-add-fac">+ Fakultet</button>
                    </div>
                </div>
                <div class="grid grid-3">${facs.map(f => {
                const fGs = groups.filter(g => (g.faculty || 'Akademiya') === f);
                const sCount = fGs.reduce((acc, g) => acc + (g.students?.length || 0), 0);
                return `
                    <div class="card view-fac" data-fac="${f}" style="cursor:pointer; padding: 2.5rem;">
                        <div class="flex-between">
                            <div><h1 style="color:var(--primary); font-size:1.8rem; font-weight:800">${f}</h1><p class="text-muted mt-1">${fGs.length} guruh • ${sCount} talaba</p></div>
                            <div class="flex-gap" style="flex-direction:column; gap:10px">
                                <div class="icon-circle primary" style="width:60px; height:60px"><i data-lucide="building-2"></i></div>
                                <button class="btn-icon text-danger del-fac" data-fac="${f}"><i data-lucide="trash-2"></i></button>
                            </div>
                        </div>
                    </div>`;
            }).join('')}</div>`;

            document.getElementById('btn-import-students').onclick = () => {
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const text = event.target.result;
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                        if (lines.length < 2) return;

                        // Faculty,Direction,Course,Group,StudentName
                        const data = lines.slice(1).map(line => {
                            const values = line.split(',').map(v => v.trim());
                            if (values.length < 5) return null;
                            return {
                                faculty: values[0],
                                direction: values[1],
                                course: values[2],
                                group: values[3],
                                student: values[4]
                            };
                        }).filter(d => d);

                        // Group by unique combination of Faculty, Direction, Course, Group
                        const groupsMap = {};
                        data.forEach(item => {
                            const uniqueKey = `${item.faculty}|${item.direction}|${item.course}|${item.group}`;
                            if (!groupsMap[uniqueKey]) {
                                groupsMap[uniqueKey] = {
                                    faculty: item.faculty,
                                    direction: item.direction,
                                    course: parseInt(item.course) || 1,
                                    name: item.group,
                                    students: []
                                };
                            }
                            groupsMap[uniqueKey].students.push({ name: item.student, completedTests: [] });
                        });

                        const groupKeys = Object.keys(groupsMap);
                        const total = groupKeys.length;
                        const progressToast = showToast(`0/${total} guruh yuklanmoqda...`, "info", Infinity);

                        let count = 0;
                        for (const gKey of groupKeys) {
                            await addDoc(collection(db, "groups"), groupsMap[gKey]);
                            count++;
                            progressToast.update(`${count}/${total} guruh yuklanmoqda...`);
                        }

                        progressToast.close();
                        showToast("Ma'lumotlar muvaffaqiyatli import qilindi!", "success");
                        clearCache(); renderTab();
                    };
                    reader.readAsText(file);
                };
                input.click();
            };
            area.querySelectorAll('.view-fac').forEach(c => {
                c.onclick = (e) => {
                    if (e.target.closest('.del-fac')) return;
                    currentSubView = 'faculty'; subViewParams.faculty = c.dataset.fac; renderTab();
                };
            });

            area.querySelectorAll('.del-fac').forEach(b => {
                b.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`"${b.dataset.fac}" fakultetini va uning barcha guruhlarini o'chirishni xohlaysizmi?`)) return;
                    const fGroups = groups.filter(g => (g.faculty || 'Akademiya') === b.dataset.fac);
                    const total = fGroups.length;
                    const progressToast = showToast(`0/${total} guruh o'chirilmoqda...`, "info", Infinity);
                    let count = 0;
                    for (const g of fGroups) {
                        await deleteDoc(doc(db, "groups", g.id));
                        count++;
                        progressToast.update(`${count}/${total} guruh o'chirilmoqda...`);
                    }
                    progressToast.close();
                    showToast("Fakultet o'chirildi", "success"); clearCache(); renderTab();
                };
            });
            document.getElementById('btn-add-fac').onclick = () => showModal('Yangi Fakultet', '<input type="text" id="n-f" placeholder="Nomi...">', async (m) => { const v = m.querySelector('#n-f').value; if (v) { await addDoc(collection(db, "groups"), { faculty: v, direction: 'Yangi Yo\'nalish', course: 1, name: 'Yangi Guruh', students: [] }); clearCache(); renderTab(); } return true; });
        } else if (currentSubView === 'faculty') {
            const fac = subViewParams.faculty;
            const courses = [1, 2, 3, 4];
            area.innerHTML = `
                <div class="flex-between mb-3">
                    <button class="btn btn-icon btn-outline" id="btn-back"><i data-lucide="arrow-left"></i></button>
                    <h2>${fac} Kurslari</h2>
                </div>
                <div class="grid grid-4">${courses.map(c => {
                const cGs = groups.filter(g => (g.faculty || 'Akademiya') === fac && parseInt(g.course) === c);
                const sCount = cGs.reduce((acc, g) => acc + (g.students?.length || 0), 0);
                return `
                    <div class="card view-course" data-course="${c}" style="cursor:pointer; padding:2rem; text-align:center">
                        <h1 style="color:var(--primary); font-size:3rem; font-weight:800">${c}</h1>
                        <p class="text-muted">KURS</p>
                        <div class="badge badge-info mt-2">${cGs.length} guruh • ${sCount} talaba</div>
                    </div>`;
            }).join('')}</div>`;

            document.getElementById('btn-back').onclick = () => { currentSubView = 'main'; renderTab(); };
            area.querySelectorAll('.view-course').forEach(c => c.onclick = () => { currentSubView = 'course'; subViewParams.course = parseInt(c.dataset.course); renderTab(); });

        } else if (currentSubView === 'course') {
            const { faculty, course } = subViewParams;
            const dirs = [...new Set(groups.filter(g => (g.faculty || 'Akademiya') === faculty && parseInt(g.course) === course).map(g => g.direction || 'Yo\'nalishsiz'))].sort();
            area.innerHTML = `
                <div class="flex-between mb-3">
                    <button class="btn btn-icon btn-outline" id="btn-back"><i data-lucide="arrow-left"></i></button>
                    <h2>${faculty} • ${course}-kurs Yo'nalishlari</h2>
                    <button class="btn btn-primary" id="btn-add-dir">+ Yo'nalish</button>
                </div>
                <div class="grid grid-3">${dirs.map(d => {
                const dGs = groups.filter(g => (g.faculty || 'Akademiya') === faculty && parseInt(g.course) === course && g.direction === d);
                const sCount = dGs.reduce((acc, g) => acc + (g.students?.length || 0), 0);
                return `
                    <div class="card view-dir" data-dir="${d}" style="cursor:pointer; padding:2rem">
                        <div class="flex-between">
                            <div><h3>${d}</h3><p class="text-muted small">${dGs.length} guruh • ${sCount} talaba</p></div>
                            <button class="btn-icon text-danger del-dir" data-dir="${d}"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>`;
            }).join('')}</div>`;

            document.getElementById('btn-back').onclick = () => { currentSubView = 'faculty'; renderTab(); };
            area.querySelectorAll('.view-dir').forEach(c => {
                c.onclick = (e) => {
                    if (e.target.closest('.del-dir')) return;
                    currentSubView = 'direction'; subViewParams.direction = c.dataset.dir; renderTab();
                };
            });

            area.querySelectorAll('.del-dir').forEach(b => {
                b.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`"${b.dataset.dir}" yo'nalishini barcha guruhlari bilan o'chirishni xohlaysizmi?`)) return;
                    const dGroups = groups.filter(g => (g.faculty || 'Akademiya') === faculty && parseInt(g.course) === course && g.direction === b.dataset.dir);
                    const total = dGroups.length;
                    const progressToast = showToast(`0/${total} guruh o'chirilmoqda...`, "info", Infinity);
                    let count = 0;
                    for (const g of dGroups) {
                        await deleteDoc(doc(db, "groups", g.id));
                        count++;
                        progressToast.update(`${count}/${total} guruh o'chirilmoqda...`);
                    }
                    progressToast.close();
                    showToast("Yo'nalish o'chirildi", "success"); clearCache(); renderTab();
                };
            });
            document.getElementById('btn-add-dir').onclick = () => showModal('Yangi Yo\'nalish', '<input type="text" id="n-d" placeholder="Nomi...">', async (m) => { const v = m.querySelector('#n-d').value; if (v) { await addDoc(collection(db, "groups"), { faculty, course, direction: v, name: 'Yangi Guruh', students: [] }); clearCache(); renderTab(); } return true; });

        } else if (currentSubView === 'direction') {
            const { faculty, course, direction } = subViewParams;
            const dGs = groups.filter(g => (g.faculty || 'Akademiya') === faculty && parseInt(g.course) === course && (g.direction || 'Yo\'nalishsiz') === direction);
            area.innerHTML = `
                <div class="flex-between mb-3">
                    <button class="btn btn-icon btn-outline" id="btn-back"><i data-lucide="arrow-left"></i></button>
                    <h2>${direction} Guruhlari (${course}-kurs)</h2>
                    <button class="btn btn-primary" id="btn-add-group">+ Guruh</button>
                </div>
                <div class="grid grid-3">${dGs.map(g => `
                    <div class="card view-group" data-id="${g.id}" style="cursor:pointer; padding:2rem">
                        <div class="flex-between">
                            <div><h3>${g.name}</h3><p class="text-muted small">${g.students?.length || 0} talaba</p></div>
                            <button class="btn-icon text-danger del-group" data-id="${g.id}"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>`).join('')}</div>`;

            document.getElementById('btn-back').onclick = () => { currentSubView = 'course'; renderTab(); };
            area.querySelectorAll('.view-group').forEach(c => {
                c.onclick = (e) => {
                    if (e.target.closest('.del-group')) return;
                    currentSubView = 'students_list'; subViewParams.groupId = c.dataset.id; renderTab();
                };
            });

            area.querySelectorAll('.del-group').forEach(b => {
                b.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Guruhni o'chirishni xohlaysizmi?`)) return;
                    await deleteDoc(doc(db, "groups", b.dataset.id));
                    showToast("Guruh o'chirildi", "success"); clearCache(); renderTab();
                };
            });
            document.getElementById('btn-add-group').onclick = () => showModal('Yangi Guruh', '<input type="text" id="n-g" placeholder="Nomi...">', async (m) => { const v = m.querySelector('#n-g').value; if (v) { await addDoc(collection(db, "groups"), { faculty, course, direction, name: v, students: [] }); clearCache(); renderTab(); } return true; });

        } else if (currentSubView === 'students_list') {
            const g = groups.find(gr => gr.id === subViewParams.groupId);
            if (!g) {
                area.innerHTML = `<div class="card p-5 text-center"><i data-lucide="alert-circle" class="text-danger mb-2"></i><p>Guruh topilmadi. Ma'lumotlar bazasi o'zgargan bo'lishi mumkin.</p><button class="btn btn-primary mt-3" onclick="location.reload()">Yangilash</button></div>`;
                if (window.lucide) window.lucide.createIcons();
                return;
            }
            let displayLimit = 6;
            let searchQuery = "";

            const renderList = () => {
                const filtered = (g.students || []).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
                const visible = filtered.slice(0, displayLimit);

                area.innerHTML = `
                    <div class="flex-between mb-4">
                        <div class="flex-gap">
                            <button class="btn btn-icon btn-outline" id="btn-back"><i data-lucide="arrow-left"></i></button>
                            <div><h2>${g.name}</h2><p class="text-muted small">${g.faculty} • ${g.direction} • ${g.course}-kurs</p></div>
                        </div>
                        <div class="flex-gap">
                            <div class="card p-2 flex-gap" style="padding: 8px 15px !important; border-radius: 12px">
                                <i data-lucide="search" style="width:16px; opacity:0.5"></i>
                                <input type="text" id="st-search" placeholder="Qidirish..." value="${searchQuery}" style="border:none; background:transparent; outline:none; font-size:0.9rem; width:150px">
                            </div>
                            <button class="btn btn-primary" id="btn-add-student">+ Talaba</button>
                        </div>
                    </div>
                    <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">${visible.map((s, idx) => `
                        <div class="card animate-fade" style="padding:1.2rem; min-width: 0;">
                            <div class="flex-between">
                                <div class="flex-gap v-prof" data-name="${s.name}" data-gid="${g.id}" style="cursor:pointer; overflow:hidden; flex: 1;">
                                    <div class="icon-circle primary" style="width:40px; height:40px; flex-shrink: 0;"><i data-lucide="user"></i></div>
                                    <div style="overflow:hidden; flex: 1;"><h3 style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; font-size:0.95rem; font-weight:700" title="${s.name}">${s.name}</h3><p class="text-muted small">Talaba</p></div>
                                </div>
                                <button class="btn-icon text-danger del-student" data-idx="${idx}" style="flex-shrink: 0;"><i data-lucide="trash-2" style="width:18px"></i></button>
                            </div>
                        </div>`).join('')}
                    </div>
                    ${filtered.length > displayLimit ? `<div class="text-center mt-4"><button class="btn btn-outline mx-auto" id="btn-load-more">Yana ko'rsatish (${filtered.length - displayLimit})</button></div>` : ''}
                `;

                if (window.lucide) window.lucide.createIcons();

                document.getElementById('btn-back').onclick = () => { currentSubView = 'direction'; renderTab(); };
                document.getElementById('st-search').oninput = (e) => { searchQuery = e.target.value; renderList(); document.getElementById('st-search').focus(); };
                if (document.getElementById('btn-load-more')) {
                    document.getElementById('btn-load-more').onclick = () => { displayLimit += 12; renderList(); };
                }

                area.querySelectorAll('.v-prof').forEach(b => b.onclick = () => openStudentProfile(b.dataset.name, b.dataset.gid));
                area.querySelectorAll('.del-student').forEach(b => {
                    b.onclick = async () => {
                        if (!confirm("Talabani o'chirishni xohlaysizmi?")) return;
                        const idx = parseInt(b.dataset.idx);
                        const newStudents = [...g.students];
                        newStudents.splice(idx, 1);
                        await updateDoc(doc(db, "groups", g.id), { students: newStudents });
                        showToast("Talaba o'chirildi", "success"); clearCache(); renderTab();
                    };
                });
                document.getElementById('btn-add-student').onclick = () => showModal('Guruhga Talabalarni Qo\'shish', '<p class="small text-muted mb-2">Har bir talaba ismini yangi qatordan yozing:</p><textarea id="n-s-bulk" class="cozy-input" placeholder="Ismoilov Ali\nKarimova Gulnoza..." style="height:200px"></textarea>', async (m) => {
                    const val = m.querySelector('#n-s-bulk').value;
                    if (val) {
                        const newNames = val.split('\n').map(n => n.trim()).filter(n => n);
                        const studentsToAdd = newNames.map(n => ({ name: n, completedTests: [] }));
                        await updateDoc(doc(db, "groups", g.id), { students: [...(g.students || []), ...studentsToAdd] });
                        clearCache(); renderTab();
                    }
                    return true;
                });
            };
            renderList();
        }
    }

    // --- TUTORS TAB ---
    async function renderTyutorsTab(area) {
        pageTitle.innerText = "Tyutorlar";
        const gs = await fetchData("groups");
        const tutors = [...new Set(gs.map(g => g.tutor))].filter(t => t).sort();

        area.innerHTML = `
            <div class="flex-between mb-4">
                <h2>Barcha Tyutorlar</h2>
                <button class="btn btn-primary" id="btn-add-tutor">+ Yangi Tyutor</button>
            </div>
            <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                ${tutors.map(t => {
            const tGs = gs.filter(g => g.tutor === t);
            return `
                    <div class="card animate-fade" style="padding: 1.5rem;">
                        <div class="flex-between">
                            <div class="flex-gap">
                                <div class="icon-circle secondary" style="width:50px; height:50px"><i data-lucide="shield-check"></i></div>
                                <div>
                                    <h3 style="font-weight:800">${t}</h3>
                                    <p class="text-muted small">${tGs.length} ta guruh</p>
                                </div>
                            </div>
                            <div class="flex-gap">
                                <button class="btn-icon text-primary edit-tutor" data-name="${t}"><i data-lucide="edit-3" style="width:18px"></i></button>
                                <button class="btn-icon text-danger del-tutor" data-name="${t}"><i data-lucide="trash-2" style="width:18px"></i></button>
                            </div>
                        </div>
                    </div>`;
        }).join('')}
            </div>
        `;

        const renderTyutorModal = (existingTyutor = null) => {
            const oldName = existingTutor || '';
            const selectableGs = gs.filter(g => !g.tutor || g.tutor === oldName).sort((x, y) => x.name.localeCompare(y.name));
            const faculties = [...new Set(gs.map(g => g.faculty || 'Akademiya'))].sort();
            const courses = [1, 2, 3, 4];

            // Persistent state for selections
            let currentSelectedIds = new Set(selectableGs.filter(g => g.tutor === oldName).map(g => g.id));
            const initialSelectedIds = new Set(currentSelectedIds);

            const html = `
                <div class="input-group mb-3"><label>Tyutor ismi</label><input type="text" id="tm-n" value="${oldName}" placeholder="Tyutor ismi..."></div>
                
                <div class="flex-between mb-2">
                    <label style="font-weight:700">Guruhlarni biriktirish (Tanlangan: <span id="tm-count">${currentSelectedIds.size}</span>):</label>
                </div>

                <div class="grid grid-3 mb-3" style="gap:10px">
                    <div class="input-group">
                        <select id="tm-fac" style="font-size:0.8rem; padding:8px"><option value="all">Fakultet (Hammasi)</option>${faculties.map(f => `<option value="${f}">${f}</option>`).join('')}</select>
                    </div>
                    <div class="input-group">
                        <select id="tm-course" style="font-size:0.8rem; padding:8px"><option value="all">Kurs (Hammasi)</option>${courses.map(c => `<option value="${c}">${c}-kurs</option>`).join('')}</select>
                    </div>
                    <div class="input-group">
                        <input type="text" id="tm-search" placeholder="Qidirish..." style="font-size:0.8rem; padding:8px">
                    </div>
                </div>

                <div id="tm-list-container" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius:15px; padding:10px; background:rgba(0,0,0,0.01)">
                    <div id="tm-list" class="grid grid-2" style="gap:8px"></div>
                </div>
            `;

            const modal = showModal(existingTyutor ? 'Tyutorni tahrirlash' : 'Yangi Tyutor', html, async (m) => {
                const newName = m.querySelector('#tm-n').value;
                if (!newName) { showToast("Tyutor ismini kiriting", "warning"); return false; }

                // 1. Assign selected groups
                for (const id of currentSelectedIds) {
                    await updateDoc(doc(db, "groups", id), { tutor: newName });
                }

                // 2. Remove from groups that were deselected
                if (existingTutor) {
                    for (const id of initialSelectedIds) {
                        if (!currentSelectedIds.has(id)) {
                            await updateDoc(doc(db, "groups", id), { tutor: "" });
                        }
                    }
                }

                showToast("Muvaffaqiyatli saqlandi", "success");
                clearCache(); renderTab();
                return true;
            }, "Saqlash");

            const listArea = modal.querySelector('#tm-list');
            const fSearch = modal.querySelector('#tm-search');
            const fFac = modal.querySelector('#tm-fac');
            const fCourse = modal.querySelector('#tm-course');
            const countLabel = modal.querySelector('#tm-count');

            const updateList = () => {
                const q = fSearch.value.toLowerCase();
                const fac = fFac.value;
                const crs = fCourse.value;

                const filtered = selectableGs.filter(g => {
                    const nameMatch = g.name.toLowerCase().includes(q);
                    const facMatch = fac === 'all' || (g.faculty || 'Akademiya') === fac;
                    const crsMatch = crs === 'all' || String(g.course) === crs;
                    return nameMatch && facMatch && crsMatch;
                });

                listArea.innerHTML = filtered.map(g => `
                    <label class="flex-gap p-2 hover-card" style="cursor:pointer; border-radius:10px; border: 1px solid rgba(0,0,0,0.03); background: white">
                        <input type="checkbox" class="et-g" value="${g.id}" ${currentSelectedIds.has(g.id) ? 'checked' : ''} style="width:16px; height:16px">
                        <div style="font-size:0.8rem"><strong>${g.name}</strong> <p class="text-muted small" style="margin:0">${g.course}-kurs • ${g.faculty || '---'}</p></div>
                    </label>
                `).join('') || '<p class="text-muted small p-2" style="grid-column: 1/-1">Guruhlar topilmadi</p>';

                // Attach individual listeners to checkboxes
                listArea.querySelectorAll('.et-g').forEach(cb => {
                    cb.onchange = (e) => {
                        if (e.target.checked) currentSelectedIds.add(e.target.value);
                        else currentSelectedIds.delete(e.target.value);
                        countLabel.innerText = currentSelectedIds.size;
                    };
                });
            };

            fSearch.oninput = updateList;
            fFac.onchange = updateList;
            fCourse.onchange = updateList;
            updateList();
        };

        document.getElementById('btn-add-tutor').onclick = () => renderTyutorModal();

        area.querySelectorAll('.del-tutor').forEach(b => {
            b.onclick = async () => {
                if (!confirm(`"${b.dataset.name}" tyutorni o'chirmoqchimisiz? Guruhlar tyutorsiz qoladi.`)) return;
                const affected = gs.filter(g => g.tutor === b.dataset.name);
                for (const g of affected) await updateDoc(doc(db, "groups", g.id), { tutor: "" });
                showToast("Tyutor o'chirildi", "success"); clearCache(); renderTab();
            };
        });

        area.querySelectorAll('.edit-tutor').forEach(b => {
            b.onclick = () => renderTyutorModal(b.dataset.name);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    // --- STUDENTS TAB ---
    async function renderStudentsTab(area) {
        pageTitle.innerText = "Talabalar Ro'yxati";
        const groups = await fetchData("groups");
        area.innerHTML = `
            <div class="card mb-4 animate-fade">
                <div class="flex-gap">
                    <i data-lucide="search" class="text-muted"></i>
                    <input type="text" id="s-search" placeholder="Talaba ismi yoki guruh bo'yicha qidiruv..." style="width:100%; border:none; background:transparent; font-size:1.1rem; font-weight:600; outline:none">
                </div>
            </div>
            <div id="s-results" class="grid grid-2 animate-fade"></div>
        `;

        let displayLimit = 10;
        let searchQuery = "";

        const show = (q = '') => {
            const ql = q.toLowerCase(); const list = [];
            groups.forEach(g => (g.students || []).forEach(s => {
                if (s.name.toLowerCase().includes(ql) || g.name.toLowerCase().includes(ql)) {
                    list.push({ ...s, gid: g.id, gname: g.name, course: g.course, fac: g.faculty || 'Akademiya' });
                }
            }));

            const resultsArea = document.getElementById('s-results');
            const filtered = list;
            const visible = filtered.slice(0, displayLimit);

            resultsArea.innerHTML = visible.map(r => `
                <div class="card v-prof-search hover-card" data-name="${r.name}" data-gid="${r.gid}" style="cursor:pointer; padding: 1.2rem; border: 1px solid rgba(0,0,0,0.05)">
                    <div class="flex-between">
                        <div class="flex-gap">
                            <div class="icon-circle primary" style="width:45px; height:45px; background: rgba(67, 24, 255, 0.08); color: var(--primary)">
                                <i data-lucide="user"></i>
                            </div>
                            <div>
                                <h3 style="font-weight:800; font-size:1.1rem; margin-bottom: 2px">${r.name}</h3>
                                <p class="text-muted small" style="font-weight:600">${r.gname} (${r.course}-kurs) • ${r.fac}</p>
                            </div>
                        </div>
                        <div class="icon-circle secondary" style="width:35px; height:35px; background: rgba(67, 24, 255, 0.04)">
                            <i data-lucide="chevron-right" style="width:16px"></i>
                        </div>
                    </div>
                </div>`).join('');

            if (filtered.length > displayLimit) {
                const loadBtn = document.createElement('div');
                loadBtn.className = 'text-center mt-4 w-100';
                loadBtn.style.gridColumn = '1 / -1';
                loadBtn.innerHTML = `<button class="btn btn-outline">Yana ko'rsatish (${filtered.length - displayLimit})</button>`;
                loadBtn.onclick = () => { displayLimit += 50; show(q); };
                resultsArea.appendChild(loadBtn);
            }

            resultsArea.querySelectorAll('.v-prof-search').forEach(c => {
                c.onclick = () => openStudentProfile(c.dataset.name, c.dataset.gid);
            });

            if (window.lucide) window.lucide.createIcons();
        };

        document.getElementById('s-search').oninput = (e) => { displayLimit = 10; show(e.target.value); };
        show();
    }

    // --- ASSIGN TAB ---
    async function renderAssignTab(area) {
        pageTitle.innerText = "Biriktirish (Havolalar)";
        const [tests, assigns, groups] = await Promise.all([fetchData("tests"), fetchData("assignments"), fetchData("groups")]);

        const facs = [...new Set(groups.map(g => g.faculty || 'Akademiya'))].sort();

        area.innerHTML = `
            <div class="card mb-4 animate-fade">
                <div class="grid grid-2 mb-4" style="gap:20px">
                    <div class="input-group">
                        <label>Testni tanlang</label>
                        <select id="a-test" style="font-weight:700; color:var(--primary)">
                            ${tests.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-2">
                        <div class="input-group"><label>Fakultet</label><select id="a-fac-filter"><option value="all">Barchasi</option>${facs.map(f => `<option value="${f}">${f}</option>`).join('')}</select></div>
                        <div class="input-group"><label>Kurs</label><select id="a-course-filter"><option value="all">Barchasi</option><option value="1">1-kurs</option><option value="2">2-kurs</option><option value="3">3-kurs</option><option value="4">4-kurs</option></select></div>
                    </div>
                </div>
                
                <div class="flex-between mb-2">
                    <label style="font-weight:700">Guruhlarni tanlang:</label>
                    <div class="flex-gap">
                        <button class="btn btn-sm btn-outline" id="btn-sel-all">Barchasini tanlash</button>
                        <button class="btn btn-sm btn-outline" id="btn-sel-rem">Topshirmaganlarni tanlash</button>
                    </div>
                </div>
                
                <div id="g-list-container" style="max-height: 280px; overflow-y: auto; border: 1px solid rgba(0,0,0,0.05); border-radius:15px; padding:15px; background:rgba(0,0,0,0.02)">
                    <div id="g-list" class="grid grid-3" style="gap:10px"></div>
                </div>
                
                <div class="mt-4">
                    <button class="btn btn-primary w-100" id="btn-create-links" style="padding:15px; font-size:1.1rem"><i data-lucide="link"></i> Havolalarni Yaratish</button>
                </div>
            </div>
            
            <div class="flex-between mb-4">
                <h2>Biriktirilgan Testlar</h2>
                <button class="btn btn-danger btn-sm" id="btn-bulk-del" style="display:none"><i data-lucide="trash-2"></i> Tanlanganlarni o'chirish</button>
            </div>
            <div id="assign-list-area"></div>
        `;

        const gListArea = document.getElementById('g-list');
        const aTest = document.getElementById('a-test');
        const aFac = document.getElementById('a-fac-filter');
        const aCourse = document.getElementById('a-course-filter');

        const renderGroupList = () => {
            const f = aFac.value;
            const c = aCourse.value;
            const tId = aTest.value;

            const filtered = groups.filter(g => {
                const facMatch = f === 'all' || (g.faculty || 'Akademiya') === f;
                const courseMatch = c === 'all' || parseInt(g.course) === parseInt(c);
                return facMatch && courseMatch;
            }).sort((a, b) => a.name.localeCompare(b.name));

            gListArea.innerHTML = filtered.map(g => {
                const isAssigned = assigns.find(a => a.testId === tId && a.groupId === g.id);
                return `
                    <label class="flex-gap p-2 hover-card" style="cursor:pointer; border-radius:10px; opacity:${isAssigned ? '0.6' : '1'}; border: 1px solid rgba(0,0,0,0.03)">
                        <input type="checkbox" class="g-check" value="${g.id}" ${isAssigned ? 'disabled' : ''} style="width:18px; height:18px">
                        <div style="font-size:0.85rem">
                            <strong>${g.name}</strong> 
                            <span class="text-muted">(${g.course}-kurs)</span>
                            ${isAssigned ? '<br><span class="badge badge-success" style="font-size:0.6rem; padding:2px 5px">Biriktirilgan</span>' : ''}
                        </div>
                    </label>
                `;
            }).join('') || '<div class="p-3 text-center" style="grid-column: 1/-1"><p class="text-muted">Guruhlar topilmadi</p></div>';
        };

        renderGroupList();

        aFac.onchange = renderGroupList;
        aCourse.onchange = renderGroupList;
        aTest.onchange = renderGroupList;

        document.getElementById('btn-sel-all').onclick = () => {
            area.querySelectorAll('.g-check:not([disabled])').forEach(cb => cb.checked = true);
        };

        document.getElementById('btn-sel-rem').onclick = () => {
            area.querySelectorAll('.g-check:not([disabled])').forEach(cb => cb.checked = true);
        };

        const renderAssigns = () => {
            const listArea = document.getElementById('assign-list-area');
            let baseUrl = window.location.origin + window.location.pathname;

            listArea.innerHTML = tests.map(test => {
                const tAs = assigns.filter(a => a.testId === test.id);
                if (!tAs.length) return '';
                return `<div class="card mb-3 animate-fade">
                    <div class="flex-between mb-3">
                        <div class="flex-gap">
                            <input type="checkbox" class="select-all-test" data-tid="${test.id}" style="width:18px; height:18px">
                            <div class="icon-circle primary" style="width:35px; height:35px"><i data-lucide="clipboard-list"></i></div>
                            <h3>${test.title}</h3>
                        </div>
                        <div class="flex-gap">
                            <button class="btn btn-sm btn-outline copy-by-tutor" data-tid="${test.id}"><i data-lucide="users"></i> Tutorlar bo'yicha</button>
                            <span class="badge badge-info">${tAs.length} ta guruh</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:40px">#</th>
                                    <th>Guruh / Tutor</th>
                                    <th>Holati</th>
                                    <th>Kirish Havolasi</th>
                                    <th class="text-center">Amal</th>
                                </tr>
                            </thead>
                            <tbody>${tAs.map(a => {
                    const g = groups.find(gx => gx.id === a.groupId);
                    const l = `${baseUrl}#test/${a.token}`;
                    return `<tr>
                                    <td><input type="checkbox" class="sel-a" data-id="${a.id}"></td>
                                    <td><strong>${g?.name} (${g?.course}-kurs)</strong><p class="text-muted small">${g?.tutor || 'Tyutorsiz'}</p></td>
                                    <td><label class="switch"><input type="checkbox" class="tog-a" data-id="${a.id}" ${a.active ? 'checked' : ''}><span class="slider round"></span></label></td>
                                    <td><div class="flex-gap"><code style="background:var(--primary-light); padding:4px 8px; border-radius:8px; color:var(--primary); font-size:0.8rem">${l.replace(/^https?:\/\//, '')}</code><button class="btn btn-sm btn-icon c-link" data-link="${l.replace(/^https?:\/\//, '')}"><i data-lucide="copy" style="width:14px"></i></button></div></td>
                                    <td class="text-center">
                                        <div class="flex-gap" style="justify-content:center">
                                            <button class="btn-icon text-primary upgrade-a" data-id="${a.id}" title="Yangilash (Upgrade)"><i data-lucide="zap" style="width:16px"></i></button>
                                            <button class="btn-icon text-warning restart-a" data-id="${a.id}" title="Qayta boshlash"><i data-lucide="refresh-cw" style="width:16px"></i></button>
                                            <button class="btn-icon text-danger del-a" data-id="${a.id}"><i data-lucide="trash-2" style="width:16px"></i></button>
                                        </div>
                                    </td>
                                </tr>`
                }).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
            }).join('');

            area.querySelectorAll('.c-link').forEach(b => b.onclick = () => { navigator.clipboard.writeText(b.dataset.link); showToast("Havola nusxalandi", "success"); });

            area.querySelectorAll('.copy-by-tutor').forEach(b => b.onclick = () => {
                const tId = b.dataset.tid;
                const test = tests.find(t => t.id === tId);
                const tAs = assigns.filter(a => a.testId === tId);

                // Group by tyutor
                const tyutorGroups = {};
                tAs.forEach(a => {
                    const g = groups.find(gx => gx.id === a.groupId);
                    const tyutorName = g?.tutor || 'Tyutorsiz';
                    if (!tyutorGroups[tyutorName]) tyutorGroups[tyutorName] = [];
                    tyutorGroups[tyutorName].push({
                        groupName: g?.name,
                        link: `${baseUrl}#test/${a.token}`,
                        faculty: g?.faculty || 'IIXM',
                        course: g?.course || '---'
                    });
                });

                const tyutors = Object.keys(tyutorGroups).sort();

                const html = `
                    <div class="flex-between mb-3" style="padding: 0 5px;">
                        <h4 style="margin:0; opacity:0.7">Hamma tyutorlar uchun</h4>
                        <button class="btn btn-primary" id="copy-all-tutors-bulk" style="box-shadow: 0 5px 15px rgba(67, 24, 255, 0.2)">
                            <i data-lucide="copy" style="width:16px"></i> Barchasini bittada nusxalash
                        </button>
                    </div>
                    <div class="tutor-links-list">
                        ${tyutors.map(tName => `
                            <div class="card mb-3 p-3" style="border: 1px solid rgba(0,0,0,0.05)">
                                <div class="flex-between mb-2">
                                    <h4 style="margin:0">${tName}</h4>
                                    <button class="btn btn-sm btn-primary copy-tutor-all" data-tutor="${tName}">Barchasini nusxalash</button>
                                </div>
                                <div class="small text-muted">
                                    ${tyutorGroups[tName].map(tg => `<div>• ${tg.groupName}: ${tg.link.replace(/^https?:\/\//, '')}</div>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;

                const modal = showModal(`${test.title} - Tyutorlar bo'yicha`, html, (m) => {
                    return true; // Close on Yopish click
                }, "Yopish");

                const buildMessage = (tName, tLinks) => {
                    const fac = tLinks[0]?.faculty || '---';
                    const groupsContent = tLinks.map(tg => `🎓 Kurs: ${tg.course}\n👥 Guruh: ${tg.groupName}\n🌐 LINK: ${tg.link.replace(/^https?:\/\//, '')}`).join('\n\n');

                    const message = `📣📣 DIQQAT SO'ROVNOMA !!! 🔈🔈

#IIAU #SO'ROVNOMA

✔️O'zbekiston xalqaro islomshunoslik akademiyasi talabalari uchun "Psixologik so'rovnoma" o'tkazilmoqda. ❗️
👨‍🏫Hurmatli tyutor ${tName}, talabalaringizni bu so'rovnomada faol ishtirok etishini taminlashingizni so'raymiz.

Eslatma: Har bir guruh uchun alohida maxsus link berilgan bo'lib, siz bu havolalarni berilgan guruhlargagina tarqatishingiz va ular orqali siz ham kimlar ishtirok etmaganini ko'rishingiz mumkin!

🏛 Fakultet: ${fac}

${groupsContent}

💡 Faol bo'ling, har bir talabaning har bir javobi biz uchun juda muhim!
📲 Murojaat uchun: @ZAYNAB8888`;
                    return "`" + message + "`";
                };

                modal.querySelectorAll('.copy-tutor-all').forEach(btn => {
                    btn.onclick = () => {
                        const tName = btn.dataset.tutor;
                        const tLinks = tyutorGroups[tName];
                        navigator.clipboard.writeText(buildMessage(tName, tLinks));
                        showToast(`${tName} uchun havolalar nusxalandi`, "success");
                    };
                });

                modal.querySelector('#copy-all-tutors-bulk').onclick = () => {
                    let fullMessage = "";
                    tyutors.forEach((tName) => {
                        fullMessage += buildMessage(tName, tyutorGroups[tName]) + "\n\n";
                    });
                    navigator.clipboard.writeText(fullMessage.trim());
                    showToast("Barcha tyutorlar uchun havolalar nusxalandi", "success");
                };
            });
            area.querySelectorAll('.restart-a').forEach(b => b.onclick = async () => {
                if (!confirm("Ushbu havolani restart qilmoqchimisiz? Barcha mavjud natijalar o'chib ketadi!")) return;
                const aId = b.dataset.id;
                const assign = assigns.find(a => a.id === aId);
                if (!assign) return;

                const test = tests.find(t => t.id === assign.testId);
                const tIds = test?.type === 'merged' ? test.testIds : [assign.testId];
                const tTitles = tests.filter(t => tIds.includes(t.id)).map(t => t.title);

                const qS = query(collection(db, "submissions"), where("assignmentId", "==", aId));
                const snapS = await getDocs(qS);
                const total = snapS.docs.length;

                const progressToast = showToast(`0/${total} ta natija o'chirilmoqda...`, "info", Infinity);
                let count = 0;
                for (const d of snapS.docs) {
                    await deleteDoc(doc(db, "submissions", d.id));
                    count++;
                    progressToast.update(`${count}/${total} ta natija o'chirilmoqda...`);
                }

                // Clear from student profile in groups
                try {
                    const gRef = doc(db, "groups", assign.groupId);
                    const gSnap = await getDoc(gRef);
                    if (gSnap.exists()) {
                        const gData = gSnap.data();
                        let changed = false;
                        (gData.students || []).forEach(s => {
                            if (s.profileData) {
                                tTitles.forEach(title => { if (s.profileData[title]) { delete s.profileData[title]; changed = true; } });
                            }
                            if (s.portrait) {
                                const newPortrait = [];
                                let skipMode = false;
                                s.portrait.forEach(entry => {
                                    if (entry.label === "--- SECTION ---" && tTitles.includes(entry.value)) {
                                        skipMode = true;
                                        changed = true;
                                    } else if (entry.label === "--- SECTION ---") {
                                        skipMode = false;
                                    }
                                    if (!skipMode) newPortrait.push(entry);
                                });
                                s.portrait = newPortrait;
                            }
                        });
                        if (changed) await updateDoc(gRef, { students: gData.students });
                    }
                } catch (err) { console.error("Profile clear error:", err); }

                progressToast.close();
                showToast("Havola muvaffaqiyatli restart qilindi", "success");
                clearCache(); renderTab();
            });

            area.querySelectorAll('.upgrade-a').forEach(b => b.onclick = async () => {
                const aId = b.dataset.id;
                const assign = assigns.find(a => a.id === aId);
                if (!assign) return;

                const test = tests.find(t => t.id === assign.testId);

                try {
                    // 1. Metadata yangilash
                    if (test) {
                        await updateDoc(doc(db, "assignments", aId), {
                            testTitle: test.title,
                            updatedAt: serverTimestamp()
                        });
                    }

                    // 2. Guruhni qayta tekshirish (Keshni tozalab)
                    clearCache();
                    const freshGroups = await fetchData("groups");
                    const freshG = freshGroups.find(gx => gx.id === assign.groupId);
                    const sCount = freshG?.students?.length || 0;

                    showToast(`Havola yangilandi! Hozirda guruhda ${sCount} ta talaba mavjud.`, "success");
                    renderTab();
                } catch (err) {
                    showToast("Upgrade xatosi: " + err.message, "error");
                }
            });

            area.querySelectorAll('.tog-a').forEach(b => b.onchange = async (e) => { await updateDoc(doc(db, "assignments", b.dataset.id), { active: e.target.checked }); showToast("Holat yangilandi", "success"); });
            area.querySelectorAll('.del-a').forEach(b => b.onclick = async () => { if (confirm("O'chirilsinmi?")) { await deleteDoc(doc(db, "assignments", b.dataset.id)); clearCache(); renderTab(); } });

            const updateBulkBtn = () => {
                const checked = area.querySelectorAll('.sel-a:checked');
                document.getElementById('btn-bulk-del').style.display = checked.length ? 'block' : 'none';
            };
            area.querySelectorAll('.sel-a').forEach(cb => cb.onchange = updateBulkBtn);
            area.querySelectorAll('.select-all-test').forEach(cb => cb.onchange = (e) => {
                const card = e.target.closest('.card');
                card.querySelectorAll('.sel-a').forEach(el => el.checked = e.target.checked);
                updateBulkBtn();
            });
        };

        renderAssigns();

        document.getElementById('btn-create-links').onclick = async () => {
            const tId = aTest.value;
            const test = tests.find(t => t.id === tId);
            const selectedGIds = Array.from(area.querySelectorAll('.g-check:checked')).map(cb => cb.value);

            if (!selectedGIds.length) return showToast("Guruhlarni tanlang", "warning");

            const total = selectedGIds.length;
            const progressToast = showToast(`0/${total} ta havola tayyorlanmoqda...`, "info", Infinity);

            let count = 0;
            for (const gId of selectedGIds) {
                const token = Math.random().toString(36).substring(2, 8).toUpperCase();
                await addDoc(collection(db, "assignments"), {
                    testId: tId,
                    testTitle: test.title,
                    groupId: gId,
                    token,
                    active: true,
                    createdAt: serverTimestamp()
                });
                count++;
                progressToast.update(`${count}/${total} ta havola tayyorlanmoqda...`);
            }

            progressToast.close();
            showToast("Havolalar muvaffaqiyatli yaratildi", "success");
            clearCache();
            renderTab();
        };

        document.getElementById('btn-bulk-del').onclick = async () => {
            if (!confirm("Tanlanganlarni o'chirasizmi?")) return;
            const checked = Array.from(area.querySelectorAll('.sel-a:checked'));
            const total = checked.length;
            const progressToast = showToast(`0/${total} ta biriktirma o'chirilmoqda...`, "info", Infinity);
            let count = 0;
            for (const cb of checked) {
                await deleteDoc(doc(db, "assignments", cb.dataset.id));
                count++;
                progressToast.update(`${count}/${total} ta biriktirma o'chirilmoqda...`);
            }
            progressToast.close();
            showToast("Muvaffaqiyatli o'chirildi", "success");
            clearCache(); renderTab();
        };

        if (window.lucide) window.lucide.createIcons();
    }

    // --- RESULTS TAB ---
    async function renderResultsTab(area) {
        pageTitle.innerText = "Analitika";
        // Fetch only tests and groups for filters
        const [tests, groups] = await Promise.all([fetchData("tests"), fetchData("groups")]);

        area.innerHTML = `
            <div class="card mb-4 animate-fade">
                <div class="grid grid-5">
                    <div class="input-group"><label>Metodika</label><select id="f-test"><option value="all">Barchasi</option>${tests.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}</select></div>
                    <div class="input-group"><label>Fakultet</label><select id="f-fac"><option value="all">Barchasi</option>${[...new Set(groups.map(g => g.faculty || 'Akademiya'))].map(f => `<option value="${f}">${f}</option>`).join('')}</select></div>
                    <div class="input-group"><label>Yo'nalish</label><select id="f-dir"><option value="all">Barchasi</option></select></div>
                    <div class="input-group"><label>Kurs</label><select id="f-course"><option value="all">Barchasi</option><option value="1">1-kurs</option><option value="2">2-kurs</option><option value="3">3-kurs</option><option value="4">4-kurs</option></select></div>
                    <div class="flex-gap" style="align-items: flex-end"><button id="btn-update-analytics" class="btn btn-primary w-100" style="padding: 13px"><i data-lucide="refresh-cw"></i> Ko'rsatish</button></div>
                </div>
            </div>
            <div id="analytics-content-area">
                <div class="card text-center py-5">
                    <i data-lucide="bar-chart-2" style="width:50px; height:50px; opacity:0.1; margin-bottom:15px"></i>
                    <h3>Analitika tayyor</h3>
                    <p class="text-muted">Natijalarni ko'rish uchun filtrlarni sozlang va "Ko'rsatish" tugmasini bosing.</p>
                </div>
            </div>
        `;

        const fFac = document.getElementById('f-fac');
        const fDir = document.getElementById('f-dir');

        const updateDirections = () => {
            const fac = fFac.value;
            let dirs = [];
            if (fac === 'all') {
                dirs = [...new Set(groups.map(g => g.direction).filter(d => d))];
            } else {
                dirs = [...new Set(groups.filter(g => (g.faculty || 'Akademiya') === fac).map(g => g.direction).filter(d => d))];
            }
            fDir.innerHTML = `<option value="all">Barchasi</option>` + dirs.map(d => `<option value="${d}">${d}</option>`).join('');
        };

        fFac.onchange = updateDirections;
        updateDirections();

        if (window.lucide) window.lucide.createIcons();

        const updateAnalytics = async () => {
            const btn = document.getElementById('btn-update-analytics');
            const contentArea = document.getElementById('analytics-content-area');

            btn.disabled = true;
            btn.innerHTML = `<div class="loader-sm"></div> Yuklanmoqda...`;
            contentArea.innerHTML = `<div class="flex-center py-5"><div class="loader"></div></div>`;

            try {
                // Actual GET request happens ONLY here
                const subs = await fetchData("submissions");
                const tId = document.getElementById('f-test').value;
                const fac = document.getElementById('f-fac').value;
                const dir = document.getElementById('f-dir').value;
                const crs = document.getElementById('f-course').value;

                let filteredGroups = groups || [];
                if (fac !== 'all') filteredGroups = filteredGroups.filter(g => (g.faculty || 'Akademiya') === fac);
                if (dir !== 'all') filteredGroups = filteredGroups.filter(g => g.direction === dir);
                if (crs !== 'all') filteredGroups = filteredGroups.filter(g => String(g.course) === crs);

                const gIds = new Set(filteredGroups.map(g => g.id));
                let filteredSubs = (subs || []).filter(s => gIds.has(s.groupId));
                if (tId !== 'all') filteredSubs = filteredSubs.filter(s => s.testId === tId);

                contentArea.innerHTML = `
                    <div class="grid grid-2 animate-fade">
                        <div class="card">
                            <div class="flex-between mb-4"><h3>Natijalar Taqsimoti</h3><div class="badge badge-info" id="stat-count">${filteredSubs.length} ta natija</div></div>
                            <div style="max-width:300px; margin:0 auto"><canvas id="analyticsPieChart"></canvas></div>
                            <div class="mt-4" id="pie-legend"></div>
                        </div>
                        <div class="card">
                            <h3>Guruhlar bo'yicha tahlil</h3>
                            <div class="mt-3 table-container"><table id="groups-table"><thead><tr><th>Guruh</th><th>Topshirdi</th><th>Foiz</th></tr></thead><tbody id="groups-body"></tbody></table></div>
                        </div>
                    </div>
                    <div id="q-details-area" class="mt-4"></div>
                `;

                let labels = [], data = [], colors = ['#4318FF', '#05CD99', '#FFB547', '#FF5B5B', '#6AD2FF', '#918EF4'];
                const selectedTest = tests.find(t => t.id === tId);

                if (selectedTest && selectedTest.interpretations?.length) {
                    labels = selectedTest.interpretations.map(i => i.text);
                    data = new Array(labels.length).fill(0);
                    filteredSubs.forEach(s => {
                        const sc = parseFloat(s.score || 0);
                        const idx = selectedTest.interpretations.findIndex(i => sc >= i.min && sc <= i.max);
                        if (idx !== -1) data[idx]++;
                    });
                } else {
                    let low = 0, med = 0, high = 0;
                    filteredSubs.forEach(s => {
                        const sc = parseFloat(s.score || 0);
                        if (sc <= 10) low++; else if (sc <= 20) med++; else high++;
                    });
                    data = [low, med, high]; labels = ['Past', 'O\'rta', 'Yuqori']; colors = ['#05CD99', '#FFB547', '#FF5B5B'];
                }

                const ctx = document.getElementById('analyticsPieChart').getContext('2d');
                new Chart(ctx, {
                    type: 'pie',
                    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
                    options: { plugins: { legend: { display: false } } }
                });

                document.getElementById('pie-legend').innerHTML = labels.map((l, i) => `
                    <div class="flex-between mb-2">
                        <div class="flex-gap"><div style="width:12px; height:12px; background:${colors[i]}; border-radius:3px"></div><span>${l}</span></div>
                        <strong>${data[i]} ta (${filteredSubs.length ? Math.round(data[i] / filteredSubs.length * 100) : 0}%)</strong>
                    </div>`).join('');

                document.getElementById('groups-body').innerHTML = filteredGroups.map(g => {
                    const gSubs = filteredSubs.filter(s => s.groupId === g.id);
                    const prc = g.students?.length ? Math.round(gSubs.length / g.students.length * 100) : 0;
                    return `<tr><td>${g.name}</td><td>${gSubs.length} / ${g.students?.length || 0}</td><td><div class="flex-gap">${prc}% <div class="progress-bar-container" style="flex:1"><div class="progress-bar-fill" style="width:${prc}%"></div></div></div></td></tr>`;
                }).join('');

                if (tId !== 'all' && selectedTest?.questions) {
                    const qDetails = document.getElementById('q-details-area');
                    qDetails.innerHTML = `<div class="card"><h3>Savollar tahlili</h3><div id="q-breakdown" class="mt-4"></div></div>`;
                    const qB = document.getElementById('q-breakdown');
                    selectedTest.questions.forEach((q, i) => {
                        if (q.type === 'text' || !q.options) return;
                        const qCounts = {};
                        q.options.forEach(o => qCounts[o.text] = 0);
                        filteredSubs.forEach(s => { if (s.answers && s.answers[i]) qCounts[s.answers[i]] = (qCounts[s.answers[i]] || 0) + 1; });
                        qB.innerHTML += `<div class="mb-4 p-3 border-bottom"><strong>${i + 1}. ${q.text}</strong><div class="grid grid-4 mt-2">${q.options.map(o => `<div class="small">${o.text}: <b>${qCounts[o.text]} ta</b></div>`).join('')}</div></div>`;
                    });
                }
                if (window.lucide) window.lucide.createIcons();
            } catch (err) {
                contentArea.innerHTML = `<div class="card text-danger p-5 text-center">Xatolik: ${err.message}</div>`;
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="refresh-cw"></i> Ko'rsatish`;
                if (window.lucide) window.lucide.createIcons();
            }
        };

        document.getElementById('btn-update-analytics').onclick = updateAnalytics;
    }

    async function openStudentProfile(name, groupId) {
        contentArea.innerHTML = `<div class="flex-center" style="height:60vh"><div class="loader"></div></div>`;
        pageTitle.innerText = "Talaba Profili";

        try {
            const [gs, ts] = await Promise.all([fetchData("groups"), fetchData("tests")]);
            const g = gs.find(gr => gr.id === groupId);

            let subs = [];
            if (!isMock) {
                // Fetch by groupId only to avoid composite index requirement
                const q = query(collection(db, "submissions"), where("groupId", "==", groupId));
                const snap = await getDocs(q);
                subs = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(s => s.studentName === name)
                    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            }

            contentArea.innerHTML = `
            <div class="profile-card animate-fade">
                <div class="profile-banner" style="background: linear-gradient(135deg, var(--primary), var(--secondary)); height: 120px; border-radius: 30px 30px 0 0"></div>
                <div class="profile-content" style="margin-top: -60px; padding: 0 30px 30px">
                    <div class="profile-header flex-gap" style="align-items: flex-end">
                        <div class="profile-img-container" style="width:120px; height:120px; background:white; border-radius:30px; display:flex; align-items:center; justify-content:center; font-size:4rem; border:4px solid white; box-shadow:var(--shadow-lg)">
                            👤
                        </div>
                        <div class="profile-name pb-3">
                            <h2 style="font-size:2.2rem; font-weight:800; margin-bottom:5px">${name}</h2>
                            <div class="flex-gap text-muted">
                                <span class="badge badge-info">${g.faculty || 'IIXM'}</span>
                                <span class="badge badge-outline">${g.direction} • ${g.course}-kurs</span>
                            </div>
                        </div>
                    </div>
                    ${subs.find(s => s.isProfileData) || g.students.find(s => s.name === name)?.portrait || g.students.find(s => s.name === name)?.profileData ? `
                    <div class="card mt-4 animate-fade" style="border: 2px solid var(--primary); background: white; position:relative; overflow:hidden" id="portrait-card">
                        <div style="position:absolute; top:20px; right:20px; opacity:0.05; font-size:5rem"><i data-lucide="user-check"></i></div>
                        
                        <div class="flex-between mb-4 pb-2 border-bottom" style="border-color: rgba(67, 24, 255, 0.1) !important">
                            <h3 style="color:var(--primary); font-weight:800; letter-spacing:1px">TALABA PASPORTI VA PSIXOLOGIK PORTRETI</h3>
                            <div class="flex-gap">
                                <button class="btn btn-sm btn-outline" id="btn-edit-portrait"><i data-lucide="edit"></i> Tahrirlash</button>
                                <button class="btn btn-sm btn-primary" id="btn-save-portrait" style="display:none"><i data-lucide="save"></i> Saqlash</button>
                            </div>
                        </div>

                        <div id="portrait-grid">
                            ${(() => {
                        const studentObj = g.students.find(s => s.name === name);
                        const profileSub = subs.find(s => s.isProfileData);
                        // IMPORTANT: Prioritize the accumulated portrait array in the student object
                        // as it contains merged data from all parts of a test sequence.
                        const rawPortrait = studentObj?.portrait || studentObj?.profileData || profileSub?.portraitData || {};
                        // Convert to array if it's an object
                        const portraitData = (Array.isArray(rawPortrait) ? rawPortrait : Object.entries(rawPortrait).map(([label, value]) => ({ label, value })))
                            .filter(d => d.value && d.value !== "---");

                        // Master template for the requested sequence
                        const masterTemplate = [
                            {
                                category: "SHAXSIY MA'LUMOTLAR", fields: [
                                    "F.I.Sh", "Fakultet, guruh, kurs", "Tuģilgan yili, oyi, kuni", "Doimiy yashash manzili",
                                    "Oilaviy ahvoli", "Otasi", "Onasi", "Yashash sharoiti", "Salomatligi to'g'risida ma'mulotlar",
                                    "Fanlarni o'zlashtirishi", "Xarakterining asosiy xususiyatlari", "Oilaviy munosabatlar xususiyatlari",
                                    "Izoh", "Kursdoshlari bilan o'zaro munosabati", "Profilaktika va korreksiya uchun tavsiyalar"
                                ]
                            },
                            {
                                category: "IJTIMOIY MOSLASHUV", fields: [
                                    "Tengdoshlari bilan o'zaro munosabati", "O'qituvchilar bilan o'zaro munosabati", "Muloqotchanligi"
                                ]
                            },
                            {
                                category: "INDIVIDUAL-PSIXOLOGIK XUSUSIYATLAR", fields: [
                                    "Ajralib turadigan charakter xususiyatlari", "O'ziga beradigan bahosi", "Xavotirlanuvchanligi",
                                    "Agressivlik darajasi", "Irodaviy xususiyatlari", "Diqqati"
                                ]
                            },
                            {
                                category: "INTELLEKTUAL RIVOJLANISH", fields: [
                                    "Tafakkur xususiyatlari", "Intellektual salohiyati"
                                ]
                            },
                            {
                                category: "QIZIQISHLARI", fields: [
                                    "Hobbisi", "Sport turi", "San'at turi", "Erishgan yutuqlari", "Bo'sh vaqtdan foydalanish"
                                ]
                            }
                        ];

                        const usedIndices = new Set();
                        const sectionsHtml = masterTemplate.map(section => {
                            const sectionItems = [];
                            section.fields.forEach(fLabel => {
                                const foundIdx = portraitData.findIndex((d, idx) => !usedIndices.has(idx) && d.label.toLowerCase().includes(fLabel.toLowerCase()));
                                if (foundIdx > -1) {
                                    sectionItems.push(portraitData[foundIdx]);
                                    usedIndices.add(foundIdx);
                                }
                            });

                            if (sectionItems.length === 0) return "";

                            return `
                                        <div class="mt-4 mb-3">
                                            <h5 style="color:var(--text-muted); font-size:0.7rem; font-weight:800; letter-spacing:2px; text-transform:uppercase; border-left:3px solid var(--primary); padding-left:10px">${section.category}</h5>
                                        </div>
                                        <div class="grid grid-2" style="gap:20px">
                                            ${sectionItems.map(item => `
                                                <div class="profile-field-box animate-fade" style="background: rgba(67, 24, 255, 0.02); padding: 12px 18px; border-radius: 16px; border: 1px solid rgba(67, 24, 255, 0.05); position: relative; overflow: hidden;">
                                                    <div style="position:absolute; top:0; left:0; width:3px; height:100%; background:var(--primary); opacity:0.2"></div>
                                                    <div class="flex-between mb-1">
                                                        <input type="text" class="p-label-edit" value="${item.label}" style="display:none; font-size:0.7rem; font-weight:800; text-transform:uppercase; border:none; background:transparent; color:var(--text-muted); width:100%">
                                                        <label class="p-label-view" style="display:block; font-size:0.7rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.7">${item.label}</label>
                                                        <button class="btn-icon p-del-btn" style="display:none; color:red; padding:0">×</button>
                                                    </div>
                                                    <div class="p-value-view" style="font-weight:700; font-size:1.05rem; color:var(--text); line-height: 1.3;">${item.value || '---'}</div>
                                                    <textarea class="p-value-edit cozy-input" style="display:none; font-weight:700; font-size:0.95rem; min-height:35px; padding:6px; border-radius:8px">${item.value || ''}</textarea>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `;
                        }).join('');

                        const remainingItems = portraitData.filter((item, idx) => !usedIndices.has(idx) && item.label !== "--- SECTION ---");
                        const customHtml = remainingItems.length > 0 ? `
                                    <div class="mt-4 pt-3 border-top" id="custom-fields-area">
                                        <h5 style="color:var(--text-muted); font-size:0.7rem; font-weight:800; letter-spacing:2px; text-transform:uppercase; margin-bottom:15px">QO'SHIMCHA MA'LUMOTLAR</h5>
                                        <div class="grid grid-2" id="custom-portrait-grid" style="gap:20px">
                                            ${remainingItems.map(item => `
                                                <div class="profile-field-box animate-fade" style="background: rgba(5, 205, 153, 0.02); padding: 12px 18px; border-radius: 16px; border: 1px solid rgba(5, 205, 153, 0.05); position: relative; overflow: hidden;">
                                                    <div style="position:absolute; top:0; left:0; width:3px; height:100%; background:var(--success); opacity:0.2"></div>
                                                    <div class="flex-between mb-1">
                                                        <input type="text" class="p-label-edit" value="${item.label}" style="display:none; font-size:0.7rem; font-weight:800; text-transform:uppercase; border:none; background:transparent; color:var(--text-muted); width:100%">
                                                        <label class="p-label-view" style="display:block; font-size:0.7rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.7">${item.label}</label>
                                                        <button class="btn-icon p-del-btn" style="display:none; color:red; padding:0">×</button>
                                                    </div>
                                                    <div class="p-value-view" style="font-weight:700; font-size:1.05rem; color:var(--text); line-height: 1.3;">${item.value || '---'}</div>
                                                    <textarea class="p-value-edit cozy-input" style="display:none; font-weight:700; font-size:0.95rem; min-height:35px; padding:6px; border-radius:8px">${item.value || ''}</textarea>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>` : "";

                        return sectionsHtml + customHtml;
                    })()}
                        </div>
                        <div id="portrait-actions" style="display:none" class="mt-4 flex-center">
                            <button class="btn btn-sm btn-outline" id="btn-add-p-field">+ Yangi ixtiyoriy maydon</button>
                        </div>
                    </div>
                    ` : ''}

                    <div class="grid grid-3 mt-5">
                        <div class="card stat-card">
                            <div class="icon-circle primary" style="width:45px; height:45px"><i data-lucide="clipboard-check"></i></div>
                            <div><p class="text-muted small uppercase font-weight-800">Jami Testlar</p><h3>${subs.length}</h3></div>
                        </div>
                        <div class="card stat-card">
                            <div class="icon-circle success" style="width:45px; height:45px"><i data-lucide="award"></i></div>
                            <div><p class="text-muted small uppercase font-weight-800">O'rtacha Ball</p><h3>${subs.length ? Math.round(subs.reduce((a, b) => a + (b.score || 0), 0) / subs.length) : 0}</h3></div>
                        </div>
                        <div class="card stat-card">
                            <div class="icon-circle warning" style="width:45px; height:45px"><i data-lucide="trending-up"></i></div>
                            <div><p class="text-muted small uppercase font-weight-800">Status</p><h3>${subs.length > 0 ? 'Faol' : 'Inaktiv'}</h3></div>
                        </div>
                    </div>

                    <div class="card mt-4">
                        <div class="flex-between w-100 mb-4"><h3>Ko'rsatkichlar Dinamikasi</h3></div>
                        <div style="height:250px; width:100%"><canvas id="studentTrendChart"></canvas></div>
                    </div>
                    <div class="card mt-4">
                        <div class="flex-between w-100 mb-4"><h3>Topshirilgan Testlar</h3></div>
                        <div class="w-100 grid grid-2" style="gap:20px;">
                            ${subs.length ? subs.map(s => {
                        const scoreColor = s.score > 20 ? 'badge-danger' : (s.score > 10 ? 'badge-warning' : 'badge-success');
                        return `
                                    <div class="v-sub-detail hover-card" data-id="${s.id}" style="cursor:pointer; border-radius:16px; border: 1px solid rgba(0,0,0,0.05); padding: 20px; background: rgba(0,0,0,0.01);">
                                        <div class="flex-between mb-2">
                                            <p style="font-weight:800; font-size:1.1rem">${s.testTitle}</p>
                                            <span class="badge ${scoreColor}" style="font-size:0.85rem">${s.score} ball</span>
                                        </div>
                                        <p class="text-muted small mb-3"><i data-lucide="calendar" style="width:12px; margin-right:4px"></i> ${new Date(s.timestamp?.seconds * 1000).toLocaleDateString()}</p>
                                        ${s.conclusion ? `<div style="background: rgba(67, 24, 255, 0.05); padding: 12px; border-radius: 12px; border-left: 3px solid var(--primary); font-weight:600; font-size:0.9rem; color:var(--text); margin-top:10px;">${s.conclusion}</div>` : ''}
                                    </div>`;
                    }).join('') : '<p class="text-muted">Hali test topshirilmagan</p>'}
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex-center mt-4">
                <button class="btn btn-outline btn-round" id="btn-back-prof"><i data-lucide="arrow-left"></i> Guruhga qaytish</button>
            </div>`;

            document.getElementById('btn-back-prof').onclick = () => { currentSubView = 'students_list'; renderTab(); };

            if (window.Chart && subs.length) {
                const ctxT = document.getElementById('studentTrendChart').getContext('2d');
                new Chart(ctxT, {
                    type: 'line',
                    data: {
                        labels: subs.map(s => new Date(s.timestamp?.seconds * 1000).toLocaleDateString()).reverse(),
                        datasets: [{
                            label: 'Ball',
                            data: subs.map(s => s.score).reverse(),
                            borderColor: '#4318FF',
                            backgroundColor: 'rgba(67, 24, 255, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 5,
                            pointBackgroundColor: '#4318FF'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, max: 30 } }
                    }
                });
            }

            contentArea.querySelectorAll('.v-sub-detail').forEach(item => {
                item.onclick = () => {
                    const sub = subs.find(s => s.id === item.dataset.id);
                    const test = ts.find(t => t.id === sub.testId);
                    if (!test) return showToast("Test ma'lumotlari topilmadi", "error");
                    const detailHtml = `
                    <div class="detail-list" style="max-height: 500px; overflow-y: auto; padding: 10px">
                        ${sub.portraitData ?
                            (Array.isArray(sub.portraitData) ?
                                sub.portraitData.map((item, i) => `
                                    <div class="mb-3 p-3" style="background:rgba(67, 24, 255, 0.03); border-radius:15px; text-align:left">
                                        <p class="small text-primary font-weight-800 mb-1">${item.label}</p>
                                        <p style="font-weight:700; font-size:1rem; line-height:1.3; color:var(--text)">${item.value || '---'}</p>
                                    </div>
                                `).join('')
                                :
                                Object.entries(sub.portraitData).map(([q, a], i) => `
                                    <div class="mb-3 p-3" style="background:rgba(67, 24, 255, 0.03); border-radius:15px; text-align:left">
                                        <p class="small text-primary font-weight-800 mb-1">${q}</p>
                                        <p style="font-weight:700; font-size:1rem; line-height:1.3; color:var(--text)">${a}</p>
                                    </div>
                                `).join('')
                            )
                            :
                            test.questions.map((q, i) => `
                                <div class="mb-3 p-3" style="background:rgba(67, 24, 255, 0.03); border-radius:15px; text-align:left">
                                    <p class="small text-muted font-weight-800 mb-1">SAVOL ${i + 1}</p>
                                    <p style="font-weight:700; font-size:1rem; line-height:1.3">${q.text}</p>
                                    <p class="mt-2 text-primary" style="font-weight:600">Javob: ${sub.answers[i] || '---'}</p>
                                </div>
                            `).join('')
                        }
                    </div>`;
                    showModal(`${sub.testTitle}`, detailHtml, () => true);
                };
            });

            // --- Portrait Editing Logic ---
            const pCard = document.getElementById('portrait-card');
            if (pCard) {
                const btnEdit = document.getElementById('btn-edit-portrait');
                const btnSave = document.getElementById('btn-save-portrait');
                const pActions = document.getElementById('portrait-actions');
                const pGrid = document.getElementById('portrait-grid');

                btnEdit.onclick = () => {
                    const isEditing = btnEdit.innerText.includes("Tahrirlash");
                    btnEdit.innerHTML = isEditing ? '<i data-lucide="x-circle"></i> Bekor qilish' : '<i data-lucide="edit"></i> Tahrirlash';
                    btnSave.style.display = isEditing ? 'block' : 'none';
                    pActions.style.display = isEditing ? 'flex' : 'none';

                    pCard.querySelectorAll('.p-label-view, .p-value-view').forEach(el => el.style.display = isEditing ? 'none' : 'block');
                    pCard.querySelectorAll('.p-label-edit, .p-value-edit, .p-del-btn').forEach(el => el.style.display = isEditing ? 'block' : 'none');
                    if (window.lucide) window.lucide.createIcons();
                };

                document.getElementById('btn-add-p-field').onclick = () => {
                    const customGrid = document.getElementById('custom-portrait-grid');
                    const div = document.createElement('div');
                    div.className = 'profile-field-box animate-fade';
                    div.style = 'background: rgba(5, 205, 153, 0.05); padding: 12px 18px; border-radius: 16px; border: 1px solid var(--success); position: relative; overflow: hidden;';
                    div.innerHTML = `
                    <div style="position:absolute; top:0; left:0; width:3px; height:100%; background:var(--success)"></div>
                    <div class="flex-between mb-1">
                        <input type="text" class="p-label-edit" value="" placeholder="YANGI MAYDON" style="font-size:0.7rem; font-weight:800; text-transform:uppercase; border:none; background:transparent; color:var(--success); width:100%">
                        <button class="btn-icon p-del-btn" style="color:red; padding:0">×</button>
                    </div>
                    <textarea class="p-value-edit cozy-input" placeholder="Javobni kiriting..." style="font-weight:700; font-size:0.95rem; min-height:35px; padding:6px; border-radius:8px"></textarea>
                `;
                    customGrid.appendChild(div);
                    div.querySelector('.p-del-btn').onclick = () => div.remove();
                };

                pCard.querySelectorAll('.p-del-btn').forEach(btn => btn.onclick = () => btn.closest('.profile-field-box').remove());

                btnSave.onclick = async () => {
                    btnSave.disabled = true;
                    const oldText = btnSave.innerHTML;
                    btnSave.innerText = "Saqlanmoqda...";

                    const newData = Array.from(pGrid.querySelectorAll('.profile-field-box')).map(box => ({
                        label: box.querySelector('.p-label-edit').value,
                        value: box.querySelector('.p-value-edit').value
                    }));

                    try {
                        const studentIdx = g.students.findIndex(s => s.name === name);
                        if (studentIdx > -1) {
                            g.students[studentIdx].portrait = newData;
                            await updateDoc(doc(db, "groups", g.id), { students: g.students });

                            // Also update the latest profile submission if it exists
                            const profileSub = subs.find(s => s.isProfileData);
                            if (profileSub) {
                                await updateDoc(doc(db, "assignments", profileSub.id), { portraitData: newData });
                            }

                            showToast("Portret saqlandi", "success");
                            renderTab(); // Refresh to show new data
                        }
                    } catch (err) {
                        showToast("Saqlashda xato: " + err.message, "error");
                    } finally {
                        btnSave.disabled = false;
                        btnSave.innerHTML = oldText;
                    }
                };
            }

            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error("Profile error:", error);
            contentArea.innerHTML = `
                <div class="card text-center p-5 animate-fade">
                    <div class="icon-circle danger mx-auto mb-3"><i data-lucide="alert-circle"></i></div>
                    <h2 class="text-danger">Xatolik yuz berdi</h2>
                    <p class="text-muted mb-4">${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Sahifani yangilash</button>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    renderTab();
}
