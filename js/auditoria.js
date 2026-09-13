/**
 * MÓDULO DE AUDITORÍA
 */
const AuditoriaModule = (() => {
    return {
        async render() {
            const logs = await StorageModule.getAuditoria();
            const tbody = document.getElementById('tbl-auditoria');
            tbody.innerHTML = '';

            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay registros de auditoría.</td></tr>';
                return;
            }

            logs.forEach(l => {
                const fechaFormat = l.fecha_hora ? new Date(l.fecha_hora).toLocaleString() : '-';
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${l.usuario || 'Admin'}</strong></td>
                        <td>${l.accion}</td>
                        <td>${l.modulo}</td>
                        <td>${l.registro || '-'}</td>
                        <td>${fechaFormat}</td>
                    </tr>
                `;
            });
        }
    };
})();