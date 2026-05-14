export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade`;
    
    let icon = 'info';
    if(type === 'success') icon = 'check-circle';
    if(type === 'error') icon = 'alert-circle';
    if(type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `<i data-lucide="${icon}"></i> <span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    };

    let timeout;
    if (duration !== Infinity) {
        timeout = setTimeout(remove, duration);
    }

    return {
        element: toast,
        update: (newMessage) => {
            toast.querySelector('.toast-message').innerText = newMessage;
        },
        remove,
        close: remove
    };
}

import { auth } from './firebase-config.js';

export function isAdmin() {
    return auth.currentUser !== null;
}

export async function logout() {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    window.location.hash = 'login';
}

// Caching
const cache = new Map();
export function setCache(key, data, ttl = 60000) {
    cache.set(key, { data, expiry: Date.now() + ttl });
}
export function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
    }
    return item.data;
}
export function clearCache() {
    cache.clear();
}

// Theme
export function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', theme === 'dark');
}

export function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Modals
export function showModal(title, content, onConfirm, confirmText = 'Tasdiqlash') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay animate-fade';
    modal.innerHTML = `
        <div class="modal-card animate-scale" style="max-width: 600px; max-height: 85vh; display: flex; flex-direction: column;">
            <div class="flex-between mb-3" style="flex-shrink: 0;">
                <h3>${title}</h3>
                <button class="btn-icon close-modal">×</button>
            </div>
            <div class="modal-body" style="overflow-y: auto; flex: 1; padding-right: 5px;">${content}</div>
            <div class="flex-between mt-4" style="flex-shrink: 0;">
                <button class="btn btn-outline close-modal">Bekor qilish</button>
                <button class="btn btn-primary confirm-modal">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('.close-modal').forEach(b => b.onclick = close);
    modal.querySelector('.confirm-modal').onclick = async () => {
        const success = await onConfirm(modal);
        if (success !== false) close();
    };
    
    if (window.lucide) window.lucide.createIcons();
    return modal;
}
