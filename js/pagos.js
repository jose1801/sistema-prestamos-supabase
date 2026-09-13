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
            
            // Establecer fecha por defecto (hoy)
            const inputFecha = document.getElementById('pago-fecha');
            if (inputFecha && !inputFecha.value) {
                inputFecha.value = new Date().toISOString().split('T')[0];
            }

            // Filtrar préstamos activos con saldo mayor a 0
            const prestamosActivos = prestamos.filter(p => parseFloat(p.saldo_restante ?? p.saldo ?? 0) > 0);

            prestamosActivos.forEach(p => {
                // Resolución flexible y segura del nombre del cliente para evitar "Sin nombre"
                const nombre = p.clientes?.nombre 
                    || p.clientes?.nombre_completo 
                    || p.cliente?.nombre 
                    || p.cliente?.nombre_completo 
                    || p.cliente_nombre 
                    || 'Cliente N/A';

                const saldoActual = parseFloat(p.saldo_restante ?? p.saldo ?? 0);
                
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = `${p.codigo || 'PR-' + p.id} - ${nombre} (Saldo: $${saldoActual.toFixed(2)})`;
                select.appendChild(option);
            });

            const container = document.getElementById('pago-detalles-cuota');
            if (container) container.style.display = 'none';
        },

        async onPrestamoChange() {
            const id = document.getElementById('pago-prestamo-id').value;
            const container = document.getElementById('pago-detalles-cuota');
            const inputMonto = document.getElementById('pago-monto');

            if (!container) return;

            if (!id) {
                container.style.display = 'none';
                if (inputMonto) inputMonto.value = '';
                return;
            }

            const prestamo = await StorageModule.getPrestamoById(id);
            if (!prestamo) return;

            const cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
            
            // Buscar la primera cuota pendiente
            const proxima = cuotas.find(c => c.estado !== 'Pagado');
            const fechaPagoSeleccionada = document.getElementById('pago-fecha')?.value || new Date().toISOString().split('T')[0];
            const fechaPago = new Date(fechaPagoSeleccionada);

            // Detectar cuotas atrasadas respecto a la fecha de pago seleccionada
            const atrasadas = cuotas.filter(c => c.estado !== 'Pagado' && c.fecha_vencimiento && new Date(c.fecha_vencimiento) < fechaPago);

            if (proxima) {
                container.style.display = 'block';
                const numCuota = proxima.num_cuota || proxima.numero || proxima.numero_cuota || 1;
                const valorCuota = parseFloat(proxima.valor_cuota || proxima.monto || 0);

                container.setAttribute('data-cuota-id', proxima.id || numCuota);
                
                let alertaAtraso = '';
                if (atrasadas.length > 0) {
                    alertaAtraso = `<p style="font-size:0.8rem; color:var(--danger, #e74c3c); font-weight:bold; margin-top:4px;">⚠️ Cuotas en atraso a la fecha: ${atrasadas.length}</p>`;
                }

                container.innerHTML = `
                    <p style="font-size:0.85rem; color:var(--text-muted, #777);">Próxima Cuota a Pagar: <strong>#${numCuota}</strong></p>
                    <p style="font-size:0.95rem; font-weight:bold; color:var(--accent, #2ecc71);">Monto Sugerido Cuota: $${valorCuota.toFixed(2)}</p>
                    ${alertaAtraso}
                `;
                if (inputMonto) inputMonto.value = valorCuota.toFixed(2);
            } else {
                container.style.display = 'block';
                container.innerHTML = `<p style="font-size:0.85rem; color:var(--accent, #2ecc71);">El préstamo no tiene cuotas pendientes.</p>`;
                if (inputMonto) inputMonto.value = '0.00';
            }
        }
    };
})();

// SUBMIT DEL FORMULARIO DE PAGOS
document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const fechaPago = document.getElementById('pago-fecha').value || new Date().toISOString().split('T')[0];
    const metodo = document.getElementById('pago-metodo').value;
    const obs = document.getElementById('pago-observaciones').value;

    if (!prestamoId || isNaN(monto) || monto <= 0) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Ingrese un monto válido');
        } else {
            alert('Ingrese un monto válido');
        }
        return;
    }

    try {
        const prestamo = await StorageModule.getPrestamoById(prestamoId);
        let cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
        const saldoActual = parseFloat(prestamo.saldo_restante ?? prestamo.saldo ?? 0);
        const nuevoSaldo = Math.max(0, saldoActual - monto);

        // 1. Sincronizar cuotas
        const container = document.getElementById('pago-detalles-cuota');
        const cuotaId = container?.getAttribute('data-cuota-id');
        
        let cuotaEncontrada = cuotas.find(c => 
            String(c.id) === String(cuotaId) || 
            String(c.num_cuota) === String(cuotaId) || 
            String(c.numero) === String(cuotaId)
        );
        
        if (!cuotaEncontrada) {
            cuotaEncontrada = cuotas.find(c => c.estado !== 'Pagado');
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

        // 2. Guardar estado actualizado
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

        // 3. Sincronizar módulos globales
        if (typeof PrestamosModule !== 'undefined' && PrestamosModule.render) {
            await PrestamosModule.render();
        }
        if (typeof DashboardModule !== 'undefined' && DashboardModule.init) {
            await DashboardModule.init();
        }

        // 4. Limpiar formulario y refrescar lista de pagos
        document.getElementById('form-pago').reset();
        if (container) container.style.display = 'none';
        await PagosModule.render();

        // 5. Generar recibo y cambiar a la vista Recibos
        if (typeof RecibosModule !== 'undefined' && RecibosModule.generarDirecto) {
            await RecibosModule.generarDirecto(pagoData, prestamo);
        }

        const navRecibos = document.querySelector('[data-target="view-recibos"]');
        if (navRecibos) navRecibos.click();

    } catch (err) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Error al procesar el pago');
        }
        console.error('Error al procesar el pago:', err);
    }
});