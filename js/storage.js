/**
 * CONEXIÓN DIRECTA A BASE DE DATOS SUPABASE Y LOCALSTORAGE
 */

// CONFIGURACIÓN DE TU PROYECTO SUPABASE
const SUPABASE_URL = "https://dhyirtkbufmstyhduckx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWlydGtidWZtc3R5aGR1Yc4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjYxMzgsImV4cCI6MjEwNDkwMjEzOH0.540N1NHFiIe5Va4jCLv5bN-qLqn-aDQ5gE9DmbizY_8";

// Inicializar cliente Supabase oficial desde el CDN si está presente
let _supabase = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const StorageModule = (() => {

    // Método helper de fallback a LocalStorage si no se puede conectar a Supabase
    const useLocalStorage = () => !_supabase;

    return {
        isSupabaseActive() {
            return !!_supabase;
        },

        // --- CLIENTES ---
        async getClientes() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_clientes')) || [
                    { id: '1', cedula: '0928374651', nombre: 'Juan Pérez', telefono: '0991234567', direccion: 'Guayaquil', estado: 'Activo' }
                ];
            }
            try {
                const { data, error } = await _supabase
                    .from('clientes')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('Error al obtener clientes:', err);
                return [];
            }
        },

        async saveCliente(cliente) {
            if (useLocalStorage()) {
                let clientes = await this.getClientes();
                cliente.id = cliente.id || 'CLI-' + Date.now();
                
                const index = clientes.findIndex(c => c.id === cliente.id);
                if (index >= 0) {
                    clientes[index] = { ...clientes[index], ...cliente };
                } else {
                    clientes.push(cliente);
                }
                
                localStorage.setItem('sp_clientes', JSON.stringify(clientes));
                return cliente;
            }

            try {
                const { data, error } = await _supabase
                    .from('clientes')
                    .upsert([cliente])
                    .select();
                if (error) throw error;
                return data[0];
            } catch (err) {
                console.error('Error al guardar cliente:', err);
                throw err;
            }
        },

        async deleteCliente(id) {
            if (useLocalStorage()) {
                let clientes = await this.getClientes();
                clientes = clientes.filter(c => c.id !== id);
                localStorage.setItem('sp_clientes', JSON.stringify(clientes));
                return;
            }

            try {
                const { error } = await _supabase.from('clientes').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('Error al eliminar cliente:', err);
                throw err;
            }
        },

        // --- PRÉSTAMOS & CUOTAS ---
        async getPrestamos() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_prestamos')) || [];
            }

            try {
                const { data, error } = await _supabase
                    .from('prestamos')
                    .select('*, clientes(*), cuotas(*)')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                return (data || []).map(p => ({
                    ...p,
                    tasa_interes: parseFloat(p.tasa_interes ?? p.interes_pct ?? 0),
                    interes_pct: parseFloat(p.interes_pct ?? p.tasa_interes ?? 0),
                    saldo_restante: parseFloat(p.saldo_restante ?? p.saldo ?? 0),
                    saldo: parseFloat(p.saldo_restante ?? p.saldo ?? 0),
                    cuotas_detalle: p.cuotas || p.cuotas_detalle || []
                }));
            } catch (err) {
                console.error('Error al obtener préstamos:', err);
                return [];
            }
        },

        async getPrestamoById(id) {
            if (useLocalStorage()) {
                const list = await this.getPrestamos();
                return list.find(p => String(p.id) === String(id));
            }

            try {
                const { data, error } = await _supabase
                    .from('prestamos')
                    .select('*, clientes(*), cuotas(*)')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                return {
                    ...data,
                    tasa_interes: parseFloat(data.tasa_interes ?? data.interes_pct ?? 0),
                    interes_pct: parseFloat(data.interes_pct ?? data.tasa_interes ?? 0),
                    saldo_restante: parseFloat(data.saldo_restante ?? data.saldo ?? 0),
                    saldo: parseFloat(data.saldo_restante ?? data.saldo ?? 0),
                    cuotas_detalle: (data.cuotas || []).sort((a, b) => (a.num_cuota || a.numero) - (b.num_cuota || b.numero))
                };
            } catch (err) {
                console.error('Error al obtener préstamo por ID:', err);
                throw err;
            }
        },

        async createPrestamo(prestamoData, cuotasArray) {
            if (useLocalStorage()) {
                let prestamos = await this.getPrestamos();
                const newId = prestamoData.id || 'PR-' + Date.now();
                const saldoCalculado = parseFloat(prestamoData.monto_total || prestamoData.monto || 0);
                
                const fullPrestamo = {
                    ...prestamoData,
                    id: newId,
                    tasa_interes: prestamoData.tasa_interes || prestamoData.interes_pct || 0,
                    interes_pct: prestamoData.interes_pct || prestamoData.tasa_interes || 0,
                    saldo_restante: saldoCalculado,
                    saldo: saldoCalculado,
                    cuotas: cuotasArray,
                    cuotas_detalle: cuotasArray
                };

                prestamos.push(fullPrestamo);
                localStorage.setItem('sp_prestamos', JSON.stringify(prestamos));
                return fullPrestamo;
            }

            try {
                const tasaVal = prestamoData.tasa_interes || prestamoData.interes_pct || 0;
                const saldoVal = prestamoData.monto_total || prestamoData.monto || 0;

                // 1. Insertar el préstamo en la tabla de Supabase contemplando ambos nombres de columna posibles
                const { data: pres, error: errPres } = await _supabase
                    .from('prestamos')
                    .insert([{
                        codigo: prestamoData.codigo,
                        cliente_id: prestamoData.cliente_id,
                        monto: prestamoData.monto,
                        tasa_interes: tasaVal,
                        interes_pct: tasaVal,
                        num_cuotas: prestamoData.num_cuotas || prestamoData.plazo_meses || 1,
                        frecuencia: prestamoData.frecuencia,
                        monto_total: prestamoData.monto_total || prestamoData.monto,
                        saldo_restante: saldoVal,
                        saldo: saldoVal,
                        estado: 'Activo'
                    }])
                    .select();

                if (errPres) throw errPres;

                const prestamoCreado = pres[0];
                const prestamoId = prestamoCreado.id;

                // 2. Insertar cada cuota asociada al préstamo
                const cuotasMapped = cuotasArray.map(c => ({
                    prestamo_id: prestamoId,
                    num_cuota: c.num_cuota || c.numero,
                    fecha_vencimiento: c.fecha_vencimiento,
                    valor_cuota: c.valor_cuota || c.monto,
                    estado: 'Pendiente'
                }));

                const { error: errCuotas } = await _supabase
                    .from('cuotas')
                    .insert(cuotasMapped);

                if (errCuotas) throw errCuotas;

                return prestamoCreado;
            } catch (err) {
                console.error('Error al crear préstamo:', err);
                throw err;
            }
        },

        // --- PAGOS & COBROS ---
        async getPagos() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_pagos')) || [];
            }

            try {
                const { data, error } = await _supabase
                    .from('pagos')
                    .select('*, prestamos(*, clientes(*))')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('Error al obtener pagos:', err);
                return [];
            }
        },

        async registrarPago(pagoData, cuotaId, nuevoSaldoPrestamo, cuotasActualizadas) {
            if (useLocalStorage()) {
                let pagos = await this.getPagos();
                pagos.push(pagoData);
                localStorage.setItem('sp_pagos', JSON.stringify(pagos));

                let prestamos = await this.getPrestamos();
                let p = prestamos.find(x => String(x.id) === String(pagoData.prestamo_id));
                
                if (p) {
                    p.saldo_restante = nuevoSaldoPrestamo;
                    p.saldo = nuevoSaldoPrestamo;
                    if (nuevoSaldoPrestamo <= 0) p.estado = 'Finalizado';

                    if (cuotasActualizadas) {
                        p.cuotas = cuotasActualizadas;
                        p.cuotas_detalle = cuotasActualizadas;
                    } else if (p.cuotas || p.cuotas_detalle) {
                        const listaCuotas = p.cuotas_detalle || p.cuotas;
                        let c = listaCuotas.find(cu => 
                            String(cu.id) === String(cuotaId) || 
                            String(cu.num_cuota) === String(cuotaId) || 
                            String(cu.numero) === String(cuotaId)
                        );
                        if (c) {
                            c.estado = 'Pagado';
                            c.fecha_pago = pagoData.fecha;
                        }
                    }
                }
                
                localStorage.setItem('sp_prestamos', JSON.stringify(prestamos));
                return pagoData;
            }

            try {
                // 1. Insertar pago en Supabase
                const { data: pagoRes, error: errPago } = await _supabase
                    .from('pagos')
                    .insert([{
                        num_recibo: pagoData.num_recibo,
                        prestamo_id: pagoData.prestamo_id,
                        cuota_id: cuotaId || pagoData.cuota_id,
                        monto: pagoData.monto,
                        fecha: pagoData.fecha,
                        metodo: pagoData.metodo,
                        observaciones: pagoData.observaciones,
                        sancion: pagoData.sancion || 0
                    }])
                    .select();

                if (errPago) throw errPago;

                // 2. Marcar la cuota pagada en Supabase si existe ID de cuota
                if (cuotaId) {
                    await _supabase
                        .from('cuotas')
                        .update({ 
                            estado: 'Pagado',
                            fecha_pago: pagoData.fecha 
                        })
                        .or(`id.eq.${cuotaId},num_cuota.eq.${cuotaId}`);
                }

                // 3. Actualizar saldo y estado del préstamo
                const nuevoEstado = nuevoSaldoPrestamo <= 0 ? 'Finalizado' : 'Activo';
                
                await _supabase
                    .from('prestamos')
                    .update({ 
                        saldo_restante: nuevoSaldoPrestamo, 
                        saldo: nuevoSaldoPrestamo, 
                        estado: nuevoEstado 
                    })
                    .eq('id', pagoData.prestamo_id);

                return pagoRes[0];
            } catch (err) {
                console.error('Error al registrar pago en Supabase:', err);
                throw err;
            }
        },

        // --- AUDITORÍA ---
        async getAuditoria() {
            if (useLocalStorage()) {
                return JSON.parse(localStorage.getItem('sp_auditoria')) || [];
            }
            try {
                const { data, error } = await _supabase
                    .from('auditoria')
                    .select('*')
                    .order('fecha_hora', { ascending: false });
                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('Error al obtener auditoría:', err);
                return [];
            }
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

            try {
                await _supabase.from('auditoria').insert([entry]);
            } catch (err) {
                console.error('Error al guardar auditoría:', err);
            }
        }
    };
})();