-- ===================================================
-- SCHEMA DE BASE DE DATOS SUPABASE (POSTGRESQL)
-- Ejecutar en el Editor SQL de tu proyecto Supabase
-- ===================================================

-- 1. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    direccion TEXT,
    estado VARCHAR(20) DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE PRÉSTAMOS
CREATE TABLE IF NOT EXISTS public.prestamos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    monto NUMERIC(12, 2) NOT NULL,
    interes_pct NUMERIC(5, 2) NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    saldo NUMERIC(12, 2) NOT NULL,
    frecuencia VARCHAR(20) NOT NULL,
    cuotas_count INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE CUOTAS (CRONOGRAMA DE AMORTIZACIÓN)
CREATE TABLE IF NOT EXISTS public.cuotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestamo_id UUID REFERENCES public.prestamos(id) ON DELETE CASCADE,
    num_cuota INT NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    valor_cuota NUMERIC(12, 2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE PAGOS / COBROS
CREATE TABLE IF NOT EXISTS public.pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    num_recibo VARCHAR(30) UNIQUE NOT NULL,
    prestamo_id UUID REFERENCES public.prestamos(id) ON DELETE CASCADE,
    cuota_id UUID REFERENCES public.cuotas(id) ON DELETE SET NULL,
    monto NUMERIC(12, 2) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    metodo VARCHAR(50) NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA DE AUDITORÍA
CREATE TABLE IF NOT EXISTS public.auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario VARCHAR(100) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    registro VARCHAR(200),
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DESHABILITAR RLS PARA DEMOSTRACIÓN (Permite consultas públicas directas con anonKey)
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria DISABLE ROW LEVEL SECURITY;

-- POBLAR DATOS DE PRUEBA INICIALES
INSERT INTO public.clientes (cedula, nombre, telefono, direccion, estado) VALUES
('0928374651', 'Juan Pérez', '0991234567', 'Guayaquil Central', 'Activo'),
('0912345678', 'María López', '0987654321', 'Urdesa Norte', 'Activo');