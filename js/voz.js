/* ==========================================================
   ASISTENTE DE VOZ
   Usa la Web Speech API del navegador (gratis, sin librerías).
   Requiere:
     - Navegador basado en Chromium (Chrome, Edge, Brave...)
     - Conexión a internet (Chrome envía el audio a Google)
     - Permiso del micrófono (el navegador lo pedirá la primera vez)
   ========================================================== */

(function () {
    const btnVoz    = document.getElementById('btn-voz');
    const respuesta = document.getElementById('respuesta-voz');

    if (!btnVoz || !respuesta) return;

    // --- Comprobación de soporte ---
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        btnVoz.addEventListener('click', () => {
            mostrar('Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.');
        });
        return;
    }

    // --- Configuración del reconocedor ---
    const reconocedor = new SpeechRecognition();
    reconocedor.lang = 'es-ES';
    reconocedor.continuous = false;     // se para solo al detectar silencio
    reconocedor.interimResults = false; // solo resultado final
    reconocedor.maxAlternatives = 1;

    let escuchando = false;

    // --- Síntesis de voz (para que Claude-asistente te conteste hablando) ---
    function hablar(texto) {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        u.rate = 1;
        u.pitch = 1;
        speechSynthesis.cancel(); // corta si había otra cosa hablando
        speechSynthesis.speak(u);
    }

    // --- Mostrar texto en la nube y esconderlo tras unos segundos ---
    let timerRespuesta = null;
    function mostrar(texto) {
        respuesta.textContent = texto;
        if (timerRespuesta) clearTimeout(timerRespuesta);
        timerRespuesta = setTimeout(() => {
            respuesta.textContent = '';
        }, 8000);
    }

    // --- Iniciar / parar escucha ---
    btnVoz.addEventListener('click', () => {
        if (escuchando) {
            reconocedor.stop();
            return;
        }
        try {
            reconocedor.start();
        } catch (e) {
            // Puede pasar si se pulsa dos veces muy rápido
            console.warn('No se pudo iniciar el reconocedor:', e);
        }
    });

    reconocedor.onstart = () => {
        escuchando = true;
        btnVoz.classList.add('escuchando');
        btnVoz.textContent = '👂';
        mostrar('Te escucho...');
    };

    reconocedor.onend = () => {
        escuchando = false;
        btnVoz.classList.remove('escuchando');
        btnVoz.textContent = '🎤';
    };

    reconocedor.onerror = (event) => {
        escuchando = false;
        btnVoz.classList.remove('escuchando');
        btnVoz.textContent = '🎤';

        const errores = {
            'no-speech': 'No te he oído. Inténtalo de nuevo.',
            'audio-capture': 'No encuentro ningún micrófono.',
            'not-allowed': 'Necesito permiso para usar el micrófono.',
            'network': 'Sin conexión. El reconocimiento de voz necesita internet.',
            'aborted': ''
        };
        const msg = errores[event.error] ?? `Error: ${event.error}`;
        if (msg) mostrar(msg);
    };

    // --- Aquí llega el texto reconocido ---
    reconocedor.onresult = (event) => {
        const texto = event.results[0][0].transcript.trim().toLowerCase();
        console.log('[Voz] Oí:', texto);
        procesarComando(texto);
    };

    // ==========================================================
    // PROCESADOR DE COMANDOS
    // ==========================================================
    function procesarComando(texto) {
        // --- HORA / FECHA ---
        if (/qu[eé] hora|dime la hora|la hora/.test(texto)) {
            const hora = new Date().toLocaleTimeString('es-ES', {
                hour: '2-digit', minute: '2-digit'
            });
            const r = `Son las ${hora}.`;
            responder(r);
            return;
        }

        if (/qu[eé] d[ií]a|qu[eé] fecha|fecha de hoy/.test(texto)) {
            const fecha = new Date().toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
            responder(`Hoy es ${fecha}.`);
            return;
        }

        // --- TAREAS ---
        // "añade tarea X" / "agrega tarea X" / "apunta tarea X" / "nueva tarea X"
        const mTarea = texto.match(
            /(?:a[nñ]ade|agrega|apunta|crea|nueva|pon)\s+(?:una\s+)?tarea\s+(.+)/
        );
        if (mTarea) {
            const tareaTxt = limpiar(mTarea[1]);
            if (window.todoAPI?.agregar) {
                window.todoAPI.agregar(tareaTxt);
                responder(`Tarea añadida: ${tareaTxt}`);
            } else {
                // Fallback: inyectamos directamente en el input
                const inp = document.getElementById('nueva-tarea');
                const btn = document.getElementById('btn-agregar');
                if (inp && btn) {
                    inp.value = tareaTxt;
                    btn.click();
                    responder(`Tarea añadida: ${tareaTxt}`);
                } else {
                    responder('No encuentro la lista de tareas.');
                }
            }
            return;
        }

        // --- NOTAS ---
        // "apunta nota X" / "toma nota X" / "nota X" / "nueva nota X"
        const mNota = texto.match(
            /(?:apunta|toma|crea|a[nñ]ade|pon|nueva)\s+(?:una\s+)?nota\s+(.+)/
        );
        if (mNota) {
            const notaTxt = limpiar(mNota[1]);
            if (window.notasAPI?.agregar) {
                window.notasAPI.agregar(notaTxt);
                responder(`Nota guardada: ${notaTxt}`);
            } else {
                responder('No puedo acceder a las notas.');
            }
            return;
        }

        // --- EVENTOS ---
        // "añade evento X mañana" / "apunta evento X el viernes"
        const mEvento = texto.match(
            /(?:a[nñ]ade|agrega|apunta|crea|nuevo|pon)\s+(?:un\s+)?evento\s+(.+)/
        );
        if (mEvento) {
            const { titulo, fecha, hora } = parsearEvento(mEvento[1]);
            if (!titulo) {
                responder('No te he entendido el evento.');
                return;
            }
            if (window.eventosAPI?.agregar) {
                window.eventosAPI.agregar(titulo, fecha, hora);
                const cuando = fecha === hoyISO() ? 'hoy' :
                               formatearFechaHumana(fecha);
                responder(`Evento "${titulo}" añadido para ${cuando}${hora ? ` a las ${hora}` : ''}.`);
            } else {
                responder('No puedo acceder a los eventos.');
            }
            return;
        }

        // "qué eventos tengo hoy"
        if (/eventos.*(hoy)|qu[eé] tengo hoy|agenda (de )?hoy/.test(texto)) {
            const hoy = window.eventosAPI?.obtenerHoy?.() || [];
            if (hoy.length === 0) {
                responder('No tienes eventos hoy.');
            } else {
                const lista = hoy
                    .map(e => e.hora ? `${e.titulo} a las ${e.hora}` : e.titulo)
                    .join(', ');
                responder(`Hoy tienes: ${lista}.`);
            }
            return;
        }

        // --- MÚSICA ---
        if (/reproduce|pon m[uú]sica|play/.test(texto)) {
            if (window.musicaAPI?.play) {
                window.musicaAPI.play();
                responder('Reproduciendo.');
            } else {
                document.getElementById('btn-musica')?.click();
                responder('Reproduciendo.');
            }
            return;
        }

        if (/pausa|para (la )?m[uú]sica|stop/.test(texto)) {
            if (window.musicaAPI?.pause) {
                window.musicaAPI.pause();
                responder('Música en pausa.');
            } else {
                document.getElementById('btn-musica')?.click();
                responder('Música en pausa.');
            }
            return;
        }

        // --- TIEMPO ---
        if (/qu[eé] tiempo|c[oó]mo est[aá] el tiempo|clima/.test(texto)) {
            // Leemos los primeros datos del DOM ya que tiempo.js los pinta ahí
            const ciudades = document.getElementById('ciudades');
            if (ciudades && ciudades.textContent.trim()) {
                const primera = ciudades.querySelector('p')?.textContent.trim();
                responder(primera || 'Revisa el widget del tiempo.');
            } else {
                responder('Todavía no tengo los datos del tiempo.');
            }
            return;
        }

        // --- ESTADÍSTICAS ---
        if (/(cu[aá]ntas|cu[aá]nto).*(estudi|ejercic|gym)/.test(texto)) {
            const e = document.getElementById('hoy-estudio')?.textContent || '0';
            const g = document.getElementById('hoy-ejercicio')?.textContent || '0';
            responder(`Hoy llevas ${e} horas de estudio y ${g} horas de ejercicio.`);
            return;
        }

        // --- SALUDOS Y AYUDA ---
        if (/^(hola|buenas|hey|hi)/.test(texto)) {
            responder('¡Hola! ¿En qué te ayudo?');
            return;
        }

        if (/ayuda|qu[eé] puedes hacer|comandos/.test(texto)) {
            responder('Puedo: decir la hora, añadir tareas, notas o eventos, dar el tiempo, y controlar la música. Prueba: "añade tarea estudiar mates".');
            return;
        }

        // --- Sin match ---
        responder(`No he entendido "${texto}". Di "ayuda" para ver opciones.`);
    }

    // --- Helpers ---
    function responder(texto) {
        mostrar(texto);
        hablar(texto);
    }

    function limpiar(s) {
        return s.replace(/[.!?¿¡]+$/g, '').trim();
    }

    function hoyISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatearFechaHumana(fechaISO) {
        const [y, m, d] = fechaISO.split('-');
        const fecha = new Date(+y, +m - 1, +d);
        return fecha.toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }

    // Intenta sacar título + fecha + hora a partir de texto libre
    // Ejemplos:
    //   "cumpleaños de marta mañana"
    //   "entrega mates el viernes a las 10"
    //   "comer con juan hoy a las 14:30"
    function parsearEvento(frase) {
        const diasSemana = {
            'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
            'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 0
        };

        let titulo = frase;
        let fecha = hoyISO();
        let hora = '';

        // Hora (varios formatos)
        const mHora = frase.match(/a\s+las\s+(\d{1,2})(?::|\s*y\s*)?(\d{0,2})?/);
        if (mHora) {
            const h = mHora[1].padStart(2, '0');
            const min = (mHora[2] || '00').padStart(2, '0');
            hora = `${h}:${min}`;
            titulo = titulo.replace(mHora[0], '').trim();
        }

        // "hoy"
        if (/\bhoy\b/.test(titulo)) {
            fecha = hoyISO();
            titulo = titulo.replace(/\bhoy\b/, '').trim();
        }
        // "mañana"
        else if (/ma[ñn]ana/.test(titulo)) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            fecha = d.toISOString().slice(0, 10);
            titulo = titulo.replace(/ma[ñn]ana/, '').trim();
        }
        // "pasado mañana"
        else if (/pasado\s+ma[ñn]ana/.test(titulo)) {
            const d = new Date();
            d.setDate(d.getDate() + 2);
            fecha = d.toISOString().slice(0, 10);
            titulo = titulo.replace(/pasado\s+ma[ñn]ana/, '').trim();
        }
        // día de la semana ("el viernes", "lunes"...)
        else {
            for (const [nombre, num] of Object.entries(diasSemana)) {
                const re = new RegExp(`\\b(el\\s+)?${nombre}\\b`);
                if (re.test(titulo)) {
                    const hoy = new Date();
                    const diff = (num - hoy.getDay() + 7) % 7 || 7;
                    const d = new Date();
                    d.setDate(d.getDate() + diff);
                    fecha = d.toISOString().slice(0, 10);
                    titulo = titulo.replace(re, '').trim();
                    break;
                }
            }
        }

        // Limpiar preposiciones sobrantes
        titulo = titulo.replace(/\b(el|la|los|las|a|en|para|de)\s*$/g, '').trim();
        titulo = limpiar(titulo);

        return { titulo, fecha, hora };
    }
})();
