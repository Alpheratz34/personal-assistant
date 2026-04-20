/* ==========================================================
   MÚSICA — Spotify Embed + reproductor local
   
   Cómo funciona Spotify aquí:
   Spotify permite incrustar cualquier playlist/álbum/canción
   mediante un iframe público sin API keys ni login de desarrollador.
   
   Lo único que hace este script es convertir una URL del tipo:
     https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
   en:
     https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M
   
   Nota: sin cuenta Premium, Spotify solo dejará oír ~30 segundos
   por canción. Con Premium (logueado en spotify.com en el mismo
   navegador) sonará la canción entera.
   ========================================================== */

(function () {
    // --- Toggle de visibilidad (minimizar widget) ---
    const widgetMusica = document.getElementById('musica');
    const btnToggle    = document.getElementById('btn-toggle-musica');
    if (widgetMusica && btnToggle) {
        btnToggle.addEventListener('click', () => {
            widgetMusica.classList.toggle('minimizado');
            btnToggle.textContent = widgetMusica.classList.contains('minimizado') ? '+' : '—';
        });
    }

    // --- Tabs Spotify / Local ---
    const tabs = document.querySelectorAll('.tab-musica');
    const fuenteSpotify = document.getElementById('fuente-spotify');
    const fuenteLocal   = document.getElementById('fuente-local');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('activo'));
            tab.classList.add('activo');

            const fuente = tab.dataset.fuente;
            fuenteSpotify?.classList.toggle('oculto', fuente !== 'spotify');
            fuenteLocal?.classList.toggle('oculto', fuente !== 'local');
        });
    });

    // ==========================================================
    // SPOTIFY
    // ==========================================================
    const inputURL      = document.getElementById('spotify-url');
    const btnCargar     = document.getElementById('btn-cargar-spotify');
    const contenedorEmbed = document.getElementById('spotify-embed-contenedor');
    const listaChips    = document.getElementById('lista-playlists');

    const CLAVE_SPOTIFY = 'spotify_playlists_guardadas';
    const CLAVE_ACTUAL  = 'spotify_ultima_url';

    // --- Extraer tipo (playlist/album/track/etc) e ID de la URL ---
    function parsearURLSpotify(url) {
        if (!url) return null;
        // Quitamos query string si la hay (?si=xxxx)
        const limpio = url.split('?')[0];
        const match = limpio.match(
            /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|track|artist|show|episode)\/([a-zA-Z0-9]+)/
        );
        if (!match) return null;
        return { tipo: match[1], id: match[2] };
    }

    function aEmbedURL(url) {
        const info = parsearURLSpotify(url);
        if (!info) return null;
        return `https://open.spotify.com/embed/${info.tipo}/${info.id}?utm_source=generator&theme=0`;
    }

    // --- LocalStorage de playlists guardadas ---
    function leerGuardadas() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_SPOTIFY)) || [];
        } catch (e) {
            return [];
        }
    }

    function guardarLista(lista) {
        localStorage.setItem(CLAVE_SPOTIFY, JSON.stringify(lista));
    }

    // --- Cargar embed en el contenedor ---
    function cargarEmbed(url, nombrePersonalizado) {
        if (!contenedorEmbed) return false;

        const embedURL = aEmbedURL(url);
        if (!embedURL) {
            if (window.mostrarToast) {
                window.mostrarToast('Enlace de Spotify no válido', 'error');
            } else {
                alert('Enlace de Spotify no válido');
            }
            return false;
        }

        const info = parsearURLSpotify(url);
        // Altura distinta según tipo (una sola canción vs playlist)
        const altura = (info.tipo === 'track') ? 152 : 352;

        contenedorEmbed.innerHTML = `
            <iframe
                src="${embedURL}"
                height="${altura}"
                frameborder="0"
                allowfullscreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy">
            </iframe>
        `;

        localStorage.setItem(CLAVE_ACTUAL, url);

        // Auto-guardar en la lista si es nueva
        guardarPlaylistEnLista(url, nombrePersonalizado || etiquetaDesdeURL(url));
        return true;
    }

    // Etiqueta corta amigable (playlist #37i9...)
    function etiquetaDesdeURL(url) {
        const info = parsearURLSpotify(url);
        if (!info) return 'Desconocida';
        const abrev = info.id.slice(0, 6);
        const tipoTxt = {
            playlist: 'Playlist',
            album:    'Álbum',
            track:    'Canción',
            artist:   'Artista',
            show:     'Podcast',
            episode:  'Episodio'
        }[info.tipo] || 'Spotify';
        return `${tipoTxt} ${abrev}`;
    }

    function guardarPlaylistEnLista(url, nombre) {
        const lista = leerGuardadas();
        // Evitar duplicados
        if (lista.some(p => p.url === url)) {
            renderChips();
            return;
        }
        lista.unshift({ url, nombre, timestamp: Date.now() });
        // Limitamos a 10
        const limitada = lista.slice(0, 10);
        guardarLista(limitada);
        renderChips();
    }

    function eliminarDeGuardadas(url) {
        const lista = leerGuardadas().filter(p => p.url !== url);
        guardarLista(lista);
        renderChips();
    }

    // --- Chips de playlists guardadas ---
    function renderChips() {
        if (!listaChips) return;
        const lista = leerGuardadas();
        listaChips.innerHTML = '';
        if (lista.length === 0) {
            listaChips.innerHTML = '<small style="opacity:0.4;">Tus enlaces se guardarán aquí</small>';
            return;
        }
        lista.forEach(p => {
            const chip = document.createElement('div');
            chip.className = 'chip-playlist';
            chip.title = p.url;

            const span = document.createElement('span');
            span.textContent = p.nombre;
            span.onclick = () => cargarEmbed(p.url, p.nombre);

            const btnX = document.createElement('button');
            btnX.className = 'cerrar-chip';
            btnX.textContent = '×';
            btnX.onclick = (e) => {
                e.stopPropagation();
                eliminarDeGuardadas(p.url);
            };

            chip.appendChild(span);
            chip.appendChild(btnX);
            listaChips.appendChild(chip);
        });
    }

    // --- Listener del botón cargar ---
    if (btnCargar && inputURL) {
        btnCargar.addEventListener('click', () => {
            const url = inputURL.value.trim();
            if (!url) {
                inputURL.focus();
                return;
            }
            if (cargarEmbed(url)) {
                inputURL.value = '';
            }
        });

        inputURL.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnCargar.click();
        });
    }

    // --- Al cargar la página: última URL y chips ---
    const ultima = localStorage.getItem(CLAVE_ACTUAL);
    if (ultima) {
        cargarEmbed(ultima);
    }
    renderChips();

    // ==========================================================
    // REPRODUCTOR LOCAL (audio mp3)
    // ==========================================================
    const btnMusica     = document.getElementById('btn-musica');
    const reproductor   = document.getElementById('reproductor-musica');
    const controlVolumen = document.getElementById('volumen-musica');

    let reproduciendo = false;

    if (btnMusica && reproductor && controlVolumen) {
        reproductor.volume = controlVolumen.value;

        btnMusica.addEventListener('click', () => {
            if (reproduciendo) {
                reproductor.pause();
                btnMusica.textContent = '🎵 Reproducir';
            } else {
                reproductor.play().catch(err => {
                    console.error('No se pudo reproducir:', err);
                    if (window.mostrarToast) {
                        window.mostrarToast('No hay archivo local disponible', 'error');
                    }
                });
                btnMusica.textContent = '⏸️ Pausar';
            }
            reproduciendo = !reproduciendo;
        });

        controlVolumen.addEventListener('input', (e) => {
            reproductor.volume = e.target.value;
        });
    }

    // --- API pública para el asistente de voz ---
    window.musicaAPI = {
        play: () => {
            if (reproductor && !reproduciendo) {
                btnMusica?.click();
            }
        },
        pause: () => {
            if (reproductor && reproduciendo) {
                btnMusica?.click();
            }
        },
        cargarSpotify: (url) => cargarEmbed(url)
    };
})();
