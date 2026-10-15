# Video de Mónica

Fuente: `videoplayback.mp4`, archivo aportado por el usuario para este regalo.
No es parte de los modelos Quaternius ni se le atribuye su licencia CC0.

Derivado usado: `monica-monkey.webm`, VP9 con alfa, 320×180, 16 segundos,
sin audio. Verde eliminado y bordes desaturados con FFmpeg.
Regeneración: `python scripts/prepare-monkey-video.py <archivo-original>`.
Dependencia de la herramienta: `imageio-ffmpeg`; no se necesita al ejecutar el juego.

## Derrota

`defeat-jijijija.webm`: archivo aportado `videoplayback.mp4`, sin el fotograma negro inicial, prolongado hasta 5 segundos manteniendo el ?ltimo fotograma, verde eliminado. `defeat-mario.webm`: archivo aportado `videoplayback (1).mp4`, fondo naranja eliminado, duraci?n original. VP9 con alfa y audio Opus, 480 px de ancho. Se comparten como assets del regalo, sin atribuirles licencia Quaternius/CC0.

Regenerar: `python scripts/prepare-defeat-videos.py <clash.mp4> <mario.mp4>` (imageio-ffmpeg).
