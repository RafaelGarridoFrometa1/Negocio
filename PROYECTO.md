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

### Clientes (21 columnas, filas 6–805)

```
A  ID Cliente        FÓRMULA — CL-0001, CL-0002...
B  Nombre Completo   ← LLAVE que conecta con Operaciones!E
C  Telefono
D  Email
E  Direccion
F  Municipio
G  Reside
H  Con Quien Tiene Contacto
I  Decision de Compra
J  Canal
K  Nota
L–T                  FÓRMULAS: Primera Compra, Antigüedad, Última Compra,
                     Días sin Operar, Compras del Mes, Compras Totales,
                     Volumen, Ganancia Generada, Estado
U  ID App
```

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
