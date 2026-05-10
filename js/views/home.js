export async function renderHome(container) {
    container.innerHTML = `
        <div class="container animate-fade">
            <section class="hero-section text-center">
                <div class="hero-badge animate-float">
                    <i data-lucide="sparkles"></i>
                    <span>Yangi avlod psixologik tahlil</span>
                </div>
                <h1 class="hero-title">O'zligingizni <br><span class="text-gradient">Kashf Eting</span></h1>
                <p class="hero-subtitle">Talabalar va xodimlar uchun professional psixologik so'rovnomalar platformasi. Biz bilan o'z imkoniyatlaringizni tahlil qiling.</p>
                
                <div class="action-buttons mt-3">
                    <button class="btn btn-primary btn-lg" id="btn-start-explore">
                        <i data-lucide="compass"></i>
                        Testlarni ko'rish
                    </button>
                    <button class="btn btn-outline btn-lg" onclick="location.hash='login'">
                        <i data-lucide="shield"></i>
                        Admin Panel
                    </button>
                </div>

                <div class="features-grid grid grid-3 mt-3">
                    <div class="card feature-card">
                        <div class="feature-icon primary">
                            <i data-lucide="zap"></i>
                        </div>
                        <h3>Tezkor Testlar</h3>
                        <p>Qisqa va aniq savollar orqali tezkor natijalarga ega bo'ling.</p>
                    </div>
                    <div class="card feature-card">
                        <div class="feature-icon secondary">
                            <i data-lucide="bar-chart"></i>
                        </div>
                        <h3>Chuqur Tahlil</h3>
                        <p>Har bir javobingiz professional algoritmlar orqali tahlil qilinadi.</p>
                    </div>
                    <div class="card feature-card">
                        <div class="feature-icon accent">
                            <i data-lucide="lock"></i>
                        </div>
                        <h3>Xavfsizlik</h3>
                        <p>Sizning natijalaringiz va shaxsiy ma'lumotlaringiz to'liq himoyalangan.</p>
                    </div>
                </div>
            </section>
        </div>

        <style>
            .hero-section {
                padding: 6rem 0;
                max-width: 1000px;
                margin: 0 auto;
            }
            .hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: var(--surface-hover);
                border: 1px solid var(--border);
                border-radius: 30px;
                font-size: 0.9rem;
                font-weight: 700;
                color: var(--primary);
                margin-bottom: 2rem;
            }
            .hero-title {
                font-size: 5rem;
                line-height: 1.1;
                margin-bottom: 2rem;
                letter-spacing: -0.02em;
            }
            .text-gradient {
                background: linear-gradient(to right, var(--primary), var(--secondary));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .hero-subtitle {
                font-size: 1.4rem;
                color: var(--text-muted);
                max-width: 700px;
                margin: 0 auto 3rem;
                line-height: 1.6;
            }
            .btn-lg {
                padding: 1.25rem 3rem;
                font-size: 1.2rem;
            }
            .feature-card {
                padding: 3rem 2rem;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            .feature-icon {
                width: 60px;
                height: 60px;
                border-radius: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem;
                font-size: 1.5rem;
            }
            .feature-icon.primary { background: var(--primary-glow); color: var(--primary); }
            .feature-icon.secondary { background: var(--secondary-glow); color: var(--secondary); }
            .feature-icon.accent { background: rgba(6, 182, 212, 0.2); color: var(--accent); }
            
            .feature-card h3 {
                margin-bottom: 1rem;
                font-size: 1.5rem;
            }
            .feature-card p {
                color: var(--text-muted);
                font-size: 1rem;
            }

            @media (max-width: 768px) {
                .hero-title { font-size: 3rem; }
                .hero-subtitle { font-size: 1.1rem; }
            }
        </style>
    `;

    document.getElementById('btn-start-explore')?.addEventListener('click', () => {
        window.scrollTo({ top: 800, behavior: 'smooth' });
    });
}

