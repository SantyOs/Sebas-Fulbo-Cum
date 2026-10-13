# Regalo de cumpleaños para Sebastian

El juego mantiene World Cup 2026 como nombre y muestra la dedicatoria para Sebastian en la entrada y después de los goles. Nombre y mensaje son editables.

## Editar jugadores y caras

En el menú principal, pulsa **Personalizar regalo**. Elige una selección y uno de sus once jugadores. Las plantillas originales se mantienen intactas; el regalo guarda modificaciones por selección y jugador original.

- **Identidad:** nombre/apodo y dorsal. Al guardar se resuelven dorsales duplicados; cambiar el número no cambia el ID interno del jugador.
- **Cara:** mandíbula, mentón, ancho/proyección de nariz, separación/apertura de ojos, boca, labios, orejas, pómulos, tamaño de cabeza y color de ojos. Los diez controles de forma deforman vértices de la malla del modelo; cada jugador editado tiene su copia. No se aplica una fotografía ni reconstrucción facial automática.
- **Apariencia:** cinco peinados, color de pelo/barba, barba, piel, botas, muñequeras, estatura y complexión. Las colisiones conservan su tamaño arcade; las proporciones son visuales.
- **Atributos:** velocidad, tiro, pase, regate, defensa y físico, de 1 a 99. Sí afectan a la simulación; el OVR se recalcula por rol.
- **Celebración:** brazos arriba, baile, dab o corazón, con velocidad, giros, salto y confeti configurables por jugador.
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
