/* ==========================================================
   ASISTENTE DE VOZ
   Usa Whisper (OpenAI) via @xenova/transformers (WASM, sin compilar).
   El modelo (~75 MB) se descarga la PRIMERA vez y queda cacheado.
   No necesita API keys ni Visual Studio.
   ========================================================== */

(function () {
    const btnVoz    = document.getElementById('btn-voz');
    const respuesta = document.getElementById('respuesta-voz');
    if (!btnVoz || !respuesta) return;

    // -------------------------------------------------------
    // Utilidades de UI
    // -------------------------------------------------------
    let timerRespuesta = null;
    function mostrar(texto) {
        respuesta.textContent = texto;
        if (timerRespuesta) clearTimeout(timerRespuesta);
        timerRespuesta = setTimeout(() => { respuesta.textContent = ''; }, 8000);
    }

    function hablar(texto) {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(texto);
        u.lang  = 'es-ES';
        u.rate  = 1;
        u.pitch = 1;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    }

    function responder(texto) {
        mostrar(texto);
        hablar(texto);
    }

    // -------------------------------------------------------
    // Carga de Whisper (lazy, se hace una sola vez)
    // -------------------------------------------------------
    let transcriber = null;
    let whisperCargando = false;

    async function getTranscriber() {
        if (transcriber) return transcriber;
        if (whisperCargando) return null;
        whisperCargando = true;

        try {
            mostrar('Cargando modelo de voz (primera vez ~75 MB)…');
            const { pipeline } = await import(
                'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
            );
            transcriber = await pipeline(
                'automatic-speech-recognition',
                'Xenova/whisper-tiny',
                {
                    progress_callback: (p) => {
                        if (p.progress != null) {
                            mostrar(`Descargando modelo… ${Math.round(p.progress)}%`);
                        }
                    }
                }
            );
            mostrar('¡Modelo listo! Pulsa el micrófono para hablar.');
            return transcriber;
        } catch (e) {
            console.error('[Voz] Error cargando Whisper:', e);
            mostrar('Error al cargar el modelo de voz.');
            whisperCargando = false;
            return null;
        }
    }

    // Precarga en segundo plano al abrir la app
    getTranscriber();

    // -------------------------------------------------------
    // Grabación de audio
    // -------------------------------------------------------
    let audioChunks  = [];
    let audioContext = null;
    let micStream    = null;
    let processor    = null;
    let grabando     = false;
    let recordTimer  = null;

    btnVoz.addEventListener('click', async () => {
        if (grabando) {
            await detener();
        } else {
            await iniciar();
        }
    });

    async function iniciar() {
        const t = await getTranscriber();
        if (!t) { mostrar('Modelo aún no cargado, espera un momento.'); return; }

        try {
            micStream    = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(micStream);
            processor    = audioContext.createScriptProcessor(4096, 1, 1);
            audioChunks  = [];

            processor.onaudioprocess = (e) => {
                if (!grabando) return;
                audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            grabando = true;
            btnVoz.classList.add('escuchando');
            btnVoz.textContent = '👂';
            mostrar('Te escucho…');

            // Parada automática a los 7 segundos
            recordTimer = setTimeout(detener, 7000);

        } catch (err) {
            console.error('[Voz]', err);
            mostrar(err.name === 'NotAllowedError'
                ? 'Necesito permiso para usar el micrófono.'
                : `Error de micrófono: ${err.message}`
            );
        }
    }

    async function detener() {
        if (!grabando) return;
        grabando = false;

        if (recordTimer) { clearTimeout(recordTimer); recordTimer = null; }
        if (processor)   { processor.disconnect();  processor   = null; }
        if (audioContext){ audioContext.close();     audioContext = null; }
        if (micStream)   { micStream.getTracks().forEach(t => t.stop()); micStream = null; }

        btnVoz.classList.remove('escuchando');
        btnVoz.textContent = '🎤';

        if (audioChunks.length === 0) {
            mostrar('No grabé nada. Inténtalo de nuevo.');
            return;
        }

        mostrar('Procesando…');

        // Unir todos los fragmentos de audio en un solo Float32Array
        const total = audioChunks.reduce((s, c) => s + c.length, 0);
        const audio = new Float32Array(total);
        let off = 0;
        for (const chunk of audioChunks) { audio.set(chunk, off); off += chunk.length; }
        audioChunks = [];

        try {
            const result = await transcriber(audio, { language: 'spanish', task: 'transcribe' });
            const texto  = result.text?.trim().toLowerCase().replace(/^[\s,./¿¡]+|[\s,./!?]+$/g, '');
            console.log('[Voz] Oí:', texto);
            if (texto) {
                mostrar(`"${texto}"`);
                procesarComando(texto);
            } else {
                mostrar('No te he entendido. Inténtalo de nuevo.');
            }
        } catch (e) {
            console.error('[Voz] Error transcribiendo:', e);
            mostrar('Error al transcribir. Inténtalo de nuevo.');
        }
    }

    // ==========================================================
    // PROCESADOR DE COMANDOS
    // ==========================================================
    function procesarComando(texto) {
        // --- HORA / FECHA ---
        if (/qu[eé] hora|dime la hora|la hora/.test(texto)) {
            const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            responder(`Son las ${hora}.`);
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
        const mTarea = texto.match(
            /(?:a[nñ]ade|agrega|apunta|crea|nueva|pon)\s+(?:una\s+)?tarea\s+(.+)/
        );
        if (mTarea) {
            const tareaTxt = limpiar(mTarea[1]);
            if (window.todoAPI?.agregar) {
                window.todoAPI.agregar(tareaTxt);
                responder(`Tarea añadida: ${tareaTxt}`);
            } else {
                const inp = document.getElementById('nueva-tarea');
                const btn = document.getElementById('btn-agregar');
                if (inp && btn) { inp.value = tareaTxt; btn.click(); responder(`Tarea añadida: ${tareaTxt}`); }
                else responder('No encuentro la lista de tareas.');
            }
            return;
        }

        // --- NOTAS ---
        const mNota = texto.match(
            /(?:apunta|toma|crea|a[nñ]ade|pon|nueva)\s+(?:una\s+)?nota\s+(.+)/
        );
        if (mNota) {
            const notaTxt = limpiar(mNota[1]);
            if (window.notasAPI?.agregar) { window.notasAPI.agregar(notaTxt); responder(`Nota guardada: ${notaTxt}`); }
            else responder('No puedo acceder a las notas.');
            return;
        }

        // --- EVENTOS ---
        const mEvento = texto.match(
            /(?:a[nñ]ade|agrega|apunta|crea|nuevo|pon)\s+(?:un\s+)?evento\s+(.+)/
        );
        if (mEvento) {
            const { titulo, fecha, hora } = parsearEvento(mEvento[1]);
            if (!titulo) { responder('No te he entendido el evento.'); return; }
            if (window.eventosAPI?.agregar) {
                window.eventosAPI.agregar(titulo, fecha, hora);
                const cuando = fecha === hoyISO() ? 'hoy' : formatearFechaHumana(fecha);
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
                const lista = hoy.map(e => e.hora ? `${e.titulo} a las ${e.hora}` : e.titulo).join(', ');
                responder(`Hoy tienes: ${lista}.`);
            }
            return;
        }

        // --- MÚSICA ---
        if (/reproduce|pon m[uú]sica|play/.test(texto)) {
            if (window.musicaAPI?.play) window.musicaAPI.play();
            else document.getElementById('btn-musica')?.click();
            responder('Reproduciendo.');
            return;
        }

        if (/pausa|para (la )?m[uú]sica|stop/.test(texto)) {
            if (window.musicaAPI?.pause) window.musicaAPI.pause();
            else document.getElementById('btn-musica')?.click();
            responder('Música en pausa.');
            return;
        }

        // --- TIEMPO ---
        if (/qu[eé] tiempo|c[oó]mo est[aá] el tiempo|clima/.test(texto)) {
            const ciudades = document.getElementById('ciudades');
            if (ciudades?.textContent.trim()) {
                responder(ciudades.querySelector('p')?.textContent.trim() || 'Revisa el widget del tiempo.');
            } else {
                responder('Todavía no tengo los datos del tiempo.');
            }
            return;
        }

        // --- ESTADÍSTICAS ---
        if (/(cu[aá]ntas|cu[aá]nto).*(estudi|ejercic|gym)/.test(texto)) {
            const e = document.getElementById('hoy-estudio')?.textContent  || '0';
            const g = document.getElementById('hoy-ejercicio')?.textContent || '0';
            responder(`Hoy llevas ${e} horas de estudio y ${g} horas de ejercicio.`);
            return;
        }

        // --- SALUDOS Y AYUDA ---
        if (/^(hola|buenas|hey|hi)/.test(texto)) { responder('¡Hola! ¿En qué te ayudo?'); return; }

        if (/ayuda|qu[eé] puedes hacer|comandos/.test(texto)) {
            responder('Puedo: decir la hora, añadir tareas, notas o eventos, dar el tiempo y controlar la música. Prueba: "añade tarea estudiar mates".');
            return;
        }

        responder(`No he entendido "${texto}". Di "ayuda" para ver opciones.`);
    }

    // --- Helpers ---
    function limpiar(s) { return s.replace(/[.!?¿¡]+$/g, '').trim(); }

    function hoyISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function formatearFechaHumana(fechaISO) {
        const [y, m, d] = fechaISO.split('-');
        return new Date(+y, +m-1, +d).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }

    function parsearEvento(frase) {
        const diasSemana = {
            'lunes':1,'martes':2,'miercoles':3,'miércoles':3,
            'jueves':4,'viernes':5,'sabado':6,'sábado':6,'domingo':0
        };
        let titulo = frase, fecha = hoyISO(), hora = '';

        const mHora = frase.match(/a\s+las\s+(\d{1,2})(?::|\s*y\s*)?(\d{0,2})?/);
        if (mHora) {
            hora   = `${mHora[1].padStart(2,'0')}:${(mHora[2]||'00').padStart(2,'0')}`;
            titulo = titulo.replace(mHora[0], '').trim();
        }

        if (/\bhoy\b/.test(titulo)) {
            fecha  = hoyISO();
            titulo = titulo.replace(/\bhoy\b/, '').trim();
        } else if (/ma[ñn]ana/.test(titulo)) {
            const d = new Date(); d.setDate(d.getDate()+1);
            fecha  = d.toISOString().slice(0,10);
            titulo = titulo.replace(/ma[ñn]ana/, '').trim();
        } else if (/pasado\s+ma[ñn]ana/.test(titulo)) {
            const d = new Date(); d.setDate(d.getDate()+2);
            fecha  = d.toISOString().slice(0,10);
            titulo = titulo.replace(/pasado\s+ma[ñn]ana/, '').trim();
        } else {
            for (const [nombre, num] of Object.entries(diasSemana)) {
                const re = new RegExp(`\\b(el\\s+)?${nombre}\\b`);
                if (re.test(titulo)) {
                    const hoyDia = new Date();
                    const diff   = (num - hoyDia.getDay() + 7) % 7 || 7;
                    const d = new Date(); d.setDate(d.getDate()+diff);
                    fecha  = d.toISOString().slice(0,10);
                    titulo = titulo.replace(re, '').trim();
                    break;
                }
            }
        }

        titulo = titulo.replace(/\b(el|la|los|las|a|en|para|de)\s*$/g, '').trim();
        titulo = limpiar(titulo);
        return { titulo, fecha, hora };
    }
})();
