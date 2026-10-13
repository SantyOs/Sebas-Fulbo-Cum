# Recursos 3D y procedencia

Fecha de incorporación: 11 de octubre de 2026. Solo se incorporan archivos de las ediciones **Standard gratuitas**. No se necesitan compras ni servicios de modelos en tiempo de ejecución.

| Archivo publicado | Fuente y transformación |
| --- | --- |
| `footballer.glb` | [Universal Base Characters — Quaternius](https://quaternius.itch.io/universal-base-characters), `Superhero_Male_FullBody.gltf` y su buffer, empaquetados como GLB. Se retiraron mapas de materiales para aplicar piel y equipación desde el juego. |
| `locomotion.glb` | [Universal Animation Library — Quaternius](https://quaternius.itch.io/universal-animation-library), `UAL1_Standard.glb`. Solo Idle_Loop, Walk_Loop, Jog_Fwd_Loop, Sprint_Loop y Crouch_Fwd_Loop. Se eliminaron mallas, materiales y datos de clips no utilizados. |
| `characters-LICENSE.txt`, `animations-LICENSE.txt` | Avisos originales de ambos archivos ZIP: CC0 1.0 Universal. |
| `manifest.json` | Procedencia, tamaño y SHA-256 de cada archivo incorporado. |

La edición gratuita del pack de personajes contiene la variante masculina de proporciones Superhero; no se utilizó el modelo Regular de pago. El renderer estrecha su complexión, aplica variaciones pequeñas, pelo procedural, camiseta/pantalón/medias, dorsal y nombre. Los guardametas añaden guantes. No son semejanzas faciales de los jugadores reales.

Las pistas `root.position` de los cinco clips son nulas: no trasladan al jugador por el campo. Los clips deportivos de `rendering/sport-clips.ts` son poses aditivas creadas para este proyecto sobre los mismos huesos. Estadio, público, redes, césped, balón, equipaciones y rotulación se generan mediante código propio. No hay recursos de FIFA, PlayStation ni otras franquicias.

## Reproducir la preparación

Descarga gratuitamente los dos ZIP Standard desde sus páginas de origen, mantenlos fuera del repositorio y ejecuta:

```powershell
python scripts/prepare-assets.py RUTA/base-characters.zip RUTA/animation-library.zip
npm test
```

El script no necesita Blender ni red; genera únicamente los dos GLB, avisos y manifiesto en `src/client/public/assets/players/`. Los GLB suman 1.563.784 bytes, frente a los aproximadamente 137 MB de los dos paquetes originales completos. Los hashes permiten detectar cambios si el proveedor actualiza las descargas.

La prueba de recursos carga ambos GLB con el GLTFLoader real, comprueba todos los destinos de las pistas contra el esqueleto, evalúa poses, verifica tamaño finito, ausencia de desplazamiento de raíz y los hashes. La revisión visual de piel, ropa, mezcla de animaciones y poses deportivas sigue pendiente de navegador.
