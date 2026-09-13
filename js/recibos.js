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

            // Ordenar recibos por fecha descendente
            pagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            pagos.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${p.num_recibo || p.id} - $${parseFloat(p.monto).toFixed(2)} (${p.fecha})</option>`;
            });
        },

        async onSelectReciboChange() {
            const id = document.getElementById('select-recibos-lista').value;
            if (!id) return;
            
            const pagos = await StorageModule.getPagos();
            const pago = pagos.find(p => p.id === id);
            if (!pago) return;

            const prestamos = await StorageModule.getPrestamos();
            const prestamo = prestamos.find(pr => pr.id === pago.prestamo_id) || {};
            
            await this.generarDirecto(pago, prestamo);
        },

        async generarDirecto(pago, prestamo) {
            // 1. Obtener nombre del cliente
            let clienteNombre = 'CLIENTE GENERAL';
            if (prestamo.clientes && prestamo.clientes.nombre) {
                clienteNombre = prestamo.clientes.nombre;
            } else if (prestamo.cliente_id) {
                const clientes = await StorageModule.getClientes();
                const cli = clientes.find(c => c.id === prestamo.cliente_id);
                if (cli) clienteNombre = cli.nombre;
            }

            // 2. Conteo dinámico de cuotas y saldos para la fecha indicada
            const cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
            const totalVenta = parseFloat(prestamo.total_pagar || prestamo.monto || 0);
            const montoPagado = parseFloat(pago.monto || 0);
            const sancion = parseFloat(pago.sancion || 0);
            const fechaDelPago = new Date(pago.fecha);

            let cuotasPagadas = 0;
            let cuotasRestantes = 0;
            let cuotasAtrasadas = 0;

            if (Array.isArray(cuotas) && cuotas.length > 0) {
                cuotas.forEach(cuota => {
                    if (cuota.estado === 'Pagado') {
                        cuotasPagadas++;
                    } else {
                        cuotasRestantes++;
                        if (cuota.fecha_vencimiento && new Date(cuota.fecha_vencimiento) < fechaDelPago) {
                            cuotasAtrasadas++;
                        }
                    }
                });
            } else {
                cuotasPagadas = pago.cuotas_pagadas || 1;
                cuotasRestantes = Math.max(0, (prestamo.numero_cuotas || 0) - cuotasPagadas);
            }

            const nuevoSaldo = Math.max(0, parseFloat(prestamo.saldo_restante ?? (totalVenta - montoPagado)));

            // 3. Imprimir datos en los elementos HTML del comprobante
            document.getElementById('recibo-fecha').textContent = pago.fecha;
            document.getElementById('recibo-cliente').textContent = clienteNombre.toUpperCase();
            
            document.getElementById('recibo-valor-venta').textContent = `$ ${totalVenta.toFixed(2)}`;
            document.getElementById('recibo-valor-pagado').textContent = `$ ${montoPagado.toFixed(2)}`;
            document.getElementById('recibo-cuotas-pagadas').textContent = cuotasPagadas;
            document.getElementById('recibo-cuotas-restantes').textContent = cuotasRestantes;
            document.getElementById('recibo-cuotas-atrasadas').textContent = cuotasAtrasadas;
            document.getElementById('recibo-sancion').textContent = `$ ${sancion.toFixed(2)}`;
            document.getElementById('recibo-nuevo-saldo').textContent = `$ ${nuevoSaldo.toFixed(2)}`;

            // 4. Seleccionar la opción en la lista desplegable
            const select = document.getElementById('select-recibos-lista');
            if (select && select.value !== pago.id) {
                select.value = pago.id;
            }

            // 5. Navegar automáticamente a la vista del recibo
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
            
            const targetLink = document.querySelector('[data-target="view-recibos"]');
            const targetView = document.getElementById('view-recibos');
            if (targetLink) targetLink.classList.add('active');
            if (targetView) targetView.classList.add('active');
        }
    };
})();