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
            // 1. Nombre del cliente
            let clienteNombre = 'CLIENTE GENERAL';
            if (prestamo.clientes && prestamo.clientes.nombre) {
                clienteNombre = prestamo.clientes.nombre;
            } else if (prestamo.cliente_id) {
                const clientes = await StorageModule.getClientes();
                const cli = clientes.find(c => c.id === prestamo.cliente_id);
                if (cli) clienteNombre = cli.nombre;
            }

            // 2. Cálculos de cuotas y saldos basados en el préstamo
            const cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
            
            const totalVenta = parseFloat(prestamo.total_pagar || prestamo.monto || 0);
            const montoPagado = parseFloat(pago.monto || 0);
            const sancion = parseFloat(pago.sancion || 0);

            // Conteo de cuotas
            let cuotasPagadas = 0;
            let cuotasRestantes = 0;
            let cuotasAtrasadas = 0;
            const hoy = new Date();

            if (Array.isArray(cuotas) && cuotas.length > 0) {
                cuotas.forEach(cuota => {
                    if (cuota.estado === 'Pagado') {
                        cuotasPagadas++;
                    } else {
                        cuotasRestantes++;
                        if (cuota.fecha_vencimiento && new Date(cuota.fecha_vencimiento) < hoy) {
                            cuotasAtrasadas++;
                        }
                    }
                });
            } else {
                cuotasPagadas = pago.cuotas_pagadas || 1;
                cuotasRestantes = (prestamo.numero_cuotas || 0) - cuotasPagadas;
            }

            // Nuevo saldo adeudado
            const nuevoSaldo = Math.max(0, parseFloat(prestamo.saldo_restante ?? (totalVenta - montoPagado)));

            // 3. Renderizar los datos dentro del HTML del ticket
            document.getElementById('recibo-fecha').textContent = pago.fecha || new Date().toLocaleDateString('es-ES');
            document.getElementById('recibo-cliente').textContent = clienteNombre.toUpperCase();
            
            document.getElementById('recibo-valor-venta').textContent = `$ ${totalVenta.toFixed(2)}`;
            document.getElementById('recibo-valor-pagado').textContent = `$ ${montoPagado.toFixed(2)}`;
            document.getElementById('recibo-cuotas-pagadas').textContent = cuotasPagadas;
            document.getElementById('recibo-cuotas-restantes').textContent = Math.max(0, cuotasRestantes);
            document.getElementById('recibo-cuotas-atrasadas').textContent = cuotasAtrasadas;
            document.getElementById('recibo-sancion').textContent = `$ ${sancion.toFixed(2)}`;
            document.getElementById('recibo-nuevo-saldo').textContent = `$ ${nuevoSaldo.toFixed(2)}`;

            // 4. Seleccionar el recibo en el dropdown si no estaba seleccionado
            const select = document.getElementById('select-recibos-lista');
            if (select && select.value !== pago.id) {
                select.value = pago.id;
            }

            // 5. Cambiar a la vista del recibo en la SPA
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
            
            const targetLink = document.querySelector('[data-target="view-recibos"]');
            const targetView = document.getElementById('view-recibos');
            if (targetLink) targetLink.classList.add('active');
            if (targetView) targetView.classList.add('active');
        }
    };
})();