/**
 * CONEXIÓN DIRECTA A BASE DE DATOS SUPABASE (Sustituye la API REST Backend)
 */

// CONFIGURACIÓN DE TU PROYECTO SUPABASE
// Reemplaza estas dos constantes con los datos de tu Dashboard en Supabase (Settings -> API)
const SUPABASE_URL = "https://dhyirtkbufmstyhduckx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWlydGtidWZtc3R5aGR1Y2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjYxMzgsImV4cCI6MjEwNDkwMjEzOH0.540N1NHFiIe5Va4jCLv5bN-qLqn-aDQ5gE9DmbizY_8";

// Inicializar cliente Supabase oficial desde el CDN
let _supabase = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== "https://dhyirtkbufmstyhduckx.supabase.co" && SUPABASE_ANON_KEY !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWlydGtidWZtc3R5aGR1Y2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjYxMzgsImV4cCI6MjEwNDkwMjEzOH0.540N1NHFiIe5Va4jCLv5bN-qLqn-aDQ5gE9DmbizY_8") {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const StorageModule = (() => {

    // Método helper de fallback a LocalStorage si no está configurado Supabase aún
    const useLocalStorage = () => !_supabase;

    return {
        isSupabaseActive() {
            return !_supabase;
        },

        // --- CLIENTES ---
        async getClientes() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_clientes')) || [
                    { id: '1', cedula: '0928374651', nombre: 'Juan Pérez', telefono: '0991234567', direccion: 'Guayaquil', estado: 'Activo' }
                ];
            }
            const { data, error } = await _supabase.from('clientes').select('*').order('created_at', { ascending: false });
            if (error) { console.error(error); return []; }
            return data;
        },

        async saveCliente(cliente) {
            if (useLocalStorage()) {
                let clientes = await this.getClientes();
                cliente.id = cliente.id || 'CLI-' + Date.now();
                clientes.push(cliente);
                localStorage.setItem('sp_clientes', JSON.stringify(clientes));
                return cliente;
            }
            const { data, error } = await _supabase.from('clientes').insert([cliente]).select();
            if (error) throw error;
            return data[0];
        },

        async deleteCliente(id) {
            if (useLocalStorage()) {
                let clientes = await this.getClientes();
                clientes = clientes.filter(c => c.id !== id);
                localStorage.setItem('sp_clientes', JSON.stringify(clientes));
                return;
            }
            const { error } = await _supabase.from('clientes').delete().eq('id', id);
            if (error) throw error;
        },

        // --- PRÉSTAMOS & CUOTAS ---
        async getPrestamos() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_prestamos')) || [];
            }
            const { data, error } = await _supabase
                .from('prestamos')
                .select('*, clientes(nombre, cedula)')
                .order('created_at', { ascending: false });
            if (error) { console.error(error); return []; }
            return data;
        },

        async getPrestamoById(id) {
            if (useLocalStorage()) {
                const list = await this.getPrestamos();
                return list.find(p => p.id === id);
            }
            const { data, error } = await _supabase
                .from('prestamos')
                .select('*, clientes(nombre, cedula), cuotas(*)')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async createPrestamo(prestamoData, cuotasArray) {
            if (useLocalStorage()) {
                let prestamos = await this.getPrestamos();
                prestamoData.id = prestamoData.id || 'PR-' + Date.now();
                prestamoData.cuotas = cuotasArray;
                prestamos.push(prestamoData);
                localStorage.setItem('sp_prestamos', JSON.stringify(prestamos));
                return prestamoData;
            }

            // 1. Insertar préstamo en Supabase
            const { data: pres, error: errPres } = await _supabase
                .from('prestamos')
                .insert([prestamoData])
                .select();
            if (errPres) throw errPres;

            const prestamoId = pres[0].id;

            // 2. Insertar cuotas en Supabase con la relación
            const cuotasMapped = cuotasArray.map(c => ({
                prestamo_id: prestamoId,
                num_cuota: c.num_cuota,
                fecha_vencimiento: c.fecha_vencimiento,
                valor_cuota: c.valor_cuota,
                estado: 'Pendiente'
            }));

            const { error: errCuotas } = await _supabase.from('cuotas').insert(cuotasMapped);
            if (errCuotas) throw errCuotas;

            return pres[0];
        },

        // --- PAGOS & COBROS ---
        async getPagos() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_pagos')) || [];
            }
            const { data, error } = await _supabase
                .from('pagos')
                .select('*, prestamos(codigo, clientes(nombre))')
                .order('created_at', { ascending: false });
            if (error) { console.error(error); return []; }
            return data;
        },

        async registrarPago(pagoData, cuotaId, nuevoSaldoPrestamo) {
            if (useLocalStorage()) {
                let pagos = await this.getPagos();
                pagos.push(pagoData);
                localStorage.setItem('sp_pagos', JSON.stringify(pagos));

                let prestamos = await this.getPrestamos();
                let p = prestamos.find(x => x.id === pagoData.prestamo_id);
                if (p) {
                    p.saldo = nuevoSaldoPrestamo;
                    if (p.cuotas) {
                        let c = p.cuotas.find(cu => cu.id === cuotaId || cu.num_cuota === cuotaId);
                        if (c) c.estado = 'Pagado';
                    }
                }
                localStorage.setItem('sp_prestamos', JSON.stringify(prestamos));
                return pagoData;
            }

            // Transactional Supabase Queries
            const { data: pagoRes, error: errPago } = await _supabase.from('pagos').insert([pagoData]).select();
            if (errPago) throw errPago;

            if (cuotaId) {
                await _supabase.from('cuotas').update({ estado: 'Pagado' }).eq('id', cuotaId);
            }

            const estadoPrestamo = nuevoSaldoPrestamo <= 0 ? 'Finalizado' : 'Activo';
            await _supabase.from('prestamos').update({ saldo: nuevoSaldoPrestamo, estado: estadoPrestamo }).eq('id', pagoData.prestamo_id);

            return pagoRes[0];
        },

        // --- AUDITORÍA ---
        async getAuditoria() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_auditoria')) || [];
            }
            const { data, error } = await _supabase.from('auditoria').select('*').order('fecha_hora', { ascending: false });
            if (error) return [];
            return data;
        },

        async logAudit(accion, modulo, registro) {
            const entry = {
                usuario: 'Admin',
                accion,
                modulo,
                registro,
                fecha_hora: new Date().toISOString()
            };
            if (useLocalStorage()) {
                let logs = await this.getAuditoria();
                logs.unshift(entry);
                localStorage.setItem('sp_auditoria', JSON.stringify(logs));
                return;
            }
            await _supabase.from('auditoria').insert([entry]);
        }
    };
})();