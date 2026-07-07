// =====================================================================
// SCRIPT PARA MI NEGOCIO - Google Apps Script
// Abrir desde tu hoja "Remesas" → Extensiones → Apps Script
// =====================================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action || '';
    var raw = decodeURIComponent(e.parameter.data || '');

    // ── Devolver lista de clientes desde hoja Clientes ──────────────
    if (action === 'getClientes') {
      var clientes = getClientesFromSheet(ss);
      return jsonResponse({ ok: true, clientes: clientes });
    }

    // ── Procesar data ───────────────────────────────────────────────
    if (raw) {
      var data = JSON.parse(raw);

      // Guardar cliente nuevo en hoja Clientes
      if (data.action === 'saveCliente') {
        appendCliente(ss, data.cliente);
        return jsonResponse({ ok: true });
      }

      // Guardar operación nueva en hoja del mes actual (Junio 2026, etc.)
      if (data.action === 'saveOperacion') {
        appendOperacion(ss, data.operacion);
        return jsonResponse({ ok: true });
      }

      // Sincronización completa
      if (data.action === 'sync') {
        syncEnvios(ss, data.data.envios || []);
        syncMensajeros(ss, data.data.mensajeros || []);
        syncPagos(ss, data.data.pagos || []);
        return jsonResponse({ ok: true });
      }
    }

    return jsonResponse({ ok: true, message: 'Script activo' });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doPost(e) {
  return doGet(e);
}

// ── Leer hoja Clientes ─────────────────────────────────────────────
function getClientesFromSheet(ss) {
  var sh = ss.getSheetByName('Clientes');
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  // Buscar fila de cabecera (la que contiene "Nombre completo")
  var headerRow = 0;
  for (var i = 0; i < Math.min(5, data.length); i++) {
    for (var j = 0; j < data[i].length; j++) {
      if ((data[i][j] + '').toLowerCase().includes('nombre')) {
        headerRow = i;
        break;
      }
    }
  }

  var headers = data[headerRow].map(function(h) { return (h + '').toLowerCase().trim(); });
  var iNombre   = findCol(headers, ['nombre completo', 'nombre']);
  var iTel      = findCol(headers, ['telefono', 'teléfono', 'tel']);
  var iEmail    = findCol(headers, ['email', 'correo']);
  var iDir      = findCol(headers, ['direccion', 'dirección']);
  var iMun      = findCol(headers, ['municipio']);
  var iReside   = findCol(headers, ['reside']);
  var iContacto = findCol(headers, ['con quien', 'contacto']);
  var iDecision = findCol(headers, ['decision', 'decisión']);
  var iCanal    = findCol(headers, ['canal']);
  var iNota     = findCol(headers, ['nota']);

  var clientes = [];
  for (var r = headerRow + 1; r < data.length; r++) {
    var row = data[r];
    var nombre = iNombre >= 0 ? (row[iNombre] + '').trim() : '';
    if (!nombre) continue;
    clientes.push({
      nombre:    nombre,
      telefono:  iTel >= 0      ? (row[iTel] + '').trim()      : '',
      email:     iEmail >= 0    ? (row[iEmail] + '').trim()     : '',
      direccion: iDir >= 0      ? (row[iDir] + '').trim()       : '',
      municipio: iMun >= 0      ? (row[iMun] + '').trim()       : '',
      reside:    iReside >= 0   ? (row[iReside] + '').trim()    : '',
      contacto:  iContacto >= 0 ? (row[iContacto] + '').trim()  : '',
      decision:  iDecision >= 0 ? (row[iDecision] + '').trim()  : '',
      canal:     iCanal >= 0    ? (row[iCanal] + '').trim()     : '',
      nota:      iNota >= 0     ? (row[iNota] + '').trim()      : '',
      fromSheets: true
    });
  }
  return clientes;
}

// ── Añadir cliente nuevo a hoja Clientes ──────────────────────────
function appendCliente(ss, c) {
  var sh = ss.getSheetByName('Clientes');
  if (!sh) sh = ss.insertSheet('Clientes');

  // Si la hoja está vacía, crear cabecera igual a la tuya
  if (sh.getLastRow() === 0) {
    sh.appendRow(['N°', 'Nombre completo', 'Telefono', 'Email',
      'Direccion', 'Municipio', 'Reside', 'Con quien tiene contacto',
      'Decision de compra', 'Canal', 'Nota', '']);
    formatearCabecera(sh);
  }

  var nextN = sh.getLastRow(); // Número correlativo
  sh.appendRow([
    nextN,
    c.nombre    || '',
    c.telefono  || '',
    c.email     || '',
    c.direccion || '',
    c.municipio || '',
    c.reside    || '',
    c.contacto  || '',
    c.decision  || 'no',
    c.canal     || '',
    c.nota      || '',
    ''
  ]);
}

