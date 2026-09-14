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
        const toggleBtn = document.getElementById('toggle-menu');
        const sidebar = document.getElementById('sidebar');

        // 1. Crear el overlay dinámico para móviles si no existe en el DOM
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        // Función auxiliar para cerrar el menú lateral en móviles
        const cerrarMenuMobile = () => {
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        };

        // Función auxiliar para alternar (abrir/cerrar) el menú lateral
        const toggleSidebar = () => {
            if (sidebar) sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        };

        // Control de clics en el botón hamburguesa y en el overlay oscuro
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebar);
        }
        if (overlay) {
            overlay.addEventListener('click', cerrarMenuMobile);
        }

        // 2. Navegación entre secciones y Auto-Recogido en móviles
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-target');

                navLinks.forEach(l => l.classList.remove('active'));
                pages.forEach(p => p.classList.remove('active'));

                link.classList.add('active');
                const targetPage = document.getElementById(target);
                if (targetPage) targetPage.classList.add('active');

                // Recoger el menú lateral automáticamente si estamos en un dispositivo móvil
                if (window.innerWidth <= 768) {
                    cerrarMenuMobile();
                }

                // Renderizar la vista correspondiente al cambiar de pestaña
                if (target === 'view-dashboard' && typeof DashboardModule !== 'undefined') DashboardModule.render();
                if (target === 'view-clientes' && typeof ClientesModule !== 'undefined') ClientesModule.render();
                if (target === 'view-prestamos' && typeof PrestamosModule !== 'undefined') PrestamosModule.render();
                if (target === 'view-pagos' && typeof PagosModule !== 'undefined') PagosModule.render();
                if (target === 'view-recibos' && typeof RecibosModule !== 'undefined') RecibosModule.render();
                if (target === 'view-auditoria' && typeof AuditoriaModule !== 'undefined') AuditoriaModule.render();
            });
        });
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