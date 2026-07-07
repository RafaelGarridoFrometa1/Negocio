# Mi Negocio — Documento de Proyecto

## Contexto del negocio
Aplicación privada para gestión de remesas Cuba-EEUU. El negocio implica operaciones de envío de dinero entre EEUU y Cuba, con mensajeros en Cuba que realizan las entregas físicas. El propietario es Rafael Garrido.

**IMPORTANTE:** La app no menciona en ningún lugar la palabra "remesas" para mantener discreción. El nombre público es **"Mi Negocio"**.

---

## Infraestructura actual

| Elemento | Detalle |
|----------|---------|
| URL de la app | `https://rafaelgarridofrometa1.github.io/negocio` |
| Repositorio GitHub | `github.com/rafaelgarridofrometa1/negocio` |
| Google Sheets | Libro llamado "Remesas" (ID: `1cvpLbD4cmX8TxdFeC5k4t_dqxfca5cj5y00DDIn597c`) |
| Script Apps Script | URL: `https://script.google.com/macros/s/AKfycby3SRFuU93t37Umwh8w1gZRrIRjvdcvGUDdYTl06OvN0LD7usJo3evUxghBL1-zfA2C/exec` |
| Correo Google | `rafaelgarridofrometa1@gmail.com` |

---

## Arquitectura técnica

- **Tipo:** PWA (Progressive Web App) — funciona sin internet, instalable en móvil
- **Frontend:** HTML/CSS/JS puro en un solo archivo `index.html`
- **Almacenamiento local:** localStorage (clave `negocio_db`)
- **Autenticación:** localStorage (clave `negocio_auth`) — sistema de 2 usuarios máximo
- **Backend:** Google Apps Script (no hay servidor propio)
- **Sincronización:** fetch GET con `mode:'no-cors'` a Google Apps Script
- **Offline:** Service Worker (`sw.js`, caché `negocio-v5`)
- **Código admin para crear usuarios:** `negocio2024admin` (variable `ADMIN_CODE` en index.html)

---

## Estructura del Google Sheets "Remesas"

### Hojas existentes (NO TOCAR)
- **Hojas mensuales** (ej: `Junio 2026`): operaciones mensuales con columnas exactas:
  `R | Daniela | OpeNumero | Dia | Tipo | Donde se cobra la ganancia | Cliente reside en EeUu | Cliente en Cuba | Cantidad a Depositar | Entrega | Costo Mens | Ganancia | Total de Alberto-Dani | Ganado por cada uno | AcumMens | Mensajerias Rosy`
- **Clientes**: base de datos de clientes con columnas:
  `N° | Nombre completo | Telefono | Email | Direccion | Municipio | Reside | Con quien tiene contacto | Decision de compra | Canal | Nota`

### Hojas que crea la app (App Script)
- `App_Envios` — sincronización general de envíos
- `App_Mensajeros` — sincronización de mensajeros
- `App_Pagos` — sincronización de pagos a mensajeros

### Acciones del script
- `?action=getClientes` → devuelve lista de clientes de hoja "Clientes"
- `?data={"action":"saveCliente",...}` → añade cliente a hoja "Clientes"
- `?data={"action":"saveOperacion",...}` → añade fila a hoja del mes activo
- `?data={"action":"sync",...}` → sincronización completa a hojas App_*

---

## Estructura de la base de datos local (localStorage)

```json
{
  "envios": [{
    "id": "uid",
    "cliente": "Nombre cliente EEUU",
    "clienteCuba": "Nombre cliente Cuba",
    "telefono": "+53...",
    "direccion": "Calle, número",
    "municipio": "Playa",
    "mensajero": "id_mensajero",
    "tipo": "EeUu → Cuba",
    "cobro": "EeUu",
    "dia": 24,
    "fecha": "2026-06-24",
    "hora": "15:00",
    "depositar": 57.50,
    "entrega": 50.00,
    "costoMens": 5.00,
    "ganancia": 2.50,
    "ganadoCu": 1.25,
    "notas": "",
    "estado": "pendiente",
    "revisado": false,
    "creado": "2026-06-24"
  }],
  "mensajeros": [{"id": "uid", "nombre": "Alberto", "tel": "+53..."}],
  "pagos": [{"id": "uid", "mensajeroId": "uid", "tipo": "pago", "importe": 30, "concepto": "Semana del...", "fecha": "2026-06-24"}],
  "clientes": [{"id": "uid", "nombre": "...", "telefono": "...", "email": "...", "direccion": "...", "municipio": "...", "reside": "Cuba", "contacto": "...", "canal": "...", "decision": "si", "nota": "...", "creado": "2026-06-24"}]
}
```

---

## Auth (localStorage `negocio_auth`)

```json
[
  {"u": "rafael", "p": "BASE64_DE_CONTRASEÑA"},
  {"u": "usuario2", "p": "BASE64_DE_CONTRASEÑA"}
]
```

- Máximo 2 usuarios (`MAX_USERS = 2`)
- Código admin requerido para crear usuarios: `negocio2024admin`
- Sesión guardada en `sessionStorage` como `logged`

