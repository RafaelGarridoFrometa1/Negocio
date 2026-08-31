/**
 * MI NEGOCIO - Backend Apps Script  ·  version 3.8
 * Libro "Contabilidad_Remesas"
 *
 * ADAPTADO A LO QUE LA APP ENVIA DE VERDAD:
 *  - La app manda la accion DENTRO del parametro data, no en la URL. Se aceptan las dos.
 *  - Nombres de accion de la app: saveOperacion, saveCliente, sync, getClientes.
 *  - La app manda el Dia como numero del 1 al 31; aqui se convierte en fecha completa.
 *  - La app manda el estado en minusculas (pendiente, en_camino...); aqui se normaliza.
 *
 * NO se escribe la Ganancia ni el AcumMens: son formulas del libro.
 * NO se usa appendRow: las filas 5-2004 ya traen formulas.
 */

// ============================================================
// CONFIGURACION
// ============================================================

// Acepta el ID solo o la URL entera del Sheet.
// OJO: este es el ID del libro REAL y activo "Contabilidad_Remesas36" (el que
// se sigue editando). Antes apuntaba por error a "Copy of Contabilidad_Remesas",
// una copia vieja de prueba del 28 de julio con casi ningun cliente real: por
// eso nada de lo que se escribia en el libro de verdad llegaba a la app.
var ID_LIBRO = '1VcEjOFUod5vl1JiLvFMKdC4-tfQ1LVtom0QHBg4M17U';

// Libro ANTIGUO, solo para la migracion de una vez. Comprueba que sea el correcto:
// tiene que ser el que contiene la pestana "Clientes" con los 427 clientes.
var ID_LIBRO_VIEJO = '1cvpLbD4cmX8TxdFeC5k4t_dqxfca5cj5y00DDIn597c';

// ============================================================
// MAPA DEL LIBRO
// ============================================================

var OP = {
  hoja: 'Operaciones', primera: 5, ultima: 2004,
  dia: 2, tipo: 3, donde: 4, clienteUsa: 5, clienteCuba: 6,
  cantidad: 7, entrega: 8, costoMens: 9,
  mensajero: 12, pagado: 13, estado: 14, revRafael: 15, revDaniela: 16,
  refBanco: 18, nota: 20, idApp: 21,
  formulas: [1, 10, 11, 17, 19]   // OpeNumero, Ganancia, AcumMens, Estado Revision, Periodo
};

// OJO: en Clientes la columna A es el ID (formula). El NOMBRE esta en la B.
// Confirmado leyendo el libro real "Contabilidad_Remesas36": A=ID Cliente,
// B=Nombre Completo, C=Telefono... exactamente como abajo.
var CLI = { hoja: 'Clientes', primera: 6, ultima: 805, colNombre: 2, ancho: 10,
            idApp: 21, formulas: [1,12,13,14,15,16,17,18,19,20] };
var BEN = { hoja: 'Clientes',   primera: 810, ultima: 1609, formulas: [] };
var MEN = { hoja: 'Mensajeros', primera: 6,   ultima: 505,  formulas: [] };
var SOC = { hoja: 'Socios',     primera: 5,   ultima: 404,  formulas: [] };
var CAT = { hoja: 'Catalogos',  primera: 5,   ultima: 204,  colMensajeros: 2, colSocios: 13 };

// ============================================================
// PUNTOS DE ENTRADA
// ============================================================

function doGet(e)  { return manejar(e); }
function doPost(e) { return manejar(e); }

