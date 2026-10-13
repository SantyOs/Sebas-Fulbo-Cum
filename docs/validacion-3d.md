# Validación de la migración 3D

Registro: 2026-10-11. La aceptación gráfica y de rendimiento está **pendiente**; no se deduce de la compilación ni de pruebas CPU.

## Evidencia automatizada

- `npm run typecheck`: tipos correctos.
- `npm test`: 44 casos en cinco archivos Vitest, incluidos los nueve del editor de cumpleaños.
- `npm run build`: compilación estática. La entrada de menús se separa del motor 3D, cargado al iniciar un partido. Vite advierte del tamaño del chunk de Three.js/motor; no se oculta esa advertencia.
- HTTP local: desarrollo (127.0.0.1:5173) y preview de producci?n (127.0.0.1:4173) devolvieron 200 para HTML y ambos GLB; sus SHA-256 coincidieron con el manifiesto. Esto comprueba entrega de archivos, no renderizado.
- `npm audit --omit=dev`: cero vulnerabilidades reportadas.
- Plantillas: exactamente diez selecciones y 110 jugadores, dorsales únicos por equipo, roles explícitos, práctica por roles y elección compartida de equipación.
- Reglas: partido hasta el final, práctica sin reloj, goles y reinicios, saque de banda, fuera de juego, recepción, portero y prohibición de manejar un pase deliberado de compañero.
- Acciones: carga/liberación única, pase al hueco elevado, cambio/modificador, buffer de primera intención y cancelación por intercepción, asistencia acotada e intensidad analógica.
- Física: intersección barrida, bloqueo rápido entre endpoints, pelota alta sobre jugadores, defensa frente a pase elevado bajo y evaluación del punto de cruce de portería.
- Entrada: remapeo, intercambio, persistencia/reparación, pulsación breve entre frames, stick radial, mando no estándar, foco, visibilidad y desconexión.
- Determinismo: snapshots idénticos con la misma semilla/entradas a 30, 60 y 120 FPS de render simulado; máximo cinco pasos de recuperación y reinicio del acumulador.
- Recursos: carga real de GLB en Node, pistas enlazadas al esqueleto, poses de tamaño finito, avisos CC0 y hashes. Las pistas de locomoción no tienen desplazamiento de raíz.
- Diez nuevas simulaciones sin estado de una partida anterior. **Esto no equivale a diez reinicios de WebGL en un navegador.**
- Contabilidad de la medición comprobada con intervalos sintéticos, incluyendo frames largos. **Esto no es una medición de FPS de la GPU.**

## Prueba manual pendiente

No había aplicaciones ni navegadores conectados a la herramienta de interacción durante esta ejecución. Por ello no se afirma haber jugado ni inspeccionado una captura del renderer 3D.

1. Ejecutar `npm run dev`, abrir la URL y recorrer intro, selección y ajustes con ratón, teclado y mando.
2. Jugar Argentina–Brasil hasta el final y practicar: pases suaves/fuertes, tiros, recepción al correr, cambio, salida/parada del portero, barridas y vuelta al menú.
3. Comprobar dorsales, ropa, pelo y piel; mezclas de locomoción, patada, recepción, barrida/recuperación, estirada, saque de banda y celebración. Revisar pies sobre césped y contacto visual del balón.
4. Revisar contraste de equipaciones en las 90 combinaciones de equipos distintos y legibilidad de las porterías durante ataques por ambos lados.
5. Remapear, recargar y comprobar que la tecla anterior no dispara. Cambiar de ventana, ocultar pestaña y desconectar el mando durante una carga: debe pausarse sin disparar al volver.
6. Reiniciar diez veces alternando ambos modos, regresar al menú y observar consola, recursos y memoria. No debe crecer el número de contextos activos ni haber listeners duplicados.
7. Probar falta de WebGL 2 y fallo de carga del GLB: mensaje visible, vuelta al menú y reintento.

## Medición real en el PC objetivo

