/* ==========================================================
   ESTADÍSTICAS PERSONALES
   Guarda en LocalStorage bajo 'historialEspacial'
   ========================================================== */

(function () {
    const btnRegistrar = document.getElementById('btn-registrar-stats');
    const inputEstudio = document.getElementById('input-estudio');
    const inputEjercicio = document.getElementById('input-ejercicio');
    const spanEstudio = document.getElementById('hoy-estudio');
    const spanEjercicio = document.getElementById('hoy-ejercicio');

    if (!btnRegistrar) return;

    const obtenerFechaHoy = () => new Date().toLocaleDateString();

    function mostrarResumenHoy() {
        const hoy = obtenerFechaHoy();
        const historial = JSON.parse(localStorage.getItem('historialEspacial')) || {};

        if (historial[hoy]) {
            spanEstudio.textContent = historial[hoy].estudio;
            spanEjercicio.textContent = historial[hoy].ejercicio;
        } else {
            spanEstudio.textContent = '0';
            spanEjercicio.textContent = '0';
        }
    }

    btnRegistrar.addEventListener('click', () => {
        const estudio = parseFloat(inputEstudio.value) || 0;
        const ejercicio = parseFloat(inputEjercicio.value) || 0;

        if (estudio === 0 && ejercicio === 0) {
            if (window.mostrarToast) {
                window.mostrarToast('Introduce algún valor', 'error');
            } else {
                alert('Introduce algún valor para registrar.');
            }
            return;
        }

        const hoy = obtenerFechaHoy();
        const historial = JSON.parse(localStorage.getItem('historialEspacial')) || {};

        if (historial[hoy]) {
            historial[hoy].estudio = parseFloat(historial[hoy].estudio) + estudio;
            historial[hoy].ejercicio = parseFloat(historial[hoy].ejercicio) + ejercicio;
        } else {
            historial[hoy] = { estudio, ejercicio };
        }

        localStorage.setItem('historialEspacial', JSON.stringify(historial));

        inputEstudio.value = '';
        inputEjercicio.value = '';

        mostrarResumenHoy();

        if (window.mostrarToast) window.mostrarToast('Registrado ✓');
    });

    mostrarResumenHoy();
})();