function manejar(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var datos = {};

    // POST: el contenido llega en e.postData.contents, NO en e.parameter.
    // GET : llega en el parametro data de la URL.
    if (e && e.postData && e.postData.contents) {
      datos = JSON.parse(e.postData.contents);
    } else if (p.data) {
      datos = JSON.parse(p.data);
    }

    var accion = p.action || datos.action || 'ping';

    switch (accion) {
      case 'ping':
        return json({ ok: true, message: 'Script activo', version: '3.8',
                      recibioPost: !!(e && e.postData && e.postData.contents),
                      metodo: (e && e.postData) ? 'POST' : 'GET' });

      // --- nombres que usa la app ---
      case 'saveOperacion':
        return json(guardarOperacion(datos.operacion || datos));
      case 'saveCliente':
        return json(guardarCliente(datos.cliente || datos));
      case 'sync':
        return json(sincronizar(datos.data || datos));

      // --- nombres alternativos ---
      case 'guardarOperacion':    return json(guardarOperacion(datos.operacion || datos));
      case 'guardarCliente':      return json(guardarCliente(datos.cliente || datos));
      case 'guardarBeneficiario': return json(guardarBeneficiario(datos));
      case 'guardarAdelanto':     return json(guardarAdelanto(datos));
      case 'guardarMovSocio':     return json(guardarMovSocio(datos));

      // --- lecturas ---
      case 'getClientes':      return json({ ok: true, clientes: getClientes() });
      case 'getOperaciones':   return json({ ok: true, operaciones: getOperaciones() });
      case 'getBeneficiarios': return json({ ok: true, beneficiarios: getBeneficiarios() });
      case 'getMensajeros':    return json({ ok: true, mensajeros: getListaCatalogo(CAT.colMensajeros) });
      case 'getSocios':        return json({ ok: true, socios: getListaCatalogo(CAT.colSocios) });
      case 'getSaldosMensajeros': return json({ ok: true, saldos: getSaldosMensajeros() });

      default:
        return json({ ok: false, error: 'Accion no reconocida: ' + accion });
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ACCESO AL LIBRO
// ============================================================

function idLimpio() { return limpiarId(ID_LIBRO); }

function limpiarId(valor) {
  var s = String(valor).trim();
  var m = s.match(/\/d\/([a-zA-Z0-9_\-]{20,})/);
  if (m) return m[1];
  m = s.match(/^([a-zA-Z0-9_\-]{20,})/);
  if (m) return m[1];
  throw new Error('El ID no parece valido: ' + s);
}

function libro() {
  try {
    return SpreadsheetApp.openById(idLimpio());
  } catch (err) {
    throw new Error('No pude abrir el libro. Comprueba el ID y que el archivo este convertido ' +
                    'a Hojas de calculo de Google (no .xlsx). Detalle: ' + err);
  }
}

function hoja(nombre) {
  var sh = libro().getSheetByName(nombre);
  if (!sh) throw new Error('No existe la hoja "' + nombre + '". Comprueba que abriste el ' +
                           'archivo convertido y no el .xlsx.');
  return sh;
}

// ============================================================
// PRIMERA FILA LIBRE
// ============================================================

function filaLibre(sh, primera, ultima, colClave, colsFormula) {
  var n = ultima - primera + 1;
  var vals = sh.getRange(primera, colClave, n, 1).getValues();
  for (var i = 0; i < n; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) return primera + i;
  }
  return ampliarBloque(sh, ultima, colsFormula, 200);
}

/**
 * Inserta ANTES de la ultima fila, a proposito: asi los rangos 5:2004 de todo el
 * libro se estiran solos a 5:2204. Insertando despues, no crecerian y las filas
 * nuevas quedarian fuera de todos los calculos.
 */
function ampliarBloque(sh, ultima, colsFormula, cuantas) {
  sh.insertRowsBefore(ultima, cuantas);
  var modelo = ultima + cuantas;
  for (var k = 0; k < (colsFormula || []).length; k++) {
    var c = colsFormula[k];
    sh.getRange(modelo, c).copyTo(sh.getRange(ultima, c, cuantas, 1));
  }
  return ultima;
}

// ============================================================
// GUARDAR OPERACION
// ============================================================

function guardarOperacion(d) {
  d = d || {};
  var sh = hoja(OP.hoja);
  var fila = filaLibre(sh, OP.primera, OP.ultima, OP.dia, OP.formulas);

  // B..I  (Dia, Tipo, Donde, Cliente EeUu, Cliente Cuba, Cantidad, Entrega, Costo Mens)
  sh.getRange(fila, OP.dia, 1, 8).setValues([[
    aFecha(d.fecha_iso || d.dia_iso, d.dia, d.creado || d.fecha),
    normTipo(d.tipo),
    normDonde(d.cobro || d.donde),
    d.cliente_eeuu || d.clienteUsa || '',
    d.cliente_cuba || d.clienteCuba || '',
    aNumero(d.depositar !== undefined ? d.depositar : d.cantidad),
    aNumero(d.entrega),
    aNumero(d.costo_mens !== undefined ? d.costo_mens : d.costoMens)
  ]]);

  // L..P  (Mensajero, Pagado al Mensajero, Estado, Revisado Rafael, Revisado Daniela)
  sh.getRange(fila, OP.mensajero, 1, 5).setValues([[
    d.mensajero || '',
    aSiNo(d.pagado_mensajero !== undefined ? d.pagado_mensajero : d.pagado),
    normEstado(d.estado),
    aSiNo(d.revisado_rafael !== undefined ? d.revisado_rafael : d.revRafael),
    aSiNo(d.revisado_daniela !== undefined ? d.revisado_daniela : d.revisado)
  ]]);

  sh.getRange(fila, OP.refBanco).setValue(d.ref_banco || d.refBanco || '');
  sh.getRange(fila, OP.nota).setValue(construirNota(d));
  sh.getRange(fila, OP.idApp).setValue(d.id || '');

  SpreadsheetApp.flush();

  return {
    ok: true,
    fila: fila,
    opeNumero: sh.getRange(fila, 1).getDisplayValue(),
    ganancia: sh.getRange(fila, 10).getDisplayValue(),
    periodo:  sh.getRange(fila, 19).getDisplayValue()
  };
}

/** Junta las notas con la hora y la fecha de entrega, que el libro no tiene columna propia. */
function construirNota(d) {
  var partes = [];
  if (d.notas || d.nota) partes.push(d.notas || d.nota);
  if (d.fecha) partes.push('Entrega: ' + d.fecha + (d.hora ? ' ' + d.hora : ''));
  if (d.municipio) partes.push('Mun: ' + d.municipio);
  return partes.join(' | ');
}

// ============================================================
// LECTURAS
// ============================================================

function getClientes() {
  var sh = hoja(CLI.hoja);
  var n = CLI.ultima - CLI.primera + 1;
  var v = sh.getRange(CLI.primera, CLI.colNombre, n, CLI.ancho).getDisplayValues();
  var out = [];
  for (var i = 0; i < n; i++) {
    if (!v[i][0]) continue;            // sin nombre no hay cliente
    out.push({
      nombre: v[i][0], telefono: v[i][1], email: v[i][2],
      direccion: v[i][3], municipio: v[i][4], reside: v[i][5],
      contacto: v[i][6], decision: v[i][7], canal: v[i][8], nota: v[i][9]
    });
  }
  return out;
}

/**
 * Devuelve TODAS las operaciones del libro para que cualquier telefono que
 * abra la app pueda traerlas, no solo las que el registro localmente.
 * Sin esto, cada telefono solo ve lo que el mismo escribio: la app nunca
 * bajaba operaciones de vuelta desde el Sheet, solo las subia.
 */
function getOperaciones() {
  var sh = hoja(OP.hoja);
  var n = OP.ultima - OP.primera + 1;
  var v = sh.getRange(OP.primera, 1, n, 21).getDisplayValues();
  var out = [];
  for (var i = 0; i < n; i++) {
    var fila = v[i];
    var idApp = String(fila[OP.idApp - 1] || '').trim();
    if (!idApp) continue;   // sin ID App no se puede enlazar de vuelta con el telefono
    var fecha = parseFechaSheet(fila[OP.dia - 1]);
    var nota = desarmarNota(fila[OP.nota - 1]);
    out.push({
      id: idApp,
      tipo: fila[OP.tipo - 1],
      cobro: fila[OP.donde - 1],
      cliente: fila[OP.clienteUsa - 1],
      clienteCuba: fila[OP.clienteCuba - 1],
      depositar: aNumero(fila[OP.cantidad - 1]),
      entrega: aNumero(fila[OP.entrega - 1]),
      costoMens: aNumero(fila[OP.costoMens - 1]),
      ganancia: aNumero(fila[9]),           // columna J, formula
      mensajeroNombre: fila[OP.mensajero - 1],
      pagadoMens: deSiNo(fila[OP.pagado - 1]),
      estado: deEstado(fila[OP.estado - 1]),
      revisado: deSiNo(fila[OP.revDaniela - 1]),
      refBanco: fila[OP.refBanco - 1],
      periodo: fila[18],                    // columna S, formula
      dia: fecha.dia,
      creado: fecha.iso,
      fecha: nota.fecha,
      hora: nota.hora,
      municipio: nota.municipio,
      notas: nota.texto
    });
  }
  return out;
}

/** dd/mm/aaaa (como lo muestra la celda Dia) -> {dia, iso}. */
function parseFechaSheet(v) {
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return { dia: '', iso: '' };
  return {
    dia: parseInt(m[1], 10),
    iso: m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2)
  };
}

