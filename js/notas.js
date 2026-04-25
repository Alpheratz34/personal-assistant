/* ==========================================================
   NOTAS RÁPIDAS
   Guarda en LocalStorage bajo la clave 'notas_rapidas'
   ========================================================== */

(function () {
    const inputNota   = document.getElementById('nueva-nota');
    const btnAgregar  = document.getElementById('btn-agregar-nota');
    const listaUL     = document.getElementById('lista-notas');
    const msgVacio    = document.getElementById('notas-vacio');

    if (!inputNota || !btnAgregar || !listaUL) return;

    const CLAVE = 'notas_rapidas';

    // --- LocalStorage ---
    function leer() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE)) || [];
        } catch (e) {
            console.error('Error leyendo notas:', e);
            return [];
        }
    }

    function guardar(lista) {
        localStorage.setItem(CLAVE, JSON.stringify(lista));
    }

    // --- Formato de fecha corta ---
    function formatoFecha(timestamp) {
        const fecha = new Date(timestamp);
        const hoy = new Date();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);

        const esMismoDia = (a, b) =>
            a.toDateString() === b.toDateString();

        const hora = fecha.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (esMismoDia(fecha, hoy)) return `Hoy · ${hora}`;
        if (esMismoDia(fecha, ayer)) return `Ayer · ${hora}`;

        return fecha.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
        }) + ` · ${hora}`;
    }

    // --- Render ---
    function render() {
        const notas = leer();

        // Ordenar por fecha descendente (más nueva arriba)
        notas.sort((a, b) => b.timestamp - a.timestamp);

        listaUL.innerHTML = '';

        if (notas.length === 0) {
            msgVacio.style.display = 'block';
            return;
        }
        msgVacio.style.display = 'none';

        notas.forEach(nota => {
            const li = document.createElement('li');

            const contenedor = document.createElement('div');
            contenedor.className = 'nota-contenido';
            contenedor.textContent = nota.texto;

            const fecha = document.createElement('small');
            fecha.className = 'nota-fecha';
            fecha.textContent = formatoFecha(nota.timestamp);
            contenedor.appendChild(fecha);

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-eliminar';
            btnDel.textContent = '✕';
            btnDel.onclick = () => eliminar(nota.id);

            li.appendChild(contenedor);
            li.appendChild(btnDel);
            listaUL.appendChild(li);
        });
    }

    // --- Acciones ---
    function agregar() {
        const texto = inputNota.value.trim();
        if (!texto) {
            inputNota.focus();
            return;
        }

        const notas = leer();
        notas.push({
            id: Date.now().toString(),
            texto,
            timestamp: Date.now()
        });
        guardar(notas);
        inputNota.value = '';
        render();

        if (window.mostrarToast) window.mostrarToast('Nota guardada ✓');
    }

    function eliminar(id) {
        const notas = leer().filter(n => n.id !== id);
        guardar(notas);
        render();
    }

    // --- API para asistente de voz ---
    window.notasAPI = {
        agregar: (texto) => {
            if (!texto) return false;
            const notas = leer();
            notas.push({
                id: Date.now().toString(),
                texto,
                timestamp: Date.now()
            });
            guardar(notas);
            render();
            return true;
        },
        cantidad: () => leer().length,
        ultima: () => {
            const notas = leer().sort((a, b) => b.timestamp - a.timestamp);
            return notas[0] || null;
        },
        render
    };

    // --- Listeners ---
    btnAgregar.addEventListener('click', agregar);
    inputNota.addEventListener('keypress', e => {
        if (e.key === 'Enter') agregar();
    });

    render();
})();
