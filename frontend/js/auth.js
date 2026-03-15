import { api } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // If we're on a non-login page, verify auth immediately 
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        if (!localStorage.getItem('accessToken')) {
            window.location.href = 'index.html';
        }
    }

    // Login Form Handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Clear any existing session right away
        localStorage.removeItem('accessToken');

        const errorDiv = document.getElementById('errorMessage');
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const btn = loginForm.querySelector('.btn-primary');
            
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
            btn.innerHTML = '<span class="material-icons spin">refresh</span> Signing in...';
            btn.style.opacity = '0.8';

            try {
                const data = await api.auth.login({ email, password });
                
                // Store token & user data
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('adminName', data.admin.name);
                
                // Success feedback and transition
                btn.innerHTML = '<span class="material-icons">check</span> Success';
                btn.style.background = 'var(--color-green)';
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 400);

            } catch (err) {
                // Show error message via slide-up animation
                errorDiv.textContent = err.error || 'Failed to login. Please check your credentials.';
                errorDiv.classList.add('show');
                
                btn.innerHTML = '<span>Sign In</span> <span class="material-icons" style="font-size: 20px;">arrow_forward</span>';
                btn.style.opacity = '1';
                btn.style.background = 'var(--color-teal)';
            }
        });
    }

    // Shared UI Hook: Attach logout to all logout buttons
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            api.auth.logout().finally(() => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('adminName');
                window.location.href = 'index.html';
            });
        });
    }

    // Shared UI Hook: Populate Admin Name
    const adminNameEl = document.getElementById('adminName');
    if (adminNameEl) {
        const storedName = localStorage.getItem('adminName') || 'Admin';
        adminNameEl.textContent = storedName;
    }
});
