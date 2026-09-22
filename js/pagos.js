/**
 * MÓDULO COBROS Y PAGOS
 *
 * Este archivo ya NO calcula saldos ni marca cuotas.
 * Todo eso lo hace StorageModule.registrarPago():
 *   saldo = total - suma de pagos
 */

const toastMsg = (msg) => {
    if (typeof AppModule !== 'undefined' && AppModule.toast) AppModule.toast(msg);
};

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

            // Solo préstamos con saldo pendiente
            const activos = prestamos.filter(p => (parseFloat(p.saldo) || 0) > 0);

            activos.forEach(p => {
                const nombre = p.clientes?.nombre || p.cliente_nombre || 'Cliente N/A';
                const saldo = parseFloat(p.saldo) || 0;

                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = `${p.codigo || p.id} - ${nombre} (Saldo: $${saldo.toFixed(2)})`;
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

            const total = parseFloat(prestamo.total) || 0;
            const saldo = parseFloat(prestamo.saldo) || 0;
            const pagado = Math.round((total - saldo) * 100) / 100;

            // Buscar la cuota en curso según lo ya abonado (funciona con abonos parciales)
            let acumulado = 0;
            let actual = null;
            let sugerido = 0;
            for (const c of (prestamo.cuotas || [])) {
                acumulado += parseFloat(c.valor_cuota) || 0;
                if (acumulado > pagado + 0.01) {
                    actual = c;
                    sugerido = Math.min(saldo, Math.round((acumulado - pagado) * 100) / 100);
                    break;
                }
            }

            container.style.display = 'block';

            if (actual && saldo > 0) {
                const valorCuota = parseFloat(actual.valor_cuota) || 0;
                container.innerHTML = `
                    <p style="font-size:0.85rem; color:#777;">Próxima Cuota a Pagar: <strong>#${actual.num_cuota}</strong> (valor $${valorCuota.toFixed(2)})</p>
                    <p style="font-size:0.95rem; font-weight:bold; color:#2ecc71;">Monto Sugerido: $${sugerido.toFixed(2)}</p>
                    <p style="font-size:0.8rem; color:#777;">Saldo total pendiente: $${saldo.toFixed(2)}</p>
                `;
                if (inputMonto) inputMonto.value = sugerido.toFixed(2);
            } else {
                container.innerHTML = `<p style="font-size:0.85rem; color:#2ecc71;">El préstamo no tiene cuotas pendientes.</p>`;
                if (inputMonto) inputMonto.value = '0.00';
            }
        }
    };
})();

// =========================================================
// EVENTO DE GUARDADO Y EMISIÓN DE RECIBO
// =========================================================
document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const boton = form.querySelector('button[type="submit"]');

    const prestamoId = document.getElementById('pago-prestamo-id').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const fechaPago = document.getElementById('pago-fecha').value || new Date().toISOString().split('T')[0];
    const metodo = document.getElementById('pago-metodo')?.value || 'Efectivo';
    const obs = document.getElementById('pago-observaciones')?.value || '';

    if (!prestamoId || isNaN(monto) || monto <= 0) {
        toastMsg('Ingrese un monto válido');
        return;
    }

    // Evita doble clic (dos pagos duplicados)
    if (boton) boton.disabled = true;

    try {
        const prestamo = await StorageModule.getPrestamoById(prestamoId);
        const saldoActual = parseFloat(prestamo.saldo) || 0;

        if (monto > saldoActual + 0.01) {
            toastMsg(`El pago supera el saldo ($${saldoActual.toFixed(2)})`);
            return;
        }

        const pagoData = {
            num_recibo: 'REC-' + Math.floor(100000 + Math.random() * 900000),
            prestamo_id: prestamoId,
            monto,
            fecha: fechaPago,
            metodo,
            observaciones: obs
        };

        const pagoGuardado = await StorageModule.registrarPago(pagoData);
        await StorageModule.logAudit('Registró pago', 'Pagos', pagoData.num_recibo);

        toastMsg('Pago registrado correctamente');
        form.reset();
        await PagosModule.render();
        await RecibosModule.render();
        await RecibosModule.generarDirecto(pagoGuardado, prestamo);
    } catch (err) {
        toastMsg('Error al procesar el pago');
        console.error('Error:', err);
    } finally {
        if (boton) boton.disabled = false;
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
            pagos.sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));

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
            // Estado fresco del préstamo
            let prestamo = prestamoInput || {};
            if (pago?.prestamo_id) {
                const pFresh = await StorageModule.getPrestamoById(pago.prestamo_id);
                if (pFresh) prestamo = pFresh;
            }

            // Pagos de este préstamo
            const todosLosPagos = await StorageModule.getPagos();
            const pagosPrestamo = todosLosPagos.filter(
                p => String(p.prestamo_id) === String(prestamo.id || pago.prestamo_id)
            );

            // 1. Cliente (si el cliente fue eliminado, prestamo.clientes será null
            //    y se usa el nombre que quedó guardado en el propio préstamo)
            let clienteNombre = prestamo.clientes?.nombre || prestamo.cliente_nombre || '';
            if (!clienteNombre && prestamo.cliente_id) {
                try {
                    const clientes = await StorageModule.getClientes();
                    const cli = clientes.find(c => String(c.id) === String(prestamo.cliente_id));
                    if (cli) clienteNombre = cli.nombre;
                } catch (e) { /* sin cliente */ }
            }
            if (!clienteNombre) clienteNombre = 'CLIENTE GENERAL';

            // 2. Total con interés y cuotas
            const total = parseFloat(prestamo.total) || 0;
            const numTotalCuotas = parseInt(prestamo.cuotas_count) || (prestamo.cuotas || []).length || 1;
            const valorCuota = parseFloat(prestamo.cuotas?.[0]?.valor_cuota) || (total / numTotalCuotas);
            const montoPagado = parseFloat(pago.monto || 0);
            const sancion = parseFloat(pago.sancion || 0);

            // 3. Estado del préstamo EN EL MOMENTO de este recibo
            const claveOrden = (p) => new Date(p.created_at || p.fecha).getTime();
            const ordenados = pagosPrestamo.slice().sort((a, b) => claveOrden(a) - claveOrden(b));
            const idx = ordenados.findIndex(p => String(p.id) === String(pago.id));
            const hastaAqui = idx >= 0 ? ordenados.slice(0, idx + 1) : ordenados;
            const pagadoAcumulado = hastaAqui.reduce((s, p) => s + parseFloat(p.monto || 0), 0);

            const totalVenta = total;
            const nuevoSaldo = Math.max(0, total - pagadoAcumulado);
            const cuotasPagadas = nuevoSaldo < 0.01
                ? numTotalCuotas
                : Math.min(numTotalCuotas, Math.floor((pagadoAcumulado + 0.01) / valorCuota));
            const cuotasRestantes = numTotalCuotas - cuotasPagadas;

            // Cuotas vencidas a la fecha del pago que aún no estaban cubiertas
            const fechaRef = pago.fecha || new Date().toISOString().split('T')[0];
            const vencidas = (prestamo.cuotas || []).filter(c => c.fecha_vencimiento < fechaRef).length;
            const cuotasAtrasadas = Math.max(0, vencidas - cuotasPagadas);

            // 4. Renderizado en la plantilla del recibo
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
            setText('recibo-cuotas-atrasadas', cuotasAtrasadas);
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