/* ==========================================================
   CALENDARIO (FullCalendar)
   Vista por defecto: mensual (sin scroll interno)
   Guarda en LocalStorage bajo 'eventosCalendario'
   ========================================================== */

document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar-mini');
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        // Vista inicial: mensual → sin scroll interno, no rompe el scroll de la página
        initialView: 'dayGridMonth',

        locale: 'es',
        firstDay: 1,

        // Ocupamos el alto que nos haga falta. Sin scroll interno.
        height: 'auto',
        expandRows: true,

        // Horas acotadas para cuando se entra en vista semana/día (de 7 a 23)
        slotMinTime: '07:00:00',
        slotMaxTime: '23:00:00',
        slotDuration: '00:30:00',
        allDaySlot: false,

        // Selección e interacción
        selectable: true,
        editable: true,
        nowIndicator: true,
        navLinks: true, // click en un día te lleva a la vista diaria

        // Botonera arriba: incluye vista mes, semana, día y lista
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listWeek,timeGridWeek,timeGridDay'
        },

        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            list: 'Lista'
        },

        // Cargamos los eventos guardados
        events: cargarEventosGuardados(),

        // --- Crear evento ---
        select: function (info) {
            const titulo = prompt('Nueva tarea/evento:');
            if (titulo) {
                const nuevoEvento = {
                    id: Date.now().toString(),
                    title: titulo,
                    start: info.startStr,
                    end:   info.endStr,
                    allDay: info.allDay
                };
                calendar.addEvent(nuevoEvento);
                guardarEventos();
            }
            calendar.unselect();
        },

        // --- Click en evento → eliminar ---
        eventClick: function (info) {
            if (confirm(`¿Eliminar "${info.event.title}"?`)) {
                info.event.remove();
                guardarEventos();
            }
        },

        // --- Arrastrar o redimensionar ---
        eventChange: function () {
            guardarEventos();
        },

        // Cuando se hace click en un día en vista mensual,
        // pide un nombre directamente (en vez de cambiar a vista diaria)
        dateClick: function (info) {
            // Solo actuamos desde la vista mensual para no molestar en semana/día
            if (calendar.view.type !== 'dayGridMonth') return;

            const titulo = prompt(`Nueva tarea/evento para ${info.dateStr}:`);
            if (titulo) {
                calendar.addEvent({
                    id: Date.now().toString(),
                    title: titulo,
                    start: info.dateStr,
                    allDay: info.allDay
                });
                guardarEventos();
            }
        }
    });

    function cargarEventosGuardados() {
        try {
            return JSON.parse(localStorage.getItem('eventosCalendario')) || [];
        } catch (e) {
            console.error('Error cargando eventos del calendario:', e);
            return [];
        }
    }

    function guardarEventos() {
        const eventos = calendar.getEvents().map(e => ({
            id: e.id,
            title: e.title,
            start: e.startStr,
            end: e.endStr,
            allDay: e.allDay
        }));
        localStorage.setItem('eventosCalendario', JSON.stringify(eventos));
    }

    calendar.render();
});
