/**
 * MÓDULO PRINCIPAL DE LA APLICACIÓN Y NAVEGACIÓN
 */
document.addEventListener('DOMContentLoaded', () => {
    AppModule.init();
});

const AppModule = (() => {
    const showToast = (msg) => {
        const container = document.getElementById('toast-container');
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
                document.getElementById(target).classList.add('active');

                // Renderizar la vista correspondiente
                if (target === 'view-dashboard') DashboardModule.render();
                if (target === 'view-clientes') ClientesModule.render();
                if (target === 'view-prestamos') PrestamosModule.render();
                if (target === 'view-pagos') PagosModule.render();
                if (target === 'view-recibos') RecibosModule.render();
                if (target === 'view-auditoria') AuditoriaModule.render();
            });
        });

        // Sidebar responsive toggle
        const toggleBtn = document.getElementById('toggle-menu');
        const sidebar = document.getElementById('sidebar');
        if (toggleBtn) {
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

        if (togglePassBtn) {
            togglePassBtn.addEventListener('click', () => {
                const isPass = passInput.getAttribute('type') === 'password';
                passInput.setAttribute('type', isPass ? 'text' : 'password');
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            authContainer.style.display = 'none';
            showToast('¡Sesión iniciada correctamente!');
            DashboardModule.render();
        });

        document.getElementById('btn-logout').addEventListener('click', () => {
            authContainer.style.display = 'flex';
            showToast('Sesión cerrada');
        });
    };

    return {
        init() {
            initNavigation();
            initAuth();
            DashboardModule.render();
        },
        toast: showToast
    };
})();