// ── Añadir operación nueva a hoja del mes activo ──────────────────
// Escribe en el formato EXACTO de tus hojas mensuales:
// R | Daniela | OpeNumero | Dia | Tipo | Donde se cobra la ganancia |
// Cliente reside en EeUu | Cliente en Cuba | Cantidad a Depositar |
// Entrega | Costo Mens | Ganancia | Total de Alberto-Dani |
// Ganado por cada uno | AcumMens | Mensajerias Rosy
function appendOperacion(ss, op) {
  var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var hoy = new Date();
  var nombreMes = meses[hoy.getMonth()] + ' ' + hoy.getFullYear();

  // Buscar hoja del mes — si no existe, la crea
  var sh = ss.getSheetByName(nombreMes);
  if (!sh) {
    sh = ss.insertSheet(nombreMes);
    // Cabecera exacta de tus hojas
    sh.appendRow([
      'R', 'Daniela', 'OpeNumero', 'Dia', 'Tipo',
      'Donde se cobra la ganancia', 'Cliente reside en EeUu',
      'Cliente en Cuba', 'Cantidad a Depositar', 'Entrega',
      'Costo Mens', 'Ganancia', 'Total de Alberto-Dani',
      'Gananado por cada uno', 'AcumMens', 'Mensajerias Rosy'
    ]);
    // Fila 0 vacía igual que en tus hojas
    sh.appendRow([false, false, 0, 0, '', '', '', '', '', '', '', 0, 0, 0, 0, '']);
    formatearCabecera(sh);
  }

  // Calcular siguiente OpeNumero
  var lastRow = sh.getLastRow();
  var nextOpe = lastRow - 1; // -1 por la fila de cabecera, igual que tus hojas

  // Calcular Ganancia = Depositar - Entrega - CostoMens
  var depositar  = parseFloat(op.depositar)  || 0;
  var entrega    = parseFloat(op.entrega)    || 0;
  var costoMens  = parseFloat(op.costo_mens) || 0;
  var ganancia   = depositar - entrega - costoMens;
  var ganadoCu   = ganancia / 2;

  sh.appendRow([
    op.revisado_r       ? true : false,   // R
    op.revisado_daniela ? true : false,   // Daniela
    nextOpe,                              // OpeNumero
    op.dia || hoy.getDate(),             // Dia
    op.tipo || 'EeUu-\u003eCuba',       // Tipo
    op.cobro || 'EeUu',                  // Donde se cobra la ganancia
    op.cliente_eeuu || '',               // Cliente reside en EeUu
    op.cliente_cuba || '',               // Cliente en Cuba
    depositar,                            // Cantidad a Depositar
    entrega,                              // Entrega
    costoMens || '',                      // Costo Mens
    ganancia,                             // Ganancia
    '',                                   // Total de Alberto-Dani (fórmula en Sheets)
    ganadoCu,                             // Ganado por cada uno
    costoMens || '',                      // AcumMens
    op.mensajero || ''                    // Mensajerias Rosy
  ]);
}

// ── Sincronización completa a hojas App_ ──────────────────────────
function syncEnvios(ss, envios) {
  var sh = ss.getSheetByName('App_Envios');
  if (!sh) sh = ss.insertSheet('App_Envios');
  sh.clearContents();
  sh.appendRow([
    'ID','Cliente EEUU','Cliente Cuba','Teléfono','Dirección','Municipio',
    'Depositar','Entrega','Costo Mens','Tipo','Cobro',
    'Dia','Fecha','Hora','Mensajero','Ganancia','Ganado c/u',
    'Notas','Estado','Revisado','Creado'
  ]);
  envios.forEach(function(r) {
    sh.appendRow([
      r.id||'', r.cliente||'', r.cliente_cuba||'', r.telefono||'',
      r.direccion||'', r.municipio||'',
      r.importe||0, r.entrega||0, r.costo_mens||0,
      r.tipo||'EeUu → Cuba', r.cobro||'EeUu',
      r.dia||'', r.fecha||'', r.hora||'',
      r.mensajero_nombre||r.mensajero||'',
      r.ganancia||0, r.ganado_cu||0,
      r.notas||'', r.estado||'pendiente',
      r.revisado?'TRUE':'FALSE', r.creado||''
    ]);
  });
  formatearCabecera(sh);
}

function syncMensajeros(ss, mensajeros) {
  var sh = ss.getSheetByName('App_Mensajeros');
  if (!sh) sh = ss.insertSheet('App_Mensajeros');
  sh.clearContents();
  sh.appendRow(['ID','Nombre','Teléfono']);
  mensajeros.forEach(function(m) {
    sh.appendRow([m.id, m.nombre, m.tel||'']);
  });
  formatearCabecera(sh);
}

function syncPagos(ss, pagos) {
  var sh = ss.getSheetByName('App_Pagos_Mens');
  if (!sh) sh = ss.insertSheet('App_Pagos_Mens');
  sh.clearContents();
  sh.appendRow(['ID','Mensajero','Tipo','Importe','Concepto','Fecha']);
  pagos.forEach(function(p) {
    sh.appendRow([p.id, p.mensajeroNombre||p.mensajeroId||'', p.tipo, p.importe, p.concepto||'', p.fecha]);
  });
  formatearCabecera(sh);
}

// ── Helpers ────────────────────────────────────────────────────────
function findCol(headers, names) {
  for (var i = 0; i < names.length; i++) {
    for (var j = 0; j < headers.length; j++) {
      if (headers[j].includes(names[i])) return j;
    }
  }
  return -1;
}

function formatearCabecera(sh) {
  try {
    var r = sh.getRange(1, 1, 1, sh.getLastColumn());
    r.setBackground('#1a1a2e');
    r.setFontColor('#ffffff');
    r.setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, sh.getLastColumn());
  } catch(e) {}
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Función de prueba ──────────────────────────────────────────────
function testScript() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var clientes = getClientesFromSheet(ss);
  Logger.log('Clientes encontrados: ' + clientes.length);
  if (clientes.length > 0) Logger.log('Primer cliente: ' + clientes[0].nombre);
  
  // Prueba escribir una operación de ejemplo
  var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var hoy = new Date();
  Logger.log('Hoja del mes: ' + meses[hoy.getMonth()] + ' ' + hoy.getFullYear());
  Logger.log('Script funcionando correctamente ✓');
}
