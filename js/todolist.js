const inputTarea = document.getElementById("nueva-tarea");
const botonAgregar = document.getElementById("btn-agregar");
const listaTareas = document.getElementById("lista-tareas");

// Función para crear el elemento en el DOM
function crearElementoTarea(texto, completada = false) {
    const li = document.createElement("li");
    
    const span = document.createElement("span");
    span.textContent = texto;
    if (completada) span.classList.add("completada");

    // Evento para tachar
    span.onclick = () => {
        span.classList.toggle("completada");
        guardarYActualizar();
    };

    const botonEliminar = document.createElement("button");
    botonEliminar.textContent = "Eliminar";
    botonEliminar.className = "btn-eliminar";
    
    // Evento para borrar
    botonEliminar.onclick = () => {
        li.remove();
        guardarYActualizar();
    };

    li.appendChild(span);
    li.appendChild(botonEliminar);
    listaTareas.appendChild(li);
}

//  Función para guardar en LocalStorage y actualizar la barra
function guardarYActualizar() {
    const tareas = [];
    const elementos = document.querySelectorAll("#lista-tareas li");

    elementos.forEach(li => {
        const span = li.querySelector("span");
        tareas.push({
            texto: span.textContent,
            completada: span.classList.contains("completada")
        });
    });

    localStorage.setItem("tareas_unicas", JSON.stringify(tareas));
    actualizarBarra();
}

//calcular el porcentaje
function actualizarBarra() {
    const total = document.querySelectorAll("#lista-tareas li").length;
    const completadas = document.querySelectorAll("#lista-tareas li span.completada").length;
    const statsContainer = document.querySelector(".stats-container");
    const barraRelleno = document.getElementById("barra-progreso-relleno");
    const porcentajeTexto = document.getElementById("porcentaje-numero");

    if (total === 0) {
        statsContainer.style.display = "none";
    } else {
        statsContainer.style.display = "block";
        const porcentaje = Math.round((completadas / total) * 100);

        porcentajeTexto.textContent = `${porcentaje}%`;
        barraRelleno.style.width = `${porcentaje}%`;

        // Lógica de brillo al llegar al 100%
        if (porcentaje === 100) {
            barraRelleno.classList.add("celebracion");
            porcentajeTexto.classList.add("celebracion-texto");
        } else {
            barraRelleno.classList.remove("celebracion");
            porcentajeTexto.classList.remove("celebracion-texto");
        }
    }
}

//  Cargar datos al iniciar
function cargarTareas() {
    const guardadas = JSON.parse(localStorage.getItem("tareas_unicas")) || [];
    guardadas.forEach(t => crearElementoTarea(t.texto, t.completada));
    actualizarBarra();
}

// Evento click botón principal
botonAgregar.onclick = () => {
    const texto = inputTarea.value.trim();
    if (texto) {
        crearElementoTarea(texto);
        inputTarea.value = "";
        guardarYActualizar();
    } else {
        alert("Escribe algo...");
    }
};

// Iniciar app
cargarTareas();