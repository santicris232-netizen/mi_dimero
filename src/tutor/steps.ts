export interface TutorStep {
  route: string;
  target: string | null; // valor de data-tour del elemento a resaltar
  title: string;
  text: (name: string) => string;
  reward?: string;
}

export const TUTORIAL: TutorStep[] = [
  {
    route: '/',
    target: null,
    title: '¡Bienvenido!',
    text: (n) => `¡Hola${n ? `, ${n}` : ''}! Soy Mini Cris, tu tutor financiero. Juntos vamos a dominar tu dinero: organizar tus quincenas, vencer tus deudas y desbloquear tus metas. ¿Listo para la primera misión?`,
  },
  {
    route: '/',
    target: 'stats',
    title: 'Tu tablero',
    text: () => 'Este es tu tablero de juego. Ingresos, gastos, dinero disponible, deudas, fondo de emergencia y tu meta. Todo arranca en $0: tú lo llenas con tus datos reales, sin trucos.',
    reward: '+10 XP',
  },
  {
    route: '/',
    target: 'quick-actions',
    title: 'Atajos',
    text: () => 'Estos atajos te llevan directo a las herramientas más poderosas: distribuir tu quincena, el detector de antojos, ingresos extra y el simulador.',
    reward: '+10 XP',
  },
  {
    route: '/',
    target: 'fab',
    title: 'Botón mágico',
    text: () => 'Este botón es tu arma secreta. Con él registras un gasto o un ingreso en 3 toques: monto, categoría y listo. ¡Úsalo cada vez que muevas dinero!',
    reward: '+20 XP',
  },
  {
    route: '/movimientos',
    target: 'mov-tabs',
    title: 'Movimientos',
    text: () => 'Aquí está tu historial, tus ingresos y tus gastos fijos. Configura lo que recibes en cada quincena y marca como "estimado" todo lo que no sea seguro. La prima o los bonos solo cuentan cuando los recibes.',
    reward: '+20 XP',
  },
  {
    route: '/quincena',
    target: 'quincena-received',
    title: 'Misión principal',
    text: () => 'Cada vez que te paguen, entra aquí y distribuye tu quincena: obligaciones, deudas, gustos, fondo de emergencia y metas. Si asignas más de lo que tienes, te aviso de inmediato.',
    reward: '+30 XP',
  },
  {
    route: '/deudas',
    target: 'debts-add',
    title: 'Jefes finales',
    text: () => 'Las deudas son los jefes finales. Regístralas con su estado, mora y abonos. Si un saldo no lo confirmó la entidad, queda como "estimado". Nunca marco una deuda como pagada sin un pago registrado.',
    reward: '+30 XP',
  },
  {
    route: '/deudas',
    target: 'negotiator',
    title: 'Negociador',
    text: () => 'Con el negociador simulas ofertas: cuánto te ahorras, cuánto te falta y si llegas a la fecha límite. Ojo: una simulación NO es una oferta del banco. Guarda aquí los acuerdos por escrito.',
    reward: '+20 XP',
  },
  {
    route: '/compras',
    target: 'purchase-add',
    title: '¿Realmente lo necesito?',
    text: () => '¿Te dio un antojo? Antes de comprar, pásalo por aquí. Te hago las preguntas clave y, si quieres, activamos una espera de 48 horas. Lo que no compres lo cuento como dinero salvado.',
    reward: '+20 XP',
  },
  {
    route: '/metas',
    target: 'goals-add',
    title: 'Tus metas',
    text: () => 'Aquí creas tu fondo de emergencia, tu moto o cualquier sueño. Calculo cuánto debes ahorrar al mes, tu avance y cuándo llegarás. Para la moto incluyo SOAT, matrícula, casco y más.',
    reward: '+20 XP',
  },
  {
    route: '/ingresos-extra',
    target: 'freelance-add',
    title: 'Ingresos extra',
    text: () => '¿Haces trabajos por tu cuenta? Registra cliente, valor, anticipo y gastos. Decide qué porcentaje va a deudas, ahorro y gustos, ¡y deja que cada proyecto te acerque a tus metas!',
    reward: '+20 XP',
  },
  {
    route: '/simulador',
    target: 'sim-scenarios',
    title: 'Simulador',
    text: () => '"¿Y si pago $500.000 al mes?" "¿Y si uso la prima?" El simulador compara escenarios lado a lado. Todo aquí es hipotético: no toca tus datos reales.',
    reward: '+20 XP',
  },
  {
    route: '/perfil',
    target: 'profile-tutorial',
    title: 'Tu perfil',
    text: () => 'En tu perfil cambias tu nombre y el tema claro u oscuro, exportas copias de seguridad y puedes repetir este tutorial cuando quieras. ¡Yo siempre estaré en el botón de ayuda!',
    reward: '+20 XP',
  },
  {
    route: '/',
    target: null,
    title: '¡Nivel completado!',
    text: (n) => `¡Lo lograste${n ? `, ${n}` : ''}! Desbloqueaste la insignia "Primer paso". Tu siguiente misión real: registra tus ingresos y gastos fijos en Movimientos. ¡Vamos por esa libertad financiera!`,
    reward: '+100 XP',
  },
];

/** Consejos rápidos por pantalla (botón de ayuda de Mini Cris). */
export const PAGE_TIPS: Record<string, string> = {
  '/': 'Revisa tu tablero cada vez que recibas tu pago. "Próximos movimientos" te avisa qué se viene en los próximos 30 días.',
  '/movimientos': 'Primero configura tus ingresos (pestaña Ingresos) y tus gastos fijos. Luego registra cada gasto real con el botón "+".',
  '/quincena': 'Usa "Sugerir" para obtener un reparto inicial y ajústalo a tu gusto. Cuando estés conforme, pulsa "Ejecutar" para registrar aportes y abonos.',
  '/deudas': 'Toca una deuda para registrar abonos, subir comprobantes o simular una negociación. Actualiza el saldo cuando la entidad te lo confirme.',
  '/compras': 'Un gusto planeado no es malo. Lo importante es que no afecte tus deudas ni tu ahorro. La espera de 48 horas te ayuda a decidir con calma.',
  '/metas': 'Si el aporte mensual es menor que el "necesario", ajusta el aporte o la fecha. Registra cada aporte para ver crecer tu barra.',
  '/ingresos-extra': 'Cuando te paguen un trabajo extra te pague, usa "Registrar pago". Se suma a tus ingresos y verás cómo repartirlo según tus porcentajes.',
  '/simulador': 'Las tasas de interés solo se aplican si las registraste en cada deuda. Si no las conoces, la simulación lo indica.',
  '/perfil': 'Exporta una copia de seguridad cada mes. Puedes importarla en cualquier momento para restaurar tus datos.',
};