/** Deshace construirNota(): separa de vuelta fecha/hora de entrega, municipio y nota libre. */
function desarmarNota(texto) {
  var out = { texto: '', fecha: '', hora: '', municipio: '' };
  String(texto || '').split(' | ').forEach(function (p) {
    var mEntrega = p.match(/^Entrega:\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?/);
    var mMun = p.match(/^Mun:\s*(.+)/);
    if (mEntrega) { out.fecha = mEntrega[1]; out.hora = mEntrega[2] || ''; }
    else if (mMun) { out.municipio = mMun[1]; }
    else if (p) { out.texto = p; }
  });
  return out;
}

function deSiNo(v) { return String(v || '').trim().toLowerCase() === 'si'; }

function deEstado(v) {
  var mapa = { 'Pendiente': 'pendiente', 'En camino': 'en_camino', 'Entregada': 'entregada',
               'Devuelta': 'devuelta', 'Cancelada': 'cancelada' };
  return mapa[String(v || '').trim()] || 'pendiente';
}

function getBeneficiarios() {
  var sh = hoja(BEN.hoja);
  var n = BEN.ultima - BEN.primera + 1;
  var v = sh.getRange(BEN.primera, 1, n, 13).getDisplayValues();
  var out = [];
  for (var i = 0; i < n; i++) {
    if (!v[i][2]) continue;
    out.push({
      id: v[i][0], cliente: v[i][1], nombre: v[i][2], relacion: v[i][3],
      telefono: v[i][4], direccion: v[i][5], municipio: v[i][6],
      provincia: v[i][7], ci: v[i][8], moneda: v[i][9],
      mensajero: v[i][10], activo: v[i][11], notas: v[i][12]
    });
  }
  return out;
}

function getListaCatalogo(col) {
  var sh = hoja(CAT.hoja);
  var n = CAT.ultima - CAT.primera + 1;
  var v = sh.getRange(CAT.primera, col, n, 1).getValues();
  var out = [];
  for (var i = 0; i < n; i++) if (v[i][0]) out.push(str(v[i][0]));
  return out;
}

/** Saldos calculados por el libro: cuanto te debe cada mensajero o cuanto le debes. */
function getSaldosMensajeros() {
  var sh = hoja('Mensajeros');
  var v = sh.getRange(510, 1, 60, 8).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({
      mensajero: v[i][0], adelantos: v[i][1], entregas: v[i][2],
      comisionesDevengadas: v[i][3], comisionesPagadas: v[i][4],
      comisionesPendientes: v[i][5], saldoNeto: v[i][6], situacion: v[i][7]
    });
  }
  return out;
}

// ============================================================
// ESCRITURAS SECUNDARIAS
// ============================================================

function guardarCliente(c) {
  var r = sincronizarClientes([c || {}]);
  return { ok: true, clientes: r };
}

function guardarBeneficiario(d) {
  var sh = hoja(BEN.hoja);
  var fila = filaLibre(sh, BEN.primera, BEN.ultima, 3, BEN.formulas);
  sh.getRange(fila, 1, 1, 13).setValues([[
    d.id || '', d.cliente || '', d.nombre || '', d.relacion || '',
    d.telefono || '', d.direccion || '', d.municipio || '', d.provincia || '',
    d.ci || '', d.moneda || 'CUP', d.mensajero || '', d.activo || 'Si', d.notas || ''
  ]]);
  return { ok: true, fila: fila };
}

