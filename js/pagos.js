/**
 * MÓDULO COBROS & PAGOS
 */
const PagosModule = (() => {
    return {
        async render() {
            const prestamos = await StorageModule.getPrestamos();
            const select = document.getElementById('pago-prestamo-id');
            select.innerHTML = '<option value="">Seleccione un préstamo activo...</option>';
            
            prestamos.filter(p => p.saldo > 0).forEach(p => {
                const nombre = p.clientes ? p.clientes.nombre : '';
                select.innerHTML += `<option value="${p.id}">${p.codigo || p.id} - ${nombre} (Saldo: $${parseFloat(p.saldo).toFixed(2)})</option>`;
            });

            document.getElementById('pago-detalles-cuota').style.display = 'none';
        },

        async onPrestamoChange() {
            const id = document.getElementById('pago-prestamo-id').value;
            if (!id) {
                document.getElementById('pago-detalles-cuota').style.display = 'none';
                return;
            }

            const prestamo = await StorageModule.getPrestamoById(id);
            let proxima = null;
            if (prestamo.cuotas) {
                proxima = prestamo.cuotas.find(c => c.estado === 'Pendiente');
            }

            const container = document.getElementById('pago-detalles-cuota');
            if (proxima) {
                container.style.display = 'block';
                container.setAttribute('data-cuota-id', proxima.id || proxima.num_cuota);
                container.innerHTML = `
                    <p style="font-size:0.85rem; color:var(--text-muted);">Próxima Cuota a Pagar: <strong>#${proxima.num_cuota}</strong></p>
                    <p style="font-size:0.95rem; font-weight:bold; color:var(--accent);">Monto Sugerido Cuota: $${parseFloat(proxima.valor_cuota).toFixed(2)}</p>
                `;
                document.getElementById('pago-monto').value = parseFloat(proxima.valor_cuota).toFixed(2);
            } else {
                container.style.display = 'none';
            }
        }
    };
})();

document.getElementById('form-pago').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const metodo = document.getElementById('pago-metodo').value;
    const obs = document.getElementById('pago-observaciones').value;

    const prestamo = await StorageModule.getPrestamoById(prestamoId);
    const nuevoSaldo = prestamo.saldo - monto;
    
    const container = document.getElementById('pago-detalles-cuota');
    const cuotaId = container.getAttribute('data-cuota-id');

    const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);

    const pagoData = {
        num_recibo: numRecibo,
        prestamo_id: prestamoId,
        cuota_id: cuotaId || null,
        monto,
        fecha: new Date().toISOString().split('T')[0],
        metodo,
        observaciones: obs
    };

    try {
        await StorageModule.registrarPago(pagoData, cuotaId, nuevoSaldo);
        await StorageModule.logAudit('Registró pago', 'Pagos', `${numRecibo} - $${monto}`);
        AppModule.toast('Pago procesado correctamente');
        
        // Cargar y mostrar recibo inmediatamente
        RecibosModule.generarDirecto(pagoData, prestamo);
    } catch (err) {
        AppModule.toast('Error al registrar pago');
        console.error(err);
    }
});