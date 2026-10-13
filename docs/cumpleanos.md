# Regalo de cumpleaños para Sebastian

El juego mantiene World Cup 2026 como nombre y muestra la dedicatoria para Sebastian en la entrada y después de los goles. Nombre y mensaje son editables.

## Editar jugadores y caras

En el menú principal, pulsa **Personalizar regalo**. Elige **Mi equipo** o **Equipo contrario**, una selección y uno de sus once personajes de oficina. Al cambiar de lado se abre la selección local o rival elegida para el partido. Las plantillas originales se mantienen intactas; el regalo guarda modificaciones por lado, selección y dorsal original. Los perfiles anteriores sin lado siguen siendo compatibles como configuración base.

- **Identidad:** nombre/apodo y dorsal. Al guardar se resuelven dorsales duplicados; cambiar el número no cambia el ID interno del jugador.
- **Cara:** mandíbula, mentón, ancho/proyección de nariz, separación/apertura de ojos, boca, labios, orejas, pómulos, tamaño de cabeza y color de ojos. Los diez controles de forma deforman vértices de la malla del modelo; cada jugador editado tiene su copia. No se aplica una fotografía ni reconstrucción facial automática.
- **Apariencia:** cinco peinados, color de pelo/barba, barba, piel, botas, muñequeras, estatura y complexión. Las colisiones conservan su tamaño arcade; las proporciones son visuales.
- **Atributos:** velocidad, tiro, pase, regate, defensa y físico, de 1 a 99. Sí afectan a la simulación; el OVR se recalcula por rol.
- **Celebración:** brazos arriba, baile, dab, corazón, avioncito, de rodillas, arquero, saludo, silencio, puño al cielo o salto y giro. Cada personaje tiene un festejo predeterminado según su posición del reparto; puedes cambiarlo, ajustar velocidad, giros, salto y confeti, y activar/desactivar **Primer plano al marcar**.
- **Audio:** fanfarria, fiesta, ovación, silencio o grabación propia. Usa Probar festejo y sonido para ensayar antes de guardar.

La vista 3D permite frente, perfil, espalda y giro continuo; alterna rostro/cuerpo completo. Los cambios de geometría se agrupan durante 100 ms para evitar reconstruir el modelo por cada pequeño movimiento del deslizador. Pulsa **Guardar cambios** y empieza un partido o práctica para verlos en el campo. Cerrar sin guardar descarta el borrador.

## Cámara y volumen durante el partido

La cámara empieza a 1,18×: su distancia se reduce aproximadamente un 15 % respecto a la anterior. **Ajustes → Cercanía de cámara** permite de 1,00× a 1,40× sin reconstruir la partida. El seguimiento amplía su recorrido lateral al acercarse para encuadrar las bandas. El volumen general también se modifica en Ajustes, con cero como silencio.

El navegador puede requerir interacción para habilitar audio. Pulsa **Activar sonido** o empieza a jugar con teclado/ratón. Pausar, cambiar de ventana o salir detiene los sonidos activos. Los eventos de gol se consumen una sola vez, aunque un snapshot se dibuje varias veces.

## Audios y traslado del regalo

Admite MP3, WAV, OGG o WebM que el navegador pueda decodificar: hasta cuatro clips, 1 MB y 30 segundos por archivo, con un límite total aproximado de 2,8 millones de caracteres codificados. Durante un gol suenan como máximo ocho segundos. Las fanfarrias y la ovación incluidas son sintetizadas por el juego, sin descargas de audio externas.

Todo se guarda en `localStorage` bajo `wc2026.birthday.v1`. Los audios se incluyen como datos en el perfil, sin servidor. Si no hay espacio, el editor informa del error y permite exportar o eliminar clips.

**Exportar regalo** descarga JSON con dedicatoria, jugadores, caras, animaciones y audios. En otro navegador o PC abre el mismo juego, pulsa **Importar regalo**, revisa y guarda. La configuración pertenece a cada origen: desarrollo en 5173 y preview en 4173 tienen almacenamiento separado; usa exportación/importación para trasladarla. No se modifica ni reemplaza el GLB original al editar una cara.

## Código y validación

- `game/customization/profile.ts`: esquema versionado, límites, saneamiento de importaciones, persistencia y composición de plantillas.
- `game/customization/face.ts`: deformación facial en coordenadas del modelo.
- `game/customization/audio.ts` y `goals.ts`: audio de presentación, cancelación y consumo único de eventos.
- `components/game/PlayerEditor.tsx`, `PlayerPreview.tsx`, `BirthdayGoal.tsx`: taller, previsualización y dedicatoria/confeti.
- `rendering/footballer.ts`: apariencia, copias de geometría, iris/pupilas, poses y liberación de recursos.

Las pruebas verifican saneamiento, exportación/importación, persistencia, IDs/dorsales, edición de vértices reales sin mutar el modelo compartido, eventos únicos y cancelación/silencio de audio mediante un contexto de prueba. La suite existente sigue cubriendo partido y controles.

