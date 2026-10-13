# Despliegue desde master

El juego es estático: GitHub Actions instala dependencias, ejecuta las pruebas y
compila `dist/`. No necesita base de datos ni Node en producción. El workflow
valida cada push a `master` y cada pull request hacia esa rama.

Servidor: Ubuntu en `100.116.191.99` (Tailscale), SSH puerto 22, usuario `santiago`.
El juego se sirve en `http://100.116.191.99:8086`. Requiere acceso a esa red Tailscale.
La configuración de producción usa `DEPLOY_ENABLED=true` y `DEPLOY_TRANSPORT=local`.
Una ejecución completa debe mostrar tanto `build` como `deploy-lan` en verde.

## Destino previsto

### Instalación Docker en el servidor Tailscale

`deploy/compose.yml` define Nginx y un runner dedicado. Sus archivos se instalan en
`/srv/projects/sebas-fulbo-deploy`, con el proyecto Compose `sebas-fulbo`. El juego
y sus versiones viven en `/srv/sebas-fulbo`. Ambos contenedores se reinician
automáticamente con Docker; el runner conserva su registro en un volumen propio.

El runner se ejecuta sin root ni acceso al socket Docker. Solo tiene escritura
en su volumen de trabajo y en la carpeta del juego. Nginx monta el juego en lectura.
El puerto 8086 se publica únicamente en la IP Tailscale del servidor.

```bash
cd /srv/projects/sebas-fulbo-deploy
docker compose -p sebas-fulbo ps
docker compose -p sebas-fulbo logs --tail=50 runner
docker compose -p sebas-fulbo up -d
```

Para reconstruir el runner, usar `docker compose -p sebas-fulbo build runner`.
El runner puede actualizarse dentro de su volumen; reconstruir la imagen no
sustituye ese volumen. No eliminarlo sin preparar un nuevo registro en GitHub.

### Registro inicial del runner

Los runners públicos no pueden llegar a esa IP privada. La opción prevista es
instalar un runner de GitHub Actions en Ubuntu con un usuario dedicado sin sudo,
con permiso de escritura solo sobre la aplicación. No requiere abrir puertos del
router: el runner establece conexiones salientes con GitHub.

1. Preparar Nginx y `/srv/sebas-fulbo` con propietario igual al usuario del runner.
   El virtual host incluido corresponde a `100.116.191.99`.
2. En Settings → Actions → Runners → New self-hosted runner, seleccionar Linux
   y seguir los comandos que GitHub genera para el repositorio dentro del contenedor
   `runner` (`docker compose -p sebas-fulbo run --rm runner ./config.sh ...`).
   Agregar la etiqueta `sebas-fulbo`. El token de registro es temporal y
   nunca debe guardarse en Git. Usar un runner dedicado a este repositorio.
3. Configurar las variables `DEPLOY_TRANSPORT=local` y `DEPLOY_ENABLED=true`.
   Este modo no necesita secretos SSH: descarga el artefacto validado y activa la
   versión directamente en el servidor. Los pull requests solo ejecutan validación
   en runners públicos; nunca deben ejecutar código en el runner de producción.
4. Ejecutar el workflow sobre `master` y comprobar
   `http://100.116.191.99:8086/version.json` y el juego desde Tailscale.

El acceso por Internet requerirá un dominio y una ruta de entrada configurada
aparte; publicar por LAN no hace accesible el juego fuera de casa.

### Alternativa: servidor accesible por SSH desde GitHub

La receta incluida sirve para un servidor Linux con Nginx, Bash, tar y OpenSSH,
accesible desde los runners de GitHub. Si el servidor usa otro sistema o un panel
de hosting, adaptar el transporte antes de activarlo. La carpeta dedicada es
`/srv/sebas-fulbo`; no se modifican otros sitios.

1. Crear un usuario de despliegue sin privilegios, por ejemplo `sebas-deploy`.
   Crear `/srv/sebas-fulbo` con ese propietario y permisos 755. Instalar la clave
   pública de una clave SSH exclusiva para Actions en su `authorized_keys`.
2. Configurar un virtual host tomando `deploy/nginx.conf` como ejemplo. Sustituir
   `juego.example.com` por el dominio real. Validar con `nginx -t` antes de recargar.
   Apuntar el DNS y configurar HTTPS con el mecanismo de certificados del servidor.
3. En GitHub → Settings → Secrets and variables → Actions, configurar:

   | Tipo | Nombre | Valor |
   | --- | --- | --- |
   | Variable | `DEPLOY_HOST` | Host o IPv4 del servidor |
   | Variable | `DEPLOY_USER` | Usuario SSH de despliegue |
   | Variable | `DEPLOY_PORT` | Puerto SSH; vacío equivale a 22 |
   | Secret | `DEPLOY_SSH_KEY` | Clave privada exclusiva para este despliegue |
   | Secret | `DEPLOY_KNOWN_HOSTS` | Entrada de known_hosts verificada del servidor |
   | Variable | `DEPLOY_ENABLED` | `true`, una vez preparado el servidor |
   | Variable | `DEPLOY_TRANSPORT` | `ssh` para el transporte remoto |

   Verificar la huella SSH por un canal confiable antes de guardar known_hosts.
   Para puertos distintos de 22, la entrada debe usar `[host]:puerto`. No guardar
   claves privadas en el repositorio ni enviarlas por el chat.
4. Ejecutar Actions → Validate and deploy → Run workflow sobre `master` para el
   primer despliegue. Los siguientes pushes a `master` publicarán automáticamente
   solo si las pruebas y compilación pasan.
5. Comprobar `/version.json` en el dominio: `commit` debe coincidir con el SHA
   publicado. Verificar menús, precarga 3D, editor y audio en un navegador real.

## Publicación y recuperación

El workflow copia únicamente `dist/` por SSH con comprobación estricta de host.
Extrae cada versión en un directorio nuevo, valida los archivos principales y
cambia el enlace `current` atómicamente. El despliegue local comprueba por HTTP
que Nginx sirve el SHA esperado; si falla restaura la versión anterior cuando existe.
Nginx no necesita reiniciarse en cada
push. `previous` conserva el destino anterior y las versiones se mantienen en
`releases/`; su limpieza es manual para no borrar una versión necesaria.

Para volver a la versión anterior, ejecutar como usuario de despliegue:

```bash
cd /srv/sebas-fulbo
test -s previous/index.html
ln -s "$(readlink previous)" current.rollback
mv -Tf current.rollback current
```

Recargar las pestañas abiertas tras una publicación: los módulos diferidos de una
versión anterior pueden dejar de estar disponibles desde `current`. Los jugadores
personalizados se guardan en el navegador, no en el servidor. Para trasladarlos a
otro equipo o dominio, exportar/importar el JSON del editor.

HTTPS y disponibilidad pública quedan fuera de esta instalación Tailscale. La
revisión visual y auditiva del juego requiere una sesión de navegador real.
El workflow usa las acciones oficiales [checkout](https://github.com/actions/checkout)
y [setup-node](https://github.com/actions/setup-node), fijadas por SHA.
