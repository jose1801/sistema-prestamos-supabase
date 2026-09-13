/**
 * MÓDULO DASHBOARD
 */
const DashboardModule = (() => {
    return {
        async render() {
            const clientes = await StorageModule.getClientes();
            const prestamos = await StorageModule.getPrestamos();
            const pagos = await StorageModule.getPagos();

            let totalPrestado = 0;
            let totalSaldo = 0;
            prestamos.forEach(p => {
                totalPrestado += parseFloat(p.total || 0);
                totalSaldo += parseFloat(p.saldo || 0);
            });

            let totalCobrado = pagos.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0);

            document.getElementById('kpi-clientes').innerText = clientes.length;
            document.getElementById('kpi-prestamos').innerText = prestamos.filter(p => p.estado === 'Activo').length;
            document.getElementById('kpi-prestado').innerText = `$${totalPrestado.toFixed(2)}`;
            document.getElementById('kpi-cobrado').innerText = `$${totalCobrado.toFixed(2)}`;
            document.getElementById('kpi-pendiente').innerText = `$${totalSaldo.toFixed(2)}`;

            // Render Widget Próximos Vencimientos
            const tbody = document.getElementById('widget-vencimientos');
            tbody.innerHTML = '';
            
            let count = 0;
            prestamos.forEach(p => {
                if (p.cuotas) {
                    p.cuotas.filter(c => c.estado === 'Pendiente').slice(0, 5).forEach(c => {
                        count++;
                        tbody.innerHTML += `
                            <tr>
                                <td>${p.codigo || p.id}</td>
                                <td>#${c.num_cuota}</td>
                                <td>$${parseFloat(c.valor_cuota).toFixed(2)}</td>
                                <td>${c.fecha_vencimiento}</td>
                                <td><span class="badge badge-warning">Pendiente</span></td>
                            </tr>
                        `;
                    });
                }
            });

            if (count === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay cuotas pendientes registradas.</td></tr>';
            }
        }
    };
})();