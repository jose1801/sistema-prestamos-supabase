/**
 * MÓDULO DE RECIBOS E IMPRESIÓN
 */
const RecibosModule = (() => {
    return {
        async render() {
            const pagos = await StorageModule.getPagos();
            const select = document.getElementById('select-recibos-lista');
            select.innerHTML = '<option value="">Seleccione un recibo...</option>';

            pagos.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${p.num_recibo} - $${parseFloat(p.monto).toFixed(2)} (${p.fecha})</option>`;
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
            this.generarDirecto(pago, prestamo);
        },

        generarDirecto(pago, prestamo) {
            const clienteNombre = prestamo.clientes ? prestamo.clientes.nombre : 'Cliente General';
            const codigoPrestamo = prestamo.codigo || prestamo.id || 'N/A';
            const container = document.getElementById('receipt-content');
            
            container.innerHTML = `
                <div class="receipt-row"><span>Nº RECIBO:</span> <strong>${pago.num_recibo}</strong></div>
                <div class="receipt-row"><span>FECHA:</span> <span>${pago.fecha}</span></div>
                <div class="receipt-divider"></div>
                <div class="receipt-row"><span>CLIENTE:</span> <span>${clienteNombre}</span></div>
                <div class="receipt-row"><span>PRÉSTAMO:</span> <span>${codigoPrestamo}</span></div>
                <div class="receipt-divider"></div>
                <div class="receipt-row"><span>MONTO PAGADO:</span> <strong>$${parseFloat(pago.monto).toFixed(2)}</strong></div>
                <div class="receipt-row"><span>MÉTODO:</span> <span>${pago.metodo}</span></div>
                <div class="receipt-divider"></div>
                <p style="text-align:center; font-size: 0.8rem; margin-top:10px;">¡Gracias por su pago puntual!</p>
            `;

            // Navegar a la vista de recibos automáticamente
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
            document.querySelector('[data-target="view-recibos"]').classList.add('active');
            document.getElementById('view-recibos').classList.add('active');
        }
    };
})();