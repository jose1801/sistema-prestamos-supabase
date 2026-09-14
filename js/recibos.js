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