Equipo objetivo indicado por el usuario: RTX 3050 Laptop / i5-12450H. **GPU usada por el juego, FPS medio y p95: sin medir todavía.** No se garantiza qué adaptador seleccionará el navegador.

1. Usar la compilación de producción (`npm run build`, `npm start`).
2. Abrir partido 11v11, seleccionar calidad Alta y confirmar buffer de 1920×1080 en Ajustes. El canvas puede ocupar menos píxeles CSS por el HUD; la resolución interna permanece en 1080p con aspecto 16:9.
3. Pulsar Reiniciar medición: se reanuda el juego. Jugar al menos 70 segundos activos; los primeros diez calientan y los siguientes sesenta se registran. Las pausas no se acumulan y cambiar calidad reinicia la muestra.
4. Volver a Ajustes y Guardar informe. El JSON incluye fecha, GPU informada por WebGL, resolución, calidad, muestras, segundos, FPS medio, p95, draw calls, triángulos, geometrías y texturas.
5. Objetivo: 60 FPS y p95 inferior a 20 ms. El indicador admite 59,5 FPS medios por variación de temporización, exige muestra completa y buffer 1920×1080. Confirmar además que la GPU corresponde a la RTX; algunos navegadores ocultan su identificación.

No eliminar `render.ts`, `projection.ts` ni `ReferenceRenderer` hasta superar esta revisión visual. Corregir lo que aparezca, repetir las pruebas afectadas y registrar el JSON real antes de cerrar la etapa 3.

## Ampliación de cumpleaños

Ver [editor para Sebastian](cumpleanos.md). La compilación y los 44 tests pasan. Los chunks de editor, vista previa y jugadores devueltos por HTTP en 4173 coinciden byte a byte con `dist/`. Siguen pendientes la revisión visual de rostros, la escucha real y la prueba interactiva del editor en navegador.

## Reparto y festejos — 13 de octubre de 2026

- `npm test`: 57 pruebas en ocho archivos. Incluyen pases que atraviesan a María, procedencia/fuera de juego intactos, consumo único de su frase, perfiles local/visitante, dorsales heredados, once clips ejecutados sobre el GLB y cámara de gol con pausa y recuperación de pasos.
- `npm run build`: TypeScript y compilación estática correctos. Permanece el aviso de Vite por el chunk de Three.js superior a 500 kB.
- Video VP9 con alfa de 285.476 bytes, servido como `video/webm` con HTTP 200 en desarrollo e incluido en `dist/assets/video/`. Se verificaron píxeles transparentes y un fotograma compuesto fuera del navegador.
- No había navegador ni aplicaciones conectados a la herramienta de interacción. **Pendiente:** revisar globos y recorte del monito en WebGL, probar guardado de rivales desde la interfaz y observar los once festejos y el zoom en partido/práctica. Estas pruebas de Node no constituyen validación visual ni medición de GPU.

### Corrección de brazos y cabello

Las rotaciones genéricas de los brazos no correspondían a los ejes del esqueleto importado. `celebration-clips.ts` calcula hombro–codo–mano con los huesos reales y convierte el resultado en clips aditivos relativos al reposo. Los clips se preparan una vez por modelo; no se resuelve cinemática ni se modifica la simulación durante el partido.

La cubierta de pelo corto anterior terminaba por debajo de la parte superior del cráneo. `hair.ts` construye una cubierta sobre el cuero cabelludo, con línea frontal por encima de los ojos y cobertura lateral/posterior. Se conserva la opción explícita Rapado.

Se comprobaron posiciones de manos delante de los hombros en los once festejos, manos sobre la cabeza en brazos arriba, manos juntas al frente para corazón y cobertura del cráneo en los cuatro estilos con pelo. Se inspeccionaron ilustraciones geométricas por CPU de frente y perfil (brazos arriba, corazón, dab, avioncito, saludo y salto/giro); no sustituyen la revisión de materiales, iluminación y reproducción en WebGL. `AVATAR_QA_FILE` permite exportar esa geometría de inspección al ejecutar `avatar-presentation.test.ts`.
