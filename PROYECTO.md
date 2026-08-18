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

### Pendiente inmediato

1. **Ejecutar `contarClientes()`.** Solo se ven 39 clientes de ~427. Sospecha
   principal: al mover el ID Cliente a la columna A, el nombre pasó a la B; si la
   lista se pegó empezando en A, los datos quedaron corridos una columna. El
   contador lo confirma o lo descarta mostrando cuántas celdas tiene cada columna.

2. Migrar los ~427 clientes del libro antiguo con `migrarClientesDesdeLibroViejo()`
   (ID del libro viejo configurado en `ID_LIBRO_VIEJO`).

3. Subir la app v11 y comprobar que el marcador dice `v11 · 2026-08-17`.

4. **Copiar `negocio-contabilidad.gs` en el editor de Apps Script y crear una
   nueva implementación (Deploy → Manage deployments → Edit → New version).**
   El repositorio tenía guardada una versión vieja del backend
   (`script_google_apps.gs`, apuntando al libro "Remesas" antiguo, leyendo
   `e.parameter.data` en vez de `e.postData.contents`) — por eso las operaciones
   no llegaban y los contactos salían incompletos. Ya se reemplazó en el
   repositorio por `negocio-contabilidad.gs`, pero el cambio solo tiene efecto
   cuando se pega en script.google.com y se publica una implementación nueva
   (pegar el código no basta si la implementación activa sigue siendo la vieja).
   El modal "Copiar código del script" dentro de Configuración también estaba
   desactualizado (traía la misma versión obsoleta) y ya se corrigió para que
   entregue el mismo `negocio-contabilidad.gs`.

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
