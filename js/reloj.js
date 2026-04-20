/* ==========================================================
   RELOJ + SALUDO
   ========================================================== */

(function () {
    const pSaludo = document.getElementById('saludo');
    const pHora   = document.getElementById('hora');
    const pFecha  = document.getElementById('fecha');

    if (!pSaludo || !pHora || !pFecha) return;

    const OPCIONES_HORA = {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const OPCIONES_FECHA = {
        timeZone: 'Europe/Madrid',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    function actualizarReloj() {
        const ahora = new Date();
        const hora = ahora.getHours();

        let mensaje;
        if (hora >= 6 && hora < 13) {
            mensaje = '¡Buenos días! ☀️';
        } else if (hora >= 13 && hora < 21) {
            mensaje = '¡Buenas tardes! ☕';
        } else {
            mensaje = '¡Buenas noches! 🌙';
        }

        pSaludo.textContent = mensaje;
        pHora.textContent  = ahora.toLocaleTimeString('es-ES', OPCIONES_HORA);
        pFecha.textContent = ahora.toLocaleDateString('es-ES', OPCIONES_FECHA);
    }

    actualizarReloj();
    setInterval(actualizarReloj, 1000);
})();
