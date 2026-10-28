# Mi Negocio — Contabilidad de remesas EE.UU. ↔ Cuba

Contexto para retomar el proyecto. Léeme antes de tocar nada.

---

## Qué es

Negocio de remesas y mensajería entre Estados Unidos y Cuba, con dos socios
(**Rafael** y **Daniela**). Tres piezas que trabajan juntas:

| Pieza | Qué es | Dónde vive |
|---|---|---|
| `Contabilidad_Remesas.xlsx` | Libro contable, 8 hojas, ~20.500 fórmulas | Google Sheets (convertido) |
| `negocio-contabilidad.gs` | Backend Apps Script (v3.8) | script.google.com |
| `index.html` + `sw.js` | PWA (v11) | github.com/RafaelGarridoFrometa1/Negocio |

**Web publicada:** `https://rafaelgarridofrometa1.github.io/Negocio/`
(la `N` de Negocio va en mayúscula — GitHub Pages distingue mayúsculas)

---

## Principio contable que gobierna todo

**El dinero del cliente NO es ingreso.** La *Cantidad a Depositar* es dinero de
terceros en tránsito: un pasivo hasta que se entrega en Cuba.

El ingreso real es la **Ganancia** = `Cantidad a Depositar − Entrega − Costo Mens`.

Toda la utilidad del Dashboard se calcula sobre la Ganancia, nunca sobre el volumen.
Si alguien "corrige" esto para que sume el volumen, rompe la contabilidad entera.

---

## Estructura del libro

### Operaciones (21 columnas, filas 5–2004)

```
A  OpeNumero              FÓRMULA — consecutivo OP-0001, OP-0002...
B  Dia                    fecha
C  Tipo                   EeUu → Cuba  /  Cuba → EeUu
D  Donde se cobra         EeUu / Cuba
E  Cliente reside en EeUu ← desplegable de Clientes!B
F  Cliente en Cuba        ← desplegable de beneficiarios
G  Cantidad a Depositar
H  Entrega                lo que recibe el beneficiario
I  Costo Mens             comisión del mensajero
J  Ganancia               FÓRMULA — G − H − I
K  AcumMens               FÓRMULA — acumulado corriente de I
L  Mensajero
M  Pagado al Mensajero    Si / No
N  Estado                 Pendiente / En camino / Entregada / Devuelta / Cancelada
O  Revisado Rafael        Si / No
P  Revisado Daniela       Si / No
Q  Estado de Revision     FÓRMULA — CONCILIADO cuando O y P son Si
R  Ref. Banco             línea del extracto bancario
S  Periodo                FÓRMULA — AAAA-MM, agrupa el Dashboard
T  Nota
U  ID App                 llave de sincronización (la escribe la app)
```

### Clientes (23 columnas, filas 6–805)

```
A  ID Cliente        FÓRMULA — CL-0001, CL-0002...
B  Nombre Completo   ← LLAVE que conecta con Operaciones!E
C  Telefono
D  Email
E  Direccion
F  Municipio
G  Reside
H  Con Quien Tiene Contacto   (mostrado en la app como "Con quién tiene relación")
I  Decision de Compra
J  Canal
K  Nota
L–T                  FÓRMULAS: Primera Compra, Antigüedad, Última Compra,
                     Días sin Operar, Compras del Mes, Compras Totales,
                     Volumen, Ganancia Generada, Estado
U  ID App
V  Seguimiento       manual: Contactado 1/2/3 veces, Perdido (añadida v14, CLI_ANCHO_LECTURA)
W  Cumpleaños        manual: fecha aaaa-mm-dd, formato forzado a texto (añadida v21)
```

**B..K es lo único que `sincronizarClientes()`/`guardarCliente()` escriben en bloque
(`CLI.ancho=10`).** V y W se escriben cada una por su cuenta, por nombre, con una
celda a la vez (`guardarSeguimiento()`, `guardarCumple()`) — nunca se les amplía
`CLI.ancho`, para no arriesgar las columnas de fórmula L–U si algún día se
escribe de más por error.

**Parámetros:** `N3` = días para marcar INACTIVO (60). `Q3` = mes en curso (automático).

**Beneficiarios en Cuba:** segunda sección de la misma hoja, filas 810–1609.

### Otras hojas

- **Catalogos** — listas maestras. Col. A = clientes (automática, enlaza a `Clientes!B`),
  B = mensajeros, K = tipos, L = dónde se cobra, M = socios.
- **Gastos** — filas 5–1004. NO incluye el Costo Mens (va en Operaciones).
- **Mensajeros** — adelantos (6–505) + saldos calculados (509–569).
  `Saldo Neto = Adelantos − Entregas − Comisiones Pendientes`.
  Positivo = te debe. Negativo = le debes. Hay columna SITUACION en palabras.
