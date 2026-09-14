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

            // Detectar cuotas atrasadas
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

// SUBMIT DEL FORMULARIO DE PAGOS (CON AMORTIZACIÓN MÚLTIPLE DE CUOTAS)
document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const fechaPago = document.getElementById('pago-fecha').value || new Date().toISOString().split('T')[0];
    const metodo = document.getElementById('pago-metodo')?.value || 'Efectivo';
    const obs = document.getElementById('pago-observaciones')?.value || '';

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

        // --- BUCLE DE AMORTIZACIÓN: Pagos Múltiples de Cuotas ---
        let montoDisponible = monto;
        let cuotasLiquidadas = 0;
        let primeraCuotaAfectadaId = null;

        for (let cuota of cuotas) {
            if (montoDisponible <= 0) break;

            if (cuota.estado !== 'Pagado') {
                const valorCuota = parseFloat(cuota.valor_cuota || cuota.monto || 0);

                if (!primeraCuotaAfectadaId) {
                    primeraCuotaAfectadaId = cuota.id || cuota.num_cuota || cuota.numero;
                }

                if (montoDisponible >= valorCuota) {
                    // Cubre la cuota por completo
                    cuota.estado = 'Pagado';
                    cuota.fecha_pago = fechaPago;
                    montoDisponible -= valorCuota;
                    cuotasLiquidadas++;
                } else {
                    // Abono parcial (no liquida toda la cuota)
                    cuota.estado = 'Parcial';
                    cuota.fecha_pago = fechaPago;
                    montoDisponible = 0;
                }
            }
        }

        const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);

        const pagoData = {
            num_recibo: numRecibo,
            prestamo_id: prestamoId,
            cuota_id: primeraCuotaAfectadaId,
            cuotas_pagadas_en_evento: cuotasLiquidadas,
            monto: monto,
            fecha: fechaPago,
            metodo: metodo,
            observaciones: obs,
            sancion: 0.00
        };

        // Actualizar estado del préstamo
        prestamo.saldo_restante = nuevoSaldo;
        if (nuevoSaldo === 0) prestamo.estado = 'Finalizado';
        if (prestamo.cuotas_detalle) prestamo.cuotas_detalle = cuotas;
        if (prestamo.cuotas) prestamo.cuotas = cuotas;

        await StorageModule.registrarPago(pagoData, primeraCuotaAfectadaId, nuevoSaldo, cuotas);
        
        if (typeof StorageModule.logAudit === 'function') {
            await StorageModule.logAudit('Registró pago', 'Pagos', `${numRecibo} - $${monto.toFixed(2)} (${fechaPago})`);
        }
        
        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Pago registrado y cuotas actualizadas correctamente');
        }

        // Sincronizar UI y módulos
        if (typeof PrestamosModule !== 'undefined' && PrestamosModule.render) {
            await PrestamosModule.render();
        }
        if (typeof DashboardModule !== 'undefined' && DashboardModule.init) {
            await DashboardModule.init();
        }

        document.getElementById('form-pago').reset();
        const container = document.getElementById('pago-detalles-cuota');
        if (container) container.style.display = 'none';
        await PagosModule.render();

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