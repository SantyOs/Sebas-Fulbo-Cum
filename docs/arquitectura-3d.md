# Arquitectura 3D y evolución

## Etapa 1: base modular

`PitchKickGame` dejó de concentrar reglas y estado. Coordina `MatchSimulation`, `BrowserInput`, `FixedStepClock` y `ThreeRenderer`. La simulación recibe tiempo y acciones; el generador sembrado es sustituible. Se conserva la escala original de 2200 unidades por 105 metros, además de velocidades, gravedad y duración base.

`MatchState` contiene entidades identificadas por equipo/dorsal, enlaces por ID y tablas de marcaje, apoyo y fuera de juego por ID. Los accesores de entidad resuelven esos identificadores para los sistemas. Los snapshots copian posiciones y vectores; los eventos tienen ID, tick, segundos de simulación y actor. Se conserva un historial acotado de 32 eventos para consumo visual.

Los dominios son acciones, movimiento, IA, posesión, porteros, física y reglas. No dependen de React, Three.js ni APIs del navegador. Las dependencias explícitas de estado permiten probar saques, tiros y recepciones sin iniciar un canvas.

El reloj ejecuta 60 pasos por segundo. Un frame puede recuperar como máximo cinco; se descarta el exceso, y la pausa borra el acumulador. Se interpolan snapshots para dibujar. El HUD publica cambios con potencia limitada a 30 Hz e interpolación CSS. Menús y controles viven fuera de la simulación.

## Etapa 2: datos y entrada

Se retiraron 38 selecciones, sus importaciones y el calendario de junio. Se mantienen los 110 nombres, dorsales y seis atributos individuales originales de las diez selecciones acordadas. El OVR se calcula ponderando el rol explícito de formación, de modo que puede diferir del anterior cálculo por índice.

La cuadrícula permite ratón, teclado y mando; la selección inicial es Argentina–Brasil. La práctica obtiene un portero y cuatro jugadores de campo por rol. Los mismos criterios de contraste de equipaciones alimentan la selección y los snapshots del partido.

El adaptador traduce teclas físicas a acciones: remapear elimina de verdad la tecla anterior. Las asignaciones duplicadas se intercambian; la configuración almacenada inválida se repara. Los mandos estándar usan stick radial con zona muerta 0,18, cruceta, botones faciales y gatillos. Los demás muestran aviso para continuar con teclado. Las entradas se liberan y el partido se pausa al perder foco, ocultar pestaña o desconectar el mando activo.

## Etapa 3: presentación y respuesta

Three.js dibuja estadio diurno, líneas y áreas reglamentarias, porterías con redes, gradas, público instanciado, banquillos y vallas. Hay luz ambiental, una luz con sombras y cámara elevada con seguimiento amortiguado y anticipación. Las dimensiones gráficas se expresan en metros. Calidad media usa sombras 1024 y resolución interna 1280×720; alta, sombras 2048 y 1920×1080, para composición 16:9.

El modelo masculino adulto y cinco clips de locomoción provienen de las ediciones gratuitas de Quaternius. Cada jugador usa un esqueleto clonado y materiales de equipación; nombre, dorsal, pelo, piel y escala corporal lo distinguen. Los porteros añaden guantes. Los clips deportivos aditivos son propios: pase, tiro, recepción, entrada, barrida, recuperación, parada, estirada, saque y celebración. Se mezclan con la locomoción y nunca controlan la física.

Se limita la ayuda de recepción a 1,25 segundos y se conserva la intensidad analógica. Los toques de conducción se alargan según velocidad. La detección barrida prueba el recorrido del balón, respeta su altura y evalúa salidas/porterías en el punto de cruce. La gracia inicial del golpe protege al grupo inmediato del pateador, pero permite contactos posteriores con defensores en la trayectoria. Se conserva la procedencia del último golpe hasta otro contacto, en vez de borrarla al terminar la protección del pateador.

El adaptador 2D sigue disponible como referencia y no se importa en el runtime. Su eliminación está condicionada a la aceptación visual del 3D, todavía pendiente.

## Límites actuales

La compatibilidad del esqueleto y los clips está comprobada mediante carga real GLB y evaluación de poses en Node. Eso no certifica encuadre, orientación visual de todos los gestos, contraste percibido, lectura de dorsales o ausencia de artefactos de shaders en el navegador. Los clips deportivos necesitan esa revisión jugada antes de considerar alcanzada la referencia estética PS2.

No se añadieron multijugador, carrera, fichajes, faltas/tarjetas, comentaristas ni semejanzas faciales. No se reescribieron plantillas con información externa nueva.
