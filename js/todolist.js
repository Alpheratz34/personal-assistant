/* ==========================================================
   TO-DO LIST
   Guarda en LocalStorage bajo 'tareas_unicas'
   ========================================================== */

(function () {
    const inputTarea    = document.getElementById('nueva-tarea');
    const botonAgregar  = document.getElementById('btn-agregar');
    const listaTareas   = document.getElementById('lista-tareas');

    if (!inputTarea || !botonAgregar || !listaTareas) return;

    const CLAVE = 'tareas_unicas';

    // --- Crear elemento LI ---
    function crearElementoTarea(texto, completada = false) {
        const li = document.createElement('li');
        if (completada) li.classList.add('completada');

        const span = document.createElement('span');
        span.className = 'tarea-texto';
        span.textContent = texto;

        li.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                li.classList.toggle('completada');
                guardarYActualizar();
            }
        };

        const botonEliminar = document.createElement('button');
        botonEliminar.textContent = 'Eliminar';
        botonEliminar.className = 'btn-eliminar';
        botonEliminar.onclick = (e) => {
            e.stopPropagation();
            li.remove();
            guardarYActualizar();
        };

        li.appendChild(span);
        li.appendChild(botonEliminar);
        listaTareas.appendChild(li);
    }

    // --- Guardar + actualizar barra ---
    function guardarYActualizar() {
        const tareas = [];
        listaTareas.querySelectorAll('li').forEach(li => {
            tareas.push({
                texto: li.querySelector('.tarea-texto').textContent,
                completada: li.classList.contains('completada')
            });
        });
        localStorage.setItem(CLAVE, JSON.stringify(tareas));
        actualizarBarra();
    }

    function actualizarBarra() {
        const items = listaTareas.querySelectorAll('li');
        const total = items.length;
        const completadas = listaTareas.querySelectorAll('li.completada').length;

        const statsContainer = document.querySelector('.stats-container');
        const barraRelleno = document.getElementById('barra-progreso-relleno');
        const porcentajeTexto = document.getElementById('porcentaje-numero');
        const todoSection = document.getElementById('todo');

        if (total === 0) {
            if (statsContainer) statsContainer.style.opacity = '0';
            porcentajeTexto.textContent = '0%';
            barraRelleno.style.width = '0%';
            todoSection?.classList.remove('completado-total');
            return;
        }

        if (statsContainer) statsContainer.style.opacity = '1';
        const porcentaje = Math.round((completadas / total) * 100);
        porcentajeTexto.textContent = `${porcentaje}%`;
        barraRelleno.style.width = `${porcentaje}%`;

        if (porcentaje === 100) {
            todoSection?.classList.add('completado-total');
        } else {
            todoSection?.classList.remove('completado-total');
        }
    }

    // --- Cargar desde LocalStorage ---
    function cargar() {
        let guardadas = [];
        try {
            guardadas = JSON.parse(localStorage.getItem(CLAVE)) || [];
        } catch (e) {
            console.error('Error leyendo tareas:', e);
        }
        listaTareas.innerHTML = '';
        guardadas.forEach(t => crearElementoTarea(t.texto, t.completada));
        actualizarBarra();
    }

    // --- Agregar desde UI ---
    botonAgregar.addEventListener('click', () => {
        const texto = inputTarea.value.trim();
        if (texto) {
            crearElementoTarea(texto);
            inputTarea.value = '';
            guardarYActualizar();
        }
    });

    inputTarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') botonAgregar.click();
    });

    // --- API para asistente de voz ---
    window.todoAPI = {
        agregar: (texto) => {
            if (!texto) return;
            crearElementoTarea(texto, false);
            guardarYActualizar();
        },
        contar: () => listaTareas.querySelectorAll('li').length,
        pendientes: () => listaTareas.querySelectorAll('li:not(.completada)').length
    };

    cargar();
})();
