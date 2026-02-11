const API_KEY = 'TU_API_KEY_AQUÍ'; // Sustituye esto por tu clave
const ciudades = [
    { nombre: "Valdemoro", id: "3106518" },
    { nombre: "Majadahonda", id: "3118434" },
    { nombre: "Finlandia (Helsinki)", id: "658225" },
    { nombre: "Suiza (Zúrich)", id: "2657896" }
];

async function obtenerClima() {
    const contenedor = document.getElementById('ciudades');
    contenedor.innerHTML = ""; // Limpiar antes de cargar

    for (const ciudad of ciudades) {
        try {
            const respuesta = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?id=${ciudad.id}&appid=${API_KEY}&units=metric&lang=es`
            );
            const data = await respuesta.json();

            const temp = Math.round(data.main.temp);
            const desc = data.weather[0].description;
            const icon = obtenerIconoEspacial(data.weather[0].main);

            // Crear el elemento visual
            const p = document.createElement('p');
            p.style.marginBottom = "10px";
            p.innerHTML = `
                <span style="color: var(--azul-nebulosa); font-weight: bold;">${ciudad.nombre}:</span> 
                ${temp}°C ${icon} <br>
                <small style="opacity: 0.6; text-transform: capitalize;">${desc}</small>
            `;
            contenedor.appendChild(p);

        } catch (error) {
            console.error("Error al obtener clima de " + ciudad.nombre, error);
        }
    }
}

// Función para poner iconos que peguen con el estilo galáctico
function obtenerIconoEspacial(clima) {
    const iconos = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Snow': '❄️',
        'Thunderstorm': '⚡',
        'Drizzle': '🌦️'
    };
    return iconos[clima] || '🔭';
}

// Actualizar cada 10 minutos
obtenerClima();
setInterval(obtenerClima, 600000);