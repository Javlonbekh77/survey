import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, where, limit, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { showToast } from '../utils.js';
import { navigate } from '../app.js';

let test = null;
let assignment = null;
let currentQ = 0;
let answers = [];
let studentName = "";
let timer = null;
let totalTimeSeconds = 0;
let mergedIds = [];
let currentMergedIdx = 0;

export async function renderTest(container, params) {
    const token = params.token;
    container.innerHTML = `<div class="loader-container animate-fade"><div class="loader"></div><p class="mt-2">Yuklanmoqda...</p></div>`;

    try {
        if (!token) throw new Error("Token topilmadi!");
        const qAssign = query(collection(db, "assignments"), where("token", "==", String(token).toUpperCase()), where("active", "==", true), limit(1));
        const snapAssign = await getDocs(qAssign).catch(e => { throw new Error("Bazadan ma'lumot olishda xato: " + e.message); });

        if (snapAssign.empty) throw new Error("Havola muddati tugagan yoki xato!");
        assignment = { id: snapAssign.docs[0].id, ...snapAssign.docs[0].data() };

        const testRef = doc(db, "tests", assignment.testId);
        const testSnap = await getDoc(testRef).catch(e => { throw new Error("Testni yuklashda xato: " + e.message); });
        if (!testSnap.exists()) throw new Error("Test topilmadi!");
        const initialTest = { id: testSnap.id, ...testSnap.data() };

        if (initialTest.type === 'merged') {
            mergedIds = initialTest.testIds || [];
            currentMergedIdx = 0;
            if (mergedIds.length === 0) throw new Error("Birlashtirilgan test bo'sh!");

            // Load the first test in the sequence
            const firstTestRef = doc(db, "tests", mergedIds[0]);
            const firstSnap = await getDoc(firstTestRef);
            if (!firstSnap.exists()) throw new Error("Birlashtirilgan testdagi birinchi qism topilmadi!");
            test = { id: firstSnap.id, ...firstSnap.data() };
        } else {
            test = initialTest;
            mergedIds = [];
        }

        answers = new Array(test.questions.length).fill(null);
        totalTimeSeconds = (test.timeLimit || 30) * 60;

        if (!document.getElementById('mindsync-exact-styles')) {
            const style = document.createElement('style');
            style.id = 'mindsync-exact-styles';
            style.textContent = `
                :root {
                    --ms-bg: #0F172A;
                    --ms-primary: #2DD4BF;
                    --ms-text: #1B2559;
                    --ms-glass: rgba(255, 255, 255, 0.1);
                    --ms-border: rgba(255, 255, 255, 0.2);
                    
                    --grad-a: linear-gradient(90deg, #A5F3FC, #2DD4BF);
                    --grad-b: linear-gradient(90deg, #DDD6FE, #A855F7);
                    --grad-c: linear-gradient(90deg, #FECDD3, #FB7185);
                    --grad-d: linear-gradient(90deg, #FEF08A, #FACC15);
                }

                .ms-page {
                    min-height: 100vh;
                    width: 100vw;
                    background: radial-gradient(circle at top right, #1E293B, #0F172A);
                    color: white;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    position: relative;
                    overflow: hidden;
                }

                .ms-page::before {
                    content: '';
                    position: absolute;
                    width: 300px; height: 300px;
                    background: var(--ms-primary);
                    filter: blur(150px);
                    top: 10%; left: -50px;
                    opacity: 0.2;
                }

                .ms-wrapper {
                    width: 100%;
                    max-width: 500px;
                    display: flex;
                    flex-direction: column;
                    padding: 40px 20px;
                    position: relative;
                    z-index: 10;
                    min-height: 100vh;
                    justify-content: center;
                }

                /* Header */
                .ms-top-card {
                    background: linear-gradient(135deg, rgba(45, 212, 191, 0.15), rgba(168, 85, 247, 0.15));
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--ms-border);
                    border-radius: 24px;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .ms-greeting { text-align: right; }
                .ms-greeting p { font-size: 0.75rem; opacity: 0.7; margin: 0; }
                .ms-greeting h4 { font-size: 0.95rem; font-weight: 800; margin: 0; }

                /* Progress Card */
                .ms-progress-card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--ms-border);
                    border-radius: 20px;
                    padding: 15px 20px;
                    margin-bottom: 25px;
                }
                .ms-progress-text { font-size: 0.8rem; font-weight: 700; margin-bottom: 10px; opacity: 0.8; }
                .ms-progress-bg { height: 8px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; }
                .ms-progress-fill { height: 100%; background: var(--ms-primary); border-radius: 10px; transition: width 0.3s; box-shadow: 0 0 10px var(--ms-primary); }

                .ms-question-card {
                    background: white;
                    border-radius: 24px;
                    padding: 20px;
                    color: #1B2559;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.18), 0 5px 15px rgba(0,0,0,0.05);
                    width: 100%;
                    max-width: 440px;
                    margin: auto;
                    display: flex;
                    flex-direction: column;
                    z-index: 100;
                    border: 1px solid rgba(0,0,0,0.03);
                    transition: all 0.3s ease;
                }
                .ms-q-title { font-size: 0.95rem; font-weight: 800; line-height: 1.4; margin-bottom: 15px; }

                /* Extra Info Toggle */
                .ms-extra-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 8px 15px;
                    background: linear-gradient(135deg, rgba(67, 24, 255, 0.04), rgba(45, 212, 191, 0.04));
                    color: #4318FF;
                    border-radius: 14px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    cursor: pointer;
                    margin-bottom: 15px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(67, 24, 255, 0.08);
                }
                .ms-extra-toggle:hover { background: rgba(67, 24, 255, 0.1); }
                .ms-extra-content { display: none; margin-bottom: 15px; }
                .ms-extra-content.show { display: block; animation: slideDown 0.3s ease-out; }
                @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }

                .ms-q-comment {
                    padding: 10px 12px;
                    background: #F8FAFC;
                    border-left: 3px solid var(--ms-primary);
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #64748B;
                    margin-bottom: 10px;
                }

                /* Options */
                .ms-option-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    border-radius: 16px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 2px solid transparent;
                    background: rgba(0,0,0,0.02);
                }
                .ms-option-item:active { transform: scale(0.98); }
                .ms-letter-box {
                    width: 32px; height: 32px;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 800; font-size: 0.8rem;
                    flex-shrink: 0;
                    color: #1B2559;
                    background: rgba(0,0,0,0.05);
                }
                .ms-opt-text { font-weight: 700; font-size: 0.78rem; line-height: 1.3; }

                .ms-opt-0 { background: var(--grad-a); }
                .ms-opt-1 { background: var(--grad-b); }
                .ms-opt-2 { background: var(--grad-c); }
                .ms-opt-3 { background: var(--grad-d); }
                
                .ms-option-item.selected { border: 2px solid #1B2559; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }

                /* Timer Area */
                .ms-timer-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-bottom: 30px;
                }
                .ms-circular {
                    width: 100px; height: 100px;
                    position: relative;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                }
                .ms-circular svg { transform: rotate(-90deg); position: absolute; }
                .ms-circular circle { fill: none; stroke-width: 6; }
                .ms-circular .bg { stroke: rgba(255,255,255,0.1); }
                .ms-circular .prog { stroke: var(--ms-primary); stroke-dasharray: 283; stroke-dashoffset: 0; transition: stroke-dashoffset 1s linear; stroke-linecap: round; filter: drop-shadow(0 0 5px var(--ms-primary)); }
                .ms-timer-label { font-size: 0.6rem; font-weight: 700; opacity: 0.7; margin-bottom: 2px; }
                .ms-timer-val { font-size: 1.2rem; font-weight: 800; letter-spacing: 0.5px; }

                /* Navigation */
                .ms-nav-area {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 10px;
                }
                .ms-prev-btn {
                    width: 48px; height: 48px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid var(--ms-border);
                    border-radius: 16px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                }
                .ms-next-btn {
                    background: var(--ms-primary);
                    color: #0F172A;
                    padding: 0 30px;
                    height: 48px;
                    border-radius: 24px;
                    font-weight: 800;
                    font-size: 0.95rem;
                    display: flex; align-items: center; gap: 8px;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 10px 20px rgba(45, 212, 191, 0.3);
                }
                
                @keyframes msFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .ms-animate-fade { animation: msFadeIn 0.3s ease-out forwards; }

                @keyframes msSlideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .ms-dots { display: flex; gap: 6px; justify-content: center; margin-top: 15px; }
                .ms-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }
                .ms-dot.active { width: 20px; border-radius: 10px; background: var(--ms-primary); }

                /* Text & Date Inputs */
                .ms-input { width: 100%; border: 2px solid #E2E8F0; border-radius: 18px; padding: 15px; font-family: inherit; font-weight: 700; outline: none; margin-top: 10px; }
                .ms-input:focus { border-color: var(--ms-primary); }

                /* Completion Stats & Submitted List */
                .ms-stats-box {
                    background: rgba(45, 212, 191, 0.08);
                    border: 1px solid rgba(45, 212, 191, 0.15);
                    border-radius: 16px;
                    padding: 12px 15px;
                    margin-bottom: 20px;
                    text-align: left;
                }
                .ms-stats-title {
                    font-size: 0.78rem;
                    font-weight: 800;
                    color: #1b2559;
                    opacity: 0.9;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                }
                .ms-stats-progress-bg {
                    height: 8px;
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .ms-stats-progress-fill {
                    height: 100%;
                    background: var(--ms-primary);
                    box-shadow: 0 0 8px var(--ms-primary);
                    border-radius: 4px;
                    transition: width 0.5s ease-out;
                }
                .ms-submitted-section {
                    margin-top: 25px;
                    text-align: left;
                    border-top: 1px solid rgba(0,0,0,0.05);
                    padding-top: 20px;
                }
                .ms-submitted-header {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748B;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 12px;
                }
                .ms-submitted-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    max-height: 150px;
                    overflow-y: auto;
                    padding-right: 5px;
                }
                .ms-submitted-grid::-webkit-scrollbar {
                    width: 4px;
                }
                .ms-submitted-grid::-webkit-scrollbar-track {
                    background: transparent;
                }
                .ms-submitted-grid::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 2px;
                }
                .ms-submitted-tag {
                    font-size: 0.72rem;
                    font-weight: 700;
                    background: #F1F5F9;
                    color: #475569;
                    padding: 6px 12px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid rgba(0,0,0,0.02);
                }
                .ms-submitted-tag i {
                    color: #05CD99;
                }

                @media (min-width: 1024px) {
                    .ms-wrapper { max-width: 800px; padding: 40px; }
                    .ms-question-card { max-height: none; }
                }
            `;
            document.head.appendChild(style);
        }

        renderIntro(container);
    } catch (e) {
        container.innerHTML = `<div class="p-5 text-center"><h2>Xato</h2><p>${e.message}</p></div>`;
    }
}