- **Socios** — filas 5–404. Aportes y retiros de Rafael y Daniela.
  Un retiro NO es gasto: no va nunca en la hoja Gastos.
- **Dashboard** — A) resultados por mes  B) socios y reparto  C) doble revisión
  D) conciliación de fondos con celda DESCUADRE que debe dar 0.

---

## Reglas del backend (Apps Script)

**Nunca usar `appendRow`.** Las filas 5–2004 ya traen fórmulas puestas; `appendRow`
las considera ocupadas y escribiría en la 2005, fuera del bloque, donde nada calcula.
Usar `filaLibre()`, que busca la primera fila con la columna clave vacía.

**Al ampliar el bloque, insertar ANTES de la última fila** (`insertRowsBefore`).
Insertando después, los rangos `5:2004` de todo el libro no crecen y las filas
nuevas quedan fuera de todos los cálculos.

**POST llega en `e.postData.contents`, no en `e.parameter`.** El manejador acepta
ambos: POST para la app, GET como plan B.

**Leer con `getDisplayValues()`**, no `getValues()`: devuelve lo que se ve en la
celda, sin convertir fechas ni números. Los datos salen tal cual.

**Sincronización idempotente.** Llave para operaciones = `ID App`. Llave para
clientes = **nombre**, no id: si se usara el id y alguien renombra un cliente en la
app, se rompería el vínculo con todas sus operaciones ya registradas.

**Funciones de diagnóstico:** `diagnostico()`, `contarClientes()`, `probarPost()`,
`verRespaldos()`, `importarRespaldo()`, `limpiarPruebas()`,
`migrarClientesDesdeLibroViejo()`.

---

## Reglas de la app (PWA)

**Nunca `mode:'no-cors'`.** Hace que el `fetch` se considere exitoso aunque el
servidor devuelva error. Esto ocultó fallos durante días: la app decía
"✅ Sincronizado" mientras Google rechazaba todo con un 400.

**POST con `Content-Type: text/plain`** — sin límite de URL y sin preflight CORS.
Envío por lotes de 40 operaciones. Plan B automático por GET si el POST falla.

**El service worker debe ser red-primero para el HTML.** La v7 era cache-first
para todo: una vez guardado el `index.html`, el navegador no volvía a pedirlo nunca
y las actualizaciones subidas a GitHub no llegaban jamás. Causó días de bloqueo.

**Marcador de versión visible** en Configuración (`APP_VERSION`). Es la única forma
fiable de saber qué versión está corriendo el navegador. Subirlo en cada cambio,
junto con `CACHE` en `sw.js`.

**Dos listas de clientes distintas:**
- `sheetsClientes` — se leen del Sheet, solo para mostrar. NO se guardan en el móvil.
- `db.clientes` — los creados dentro de la app. Estos sí se sincronizan.

Confundirlas lleva a pensar que la sincronización falla cuando no hay nada que enviar.

**`ADMIN_CODE`** está en claro en el HTML. Pendiente de cambiar.

---

## Estado actual

Funcionando: libro completo y sin errores, backend probado, sincronización
idempotente verificada con datos reales, saldos de mensajeros en ambos sentidos,
reparto de socios, reconstrucción de fechas (7/7 casos correctos).

**Envíos: búsqueda y agrupado por día (2026-09-19).** En la pestaña Envíos:
- Barra de búsqueda (`srch-envios`) que filtra por Cliente EEUU, Cliente Cuba,
  Cantidad a depositar o Entrega (todo concatenado en un solo texto y
  comparado en minúsculas — así una misma caja sirve para nombre o monto).
- La lista ya no sale toda junta: se agrupa por día (`fmtDiaLargo()`, usa la
  fecha de entrega si existe, si no la fecha de registro) con encabezado tipo
  "Martes 15/07/2026", días más recientes primero. Cambio 100% de
  `index.html`, no toca el backend.

**Día del mes precargado (v15.1).** El campo "Día del mes" de Nueva operación
ahora se rellena solo con el día de hoy (`new Date().getDate()`) al abrir el
formulario — antes quedaba vacío o con lo que hubiera dejado la operación
anterior, porque el botón "+ Nuevo" abría el modal sin pasar por
`clearOpForm()`. Ahora "+ Nuevo" llama `clearOpForm()` primero.

**Agrupado de Envíos por día de la operación, no de registro (v15.2).** La
v15 agrupaba por `fecha||creado` (entrega o registro en el sistema). Eso no
es lo que se quería: el día que importa es el del campo "Día del mes"
(`r.dia`), que puede ser distinto al día en que se metió el dato en la app.
`fechaOperacion(r)` reconstruye la fecha real combinando `r.dia` con el
mes/año de `r.creado` (misma lógica que `aFecha()` en el backend: si el día
es muy posterior al de la fecha base, es del mes anterior) y esa es la llave
de agrupación ahora.

