/**
 * MÓDULO COBROS Y PAGOS (RECALCULO REAL POR ABONOS DIARIOS)
 */
const PagosModule = (() => {
    return {
        async render() {
            const prestamos = await StorageModule.getPrestamos();
            const select = document.getElementById('pago-prestamo-id');
            if (!select) return;

            select.innerHTML = '<option value="">Seleccione un préstamo activo...</option>';
            
            const inputFecha = document.getElementById('pago-fecha');
            if (inputFecha && !inputFecha.value) {
                inputFecha.value = new Date().toISOString().split('T')[0];
            }

            const prestamosActivos = prestamos.filter(p => parseFloat(p.saldo_restante ?? p.saldo ?? 0) > 0);

            prestamosActivos.forEach(p => {
                const nombre = p.clientes?.nombre || p.cliente?.nombre || p.cliente_nombre || 'Cliente N/A';
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
            const proxima = cuotas.find(c => String(c.estado || '').toUpperCase() !== 'PAGADO');

            if (proxima) {
                container.style.display = 'block';
                const numCuota = proxima.num_cuota || proxima.numero || proxima.numero_cuota || 1;
                const valorCuota = parseFloat(proxima.valor_cuota || proxima.monto || 0);

                container.innerHTML = `
                    <p style="font-size:0.85rem; color:#777;">Próxima Cuota a Pagar: <strong>#${numCuota}</strong></p>
                    <p style="font-size:0.95rem; font-weight:bold; color:#2ecc71;">Monto Sugerido Cuota: $${valorCuota.toFixed(2)}</p>
                `;
                if (inputMonto) inputMonto.value = valorCuota.toFixed(2);
            } else {
                container.style.display = 'block';
                container.innerHTML = `<p style="font-size:0.85rem; color:#2ecc71;">El préstamo no tiene cuotas pendientes.</p>`;
                if (inputMonto) inputMonto.value = '0.00';
            }
        }
    };
})();

// EVENTO DE GUARDADO Y EMISIÓN DE RECIBO
document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const fechaPago = document.getElementById('pago-fecha').value || new Date().toISOString().split('T')[0];
    const metodo = document.getElementById('pago-metodo')?.value || 'Efectivo';
    const obs = document.getElementById('pago-observaciones')?.value || '';

    if (!prestamoId || isNaN(monto) || monto <= 0) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) AppModule.toast('Ingrese un monto válido');
        return;
    }

    try {
        const prestamo = await StorageModule.getPrestamoById(prestamoId);
        let cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
        const totalPagar = parseFloat(prestamo.total_pagar || prestamo.monto || 0);
        const saldoActual = parseFloat(prestamo.saldo_restante ?? prestamo.saldo ?? totalPagar);
        
        const nuevoSaldo = Math.max(0, saldoActual - monto);

        // Actualización estatus de cuotas en memoria
        let restanteMonto = monto;
        for (let i = 0; i < cuotas.length; i++) {
            if (restanteMonto <= 0) break;
            const st = String(cuotas[i].estado || '').toUpperCase().trim();
            if (st !== 'PAGADO') {
                cuotas[i].estado = 'PAGADO';
                cuotas[i].fecha_pago = fechaPago;
                restanteMonto = 0; // Descuenta 1 cuota por abono diario
            }
        }

        const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);

        const pagoData = {
            id: Date.now().toString(),
            num_recibo: numRecibo,
            prestamo_id: prestamoId,
            monto: monto,
            fecha: fechaPago,
            metodo: metodo,
            observaciones: obs,
            sancion: 0.00
        };

        // Guardar el nuevo saldo en la estructura
        prestamo.saldo_restante = nuevoSaldo;
        if (nuevoSaldo === 0) prestamo.estado = 'Finalizado';
        prestamo.cuotas_detalle = cuotas;
        prestamo.cuotas = cuotas;

        // Persistir en Storage
        if (typeof StorageModule.registrarPago === 'function') {
            await StorageModule.registrarPago(pagoData, null, nuevoSaldo, cuotas);
        }
        if (typeof StorageModule.savePrestamo === 'function') {
            await StorageModule.savePrestamo(prestamo);
        }

        if (typeof AppModule !== 'undefined' && AppModule.toast) {
            AppModule.toast('Pago registrado correctamente');
        }

        document.getElementById('form-pago').reset();
        await PagosModule.render();

        // Generar recibo
        if (typeof RecibosModule !== 'undefined' && RecibosModule.generarDirecto) {
            await RecibosModule.generarDirecto(pagoData, prestamo);
        }

    } catch (err) {
        if (typeof AppModule !== 'undefined' && AppModule.toast) AppModule.toast('Error al procesar el pago');
        console.error('Error:', err);
    }
});


