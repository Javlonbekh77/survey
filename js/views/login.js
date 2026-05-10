import { showToast } from '../utils.js';

export async function renderLogin(container) {
    container.innerHTML = `
        <div class="animate-fade" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--background)">
            <div class="card" style="width: 100%; max-width: 450px; padding: 3rem;">
                <div class="text-center mb-4">
                    <h1 style="font-size: 2.2rem; font-weight: 800; color: var(--text); letter-spacing: -1px;">Xush kelibsiz!</h1>
                    <p class="text-muted">Admin panelga kirish uchun login va parolni kiriting</p>
                </div>

                <form id="login-form">
                    <div style="margin-bottom: 1.5rem">
                        <label style="display:block; font-weight:700; color:var(--text); margin-bottom:8px; font-size:0.85rem">Login</label>
                        <input type="text" id="login-user" required placeholder="admin123" style="width:100%; padding:14px; border-radius:12px; border:1px solid var(--border); background:var(--background); font-family:inherit; font-weight:600">
                    </div>
                    <div style="margin-bottom: 2rem">
                        <label style="display:block; font-weight:700; color:var(--text); margin-bottom:8px; font-size:0.85rem">Parol</label>
                        <input type="password" id="login-pass" required placeholder="••••••••" style="width:100%; padding:14px; border-radius:12px; border:1px solid var(--border); background:var(--background); font-family:inherit; font-weight:600">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; justify-content:center; padding:16px">
                        Kirish
                    </button>
                </form>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;

        // Automatically append @admin.com if user just enters a username
        const fullEmail = emailInput.includes('@') ? emailInput : `${emailInput}@admin.com`;

        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = `Tekshirilmoqda...`;

        try {
            const { auth } = await import('../firebase-config.js');
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            
            await signInWithEmailAndPassword(auth, fullEmail, pass);
            showToast("Muvaffaqiyatli kirildi", "success");
            window.location.hash = 'admin';
        } catch (error) {
            console.error("Login error:", error);
            let msg = "Login yoki parol xato!";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = "Login yoki parol xato!";
            showToast(msg, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}