**Notificaciones push al celular vía ntfy (v16, 2026-09-19).** Se descartó el
push nativo del navegador (Firebase Cloud Messaging): Apps Script no tiene
firma RSA/EC nativa para el protocolo Web Push sin agregar una librería
OAuth2 y un proyecto de Firebase aparte — mucha fricción para lo que hace
falta. En su lugar se usa **ntfy.sh** (gratis, sin cuenta, apps nativas para
Android/iPhone que ya resuelven el push de verdad):

- `NTFY_TOPIC` en el backend — un nombre de tema privado
  (`mi-negocio-627cd0a0591f`). Cualquiera que lo sepa puede leer/mandar a ese
  tema, así que no se comparte fuera del negocio. Rafael y Daniela instalan
  la app ntfy y se suscriben a ese mismo tema.
- `enviarNtfy(titulo, mensaje)` — POST al endpoint JSON de ntfy
  (`https://ntfy.sh/`, no al de headers, para que tildes/emoji no se rompan).
- `revisarEntregasPendientes()` — recorre Operaciones, filtra
  Pendiente/En camino, deshace la Nota con `desarmarNota()` para sacar
  fecha/hora de entrega, y avisa las que ya vencieron. Guarda qué ya avisó en
  `PropertiesService` (no en el Sheet) usando `ID App` + fecha/hora como
  llave — si se reprograma una entrega ya avisada, vuelve a avisar cuando
  llegue el nuevo horario.
- `configurarTriggerEntregas()` — **hay que ejecutarla una sola vez a mano**
  desde el editor de Apps Script (seleccionarla en el desplegable de arriba
  de Ejecutar) para crear el trigger de tiempo que corre
  `revisarEntregasPendientes()` cada minuto. Es idempotente: borra cualquier
  trigger viejo de esa función antes de crear el nuevo.
- En la app, Configuración → "🔔 Enviar notificación de prueba" llama a la
  acción nueva `probarNtfy` para confirmar que el celular suscrito recibe el
  aviso, sin esperar a que venza una entrega real.

**Limitación conocida:** la dirección no viaja en la Nota (ver limitación ya
documentada de `getOperaciones()`), así que el aviso push no la incluye —
solo cliente, municipio, monto y hora.

**Aviso importante sobre este repositorio (2026-09-19):** en esta sesión se
encontró que lo que había subido a GitHub estaba desincronizado con lo que
ya se había mandado antes: `index.html` le faltaba una ronda completa (quitar
"Resumen", exigir teléfono en Inactivos), y el archivo del backend en el
repo (que además tenía el nombre mal escrito, sin guion) le faltaba las
funciones de Seguimiento/Dashboard — y encima había vuelto a aparecer el
`script_google_apps.gs` viejo que ya se había borrado antes. Todo esto ya se
corrigió de nuevo en esta ronda. **Si en algún momento algo parece "haber
vuelto a como estaba antes", lo primero que hay que revisar es si de verdad
se subió el archivo correcto a GitHub** — la app y el Sheet no tienen forma
de detectar por sí solos si el archivo publicado es viejo.

**Migración a Supabase — solo la base de datos, arrancó 2026-09-20.**
Rafael pidió migrar de Google Sheets a Supabase (plan gratis), con queries y
políticas RLS. Es un cambio de fondo, no un backend "agregado" — hoy toda la
contabilidad vive en las ~20.500 fórmulas del Sheet. Se decidió avanzar por
partes: primero la base de datos sola, sin tocar todavía `index.html` ni
Apps Script, para poder revisarla antes de conectar la app.

- `supabase-schema.sql` (repo, raíz) — esquema completo: `clientes`,
  `beneficiarios`, `mensajeros`, `operaciones`, `gastos`,
  `socios_movimientos`, `adelantos_mensajero`, `config`. Las fórmulas del
  Sheet se volvieron columnas `GENERATED ALWAYS AS` (Ganancia, Estado de
  Revisión, Periodo) o vistas con funciones de ventana/agregación
  (`v_operaciones` con `acum_mens`, `v_clientes_stats`, `v_mensajeros_saldos`,
  `v_dashboard_mensual`, `v_socios_resumen`, `v_conciliacion_fondos`).
- **Mejora real sobre el Sheet:** `direccion_entrega`, `municipio_entrega` y
  `hora_entrega` son columnas propias de `operaciones` — en el Sheet no
  existían y se metían a la fuerza dentro de la Nota (limitación que quedó
  documentada arriba, en `getOperaciones()`). Con columnas de verdad esa
  limitación desaparece.