function guardarAdelanto(d) {
  var sh = hoja(MEN.hoja);
  var fila = filaLibre(sh, MEN.primera, MEN.ultima, 1, MEN.formulas);
  sh.getRange(fila, 1, 1, 5).setValues([[
    aFecha(d.fecha), d.mensajero || '', aNumero(d.monto), d.metodo || '', d.nota || ''
  ]]);
  return { ok: true, fila: fila };
}

function guardarMovSocio(d) {
  var sh = hoja(SOC.hoja);
  var fila = filaLibre(sh, SOC.primera, SOC.ultima, 1, SOC.formulas);
  sh.getRange(fila, 1, 1, 6).setValues([[
    aFecha(d.fecha), d.socio || '', d.tipo || 'Retiro',
    aNumero(d.monto), d.metodo || '', d.concepto || ''
  ]]);
  return { ok: true, fila: fila };
}

/**
 * SINCRONIZACION REAL: mete las operaciones de la app en la hoja Operaciones.
 *
 * Es IDEMPOTENTE: usa la columna ID App como llave. Si la operacion ya esta,
 * la actualiza; si no esta, la crea. Se puede sincronizar mil veces sin duplicar.
 */
function sincronizar(data) {
  data = data || {};
  var res = { ok: true, mensajeros: 0, clientes: { nuevos: 0, actualizados: 0 },
              operaciones: { nuevas: 0, actualizadas: 0 }, adelantos: 0 };

  // 1) Mensajeros primero: sus nombres alimentan los desplegables y los saldos
  res.mensajeros = sincronizarMensajeros(data.mensajeros || []);

  // 2) Clientes: sus nombres son la llave que conecta las operaciones
  res.clientes = sincronizarClientes(data.clientes || []);

  // 3) Operaciones
  var r = sincronizarOperaciones(data.envios || []);
  res.operaciones = r;

  // 4) Pagos a mensajeros -> seccion de Adelantos
  res.adelantos = sincronizarAdelantos(data.pagos || []);

  return res;
}

/** Anade a Catalogos (columna Mensajeros) los que aun no esten. */
function sincronizarMensajeros(lista) {
  if (!lista.length) return 0;
  var sh = hoja(CAT.hoja);
  var n = CAT.ultima - CAT.primera + 1;
  var col = sh.getRange(CAT.primera, CAT.colMensajeros, n, 1).getValues();
  var existen = {}, libre = -1;
  for (var i = 0; i < n; i++) {
    var v = String(col[i][0] || '').trim();
    if (v) existen[v.toLowerCase()] = true;
    else if (libre === -1) libre = i;
  }
  var nuevos = 0;
  for (var k = 0; k < lista.length; k++) {
    var nom = String(lista[k].nombre || '').trim();
    if (!nom || existen[nom.toLowerCase()]) continue;
    if (libre === -1) break;
    sh.getRange(CAT.primera + libre, CAT.colMensajeros).setValue(nom);
    existen[nom.toLowerCase()] = true;
    libre++;
    nuevos++;
    if (libre >= n) libre = -1;
  }
  return nuevos;
}

/**
 * Mete los clientes de la app en la hoja Clientes.
 * La llave es el NOMBRE, no el id, porque el nombre es lo que conecta con Operaciones.
 * Al actualizar solo pisa los campos que la app trae con contenido: lo que hayan
 * escrito a mano en el Sheet y la app no tenga, no se borra.
 */
function sincronizarClientes(lista) {
  var out = { nuevos: 0, actualizados: 0 };
  if (!lista.length) return out;
  var sh = hoja(CLI.hoja);
  var n = CLI.ultima - CLI.primera + 1;

  var actuales = sh.getRange(CLI.primera, CLI.colNombre, n, CLI.ancho).getValues();
  var mapa = {}, libres = [];
  for (var i = 0; i < n; i++) {
    var nom = String(actuales[i][0] || '').trim();
    if (nom) mapa[nom.toLowerCase()] = i;
    else libres.push(i);
  }

  var nuevas = [], nuevosIds = [], nuevasFilas = [];

  for (var k = 0; k < lista.length; k++) {
    var c = lista[k];
    var nombre = String(c.nombre || '').trim();
    if (!nombre) continue;
    var fila = [nombre, c.telefono || '', c.email || '', c.direccion || '',
                c.municipio || '', c.reside || '', c.contacto || '',
                c.decision || '', c.canal || '', c.nota || ''];

    var idx = mapa[nombre.toLowerCase()];
    if (idx !== undefined) {
      // ya existe: solo se rellenan los huecos o se actualiza lo que la app trae
      var prev = actuales[idx], cambio = false, mezcla = prev.slice();
      for (var j = 1; j < 10; j++) {
        if (fila[j] !== '' && String(fila[j]) !== String(prev[j])) { mezcla[j] = fila[j]; cambio = true; }
      }
      if (cambio) {
        sh.getRange(CLI.primera + idx, CLI.colNombre, 1, CLI.ancho).setValues([mezcla]);
        actuales[idx] = mezcla;
        out.actualizados++;
      }
      if (c.id) sh.getRange(CLI.primera + idx, CLI.idApp).setValue(c.id);
    } else {
      if (!libres.length) break;
      var pos = libres.shift();
      nuevas.push(fila);
      nuevasFilas.push(CLI.primera + pos);
      nuevosIds.push([c.id || '']);
      mapa[nombre.toLowerCase()] = pos;
      actuales[pos] = fila;
      out.nuevos++;
    }
  }

  // Los nuevos se escriben de golpe siempre que las filas sean consecutivas
  escribirBloque(sh, nuevasFilas, nuevas, CLI.colNombre, CLI.ancho);
  escribirBloque(sh, nuevasFilas, nuevosIds, CLI.idApp, 1);

  SpreadsheetApp.flush();
  return out;
}