---

## Pestañas de la app

| Pestaña | ID sección | Función |
|---------|-----------|---------|
| 📦 Envíos | `sec-envios` | Lista de operaciones con stats, botón copiar mensaje, marcar entregada |
| 🛵 Entregas | `sec-entregas` | Vista cronológica por fecha/hora, botón copiar mensaje |
| 👤 Mensajeros | `sec-mensajeros` | Gestión de mensajeros, balance de pagos |
| 📋 Resumen | `sec-resumen` | Resumen WhatsApp filtrado por mensajero |
| 👥 Clientes | `sec-clientes` | Lista combinada Sheets+local, búsqueda, formulario nuevo |
| ⚙️ Config | `sec-config` | URL script, usuarios, backup |

---

## Funciones JS clave

| Función | Qué hace |
|---------|---------|
| `saveOp()` | Guarda operación, valida dirección/municipio Cuba obligatorios, genera mensaje mensajero, envía a Sheets |
| `generarTextoMensajero(op)` | Genera texto WhatsApp con datos de entrega |
| `copiarMensajeEnvio(id)` | Copia mensaje WhatsApp de una entrega existente sin editar |
| `seleccionarClienteOp(id, nombre)` | Autocompletada dirección+municipio+teléfono al seleccionar cliente Cuba |
| `findClientByName(nombre)` | Busca cliente en local y en Sheets |
| `loadSheetsClientes()` | Carga lista de clientes desde Google Sheets |
| `saveClienteToSheets(c)` | Guarda cliente nuevo en hoja "Clientes" de Sheets |
| `saveOpToSheets(op)` | Guarda operación en hoja del mes activo |
| `doSync()` | Sincronización completa a hojas App_* |
| `mostrarResumenMensajero(op)` | Muestra mensaje mensajero en pantalla tras guardar |
| `generarResumen()` | Genera resumen de pendientes por mensajero |

---

## Decisiones ejecutivas tomadas

1. **Nombre público:** "Mi Negocio" — nunca mencionar "remesas" en la UI ni en el nombre del repositorio
2. **Repositorio:** `negocio` (no `remesas-app`)
3. **Tecnología:** PWA HTML puro, sin frameworks, sin servidor propio — máxima simplicidad
4. **Sin bloqueo automático:** La sesión permanece abierta en el teléfono del propietario indefinidamente
5. **Máximo 2 usuarios:** Sistema de autenticación cerrado con código admin
6. **Google Sheets como base de datos:** No se usa ninguna base de datos externa, todo va a Sheets
7. **Escritura directa al mes activo:** Las operaciones se escriben en la hoja del mes (ej: "Junio 2026") con el formato EXACTO de columnas existentes — no se altera la estructura del libro
8. **Clientes de Cuba solo:** El autocompletado de teléfono solo aplica al campo "Cliente en Cuba" — el teléfono de EEUU no siempre se recopila
9. **Dirección y municipio obligatorios:** Si el cliente de Cuba no tiene estos datos en la ficha, la app exige completarlos antes de guardar
10. **Offline first:** Todo se guarda localmente primero, Sheets es secundario — funciona sin internet
11. **Municipios de La Habana:** La app tiene la tabla de tarifas (La Lisa 3-4$, Playa 5-6$, etc.) integrada en los selectores
12. **Mensaje para mensajero automático:** Al guardar cada operación aparece automáticamente el texto para WhatsApp sin necesidad de ir a Resumen
13. **Botón copiar en cada entrega:** Cada tarjeta de envío/entrega tiene su propio botón "📲 Copiar mensaje" independiente
14. **Tipos de operación:** EeUu→Cuba y Cuba→EeUu, con campo "Donde se cobra la ganancia"
15. **Revisado por Daniela:** Checkbox en cada operación que mapea a columna "Daniela" en Sheets
16. **Sync mode no-cors:** La sincronización usa `mode:'no-cors'` para evitar bloqueos de CORS de Google
17. **getClientes con cors:** La carga de clientes usa `mode:'cors'` (necesita devolver JSON)

---

## Tarifas de mensajería por municipio

| Municipio | Costo |
|-----------|-------|
| La Coronela | 0-1$ |
| La Lisa | 3-4$ |
| Playa, Marianao | 5-6$ |
| Plaza, Boyeros, Cerro, Centro Habana, Habana Vieja | 7-8$ |
| 10 de Octubre, Arroyo Naranjo | 8-9$ |
| Regla | 10-11$ |
| Guanabacoa, Cotorro, Habana del Este | 12-13$ |

---

## Pendientes / Mejoras futuras

- Ninguna pendiente documentada hasta el fin de esta sesión

---

## Archivos del proyecto

| Archivo | Descripción |
|---------|-------------|
| `index.html` | App completa (HTML + CSS + JS en un solo archivo) |
| `sw.js` | Service Worker para funcionamiento offline (caché `negocio-v4`) |
| `manifest.json` | Manifest PWA para instalación en móvil |
| `script_google_apps.gs` | Script de Google Apps Script para el backend en Sheets |
| `PROYECTO.md` | Este documento |
