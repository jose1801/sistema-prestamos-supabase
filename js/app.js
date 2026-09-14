/**
 * MÓDULO PRINCIPAL DE LA APLICACIÓN Y NAVEGACIÓN
 */
document.addEventListener('DOMContentLoaded', () => {
    AppModule.init();
});

const AppModule = (() => {
    const showToast = (msg) => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    };

    const initNavigation = () => {
        const navLinks = document.querySelectorAll('.nav-link');
        const pages = document.querySelectorAll('.view-page');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-target');

                navLinks.forEach(l => l.classList.remove('active'));
                pages.forEach(p => p.classList.remove('active'));

                link.classList.add('active');
                const targetPage = document.getElementById(target);
                if (targetPage) targetPage.classList.add('active');

                // Renderizar la vista correspondiente al cambiar de pestaña
                if (target === 'view-dashboard' && typeof DashboardModule !== 'undefined') DashboardModule.render();
                if (target === 'view-clientes' && typeof ClientesModule !== 'undefined') ClientesModule.render();
                if (target === 'view-prestamos' && typeof PrestamosModule !== 'undefined') PrestamosModule.render();
                if (target === 'view-pagos' && typeof PagosModule !== 'undefined') PagosModule.render();
                if (target === 'view-recibos' && typeof RecibosModule !== 'undefined') RecibosModule.render();
                if (target === 'view-auditoria' && typeof AuditoriaModule !== 'undefined') AuditoriaModule.render();
            });
        });

        const toggleBtn = document.getElementById('toggle-menu');
        const sidebar = document.getElementById('sidebar');
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    };

    const initAuth = () => {
        const form = document.getElementById('login-form');
        const authContainer = document.getElementById('auth-container');
        const togglePassBtn = document.getElementById('toggle-password');
        const passInput = document.getElementById('login-pass');

        if (togglePassBtn && passInput) {
            togglePassBtn.addEventListener('click', () => {
                const isPass = passInput.getAttribute('type') === 'password';
                passInput.setAttribute('type', isPass ? 'text' : 'password');
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (authContainer) authContainer.style.display = 'none';
                showToast('¡Sesión iniciada correctamente!');
                if (typeof DashboardModule !== 'undefined') DashboardModule.render();
            });
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                if (authContainer) authContainer.style.display = 'flex';
                showToast('Sesión cerrada');
            });
        }
    };

    return {
        init() {
            initNavigation();
            initAuth();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        },
        toast: showToast
    };
})();