/** Escribe por tramos consecutivos, para no hacer una llamada por fila. */
function escribirBloque(sh, filas, valores, colIni, ancho) {
  if (!filas.length) return;
  var i = 0;
  while (i < filas.length) {
    var j = i;
    while (j + 1 < filas.length && filas[j + 1] === filas[j] + 1) j++;
    sh.getRange(filas[i], colIni, j - i + 1, ancho).setValues(valores.slice(i, j + 1));
    i = j + 1;
  }
}

function sincronizarOperaciones(envios) {
  var out = { nuevas: 0, actualizadas: 0 };
  if (!envios.length) return out;
  var sh = hoja(OP.hoja);
  var n = OP.ultima - OP.primera + 1;

  // Indice de lo que ya existe: ID App -> fila
  var ids = sh.getRange(OP.primera, OP.idApp, n, 1).getValues();
  var dias = sh.getRange(OP.primera, OP.dia, n, 1).getValues();
  var mapa = {};
  var libres = [];
  for (var i = 0; i < n; i++) {
    var id = String(ids[i][0] || '').trim();
    if (id) mapa[id] = OP.primera + i;
    else if (dias[i][0] === '' || dias[i][0] === null) libres.push(OP.primera + i);
  }

  for (var k = 0; k < envios.length; k++) {
    var e = envios[k];
    var idApp = String(e.id || '').trim();
    var fila;
    if (idApp && mapa[idApp]) {
      fila = mapa[idApp];
      out.actualizadas++;
    } else {
      if (!libres.length) {
        ampliarBloque(sh, OP.ultima, OP.formulas, 200);
        // tras ampliar, las filas nuevas empiezan en OP.ultima
        for (var z = 0; z < 200; z++) libres.push(OP.ultima + z);
      }
      fila = libres.shift();
      out.nuevas++;
    }
    escribirFilaOperacion(sh, fila, e);
  }
  SpreadsheetApp.flush();
  return out;
}

/** Escribe una operacion en una fila concreta, sin tocar las columnas de formula. */
function escribirFilaOperacion(sh, fila, e) {
  sh.getRange(fila, OP.dia, 1, 8).setValues([[
    aFecha(e.dia_iso || e.fecha_iso, e.dia, e.creado || e.fecha),
    normTipo(e.tipo),
    normDonde(e.cobro || e.donde),
    e.cliente_eeuu || e.cliente || '',
    e.cliente_cuba || e.clienteCuba || '',
    aNumero(e.depositar !== undefined ? e.depositar : e.cantidad),
    aNumero(e.entrega),
    aNumero(e.costo_mens !== undefined ? e.costo_mens : e.costoMens)
  ]]);
  sh.getRange(fila, OP.mensajero, 1, 5).setValues([[
    e.mensajeroNombre || e.mensajero_nombre || e.mensajero || '',
    aSiNo(e.pagado_mensajero !== undefined ? e.pagado_mensajero : e.pagadoMens),
    normEstado(e.estado),
    aSiNo(e.revisado_rafael !== undefined ? e.revisado_rafael : e.revRafael),
    aSiNo(e.revisado_daniela !== undefined ? e.revisado_daniela : e.revisado)
  ]]);
  sh.getRange(fila, OP.refBanco).setValue(e.ref_banco || e.refBanco || '');
  sh.getRange(fila, OP.nota).setValue(construirNota(e));
  sh.getRange(fila, OP.idApp).setValue(e.id || '');
}

function sincronizarAdelantos(pagos) {
  if (!pagos.length) return 0;
  var sh = hoja(MEN.hoja);
  var n = MEN.ultima - MEN.primera + 1;
  var ids = sh.getRange(MEN.primera, 6, n, 1).getValues();
  var fechas = sh.getRange(MEN.primera, 1, n, 1).getValues();
  var mapa = {}, libres = [];
  for (var i = 0; i < n; i++) {
    var id = String(ids[i][0] || '').trim();
    if (id) mapa[id] = MEN.primera + i;
    else if (fechas[i][0] === '' || fechas[i][0] === null) libres.push(MEN.primera + i);
  }
  var escritos = 0;
  for (var k = 0; k < pagos.length; k++) {
    var p = pagos[k];
    var idApp = String(p.id || '').trim();
    var fila = (idApp && mapa[idApp]) ? mapa[idApp] : libres.shift();
    if (!fila) break;
    sh.getRange(fila, 1, 1, 6).setValues([[
      aFecha(p.fecha), p.mensajeroNombre || p.mensajero || '',
      aNumero(p.importe !== undefined ? p.importe : p.monto),
      p.tipo || '', p.concepto || '', p.id || ''
    ]]);
    escritos++;
  }
  SpreadsheetApp.flush();
  return escritos;
}

// ============================================================
// MIGRACION DE UNA VEZ DESDE EL LIBRO ANTIGUO
// ============================================================

/**
 * Copia los clientes de la pestana "Clientes" del libro ANTIGUO al libro nuevo.
 *
 * Se hace de libro a libro, sin pasar por la app: esos clientes nunca estuvieron
 * guardados en el telefono, la app solo los leia del Sheet para mostrarlos.
 *
 * Se puede ejecutar varias veces: usa el nombre como llave, no duplica.
 */
