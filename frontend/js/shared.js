export function renderStatusPill(status) {
    status = status || 'RUNNING';
    const label = status.replace(/_/g, ' ');
    return `<span class="status-pill status-${status}">${label}</span>`;
}

export function renderStatCard(icon, colorAccent, pillLabel, number, subtitle) {
    return `
        <div class="stat-card">
            <div class="stat-card-header">
                <!-- Using inline styles mapped to theme vars dynamically just for the pill -->
                <span class="status-pill" style="background: rgba(var(--color-${colorAccent}-rgb, 200,200,200), 0.1); color: var(--color-${colorAccent}); border: 1px solid var(--color-${colorAccent})">${pillLabel}</span>
                <div class="stat-icon" style="background: var(--color-${colorAccent}); color: white;">
                    <span class="material-icons">${icon}</span>
                </div>
            </div>
            <div class="stat-number count-up" data-target="${number}">0</div>
            <div class="stat-subtitle">${subtitle}</div>
        </div>
    `;
}

export function confirmModal(message, onConfirm) {
    const existingModal = document.querySelector('.confirm-backdrop');
    if (existingModal) existingModal.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop confirm-backdrop';
    backdrop.innerHTML = `
        <div class="modal-card" style="max-width: 400px; text-align: center;">
            <div class="modal-body" style="padding: 30px 20px 10px;">
                <div style="margin-bottom: 20px;">
                    <span class="material-icons" style="font-size: 48px; color: var(--color-orange); opacity: 0.8;">warning</span>
                </div>
                <h3 style="margin-bottom: 12px; line-height: 1.4;">${message}</h3>
            </div>
            <div class="modal-footer" style="justify-content: center; gap: 12px; border-top: none; padding-bottom: 24px;">
                <button type="button" class="btn btn-ghost" id="confirmCancelBtn">Cancel</button>
                <button type="button" class="btn btn-primary" id="confirmOkBtn" style="background: var(--color-red); border-color: var(--color-red);">Yes, Delete</button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    void backdrop.offsetWidth;
    backdrop.classList.add('active');

    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.remove(), 300);
    };

    backdrop.querySelector('#confirmCancelBtn').onclick = closeModal;
    backdrop.querySelector('#confirmOkBtn').onclick = () => {
        closeModal();
        onConfirm();
    };
}

export function renderModal(title, formHTML, onSave) {
    const existingModal = document.querySelector('.modal-backdrop');
    if (existingModal) existingModal.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <div class="modal-title">${title}</div>
                <button class="modal-close"><span class="material-icons">close</span></button>
            </div>
            <div class="modal-body">
                <form id="dynamicModalForm">
                    ${formHTML}
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-ghost" id="modalCancelBtn">Cancel</button>
                <button type="button" class="btn btn-primary" id="modalSaveBtn">Save</button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    // Request reflow to trigger transition
    void backdrop.offsetWidth;
    backdrop.classList.add('active');

    const closeModal = () => {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.remove(), 300);
    };

    backdrop.querySelector('.modal-close').onclick = closeModal;
    backdrop.querySelector('#modalCancelBtn').onclick = closeModal;
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });

    backdrop.querySelector('#modalSaveBtn').onclick = () => {
        onSave(document.getElementById('dynamicModalForm'), closeModal);
    };

    document.addEventListener('keydown', function escListener(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escListener);
        }
    });
}

export function renderDataTable(columns, rowsHTML) {
    if (!rowsHTML || rowsHTML.trim() === '') {
        return `
            <div style="padding: 40px; text-align: center; color: var(--color-text-muted);">
                <span class="material-icons" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">inbox</span>
                <h3>No data found</h3>
            </div>
        `;
    }

    return `
        <table class="data-table">
            <thead>
                <tr>
                    ${columns.map(c => `<th>${c}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
    `;
}

export function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check_circle' : 'error';
    const color = type === 'success' ? 'var(--color-green)' : 'var(--color-red)';
    
    toast.innerHTML = `
        <span class="material-icons" style="color: ${color}">${icon}</span>
        <div style="font-size: 14px; font-weight: 500;">${message}</div>
    `;

    container.appendChild(toast);
    
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function initGlobalUI() {
    // Dark mode toggle
    const themeToggle = document.getElementById('switch');
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'light';

        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Highlighting active nav item seamlessly based on URL
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.sidebar-item').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });

    setupSidebarToggle();
    animateCountUps();
}

function setupSidebarToggle() {
    // Create overlay if it doesn't exist
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileMenuCloseBtn');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // Close on overlay click
    if (overlay && sidebar) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // Optional: close sidebar when a link is clicked (useful for mobile)
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });
    });
}

export function animateCountUps() {
    document.querySelectorAll('.count-up').forEach(el => {
        const target = parseInt(el.getAttribute('data-target') || '0', 10);
        let start = 0;
        const duration = 300; 
        const fps = 60;
        const step = target / (duration / (1000 / fps));
        
        const counter = setInterval(() => {
            start += step;
            if (start >= target) {
                el.innerText = target;
                clearInterval(counter);
            } else {
                el.innerText = Math.floor(start);
            }
        }, 1000 / fps);
    });
}