async function renderIntro(container) {
    const [snapGroup, snapSubs] = await Promise.all([
        getDoc(doc(db, "groups", assignment.groupId)),
        getDocs(query(collection(db, "submissions"), where("assignmentId", "==", assignment.id)))
    ]);

    const groupData = snapGroup.data();
    const allStudents = groupData.students || [];

    // Find the last test ID in the sequence (merged or single)
    const lastTestId = mergedIds.length > 0 ? mergedIds[mergedIds.length - 1] : assignment.testId;

    // A student is completed if they have a submission for the last test in this assignment
    const completedNames = new Set(
        snapSubs.docs
            .filter(d => d.data().testId === lastTestId)
            .map(d => d.data().studentName)
    );

    // List of ALL students who have submitted the final test (completed)
    const completedStudents = allStudents.filter(s => completedNames.has(s.name));

    // List of students who have not completed yet (available to start the test)
    const availableStudents = allStudents.filter(s => !completedNames.has(s.name));

    const totalCount = allStudents.length;
    const completedCount = completedStudents.length;
    const remainingCount = totalCount - completedCount;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    container.innerHTML = `
        <div class="ms-page ms-animate-fade">
            <div class="ms-wrapper" style="justify-content: center; max-width: 500px; padding: 20px;">
                <div class="ms-question-card" style="text-align: center; max-width: 100%;">
                    <div class="ms-logo" style="margin-bottom: 15px; font-size: 3rem">🧠</div>
                    <h1 style="font-size: 1.6rem; font-weight: 900; margin-bottom: 5px; color: #1B2559; line-height: 1.2">${test.title}</h1>
                    <p style="opacity: 0.6; margin-bottom: 20px; color: #1B2559; font-weight: 600; font-size: 0.85rem">Ismingizni tanlab testni boshlang</p>
                    
                    <!-- Completion Progress Statistics -->
                    <div class="ms-stats-box">
                        <div class="ms-stats-title">
                            <span>Topshirish ko'rsatkichi</span>
                            <span>${completedCount} / ${totalCount} (${progressPercent}%)</span>
                        </div>
                        <div class="ms-stats-progress-bg">
                            <div class="ms-stats-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; margin-top: 8px; display: flex; justify-content: space-between;">
                            <span>Topshirganlar: ${completedCount} ta</span>
                            <span>Qoldi: ${remainingCount} ta</span>
                        </div>
                    </div>

                    <select id="student-name-select" class="ms-input" style="background: #F8FAFC; margin-bottom: 20px; color: #1B2559">
                        <option value="">Ro'yxatdan tanlang...</option>
                        ${availableStudents.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                    </select>

                    <button class="ms-next-btn" id="start-btn" style="width: 100%; justify-content: center; height: 55px; border-radius: 18px">
                        Boshlash <i data-lucide="arrow-right"></i>
                    </button>

                    <!-- List of completed students -->
                    <div class="ms-submitted-section">
                        <div class="ms-submitted-header">Topshirgan talabalar (${completedCount})</div>
                        <div class="ms-submitted-grid">
                            ${completedStudents.length > 0 ? 
                                completedStudents.map(s => `
                                    <div class="ms-submitted-tag">
                                        <i data-lucide="check-circle" style="width: 12px; height: 12px;"></i>
                                        <span>${s.name}</span>
                                    </div>
                                `).join('') 
                                : `<div style="font-size: 0.75rem; color: #94A3B8; font-weight: 600;">Hozircha hech kim topshirmadi. Birinchi bo'lib boshlang!</div>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    document.getElementById('start-btn').onclick = () => {
        studentName = document.getElementById('student-name-select').value;
        if (!studentName) return showToast("Ismingizni tanlang", "warning");
        startTimer(container);
        renderQuestion(container);
    };
}