function migrarClientesDesdeLibroViejo() {
  var ss = SpreadsheetApp.openById(limpiarId(ID_LIBRO_VIEJO));
  Logger.log('Libro antiguo: ' + ss.getName());

  var sh = ss.getSheetByName('Clientes');
  if (!sh) {
    var hojas = ss.getSheets().map(function (x) { return x.getName(); });
    throw new Error('El libro antiguo no tiene una pestana llamada "Clientes". ' +
                    'Pestanas que si tiene: ' + hojas.join(', '));
  }

  var data = sh.getDataRange().getValues();
  if (data.length < 2) throw new Error('La pestana Clientes del libro antiguo esta vacia.');

  // Buscar la fila de cabecera (la que contiene la palabra "nombre")
  var hi = 0;
  for (var i = 0; i < Math.min(6, data.length); i++) {
    for (var j = 0; j < data[i].length; j++) {
      if (String(data[i][j]).toLowerCase().indexOf('nombre') !== -1) { hi = i; break; }
    }
  }
  var h = data[hi].map(function (x) { return String(x).toLowerCase().trim(); });
  function col(nombres) {
    for (var k = 0; k < nombres.length; k++) {
      for (var c = 0; c < h.length; c++) if (h[c].indexOf(nombres[k]) !== -1) return c;
    }
    return -1;
  }
  var iN = col(['nombre completo', 'nombre']), iT = col(['telefono', 'tel']),
      iE = col(['email', 'correo']), iD = col(['direccion']), iM = col(['municipio']),
      iR = col(['reside']), iC = col(['con quien', 'contacto']),
      iDec = col(['decision']), iCan = col(['canal']), iNo = col(['nota']);

  if (iN < 0) throw new Error('No encontre una columna de nombre en la cabecera: ' + h.join(' | '));
  Logger.log('Cabecera detectada en la fila ' + (hi + 1) + ': ' + h.join(' | '));

  function v(row, idx) { return idx >= 0 ? String(row[idx] || '').trim() : ''; }

  var lista = [];
  for (var r = hi + 1; r < data.length; r++) {
    var row = data[r];
    var nombre = v(row, iN);
    if (!nombre) continue;
    lista.push({
      nombre: nombre, telefono: v(row, iT), email: v(row, iE), direccion: v(row, iD),
      municipio: v(row, iM), reside: v(row, iR), contacto: v(row, iC),
      decision: v(row, iDec), canal: v(row, iCan), nota: v(row, iNo)
    });
  }
  Logger.log('Clientes leidos del libro antiguo: ' + lista.length);

  var res = sincronizarClientes(lista);
  Logger.log('RESULTADO -> nuevos: ' + res.nuevos + ' | actualizados: ' + res.actualizados);
  Logger.log('Clientes que hay ahora en el libro nuevo: ' + getClientes().length);
  return res;
}

/**
 * IMPORTAR DESDE UN RESPALDO DE LA APP
 *
 * Evita por completo depender de la version de la app, de GitHub y del cache.
 * Pasos:
 *   1. En la app (la que funcione), Configuracion -> Exportar copia de seguridad.
 *   2. Sube ese archivo .json a tu Google Drive (a la carpeta que sea).
 *   3. Ejecuta esta funcion desde aqui.
 *
 * Es idempotente: se puede repetir sin duplicar nada.
 */
function importarRespaldo() {
  var archivos = DriveApp.searchFiles('title contains "negocio-backup"');
  var mejor = null;
  while (archivos.hasNext()) {
    var f = archivos.next();
    if (!mejor || f.getDateCreated() > mejor.getDateCreated()) mejor = f;
  }
  if (!mejor) {
    throw new Error('No encontre ningun archivo con "negocio-backup" en el nombre dentro de tu Drive. ' +
                    'Exporta la copia desde la app y subela a Drive antes de ejecutar esto.');
  }

  Logger.log('Archivo: ' + mejor.getName() + '  (' + mejor.getDateCreated() + ')');
  var db = JSON.parse(mejor.getBlob().getDataAsString());

  Logger.log('Contenido del respaldo:');
  Logger.log('   operaciones: ' + (db.envios || []).length);
  Logger.log('   mensajeros : ' + (db.mensajeros || []).length);
  Logger.log('   clientes   : ' + (db.clientes || []).length);
  Logger.log('   pagos      : ' + (db.pagos || []).length);

  // La app guarda el mensajero por id; hay que cambiarlo por su nombre
  var porId = {};
  (db.mensajeros || []).forEach(function (m) { porId[m.id] = m.nombre; });
  (db.envios || []).forEach(function (e) {
    if (!e.mensajeroNombre && e.mensajero && porId[e.mensajero]) e.mensajeroNombre = porId[e.mensajero];
  });
  (db.pagos || []).forEach(function (p) {
    if (!p.mensajeroNombre && p.mensajeroId && porId[p.mensajeroId]) p.mensajeroNombre = porId[p.mensajeroId];
  });

  var res = sincronizar(db);
  Logger.log('');
  Logger.log('RESULTADO:');
  Logger.log('   operaciones nuevas ......... ' + res.operaciones.nuevas);
  Logger.log('   operaciones actualizadas ... ' + res.operaciones.actualizadas);
  Logger.log('   clientes nuevos ............ ' + res.clientes.nuevos);
  Logger.log('   clientes actualizados ...... ' + res.clientes.actualizados);
  Logger.log('   mensajeros anadidos ........ ' + res.mensajeros);
  Logger.log('   adelantos .................. ' + res.adelantos);
  return res;
}

