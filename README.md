# Asistente Personal — v2

Panel personal con reloj, tiempo, to-do list, eventos, notas rápidas, estadísticas,
calendario semanal, asistente de voz y reproductor Spotify/local.

## Cambios en esta versión

### Novedades
- **Eventos** (nueva sección): apunta eventos con fecha y hora, con tabs **Hoy / Próximos**.
  Los eventos de hoy se destacan en verde, los próximos en los siguientes 3 días en amarillo.
- **Notas Rápidas** (nueva sección): anota cosas sueltas con timestamp automático.
- **Asistente de voz funcional**: usa la Web Speech API del navegador. Puede añadir
  tareas, notas y eventos, decir la hora, controlar la música y más.
- **Spotify integrado**: pega cualquier enlace de Spotify (playlist, álbum, canción)
  y se incrusta el reproductor oficial. Guarda tus playlists favoritas como chips.
- **Reproductor local rediseñado**: widget flotante con tabs Spotify/Local y botón
  de minimizar.
- **Diseño responsive**: se adapta a móvil y tablet.
- **Toasts de notificación**: en vez de `alert()` feos.

### Optimizaciones
- Todos los scripts ahora usan `defer`, el DOM siempre está listo antes de ejecutarse.
- Todos los módulos están encapsulados en IIFE (`(function(){ ... })()`) para no
  contaminar el scope global.
- APIs compartidas entre módulos expuestas limpiamente en `window.XYZ_API`
  (`todoAPI`, `notasAPI`, `eventosAPI`, `musicaAPI`) para que el asistente de voz
  pueda usarlas sin romper la separación de responsabilidades.
- Try/catch alrededor de todas las lecturas de LocalStorage.
- Variables CSS nuevas (`--rojo-alerta`, `--amarillo-aviso`, `--sombra`) reutilizables.

## Cómo funciona el asistente de voz

Haz clic en el botón flotante 🎤 abajo a la izquierda y habla. Ejemplos:

- "¿Qué hora es?"
- "Añade tarea estudiar programación"
- "Apunta nota comprar leche"
- "Pon evento examen de mates el viernes a las 10"
- "Pon evento cumpleaños de Juan mañana"
- "¿Qué eventos tengo hoy?"
- "Reproduce música" / "Pausa"
- "¿Qué tiempo hace?"
- "¿Cuánto he estudiado?"
- "Ayuda"

**Requisitos:**
- Navegador basado en Chromium (Chrome, Edge, Brave, Opera). Firefox no lo soporta bien.
- Conexión a internet (Chrome envía el audio a Google para el reconocimiento).
- Dar permiso al micrófono la primera vez.
- Para servirlo, debe ejecutarse desde `http://` o `https://` (no desde `file://`),
  porque los navegadores bloquean el micrófono en archivos locales.

## Cómo hacer funcional Spotify

**Ya funciona sin que tengas que configurar nada.** Solo tienes que:

1. Abrir Spotify (web o app).
2. Click derecho sobre una playlist → "Compartir" → "Copiar enlace de la playlist".
3. Pegar el enlace en el input del widget de música → "Cargar".

El reproductor oficial de Spotify aparece incrustado y puedes darle al play.

**Detalles importantes:**
- Si **no** tienes Premium, Spotify solo te deja oír **~30 segundos** de cada canción
  (limitación suya, no hay forma de evitarla sin login).
- Si tienes Premium y estás logueado en Spotify en el mismo navegador, suena completa.
- Las playlists que cargues se guardan automáticamente como chips para reusarlas.
- Si quisieras control total desde tu propia UI (play/pause desde TU botón, saber
  qué canción suena, etc.), necesitarías la **Spotify Web Playback SDK**, que sí
  requiere registrar una app en https://developer.spotify.com y autenticar con OAuth.
  Para uso personal, el embed es más que suficiente.

## Cómo ejecutarlo

### Opción 1: Electron (como ya lo tenías)
```bash
npm install
npm start
```

### Opción 2: Navegador (servidor local)
Como el asistente de voz necesita http(s), no sirve abrir el index.html con doble click.
Puedes usar cualquier servidor estático. Por ejemplo:

```bash
# Con Python (ya viene instalado en muchos sistemas)
python -m http.server 8080

# O con Node (si tienes npx)
npx serve
```

Luego abre http://localhost:8080 en Chrome/Edge.

### Opción 3: GitHub Pages
El workflow `.github/workflows/static.yml` ya despliega automáticamente. El
asistente de voz funcionará sin problemas desde HTTPS.

## Estructura de archivos

```
personal-assistant-main/
├── index.html              ← estructura principal
├── css/
│   ├── style.css           ← estilos de la portada
│   └── historial.css       ← estilos de la página de historial
├── js/
│   ├── reloj.js            ← reloj + saludo
│   ├── tiempo.js           ← widget del tiempo
│   ├── todolist.js         ← lista de tareas
│   ├── eventos.js          ← NUEVO: eventos hoy/próximos
│   ├── notas.js            ← NUEVO: notas rápidas
│   ├── stats.js            ← estadísticas de estudio/ejercicio
│   ├── calendario.js       ← FullCalendar semanal
│   ├── musica.js           ← Spotify + reproductor local
│   └── voz.js              ← NUEVO: asistente de voz
├── public/
│   └── historial.html      ← página de historial completo
├── main.js                 ← entry point de Electron
└── package.json
```

## Claves que se guardan en LocalStorage

| Clave                         | Contenido                            |
|-------------------------------|--------------------------------------|
| `tareas_unicas`               | To-do list                           |
| `eventos_lista`               | Eventos hoy/próximos                 |
| `notas_rapidas`               | Notas rápidas                        |
| `historialEspacial`           | Estadísticas diarias                 |
| `eventosCalendario`           | Eventos del calendario semanal       |
| `spotify_playlists_guardadas` | Playlists de Spotify guardadas       |
| `spotify_ultima_url`          | Última playlist cargada (autoload)   |
| `clima_*`                     | Cache del tiempo por ciudad (10 min) |
