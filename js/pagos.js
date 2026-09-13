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
            
            // Establecer por defecto la fecha de hoy en el input de fecha
            const inputFecha = document.getElementById('pago-fecha');
            if (inputFecha) {
                inputFecha.value = new Date().toISOString().split('T')[0];
            }

            // Filtrar préstamos activos con saldo mayor a 0
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
            
            // Buscar la primera cuota que aún siga pendiente
            let proxima = cuotas.find(c => c.estado === 'Pendiente');
            const fechaPagoSeleccionada = document.getElementById('pago-fecha')?.value || new Date().toISOString().split('T')[0];
            const fechaPago = new Date(fechaPagoSeleccionada);

            // Detectar cuotas vencidas/atrasadas respecto a la fecha del pago
            const atrasadas = cuotas.filter(c => c.estado === 'Pendiente' && c.fecha_vencimiento && new Date(c.fecha_vencimiento) < fechaPago);

            if (proxima) {
                container.style.display = 'block';
                const numCuota = proxima.num_cuota || proxima.numero || 1;
                container.setAttribute('data-cuota-id', proxima.id || numCuota);
                
                let alertaAtraso = '';
                if (atrasadas.length > 0) {
                    alertaAtraso = `<p style="font-size:0.8rem; color:var(--danger); font-weight:bold; margin-top:4px;">⚠️ Cuotas en atraso a la fecha: ${atrasadas.length}</p>`;
                }

                container.innerHTML = `
                    <p style="font-size:0.85rem; color:var(--text-muted);">Próxima Cuota a Pagar: <strong>#${numCuota}</strong></p>
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

// SUBMIT DEL FORMULARIO DE PAGOS
document.getElementById('form-pago').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const fechaPago = document.getElementById('pago-fecha').value || new Date().toISOString().split('T')[0];
    const metodo = document.getElementById('pago-metodo').value;
    const obs = document.getElementById('pago-observaciones').value;

    if (!prestamoId || isNaN(monto) || monto <= 0) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) AppModule.toast('Ingrese un monto válido');
        return;
    }

    const prestamo = await StorageModule.getPrestamoById(prestamoId);
    let cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
    const saldoActual = parseFloat(prestamo.saldo_restante ?? prestamo.saldo ?? 0);
    const nuevoSaldo = Math.max(0, saldoActual - monto);

    // 1. Sincronizar y actualizar el estado de la cuota correspondiente a 'Pagado'
    const container = document.getElementById('pago-detalles-cuota');
    const cuotaId = container.getAttribute('data-cuota-id');
    
    let cuotaEncontrada = cuotas.find(c => String(c.id) === String(cuotaId) || String(c.num_cuota) === String(cuotaId) || String(c.numero) === String(cuotaId));
    if (!cuotaEncontrada) {
        cuotaEncontrada = cuotas.find(c => c.estado === 'Pendiente');
    }

    if (cuotaEncontrada) {
        cuotaEncontrada.estado = 'Pagado';
        cuotaEncontrada.fecha_pago = fechaPago;
    }

    const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);

    const pagoData = {
        num_recibo: numRecibo,
        prestamo_id: prestamoId,
        cuota_id: cuotaEncontrada ? (cuotaEncontrada.id || cuotaEncontrada.num_cuota) : null,
        monto: monto,
        fecha: fechaPago,
        metodo: metodo,
        observaciones: obs,
        sancion: 0.00
    };

    try {
        // Guardar el pago y actualizar la tabla de amortización/prestamo en storage
        prestamo.saldo_restante = nuevoSaldo;
        if (prestamo.cuotas_detalle) prestamo.cuotas_detalle = cuotas;
        if (prestamo.cuotas) prestamo.cuotas = cuotas;

        await StorageModule.registrarPago(pagoData, cuotaId, nuevoSaldo, cuotas);
        
        if (typeof StorageModule.logAudit === 'function') {
            await StorageModule.logAudit('Registró pago', 'Pagos', `${numRecibo} - $${monto.toFixed(2)} (${fechaPago})`);
        }
        
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Pago registrado y amortización actualizada');
        }

        // Limpiar campos del formulario
        document.getElementById('form-pago').reset();
        container.style.display = 'none';

        // Refrescar y mostrar el recibo inmediatamente con la fecha ingresada
        await RecibosModule.generarDirecto(pagoData, prestamo);
    } catch (err) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) AppModule.toast('Error al procesar el pago');
        console.error(err);
    }
});