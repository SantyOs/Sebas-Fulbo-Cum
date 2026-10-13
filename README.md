# World Cup 2026

Fútbol arcade 3D para PC en el navegador. Partido 11 contra 11 frente a la CPU y práctica, teclado configurable y mando estándar. Diez selecciones: Argentina, Brasil, Francia, España, Inglaterra, Portugal, Alemania, Países Bajos, Uruguay y Colombia.

## Arranque

Node.js 22.12 o superior y un navegador con WebGL 2 y aceleración gráfica.

```powershell
npm ci
npm run dev
```

Abre la dirección que imprime Vite, normalmente `http://localhost:5173`. No requiere cuentas, backend, variables de entorno ni base de datos. Los modelos y animaciones se sirven desde el proyecto; Google Fonts es opcional y tiene respaldo del sistema. No abras el HTML con doble clic.

```powershell
npm test
npm run build
npm start
```

`build` comprueba TypeScript y produce `dist/`; `start` sirve esa compilación localmente, normalmente en el puerto 4173. Para publicar basta un alojamiento estático que incluya `dist/assets/players/`. `npm run test:watch` mantiene las pruebas abiertas.

## Jugar

La selección inicial es Argentina–Brasil. Elige tu equipo y luego el rival en una cuadrícula de diez selecciones. Usa ratón, flechas y Enter, o stick/cruceta y A. Esc/B vuelve atrás. No se permite un equipo contra sí mismo.

| Acción | Teclado inicial | Mando estándar |
| --- | --- | --- |
| Mover | Flechas | Stick izquierdo / cruceta |
| Sprint | E | RB / R1 |
| Pase corto | S | A / cruz |
| Tiro / entrada de pie | D | B / círculo |
| Pase largo / barrida | A | X / cuadrado |
| Pase al hueco / salida del portero | W | Y / triángulo |
| Cambiar jugador / modificador elevado | Q | LB / L1 |
| Contener | C | LT / L2 |
| Pausa | Esc | Start |

Pases y tiros cargan al mantener el botón y se ejecutan al soltarlo. Q+W o LB+Y eleva el pase al hueco. El menú Ajustes permite remapear teclas; se guardan localmente. Cambiar de ventana, ocultar la pestaña o desconectar el mando activo pausa y libera entradas; hay que reanudar explícitamente.

El partido conserva 180 segundos de reloj activo, representados como 90 minutos, más las pausas de reinicio y celebración. Práctica tiene un portero y cuatro jugadores de campo locales, un portero rival y duración libre.

## Arquitectura

- `game/simulation/`: estado, acciones, IA, posesión, física, porteros y reglas, sin React, Three.js ni navegador. `MatchSimulation.step(dt, input)` avanza el partido con azar sembrado.
- `game/contracts.ts`: entradas por acciones, snapshots, eventos y contrato del renderer.
- `game/input/`: teclado y Gamepad API; zona muerta radial de 0,18.
- `game/engine.ts` y `game/runtime/`: ciclo de vida, pasos fijos a 60 Hz, interpolación y métricas.
- `game/rendering/`: Three.js, estadio, modelos con esqueleto, locomoción y clips deportivos propios. La simulación decide contactos y desplazamientos.
- `game/teams/`: diez plantillas de once jugadores, roles según formación y elección de equipaciones por contraste.
- `hooks/useGame.ts`: creación, pausa y destrucción. El motor se carga al entrar al partido.
- `components/game/`: menús, selección, marcador y ajustes. `HomePage.tsx` coordina las pantallas.

El renderer 2D se conserva temporalmente como referencia de migración; no se importa en el juego publicado. Se retirará después de la validación visual 3D.

## Estado de la entrega

La compilación y las pruebas automatizadas están verificadas. La apariencia final, un partido jugado de principio a fin, diez reinicios WebGL y el objetivo de rendimiento en la RTX 3050 Laptop **siguen pendientes de comprobación real en navegador**. No hay un navegador conectado al entorno de implementación.

Ajustes incluye medición y exportación JSON: 10 segundos de calentamiento, 60 de juego activo, FPS, p95, resolución interna y GPU informada por WebGL. Calidad alta renderiza a 1920×1080 con composición 16:9; media a 1280×720. Las pruebas de simulación no demuestran rendimiento gráfico.

Ver [arquitectura y decisiones](docs/arquitectura-3d.md), [validación y pendientes](docs/validacion-3d.md), [recursos y licencias](docs/recursos-3d.md) y [análisis inicial de limpieza](docs/analisis-tecnico.md).

## Edición de cumpleaños

El menú **Personalizar regalo** prepara la dedicatoria de Sebastian y permite editar jugadores, caras, atributos, celebraciones y sonidos con vista previa 3D. Guarda cambios para el próximo partido o exporta/importa el regalo como JSON, incluidos los clips propios. En Ajustes puedes acercar la cámara y regular el volumen durante la partida.

Consulta [la guía del editor de cumpleaños](docs/cumpleanos.md) para controles faciales, límites de audio y traslado a otro PC. La revisión visual y auditiva en navegador sigue pendiente.
