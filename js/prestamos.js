/**
 * MÓDULO PRÉSTAMOS & CÁLCULO DE AMORTIZACIÓN
 */
const PrestamosModule = (() => {
    return {
        async render() {
            const prestamos = await StorageModule.getPrestamos();
            const tbody = document.getElementById('tbl-prestamos');
            tbody.innerHTML = '';

            if (prestamos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay préstamos registrados.</td></tr>';
                return;
            }

            prestamos.forEach(p => {
                const nombreCliente = p.clientes ? p.clientes.nombre : 'Cliente';
                const badgeClass = p.estado === 'Activo' ? 'badge-warning' : 'badge-success';
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${p.codigo || p.id}</strong></td>
                        <td>${nombreCliente}</td>
                        <td>$${parseFloat(p.monto).toFixed(2)}</td>
                        <td>${p.interes_pct}%</td>
                        <td>$${parseFloat(p.total).toFixed(2)}</td>
                        <td>$${parseFloat(p.saldo).toFixed(2)}</td>
                        <td><span class="badge ${badgeClass}">${p.estado}</span></td>
                        <td>
                            <button class="btn btn-sm btn-secondary" onclick="PrestamosModule.verDetalle('${p.id}')">Ver Cuotas</button>
                        </td>
                    </tr>
                `;
            });
        },

        async openModal() {
            const clientes = await StorageModule.getClientes();
            const select = document.getElementById('pres-cliente-id');
            select.innerHTML = '';
            clientes.forEach(c => select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.cedula})</option>`);
            
            this.calcularAmortizacion();
            document.getElementById('modal-prestamo').classList.add('active');
        },

        closeModal() {
            document.getElementById('modal-prestamo').classList.remove('active');
        },

        closeDetalleModal() {
            document.getElementById('modal-prestamo-detalle').classList.remove('active');
        },

        async verDetalle(id) {
            const prestamo = await StorageModule.getPrestamoById(id);
            document.getElementById('modal-detalle-codigo').innerText = `Préstamo ${prestamo.codigo || prestamo.id}`;
            document.getElementById('detalle-prestamo-info').innerHTML = `
                <p><strong>Cliente:</strong> ${prestamo.clientes ? prestamo.clientes.nombre : 'N/A'}</p>
                <p><strong>Monto Total:</strong> $${parseFloat(prestamo.total).toFixed(2)} | <strong>Saldo Restante:</strong> $${parseFloat(prestamo.saldo).toFixed(2)}</p>
            `;

            const tbody = document.getElementById('tbl-detalle-cuotas');
            tbody.innerHTML = '';
            if (prestamo.cuotas) {
                prestamo.cuotas.forEach(c => {
                    const badge = c.estado === 'Pagado' ? 'badge-success' : 'badge-warning';
                    tbody.innerHTML += `
                        <tr>
                            <td>Cuota #${c.num_cuota}</td>
                            <td>${c.fecha_vencimiento}</td>
                            <td>$${parseFloat(c.valor_cuota).toFixed(2)}</td>
                            <td><span class="badge ${badge}">${c.estado}</span></td>
                        </tr>
                    `;
                });
            }
            document.getElementById('modal-prestamo-detalle').classList.add('active');
        },

        calcularAmortizacion() {
            const monto = parseFloat(document.getElementById('pres-monto').value) || 0;
            const interesPct = parseFloat(document.getElementById('pres-interes').value) || 0;
            const cuotas = parseInt(document.getElementById('pres-cuotas').value) || 1;

            const totalInteres = monto * (interesPct / 100);
            const totalPagar = monto + totalInteres;
            const valorCuota = totalPagar / cuotas;

            document.getElementById('amortizacion-preview').innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                    <div><strong>Capital:</strong> $${monto.toFixed(2)}</div>
                    <div><strong>Interés:</strong> $${totalInteres.toFixed(2)}</div>
                    <div><strong>Total Pagar:</strong> $${totalPagar.toFixed(2)}</div>
                    <div><strong>${cuotas} Cuotas de:</strong> <span style="color:var(--accent); font-weight:bold;">$${valorCuota.toFixed(2)}</span></div>
                </div>
            `;
        }
    };
})();

document.getElementById('form-prestamo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('pres-monto').value);
    const interesPct = parseFloat(document.getElementById('pres-interes').value);
    const cuotasCount = parseInt(document.getElementById('pres-cuotas').value);
    const frecuencia = document.getElementById('pres-frecuencia').value;
    const totalPagar = monto + (monto * (interesPct / 100));
    const valorCuota = totalPagar / cuotasCount;
    const codigo = 'PR-' + Math.floor(1000 + Math.random() * 9000);

    const prestamoData = {
        codigo,
        cliente_id: document.getElementById('pres-cliente-id').value,
        monto,
        interes_pct: interesPct,
        total: totalPagar,
        saldo: totalPagar,
        frecuencia,
        cuotas_count: cuotasCount,
        estado: 'Activo'
    };

    const cuotasArray = [];
    let fecha = new Date();
    for (let i = 1; i <= cuotasCount; i++) {
        if (frecuencia === 'Semanal') fecha.setDate(fecha.getDate() + 7);
        else if (frecuencia === 'Quincenal') fecha.setDate(fecha.getDate() + 15);
        else fecha.setMonth(fecha.getMonth() + 1);

        cuotasArray.push({
            num_cuota: i,
            fecha_vencimiento: fecha.toISOString().split('T')[0],
            valor_cuota: valorCuota
        });
    }

    try {
        await StorageModule.createPrestamo(prestamoData, cuotasArray);
        await StorageModule.logAudit('Otorgó préstamo', 'Préstamos', codigo);
        AppModule.toast('Préstamo registrado exitosamente');
        PrestamosModule.closeModal();
        PrestamosModule.render();
    } catch (err) {
        AppModule.toast('Error al otorgar préstamo');
        console.error(err);
    }
});