/** Lista los respaldos que ve en tu Drive, sin importar nada. */
function verRespaldos() {
  var it = DriveApp.searchFiles('title contains "negocio-backup"');
  var n = 0;
  while (it.hasNext()) {
    var f = it.next();
    Logger.log('  ' + f.getName() + '   subido: ' + f.getDateCreated());
    n++;
  }
  if (!n) Logger.log('No hay ningun archivo con "negocio-backup" en el nombre en tu Drive.');
}

/** Solo mira el libro antiguo y dice que tiene, sin copiar nada. */
function verLibroViejo() {
  var ss = SpreadsheetApp.openById(limpiarId(ID_LIBRO_VIEJO));
  Logger.log('Libro antiguo: ' + ss.getName());
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) {
    Logger.log('  - "' + hojas[i].getName() + '"  (' + hojas[i].getLastRow() + ' filas)');
  }
}

// ============================================================
// NORMALIZADORES
// ============================================================

/**
 * Reconstruye la fecha de la operacion.
 * La app guarda el DIA del mes por separado (porque antes habia una pestana por mes)
 * y ademas una fecha completa en 'creado' o 'fecha'. Se toma el ano y el mes de la
 * fecha completa, y el dia del campo 'dia' si es valido. Sin esto, las operaciones
 * de meses anteriores se irian todas al mes actual.
 */
function aFecha(iso, diaDelMes, respaldo) {
  var base = fechaIso(iso) || fechaIso(respaldo);
  var d = parseInt(diaDelMes, 10);
  var valido = (d >= 1 && d <= 31);

  if (base) {
    if (!valido) return base;
    var f = new Date(base.getFullYear(), base.getMonth(), d);
    // Si el dia es muy posterior al de la fecha base, casi seguro es del mes anterior
    // (ej: creado el 4 de julio, dia 29 -> 29 de junio)
    if (d - base.getDate() > 20) f.setMonth(f.getMonth() - 1);
    return f;
  }
  var hoy = new Date();
  return valido ? new Date(hoy.getFullYear(), hoy.getMonth(), d) : hoy;
}

function fechaIso(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  var m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function normTipo(v) {
  var s = String(v || '').toLowerCase();
  if (s.indexOf('cuba') === 0) return 'Cuba \u2192 EeUu';
  return 'EeUu \u2192 Cuba';
}

function normDonde(v) {
  var s = String(v || '').toLowerCase().replace(/[^a-z]/g, '');
  return (s.indexOf('cuba') !== -1) ? 'Cuba' : 'EeUu';
}

function normEstado(v) {
  var s = String(v || '').toLowerCase().replace(/[_\s]+/g, '');
  if (s.indexOf('encamino') !== -1) return 'En camino';
  if (s.indexOf('entregad') !== -1) return 'Entregada';
  if (s.indexOf('devuelt') !== -1) return 'Devuelta';
  if (s.indexOf('cancel') !== -1) return 'Cancelada';
  return 'Pendiente';
}

/** Todo lo que sale hacia la app va como texto: el Sheet devuelve numeros y fechas
 *  en celdas que la app trata como cadenas, y eso rompe el .toLowerCase(). */
function str(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  return String(v).trim();
}

function aNumero(v) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? '' : n;
}

function aSiNo(v) {
  return (v === true || v === 'Si' || v === 'si' || v === 1 || v === '1') ? 'Si' : 'No';
}

// ============================================================
// PRUEBAS
// ============================================================

/**
 * Lista las filas de Clientes que tienen algun dato (telefono, email...) pero
 * les falta el Nombre en la columna A: esas filas la app las ignora, porque
 * sin nombre no se puede enlazar con las Operaciones. Rellena el nombre a
 * mano en esas filas y ya deberian aparecer en la app.
 */
function listarFilasSinNombre() {
  var sh = hoja(CLI.hoja);
  var n = CLI.ultima - CLI.primera + 1;
  var v = sh.getRange(CLI.primera, CLI.colNombre, n, CLI.ancho).getDisplayValues();
  var faltantes = [];
  for (var i = 0; i < n; i++) {
    var nombre = String(v[i][0] || '').trim();
    var tieneAlgoMas = v[i].slice(1).some(function (c) { return String(c || '').trim() !== ''; });
    if (!nombre && tieneAlgoMas) faltantes.push(CLI.primera + i);
  }
  if (!faltantes.length) {
    Logger.log('Ninguna fila tiene datos sin nombre. Todo en orden.');
  } else {
    Logger.log('Filas con datos pero SIN nombre (columna del Nombre Completo) - rellenar a mano:');
    faltantes.forEach(function (f) {
      var fila = sh.getRange(f, CLI.colNombre, 1, CLI.ancho).getDisplayValues()[0];
      Logger.log('   fila ' + f + ':  ' + fila.join('  |  '));
    });
  }
  return faltantes;
}

/**
 * Cuenta que hay REALMENTE en la hoja Clientes, columna por columna.
 * Sirve para ver si los datos estan donde deben o se pegaron descolocados.
 */
