import { db, isMock } from './firebase-config.js';
import { renderHome } from './views/home.js';
import { renderAdmin } from './views/admin.js';
import { renderTest } from './views/test.js';
import { renderLogin } from './views/login.js';
import { isAdmin, showToast, initTheme } from './utils.js';
import { auth } from './firebase-config.js';

const mainContent = document.getElementById('main-content');
const navLinks = document.getElementById('nav-links');
const navLogo = document.getElementById('nav-logo');

// Router State
const state = {
    currentView: 'home',
    params: {}
};

// Route Definitions
const routes = {
    home: renderHome,
    admin: renderAdmin,
    test: renderTest,
    login: renderLogin
};

async function navigate(view, params = {}) {
    // Auth Guard
    if (view === 'admin' && !isAdmin()) {
        window.location.hash = 'login';
        return;
    }

    state.currentView = view;
    state.params = params;
    console.log("🚀 Navigating to:", view, params);

    // Show loader
    mainContent.innerHTML = `
        <div class="loader-container animate-fade" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh;">
            <div class="loader"></div>
            <p class="text-muted mt-1">Yuklanmoqda...</p>
        </div>
    `;

    const isTesting = view === 'test';
    const isAdminView = view === 'admin';
    updateNav(isTesting, isAdminView);

    // Give UI a moment to show loader
    setTimeout(async () => {
        try {
            const renderFn = routes[view];
            if (renderFn) {
                await renderFn(mainContent, params);
                if (window.lucide) window.lucide.createIcons();
                mainContent.classList.add('animate-fade');
                setTimeout(() => mainContent.classList.remove('animate-fade'), 500);
            } else {
                mainContent.innerHTML = '<div class="container card"><h1>404</h1><p>Sahifa topilmadi.</p></div>';
            }
        } catch (error) {
            console.error('Navigation error:', error);
            mainContent.innerHTML = `<div class="container card"><h2 class="text-danger">Xatolik</h2><p>${error.message}</p></div>`;
        }
    }, 100);
}

function updateNav(isTesting = false, isAdminView = false) {
    const isLogged = isAdmin();
    const navbar = document.querySelector('.navbar');
    
    if (isAdminView || isTesting) {
        if (navbar) navbar.style.display = 'none';
        return;
    } else {
        if (navbar) navbar.style.display = 'block';
    }

    navLinks.innerHTML = `
        <button class="nav-btn ${state.currentView === 'home' ? 'active' : ''}" data-view="home">Bosh sahifa</button>
        ${isLogged ? `
            <button class="nav-btn" data-view="admin">Dashboard</button>
            <button class="nav-btn" id="logout-btn"><i data-lucide="log-out"></i></button>
        ` : `
            <button class="nav-btn ${state.currentView === 'login' ? 'active' : ''}" data-view="login">Admin Panel</button>
        `}
    `;
    
    if (window.lucide) window.lucide.createIcons();
}

// Event Listeners
navLinks.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn) {
        if (btn.id === 'logout-btn') {
            import('./utils.js').then(m => m.logout());
        } else {
            window.location.hash = btn.dataset.view;
        }
    }
});

navLogo.addEventListener('click', () => { window.location.hash = 'home'; });

function handleHash() {
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('test/')) {
        const token = hash.split('/')[1];
        navigate('test', { token });
    } else {
        const view = hash || 'home';
        console.log("🔗 Hash changed to:", view);
        navigate(view);
    }
}

window.addEventListener('hashchange', handleHash);

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    // Wait for Firebase Auth to initialize before first navigation
    auth.onAuthStateChanged((user) => {
        console.log("👤 Auth State Changed:", user ? "Logged In" : "Logged Out");
        handleHash();
    });
});

export { navigate };
