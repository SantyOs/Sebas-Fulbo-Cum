# Despliegue desde master

El juego es estático: GitHub Actions instala dependencias, ejecuta las pruebas y
compila `dist/`. No necesita base de datos ni Node en producción. El workflow
valida cada push a `master` y cada pull request hacia esa rama.

**Estado:** automatización preparada, servidor pendiente de identificar/configurar.
El paso de publicación está desactivado hasta establecer `DEPLOY_ENABLED=true`.
Una validación verde por sí sola no significa que el juego esté publicado.

## Destino previsto

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
cambia el enlace `current` atómicamente. Nginx no necesita reiniciarse en cada
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

No se ha probado todavía SSH, Nginx, HTTPS ni disponibilidad pública en un servidor
real. El workflow usa las acciones oficiales [checkout](https://github.com/actions/checkout)
y [setup-node](https://github.com/actions/setup-node), fijadas por SHA.
