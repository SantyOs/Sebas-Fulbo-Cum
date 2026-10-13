> Documento hist?rico de la limpieza inicial. La arquitectura y los equipos descritos aqu? fueron reemplazados durante la migraci?n 3D. Consulta [arquitectura actual](arquitectura-3d.md) y [validaci?n](validacion-3d.md).

﻿# Análisis del juego y depuración para PC

Revisión del código local: 11 de octubre de 2026. Los datos deportivos son los
incluidos en el repositorio; esta revisión no revalida plantillas ni calendarios
contra fuentes externas.

## Qué juego hay actualmente

- Juego individual contra la CPU; no hay multijugador ni estado de partida remoto.
- Partido 11 contra 11. El reloj representa 90 minutos en 180 segundos de juego;
  celebraciones y otras pausas pueden alargar el tiempo real total.
- Práctica: cinco jugadores locales (incluido portero) frente a un portero rival.
  No aplica el reloj del partido, fuera de juego ni reinicios reglamentarios.
- 48 selecciones con once jugadores: 528 entradas de plantilla. Equipaciones
  titular, visitante y de portero; seis atributos y valoración global calculada.
- Flechas y acciones contextuales con carga de potencia, asistencia de pase/tiro,
  recepción asistida, cambio de jugador, entradas, barridas y salida del portero.
- Física sobre plano x/y y altura z para el balón. Inercia de jugadores,
  fricción, gravedad, botes, intercepciones, rechaces y agarre de porteros.
- IA de presión, contención de un segundo defensor, marcaje, apoyos y desmarques.
- Saques de banda, esquina y portería, fuera de juego, goles y celebraciones.
  No es una implementación completa del reglamento: faltas, tarjetas y penaltis
  no constituyen sistemas implementados en esta versión.
- Canvas 2D procedural con perspectiva de retransmisión; no es un motor 3D.
  Campo de 105 x 68 metros escalado, canvas de 1400 x 700 y cámara móvil.
- Ajustes de teclado en localStorage. Sin guardado/reanudación de partidos.

## Arquitectura observada

| Archivo | Responsabilidad | Tamaño antes de la limpieza |
| --- | --- | --- |
| game/engine.ts | Estado, ciclo, entrada, IA, posesión, física y reglas | 3.518 líneas |
| game/render.ts | Campo, público, jugadores, balón y porterías | 1.027 líneas |
| pages/HomePage.tsx | Menús, equipos, HUD, ajustes y ciclo de vida | 798 líneas |
| game/constants.ts | Parámetros compartidos y conversión metros/píxeles | Módulo separado |
| game/projection.ts | Proyección y cámara compartida a nivel de módulo | Módulo separado |
| game/teams/ | Datos deportivos y construcción de plantillas | Una selección por archivo |

Flujo: HomePage crea PitchKickGame; requestAnimationFrame actualiza la simulación,
renderScene dibuja un snapshot y emit envía un nuevo HUD a React. La limpieza
conserva estos archivos de jugabilidad sin cambios.

## Hallazgos para la próxima etapa

1. **Motor muy acoplado.** La separación histórica por dominios no terminó:
   entrada, acciones, IA, posesión y reglas comparten muchos campos privados.
   Extraer primero sistemas pequeños con dependencias explícitas y un estado
   común tipado; mantener el orden actual de actualización hasta tener pruebas.
2. **Pérdida de foco en PC.** start/stop registran keydown/keyup, sin manejador
   de blur/visibilitychange. Si se pierde un keyup al cambiar de ventana,
   una tecla puede quedarse activa. Añadir liberación y política de pausa.
3. **Remapeo incompleto.** setBindings registra solo códigos diferentes al
   predeterminado; onKeyDown usa el código físico cuando no encuentra remapeo.
   Así, al mover D a otra tecla, D puede seguir disparando. loadBindings acepta
   cadenas no vacías, sin comprobar unicidad. Separar acciones de códigos
   físicos y validar/restaurar configuraciones inválidas.
4. **Roles y formaciones pueden discrepar.** Motor y cálculo de atributos asignan
   GK/DF/MF/ST por índice (0, 1–4, 5–8, 9–10), mientras las posiciones usan
   formaciones como 4-3-3 o 4-2-3-1. Modelar el rol explícitamente por jugador.
5. **Simulación ligada al frame.** Usa dt variable limitado a 0,05 s y mezcla
   ajustes por frame con ajustes por segundo. A baja frecuencia puede perder
   tiempo simulado. Evaluar paso fijo con acumulador y render independiente.