function startTimer(container) {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        totalTimeSeconds--;
        const circle = document.getElementById('timer-prog');
        const text = document.getElementById('timer-text');
        if (circle && text) {
            const m = Math.floor(totalTimeSeconds / 60);
            const s = totalTimeSeconds % 60;
            text.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;

            const total = (test.timeLimit || 30) * 60;
            const offset = 283 - (totalTimeSeconds / total) * 283;
            circle.style.strokeDashoffset = offset;
        }
        if (totalTimeSeconds <= 0) { clearInterval(timer); finishTest(container); }
    }, 1000);
}

function renderQuestion(container) {
    const q = test.questions[currentQ];
    const progress = ((currentQ + 1) / test.questions.length) * 100;
    const m = Math.floor(totalTimeSeconds / 60);
    const s = totalTimeSeconds % 60;

    const isLayoutReady = container.querySelector('#q-content-area');

    if (!isLayoutReady) {
        container.innerHTML = `
            <div class="ms-page ms-animate-fade">
                <div class="ms-wrapper">
                    <header class="ms-top-card">
                        <div style="font-size: 1.5rem">🧠</div>
                        <div class="ms-greeting">
                            <p>Assalomu alaykum,</p>
                            <h4>${studentName}! 👤</h4>
                        </div>
                    </header>

                    <div class="ms-progress-card">
                        <div class="flex-between mb-1">
                            <div class="ms-progress-text" id="q-progress-text">Savollar: ${currentQ + 1} / ${test.questions.length}</div>
                            ${mergedIds.length > 1 ? `<div class="badge badge-info" style="font-size:0.6rem; background:rgba(255,255,255,0.1)">Bo'lim: ${currentMergedIdx + 1} / ${mergedIds.length}</div>` : ''}
                        </div>
                        <div class="ms-progress-bg"><div class="ms-progress-fill" id="q-progress-fill" style="width: ${progress}%"></div></div>
                    </div>

                    <div id="q-content-area"></div>

                    <div class="ms-timer-area">
                        <div class="ms-circular">
                            <svg width="100" height="100">
                                <circle class="bg" cx="50" cy="50" r="45"></circle>
                                <circle class="prog" id="timer-prog" cx="50" cy="50" r="45"></circle>
                            </svg>
                            <span class="ms-timer-label">Qolgan vaqt:</span>
                            <span class="ms-timer-val" id="timer-text">${m}:${s < 10 ? '0' : ''}${s}</span>
                        </div>
                    </div>

                    <div class="ms-nav-area">
                        <button class="ms-prev-btn" id="go-prev"><i data-lucide="arrow-left" style="width:20px; color:white"></i></button>
                        <button class="ms-next-btn" id="go-next">Keyingi savol <i data-lucide="arrow-right" style="width:18px"></i></button>
                    </div>

                    <div class="ms-dots" id="ms-dots-container"></div>
                </div>
            </div>
        `;
    }

    // Update parts
    const contentArea = container.querySelector('#q-content-area');
    const progText = container.querySelector('#q-progress-text');
    const progFill = container.querySelector('#q-progress-fill');
    const dotsContainer = container.querySelector('#ms-dots-container');

    progText.innerText = `Savollar: ${currentQ + 1} / ${test.questions.length}`;
    progFill.style.width = `${progress}%`;

    contentArea.innerHTML = `
        <div class="ms-question-card">
            <h2 class="ms-q-title">${q.text}</h2>
            ${q.image ? `<img src="${q.image}" class="ms-q-image" style="width:100%; border-radius:12px; margin-bottom:15px; object-fit:contain; max-height:300px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.05)">` : ''}
            <div class="ms-options">
                ${q.type === 'text' ? `<textarea id="text-ans" placeholder="Javobingizni yozing..." class="ms-input" style="height:150px">${answers[currentQ] || ''}</textarea>` :
            q.type === 'date' ? `<input type="date" id="date-ans" class="ms-input" value="${answers[currentQ] || ''}">` :
                q.options.map((o, i) => `
                    <div class="ms-option-item ms-opt-${i % 4} ${answers[currentQ] === o.text ? 'selected' : ''}" data-text="${o.text}">
                        <div class="ms-letter-box">${String.fromCharCode(65 + i)}</div>
                        <span class="ms-opt-text">${o.text}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    dotsContainer.innerHTML = test.questions.map((_, i) => `<div class="ms-dot ${i === currentQ ? 'active' : ''}"></div>`).join('');

    const goPrev = document.getElementById('go-prev');
    goPrev.style.opacity = currentQ === 0 ? '0.3' : '1';
    goPrev.style.cursor = currentQ === 0 ? 'default' : 'pointer';

    if (window.lucide) window.lucide.createIcons();

    // Interaction

    container.querySelectorAll('.ms-option-item').forEach(btn => {
        btn.onclick = () => {
            btn.classList.add('selected');
            answers[currentQ] = btn.dataset.text;
            setTimeout(doNext, 350);
        };
    });

    const doNext = () => {
        let val = null;
        if (q.type === 'text') val = document.getElementById('text-ans').value;
        else if (q.type === 'date') val = document.getElementById('date-ans').value;
        else val = answers[currentQ];

        if (!val) return showToast("Iltimos, javobni kiriting", "warning");
        answers[currentQ] = val;

        if (currentQ === test.questions.length - 1) finishTest(container);
        else {
            currentQ++;
            renderQuestion(container);
        }
    };

    document.getElementById('go-next').onclick = doNext;
    document.getElementById('go-prev').onclick = () => {
        if (currentQ > 0) {
            if (q.type === 'text') answers[currentQ] = document.getElementById('text-ans').value;
            if (q.type === 'date') answers[currentQ] = document.getElementById('date-ans').value;
            currentQ--;
            renderQuestion(container);
        }
    };
}

async function finishTest(container) {
    if (timer) clearInterval(timer);
    container.innerHTML = `<div class="ms-page" style="align-items:center; justify-content:center"><div class="loader"></div></div>`;

    let score = 0;
    test.questions.forEach((q, i) => {
        if (q.type === 'weighted' && answers[i]) {
            const opt = q.options.find(o => o.text === answers[i]);
            if (opt) score += (opt.points || 0);
        }
    });

    try {
        // 1. Calculate Portrait Data and Conclusion
        let conclusion = "";
        if (test.interpretations) {
            const match = test.interpretations.find(i => score >= i.min && score <= i.max);
            if (match) conclusion = match.text;
        }

        const portraitData = [];
        test.questions.forEach((q, i) => {
            let finalAns = answers[i] || '---';
            if ((q.type === 'single' || q.type === 'weighted') && q.options) {
                const opt = q.options.find(o => o.text === answers[i]);
                if (opt && opt.profileComment) finalAns = opt.profileComment;
            }
            const label = q.qComment || q.text;
            portraitData.push({ label: label, value: finalAns });
        });

        // 2. Save Submission
        await addDoc(collection(db, "submissions"), {
            testId: test.id,
            testTitle: test.title,
            assignmentId: assignment.id,
            groupId: assignment.groupId,
            studentName: studentName,
            answers: answers,
            score: score,
            conclusion: conclusion,
            portraitData: test.isProfileData ? portraitData : null,
            timestamp: serverTimestamp(),
            isProfileData: !!test.isProfileData
        });

        // 3. Update Student Profile if important
        if (test.isProfileData) {
            const groupRef = doc(db, "groups", assignment.groupId);
            const groupSnap = await getDoc(groupRef);
            if (groupSnap.exists()) {
                const data = groupSnap.data();
                const sIdx = (data.students || []).findIndex(s => s.name === studentName);
                if (sIdx !== -1) {
                    const profileData = data.students[sIdx].profileData || {};

                    // Append summary of this test to profile
                    profileData[test.title] = `${score} ball: ${conclusion}`;

                    const existingPortrait = data.students[sIdx].portrait || [];

                    // SMART MERGE: Remove existing data for this specific test section to prevent duplication on retries
                    let filteredPortrait = [];
                    let skipMode = false;
                    existingPortrait.forEach(entry => {
                        if (entry.label === "--- SECTION ---" && entry.value === test.title) {
                            skipMode = true;
                        } else if (entry.label === "--- SECTION ---") {
                            skipMode = false;
                        }
                        if (!skipMode) filteredPortrait.push(entry);
                    });

                    const newEntries = [
                        { label: "--- SECTION ---", value: test.title },
                        ...portraitData
                    ];

                    // ORDERING: If this is a 'Portrait' or 'Ijtimoiy' test, we put it at the top
                    const isPriority = test.title.toLowerCase().includes('portret') || test.title.toLowerCase().includes('ijtimoiy');

                    if (isPriority) {
                        data.students[sIdx].portrait = [...newEntries, ...filteredPortrait];
                    } else {
                        data.students[sIdx].portrait = [...filteredPortrait, ...newEntries];
                    }

                    data.students[sIdx].profileData = profileData;
                    await updateDoc(groupRef, { students: data.students });
                }
            }
        }

        if (mergedIds.length > 0 && currentMergedIdx < mergedIds.length - 1) {
            // Transition to next section
            currentMergedIdx++;
            const nextTestRef = doc(db, "tests", mergedIds[currentMergedIdx]);

            container.innerHTML = `
                <div class="ms-page ms-animate-fade">
                    <div class="ms-wrapper" style="justify-content:center; align-items:center; text-align:center">
                        <div class="ms-question-card" style="padding:40px">
                            <div class="icon-circle primary mx-auto mb-4" style="width:80px; height:80px"><i data-lucide="check-circle" style="width:40px; height:40px"></i></div>
                            <h2 style="font-weight:900; color:#1B2559">Bo'lim yakunlandi</h2>
                            <p class="text-muted mb-4">Navbatdagi bo'limga tayyorlaning...</p>
                            <div class="loader mx-auto mb-4" style="border-top-color:var(--ms-primary)"></div>
                            <p id="next-title" style="font-weight:700; color:var(--ms-primary); opacity:0">Yuklanmoqda...</p>
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();

            const nextSnap = await getDoc(nextTestRef);
            if (nextSnap.exists()) {
                test = { id: nextSnap.id, ...nextSnap.data() };
                currentQ = 0;
                answers = new Array(test.questions.length).fill(null);
                totalTimeSeconds = (test.timeLimit || 30) * 60;

                const nextP = document.getElementById('next-title');
                nextP.innerText = test.title;
                nextP.style.opacity = 1;
                nextP.classList.add('animate-scale');

                setTimeout(() => {
                    startTimer(container);
                    renderQuestion(container);
                }, 2000);
                return;
            }
        }

        renderSuccess(container, score);
    } catch (e) {
        showToast("Xatolik yuz berdi: " + e.message, "error");
    }
}

function renderSuccess(container, score) {
    const hasInterpretations = test.interpretations && test.interpretations.length > 0;
    let conclusion = "So'rovnomada ishtirok etganingiz uchun rahmat!";
    let interpretationTitle = "Natija saqlandi";

    if (hasInterpretations && !test.hideResults) {
        interpretationTitle = "Sizning natijangiz";
        const match = test.interpretations.find(i => score >= i.min && score <= i.max);
        if (match) conclusion = match.text;
    }

    container.innerHTML = `
        <div class="ms-page ms-animate-fade">
            <div class="ms-wrapper" style="align-items:center; justify-content:center">
                <div class="ms-question-card animate-scale" style="max-width: 480px; text-align: center; padding: 40px 30px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);">
                    <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--ms-primary); opacity: 0.1; filter: blur(50px); border-radius: 50%;"></div>
                    
                    <div class="ms-success-icon-wrapper" style="margin-bottom: 25px; position: relative; display: inline-block;">
                        <div style="width: 80px; height: 80px; background: rgba(45, 212, 191, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                            <i data-lucide="party-popper" style="width: 40px; height: 40px; color: var(--ms-primary);"></i>
                        </div>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; background: var(--ms-primary); opacity: 0.2; border-radius: 50%; z-index: -1;"></div>
                    </div>

                    <h1 style="font-weight: 900; font-size: 2.2rem; margin-bottom: 8px; color: #1B2559; letter-spacing: -0.5px;">Tabriklaymiz!</h1>
                    <p style="opacity: 0.6; margin-bottom: 30px; font-weight: 500; font-size: 1.05rem; color: #1B2559;">${(hasInterpretations && !test.hideResults) ? 'Siz testni muvaffaqiyatli yakunladingiz' : 'Sizning ma\'lumotlaringiz muvaffaqiyatli saqlandi'}</p>
                    
                    <div style="background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%); padding: 30px 20px; border-radius: 28px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.03); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                        ${(hasInterpretations && !test.hideResults) ? `
                            <div style="text-transform: uppercase; font-size: 0.75rem; font-weight: 800; color: var(--ms-primary); letter-spacing: 1.5px; margin-bottom: 10px;">${interpretationTitle}</div>
                            <h2 style="font-size: 4rem; font-weight: 900; color: #4318FF; line-height: 1; margin-bottom: 15px; text-shadow: 0 10px 20px rgba(67, 24, 255, 0.1);">${score}<span style="font-size: 1.5rem; opacity: 0.5; margin-left: 5px;">ball</span></h2>
                            <div style="font-weight: 700; line-height: 1.5; font-size: 1.15rem; color: #1B2559; padding: 0 10px;">${conclusion}</div>
                        ` : `
                            <div style="font-weight: 700; line-height: 1.6; font-size: 1.2rem; color: #1B2559;">So'rovnomada ishtirok etganingiz uchun rahmat! Natijalaringiz tizimga saqlandi.</div>
                        `}
                    </div>
                    
                    <p style="opacity: 0.5; font-size: 0.9rem; color: #1B2559;">Test muvaffaqiyatli yakunlandi. <br> Oynani yopishingiz mumkin.</p>

                    <div class="ms-contact-card" style="margin-top: 25px; background: rgba(67, 24, 255, 0.03); border: 1px dashed rgba(67, 24, 255, 0.15); border-radius: 18px; padding: 15px; display: flex; align-items: center; gap: 12px; text-align: left;">
                        <div style="background: var(--ms-primary); color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i data-lucide="help-circle" style="width: 18px;"></i>
                        </div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: #1B2559; line-height: 1.4">
                            Psixologik maslahat uchun: <br><strong>A bino 203 - psixolog xonasi</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes ping {
                75%, 100% { transform: scale(2); opacity: 0; }
            }
            .ms-next-btn:hover {
                transform: translateY(-2px);
            }
        </style>
    `;
    if (window.lucide) window.lucide.createIcons();
}
