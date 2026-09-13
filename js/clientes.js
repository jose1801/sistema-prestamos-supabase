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

        async delete(id) {
            if (!confirm('¿Está seguro de eliminar este cliente?')) return;
            try {
                await StorageModule.deleteCliente(id);
                await StorageModule.logAudit('Eliminó cliente', 'Clientes', id);
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