function actualizarReloj() {
    const pSaludo = document.getElementById("saludo");
    const pHora = document.getElementById("hora");
    const pFecha = document.getElementById("fecha");
    
    const ahora = new Date();
    const horaEspaña = ahora.getHours();

    // 1. Lógica del Saludo (solo texto)
    let mensaje = "";
    if (horaEspaña >= 6 && horaEspaña < 13) {
        mensaje = "¡Buenos días! ☀️";
    } else if (horaEspaña >= 13 && horaEspaña < 21) {
        mensaje = "¡Buenas tardes! ☕";
    } else {
        mensaje = "¡Buenas noches! 🌙";
    }
    pSaludo.textContent = mensaje;

    // 2. Formateo de Hora y Fecha
    const opcionesHora = { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const opcionesFecha = { timeZone: 'Europe/Madrid', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    pHora.textContent = ahora.toLocaleTimeString('es-ES', opcionesHora);
    pFecha.textContent = ahora.toLocaleDateString('es-ES', opcionesFecha);
}

setInterval(actualizarReloj, 1000);
actualizarReloj();