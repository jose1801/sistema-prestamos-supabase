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
            const id = document.getElementById('select-recibos-lista')?.value;
            if (!id) return;
            
            const pagos = await StorageModule.getPagos();
            // Comparación flexible de IDs (string vs number)
            const pago = pagos.find(p => String(p.id) === String(id));
            if (!pago) return;

            const prestamos = await StorageModule.getPrestamos();
            const prestamo = prestamos.find(pr => String(pr.id) === String(pago.prestamo_id)) || {};
            
            await this.generarDirecto(pago, prestamo);
        },

        async generarDirecto(pago, prestamo) {
            // 1. Obtener nombre del cliente con resolución flexible
            let clienteNombre = 'CLIENTE GENERAL';
            if (prestamo.clientes && (prestamo.clientes.nombre || prestamo.clientes.nombre_completo)) {
                clienteNombre = prestamo.clientes.nombre || prestamo.clientes.nombre_completo;
            } else if (prestamo.cliente && (prestamo.cliente.nombre || prestamo.cliente.nombre_completo)) {
                clienteNombre = prestamo.cliente.nombre || prestamo.cliente.nombre_completo;
            } else if (prestamo.cliente_nombre) {
                clienteNombre = prestamo.cliente_nombre;
            } else if (prestamo.cliente_id) {
                const clientes = await StorageModule.getClientes();
                const cli = clientes.find(c => String(c.id) === String(prestamo.cliente_id));
                if (cli) clienteNombre = cli.nombre || cli.nombre_completo || 'CLIENTE GENERAL';
            }

            // 2. Conteo dinámico de cuotas y saldos
            const cuotas = prestamo.cuotas_detalle || prestamo.cuotas || [];
            const totalVenta = parseFloat(prestamo.total_pagar || prestamo.monto || prestamo.total || 0);
            const montoPagado = parseFloat(pago.monto || 0);
            const sancion = parseFloat(pago.sancion || 0);
            
            // Convertir la fecha a formato legible/comparable
            const fechaDelPago = pago.fecha ? new Date(pago.fecha) : new Date();

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
                // Fallback si no hay array de cuotas guardado
                cuotasPagadas = pago.cuotas_pagadas_en_evento || pago.cuotas_pagadas || 1;
                const totalCuotas = parseInt(prestamo.numero_cuotas || prestamo.num_cuotas || 0);
                cuotasRestantes = Math.max(0, totalCuotas - cuotasPagadas);
            }

            const nuevoSaldo = parseFloat(prestamo.saldo_restante ?? Math.max(0, totalVenta - montoPagado));

            // 3. Imprimir datos de forma segura en los elementos HTML
            const elFecha = document.getElementById('recibo-fecha');
            const elCliente = document.getElementById('recibo-cliente');
            const elVenta = document.getElementById('recibo-valor-venta');
            const elPagado = document.getElementById('recibo-valor-pagado');
            const elCPagadas = document.getElementById('recibo-cuotas-pagadas');
            const elCRestantes = document.getElementById('recibo-cuotas-restantes');
            const elCAtrasadas = document.getElementById('recibo-cuotas-atrasadas');
            const elSancion = document.getElementById('recibo-sancion');
            const elNuevoSaldo = document.getElementById('recibo-nuevo-saldo');

            if (elFecha) elFecha.textContent = pago.fecha;
            if (elCliente) elCliente.textContent = clienteNombre.toUpperCase();
            if (elVenta) elVenta.textContent = `$ ${totalVenta.toFixed(2)}`;
            if (elPagado) elPagado.textContent = `$ ${montoPagado.toFixed(2)}`;
            if (elCPagadas) elCPagadas.textContent = cuotasPagadas;
            if (elCRestantes) elCRestantes.textContent = cuotasRestantes;
            if (elCAtrasadas) elCAtrasadas.textContent = cuotasAtrasadas;
            if (elSancion) elSancion.textContent = `$ ${sancion.toFixed(2)}`;
            if (elNuevoSaldo) elNuevoSaldo.textContent = `$ ${nuevoSaldo.toFixed(2)}`;

            // 4. Seleccionar la opción correspondiente en el selector de recibos
            const select = document.getElementById('select-recibos-lista');
            if (select && String(select.value) !== String(pago.id)) {
                select.value = pago.id;
            }

            // 5. Navegar automáticamente a la vista de recibos
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
            
            const targetLink = document.querySelector('[data-target="view-recibos"]');
            const targetView = document.getElementById('view-recibos');
            if (targetLink) targetLink.classList.add('active');
            if (targetView) targetView.classList.add('active');
        }
    };
})();