/**
 * MÓDULO DE RECIBOS E IMPRESIÓN
 */
const RecibosModule = (() => {
    return {
        async render() {
            const pagos = await StorageModule.getPagos();
            const select = document.getElementById('select-recibos-lista');
            if (!select) return;

            select.innerHTML = '<option value="">Seleccione un recibo...</option>';
            pagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            pagos.forEach(p => {
                const montoFix = parseFloat(p.monto || 0).toFixed(2);
                select.innerHTML += `<option value="${p.id}">${p.num_recibo || p.id} - $${montoFix} (${p.fecha || ''})</option>`;
            });
        },

        async onSelectReciboChange() {
            const id = document.getElementById('select-recibos-lista')?.value;
            if (!id) return;
            
            const pagos = await StorageModule.getPagos();
            const pago = pagos.find(p => String(p.id) === String(id));
            if (!pago) return;

            const prestamo = await StorageModule.getPrestamoById(pago.prestamo_id);
            await this.generarDirecto(pago, prestamo || {});
        },

        async generarDirecto(pago, prestamoInput) {
            // Cargar estado fresco del préstamo y lista completa de pagos
            let prestamo = prestamoInput;
            if (pago?.prestamo_id && typeof StorageModule.getPrestamoById === 'function') {
                const pFresh = await StorageModule.getPrestamoById(pago.prestamo_id);
                if (pFresh) prestamo = pFresh;
            }

            const todosLosPagos = await StorageModule.getPagos();
            // Pagos registrados de este préstamo específico
            const pagosPrestamo = todosLosPagos.filter(p => String(p.prestamo_id) === String(prestamo.id || pago.prestamo_id));

            // 1. Cliente
            let clienteNombre = prestamo.clientes?.nombre || prestamo.cliente?.nombre || prestamo.cliente_nombre || '';
            if (!clienteNombre && prestamo.cliente_id) {
                try {
                    const clientes = await StorageModule.getClientes();
                    const cli = clientes.find(c => String(c.id) === String(prestamo.cliente_id));
                    if (cli) clienteNombre = cli.nombre || cli.nombre_completo;
                } catch(e){}
            }
            if (!clienteNombre) clienteNombre = 'CLIENTE GENERAL';

            // 2. Definición exacta del total de cuotas y montos
            const numTotalCuotas = parseInt(prestamo.numero_cuotas || prestamo.num_cuotas || 30);
            const totalVenta = parseFloat(prestamo.total_pagar || prestamo.monto || prestamo.total || 0);
            const montoPagado = parseFloat(pago.monto || 0);
            const sancion = parseFloat(pago.sancion || 0);
            const nuevoSaldo = parseFloat(prestamo.saldo_restante ?? Math.max(0, totalVenta - montoPagado));

            // 3. CONTEO REAL DE ABONOS DIARIOS
            // Las cuotas pagadas equivalen a la cantidad de abonos/pagos realizados en el historial
            let cuotasPagadas = pagosPrestamo.length;
            if (cuotasPagadas === 0 && montoPagado > 0) cuotasPagadas = 1;

            // Las cuotas restantes son la resta directa del total (Ej: 30 total - 1 pagada = 29 restantes)
            let cuotasRestantes = Math.max(0, numTotalCuotas - cuotasPagadas);

            // 4. Renderizado directo a la plantilla del recibo
            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            setText('recibo-fecha', pago.fecha || new Date().toISOString().split('T')[0]);
            setText('recibo-cliente', clienteNombre.toUpperCase());
            setText('recibo-valor-venta', `$ ${totalVenta.toFixed(2)}`);
            setText('recibo-valor-pagado', `$ ${montoPagado.toFixed(2)}`);
            setText('recibo-cuotas-pagadas', cuotasPagadas);
            setText('recibo-cuotas-restantes', cuotasRestantes);
            setText('recibo-cuotas-atrasadas', 0);
            setText('recibo-sancion', `$ ${sancion.toFixed(2)}`);
            setText('recibo-nuevo-saldo', `$ ${nuevoSaldo.toFixed(2)}`);

            // 5. Cambio a la pestaña Recibos
            const select = document.getElementById('select-recibos-lista');
            if (select && String(select.value) !== String(pago.id)) {
                select.value = pago.id;
            }

            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
            
            const targetLink = document.querySelector('[data-target="view-recibos"]');
            const targetView = document.getElementById('view-recibos');
            if (targetLink) targetLink.classList.add('active');
            if (targetView) targetView.classList.add('active');
        }
    };
})();