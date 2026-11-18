# Portrayer MCoC — rediseño sobre el proyecto ORIGINAL (TEST)

Este paquete **NO es un generador nuevo**. Es una actualización visual y una ampliación del editor original existente.

## Lo fundamental

El `index.html` mantiene **exactamente** las referencias de arranque originales:

- `assets/index.8198a119.js` — motor original y selección de campeones.
- `assets/index.87520ace.css` — estilos originales, cargados antes del rediseño.
- `assets/` — imágenes de campeones, marcos, símbolos y demás recursos.

Se han separado el código heredado de ascensión (`js/compat-original.js`) y la capa visual con buscador (`css/redesign.css`, `js/ui-original.js`). El selector nativo de personajes, los controles y el motor de exportación existentes se mantienen.

## Instalación segura en el repositorio TEST

1. Haz una copia o un commit del estado actual de **TheShori/personajesmcocdegemini**.
2. Extrae el ZIP. Copia los archivos `index.html`, `css/redesign.css`, `js/compat-original.js`, `js/ui-original.js` y, si quieres, los iconos a la raíz del repositorio TEST.
3. **NO borres ni sustituyas ninguna carpeta `assets/` ni las imágenes del proyecto original.**
4. Publica en la rama que utilice GitHub Pages y comprueba la web TEST.
5. Revisa el menú **Personaje a elegir** (debe funcionar como antes), la vista previa, estrellas, duplicación, rango, ascensión 1–12 y **DOWNLOAD**.
6. Prueba también el botón dorado **Buscar campeón**. Usa primero los datos disponibles en el selector original. Si no puede leerlos, intentará descubrir las imágenes de carpetas `assets/portraits/`, `assets/portlayer/` o `portraits/` consultando la API pública de GitHub. Si el catálogo no está accesible, puedes seguir usando el selector original sin perder funcionalidad.

**Nota importante:** al no haber podido descargar los archivos `assets/` desde GitHub en esta sesión, esta capa no se ha probado contra la compilación publicada. No modifica producción. Los tests locales se han hecho con un montaje simulado de los controles originales, por lo que es necesario validar en TEST las rutas reales de imágenes y la selección.

## Archivos

```text
index.html                       # HTML limpio + app original intacta
css/redesign.css                 # diseño dorado/oscuro, móvil
js/compat-original.js           # lógica previa de 7★ / ascensión / exportación
js/ui-original.js               # buscador de personajes + navegación visual
favicon* / apple-touch-icon.png # recursos gráficos de usuario
site.webmanifest                # manifiesto original
```

Los archivos de la carpeta `assets/` **NO están incluidos** en este ZIP; deben permanecer en el repositorio original. No sustituyas el directorio entero del repositorio por el ZIP.

## Notas de funcionamiento y límites

- **Selector original:** el dibujo del campeón está gobernado por `assets/index.8198a119.js`. El nuevo buscador **no intenta reemplazar su lógica**; se limita a trasladar el nombre elegido al campo original mediante eventos de entrada y cambio.
- **Autodescubrimiento:** el complemento intenta leer un `data/champions.json` opcional y, como alternativa, el árbol público del repositorio TEST vía `api.github.com`. Puede no encontrar imágenes si el proyecto usa otra ruta, la API bloquea solicitudes o hay variaciones de nombres. En ese caso sigue disponible el selector que ya existía.
- **Carga de iconos:** conserva exactamente `assets/ascension.PNG` (o `assets/ascension.png`), `assets/champion-frame-1.png` ... `-7.png` y `assets/old_champion-frame-7.png` tal como estaban, si existen.
- **Sin cambios de backend:** no se toca ninguna base de datos, script de despliegue ni archivo de producción.
- **Reversión:** restaura el `index.html` del commit anterior; los CSS/JS nuevos pueden dejarse sin enlazar, y la app original volverá a ser la misma.

## Pruebas recomendadas

- Elegir Thanos → se carga su retrato real.
- Cambiar a otro personaje desde el selector original → preview y descarga actualizados.
- Usar el buscador para elegir uno de los personajes visibles → el campo original cambia y, si el motor reconoce su nombre, actualiza la ficha.
- Comprobar clase cósmica/hábil/mutante/místico/científico/tecnológico.
- Modificar estrellas, potencia, rango máximo y duplicación.
- Activar/desactivar marco 7★ Ascension y comprobar nivel 1–12.
- Descargar PNG y contrastarlo con la vista previa.
- Revisar en móvil y ordenador.

## Estado

**Listo para subir y probar manualmente en TEST.** No se ha enviado ningún commit y no se ha modificado producción.
