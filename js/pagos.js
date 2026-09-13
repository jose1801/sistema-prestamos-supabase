/**
 * MÓDULO COBROS & PAGOS
 */
const PagosModule = (() => {
    return {
        async render() {
            const prestamos = await StorageModule.getPrestamos();
            const select = document.getElementById('pago-prestamo-id');
            if (!select) return;

            select.innerHTML = '<option value="">Seleccione un préstamo activo...</option>';
            
            // Filtrar préstamos con saldo pendiente
            prestamos.filter(p => (p.saldo_restante ?? p.saldo ?? 0) > 0).forEach(p => {
                const nombre = p.clientes ? p.clientes.nombre : 'Sin nombre';
                const saldoActual = parseFloat(p.saldo_restante ?? p.saldo ?? 0);
                select.innerHTML += `<option value="${p.id}">${p.codigo || p.id} - ${nombre} (Saldo: $${saldoActual.toFixed(2)})</option>`;
            });

            document.getElementById('pago-detalles-cuota').style.display = 'none';
        },

        async onPrestamoChange() {
            const id = document.getElementById('pago-prestamo-id').value;
            const container = document.getElementById('pago-detalles-cuota');
            if (!container) return;

            if (!id) {
                container.style.display = 'none';
                return;
            }

            const prestamo = await StorageModule.getPrestamoById(id);
            const cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
            
            let proxima = cuotas.find(c => c.estado === 'Pendiente');
            const hoy = new Date();

            // Detectar si existen cuotas atrasadas acumuladas
            const atrasadas = cuotas.filter(c => c.estado === 'Pendiente' && c.fecha_vencimiento && new Date(c.fecha_vencimiento) < hoy);

            if (proxima) {
                container.style.display = 'block';
                container.setAttribute('data-cuota-id', proxima.id || proxima.num_cuota);
                
                let alertaAtraso = '';
                if (atrasadas.length > 0) {
                    alertaAtraso = `<p style="font-size:0.8rem; color:var(--danger); font-weight:bold; margin-top:4px;">⚠️ Cuotas con atraso: ${atrasadas.length}</p>`;
                }

                container.innerHTML = `
                    <p style="font-size:0.85rem; color:var(--text-muted);">Próxima Cuota a Pagar: <strong>#${proxima.num_cuota || proxima.numero}</strong></p>
                    <p style="font-size:0.95rem; font-weight:bold; color:var(--accent);">Monto Sugerido Cuota: $${parseFloat(proxima.valor_cuota || proxima.monto || 0).toFixed(2)}</p>
                    ${alertaAtraso}
                `;
                document.getElementById('pago-monto').value = parseFloat(proxima.valor_cuota || proxima.monto || 0).toFixed(2);
            } else {
                container.style.display = 'none';
                document.getElementById('pago-monto').value = '';
            }
        }
    };
})();

// EVENTO SUBMIT DEL FORMULARIO DE PAGO
document.getElementById('form-pago').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const metodo = document.getElementById('pago-metodo').value;
    const obs = document.getElementById('pago-observaciones').value;

    if (!prestamoId || isNaN(monto) || monto <= 0) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Por favor ingrese un monto válido');
        }
        return;
    }

    const prestamo = await StorageModule.getPrestamoById(prestamoId);
    const saldoActual = parseFloat(prestamo.saldo_restante ?? prestamo.saldo ?? 0);
    const nuevoSaldo = Math.max(0, saldoActual - monto);
    
    const container = document.getElementById('pago-detalles-cuota');
    const cuotaId = container.getAttribute('data-cuota-id');
    const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);

    const pagoData = {
        num_recibo: numRecibo,
        prestamo_id: prestamoId,
        cuota_id: cuotaId || null,
        monto: monto,
        fecha: new Date().toISOString().split('T')[0],
        metodo: metodo,
        observaciones: obs,
        sancion: 0.00
    };

    try {
        await StorageModule.registrarPago(pagoData, cuotaId, nuevoSaldo);
        
        if (typeof StorageModule.logAudit === 'function') {
            await StorageModule.logAudit('Registró pago', 'Pagos', `${numRecibo} - $${monto.toFixed(2)}`);
        }
        
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Pago procesado correctamente');
        }

        // Limpiar campos del formulario
        document.getElementById('form-pago').reset();
        container.style.display = 'none';

        // Actualizar datos locales del préstamo para el recibo
        prestamo.saldo_restante = nuevoSaldo;

        // Cargar y mostrar ticket inmediatamente
        await RecibosModule.generarDirecto(pagoData, prestamo);
    } catch (err) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Error al registrar pago');
        }
        console.error(err);
    }
});