/**
 * CONEXIÓN A BASE DE DATOS SUPABASE (con respaldo en LocalStorage)
 *
 * REGLA DE ORO DEL SALDO:
 *   total = monto + (monto * interes_pct / 100)
 *   saldo = total - SUMA de todos los pagos del préstamo
 * El saldo nunca se "adivina": siempre se recalcula desde la tabla pagos.
 */

// CONFIGURACIÓN DE TU PROYECTO SUPABASE
const SUPABASE_URL = "https://dhyirtkbufmstyhduckx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWlydGtidWZtc3R5aGR1Y2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjYxMzgsImV4cCI6MjEwNDkwMjEzOH0.540N1NHFiIe5Va4jCLv5bN-qLqn-aDQ5gE9DmbizY_8";

// Inicializar cliente Supabase oficial desde el CDN si está presente
let _supabase = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const StorageModule = (() => {

    // Si Supabase no cargó, se usa LocalStorage
    const useLocalStorage = () => !_supabase;

    // ---------- Helpers ----------
    const round2 = (n) => Math.round(((parseFloat(n) || 0) + Number.EPSILON) * 100) / 100;

    const leerLS = (key, fallback) => {
        try {
            return JSON.parse(localStorage.getItem(key)) || fallback;
        } catch (e) {
            return fallback;
        }
    };

    const guardarLS = (key, valor) => localStorage.setItem(key, JSON.stringify(valor));

    // Convierte un préstamo a números y ordena las cuotas. No recalcula nada.
    const normalizarPrestamo = (p) => {
        const cuotas = (p.cuotas || [])
            .slice()
            .sort((a, b) => (a.num_cuota || 0) - (b.num_cuota || 0));
        return {
            ...p,
            monto: parseFloat(p.monto) || 0,
            interes_pct: parseFloat(p.interes_pct) || 0,
            total: parseFloat(p.total) || 0,
            saldo: parseFloat(p.saldo) || 0,
            cuotas_count: parseInt(p.cuotas_count) || cuotas.length || 1,
            cuotas
        };
    };

    /**
     * Calcula saldo, estado y cuotas cubiertas a partir de los pagos.
     * @param {number} total     Total a pagar (capital + interés)
     * @param {number[]} montos  Montos de todos los pagos del préstamo
     * @param {object[]} cuotas  Cuotas ORDENADAS por num_cuota
     */
    const calcularEstadoPrestamo = (total, montos, cuotas) => {
        const totalPagado = montos.reduce((s, m) => s + (parseFloat(m) || 0), 0);
        let saldo = round2(total - totalPagado);
        if (saldo < 0.01) saldo = 0; // absorbe redondeos de la última cuota

        // Una cuota queda "Pagada" cuando lo abonado cubre su valor, en orden
        let restante = totalPagado;
        const cubiertas = [];
        for (const c of cuotas) {
            const v = parseFloat(c.valor_cuota) || 0;
            if (saldo === 0 || restante + 0.01 >= v) {
                cubiertas.push(c.id);
                restante -= v;
            } else {
                break;
            }
        }

        return {
            saldo,
            estado: saldo <= 0 ? 'Finalizado' : 'Activo',
            cubiertas
        };
    };

    return {
        isSupabaseActive() {
            return !!_supabase;
        },

        // =====================================================
        // CLIENTES
        // =====================================================
        async getClientes() {
            if (useLocalStorage()) {
                return leerLS('sp_clientes', [
                    { id: '1', cedula: '0928374651', nombre: 'Juan Pérez', telefono: '0991234567', direccion: 'Guayaquil', estado: 'Activo' }
                ]);
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
                const clientes = await this.getClientes();
                cliente.id = cliente.id || 'CLI-' + Date.now();

                const index = clientes.findIndex(c => c.id === cliente.id);
                if (index >= 0) {
                    clientes[index] = { ...clientes[index], ...cliente };
                } else {
                    clientes.push(cliente);
                }

                guardarLS('sp_clientes', clientes);
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
                const clientes = (await this.getClientes()).filter(c => c.id !== id);
                guardarLS('sp_clientes', clientes);
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

        // =====================================================
        // PRÉSTAMOS & CUOTAS
        // =====================================================
        async getPrestamos() {
            if (useLocalStorage()) {
                const lista = leerLS('sp_prestamos', []);
                const clientes = leerLS('sp_clientes', []);
                return lista.map(p => normalizarPrestamo({
                    ...p,
                    clientes: clientes.find(c => String(c.id) === String(p.cliente_id)) || null
                }));
            }

            try {
                const { data, error } = await _supabase
                    .from('prestamos')
                    .select('*, clientes(*), cuotas(*)')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(normalizarPrestamo);
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
                return normalizarPrestamo(data);
            } catch (err) {
                console.error('Error al obtener préstamo por ID:', err);
                throw err;
            }
        },

        // Todos los préstamos (con cuotas) de un cliente específico
        async getPrestamosPorCliente(clienteId) {
            const prestamos = await this.getPrestamos();
            return prestamos.filter(p => String(p.cliente_id) === String(clienteId));
        },

        async createPrestamo(prestamoData, cuotasArray) {
            // Total real con interés: la única fórmula del sistema
            const monto = round2(prestamoData.monto);
            const tasa = parseFloat(prestamoData.interes_pct) || 0;
            const total = round2(monto + (monto * tasa / 100));
            const numCuotas = parseInt(prestamoData.cuotas_count) || cuotasArray.length || 1;

            // Cuotas con centavos exactos: la última absorbe el redondeo,
            // así la suma de cuotas siempre es igual al total.
            const cuotasFix = cuotasArray.map(c => ({ ...c, valor_cuota: round2(c.valor_cuota) }));
            if (cuotasFix.length > 0) {
                const sumaPrevias = round2(
                    cuotasFix.slice(0, -1).reduce((s, c) => s + c.valor_cuota, 0)
                );
                cuotasFix[cuotasFix.length - 1].valor_cuota = round2(total - sumaPrevias);
            }

            if (useLocalStorage()) {
                const prestamos = leerLS('sp_prestamos', []);
                const newId = prestamoData.id || 'PR-' + Date.now();

                const fullPrestamo = {
                    id: newId,
                    codigo: prestamoData.codigo,
                    cliente_id: prestamoData.cliente_id,
                    monto,
                    interes_pct: tasa,
                    total,
                    saldo: total,
                    frecuencia: prestamoData.frecuencia,
                    cuotas_count: numCuotas,
                    estado: 'Activo',
                    created_at: new Date().toISOString(),
                    cuotas: cuotasFix.map(c => ({
                        ...c,
                        id: 'C-' + newId + '-' + c.num_cuota,
                        estado: 'Pendiente'
                    }))
                };

                prestamos.push(fullPrestamo);
                guardarLS('sp_prestamos', prestamos);
                return fullPrestamo;
            }

            let prestamoId = null;
            try {
                // 1. Insertar el préstamo (solo columnas que existen en el schema)
                const { data: pres, error: errPres } = await _supabase
                    .from('prestamos')
                    .insert([{
                        codigo: prestamoData.codigo,
                        cliente_id: prestamoData.cliente_id,
                        monto,
                        interes_pct: tasa,
                        total,
                        saldo: total,
                        frecuencia: prestamoData.frecuencia,
                        cuotas_count: numCuotas,
                        estado: 'Activo'
                    }])
                    .select();
                if (errPres) throw errPres;

                const prestamoCreado = pres[0];
                prestamoId = prestamoCreado.id;

                // 2. Insertar el cronograma de cuotas
                const cuotasMapped = cuotasFix.map(c => ({
                    prestamo_id: prestamoId,
                    num_cuota: c.num_cuota,
                    fecha_vencimiento: c.fecha_vencimiento,
                    valor_cuota: c.valor_cuota,
                    estado: 'Pendiente'
                }));

                const { error: errCuotas } = await _supabase.from('cuotas').insert(cuotasMapped);
                if (errCuotas) throw errCuotas;

                return prestamoCreado;
            } catch (err) {
                console.error('Error al crear préstamo:', err);
                // Si falló al crear las cuotas, no dejar un préstamo huérfano
                if (prestamoId) {
                    await _supabase.from('prestamos').delete().eq('id', prestamoId);
                }
                throw err;
            }
        },

        /**
         * Desvincula los préstamos de un cliente antes de borrarlo, para que
         * el ON DELETE CASCADE de la tabla clientes no arrastre préstamos,
         * cuotas ni pagos ya históricos. Conserva el nombre en cliente_nombre.
         */
        async desvincularPrestamos(clienteId, nombreCliente) {
            if (useLocalStorage()) {
                const prestamos = leerLS('sp_prestamos', []);
                prestamos.forEach(p => {
                    if (String(p.cliente_id) === String(clienteId)) {
                        p.cliente_id = null;
                        p.cliente_nombre = nombreCliente;
                    }
                });
                guardarLS('sp_prestamos', prestamos);
                return;
            }

            try {
                const { error } = await _supabase
                    .from('prestamos')
                    .update({ cliente_id: null, cliente_nombre: nombreCliente })
                    .eq('cliente_id', clienteId);
                if (error) throw error;
            } catch (err) {
                console.error('Error al desvincular préstamos del cliente:', err);
                throw err;
            }
        },

        // =====================================================
        // PAGOS & COBROS
        // =====================================================
        async getPagos() {
            if (useLocalStorage()) {
                return leerLS('sp_pagos', []);
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

        /**
         * Registra un pago y recalcula saldo, estado y cuotas del préstamo.
         * pagoData: { num_recibo, prestamo_id, monto, fecha, metodo, observaciones }
         * Devuelve el pago guardado (con su id real y created_at).
         */
        async registrarPago(pagoData) {
            const monto = round2(pagoData.monto);
            if (!(monto > 0)) throw new Error('El monto del pago debe ser mayor a 0');

            // ---------- Respaldo LocalStorage ----------
            if (useLocalStorage()) {
                const pagos = leerLS('sp_pagos', []);
                const nuevoPago = {
                    ...pagoData,
                    monto,
                    id: 'PAG-' + Date.now(),
                    created_at: new Date().toISOString()
                };
                pagos.push(nuevoPago);
                guardarLS('sp_pagos', pagos);

                const prestamos = leerLS('sp_prestamos', []);
                const p = prestamos.find(x => String(x.id) === String(pagoData.prestamo_id));
                if (p) {
                    const cuotas = (p.cuotas || []).slice().sort((a, b) => a.num_cuota - b.num_cuota);
                    const montos = pagos
                        .filter(g => String(g.prestamo_id) === String(p.id))
                        .map(g => g.monto);
                    const r = calcularEstadoPrestamo(parseFloat(p.total) || 0, montos, cuotas);

                    p.saldo = r.saldo;
                    p.estado = r.estado;
                    (p.cuotas || []).forEach(c => {
                        if (r.cubiertas.includes(c.id) && c.estado !== 'Pagado') {
                            c.estado = 'Pagado';
                            c.fecha_pago = pagoData.fecha;
                        }
                    });
                }
                guardarLS('sp_prestamos', prestamos);
                return nuevoPago;
            }

            // ---------- Supabase ----------
            try {
                // 1. Guardar el pago (sin id: Supabase genera el UUID)
                const { data: pagoRes, error: errPago } = await _supabase
                    .from('pagos')
                    .insert([{
                        num_recibo: pagoData.num_recibo,
                        prestamo_id: pagoData.prestamo_id,
                        monto,
                        fecha: pagoData.fecha,
                        metodo: pagoData.metodo,
                        observaciones: pagoData.observaciones
                    }])
                    .select();
                if (errPago) throw errPago;

                // 2. Leer total, todos los pagos y las cuotas del préstamo
                const { data: pres, error: e1 } = await _supabase
                    .from('prestamos').select('total').eq('id', pagoData.prestamo_id).single();
                if (e1) throw e1;

                const { data: pagosPrest, error: e2 } = await _supabase
                    .from('pagos').select('monto').eq('prestamo_id', pagoData.prestamo_id);
                if (e2) throw e2;

                const { data: cuotas, error: e3 } = await _supabase
                    .from('cuotas').select('id, valor_cuota, estado')
                    .eq('prestamo_id', pagoData.prestamo_id)
                    .order('num_cuota', { ascending: true });
                if (e3) throw e3;

                // 3. saldo = total - suma de pagos
                const r = calcularEstadoPrestamo(
                    parseFloat(pres.total) || 0,
                    pagosPrest.map(g => g.monto),
                    cuotas
                );

                // 4. Marcar como pagadas las cuotas nuevas que cubre lo abonado
                const nuevas = cuotas
                    .filter(c => r.cubiertas.includes(c.id) && c.estado !== 'Pagado')
                    .map(c => c.id);

                if (nuevas.length > 0) {
                    const { error: e4 } = await _supabase
                        .from('cuotas')
                        .update({ estado: 'Pagado', fecha_pago: pagoData.fecha })
                        .in('id', nuevas);
                    if (e4) throw e4;
                }

                // 5. Guardar saldo y estado del préstamo
                const { error: e5 } = await _supabase
                    .from('prestamos')
                    .update({ saldo: r.saldo, estado: r.estado })
                    .eq('id', pagoData.prestamo_id);
                if (e5) throw e5;

                return pagoRes[0];
            } catch (err) {
                console.error('Error al registrar pago en Supabase:', err);
                throw err;
            }
        },

        // =====================================================
        // AUDITORÍA
        // =====================================================
        async getAuditoria() {
            if (useLocalStorage()) {
                return leerLS('sp_auditoria', []);
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
                const logs = await this.getAuditoria();
                logs.unshift(entry);
                guardarLS('sp_auditoria', logs);
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