6. **HUD por frame.** emit crea un objeto y llama a setHud en cada frame activo,
   aunque la mayoría de valores no cambie. Medir el coste y publicar solamente
   cambios o separar la barra de carga del resto del marcador.
7. **Pruebas difíciles de reproducir.** Math.random interviene en tiros y
   rebotes; window, performance y RAF están acoplados al motor. Inyectar reloj,
   entrada y generador aleatorio para probar situaciones repetibles.
8. **Cámara compartida.** projection.ts guarda viewCamX/viewCamY globalmente.
   El renderer no es estrictamente puro, aunque recibe un Scene. Una cámara
   explícita facilitaría pruebas y múltiples vistas independientes.
9. **HomePage concentra muchas funciones.** Extraer selección de equipos,
   ajustes, HUD y gestión del motor a componentes/hooks pequeños, sin cambiar
   los flujos intro → select → playing y práctica directa.
10. **Calendario estático vencido.** schedule.ts contiene 72 encuentros de junio
    de 2026. A la fecha de revisión devuelve null y se usa el fallback de equipos.
    Se conserva porque forma parte de una función del juego; decidir después
    si se presenta como calendario histórico o se elimina esa función.
11. **Equipaciones.** Usar siempre awayKit no garantiza contraste con el rival.
    Falta selección por contraste entre las combinaciones disponibles.
12. **Documentación contradictoria.** El antiguo AGENTS.md acumulaba valores
    históricos incompatibles y describía funciones existentes como pendientes.
    Se sustituyó por instrucciones breves basadas en el código actual.

Los puntos anteriores proceden de inspección estática: no son afirmaciones de
que todos los problemas hayan sido reproducidos jugando.

## Limpieza aplicada

- Eliminada la plantilla Expo de mobile y su instalación automática.
- Eliminados Modelence, servidor de ejemplo, cron, migración de usuario demo,
  autenticación, inicio automático de sesión y configuración de ese framework.
- Eliminadas páginas de ejemplo, login, registro, logout, términos de plantilla,
  router y componentes genéricos sin consumidores en el juego.
- Eliminadas dependencias de consultas remotas, formularios y utilidades que
  solo usaba la plantilla. Quedan React, React DOM y lucide-react en runtime.
- Vite y su plugin de React ahora son dependencias de desarrollo explícitas;
  antes se obtenían indirectamente mediante Modelence.
- Entrada React directa; compilación estática en dist; typecheck incorporado
  al build. Eliminados ajustes TypeScript heredados de Next/Modelence.
- Conservados SEO, estilos, calendario, datos y todas las mecánicas del juego.
- Favicon de fútbol en lugar del logo del framework; README actualizado.
- Actualizaciones compatibles de dependencias con npm audit fix, sin --force.

Había cambios previos en package-lock.json y eliminaciones de .cursor/mcp.json
 y docs/screenshot.png. No se restauraron estos archivos; npm actualizó el lock
existente para reflejar la nueva instalación. No se creó un commit en esta etapa.

## Orden recomendado

1. Casos de regresión reproducibles: posesión, gol, saque, portero y práctica.
2. Corregir foco y remapeo de teclado; separar el sistema de entrada.
3. Separar HomePage y reducir actualizaciones del HUD tras medirlas.
4. Introducir estado/contexto explícito y extraer reglas y física por pasos.
5. Desacoplar cámara y aleatoriedad; revisar roles y formaciones.
6. Con una base estable, ajustar dificultad, equilibrio, animación y rendimiento.

## Validación realizada

- TypeScript sin errores y compilación de producción correcta con Vite 6.4.4.
- Desarrollo y preview de producción responden HTTP 200; también el JavaScript,
  CSS y favicon generados. El JavaScript final ocupa aproximadamente 319 kB
  sin comprimir y 99 kB con gzip.
- npm audit: cero vulnerabilidades después de las actualizaciones compatibles.
- Comprobación temporal en Node mediante Vite SSR: 48 equipos, 528 jugadores,
  72 partidos del calendario, atributos en rango y construcción del motor con
  cada selección. Simulación con semilla fija hasta 90:00, pausa, eventos de
  teclado, retirada de listeners, gol y reposición de balón en práctica.
- El renderer ejecutó sus llamadas con un Canvas simulado. Esto comprueba rutas
  de ejecución, no el aspecto visual ni compatibilidad gráfica del navegador.
- La herramienta de navegador no tenía ningún navegador conectado. Queda
  pendiente la prueba visual/interactiva real de menús, remapeo y jugabilidad.
- No se ha añadido una suite permanente: las comprobaciones del motor fueron
  un script temporal, y no sustituyen las regresiones propuestas arriba.