function contarClientes() {
  var sh = hoja(CLI.hoja);
  var n = CLI.ultima - CLI.primera + 1;
  var v = sh.getRange(CLI.primera, 1, n, 21).getDisplayValues();
  var cab = sh.getRange(5, 1, 1, 21).getDisplayValues()[0];

  var cuenta = [];
  for (var c = 0; c < 21; c++) cuenta[c] = 0;
  var ultimaFilaConAlgo = 0;
  for (var i = 0; i < n; i++) {
    var hayAlgo = false;
    for (var c2 = 0; c2 < 21; c2++) {
      if (String(v[i][c2]).trim() !== '') { cuenta[c2]++; hayAlgo = true; }
    }
    if (hayAlgo) ultimaFilaConAlgo = CLI.primera + i;
  }

  Logger.log('Filas revisadas: ' + CLI.primera + ' a ' + CLI.ultima);
  Logger.log('Ultima fila con algo escrito: ' + ultimaFilaConAlgo);
  Logger.log('');
  Logger.log('Celdas con contenido por columna:');
  var letras = 'ABCDEFGHIJKLMNOPQRSTU';
  for (var c3 = 0; c3 < 21; c3++) {
    Logger.log('   ' + letras.charAt(c3) + '  ' + (cab[c3] || '(sin titulo)') + ' .......... ' + cuenta[c3]);
  }
  Logger.log('');
  Logger.log('CLIENTES QUE VE LA APP (los que tienen algo en la columna B): ' + cuenta[1]);
  Logger.log('');
  Logger.log('Primeras 5 filas, columnas A a F:');
  for (var k = 0; k < 5; k++) {
    Logger.log('   fila ' + (CLI.primera + k) + ':  ' + v[k].slice(0, 6).join('  |  '));
  }
  return { conNombre: cuenta[1], ultimaFila: ultimaFilaConAlgo };
}

/** EMPIEZA POR AQUI. Solo lee, no escribe nada. */
function diagnostico() {
  var lib = libro();
  Logger.log('Libro: ' + lib.getName());
  var nombres = lib.getSheets().map(function (s) { return s.getName(); });
  Logger.log('Hojas: ' + nombres.join(', '));
  var faltan = ['Operaciones','Clientes','Catalogos','Mensajeros','Socios','Gastos','Dashboard']
                 .filter(function (n) { return nombres.indexOf(n) === -1; });
  Logger.log(faltan.length ? 'FALTAN HOJAS: ' + faltan.join(', ') : 'Todas las hojas estan.');
  Logger.log('Clientes en la hoja: ' + getClientes().length);
  Logger.log('Beneficiarios: ' + getBeneficiarios().length);
  Logger.log('Mensajeros: ' + JSON.stringify(getListaCatalogo(CAT.colMensajeros)));
  Logger.log('Socios: ' + JSON.stringify(getListaCatalogo(CAT.colSocios)));
  var sh = hoja(OP.hoja);
  Logger.log('Proxima fila libre: ' + filaLibre(sh, OP.primera, OP.ultima, OP.dia, OP.formulas));
  Logger.log('DIAGNOSTICO OK');
}

/** Simula exactamente lo que envia la app. Ejecutar despues de diagnostico(). */
function probar() {
  var r = guardarOperacion({
    revisado_daniela: false,
    dia: 28,
    tipo: 'EeUu \u2192 Cuba',
    cobro: 'EeUu',
    cliente_eeuu: 'Cliente de ejemplo',
    cliente_cuba: 'Beneficiario de ejemplo',
    depositar: 250,
    entrega: 216,
    costo_mens: 9,
    mensajero: 'Mensajero de ejemplo',
    pagado_mensajero: false,
    estado: 'pendiente',
    notas: 'PRUEBA - borrar',
    fecha: '2026-07-29', hora: '10:30', municipio: 'Plaza'
  });
  Logger.log('Fila ' + r.fila + ' | ' + r.opeNumero + ' | Ganancia ' + r.ganancia + ' | ' + r.periodo);
  Logger.log('La Ganancia debe ser 25 (250 - 216 - 9). Si sale 25, las formulas funcionan.');
  Logger.log('Saldos de mensajeros: ' + JSON.stringify(getSaldosMensajeros()));
}

/** Comprueba que el script entiende una peticion POST. No escribe nada. */
function probarPost() {
  var simulado = { postData: { contents: JSON.stringify({
    action: 'sync',
    data: { envios: [], mensajeros: [], pagos: [],
            clientes: [{ id: 'PRUEBA-1', nombre: 'ZZZ Prueba Borrar',
                         telefono: '000', municipio: 'Plaza', reside: 'Cuba' }] }
  }) } };
  var salida = manejar(simulado).getContent();
  Logger.log('Respuesta: ' + salida);
  if (salida.indexOf('"clientes"') === -1) {
    Logger.log('MAL: el script no proceso el POST.');
  } else {
    Logger.log('BIEN: el POST se procesa. Borra el cliente "ZZZ Prueba Borrar" de la hoja.');
  }
}

/** Limpia las filas de prueba sin borrar las filas (no se pierden las formulas). */
function limpiarPruebas() {
  var sh = hoja(OP.hoja);
  var n = OP.ultima - OP.primera + 1;
  var notas = sh.getRange(OP.primera, OP.nota, n, 1).getValues();
  var borradas = 0;
  for (var i = 0; i < n; i++) {
    var t = String(notas[i][0]).toUpperCase();
    if (t.indexOf('PRUEBA') !== -1 || t.indexOf('EJEMPLO') !== -1) {
      var f = OP.primera + i;
      sh.getRange(f, 2, 1, 8).clearContent();    // B..I
      sh.getRange(f, 12, 1, 5).clearContent();   // L..P
      sh.getRange(f, 18).clearContent();         // R
      sh.getRange(f, 20).clearContent();         // T
      borradas++;
    }
  }
  Logger.log('Filas de prueba limpiadas: ' + borradas);
}