- **RLS:** todas las tablas tienen RLS activado, con una sola política por
  tabla ("socios: acceso total") que deja pasar a cualquier usuario
  `authenticated` de Supabase Auth — Rafael y Daniela son socios de
  confianza, no hay permisos distintos entre ellos, igual que en el Sheet.
  Las vistas se crearon con `security_invoker = true`: sin eso, Postgres las
  correría con los permisos del dueño de la vista y se saltarían el RLS por
  completo — **probado localmente con un Postgres real**: sin sesión,
  0 filas tanto en tablas como en vistas; con sesión (`authenticated`),
  los datos aparecen normal.
- **Probado con datos de ejemplo** antes de mandarlo: se insertaron
  operaciones/clientes/mensajero de prueba y se confirmó a mano que
  Ganancia, Periodo, Estado de Revisión, AcumMens, estadísticas de clientes
  y saldo de mensajeros dan los números esperados.
- `to_char()` no es "immutable" en Postgres (depende del locale), así que no
  se puede usar en una columna `GENERATED` — por eso `periodo` en
  `operaciones` se calcula con `extract(year/month from fecha)` en vez de
  `to_char(fecha,'YYYY-MM')` (que sí se puede usar dentro de una vista, ahí
  no hay esa restricción).
- **Pasos para Rafael:** crear proyecto en supabase.com (plan gratis), pegar
  `supabase-schema.sql` completo en el SQL Editor y ejecutarlo una vez, y en
  Authentication → Users crear 2 usuarios (Rafael y Daniela) — sin eso el
  RLS no deja pasar a nadie, a propósito.
- **Ojo con el plan gratis de Supabase:** pausa el proyecto solo tras **7
  días** sin ninguna actividad (no 1 semana desde la creación, sino desde el
  último uso) — para un negocio que se usa a diario no debería pasar, pero
  si algún día el proyecto queda pausado hay que entrar al panel de Supabase
  y reactivarlo a mano antes de que la app vuelva a funcionar.
- **Pendiente, ronda aparte:** conectar `index.html` a Supabase (reemplazar
  `enviarAlScript()`/Apps Script por `supabase-js`), decidir qué pasa con el
  login actual (localStorage, 2 usuarios) frente a Supabase Auth real
  (necesario para que `auth.role()='authenticated'` funcione con RLS), y
  migrar los datos que ya existen en el Sheet hacia las tablas nuevas.
  **No se ha tocado nada de `index.html` ni de Apps Script todavía** — el
  Sheet sigue siendo la fuente de verdad hasta que se haga esa migración.

**Operaciones que no llegaban a la hoja: diagnóstico y arreglo (v17,
2026-09-29).** Rafael reportó 77 operaciones en la app de septiembre y solo
48 en el Sheet. Causa real, encontrada leyendo el código (no adivinada):

- Cada operación se mandaba sola, al guardarla, con la acción
  `saveOperacion` → `guardarOperacion()` en el backend. Esa función **no es
  idempotente**: busca la primera fila libre y escribe ahí, sin mirar si el
  ID App ya existe (a diferencia de `sincronizarOperaciones()`, la que usa el
  botón "Sincronizar", que sí empareja por ID App).
- Si ese envío fallaba (sin señal, el script tardó, un corte de red), el
  error solo se registraba con `console.warn` — sin ningún aviso en
  pantalla — y la operación se quedaba **solo en el teléfono**, sin
  reintentarse nunca más. La única red de seguridad era que Rafael pulsara
  "Sincronizar" a mano, que sí manda TODO `db.envios` de nuevo.
- `mezclarOperacionesRemotas()` (la que trae operaciones del Sheet) solo
  agrega/actualiza por ID, nunca quita nada local — así que una operación
  atascada seguía contando en el total de la app para siempre, aunque nunca
  hubiera llegado al Sheet. De ahí el 77 contra 48.

Arreglo, en `index.html`:

- El guardado individual ahora usa la **misma acción idempotente `sync`**
  que el botón Sincronizar (en vez de `saveOperacion`), así que reintentar
  nunca duplica una fila.
- Cola de pendientes (`db.pendientes`, array de IDs): al guardar una
  operación se marca pendiente y se intenta subir enseguida
  (`empujarPendientes()`). Si falla, se queda marcada — visible en una
  insignia junto al punto de sincronización ("⏳ N sin subir") en vez de
  fallar en silencio — y se reintenta sola: al recuperar conexión (evento
  `online`), cada 3 minutos mientras la app está abierta, y al abrir la app.
- **Autorreparación de lo que ya está atascado:** cada vez que se traen
  operaciones del Sheet (`loadSheetsOperaciones()`), se compara contra
  `db.envios` local; cualquier operación que exista en el teléfono pero NO
  vino del Sheet se marca pendiente y se reintenta sola
  (`marcarFaltantesComoPendientes()`). Como el envío es idempotente, esto es
  seguro aunque se equivoque: reenviar algo que ya estaba en el Sheet solo
  lo vuelve a escribir igual, no lo duplica. Esto debería resolver solo,
  la próxima vez que Rafael abra la app con conexión, las 29 operaciones que
  hoy están atascadas — sin que él tenga que hacer nada.
