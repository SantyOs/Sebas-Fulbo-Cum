# Despliegue automático

Cada push a `master` ejecuta las pruebas y compila el juego en GitHub Actions.
Solo después de validar se entrega el artefacto al runner de despliegue.
Los pull requests se validan en runners públicos y no publican en el servidor.

La configuración de infraestructura se administra directamente en el servidor:
Docker Compose, proxy, dominios, direcciones, puertos y registro del runner.
La carpeta local `deploy/` está ignorada y no debe añadirse al repositorio.

## Contrato del runner

El runner dedicado debe tener las etiquetas `self-hosted`, `Linux`, `sebas-fulbo`,
y recibir estas variables desde su configuración privada:

- `DEPLOY_ROOT`: directorio absoluto de versiones, con permiso de escritura.
- `HEALTHCHECK_URL`: URL interna que devuelve el archivo `version.json` servido.

En GitHub, `DEPLOY_ENABLED=true` y `DEPLOY_TRANSPORT=local` activan la publicación.
No se necesitan claves SSH en el workflow. Las credenciales de registro del runner
se conservan fuera de Git y no deben incluirse en archivos ni logs de la aplicación.

## Verificación y recuperación

El script genérico `scripts/activate-release.sh` valida el artefacto, activa la
versión mediante el enlace `current` y comprueba el SHA por HTTP. Si la comprobación
falla, restaura la versión anterior cuando existe. El enlace `previous` conserva
su ubicación para recuperación manual. No se borran versiones automáticamente.

Para comprobar una publicación, verificar que los jobs `build` y `deploy-lan`
terminaron correctamente y que `/version.json` contiene el SHA esperado.
Las comprobaciones visuales y de audio requieren un navegador real.

## Historial

Una revisión anterior incluía datos operativos del servidor. Se retiraron de la
versión actual, pero eliminar archivos con un commit no borra los commits anteriores.
Esta limpieza no equivale a purgar el historial de Git ni sus copias externas.
