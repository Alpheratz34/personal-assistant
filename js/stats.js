const btnRegistrar = document.getElementById('btn-registrar-stats');

btnRegistrar.addEventListener('click', () => {
    const estudio = parseFloat(document.getElementById('input-estudio').value) || 0;
    const ejercicio = parseFloat(document.getElementById('input-ejercicio').value) || 0;
    
    if (estudio === 0 && ejercicio === 0) return;

    const hoy = new Date().toLocaleDateString();
    let historial = JSON.parse(localStorage.getItem('historialEspacial')) || {};

    // Si el día ya existe, sumamos los valores
    if (historial[hoy]) {
        historial[hoy].estudio += estudio;
        historial[hoy].ejercicio += ejercicio;
    } else {
        historial[hoy] = { estudio, ejercicio };
    }

    localStorage.setItem('historialEspacial', JSON.stringify(historial));
    
    // Limpiar inputs y actualizar vista rápida
    document.getElementById('input-estudio').value = "";
    document.getElementById('input-ejercicio').value = "";
    mostrarResumenHoy();
    alert("Datos guardados en la bitácora.");
});

function mostrarResumenHoy() {
    const hoy = new Date().toLocaleDateString();
    const historial = JSON.parse(localStorage.getItem('historialEspacial')) || {};
    if (historial[hoy]) {
        document.getElementById('hoy-estudio').textContent = historial[hoy].estudio;
        document.getElementById('hoy-ejercicio').textContent = historial[hoy].ejercicio;
    }
}

mostrarResumenHoy();