- El botón "Sincronizar" (`doSync`), al terminar con éxito, ahora vacía
  `db.pendientes` por completo (ya subió todo de golpe).

**Consolidación mensual (v17, 2026-09-29).** Botón "📋 Consolidación" en el
Dashboard. Pide el mes, trae **fresco del Sheet** (acción `getOperaciones`,
no los datos locales del teléfono — a propósito, para que sirva de verdad
como reconciliación) las operaciones de ese mes, y las muestra en un
`<textarea>` separadas por tabulador, listas para copiar y pegar en una
hoja de cálculo con las columnas exactas que pidió Rafael: OpeNumero, Dia,
Tipo, Donde se cobra la ganancia, Cliente reside en EeUu, Cliente en Cuba,
Cantidad a Depositar, Entrega, Costo Mens. Ordenadas por fecha y, dentro del
mismo día, por OpeNumero.

Para que la columna OpeNumero no salga vacía, `getOperaciones()` en el
backend tuvo que empezar a devolver la columna A del Sheet (antes se leía
pero no se incluía en la respuesta) — **hace falta pegar de nuevo
`negocio-contabilidad.gs` en Apps Script y crear una NUEVA implementación**
para que este dato llegue.

**Dashboard contaba operaciones en el mes equivocado (v18, 2026-10-08).**
Tras el arreglo de sincronización (v17), Rafael reportó otro desajuste:
Consolidación de septiembre daba 77 operaciones, pero el ranking del
Dashboard decía 84 para el mismo mes. No era un problema de sincronización
— era de **qué fecha se usa para decidir a qué mes pertenece cada
operación**:

- Consolidación filtra con `r.creado`, que viene de `getOperaciones()` en
  el backend — la fecha real de la operación, sacada de la columna "Dia"
  del Sheet. Esa es la fuente de verdad.
- El Dashboard (ranking por mes y "Ganancia del mes") y la "Ganancia del
  mes" de Envíos usaban `(r.fecha||r.creado||'')` — y `r.fecha` **no es la
  fecha de la operación, es la fecha de ENTREGA** (opcional, la que se le
  da al mensajero). Si una operación tenía fecha de entrega programada en
  un mes distinto al de la operación real, se contaba en el mes de la
  entrega en vez del mes real.
- Arreglo: ambos sitios ahora usan `fechaOperacion(r)` (la misma función ya
  usada para agrupar Envíos por día, que reconstruye la fecha real a partir
  del campo "Día del mes") en vez de `r.fecha||r.creado`. Dashboard,
  "Ganancia del mes" y Consolidación quedan consistentes entre sí.