**Pendiente de navegador real:** revisar rasgos y mezclas visuales, escuchar clips, comprobar la interacción completa del taller y medir rendimiento con jugadores personalizados. El entorno de esta entrega no ofrece navegador conectado; cargar un GLB en Node o simular AudioContext no sustituye esa aceptación.

## Reparto de la oficina

### Fotos y entrenamiento

En **Personajes → Cara → Foto del rostro** se puede subir JPG, PNG o WebP
(hasta 8 MB), ajustar zoom, centro horizontal/vertical y opacidad, o quitarla.
Se conserva la transparencia de PNG. Se prepara un recorte central cuadrado de
512 píxeles; para fotos de cuerpo completo conviene recortar primero el rostro.
La foto se proyecta sobre la geometría animada: no reconstruye una cabeza 3D.
Yenny incluye la foto aportada por el usuario, también en perfiles antiguos;
quitarla explícitamente desactiva esa foto predeterminada.

Las fotos subidas se guardan y exportan con los personajes, independientemente
para local y rival. No se admiten URLs externas ni SVG. Límite por imagen
preparada: 180 000 caracteres; total de fotos: 1 200 000. La importación admite
hasta 6 MB y sanea datos inválidos o excedidos. El guardado avisa si falta espacio.

El entrenamiento pasa por la misma selección de equipos y conserva personajes,
rostros, atributos, celebraciones, audio y ajustes. Mantiene cinco jugadores
locales contra el portero rival, sin reloj, fuera de juego ni reinicios de partido.

Validación: pruebas de saneamiento/persistencia de fotos, conservación de la
personalización en entrenamiento, proyección del shader, decisiones de tiro
de Yenny y duración/cancelación del tono. Revisión visual y auditiva pendiente:
no había navegador conectado disponible durante esta implementación.

`game/customization/cast.ts` asigna nombres y rasgos por lado y posición de la formación, sea cual sea la selección: local = equipo del jugador, visitante = rivales. Las plantillas originales y los IDs de simulación no cambian.

- Al recibir un pase de un compañero, el jugador muestra su nombre y frase en un globo con fondo blanco al 78 % de opacidad (las de Patricia rotan en orden). Los nombres editados se conservan en la partida.
- Maria Alejandra Osorio, la contable, deja pasar los pases de sus compañeros y dice «No sé, nunca me había pasado, primera vez que me pasa». Se anuncia una sola vez por pase, incluso si atraviesa su zona entre dos pasos de simulación. No cuenta como toque ni cambia la procedencia del balón; puede interceptar balones rivales.
- Yenny Gomez suena con `public/assets/audio/llamada.mp3` al recibir; al marcar suena más fuerte y durante 12 s en bucle con salida gradual. Tiro 99; busca pases en posiciones adelantadas y remata desde 22 metros apuntando al lado opuesto al portero.
- Monica Bernal no se mueve y recibe el 40 % de los pases del equipo; su nombre (o el apodo editado, por ejemplo MB) y el globo del monito permanecen sobre su cabeza mientras esté en el campo. Patricia recibe el 45 % de los pases de la CPU, también sin presión.
- Sebastian Londoño (C) es el delantero que saca y empieza controlado.

## Primer plano y video de Mónica

Cada gol abre una secuencia de cuatro segundos: acercamiento suave al goleador, festejo personalizado y regreso a la cámara de partido. En práctica también se muestra el festejo antes de recolocar el balón, sin reloj, fuera de juego ni saque de centro. El goleador permanece en su posición mientras el avatar se anima; las poses nunca mueven las coordenadas físicas. El cartel de gol queda abajo para despejar el centro de la imagen.

`src/client/public/assets/video/monica-monkey.webm` deriva del `videoplayback.mp4` aportado por el usuario. Se quitó el verde, se redujo a 320×180 y se tomaron los segundos 1–17 para el bucle. Conserva el fondo gris que forma parte del dibujo. Se reproduce sin sonido, se pausa con el juego y libera video/textura al salir. El original no se incorpora al repositorio ni se descarga de Internet. `scripts/prepare-monkey-video.py` permite regenerarlo con FFmpeg mediante `imageio-ffmpeg`.

Las pruebas automatizadas cubren rechazo de pases, conservación de procedencia/fuera de juego, perfiles independientes con compatibilidad anterior, once clips aplicados al GLB real, consumo único de goles y fin de cámara antes de reanudar. La revisión visual en navegador sigue pendiente: no había navegador conectado disponible el 13 de octubre de 2026.

## Anuncios tras gol de la CPU

En partido (no en práctica), cuando marca el visitante, al terminar la celebración aparece `components/game/CpuAds.tsx` a pantalla completa y el partido queda en pausa. Rota seis anuncios con las imágenes de `public/assets/ads/` y un jingle sintetizado. Dura 7 s y luego solo se cierra con la X. «Omitir anuncio» abre un formulario de pago: sus campos no se leen, no se guardan ni se envían, y cualquier botón lo cierra y reinicia los 7 s.
