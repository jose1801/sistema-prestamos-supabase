/**
 * MÓDULO CLIENTES
 */
const ClientesModule = (() => {
    return {
        async render() {
            const clientes = await StorageModule.getClientes();
            const tbody = document.getElementById('tbl-clientes');
            tbody.innerHTML = '';

            if (clientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay clientes registrados.</td></tr>';
                return;
            }

            clientes.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${c.cedula}</strong></td>
                        <td>${c.nombre}</td>
                        <td>${c.telefono || '-'}</td>
                        <td>${c.direccion || '-'}</td>
                        <td><span class="badge badge-success">${c.estado || 'Activo'}</span></td>
                        <td>
                            <button class="btn btn-sm btn-secondary" onclick="ClientesModule.delete('${c.id}')">Eliminar</button>
                        </td>
                    </tr>
                `;
            });
        },

        openModal() {
            document.getElementById('form-cliente').reset();
            document.getElementById('modal-cliente').classList.add('active');
        },

        closeModal() {
            document.getElementById('modal-cliente').classList.remove('active');
        },

        /**
         * Al eliminar un cliente:
         *  1. Si tiene préstamos con saldo pendiente, ese saldo se registra
         *     como un pago de ajuste (queda "cobrado" y suma al total cobrado).
         *  2. Sus préstamos se desvinculan (cliente_id = null, se guarda el
         *     nombre en cliente_nombre) para que el historial de préstamos,
         *     cuotas y pagos NO se borre en cascada junto con el cliente.
         *  3. Recién ahí se borra el cliente.
         */
        async delete(id) {
            try {
                const clientes = await StorageModule.getClientes();
                const cliente = clientes.find(c => String(c.id) === String(id));
                const nombreCliente = cliente ? cliente.nombre : 'Cliente eliminado';

                const prestamos = await StorageModule.getPrestamosPorCliente(id);
                const activos = prestamos.filter(p => (parseFloat(p.saldo) || 0) > 0);

                let mensaje = `¿Está seguro de eliminar a ${nombreCliente}?`;
                if (activos.length > 0) {
                    const totalSaldo = activos.reduce((s, p) => s + (parseFloat(p.saldo) || 0), 0);
                    mensaje += `\n\nTiene ${activos.length} préstamo(s) con saldo pendiente de $${totalSaldo.toFixed(2)}. ` +
                               `Al eliminarlo, ese saldo se dará por cobrado y esta acción no se puede deshacer.`;
                }
                if (!confirm(mensaje)) return;

                // 1. Saldar los préstamos activos: el saldo pendiente pasa a "cobrado"
                for (const p of activos) {
                    await StorageModule.registrarPago({
                        num_recibo: 'AJUSTE-' + Math.floor(100000 + Math.random() * 900000),
                        prestamo_id: p.id,
                        monto: p.saldo,
                        fecha: new Date().toISOString().split('T')[0],
                        metodo: 'Ajuste por eliminación de cliente',
                        observaciones: `Saldo dado por cobrado al eliminar al cliente ${nombreCliente}`
                    });
                }

                // 2. Conservar el historial: desvincular los préstamos antes de borrar
                if (prestamos.length > 0) {
                    await StorageModule.desvincularPrestamos(id, nombreCliente);
                }

                // 3. Borrar el cliente
                await StorageModule.deleteCliente(id);
                await StorageModule.logAudit('Eliminó cliente', 'Clientes', nombreCliente);

                AppModule.toast('Cliente eliminado');
                this.render();
            } catch (err) {
                AppModule.toast('Error al eliminar cliente');
                console.error(err);
            }
        }
    };
})();

document.getElementById('form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clienteData = {
        nombre: document.getElementById('cli-nombre').value,
        cedula: document.getElementById('cli-cedula').value,
        telefono: document.getElementById('cli-telefono').value,
        direccion: document.getElementById('cli-direccion').value,
        estado: 'Activo'
    };

    try {
        await StorageModule.saveCliente(clienteData);
        await StorageModule.logAudit('Registró cliente', 'Clientes', clienteData.nombre);
        AppModule.toast('Cliente guardado exitosamente');
        ClientesModule.closeModal();
        ClientesModule.render();
    } catch (err) {
        AppModule.toast('Error al guardar cliente');
        console.error(err);
    }
});