**Organización — tablero diario tipo Excel, con puente a Envíos (v19,
2026-10-24).** Rafael subió su Excel "Entregas.xlsx" (3 hojas: EUA-Cuba,
Cuba-EUA, De tío pa' cá) y pidió replicarlo en la app como una pestaña
nueva, con posibilidad de editar/añadir/quitar filas. Se validó el diseño
con una maqueta interactiva (artefacto de Claude) antes de tocar el código
real, iterando varias rondas hasta que Rafael la aprobó.

- **Nueva sección "Organización"**, 7.ª pestaña de la barra inferior
  (`sec-organizacion`), con 3 sub-pestañas tipo pastilla (una por hoja del
  Excel). Cada una muestra una **tabla real** (no tarjetas) con encabezados
  agrupados igual que el Excel ("Envía"/"Recibe" con sub-columnas), con
  scroll horizontal (`.tbl-wrap{overflow-x:auto}`) porque en el teléfono no
  entran las 14 columnas de golpe.
- **Dato nuevo, independiente de Envíos:** `db.organizacion = {eua:[],
  cuba:[], tio:[]}`. A propósito **no se sincroniza con Google Sheets** —
  vive solo en este teléfono, como un bloc de notas rápido, hasta que una
  fila se manda a Envíos (que sí sincroniza). Si Daniela necesita ver lo
  mismo desde su teléfono, hace falta otra ronda para agregarle
  sincronización — no se ha hecho todavía.
- **Autocompletado de nombres real:** los campos "Envía"/"Recibe" del
  formulario de alta reutilizan `getAllClientNames()` y `findClientByName()`
  — las mismas funciones del formulario de Envíos, no una lista inventada.
  Al elegir el nombre de "Recibe", Dirección y Mensajería se autocompletan
  del cliente guardado (mismo patrón que `seleccionarClienteOp()`), usando
  la tabla `TARIFAS_MENSAJERIA` ya existente.
- **Captura de transferencia / Confirmación nuestra:** solo existen en la
  pestaña EUA-Cuba (es la única que las tiene en el Excel). Son celdas
  tocables que alternan X/— (`toggleOrgCaptura`/`toggleOrgConfirm`).
- **Botón "📤 Enviar" por fila** (columna "En el sistema"): abre el
  formulario de Nueva operación de Envíos ya rellenado (cliente EEUU/Cuba,
  dirección, municipio, entrega, mensajería, notas) vía `enviarOrgRow()`.
  La fila de Organización solo se marca "✅ Enviado" **si la operación se
  guarda de verdad** — se rastrea con `window._orgBridge` y se resuelve
  dentro de `saveOp()`; si se cancela el formulario, la fila se queda como
  estaba. Así nunca queda una fila marcada "enviada" sin la operación real
  detrás.
- **Tres resúmenes** (iconos junto a "+ Nuevo", `abrirResumenOrg()`):
  💰 total a entregar agrupado por nombre de "Recibe"; 📋 cuántas filas
  tienen Captura y cuáles faltan; ✅ lo mismo para Confirmación. Los tres
  se calculan sobre la pestaña que se esté viendo. 📋/✅ solo aparecen en
  EUA-Cuba.
- Cada fila tiene su 🗑️ para borrarla (con confirmación).
- **No requiere cambios en el backend** — todo esto es local (`index.html`
  únicamente), así que esta ronda no necesita redesplegar Apps Script.

**Pendiente de esta ronda (preguntas sin resolver, no bloquean el uso):**
si el botón "Enviar" debería mandar la operación directa a Envíos sin
abrir el formulario (hoy sí lo abre, para revisar mensajero/estado antes
de guardar); si conviene que 💰 sume también las otras pestañas juntas en
vez de solo la activa; y si hace falta sincronizar Organización entre
teléfonos.

**Aviso: esta ronda reveló que el arreglo del Dashboard (v18) se había
perdido.** Al abrir la sesión para este cambio, `index.html` tenía el
código de v17 (Consolidación) pero NO el de v18 (el fix de
`fechaOperacion()` en Dashboard) — se había entregado por archivo pero
Rafael aún no lo había subido a GitHub cuando la sesión anterior terminó,
y el contenedor de esa sesión se perdió. Se volvió a aplicar el fix de v18
dentro de esta misma entrega (v19), así que subiendo este archivo quedan
los dos arreglos a la vez. Recordatorio: **la única copia confiable de lo
que "ya quedó arreglado" es lo que está subido en GitHub** — si una sesión
termina sin que Rafael suba el archivo entregado, ese cambio no existe
todavía aunque el chat diga que sí se hizo.

**Tres arreglos reportados por Rafael + Observación editable (v20,
2026-10-28).** Validado antes con una vista previa en artefacto, como pidió
("primero muéstrame los cambios... y luego los subimos").

- **Ganancia negativa en Cuba → EeUu.** `Ganancia = Depositar − Entrega −
  Costo Mens` es una fórmula fija en el Sheet (columna J) que no distingue
  dónde se cobra el margen. Para operaciones con "Donde se cobra" = Cuba,
  el margen vive en el lado contrario (en vez de cobrarse "aquí" se cobra
  "allá") y la resta sale al revés. Arreglo en dos partes:
  - `index.html`: nueva función `calcularGanancia(dep,ent,cmen,cobro)` —
    si `cobro==='Cuba'` resta `Entrega−Depositar−CostoMens` en vez de
    `Depositar−Entrega−CostoMens`. Usada en `calcOp()` (vista previa en el
    formulario, ahora recalcula también al cambiar "Donde se cobra" — se
    le agregó el `onchange` que le faltaba) y en `saveOp()`.
  - **Pendiente que haga Rafael en el Sheet** (esto no se sube por
    GitHub): reemplazar la fórmula de la columna J, fila por fila o con
    autorelleno, por `=IF(D5="Cuba", H5-G5-I5, G5-H5-I5)` (ajustando el
    número de fila). Sin este cambio, las operaciones ya sincronizadas
    seguirán mostrando la Ganancia vieja (negativa) porque esa columna es
    una fórmula del libro, no algo que escriba la app.
- **Operaciones "Entregada" que volvían a "Pendiente" solas.**
  `deEstado()` en el backend exigía coincidencia EXACTA ("Entregada", con
  mayúscula y sin espacios) contra el texto de la celda; cualquier
  variación — un espacio de más al escribir a mano en el Sheet, por
  ejemplo — hacía que no reconociera nada y devolviera 'pendiente' por
  defecto. La próxima sincronización pisaba el estado local correcto con
  ese 'pendiente' equivocado. Arreglo: `deEstado()` ahora busca por
  fragmento (minúsculas, sin espacios/guiones bajos), igual que
  `normEstado()` ya hacía del lado de escritura — solo cae en 'pendiente'
  cuando de verdad no reconoce ninguna palabra clave.
- **Sincronización lenta.** `doSync()` (el botón "Sincronizar") reenviaba
  TODO `db.envios` en bloques de 40 cada vez que se pulsaba, sin importar
  si ya estaba subido — con cientos de operaciones eso es mucho tráfico
  innecesario. Ahora solo manda lo que está en `db.pendientes` (la cola
  de pendientes de la v17). La seguridad de que "nada se pierde" sigue
  intacta porque `marcarFaltantesComoPendientes()` (ya existente) detecta
  y repara solo cualquier operación atascada al bajar datos del Sheet. Se
  tuvo cuidado de no vaciar `db.pendientes` entero al terminar — solo se
  quitan los IDs que de verdad se acaban de mandar, por si
  `marcarFaltantesComoPendientes()` agregó algo nuevo mientras tanto.
- **Observación editable en Organización.** La celda de Observación de
  cualquier fila ahora es tocable (`editarOrgObs()`, usa `prompt()`) para
  cambiarla después de creada la fila.

**Aviso: el backend volvió a desordenarse.** Al revisar el repo para esta
ronda, `negocio-contabilidad.gs` había vuelto a aparecer como
`negociocontabilidad.gs` (sin guión, versión 3.8 — vieja) y el obsoleto
`script_google_apps.gs` había vuelto a aparecer también — el mismo
problema documentado arriba, otra vez. Se reconstruyó `negocio-
contabilidad.gs` desde la copia embebida en `index.html` (que sí estaba al
día, versión 4.0) y se borraron los dos archivos viejos. **Por eso esta
ronda sí hace falta redesplegar Apps Script** — el fix de `deEstado()`
vive ahí.

**Editar clientes reales del Sheet + Cumpleaños (v21, 2026-10-28).** Rafael
pidió poder editar la info de los clientes y agregar con quién tiene
relación y fecha de cumpleaños.

- **El botón "Editar" existía en el código pero nunca se mostraba** para
  los 427 clientes reales (los que vienen de `sheetsClientes`): la
  condición `!c.fromSheets` solo lo dejaba ver en clientes guardados
  únicamente en este teléfono. Además `editCliente(id)` buscaba por `id`
  en `db.clientes` — y los clientes del Sheet no tienen `id` local,
  `getClientes()` nunca lo manda. Doble motivo por el que editar un
  cliente real no hacía nada.
  - Arreglo: el botón "Editar" ahora sale siempre. `editCliente()` recibe
    el **nombre**, no un id, y busca con `findClientByName()` (local
    primero, luego Sheet) — la misma función que ya usa el autocompletado
    de Envíos.
  - Al guardar: si el cliente es de Sheets (`cliente-origen==='sheet'`),
    se actualiza allá por nombre (`sincronizarClientes()`/`guardarCliente()`
    ya matchean por nombre, no por id) y **no se crea una copia en
    `db.clientes`** — si no, quedaría duplicado en el almacenamiento local
    aunque `renderClientes()` no lo muestre dos veces.
  - "Borrar" se deja igual, solo para clientes locales: no hay forma segura
    de borrar una fila del Sheet desde aquí (filas con fórmulas, protegidas
    a propósito), e intentarlo sobre un cliente de Sheets no haría nada
    porque `deleteCliente()` filtra `db.clientes`, donde ese cliente nunca
    estuvo.
- **"Con quién tiene relación"**: se reusa el campo que ya existía
  ("Con Quien Tiene Contacto", columna H) — solo se le cambió la etiqueta
  en la app para que coincida con cómo lo pide Rafael. No es un campo
  nuevo, no cambia nada en el Sheet.
- **Fecha de cumpleaños**: campo nuevo, columna **W** de Clientes (ver
  estructura arriba). Se guarda con `guardarCumple()` en el backend, una
  celda a la vez por nombre — igual patrón que `guardarSeguimiento()` —
  **forzando el formato de la celda a texto (`'@'`) antes de escribir**,
  para que Sheets no la "reconozca" como fecha de verdad y la muestre
  después en dd/mm/aaaa (eso rompería el `<input type="date">` de la app,
  que exige aaaa-mm-dd). `getClientes()` igual trae una función
  `cumpleAIso()` de red de seguridad para convertir de vuelta si alguna
  celda vieja quedara en ese formato.
  - **Pendiente de Rafael, en el Sheet:** agregarle el encabezado
    "Cumpleaños" a la celda W5 (es solo rótulo, la app no lo necesita para
    funcionar, pero ayuda a que se entienda la columna al mirarla).
- Se corrigió además que el botón "+ Nuevo" de Clientes no limpiaba el
  formulario antes de abrirlo (`clearClienteForm()` no se llamaba) — podía
  arrastrar datos de la última edición a un cliente que se creyera nuevo.

**Consolidación "Por cliente" (v22, 2026-10-28).** Hasta ahora Consolidación
solo daba una lista plana de operaciones del mes. Rafael pidió poder verla
también agrupada por cliente: el nombre y las operaciones que hizo en ese
periodo.

- Dos pestañas en el modal: "Por operación" (el comportamiento de siempre,
  sin cambios) y "Por cliente" (nueva).
- "Por cliente" agrupa por **Cliente reside en EeUu** (quien pide el
  envío, no el destinatario en Cuba) y ordena los nombres alfabéticamente.
  Cada sección trae: `CLIENTE: <nombre> · N operaciones · Total
  depositado: $X`, seguido de sus filas (mismas columnas que siempre,
  menos "Cliente reside en EeUu" — ya es el encabezado de la sección, no
  hace falta repetirlo en cada fila).
- `armarConsolidacionPorOperacion()`/`armarConsolidacionPorCliente()` son
  las dos funciones que construyen las líneas finales;
  `generarConsolidacion()` solo decide cuál llamar según la pestaña activa
  (`consModo`). Mismo origen de datos de siempre (`getOperaciones()` fresco
  del Sheet) — no cambia nada del lado del backend.

**Frecuencia de compra y pestaña de Notificaciones (v23, 2026-10-28).**
Rafael pidió ver cada cuánto compra cada cliente, y una pestaña nueva junto
a Cuba/EeUu/Inactivos/Perdidos que avise cuándo a un cliente "le toca"
comprar, además de cumpleaños.

- `getClientes()` ahora también lee **Primera Compra** (col. L) y
  **Compras Totales** (col. Q), además de la ya leída **Última Compra**
  (col. N) — las tres son fórmulas que el libro ya calculaba solo, no se
  tocó el Sheet para esto.
- `frecuenciaDiasCliente(c)` reparte los días entre Primera y Última
  Compra entre `comprasTotales − 1` → promedio de días entre compras.
  Devuelve `null` (nunca inventa un número) si hay menos de 2 compras o
  faltan fechas. Se muestra en cada tarjeta: "🔁 Compra cada ~X días".
- `diasHastaProximaCompra(c)`: Última Compra + esa frecuencia, comparado
  con hoy. Negativo = ya se pasó la fecha esperada.
- `diasHastaCumple(c)`: días hasta el próximo cumpleaños (si ya pasó este
  año, cuenta para el que viene).
- **Pestaña "🔔 Notificaciones"**: junto a Cuba/EeUu/Inactivos/Perdidos.
  Muestra clientes con la compra esperada vencida o a ≤7 días
  (`VENTANA_AVISO_DIAS`), o con el cumpleaños a ≤7 días. Cada tarjeta que
  cae ahí (y también en los demás filtros, para que se vea en cualquier
  pestaña) lleva una insignia 🔔/🎂 explicando por qué.
- El cálculo (frecuencia, próxima compra, cumpleaños) es todo del lado de
  la app — pero **sí hace falta redesplegar Apps Script**, porque
  Primera Compra y Compras Totales son campos nuevos que `getClientes()`
  tiene que empezar a mandar; sin redesplegar, esas dos llegan vacías y
  "🔁 Compra cada ~X días" no aparece en ninguna tarjeta.

### Pendiente inmediato

- Confirmar que el backend real en script.google.com tiene pegado
  `negocio-contabilidad.gs` con `CLI_ANCHO_LECTURA`/`setSeguimiento` (las
  funciones de Seguimiento y Dashboard) — dado el desorden encontrado en el
  repo, no se puede asumir que la implementación activa esté al día sin que
  Rafael lo confirme.
- Agregar la columna **V ("Seguimiento")** a mano en la hoja "Clientes" si
  todavía no está — ver sección de Seguimiento manual más abajo.
- **Redesplegar `negocio-contabilidad.gs` (v3.9)** — trae el campo
  `opeNumero` que necesita la Consolidación mensual nueva.

### Sin construir

- Hoja de conciliación bancaria contra el extracto (falta saber con qué banco
  trabajan y qué columnas descarga el export).
- Migración del histórico de operaciones desde las pestañas mensuales del libro
  viejo ("Junio 2026", "Julio 2026"...).

---

## Cosas que ya se probaron y NO funcionan

- Enviar la sincronización por GET con todo en la URL → 363.000 caracteres, error 400.
- `appendRow` en hojas con fórmulas pre-cargadas.
- `insertRowsAfter` para ampliar bloques.
- Cache-first en el service worker para el HTML.
- `mode:'no-cors'` en cualquier llamada cuya respuesta importe.
- Leer `e.parameter.data` cuando la app envía por POST.
- Convertir a texto los valores del Sheet con `String()` → altera los datos;
  usar `getDisplayValues()`.
