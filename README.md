# Mi Control Financiero

PWA de finanzas personales con tutor estilo videojuego (**Mini Cris**). Cada usuario empieza en $0, sin datos de ejemplo.

## Uso rápido

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de cálculos (vitest)
npm run build      # genera la PWA en build/
```

Sin configuración, la app corre en **modo local**: las cuentas y los datos se guardan solo en ese navegador/dispositivo.

## Conectar Supabase (multiusuario, sincronizado)

1. Crea un proyecto en supabase.com.
2. Ejecuta `supabase/migrations/20261105000001_init.sql` en el SQL Editor (crea tablas, índices, RLS, realtime y el bucket privado `documents`).
3. Copia `.env.example` a `.env.local` y pon la URL y la **anon key** (nunca la `service_role`; la app la rechaza si la detecta).
4. En Authentication → URL Configuration agrega la URL de tu sitio como Redirect URL (confirmación de correo y recuperación de contraseña).

## Estructura

- `src/lib/calc/` – lógica financiera pura y probada (presupuesto, quincenas, deudas, compras, metas, simulador, freelance).
- `src/data/repo.ts` – repositorio con dos implementaciones: Supabase y local.
- `src/store/` – estado (Zustand): sesión, datos, UI.
- `src/tutor/` – tutorial guiado (misiones, resaltado, diálogo retro) y consejos por pantalla.
- `src/pages/` – Inicio, Movimientos, Quincena, Deudas, Compras, Metas, Freelance, Simulador, Perfil.

## Reglas de negocio clave

- Montos en COP enteros. Los ingresos extraordinarios (prima) no cuentan hasta marcarse como recibidos.
- Los datos pueden marcarse como *estimados*; el simulador marca todo como *hipotético*.
- Una deuda solo se marca pagada con abonos registrados que dejen el saldo en 0; las simulaciones nunca cambian saldos.
- No se inventan tasas de interés: solo se usan las que ingresa el usuario.
