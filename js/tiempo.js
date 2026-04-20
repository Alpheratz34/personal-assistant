/* ==========================================================
   TIEMPO - Usa un proxy YQL (el que ya tenías montado)
   ========================================================== */

const SERVER_URL = 'http://api.skyglow.es/snowstorm/yql/weather';

const ciudades = [
    { nombre: "Valdemoro",          id: "776735" },
    { nombre: "Finlandia (Helsinki)", id: "565346" },
    { nombre: "Suiza (Zúrich)",     id: "784794" }
];

const CACHE_MINUTES = 10;
const CACHE_MS = CACHE_MINUTES * 60 * 1000;

async function obtenerClima() {
    const contenedor = document.getElementById('ciudades');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    for (const ciudad of ciudades) {
        try {
            const cacheKey = `clima_${ciudad.id}`;
            const cachedData = localStorage.getItem(cacheKey);
            let datosClima = null;

            // 1. Cache válida
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (Date.now() - parsed.timestamp < CACHE_MS) {
                    datosClima = parsed.data;
                }
            }

            // 2. Fetch si no hay cache
            if (!datosClima) {
                const woeid = ciudad.id;

                const query1 = `select city,country,locationID,woeid,state,latitude,longitude,proximateStation.ID,proximateStation.city,currently.condition.code,currently.timezone,currently.moonphase,currently.moonfacevisible,currently.temp,currently.time24,currently.sunrise24,currently.sunset24,forecast.day.dayOfWeek,forecast.day.poP,forecast.day.temp.high,forecast.day.temp.low,forecast.day.condition.code,location.extended_forecast_url from partner.weather.forecasts where (woeid=${woeid}) and lang='en' and unit='c'`;
                const query2 = `select woeid,hourlyforecast.hour.time24,hourlyforecast.hour.condition.code,hourlyforecast.hour.condition.poP,hourlyforecast.hour.condition.temp from partner.weather.forecasts.hourly where (woeid=${woeid}) and lang='en' and unit='c'`;
                const yqlQuery = `select * from yql.query.multi where queries="${query1}; ${query2}"`;

                const url = new URL(SERVER_URL);
                url.searchParams.append('crossProduct', 'optimized');
                url.searchParams.append('env', 'store://y8kbem5LYN3AXbLbrDFnAp');
                url.searchParams.append('q', yqlQuery);

                const respuesta = await fetch(url.toString());
                if (!respuesta.ok) throw new Error('Server error');

                const xmlText = await respuesta.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

                const currentlyNode = xmlDoc.querySelector('currently');
                const conditionNode = currentlyNode?.querySelector('condition');
                const forecastDayNode = xmlDoc.querySelector('forecast day');

                if (!currentlyNode || !conditionNode) {
                    throw new Error('Estructura XML inesperada');
                }

                datosClima = {
                    temp: Math.round(parseFloat(currentlyNode.getAttribute('temp'))),
                    code: conditionNode.getAttribute('code'),
                    pop:  forecastDayNode ? forecastDayNode.getAttribute('poP') : '0'
                };

                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: datosClima
                }));
            }

            // 3. Pintar en UI
            const desc = obtenerTextoCondicion(datosClima.code);
            const icon = obtenerIconoEspacial(datosClima.code);

            const p = document.createElement('p');
            p.style.marginBottom = '10px';
            p.innerHTML = `
                <span style="color: var(--azul-nebulosa); font-weight: bold;">${ciudad.nombre}:</span>
                ${datosClima.temp}°C ${icon} <br>
                <small style="opacity: 0.8; text-transform: capitalize;">
                    ${desc} | 💧 ${datosClima.pop}% precip.
                </small>
            `;
            contenedor.appendChild(p);

        } catch (error) {
            console.error(`Error clima ${ciudad.nombre}:`, error);
            const p = document.createElement('p');
            p.style.opacity = '0.5';
            p.innerHTML = `<span style="color: var(--azul-nebulosa);">${ciudad.nombre}:</span> —`;
            contenedor.appendChild(p);
        }
    }
}

function obtenerIconoEspacial(codeStr) {
    const code = parseInt(codeStr, 10);
    if ([0, 1, 2, 3, 4, 37, 38, 39, 45, 47].includes(code)) return '⚡';
    if ([8, 9, 10, 11, 12, 40].includes(code)) return '🌧️';
    if ([5, 6, 7, 13, 14, 15, 16, 41, 42, 43, 46].includes(code)) return '❄️';
    if ([26, 27, 28, 29, 30, 44].includes(code)) return '☁️';
    if ([31, 32, 33, 34, 36].includes(code)) return '☀️';
    return '🔭';
}

function obtenerTextoCondicion(codeStr) {
    const code = parseInt(codeStr, 10);
    if ([31, 32, 33, 34, 36].includes(code)) return 'despejado';
    if ([26, 27, 28, 29, 30, 44].includes(code)) return 'nublado';
    if ([8, 9, 10, 11, 12, 40].includes(code)) return 'lluvioso';
    if ([0, 1, 2, 3, 4, 37, 38, 39, 45, 47].includes(code)) return 'tormenta';
    if ([5, 6, 7, 13, 14, 15, 16, 41, 42, 43, 46].includes(code)) return 'nieve';
    return 'clima variable';
}

obtenerClima();
setInterval(obtenerClima, 600000);
