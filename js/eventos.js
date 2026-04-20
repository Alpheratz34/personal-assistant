/* ==========================================================
   EVENTOS - Hoy y Próximos
   Guarda en LocalStorage bajo la clave 'eventos_lista'
   ========================================================== */

(function () {
    // --- Referencias al DOM ---
    const inputTitulo = document.getElementById('evento-titulo');
    const inputFecha  = document.getElementById('evento-fecha');
    const inputHora   = document.getElementById('evento-hora');
    const btnAgregar  = document.getElementById('btn-agregar-evento');
    const listaUL     = document.getElementById('lista-eventos');
    const msgVacio    = document.getElementById('eventos-vacio');
    const tabs        = document.querySelectorAll('.tab-evento');

    // Si faltara algún elemento (por ejemplo si se carga en otra página), no seguimos
    if (!inputTitulo || !btnAgregar || !listaUL) return;

    const CLAVE_STORAGE = 'eventos_lista';
    let filtroActual = 'hoy'; // 'hoy' | 'proximos'

    // --- Utilidades de fecha ---
    function hoyISO() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }

    function esHoy(fechaISO) {
        return fechaISO === hoyISO();
    }

    function esFuturo(fechaISO) {
        return fechaISO > hoyISO();
    }

    function formatoBonito(fechaISO, hora) {
        // fechaISO viene como YYYY-MM-DD
        const [y, m, d] = fechaISO.split('-');
        const fecha = new Date(+y, +m - 1, +d);
        const opciones = { weekday: 'long', day: 'numeric', month: 'short' };
        let txt = fecha.toLocaleDateString('es-ES', opciones);
        // Capitaliza primera letra
        txt = txt.charAt(0).toUpperCase() + txt.slice(1);
        if (hora) txt += ` · ${hora}`;
        return txt;
    }

    function diasHasta(fechaISO) {
        const hoy = new Date(hoyISO());
        const objetivo = new Date(fechaISO);
        const msDia = 1000 * 60 * 60 * 24;
        return Math.round((objetivo - hoy) / msDia);
    }

    // --- LocalStorage ---
    function leerEventos() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_STORAGE)) || [];
        } catch (e) {
            console.error('Error leyendo eventos:', e);
            return [];
        }
    }

    function guardarEventos(lista) {
        localStorage.setItem(CLAVE_STORAGE, JSON.stringify(lista));
    }

    // --- Renderizado ---
    function render() {
        const eventos = leerEventos();

        // Limpiar eventos ya pasados (opcional: los dejamos 1 día por comodidad)
        const eventosVigentes = eventos.filter(e => e.fecha >= hoyISO());

        // Si se limpió algo, guardamos
        if (eventosVigentes.length !== eventos.length) {
            guardarEventos(eventosVigentes);
        }

        // Filtrado según tab
        let filtrados;
        if (filtroActual === 'hoy') {
            filtrados = eventosVigentes.filter(e => esHoy(e.fecha));
        } else {
            filtrados = eventosVigentes.filter(e => esFuturo(e.fecha));
        }

        // Ordenar: primero por fecha, luego por hora
        filtrados.sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return (a.hora || '').localeCompare(b.hora || '');
        });

        // Pintar
        listaUL.innerHTML = '';

        if (filtrados.length === 0) {
            msgVacio.style.display = 'block';
            msgVacio.textContent = filtroActual === 'hoy'
                ? 'No hay eventos para hoy. ¡Día libre!'
                : 'No hay eventos próximos.';
            return;
        }

        msgVacio.style.display = 'none';

        filtrados.forEach(evento => {
            const li = document.createElement('li');

            // Clases según urgencia
            if (esHoy(evento.fecha)) {
                li.classList.add('hoy');
            } else {
                const dias = diasHasta(evento.fecha);
                if (dias <= 3) li.classList.add('proximo-urgente');
            }

            // Contenido
            const info = document.createElement('div');
            info.className = 'evento-info';

            const titulo = document.createElement('span');
            titulo.className = 'evento-titulo';
            titulo.textContent = evento.titulo;

            const fechaHora = document.createElement('span');
            fechaHora.className = 'evento-fecha-hora';
            if (esHoy(evento.fecha)) {
                fechaHora.classList.add('hoy-texto');
                fechaHora.textContent = evento.hora ? `Hoy · ${evento.hora}` : 'Hoy';
            } else {
                fechaHora.textContent = formatoBonito(evento.fecha, evento.hora);
            }

            info.appendChild(titulo);
            info.appendChild(fechaHora);

            // Botón eliminar
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-eliminar';
            btnDel.textContent = '✕';
            btnDel.onclick = () => eliminarEvento(evento.id);

            li.appendChild(info);
            li.appendChild(btnDel);
            listaUL.appendChild(li);
        });
    }

    // --- Acciones ---
    function agregarEvento() {
        const titulo = inputTitulo.value.trim();
        const fecha  = inputFecha.value;
        const hora   = inputHora.value;

        if (!titulo) {
            mostrarToast('Ponle un título al evento', 'error');
            inputTitulo.focus();
            return;
        }
        if (!fecha) {
            mostrarToast('Elige una fecha', 'error');
            inputFecha.focus();
            return;
        }

        const nuevo = {
            id: Date.now().toString(),
            titulo,
            fecha,   // YYYY-MM-DD
            hora     // HH:MM o ''
        };

        const eventos = leerEventos();
        eventos.push(nuevo);
        guardarEventos(eventos);

        // Limpiar formulario
        inputTitulo.value = '';
        inputFecha.value = '';
        inputHora.value = '';

        // Si el evento es hoy, cambiamos al tab "hoy" para que se vea
        if (esHoy(fecha)) {
            cambiarTab('hoy');
        } else {
            cambiarTab('proximos');
        }

        render();
        mostrarToast('Evento añadido ✓');
    }

    function eliminarEvento(id) {
        const eventos = leerEventos().filter(e => e.id !== id);
        guardarEventos(eventos);
        render();
    }

    function cambiarTab(tab) {
        filtroActual = tab;
        tabs.forEach(t => {
            t.classList.toggle('activo', t.dataset.tab === tab);
        });
        render();
    }

    // --- Toast helper (reusable desde otros módulos) ---
    function mostrarToast(mensaje, tipo = 'ok') {
        const toast = document.createElement('div');
        toast.className = 'toast' + (tipo === 'error' ? ' error' : '');
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    // Lo exponemos por si lo quieren usar otros scripts
    window.mostrarToast = window.mostrarToast || mostrarToast;

    // --- API pública para el asistente de voz ---
    window.eventosAPI = {
        agregar: (titulo, fecha, hora = '') => {
            const eventos = leerEventos();
            eventos.push({
                id: Date.now().toString(),
                titulo,
                fecha,
                hora
            });
            guardarEventos(eventos);
            render();
        },
        obtenerHoy: () => leerEventos().filter(e => esHoy(e.fecha)),
        obtenerProximos: () => leerEventos().filter(e => esFuturo(e.fecha))
    };

    // --- Listeners ---
    btnAgregar.addEventListener('click', agregarEvento);

    // Enter en cualquier campo del formulario envía
    [inputTitulo, inputFecha, inputHora].forEach(input => {
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') agregarEvento();
        });
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => cambiarTab(tab.dataset.tab));
    });

    // Fecha por defecto = hoy
    inputFecha.value = hoyISO();

    // Render inicial
    render();

    // Re-render cada minuto (por si cambia el día mientras la app está abierta)
    setInterval(render, 60 * 1000);
})();
