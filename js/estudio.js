/* ==========================================================
   MODO ESTUDIO
   - Pomodoro con tiempos editables
   - Lluvia + truenos (Web Audio API, sin red)
   - Jazz (radio stream, requiere conexión)
   - Espejo de tareas y notas (mismo localStorage)
   - Juegos de descanso: respiración guiada y memoria
   ========================================================== */

(function () {
    'use strict';

    // ============================================================
    // ESTADO
    // ============================================================
    const EST = {
        activo:       false,
        fase:         'idle',   // idle | estudio | descanso
        minEstudio:   25,
        minDescanso:  5,
        segundos:     0,
        totalSegundos: 0,
        timer:        null,
        pausado:      false,
        sesiones:     0,
    };

    const CIRCUMFERENCE = 2 * Math.PI * 88;  // r=88 del SVG

    // ============================================================
    // AUDIO – LLUVIA + TRUENOS (Web Audio API)
    // ============================================================
    let audioCtx    = null;
    let rainSource  = null;
    let rainGain    = null;
    let thunderTimer = null;

    // AUDIO – JAZZ
    let jazzGen            = null;
    let spotifyController  = null;   // Spotify iFrame API controller

    // Callback global que Spotify llama al cargar su SDK
    if (!window.onSpotifyIframeApiReady) {
        window.onSpotifyIframeApiReady = function (IFrameAPI) {
            window._spotifyIFrameAPI = IFrameAPI;
            if (typeof window._spotifyPendingInit === 'function') {
                window._spotifyPendingInit();
                window._spotifyPendingInit = null;
            }
        };
    }

    let ambienceActual = 'none';
    let volumen        = Math.pow(0.6, 1.8);  // matches slider default of 60
    let rainIntensidad = 'media';

    const RAIN_PARAMS = {
        suave:  { bandpassFreq: 300, bandpassQ: 0.2, highpassFreq:  80, gainMult: 0.45, thunderDelayMin: 40000, thunderDelayRange: 60000, thunderVol: 0.5  },
        media:  { bandpassFreq: 400, bandpassQ: 0.3, highpassFreq: 150, gainMult: 0.65, thunderDelayMin: 18000, thunderDelayRange: 45000, thunderVol: 0.85 },
        fuerte: { bandpassFreq: 650, bandpassQ: 0.5, highpassFreq: 200, gainMult: 0.95, thunderDelayMin:  8000, thunderDelayRange: 22000, thunderVol: 1.1  },
    };

    function crearContexto() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // --- Lluvia ---
    function crearLluvia() {
        crearContexto();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const p      = RAIN_PARAMS[rainIntensidad];
        const rate   = audioCtx.sampleRate;
        const bufLen = 2 * rate;
        const buf    = audioCtx.createBuffer(1, bufLen, rate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

        rainSource = audioCtx.createBufferSource();
        rainSource.buffer = buf;
        rainSource.loop   = true;

        const f1 = audioCtx.createBiquadFilter();
        f1.type            = 'bandpass';
        f1.frequency.value = p.bandpassFreq;
        f1.Q.value         = p.bandpassQ;

        const f2 = audioCtx.createBiquadFilter();
        f2.type            = 'highpass';
        f2.frequency.value = p.highpassFreq;

        rainGain = audioCtx.createGain();
        rainGain.gain.value = volumen * p.gainMult;

        rainSource.connect(f1);
        f1.connect(f2);
        f2.connect(rainGain);
        rainGain.connect(audioCtx.destination);
        rainSource.start();

        programarTrueno();
    }

    function pararLluvia() {
        clearTimeout(thunderTimer);
        thunderTimer = null;
        if (rainGain && audioCtx) {
            try {
                rainGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
                setTimeout(() => {
                    try { if (rainSource) rainSource.stop(); } catch (_) {}
                    rainSource = null;
                    rainGain   = null;
                }, 600);
            } catch (_) {}
        }
    }

    function programarTrueno() {
        const p     = RAIN_PARAMS[rainIntensidad];
        const delay = p.thunderDelayMin + Math.random() * p.thunderDelayRange;
        thunderTimer = setTimeout(() => {
            if (ambienceActual === 'rain') reproducirTrueno();
            programarTrueno();
        }, delay);
    }

    function reproducirTrueno() {
        if (!audioCtx) return;
        const p   = RAIN_PARAMS[rainIntensidad];
        const dur = 2.2 + Math.random() * 2.8;
        const t   = audioCtx.currentTime;

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(volumen * p.thunderVol, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);

        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(22 + Math.random() * 14, t);
        osc.frequency.linearRampToValueAtTime(10, t + dur);

        const lp = audioCtx.createBiquadFilter();
        lp.type            = 'lowpass';
        lp.frequency.value = 90;

        osc.connect(lp);
        lp.connect(g);
        g.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur);
    }

    // ============================================================
    // JAZZ GENERATOR (Web Audio API)
    // Progresión ii-V-I-vi en Do mayor, piano ambient
    // ============================================================
    class JazzGenerator {
        constructor() {
            this.ctx      = null;
            this.master   = null;
            this.activo   = false;
            this.timer    = null;
            this.idx      = 0;

            // Frecuencias (Hz, afinación igual, La4=440)
            // Formato: { bass, notas[] }  —  voicings jazzísticos reales
            this.PROG = [
                // Dm9   (ii9)
                { bass: 146.83, notas: [293.66, 349.23, 440.00, 523.25, 659.25], dur: 5.5 },
                // G13   (V13)
                { bass: 196.00, notas: [392.00, 493.88, 587.33, 698.46, 440.00], dur: 5.5 },
                // Cmaj9 (Imaj9)
                { bass: 130.81, notas: [329.63, 392.00, 493.88, 587.33, 659.25], dur: 6.0 },
                // Am9   (vim9)
                { bass: 110.00, notas: [220.00, 261.63, 329.63, 392.00, 493.88], dur: 5.0 },
                // Gm9   (ii9 de F)
                { bass: 196.00, notas: [392.00, 466.16, 587.33, 698.46, 783.99], dur: 5.0 },
                // C13   (V13 de F)
                { bass: 130.81, notas: [261.63, 329.63, 392.00, 466.16, 587.33], dur: 5.5 },
                // Fmaj9 (Imaj9 de F)
                { bass: 174.61, notas: [349.23, 440.00, 523.25, 659.25, 783.99], dur: 6.5 },
                // Dm7   (retorno)
                { bass: 146.83, notas: [293.66, 349.23, 440.00, 523.25],         dur: 4.5 },
            ];
        }

        _nota(freq, t, dur, gain) {
            const ctx = this.ctx;
            // Piano = mezcla sine (fondo) + triangle (cuerpo) + envolvente ADSR
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const env  = ctx.createGain();
            const m1   = ctx.createGain();
            const m2   = ctx.createGain();

            osc1.type = 'sine';     osc1.frequency.value = freq;
            osc2.type = 'triangle'; osc2.frequency.value = freq;
            m1.gain.value = 0.65;
            m2.gain.value = 0.35;

            // Envolvente: ataque rápido → decaimiento → sustain → release
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(gain, t + 0.028);
            env.gain.exponentialRampToValueAtTime(gain * 0.62, t + 0.18);
            env.gain.setValueAtTime(gain * 0.62, t + dur * 0.72);
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

            osc1.connect(m1); m1.connect(env);
            osc2.connect(m2); m2.connect(env);
            env.connect(this.master);

            osc1.start(t); osc1.stop(t + dur + 0.05);
            osc2.start(t); osc2.stop(t + dur + 0.05);
        }

        _bajo(freq, t, dur) {
            const osc = this.ctx.createOscillator();
            const env = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.13, t + 0.04);
            env.gain.exponentialRampToValueAtTime(0.06, t + 0.6);
            env.gain.setValueAtTime(0.06, t + dur - 0.5);
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(env);
            env.connect(this.master);
            osc.start(t); osc.stop(t + dur + 0.05);
        }

        _acorde() {
            if (!this.activo || !this.ctx) return;
            const ac  = this.PROG[this.idx % this.PROG.length];
            const t   = this.ctx.currentTime + 0.06;
            // Variación orgánica en duración (±0.8 s)
            const dur = ac.dur + (Math.random() - 0.5) * 1.6;

            this._bajo(ac.bass, t, dur + 0.8);

            ac.notas.forEach((f, i) => {
                // Arpeggio muy suave (no simultáneo)
                const delay = i * 0.052 + Math.random() * 0.018;
                // Volumen decrece para notas más altas (más íntimo)
                const vol   = (0.072 - i * 0.006) * (0.8 + Math.random() * 0.4);
                this._nota(f, t + delay, dur - delay, Math.max(vol, 0.008));
            });

            this.idx++;
            this.timer = setTimeout(() => this._acorde(), (dur - 0.35) * 1000);
        }

        iniciar(ctx) {
            this.ctx    = ctx;
            this.activo = true;
            if (ctx.state === 'suspended') ctx.resume();

            this.master = ctx.createGain();
            this.master.gain.value = volumen * 0.9;
            this.master.connect(ctx.destination);

            this._acorde();
        }

        parar() {
            this.activo = false;
            clearTimeout(this.timer);
            if (this.master && this.ctx) {
                this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
            }
        }

        volumen(v) {
            if (this.master && this.ctx)
                this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.15);
        }
    }

    // --- Jazz con Spotify iFrame API (volumen real + Premium) ---
    const SPOTIFY_ARTIST_URI = 'spotify:artist:2LLVmwKPPtahC6Z9f0sFWZ';

    function iniciarJazz() {
        pararJazz();

        const modoEstudio = document.getElementById('modo-estudio');
        if (!modoEstudio) return;

        const container = document.createElement('div');
        container.id        = 'jazz-player-container';
        container.className = 'jazz-player-container';
        container.innerHTML = `
            <div class="spotify-embed-wrap" id="spotify-embed-wrap">
                <div id="spotify-embed-target"></div>
                <span class="jazz-cargando" id="jazz-cargando">Conectando con Spotify…</span>
            </div>
            <button class="btn-jazz-offline" id="btn-jazz-offline" title="Sin internet — jazz generado localmente">🎹</button>`;

        const header = modoEstudio.querySelector('.estudio-header');
        if (header) header.after(container);
        else modoEstudio.prepend(container);

        function crearController() {
            const target   = document.getElementById('spotify-embed-target');
            const cargando = document.getElementById('jazz-cargando');
            if (!target || !window._spotifyIFrameAPI) return;
            if (cargando) cargando.style.display = 'none';

            window._spotifyIFrameAPI.createController(
                target,
                { width: '100%', height: '152', uri: SPOTIFY_ARTIST_URI },
                (ctrl) => {
                    spotifyController = ctrl;
                    ctrl.addListener('ready', () => {
                        ctrl.play();
                        ctrl.setVolume(volumen);
                    });
                }
            );
        }

        if (window._spotifyIFrameAPI) {
            crearController();
        } else {
            window._spotifyPendingInit = crearController;
            if (!document.querySelector('script[src*="spotify.com/embed/iframe-api"]')) {
                const s   = document.createElement('script');
                s.src     = 'https://open.spotify.com/embed/iframe-api/v1';
                s.async   = true;
                document.head.appendChild(s);
            }
        }

        // Fallback offline
        document.getElementById('btn-jazz-offline')?.addEventListener('click', () => {
            window._spotifyPendingInit = null;
            if (spotifyController) {
                try { spotifyController.pause(); } catch (_) {}
                spotifyController = null;
            }
            const wrap = document.getElementById('spotify-embed-wrap');
            if (wrap) wrap.innerHTML = '<span class="jazz-offline-badge">🎹 Jazz local · activo</span>';
            document.getElementById('btn-jazz-offline')?.remove();

            crearContexto();
            jazzGen = new JazzGenerator();
            jazzGen.iniciar(audioCtx);
            jazzGen.volumen(volumen);
        });
    }

    function pararJazz() {
        window._spotifyPendingInit = null;
        if (spotifyController) {
            try { spotifyController.pause(); } catch (_) {}
            spotifyController = null;
        }
        const container = document.getElementById('jazz-player-container');
        if (container) container.remove();
        if (jazzGen) { jazzGen.parar(); jazzGen = null; }
    }

    function cambiarIntensidadLluvia(tipo) {
        rainIntensidad = tipo;
        document.querySelectorAll('.btn-rain-intensity').forEach(b =>
            b.classList.toggle('activo', b.dataset.intensidad === tipo)
        );
        if (ambienceActual !== 'rain') return;
        if (rainGain && audioCtx)
            rainGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
        clearTimeout(thunderTimer);
        thunderTimer = null;
        setTimeout(() => {
            try { if (rainSource) rainSource.stop(); } catch (_) {}
            rainSource = null;
            rainGain   = null;
            crearLluvia();
        }, 650);
    }

    // --- Cambio de ambiente ---
    function cambiarAmbiente(tipo) {
        if (ambienceActual === 'rain') pararLluvia();
        if (ambienceActual === 'jazz') pararJazz();

        ambienceActual = tipo;

        document.querySelectorAll('.btn-ambience').forEach(b =>
            b.classList.toggle('activo', b.dataset.tipo === tipo)
        );

        const intensityCtrl = document.getElementById('rain-intensity-controls');
        if (intensityCtrl) intensityCtrl.style.display = tipo === 'rain' ? 'flex' : 'none';

        if (tipo === 'rain') crearLluvia();
        if (tipo === 'jazz') iniciarJazz();
    }

    function actualizarVolumen(val) {
        volumen = Math.pow(val / 100, 1.8);
        if (rainGain && audioCtx)
            rainGain.gain.setTargetAtTime(volumen * RAIN_PARAMS[rainIntensidad].gainMult, audioCtx.currentTime, 0.1);
        if (spotifyController)
            try { spotifyController.setVolume(volumen); } catch (_) {}
        if (jazzGen)
            jazzGen.volumen(volumen);
    }

    // ============================================================
    // POMODORO
    // ============================================================
    function actualizarDisplay() {
        const min = Math.floor(EST.segundos / 60);
        const sec = EST.segundos % 60;
        const txt = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

        const el = document.getElementById('pomo-tiempo');
        if (el) el.textContent = txt;

        // Anillo SVG
        const ring = document.getElementById('ring-progress');
        if (ring && EST.totalSegundos > 0) {
            const progreso = EST.segundos / EST.totalSegundos;
            ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progreso);
        }

        // Badge de fase
        const badge = document.getElementById('pomo-fase');
        if (badge) {
            const esDes = EST.fase === 'descanso';
            badge.textContent = esDes ? 'DESCANSO' : EST.fase === 'estudio' ? 'ESTUDIO' : 'LISTO';
            badge.classList.toggle('descanso', esDes);
        }

        // Ring color
        const ring2 = document.getElementById('ring-progress');
        if (ring2) ring2.classList.toggle('descanso', EST.fase === 'descanso');

        // Timer del overlay de descanso
        if (EST.fase === 'descanso') {
            const dt = document.getElementById('descanso-timer');
            if (dt) dt.textContent = txt;
        }
    }

    function tick() {
        if (EST.segundos <= 0) {
            clearInterval(EST.timer);
            EST.timer = null;
            faseCompleta();
            return;
        }
        EST.segundos--;
        actualizarDisplay();
    }

    function faseCompleta() {
        sonarFin();
        if (window.mostrarToast) {
            window.mostrarToast(
                EST.fase === 'estudio' ? '¡Tiempo de descanso! 🌿' : '¡Vuelta al estudio! 📚'
            );
        }

        if (EST.fase === 'estudio') {
            EST.sesiones++;
            actualizarSesiones();
            iniciarDescanso();
        } else {
            iniciarEstudio(true);
        }
    }

    function iniciarEstudio(arrancar) {
        EST.fase          = 'estudio';
        EST.segundos      = EST.minEstudio * 60;
        EST.totalSegundos = EST.segundos;
        actualizarDisplay();
        ocultarDescanso();
        actualizarBotonesPomodoro(arrancar);
        if (arrancar) {
            EST.timer  = setInterval(tick, 1000);
            EST.pausado = false;
        }
    }

    function iniciarDescanso() {
        EST.fase          = 'descanso';
        EST.segundos      = EST.minDescanso * 60;
        EST.totalSegundos = EST.segundos;
        actualizarDisplay();
        mostrarDescanso();
        EST.timer   = setInterval(tick, 1000);
        EST.pausado = false;
        actualizarBotonesPomodoro(true);
    }

    function empezar() {
        if (EST.fase === 'idle') {
            EST.minEstudio  = Math.max(1, parseInt(document.getElementById('pomo-min-estudio')?.value) || 25);
            EST.minDescanso = Math.max(1, parseInt(document.getElementById('pomo-min-descanso')?.value) || 5);
            iniciarEstudio(true);
        } else if (EST.pausado) {
            EST.pausado    = false;
            EST.timer      = setInterval(tick, 1000);
            actualizarBotonesPomodoro(true);
        }
    }

    function pausar() {
        if (EST.timer && !EST.pausado) {
            clearInterval(EST.timer);
            EST.timer  = null;
            EST.pausado = true;
            actualizarBotonesPomodoro(false);
        }
    }

    function reiniciar() {
        clearInterval(EST.timer);
        EST.timer   = null;
        EST.pausado = false;
        EST.fase    = 'idle';
        EST.minEstudio  = Math.max(1, parseInt(document.getElementById('pomo-min-estudio')?.value) || 25);
        EST.segundos      = EST.minEstudio * 60;
        EST.totalSegundos = EST.segundos;
        actualizarDisplay();
        ocultarDescanso();
        actualizarBotonesPomodoro(false);
    }

    function actualizarBotonesPomodoro(corriendo) {
        const btnI = document.getElementById('pomo-iniciar');
        const btnP = document.getElementById('pomo-pausar');
        if (!btnI || !btnP) return;
        btnI.disabled = corriendo;
        btnP.disabled = !corriendo;
    }

    function actualizarSesiones() {
        const el = document.querySelector('#pomo-sesiones span');
        if (el) el.textContent = EST.sesiones;
    }

    // Sonido suave de fin de sesión (Web Audio API)
    function sonarFin() {
        try {
            crearContexto();
            const t = audioCtx.currentTime;
            const freqs = [528, 660, 792];
            freqs.forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const g   = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = f;
                g.gain.setValueAtTime(0, t + i * 0.22);
                g.gain.linearRampToValueAtTime(0.25, t + i * 0.22 + 0.04);
                g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.22 + 0.8);
                osc.connect(g);
                g.connect(audioCtx.destination);
                osc.start(t + i * 0.22);
                osc.stop(t + i * 0.22 + 0.8);
            });
        } catch (_) {}
    }

    // ============================================================
    // DESCANSO: mostrar / ocultar overlay
    // ============================================================
    function mostrarDescanso() {
        const ov = document.getElementById('descanso-overlay');
        if (ov) {
            ov.classList.remove('descanso-oculto');
            ov.classList.add('descanso-visible');
        }
    }

    function ocultarDescanso() {
        const ov = document.getElementById('descanso-overlay');
        if (ov) {
            ov.classList.add('descanso-oculto');
            ov.classList.remove('descanso-visible');
        }
        limpiarAreaJuego();
        document.querySelectorAll('.btn-juego').forEach(b => b.classList.remove('activo'));
    }

    function limpiarAreaJuego() {
        const area = document.getElementById('area-juego');
        if (!area) return;
        if (typeof area._cleanup === 'function') area._cleanup();
        area.innerHTML = '';
        area._cleanup  = null;
    }

    // ============================================================
    // JUEGO 1: RESPIRACIÓN GUIADA (Box Breathing 4-4-4-4)
    // ============================================================
    function crearJuegoRespiracion() {
        const area = document.getElementById('area-juego');
        if (!area) return;
        limpiarAreaJuego();

        area.innerHTML = `
            <div class="respiracion-container">
                <svg class="resp-svg" viewBox="0 0 200 200">
                    <circle class="resp-circle" id="resp-circle" cx="100" cy="100" r="60"/>
                </svg>
                <div class="resp-texto" id="resp-texto">Prepárate…</div>
                <div class="resp-fase" id="resp-fase"></div>
            </div>`;

        const fases = [
            { nombre: 'Inhala',   dur: 4000, scale: 1.55, color: '#5eead4' },
            { nombre: 'Aguanta',  dur: 4000, scale: 1.55, color: '#c77dff' },
            { nombre: 'Exhala',   dur: 4000, scale: 0.65, color: '#ffd166' },
            { nombre: 'Pausa',    dur: 4000, scale: 0.65, color: '#f72585' },
        ];

        let idx     = 0;
        let activo  = true;
        let tTimer  = null;

        function paso() {
            if (!activo) return;
            const f = fases[idx % fases.length];

            const circ  = document.getElementById('resp-circle');
            const texto = document.getElementById('resp-texto');
            const fase  = document.getElementById('resp-fase');
            if (!circ) { activo = false; return; }

            if (texto) texto.textContent = f.nombre;
            if (fase)  fase.textContent  = `${f.dur / 1000}s`;

            circ.style.transition = `transform ${f.dur}ms ease-in-out, stroke ${f.dur / 2}ms ease`;
            circ.style.transform  = `scale(${f.scale})`;
            circ.style.stroke     = f.color;
            circ.style.filter     = `drop-shadow(0 0 18px ${f.color})`;

            idx++;
            tTimer = setTimeout(paso, f.dur);
        }

        tTimer = setTimeout(paso, 600);

        area._cleanup = () => {
            activo = false;
            clearTimeout(tTimer);
        };
    }

    // ============================================================
    // JUEGO 2: MEMORIA (4×4, 8 pares de emojis)
    // ============================================================
    function crearJuegoMemoria() {
        const area = document.getElementById('area-juego');
        if (!area) return;
        limpiarAreaJuego();

        const EMOJIS = ['🌿', '🌸', '🌊', '🌙', '⭐', '🦋', '🌺', '🍃'];
        const cartas = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);

        let volteadas        = [];
        let paresEncontrados = 0;
        let movimientos      = 0;
        let bloqueado        = false;

        area.innerHTML = `
            <div class="memoria-container">
                <div class="memoria-info">
                    <span>Movimientos: <strong id="mem-movs">0</strong></span>
                    <span>Pares: <strong id="mem-pares">0</strong>/8</span>
                </div>
                <div class="memoria-grid" id="mem-grid"></div>
                <div class="memoria-fin" id="mem-fin" style="display:none">
                    ¡Completado! 🎉 En <span id="mem-movs-fin"></span> movimientos.
                    <button class="btn-reiniciar-mem" id="btn-mem-restart">Jugar otra vez</button>
                </div>
            </div>`;

        const grid = document.getElementById('mem-grid');

        cartas.forEach((emoji, idx) => {
            const carta = document.createElement('div');
            carta.className    = 'carta';
            carta.dataset.emoji = emoji;
            carta.innerHTML    = `
                <div class="carta-inner">
                    <div class="carta-front">?</div>
                    <div class="carta-back">${emoji}</div>
                </div>`;

            carta.addEventListener('click', () => {
                if (bloqueado) return;
                if (carta.classList.contains('volteada')) return;
                if (carta.classList.contains('encontrada')) return;

                carta.classList.add('volteada');
                volteadas.push(carta);

                if (volteadas.length === 2) {
                    movimientos++;
                    const movEl = document.getElementById('mem-movs');
                    if (movEl) movEl.textContent = movimientos;
                    bloqueado = true;

                    const [c1, c2] = volteadas;
                    if (c1.dataset.emoji === c2.dataset.emoji) {
                        c1.classList.add('encontrada');
                        c2.classList.add('encontrada');
                        paresEncontrados++;
                        const parEl = document.getElementById('mem-pares');
                        if (parEl) parEl.textContent = paresEncontrados;
                        volteadas = [];
                        bloqueado = false;

                        if (paresEncontrados === 8) {
                            setTimeout(() => {
                                const fin = document.getElementById('mem-fin');
                                if (fin) {
                                    fin.style.display = 'block';
                                    const mf = document.getElementById('mem-movs-fin');
                                    if (mf) mf.textContent = movimientos;
                                }
                                if (window.mostrarToast) window.mostrarToast('¡Memoria completada! 🎉');
                            }, 350);
                        }
                    } else {
                        setTimeout(() => {
                            c1.classList.remove('volteada');
                            c2.classList.remove('volteada');
                            volteadas = [];
                            bloqueado = false;
                        }, 900);
                    }
                }
            });

            grid.appendChild(carta);
        });

        document.getElementById('btn-mem-restart')?.addEventListener('click', crearJuegoMemoria);
    }

    // ============================================================
    // JUEGO 3: SOPA DE LETRAS
    // ============================================================
    function crearJuegoSopaLetras() {
        const area = document.getElementById('area-juego');
        if (!area) return;
        limpiarAreaJuego();

        const PALABRAS  = ['CALMA', 'PAZ', 'LUNA', 'AIRE', 'MAR', 'SOL'];
        const N         = 9;
        const DIRS      = [[0, 1], [1, 0]]; // horizontal, vertical

        // ── Generar grid ──
        const grid = Array.from({ length: N }, () => Array(N).fill(null));
        const ubicaciones = []; // { palabra, r, c, dr, dc }

        for (const pal of PALABRAS) {
            let ok = false;
            for (let intento = 0; intento < 200 && !ok; intento++) {
                const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
                const r = Math.floor(Math.random() * (N - dr * (pal.length - 1)));
                const c = Math.floor(Math.random() * (N - dc * (pal.length - 1)));

                let libre = true;
                for (let k = 0; k < pal.length; k++) {
                    const v = grid[r + k * dr][c + k * dc];
                    if (v !== null && v !== pal[k]) { libre = false; break; }
                }
                if (libre) {
                    for (let k = 0; k < pal.length; k++)
                        grid[r + k * dr][c + k * dc] = pal[k];
                    ubicaciones.push({ palabra: pal, r, c, dr, dc });
                    ok = true;
                }
            }
        }
        // Relleno aleatorio
        const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < N; i++)
            for (let j = 0; j < N; j++)
                if (grid[i][j] === null)
                    grid[i][j] = LETRAS[Math.floor(Math.random() * LETRAS.length)];

        // ── Estado ──
        let inicio       = null;  // { r, c }
        const encontradas = new Set();

        // ── Render ──
        area.innerHTML = `
            <div class="sopa-container">
                <div class="sopa-palabras" id="sopa-palabras">
                    ${PALABRAS.map(p => `<span class="sopa-pal" id="spal-${p}">${p}</span>`).join('')}
                </div>
                <div class="sopa-grid" id="sopa-grid"></div>
                <div class="sopa-fin" id="sopa-fin" style="display:none">
                    ¡Todas encontradas! 🌟
                    <button class="btn-reiniciar-mem" id="btn-sopa-restart">Jugar otra vez</button>
                </div>
            </div>`;

        const gridEl = document.getElementById('sopa-grid');
        gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cel = document.createElement('div');
                cel.className    = 'sopa-cel';
                cel.textContent  = grid[r][c];
                cel.dataset.r    = r;
                cel.dataset.c    = c;

                cel.addEventListener('click', () => {
                    if (!inicio) {
                        // Primera celda seleccionada
                        inicio = { r, c };
                        cel.classList.add('sopa-selec');
                    } else {
                        // Segunda celda: validar
                        const r1 = inicio.r, c1 = inicio.c;
                        const r2 = r, c2 = c;

                        // Limpiar selección previa
                        gridEl.querySelectorAll('.sopa-selec').forEach(x => x.classList.remove('sopa-selec'));

                        if (r1 === r2 || c1 === c2) {
                            const letras  = extraerLetras(grid, r1, c1, r2, c2, N);
                            const hallada = buscarPalabra(letras, PALABRAS, encontradas);

                            if (hallada) {
                                encontradas.add(hallada);
                                marcarCeldas(gridEl, r1, c1, r2, c2);
                                tacharPalabra(hallada);
                                if (encontradas.size === PALABRAS.length) {
                                    setTimeout(() => {
                                        const fin = document.getElementById('sopa-fin');
                                        if (fin) fin.style.display = 'block';
                                        if (window.mostrarToast) window.mostrarToast('¡Sopa completada! 🌟');
                                    }, 400);
                                }
                            }
                        }
                        inicio = null;
                    }
                });

                gridEl.appendChild(cel);
            }
        }

        document.getElementById('btn-sopa-restart')?.addEventListener('click', crearJuegoSopaLetras);
    }

    function extraerLetras(grid, r1, c1, r2, c2, N) {
        let letras = '';
        if (r1 === r2) {
            const [a, b] = c1 <= c2 ? [c1, c2] : [c2, c1];
            for (let c = a; c <= b; c++) letras += grid[r1][c];
        } else {
            const [a, b] = r1 <= r2 ? [r1, r2] : [r2, r1];
            for (let r = a; r <= b; r++) letras += grid[r][c1];
        }
        return letras;
    }

    function buscarPalabra(letras, palabras, encontradas) {
        for (const pal of palabras) {
            if (encontradas.has(pal)) continue;
            if (letras === pal || letras === pal.split('').reverse().join(''))
                return pal;
        }
        return null;
    }

    function marcarCeldas(gridEl, r1, c1, r2, c2) {
        gridEl.querySelectorAll('.sopa-cel').forEach(cel => {
            const cr = parseInt(cel.dataset.r);
            const cc = parseInt(cel.dataset.c);
            let pertenece = false;
            if (r1 === r2 && cr === r1) {
                const [a, b] = c1 <= c2 ? [c1, c2] : [c2, c1];
                pertenece = cc >= a && cc <= b;
            } else if (c1 === c2 && cc === c1) {
                const [a, b] = r1 <= r2 ? [r1, r2] : [r2, r1];
                pertenece = cr >= a && cr <= b;
            }
            if (pertenece) cel.classList.add('sopa-hallada');
        });
    }

    function tacharPalabra(pal) {
        const el = document.getElementById(`spal-${pal}`);
        if (el) el.classList.add('sopa-tachada');
    }

    // ============================================================
    // MOSTRAR JUEGO
    // ============================================================
    function mostrarJuego(tipo) {
        document.querySelectorAll('.btn-juego').forEach(b =>
            b.classList.toggle('activo', b.dataset.juego === tipo)
        );
        if (tipo === 'respiracion') crearJuegoRespiracion();
        else if (tipo === 'memoria') crearJuegoMemoria();
        else if (tipo === 'sopaletras') crearJuegoSopaLetras();
    }

    // ============================================================
    // TAREAS – espejo del mismo localStorage
    // ============================================================
    const CLAVE_TAREAS = 'tareas_unicas';

    function leerTareas() {
        try { return JSON.parse(localStorage.getItem(CLAVE_TAREAS)) || []; } catch (_) { return []; }
    }

    function persistirTareas(lista) {
        localStorage.setItem(CLAVE_TAREAS, JSON.stringify(lista));
        actualizarBarraTareas(lista);
        if (window.todoAPI?.recargar) window.todoAPI.recargar();
    }

    function renderTareas() {
        const lista = leerTareas();
        const ul    = document.getElementById('estudio-lista-tareas');
        if (!ul) return;

        ul.innerHTML = '';
        lista.forEach((t, i) => {
            const li = document.createElement('li');
            li.className = 'estudio-tarea' + (t.completada ? ' completada' : '');

            const chk = document.createElement('button');
            chk.className = 'tarea-check-btn';
            chk.textContent = t.completada ? '✓' : '';
            chk.title = t.completada ? 'Marcar pendiente' : 'Marcar completa';
            chk.addEventListener('click', () => toggleTarea(i));

            const span = document.createElement('span');
            span.textContent = t.texto;

            const del = document.createElement('button');
            del.className   = 'tarea-del-btn';
            del.textContent = '✕';
            del.title       = 'Eliminar';
            del.addEventListener('click', () => eliminarTarea(i));

            li.append(chk, span, del);
            ul.appendChild(li);
        });

        actualizarBarraTareas(lista);
    }

    function agregarTarea() {
        const input = document.getElementById('estudio-nueva-tarea');
        const texto = input?.value.trim();
        if (!texto) return;
        const lista = leerTareas();
        lista.push({ texto, completada: false });
        persistirTareas(lista);
        input.value = '';
        renderTareas();
    }

    function toggleTarea(idx) {
        const lista = leerTareas();
        if (!lista[idx]) return;
        lista[idx].completada = !lista[idx].completada;
        persistirTareas(lista);
        renderTareas();
    }

    function eliminarTarea(idx) {
        const lista = leerTareas();
        lista.splice(idx, 1);
        persistirTareas(lista);
        renderTareas();
    }

    function actualizarBarraTareas(lista) {
        const total      = lista.length;
        const completas  = lista.filter(t => t.completada).length;
        const pct        = total > 0 ? Math.round((completas / total) * 100) : 0;
        const barra      = document.getElementById('estudio-barra-relleno');
        const texto      = document.getElementById('estudio-progreso-texto');
        if (barra) barra.style.width = pct + '%';
        if (texto) texto.textContent  = pct + '%';
    }

    // ============================================================
    // NOTAS – espejo del mismo localStorage
    // ============================================================
    const CLAVE_NOTAS = 'notas_rapidas';

    function leerNotas() {
        try { return JSON.parse(localStorage.getItem(CLAVE_NOTAS)) || []; } catch (_) { return []; }
    }

    function fmtFecha(ts) {
        const d    = new Date(ts);
        const hoy  = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
        const same = (a, b) => a.toDateString() === b.toDateString();
        const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        if (same(d, hoy))  return `Hoy · ${hora}`;
        if (same(d, ayer)) return `Ayer · ${hora}`;
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ` · ${hora}`;
    }

    function renderNotas() {
        const notas = leerNotas().sort((a, b) => b.timestamp - a.timestamp);
        const ul    = document.getElementById('estudio-lista-notas');
        const vac   = document.getElementById('estudio-notas-vacio');
        if (!ul) return;

        ul.innerHTML = '';
        if (notas.length === 0) {
            if (vac) vac.style.display = 'block';
            return;
        }
        if (vac) vac.style.display = 'none';

        notas.forEach(nota => {
            const li   = document.createElement('li');
            const cont = document.createElement('div');
            cont.className   = 'nota-contenido';
            cont.textContent = nota.texto;

            const fecha = document.createElement('small');
            fecha.className   = 'nota-fecha';
            fecha.textContent = fmtFecha(nota.timestamp);
            cont.appendChild(fecha);

            const del = document.createElement('button');
            del.className   = 'btn-eliminar';
            del.textContent = '✕';
            del.addEventListener('click', () => {
                const nuevas = leerNotas().filter(n => n.id !== nota.id);
                localStorage.setItem(CLAVE_NOTAS, JSON.stringify(nuevas));
                renderNotas();
                if (window.notasAPI?.render) window.notasAPI.render();
            });

            li.append(cont, del);
            ul.appendChild(li);
        });
    }

    function agregarNota() {
        const input = document.getElementById('estudio-nueva-nota');
        const texto = input?.value.trim();
        if (!texto) return;
        const notas = leerNotas();
        notas.push({ id: Date.now().toString(), texto, timestamp: Date.now() });
        localStorage.setItem(CLAVE_NOTAS, JSON.stringify(notas));
        input.value = '';
        renderNotas();
        if (window.notasAPI?.render) window.notasAPI.render();
        if (window.mostrarToast) window.mostrarToast('Nota guardada ✓');
    }

    // ============================================================
    // ENTRAR / SALIR DEL MODO ESTUDIO
    // ============================================================
    function entrar() {
        const overlay = document.getElementById('modo-estudio');
        if (!overlay) return;
        overlay.classList.remove('modo-estudio-oculto');
        overlay.classList.add('modo-estudio-activo');
        EST.activo = true;

        // Inicializar anillo
        const ring = document.getElementById('ring-progress');
        if (ring) {
            ring.style.strokeDasharray  = CIRCUMFERENCE;
            ring.style.strokeDashoffset = 0;
        }

        // Leer config actual
        EST.minEstudio  = Math.max(1, parseInt(document.getElementById('pomo-min-estudio')?.value) || 25);
        EST.segundos    = EST.minEstudio * 60;
        EST.totalSegundos = EST.segundos;
        actualizarDisplay();
        actualizarBotonesPomodoro(false);

        renderTareas();
        renderNotas();
    }

    function salir() {
        clearInterval(EST.timer);
        EST.timer   = null;
        EST.pausado = false;
        EST.fase    = 'idle';
        EST.activo  = false;

        cambiarAmbiente('none');
        ocultarDescanso();

        const overlay = document.getElementById('modo-estudio');
        if (overlay) {
            overlay.classList.remove('modo-estudio-activo');
            overlay.classList.add('modo-estudio-oculto');
        }

        // Sincronizar paneles principales
        if (window.todoAPI?.recargar) window.todoAPI.recargar();
        if (window.notasAPI?.render)  window.notasAPI.render();
    }

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        // Entrada
        document.getElementById('btn-modo-estudio')?.addEventListener('click', entrar);
        document.getElementById('btn-salir-estudio')?.addEventListener('click', salir);

        // Pomodoro
        document.getElementById('pomo-iniciar')?.addEventListener('click', empezar);
        document.getElementById('pomo-pausar')?.addEventListener('click', pausar);
        document.getElementById('pomo-reiniciar')?.addEventListener('click', reiniciar);

        // Si se cambia la duración en reposo, actualizar el display
        ['pomo-min-estudio', 'pomo-min-descanso'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (EST.fase === 'idle') reiniciar();
            });
        });

        // Ambience
        document.querySelectorAll('.btn-ambience').forEach(btn =>
            btn.addEventListener('click', () => cambiarAmbiente(btn.dataset.tipo))
        );
        document.querySelectorAll('.btn-rain-intensity').forEach(btn =>
            btn.addEventListener('click', () => cambiarIntensidadLluvia(btn.dataset.intensidad))
        );
        document.getElementById('volumen-ambiente')?.addEventListener('input', e =>
            actualizarVolumen(parseInt(e.target.value))
        );

        // Tareas
        document.getElementById('estudio-btn-tarea')?.addEventListener('click', agregarTarea);
        document.getElementById('estudio-nueva-tarea')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') agregarTarea();
        });

        // Notas
        document.getElementById('estudio-btn-nota')?.addEventListener('click', agregarNota);
        document.getElementById('estudio-nueva-nota')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') agregarNota();
        });

        // Juegos
        document.querySelectorAll('.btn-juego').forEach(btn =>
            btn.addEventListener('click', () => mostrarJuego(btn.dataset.juego))
        );

        // Saltar descanso
        document.getElementById('btn-saltar-descanso')?.addEventListener('click', () => {
            clearInterval(EST.timer);
            EST.timer = null;
            iniciarEstudio(true);
        });

        // Init ring
        const ring = document.getElementById('ring-progress');
        if (ring) {
            ring.style.strokeDasharray  = CIRCUMFERENCE;
            ring.style.strokeDashoffset = 0;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.estudioAPI = { entrar, salir };
})();
