/* =============================================
   SCRIPT.JS - Gestión PYME
   Todas las funciones organizadas por página
   ============================================= */

// -----------------------------------------------
// CONFIGURACIÓN GLOBAL
// -----------------------------------------------

// URL base de la API - funciona local y en Vercel
const API_BASE = ""; // Usar ruta relativa para que funcione en ambos entornos

const PERMISOS_POR_ROL = {
  admin: ["inventario", "facturacion", "usuarios", "reportes", "productos"],
  gerente: ["inventario", "reportes", "productos"],
  vendedor: ["facturacion", "productos"],
  bodeguero: ["inventario", "productos"],
};

// Usuarios de demostración (para login)
const USUARIOS_DEMO = [
  { username: "Pycasas2012", password: "Pycasas2012", role: "admin" },
  { username: "Pruebas", password: "123", role: "admin", isTest: true },
  { username: "vendedor1", password: "1234", role: "vendedor" },
  { username: "bodeguero1", password: "1234", role: "bodeguero" },
  { username: "gerente1", password: "1234", role: "gerente" },
];

/**
 * Obtiene la clave correcta para localStorage dependiendo de si está en modo pruebas.
 */
function obtenerClaveStorage(base) {
  const sesion = obtenerSesion();
  if (sesion && sesion.isTest) {
    return base + "_test";
  }
  return base;
}

// -----------------------------------------------
// SESIÓN - Funciones compartidas
// -----------------------------------------------

/**
 * Obtiene la sesión activa desde sessionStorage.
 * Retorna null si no hay sesión.
 */
function obtenerSesion() {
  return JSON.parse(sessionStorage.getItem("usuario") || "null");
}

/**
 * Verifica que haya sesión activa. Si no la hay, redirige al login.
 * Actualiza el encabezado con el rol del usuario.
 */
function verificarSesion() {
  const sesion = obtenerSesion();
  if (!sesion) {
    window.location.href = "login.html";
    return null;
  }
  const spanRol = document.getElementById("current-role");
  if (spanRol) spanRol.textContent = sesion.role;
  
  if (sesion.isTest) {
    const header = document.querySelector("header");
    if (header) {
      header.style.backgroundColor = "#d35400"; // Orange for test mode
      const logo = document.querySelector(".logo");
      if (logo && !logo.textContent.includes("PRUEBAS")) {
         logo.textContent = logo.textContent + " [MODO PRUEBAS]";
      }
    }
  }
  
  return sesion;
}

/**
 * Cierra la sesión actual eliminando sessionStorage y redirige al login.
 */
function cerrarSesion() {
  sessionStorage.removeItem("usuario");
  window.location.href = "login.html";
}

/**
 * Muestra un mensaje de acceso denegado en el main si el rol no tiene permiso.
 */
function mostrarAccesoDenegado(mensaje) {
  const main = document.querySelector("main");
  if (main) {
    main.innerHTML = `<div class="acceso-denegado">
      <h2>🚫 Acceso Denegado</h2>
      <p>${mensaje || "No tienes permiso para acceder a esta sección."}</p>
      <a href="index.html" class="btn btn-primary">Volver al inicio</a>
    </div>`;
  }
}

// -----------------------------------------------
// LOGIN - login.html
// -----------------------------------------------

/**
 * Maneja el envío del formulario de inicio de sesión.
 * Valida credenciales contra USUARIOS_DEMO y luego contra el backend.
 */
async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const errorDiv = document.getElementById("login-error");

  // Primero revisamos usuarios demo (locales)
  const usuarioLocal = USUARIOS_DEMO.find(
    (u) =>
      u.username === username && u.password === password && u.role === role,
  );

  if (usuarioLocal) {
    sessionStorage.setItem(
      "usuario",
      JSON.stringify({
        username: usuarioLocal.username,
        role: usuarioLocal.role,
        permisos: PERMISOS_POR_ROL[usuarioLocal.role] || [],
        isTest: usuarioLocal.isTest || false,
      }),
    );
    errorDiv.style.display = "none";
    window.location.href = "index.html";
    return;
  }

  // Si no está en demo, consultar validación contra backend MongoDB
  try {
    const res = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role })
    });

    const data = await res.json();
    if (!res.ok) {
      // Verificar si el error es por cuenta no aprobada
      if (res.status === 403 && data.error.includes("aprobada")) {
        errorDiv.innerHTML = `${data.error}<br><small>Revisa tu correo o contacta al administrador.</small>`;
      } else {
        errorDiv.textContent = data.error || "Error al iniciar sesión.";
      }
      errorDiv.style.display = "block";
      return;
    }

    sessionStorage.setItem(
      "usuario",
      JSON.stringify({
        username: data.usuario.username,
        role: data.usuario.role,
        permisos: PERMISOS_POR_ROL[data.usuario.role] || [],
        isTest: false,
      }),
    );
    errorDiv.style.display = "none";
    window.location.href = "index.html";
  } catch (err) {
    console.error("Error en login remoto:", err);
    errorDiv.textContent = "Error de conexión con el servidor.";
    errorDiv.style.display = "block";
  }
}

/**
 * Inicializa la página de login. Redirige si ya hay sesión activa.
 */
function initLogin() {
  if (obtenerSesion()) {
    window.location.href = "index.html";
  }
}

// -----------------------------------------------
// REGISTRO - registro.html
// -----------------------------------------------

/**
 * Maneja el envío del formulario de registro de nuevo usuario al backend.
 */
async function handleRegistro(event) {
  event.preventDefault();
  const msgDiv = document.getElementById("registro-msg");
  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const password2 = document.getElementById("password2").value;
  const role = document.getElementById("role").value;

  if (password !== password2) {
    mostrarAlerta(msgDiv, "Las contraseñas no coinciden.", "error");
    return;
  }

  mostrarAlerta(msgDiv, "Enviando solicitud al servidor...", "success");

  try {
    const res = await fetch(API_BASE + "/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, username, password, role })
    });

    const data = await res.json();
    if (!res.ok) {
      mostrarAlerta(msgDiv, data.error || "Error al registrar.", "error");
      return;
    }

    mostrarAlerta(
      msgDiv,
      `✅ ¡Registro enviado exitosamente! <br><br>
      <strong>Tu cuenta está pendiente de aprobación.</strong><br>
      Se ha enviado una notificación a <strong>tecnico@pycasas.co</strong> para que revise tu solicitud.<br>
      <em>Recibirás un correo cuando tu cuenta sea aprobada. No podrás iniciar sesión hasta que sea autorizada.</em>`,
      "success",
    );
    document.getElementById("registro-form").reset();
    setTimeout(() => {
      window.location.href = "login.html";
    }, 6000);
  } catch (err) {
    console.error("Error al registrar:", err);
    mostrarAlerta(msgDiv, "Error de conexión con el servidor.", "error");
  }
}

// -----------------------------------------------
// PANEL PRINCIPAL - index.html
// -----------------------------------------------

/**
 * Inicializa el panel principal: verifica sesión, genera menú y estadísticas.
 */
function initIndex() {
  const sesion = verificarSesion();
  if (!sesion) return;

  // Sincroniza estado local al abrir el panel principal.
  cargarUltimaSincronizacionGuardada();
  cargarDatosDesdeMongo();
  verificarConexionMongo();

  // Refresca el texto relativo ("hace X min") sin recargar la página.
  setInterval(cargarUltimaSincronizacionGuardada, 60000);

  // Encabezado
  const spanUser = document.getElementById("current-user");
  if (spanUser) spanUser.textContent = sesion.username;

  // Info del sistema
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl("info-user", sesion.username);
  setEl("info-role", sesion.role);
  setEl("info-permisos", sesion.permisos.join(", "));
  setEl(
    "info-fecha",
    new Date().toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );
  setEl(
    "bienvenida-texto",
    `Sesión activa como ${sesion.role}. Selecciona una opción del menú.`,
  );

  // Definición del menú
  const menuItems = [
    { label: "🏠 Inicio", href: "index.html", always: true },
    {
      label: "📋 Ver Inventario",
      href: "productos_visualizacion.html",
      permiso: "productos",
    },
    {
      label: "➕ Ingresar Artículo",
      href: "productos_ingreso.html",
      permiso: "productos",
    },
    {
      label: "✏️ Editar Artículo",
      href: "productos_edicion.html",
      permiso: "productos",
    },
    {
      label: "🗑️ Eliminar Artículo",
      href: "productos_eliminacion.html",
      soloRol: "admin",
    },
    {
      label: "📤 Salida por Alquiler",
      href: "alquiler_salida.html",
      permiso: "facturacion",
    },
    {
      label: "↩️ Devolución Alquiler",
      href: "alquiler_devolucion.html",
      permiso: "facturacion",
    },
    {
      label: "\ud83d\udcca Reportes",
      href: "reportes.html",
      permiso: "reportes",
    },
    { label: "👥 Registrar Usuario", href: "registro.html", soloRol: "admin" },
    { label: "⚙️ Gestionar Usuarios", href: "admin_usuarios.html", soloRol: "admin" },
  ];

  // Generar sidebar
  const sidebar = document.getElementById("sidebar");
  const accesosDiv = document.getElementById("accesos-rapidos");
  if (sidebar) {
    const ul = document.createElement("ul");
    menuItems.forEach((item) => {
      if (!tieneAcceso(item, sesion)) return;
      const li = document.createElement("li");
      li.textContent = item.label;
      if (item.href === "index.html") li.classList.add("active");
      li.onclick = () => {
        window.location.href = item.href;
      };
      ul.appendChild(li);

      if (!item.always && accesosDiv) {
        const a = document.createElement("a");
        a.href = item.href;
        a.className = "btn btn-outline";
        a.style.width = "100%";
        a.textContent = item.label;
        accesosDiv.appendChild(a);
      }
    });
    sidebar.appendChild(ul);
  }

  // Estadísticas de inicio
  const statsDiv = document.getElementById("stats-inicio");
  if (statsDiv && sesion.permisos.includes("productos")) {
    const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
    const totalStock = productos.reduce((s, p) => s + p.stock, 0);
    const stockBajo = productos.filter(
      (p) => p.stock <= (p.stockMin || 0),
    ).length;
    statsDiv.innerHTML = `
      <div class="stat-card"><div class="stat-number">${productos.length}</div><div class="stat-label">Productos Registrados</div></div>
      <div class="stat-card"><div class="stat-number">${totalStock}</div><div class="stat-label">Unidades en Stock</div></div>
      <div class="stat-card stat-warning"><div class="stat-number">${stockBajo}</div><div class="stat-label">Alertas de Stock Bajo</div></div>`;
  }
}

// -----------------------------------------------
// PRODUCTOS - INGRESO - productos_ingreso.html
// -----------------------------------------------

/**
 * Inicializa la página de ingreso de productos.
 */
function initProductosIngreso() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "productos_ingreso.html");
  if (!sesion.permisos.includes("productos")) {
    mostrarAccesoDenegado("No tienes permiso para ingresar productos.");
  }
}

/**
 * Guarda un nuevo producto en localStorage.
 */
function guardarProducto(event) {
  event.preventDefault();
  const sesion = obtenerSesion();
  const msgDiv = document.getElementById("form-msg");

  const producto = {
    id: Date.now(),
    codigo: document.getElementById("codigo").value.trim(),
    nombre: document.getElementById("nombre").value.trim(),
    categoria: document.getElementById("categoria").value,
    precio: parseFloat(document.getElementById("precio").value),
    costo: parseFloat(document.getElementById("costo").value) || 0,
    stock: parseInt(document.getElementById("stock").value),
    stockMin: parseInt(document.getElementById("stock-min").value) || 0,
    proveedor: document.getElementById("proveedor").value.trim(),
    descripcion: document.getElementById("descripcion").value.trim(),
    fechaIngreso: new Date().toLocaleDateString("es-CO"),
    creadoPor: sesion ? sesion.username : "desconocido",
  };

  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");

  if (productos.find((p) => p.codigo === producto.codigo)) {
    mostrarAlerta(
      msgDiv,
      `Ya existe un producto con el código "${producto.codigo}".`,
      "error",
    );
    return;
  }

  productos.push(producto);
  localStorage.setItem(obtenerClaveStorage("productos"), JSON.stringify(productos));
  mostrarAlerta(
    msgDiv,
    `Producto "${producto.nombre}" guardado exitosamente.`,
    "success",
  );
  document.getElementById("form-producto").reset();
  window.scrollTo(0, 0);
  exportarDatos(); // 🔄 Sincronizar con MongoDB Atlas
}

// -----------------------------------------------
// PRODUCTOS - EDICIÓN - productos_edicion.html
// -----------------------------------------------

/**
 * Inicializa la página de edición de productos.
 */
function initProductosEdicion() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "productos_edicion.html");
  if (!sesion.permisos.includes("productos")) {
    mostrarAccesoDenegado("No tienes permiso para editar productos.");
  }
}

/**
 * Filtra productos por texto y muestra resultados en la tabla de búsqueda.
 */
function buscarProductoEdicion() {
  const texto = document.getElementById("buscar-input").value.toLowerCase();
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  const div = document.getElementById("tabla-busqueda");
  if (!texto) {
    div.innerHTML = "";
    return;
  }

  const encontrados = productos.filter(
    (p) =>
      p.codigo.toLowerCase().includes(texto) ||
      p.nombre.toLowerCase().includes(texto),
  );

  if (encontrados.length === 0) {
    div.innerHTML = '<p class="text-muted">No se encontraron productos.</p>';
    return;
  }

  div.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Acción</th></tr></thead>
      <tbody>
        ${encontrados
          .map(
            (p) => `
          <tr>
            <td>${p.codigo}</td><td>${p.nombre}</td><td>${p.categoria}</td>
            <td>$${p.precio.toLocaleString("es-CO")}</td><td>${p.stock}</td>
            <td><button class="btn btn-sm btn-primary" onclick='cargarEdicion(${JSON.stringify(p)})'>✏️ Editar</button></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

/**
 * Carga los datos de un producto en el formulario de edición.
 */
function cargarEdicion(p) {
  document.getElementById("edit-id").value = p.id;
  document.getElementById("edit-codigo").value = p.codigo;
  document.getElementById("edit-nombre").value = p.nombre;
  document.getElementById("edit-categoria").value = p.categoria;
  document.getElementById("edit-precio").value = p.precio;
  document.getElementById("edit-costo").value = p.costo || "";
  document.getElementById("edit-stock").value = p.stock;
  document.getElementById("edit-stock-min").value = p.stockMin || "";
  document.getElementById("edit-proveedor").value = p.proveedor || "";
  document.getElementById("edit-descripcion").value = p.descripcion || "";
  const seccion = document.getElementById("seccion-edicion");
  seccion.style.display = "block";
  seccion.scrollIntoView({ behavior: "smooth" });
}

/**
 * Guarda los cambios de edición de un producto en localStorage.
 */
function actualizarProducto(event) {
  event.preventDefault();
  const sesion = obtenerSesion();
  const id = parseInt(document.getElementById("edit-id").value);
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  const idx = productos.findIndex((p) => p.id === id);
  if (idx === -1) return;

  productos[idx] = {
    ...productos[idx],
    nombre: document.getElementById("edit-nombre").value.trim(),
    categoria: document.getElementById("edit-categoria").value,
    precio: parseFloat(document.getElementById("edit-precio").value),
    costo: parseFloat(document.getElementById("edit-costo").value) || 0,
    stock: parseInt(document.getElementById("edit-stock").value),
    stockMin: parseInt(document.getElementById("edit-stock-min").value) || 0,
    proveedor: document.getElementById("edit-proveedor").value.trim(),
    descripcion: document.getElementById("edit-descripcion").value.trim(),
    ultimaEdicion: new Date().toLocaleDateString("es-CO"),
    editadoPor: sesion ? sesion.username : "desconocido",
  };

  localStorage.setItem(obtenerClaveStorage("productos"), JSON.stringify(productos));
  const msgDiv = document.getElementById("edit-msg");
  mostrarAlerta(
    msgDiv,
    `Producto "${productos[idx].nombre}" actualizado correctamente.`,
    "success",
  );
  exportarDatos();
  cancelarEdicion();
  window.scrollTo(0, 0);
}

/**
 * Cancela la edición y oculta el formulario.
 */
function cancelarEdicion() {
  document.getElementById("seccion-edicion").style.display = "none";
  document.getElementById("buscar-input").value = "";
  document.getElementById("tabla-busqueda").innerHTML = "";
}

// -----------------------------------------------
// PRODUCTOS - ELIMINACIÓN - productos_eliminacion.html
// -----------------------------------------------

let _idParaEliminar = null;

/**
 * Inicializa la página de eliminación de productos.
 */
function initProductosEliminacion() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "productos_eliminacion.html");
  if (sesion.role !== "admin") {
    mostrarAccesoDenegado("Solo el Administrador puede eliminar productos.");
  }
}

/**
 * Filtra productos y muestra resultados con botón de eliminar.
 */
function buscarProductoEliminacion() {
  const texto = document.getElementById("buscar-input").value.toLowerCase();
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  const div = document.getElementById("tabla-busqueda");
  if (!texto) {
    div.innerHTML = "";
    return;
  }

  const encontrados = productos.filter(
    (p) =>
      p.codigo.toLowerCase().includes(texto) ||
      p.nombre.toLowerCase().includes(texto),
  );

  if (encontrados.length === 0) {
    div.innerHTML = '<p class="text-muted">No se encontraron productos.</p>';
    return;
  }

  div.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Stock</th><th>Precio</th><th>Acción</th></tr></thead>
      <tbody>
        ${encontrados
          .map(
            (p) => `
          <tr>
            <td>${p.codigo}</td><td>${p.nombre}</td><td>${p.categoria}</td>
            <td><span class="badge ${p.stock <= (p.stockMin || 0) ? "badge-danger" : "badge-success"}">${p.stock}</span></td>
            <td>$${p.precio.toLocaleString("es-CO")}</td>
            <td><button class="btn btn-sm btn-danger" onclick="solicitarEliminar(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')">🗑️ Eliminar</button></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

/**
 * Abre el modal de confirmación para eliminar un producto.
 */
function solicitarEliminar(id, nombre) {
  _idParaEliminar = id;
  document.getElementById("confirm-nombre").textContent = `"${nombre}"`;
  document.getElementById("modal-confirmar").style.display = "flex";
}

/**
 * Confirma y ejecuta la eliminación del producto seleccionado.
 */
function confirmarEliminar() {
  let productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  const prod = productos.find((p) => p.id === _idParaEliminar);
  productos = productos.filter((p) => p.id !== _idParaEliminar);
  localStorage.setItem(obtenerClaveStorage("productos"), JSON.stringify(productos));

  const msgDiv = document.getElementById("delete-msg");
  mostrarAlerta(
    msgDiv,
    `Producto "${prod ? prod.nombre : ""}" eliminado correctamente.`,
    "success",
  );
  exportarDatos();
  cerrarModal();
  document.getElementById("buscar-input").value = "";
  document.getElementById("tabla-busqueda").innerHTML = "";
  window.scrollTo(0, 0);
}

/**
 * Cierra el modal de confirmación sin eliminar.
 */
function cerrarModal() {
  document.getElementById("modal-confirmar").style.display = "none";
  _idParaEliminar = null;
}

// -----------------------------------------------
// PRODUCTOS - VISUALIZACIÓN - productos_visualizacion.html
// -----------------------------------------------

/**
 * Inicializa la página de visualización de productos.
 */
function initProductosVisualizacion() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "productos_visualizacion.html");
  if (!sesion.permisos.includes("productos")) {
    mostrarAccesoDenegado("No tienes permiso para ver productos.");
    return;
  }
  cargarEstadisticasVisualizacion();
  aplicarFiltros();
}

/**
 * Carga las estadísticas rápidas del inventario en la página de visualización.
 */
function cargarEstadisticasVisualizacion() {
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  const total = productos.length;
  const totalStock = productos.reduce((s, p) => s + p.stock, 0);
  const stockBajo = productos.filter(
    (p) => p.stock <= (p.stockMin || 0),
  ).length;
  const valorInventario = productos.reduce((s, p) => s + p.precio * p.stock, 0);

  const statsGrid = document.getElementById("stats-grid");
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Total Productos</div></div>
      <div class="stat-card"><div class="stat-number">${totalStock}</div><div class="stat-label">Unidades en Stock</div></div>
      <div class="stat-card stat-warning"><div class="stat-number">${stockBajo}</div><div class="stat-label">Con Stock Bajo</div></div>
      <div class="stat-card stat-success"><div class="stat-number">$${valorInventario.toLocaleString("es-CO")}</div><div class="stat-label">Valor Inventario</div></div>`;
  }
}

/**
 * Aplica los filtros de búsqueda y muestra los productos filtrados.
 */
function aplicarFiltros() {
  const texto = (
    document.getElementById("filtro-texto")?.value || ""
  ).toLowerCase();
  const cat = document.getElementById("filtro-cat")?.value || "";
  const stockFilt = document.getElementById("filtro-stock")?.value || "";
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");

  const lista = productos.filter((p) => {
    const ct =
      !texto ||
      p.nombre.toLowerCase().includes(texto) ||
      p.codigo.toLowerCase().includes(texto);
    const cc = !cat || p.categoria === cat;
    const cs =
      !stockFilt ||
      (stockFilt === "bajo" && p.stock <= (p.stockMin || 0)) ||
      (stockFilt === "normal" && p.stock > (p.stockMin || 0));
    return ct && cc && cs;
  });

  const div = document.getElementById("tabla-container");
  if (!div) return;

  if (lista.length === 0) {
    div.innerHTML =
      productos.length === 0
        ? `<div class="empty-state"><p>📦 No hay productos registrados aún.</p><a href="productos_ingreso.html" class="btn btn-primary">➕ Ingresar Producto</a></div>`
        : `<p class="text-muted">No se encontraron productos con los filtros aplicados.</p>`;
    return;
  }

  div.innerHTML = `
    <p class="result-count">Mostrando <strong>${lista.length}</strong> producto(s)</p>
    <table class="tabla">
      <thead>
        <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Proveedor</th><th>Fecha</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${lista
          .map(
            (p) => `
          <tr>
            <td><code>${p.codigo}</code></td>
            <td><strong>${p.nombre}</strong></td>
            <td><span class="badge badge-info">${p.categoria}</span></td>
            <td>$${p.precio.toLocaleString("es-CO")}</td>
            <td>${p.costo ? "$" + p.costo.toLocaleString("es-CO") : "-"}</td>
            <td><span class="badge ${p.stock <= (p.stockMin || 0) ? "badge-danger" : "badge-success"}">${p.stock} uds.</span></td>
            <td>${p.proveedor || "-"}</td>
            <td>${p.fechaIngreso || "-"}</td>
            <td>
              <a href="productos_edicion.html" class="btn btn-sm btn-primary">✏️</a>
              <a href="productos_eliminacion.html" class="btn btn-sm btn-danger">🗑️</a>
            </td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

/**
 * Limpia todos los filtros aplicados y recarga la tabla.
 */
function limpiarFiltros() {
  const f1 = document.getElementById("filtro-texto");
  const f2 = document.getElementById("filtro-cat");
  const f3 = document.getElementById("filtro-stock");
  if (f1) f1.value = "";
  if (f2) f2.value = "";
  if (f3) f3.value = "";
  aplicarFiltros();
}

// -----------------------------------------------
// REPORTES - reportes.html
// -----------------------------------------------

/**
 * Inicializa la página de reportes.
 */
function initReportes() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "reportes.html");
  if (!sesion.permisos.includes("reportes")) {
    mostrarAccesoDenegado(
      "No tienes permiso para ver reportes. Solo Admin y Gerente.",
    );
    return;
  }
  generarReportes();
}

/**
 * Genera todos los reportes del inventario.
 */
function generarReportes() {
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");

  if (productos.length === 0) {
    const kpis = document.getElementById("kpis");
    if (kpis)
      kpis.innerHTML =
        '<p class="text-muted">No hay productos registrados aún.</p>';
    return;
  }

  // KPIs
  const totalProductos = productos.length;
  const totalUnidades = productos.reduce((s, p) => s + p.stock, 0);
  const valorVenta = productos.reduce((s, p) => s + p.precio * p.stock, 0);
  const valorCosto = productos.reduce(
    (s, p) => s + (p.costo || 0) * p.stock,
    0,
  );
  const utilidadEstimada = valorVenta - valorCosto;
  const stockBajoCount = productos.filter(
    (p) => p.stock <= (p.stockMin || 0),
  ).length;

  const kpis = document.getElementById("kpis");
  if (kpis) {
    kpis.innerHTML = `
      <div class="stat-card"><div class="stat-number">${totalProductos}</div><div class="stat-label">Productos Registrados</div></div>
      <div class="stat-card"><div class="stat-number">${totalUnidades}</div><div class="stat-label">Unidades Totales</div></div>
      <div class="stat-card stat-success"><div class="stat-number">$${valorVenta.toLocaleString("es-CO")}</div><div class="stat-label">Valor en Venta</div></div>
      <div class="stat-card stat-info"><div class="stat-number">$${utilidadEstimada.toLocaleString("es-CO")}</div><div class="stat-label">Utilidad Estimada</div></div>
      <div class="stat-card stat-warning"><div class="stat-number">${stockBajoCount}</div><div class="stat-label">Alertas de Stock</div></div>`;
  }

  // Por categoría
  const porCategoria = {};
  productos.forEach((p) => {
    if (!porCategoria[p.categoria])
      porCategoria[p.categoria] = { cantidad: 0, unidades: 0, valor: 0 };
    porCategoria[p.categoria].cantidad++;
    porCategoria[p.categoria].unidades += p.stock;
    porCategoria[p.categoria].valor += p.precio * p.stock;
  });

  const divCat = document.getElementById("reporte-categorias");
  if (divCat) {
    divCat.innerHTML = `
      <table class="tabla">
        <thead><tr><th>Categoría</th><th>Productos</th><th>Unidades</th><th>Valor</th></tr></thead>
        <tbody>
          ${Object.entries(porCategoria)
            .map(
              ([cat, d]) => `
            <tr>
              <td><span class="badge badge-info">${cat}</span></td>
              <td>${d.cantidad}</td><td>${d.unidades}</td>
              <td>$${d.valor.toLocaleString("es-CO")}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  // Stock bajo
  const stockBajoProd = productos.filter((p) => p.stock <= (p.stockMin || 0));
  const divSB = document.getElementById("reporte-stock-bajo");
  if (divSB) {
    divSB.innerHTML =
      stockBajoProd.length === 0
        ? '<p class="text-success">✅ Todos los productos tienen stock suficiente.</p>'
        : `<table class="tabla">
          <thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead>
          <tbody>
            ${stockBajoProd
              .map(
                (p) => `
              <tr>
                <td><code>${p.codigo}</code></td><td>${p.nombre}</td>
                <td><span class="badge badge-danger">${p.stock}</span></td>
                <td>${p.stockMin || 0}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>`;
  }

  // Top 5 por valor
  const top5 = [...productos]
    .sort((a, b) => b.precio * b.stock - a.precio * a.stock)
    .slice(0, 5);
  const divTop = document.getElementById("reporte-top");
  if (divTop) {
    divTop.innerHTML = `
      <table class="tabla">
        <thead><tr><th>#</th><th>Producto</th><th>Precio Unit.</th><th>Stock</th><th>Valor Total</th></tr></thead>
        <tbody>
          ${top5
            .map(
              (p, i) => `
            <tr>
              <td><span class="rank">${i + 1}</span></td><td>${p.nombre}</td>
              <td>$${p.precio.toLocaleString("es-CO")}</td><td>${p.stock}</td>
              <td><strong>$${(p.precio * p.stock).toLocaleString("es-CO")}</strong></td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  // Detalle completo
  const divCompleto = document.getElementById("reporte-completo");
  if (divCompleto) {
    divCompleto.innerHTML = `
      <table class="tabla">
        <thead>
          <tr><th>Código</th><th>Nombre</th><th>Cat.</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Valor</th><th>Utilidad</th><th>Proveedor</th></tr>
        </thead>
        <tbody>
          ${productos
            .map((p) => {
              const valor = p.precio * p.stock;
              const utilidad = (p.precio - (p.costo || 0)) * p.stock;
              return `<tr>
              <td><code>${p.codigo}</code></td><td>${p.nombre}</td><td>${p.categoria}</td>
              <td>$${p.precio.toLocaleString("es-CO")}</td>
              <td>${p.costo ? "$" + p.costo.toLocaleString("es-CO") : "-"}</td>
              <td><span class="badge ${p.stock <= (p.stockMin || 0) ? "badge-danger" : "badge-success"}">${p.stock}</span></td>
              <td>$${valor.toLocaleString("es-CO")}</td>
              <td class="${utilidad > 0 ? "text-success" : "text-danger"}">$${utilidad.toLocaleString("es-CO")}</td>
              <td>${p.proveedor || "-"}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }
}

/**
 * Ejecuta window.print() para imprimir el reporte.
 */
function imprimirReporte() {
  window.print();
}

// -----------------------------------------------
// ALQUILER - SALIDA - alquiler_salida.html
// -----------------------------------------------

/** Artículos temporales del formulario de salida */
let _itemsAlquiler = [];

const CLAVE_CONSECUTIVO_DOC = "consecutivoDocumental";

function formatearNumeroRemision(consecutivo) {
  return `REM${String(consecutivo).padStart(5, "0")}`;
}

function formatearNumeroFactura(consecutivo) {
  return `FVPA${String(consecutivo).padStart(5, "0")}`;
}

function resolverConsecutivoDesdeAlquiler(alquiler) {
  if (
    Number.isInteger(alquiler?.consecutivoDoc) &&
    alquiler.consecutivoDoc >= 0
  ) {
    return alquiler.consecutivoDoc;
  }

  if (typeof alquiler?.remisionNumero === "string") {
    const matchRem = alquiler.remisionNumero.match(/^REM(\d{5})$/);
    if (matchRem) return parseInt(matchRem[1], 10);
  }

  if (typeof alquiler?.facturaNumero === "string") {
    const matchFac = alquiler.facturaNumero.match(/^FVPA(\d{5})$/);
    if (matchFac) return parseInt(matchFac[1], 10);
  }

  return null;
}

function obtenerSiguienteConsecutivoDocumental(alquileres = []) {
  const guardado = parseInt(
    localStorage.getItem(obtenerClaveStorage("consecutivoDocumental")) || "-1",
    10,
  );
  let maxDesdeDatos = -1;

  alquileres.forEach((a) => {
    const consecutivo = resolverConsecutivoDesdeAlquiler(a);
    if (Number.isInteger(consecutivo) && consecutivo > maxDesdeDatos) {
      maxDesdeDatos = consecutivo;
    }
  });

  const siguiente = Math.max(guardado, maxDesdeDatos) + 1;
  localStorage.setItem(obtenerClaveStorage("consecutivoDocumental"), String(siguiente));
  return siguiente;
}

/**
 * Inicializa la página de salida por alquiler.
 */
function initAlquilerSalida() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "alquiler_salida.html");
  if (
    !sesion.permisos.includes("facturacion") &&
    !sesion.permisos.includes("productos")
  ) {
    mostrarAccesoDenegado(
      "No tienes permiso para registrar salidas de alquiler.",
    );
    return;
  }
  const salidaReloj = document.getElementById("fecha-salida-reloj");
  if (salidaReloj) {
    salidaReloj.textContent = new Date().toLocaleString("es-CO");
  }

  calcularTotalAlquiler();
  cargarAlquileresActivos();
}

/**
 * Busca artículos en el inventario para agregarlos al alquiler.
 */
function buscarArticuloAlquiler() {
  const texto = (document.getElementById("buscar-articulo")?.value || "")
    .toLowerCase()
    .trim();
  const div = document.getElementById("resultado-busqueda-alquiler");
  if (!texto) {
    div.innerHTML = "";
    return;
  }

  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  const encontrados = productos.filter(
    (p) =>
      (p.codigo.toLowerCase().includes(texto) ||
        p.nombre.toLowerCase().includes(texto)) &&
      p.stock > 0,
  );

  if (encontrados.length === 0) {
    div.innerHTML =
      '<p class="text-muted">No se encontraron artículos disponibles.</p>';
    return;
  }

  div.innerHTML = `
    <table class="tabla" style="margin-top:.5rem;">
      <thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Disponibles</th><th>Precio/día</th><th>Agregar</th></tr></thead>
      <tbody>
        ${encontrados
          .map(
            (p) => `
          <tr>
            <td><code>${p.codigo}</code></td>
            <td>${p.nombre}</td>
            <td>${p.categoria}</td>
            <td><span class="badge badge-success">${p.stock}</span></td>
            <td>$${p.precio.toLocaleString("es-CO")}</td>
            <td><button type="button" class="btn btn-sm btn-primary" onclick='agregarItemAlquiler(${JSON.stringify(p)})'>➕ Agregar</button></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

/**
 * Agrega un artículo a la lista temporal del alquiler.
 */
function agregarItemAlquiler(p) {
  const existente = _itemsAlquiler.find((i) => i.productoId === p.id);

  if (existente) {
    // Si ya existe, pedimos una nueva cantidad
    const nuevaCantidad = parseInt(
      prompt(
        `Ya tienes "${p.nombre}" agregado.\nIngresa la nueva cantidad (máx. ${p.stock}):`,
      ),
      10,
    );

    if (!nuevaCantidad || nuevaCantidad <= 0) {
      alert("Debes ingresar una cantidad válida.");
      return;
    }

    if (nuevaCantidad > p.stock) {
      alert(`Solo hay ${p.stock} unidad(es) disponibles de "${p.nombre}".`);
      return;
    }

    existente.cantidad = nuevaCantidad;
  } else {
    // Si es un producto nuevo, pedimos la cantidad
    const cantidad = parseInt(
      prompt(`Ingrese la cantidad para "${p.nombre}" (máx. ${p.stock}):`),
      10,
    );

    if (!cantidad || cantidad <= 0) {
      alert("Debes ingresar una cantidad válida.");
      return;
    }

    if (cantidad > p.stock) {
      alert(`Solo hay ${p.stock} unidad(es) disponibles de "${p.nombre}".`);
      return;
    }

    _itemsAlquiler.push({
      productoId: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      stockDisponible: p.stock,
      cantidad: cantidad,
      precioAlquiler: p.precio,
    });
  }

  // Renderizamos la tabla y recalculamos totales
  renderizarItemsAlquiler();
  calcularTotalAlquiler();

  // Limpiamos la búsqueda
  document.getElementById("buscar-articulo").value = "";
  document.getElementById("resultado-busqueda-alquiler").innerHTML = "";
}

/**
 * Renderiza la tabla de ítems del alquiler actual e incluye columna subtotal.
 */
function renderizarItemsAlquiler() {
  const tbody = document.getElementById("tbody-items-alquiler");
  if (!tbody) return;
  if (_itemsAlquiler.length === 0) {
    tbody.innerHTML =
      '<tr id="fila-vacia"><td colspan="7" class="text-muted" style="text-align:center;">No hay artículos agregados.</td></tr>';
    calcularTotalAlquiler();
    return;
  }
  tbody.innerHTML = _itemsAlquiler
    .map((item, idx) => {
      const subtotal = item.precioAlquiler * item.cantidad;
      return `
    <tr>
      <td><code>${item.codigo}</code></td>
      <td>${item.nombre}</td>
      <td>${item.stockDisponible}</td>
      <td>
        <input type="number" min="1" max="${item.stockDisponible}" value="${item.cantidad}"
          style="width:70px;" onchange="cambiarCantidadItem(${idx}, this.value)" />
      </td>
      <td>$${item.precioAlquiler.toLocaleString("es-CO")}</td>
      <td>$${subtotal.toLocaleString("es-CO")}</td>
      <td><button type="button" class="btn btn-sm btn-danger" onclick="quitarItemAlquiler(${idx})">🗑️</button></td>
    </tr>`;
    })
    .join("");
  calcularTotalAlquiler();
}

/**
 * Calcula y muestra el resumen de costos del alquiler en curso.
 */
function calcularTotalAlquiler() {
  const garantia = parseFloat(document.getElementById("garantia")?.value) || 0;

  // Calculamos el subtotal de todos los ítems
  const subtotalDia = _itemsAlquiler.reduce(
    (s, i) => s + i.precioAlquiler * i.cantidad,
    0,
  );

  // Restamos la garantía al subtotal
  const totalAlquiler = subtotalDia - garantia;

  // El total a pagar es el valor del alquiler (ya con la garantía restada)
  const totalPagar = totalAlquiler;

  const box = document.getElementById("resumen-costos-box");
  if (!box) return;

  if (_itemsAlquiler.length > 0) {
    box.style.display = "block";
    document.getElementById("res-subtotal").textContent =
      "$" + subtotalDia.toLocaleString("es-CO") + "/día";
    document.getElementById("res-dias").textContent =
      "Se liquida en devolución";
    document.getElementById("res-total-alquiler").textContent =
      "$" + totalAlquiler.toLocaleString("es-CO");
    document.getElementById("res-garantia").textContent =
      "$" + garantia.toLocaleString("es-CO");
    document.getElementById("res-total-pagar").textContent =
      "$" + totalPagar.toLocaleString("es-CO");
  } else {
    box.style.display = "none";
  }
}

/**
 * Cambia la cantidad de un ítem en la lista temporal.
 */
function cambiarCantidadItem(idx, valor) {
  const cant = parseInt(valor);
  if (!cant || cant < 1) return;
  const item = _itemsAlquiler[idx];
  if (cant > item.stockDisponible) {
    alert(`Máximo disponible: ${item.stockDisponible}`);
    renderizarItemsAlquiler();
    return;
  }
  item.cantidad = cant;
}

/**
 * Quita un ítem de la lista temporal del alquiler.
 */
function quitarItemAlquiler(idx) {
  _itemsAlquiler.splice(idx, 1);
  renderizarItemsAlquiler();
}

/**
 * Guarda el registro de alquiler y descuenta el stock.
 */
function guardarAlquiler(event) {
  event.preventDefault();
  const sesion = obtenerSesion();
  const msgDiv = document.getElementById("form-msg");

  if (_itemsAlquiler.length === 0) {
    mostrarAlerta(
      msgDiv,
      "Debes agregar al menos un artículo al alquiler.",
      "error",
    );
    return;
  }

  const cliente = {
    nombre: document.getElementById("cliente-nombre").value.trim(),
    identificacion: document.getElementById("cliente-id").value.trim(),
    telefono: document.getElementById("cliente-tel").value.trim(),
    direccion: document.getElementById("cliente-dir")?.value.trim() || "",
  };
  const garantia = parseFloat(document.getElementById("garantia")?.value) || 0;
  const observaciones = document.getElementById("observaciones").value.trim();

  const subtotalDia = _itemsAlquiler.reduce(
    (s, i) => s + i.precioAlquiler * i.cantidad,
    0,
  );
  const fechaSalidaActual = new Date();
  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const consecutivoDoc = obtenerSiguienteConsecutivoDocumental(alquileres);
  const remisionNumero = formatearNumeroRemision(consecutivoDoc);
  const facturaNumero = formatearNumeroFactura(consecutivoDoc);

  // Verificar stock disponible antes de guardar
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  for (const item of _itemsAlquiler) {
    const prod = productos.find((p) => p.id === item.productoId);
    if (!prod || prod.stock < item.cantidad) {
      mostrarAlerta(
        msgDiv,
        `Stock insuficiente para "${item.nombre}". Disponible: ${prod ? prod.stock : 0}.`,
        "error",
      );
      return;
    }
  }

  // Crear registro de alquiler
  const alquiler = {
    id: Date.now(),
    consecutivoDoc,
    remisionNumero,
    facturaNumero,
    cliente,
    items: _itemsAlquiler.map((i) => ({ ...i })),
    dias: 0,
    garantia,
    subtotalDia,
    totalAlquiler: 0,
    totalPagar: garantia,
    fechaSalida: fechaSalidaActual.toLocaleString("es-CO"),
    fechaSalidaISO: fechaSalidaActual.toISOString(),
    fechaDevolucionEstimada: null,
    estado: "activo",
    fechaDevolucionReal: null,
    fechaDevolucionRealISO: null,
    observaciones,
    registradoPor: sesion ? sesion.username : "desconocido",
  };

  // Descontar stock
  _itemsAlquiler.forEach((item) => {
    const idx = productos.findIndex((p) => p.id === item.productoId);
    if (idx !== -1) productos[idx].stock -= item.cantidad;
  });
  localStorage.setItem(obtenerClaveStorage("productos"), JSON.stringify(productos));

  alquileres.push(alquiler);
  localStorage.setItem(obtenerClaveStorage("alquileres"), JSON.stringify(alquileres));

  mostrarAlerta(
    msgDiv,
    `Alquiler registrado para ${cliente.nombre}. Remisión ${remisionNumero} y factura ${facturaNumero}.`,
    "success",
  );
  exportarDatos();
  _itemsAlquiler = [];
  document.getElementById("form-alquiler").reset();
  renderizarItemsAlquiler();
  cargarAlquileresActivos();
  window.open(`remision_salida.html?id=${alquiler.id}`, "_blank");
  window.scrollTo(0, 0);
}

/**
 * Limpia el formulario de alquiler.
 */
function limpiarFormAlquiler() {
  _itemsAlquiler = [];
  renderizarItemsAlquiler();
  document.getElementById("resultado-busqueda-alquiler").innerHTML = "";
  document.getElementById("form-msg").style.display = "none";
}

/**
 * Muestra los alquileres activos recientes.
 */
function cargarAlquileresActivos() {
  const div = document.getElementById("tabla-alquileres-activos");
  if (!div) return;
  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const activos = alquileres
    .filter((a) => a.estado === "activo")
    .slice()
    .reverse()
    .slice(0, 10);

  if (activos.length === 0) {
    div.innerHTML = '<p class="text-muted">No hay alquileres activos.</p>';
    return;
  }

  div.innerHTML = `
    <table class="tabla">
      <thead><tr><th>ID</th><th>Cliente</th><th>Cédula</th><th>Artículos</th><th>Fecha Salida</th><th>Total</th><th>Estado</th><th>Remisión</th><th>Factura</th></tr></thead>
      <tbody>
        ${activos
          .map(
            (a) => `
          <tr>
            <td><code>${a.id}</code></td>
            <td>${a.cliente.nombre}</td>
            <td>${a.cliente.identificacion}</td>
            <td>${a.items.map((i) => `${i.nombre} (${i.cantidad})`).join(", ")}</td>
            <td>${a.fechaSalida}</td>
            <td>$${(a.totalPagar || 0).toLocaleString("es-CO")}</td>
            <td><span class="badge badge-warning">Activo</span></td>
            <td><a href="remision_salida.html?id=${a.id}" class="btn btn-sm btn-outline" >📄 Remisión</a></td>
            <td><a href="factura_alquiler.html?id=${a.id}" class="btn btn-sm btn-primary" >🧾 Factura</a></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

// -----------------------------------------------
// ALQUILER - DEVOLUCIÓN - alquiler_devolucion.html
// -----------------------------------------------

let _alquilerSeleccionado = null;

/**
 * Inicializa la página de devolución de alquiler.
 */
function initAlquilerDevolucion() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "alquiler_devolucion.html");
  if (
    !sesion.permisos.includes("facturacion") &&
    !sesion.permisos.includes("productos")
  ) {
    mostrarAccesoDenegado("No tienes permiso para registrar devoluciones.");
    return;
  }
  actualizarEstadoCobroGarantiaDevolucion();
  cargarHistorialDevoluciones();
}

/**
 * Activa o desactiva la edición del monto cobrado de garantía en devolución.
 */
function actualizarEstadoCobroGarantiaDevolucion() {
  const check = document.getElementById("aplicar-cobro-garantia");
  const input = document.getElementById("monto-cobro-garantia");
  if (!check || !input) return;

  input.disabled = !check.checked;
  input.classList.toggle("input-readonly", !check.checked);
}

/**
 * Busca alquileres activos por nombre, cédula o ID.
 */
function buscarAlquilerActivo() {
  const texto = (document.getElementById("buscar-alquiler")?.value || "")
    .toLowerCase()
    .trim();
  const div = document.getElementById("tabla-busqueda-alquiler");
  if (!texto) {
    div.innerHTML = "";
    return;
  }

  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const activos = alquileres.filter(
    (a) =>
      a.estado === "activo" &&
      (a.cliente.nombre.toLowerCase().includes(texto) ||
        a.cliente.identificacion.includes(texto) ||
        String(a.id).includes(texto)),
  );

  if (activos.length === 0) {
    div.innerHTML =
      '<p class="text-muted">No se encontraron alquileres activos para esa búsqueda.</p>';
    return;
  }

  div.innerHTML = `
    <table class="tabla" style="margin-top:.5rem;">
      <thead><tr><th>ID</th><th>Cliente</th><th>Cédula</th><th>Artículos</th><th>Salida</th><th>Acción</th></tr></thead>
      <tbody>
        ${activos
          .map(
            (a) => `
          <tr>
            <td><code>${a.id}</code></td>
            <td>${a.cliente.nombre}</td>
            <td>${a.cliente.identificacion}</td>
            <td>${a.items.map((i) => `${i.nombre} (${i.cantidad})`).join(", ")}</td>
            <td>${a.fechaSalida}</td>
            <td><button class="btn btn-sm btn-primary" onclick='seleccionarAlquilerDevolucion(${a.id})'>↩️ Devolver</button></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

/**
 * Selecciona un alquiler para procesar su devolución.
 */
function seleccionarAlquilerDevolucion(id) {
  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  _alquilerSeleccionado = alquileres.find((a) => a.id === id) || null;
  if (!_alquilerSeleccionado) return;

  const seccion = document.getElementById("seccion-devolucion");
  const detalle = document.getElementById("detalle-alquiler");
  const checkGarantia = document.getElementById("aplicar-cobro-garantia");
  const montoGarantia = document.getElementById("monto-cobro-garantia");
  const garantiaBase = parseFloat(_alquilerSeleccionado.garantia) || 0;
  const garantiaCobradaInicial =
    typeof _alquilerSeleccionado.garantiaCobrada === "boolean"
      ? _alquilerSeleccionado.garantiaCobrada
      : garantiaBase > 0;

  detalle.innerHTML = `
    <table class="tabla">
      <tbody>
        <tr><td><strong>ID Alquiler</strong></td><td><code>${_alquilerSeleccionado.id}</code></td></tr>
        <tr><td><strong>Cliente</strong></td><td>${_alquilerSeleccionado.cliente.nombre}</td></tr>
        <tr><td><strong>Cédula/NIT</strong></td><td>${_alquilerSeleccionado.cliente.identificacion}</td></tr>
        <tr><td><strong>Teléfono</strong></td><td>${_alquilerSeleccionado.cliente.telefono || "-"}</td></tr>
        <tr><td><strong>Fecha Salida</strong></td><td>${_alquilerSeleccionado.fechaSalida}</td></tr>
        <tr><td><strong>Garantía registrada</strong></td><td>$${garantiaBase.toLocaleString("es-CO")}</td></tr>
      </tbody>
    </table>
    <h4 style="margin-top:1rem;">Artículos a devolver:</h4>
    <table class="tabla">
      <thead><tr><th>Código</th><th>Nombre</th><th>Cantidad</th><th>Precio/día</th></tr></thead>
      <tbody>
        ${_alquilerSeleccionado.items
          .map(
            (i) => `
          <tr>
            <td><code>${i.codigo}</code></td>
            <td>${i.nombre}</td>
            <td>${i.cantidad}</td>
            <td>$${i.precioAlquiler.toLocaleString("es-CO")}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;

  if (checkGarantia) checkGarantia.checked = garantiaCobradaInicial;
  if (montoGarantia) montoGarantia.value = String(garantiaBase);
  actualizarEstadoCobroGarantiaDevolucion();

  seccion.style.display = "block";
  seccion.scrollIntoView({ behavior: "smooth" });
}

/**
 * Cancela la selección de devolución.
 */
function cancelarDevolucion() {
  _alquilerSeleccionado = null;
  document.getElementById("seccion-devolucion").style.display = "none";
  document.getElementById("obs-devolucion").value = "";
  const checkGarantia = document.getElementById("aplicar-cobro-garantia");
  const montoGarantia = document.getElementById("monto-cobro-garantia");
  if (checkGarantia) checkGarantia.checked = true;
  if (montoGarantia) montoGarantia.value = "0";
  actualizarEstadoCobroGarantiaDevolucion();
}

/**
 * Confirma la devolución: actualiza el alquiler y restaura el stock.
 */
function confirmarDevolucion() {
  if (!_alquilerSeleccionado) return;
  const sesion = obtenerSesion();
  const msgDiv = document.getElementById("dev-msg");
  const observaciones = document.getElementById("obs-devolucion").value.trim();
  const aplicarCobroGarantia =
    document.getElementById("aplicar-cobro-garantia")?.checked === true;
  const montoCobroGarantia = aplicarCobroGarantia
    ? parseFloat(document.getElementById("monto-cobro-garantia")?.value) || 0
    : 0;

  if (montoCobroGarantia < 0) {
    mostrarAlerta(
      msgDiv,
      "El valor de garantía no puede ser negativo.",
      "error",
    );
    return;
  }

  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const idx = alquileres.findIndex((a) => a.id === _alquilerSeleccionado.id);
  if (idx === -1) return;

  const fechaSalidaISO = alquileres[idx].fechaSalidaISO;
  const fechaSalida = fechaSalidaISO ? new Date(fechaSalidaISO) : null;
  const fechaDevolucion = new Date();
  const salidaValida = fechaSalida && !Number.isNaN(fechaSalida.getTime());
  const diferenciaMs = salidaValida
    ? fechaDevolucion.getTime() - fechaSalida.getTime()
    : 0;
  const diasLiquidados = Math.max(
    1,
    Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24)),
  );

  const subtotalDiaBase =
    alquileres[idx].subtotalDia ||
    alquileres[idx].items.reduce(
      (s, i) => s + i.precioAlquiler * i.cantidad,
      0,
    );
  const totalAlquilerBase = subtotalDiaBase * diasLiquidados;
  const garantiaOriginal = alquileres[idx].garantia || 0;
  const garantiaRetenida = aplicarCobroGarantia ? montoCobroGarantia : 0;

  alquileres[idx].totalPagar =
    totalAlquilerBase - (garantiaOriginal - garantiaRetenida);
  alquileres[idx].estado = "devuelto";
  alquileres[idx].dias = diasLiquidados;
  alquileres[idx].totalAlquiler = totalAlquilerBase;
  alquileres[idx].fechaDevolucionReal = fechaDevolucion.toLocaleString("es-CO");
  alquileres[idx].fechaDevolucionRealISO = fechaDevolucion.toISOString();
  alquileres[idx].observacionesDevolucion = observaciones;
  alquileres[idx].garantiaCobrada = aplicarCobroGarantia;
  alquileres[idx].garantia = montoCobroGarantia;
  alquileres[idx].totalPagar =
    totalAlquilerBase - (garantiaOriginal - garantiaRetenida);
  alquileres[idx].devueltoPor = sesion ? sesion.username : "desconocido";
  localStorage.setItem(obtenerClaveStorage("alquileres"), JSON.stringify(alquileres));

  // Restaurar stock
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");
  _alquilerSeleccionado.items.forEach((item) => {
    const pi = productos.findIndex((p) => p.id === item.productoId);
    if (pi !== -1) productos[pi].stock += item.cantidad;
  });
  localStorage.setItem(obtenerClaveStorage("productos"), JSON.stringify(productos));

  mostrarAlerta(
    msgDiv,
    `Devolución del alquiler #${_alquilerSeleccionado.id} registrada correctamente.`,
    "success",
  );

  exportarDatos();

  cancelarDevolucion();
  document.getElementById("buscar-alquiler").value = "";
  document.getElementById("tabla-busqueda-alquiler").innerHTML = "";
  cargarHistorialDevoluciones();
  window.scrollTo(0, 0);
}

/**
 * Carga el historial de devoluciones completadas.
 */
async function cargarHistorialDevoluciones() {
  const div = document.getElementById("tabla-historial-devoluciones");
  if (!div) return;

  try {
    const isTest = obtenerSesion()?.isTest || false;
    const res = await fetch(API_BASE + "/api/alquileres?test=" + isTest);
    const alquileres = await res.json();

    const devueltos = alquileres
      .filter((a) => a.estado === "devuelto")
      .slice()
      .reverse()
      .slice(0, 15);

    if (devueltos.length === 0) {
      div.innerHTML =
        '<p class="text-muted">No hay devoluciones registradas aún.</p>';
      return;
    }

    let html = "<table class='table'>";
    html +=
      "<tr><th>ID</th><th>Cliente</th><th>Artículos</th><th>Salida</th><th>Dev. Real</th><th>Total</th></tr>";

    devueltos.forEach((a) => {
      html += `<tr>
        <td>${a.id}</td>
        <td>${a.cliente?.nombre || ""}</td>
        <td>${a.items.map((i) => `${i.nombre} (${i.cantidad})`).join(", ")}</td>
        <td>${a.fechaSalida}</td>
        <td>${a.fechaDevolucionReal}</td>
        <td>${a.totalPagar}</td>
      </tr>`;
    });

    html += "</table>";
    div.innerHTML = html;
  } catch (err) {
    console.error("❌ Error cargando historial:", err);
    div.innerHTML = '<p class="text-danger">Error cargando historial.</p>';
  }
}

async function cargarProductos() {
  const div = document.getElementById("tabla-productos");
  if (!div) return;

  try {
    const isTest = obtenerSesion()?.isTest || false;
    const res = await fetch(API_BASE + "/api/productos?test=" + isTest);
    const productos = await res.json();

    if (productos.length === 0) {
      div.innerHTML =
        '<p class="text-muted">No hay productos registrados aún.</p>';
      return;
    }

    let html = "<table class='table'>";
    html +=
      "<tr><th>ID</th><th>Código</th><th>Nombre</th><th>Stock</th><th>Precio</th></tr>";

    productos.forEach((p) => {
      html += `<tr>
        <td>${p.id}</td>
        <td>${p.codigo}</td>
        <td>${p.nombre}</td>
        <td>${p.stock}</td>
        <td>${p.precio}</td>
      </tr>`;
    });

    html += "</table>";
    div.innerHTML = html;
  } catch (err) {
    console.error("❌ Error cargando productos:", err);
    div.innerHTML = '<p class="text-danger">Error cargando productos.</p>';
  }
}

// -----------------------------------------------
// FACTURA DE ALQUILER - factura_alquiler.html
// -----------------------------------------------

/**
 * Inicializa la página de factura, carga el alquiler desde URL ?id=
 */
function initFacturaAlquiler() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "");

  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id"));
  const errorDiv = document.getElementById("factura-error");
  const box = document.getElementById("factura-box");

  if (!id) {
    if (errorDiv) errorDiv.style.display = "block";
    return;
  }

  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const a = alquileres.find((x) => x.id === id);

  if (!a) {
    if (errorDiv) errorDiv.style.display = "block";
    return;
  }

  // Rellenar datos de la factura
  const set = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.textContent = val;
  };

  const consecutivoFactura = resolverConsecutivoDesdeAlquiler(a);
  const numeroFactura =
    a.facturaNumero ||
    (consecutivoFactura !== null
      ? formatearNumeroFactura(consecutivoFactura)
      : `FVPA${String(a.id).slice(-5).padStart(5, "0")}`);
  set("fact-numero", numeroFactura);
  set(
    "fact-fecha-emision",
    new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  );
  set("fact-fecha-salida", a.fechaSalida);
  set("fact-fecha-devolucion", a.fechaDevolucionReal || "-");

  const badge = document.getElementById("fact-estado-badge");
  if (badge) {
    badge.textContent = a.estado === "devuelto" ? "DEVUELTO" : "ACTIVO";
    badge.style.background = a.estado === "devuelto" ? "#28a745" : "#0066cc";
  }

  set("fact-cliente-nombre", a.cliente.nombre);
  set("fact-cliente-id", a.cliente.identificacion);
  set("fact-cliente-tel", a.cliente.telefono || "-");
  set("fact-cliente-dir", a.cliente.direccion || "-");
  set("fact-firma-id", a.cliente.identificacion);
  set("fact-registrado-por", a.registradoPor || "-");

  // Ítems
  const dias = a.estado === "devuelto" ? a.dias || 1 : 0;
  const tbody = document.getElementById("fact-items");
  if (tbody) {
    tbody.innerHTML = a.items
      .map(
        (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><code>${item.codigo}</code></td>
        <td>${item.nombre}</td>
        <td style="text-align:center;">${item.cantidad}</td>
        <td style="text-align:right;">$${item.precioAlquiler.toLocaleString("es-CO")}</td>
        <td style="text-align:center;">${dias > 0 ? dias : "—"}</td>
        <td style="text-align:right;">${
          dias > 0
            ? "$" +
              (item.precioAlquiler * item.cantidad * dias).toLocaleString(
                "es-CO",
              )
            : "Pendiente"
        }</td>
      </tr>`,
      )
      .join("");
  }

  const subtotalDia =
    a.subtotalDia ||
    a.items.reduce((s, i) => s + i.precioAlquiler * i.cantidad, 0);
  const totalAlquiler =
    a.estado === "devuelto" ? a.totalAlquiler || subtotalDia * dias : 0;
  const garantiaBase = a.garantia || 0;
  const garantiaCobrada =
    typeof a.garantiaCobrada === "boolean"
      ? a.garantiaCobrada
      : garantiaBase > 0;
  const garantia = garantiaCobrada ? garantiaBase : 0;
  const totalPagar =
    typeof a.totalPagar === "number" ? a.totalPagar : totalAlquiler - garantia;

  set("fact-subtotal", "$" + subtotalDia.toLocaleString("es-CO") + "/día");
  set("fact-dias-label", dias > 0 ? dias : "0");
  set(
    "fact-total-alquiler",
    dias > 0 ? "$" + totalAlquiler.toLocaleString("es-CO") : "Pendiente",
  );
  set("fact-garantia", "$" + garantia.toLocaleString("es-CO"));
  set("fact-total-pagar", "$" + totalPagar.toLocaleString("es-CO"));

  const garantiaRow = document.getElementById("fact-garantia-row");
  if (garantiaRow)
    garantiaRow.style.display = garantiaCobrada ? "table-row" : "none";

  const obsEl = document.getElementById("fact-observaciones");
  if (obsEl) obsEl.textContent = a.observaciones || "Sin observaciones.";
  const obsSection = document.getElementById("factura-obs-section");
  if (obsSection && !a.observaciones) obsSection.style.display = "none";

  if (box) box.style.display = "block";
}

/**
 * Inicializa la página de remisión de salida (soporte físico de entrega).
 */
function initRemisionSalida() {
  const sesion = verificarSesion();
  if (!sesion) return;
  generarSidebar(sesion, "");

  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id"));
  const errorDiv = document.getElementById("remision-error");
  const box = document.getElementById("remision-box");

  if (!id) {
    if (errorDiv) errorDiv.style.display = "block";
    return;
  }

  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const a = alquileres.find((x) => x.id === id);

  if (!a) {
    if (errorDiv) errorDiv.style.display = "block";
    return;
  }

  const set = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.textContent = val;
  };

  const consecutivoRemision = resolverConsecutivoDesdeAlquiler(a);
  const numeroRemision =
    a.remisionNumero ||
    (consecutivoRemision !== null
      ? formatearNumeroRemision(consecutivoRemision)
      : `REM${String(a.id).slice(-5).padStart(5, "0")}`);
  set("rem-numero", numeroRemision);
  set(
    "rem-fecha-emision",
    new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  );
  set("rem-fecha-salida", a.fechaSalida || "-");

  set("rem-cliente-nombre", a.cliente.nombre);
  set("rem-cliente-id", a.cliente.identificacion);
  set("rem-cliente-tel", a.cliente.telefono || "-");
  set("rem-cliente-dir", a.cliente.direccion || "-");
  set("rem-firma-id", a.cliente.identificacion);
  set("rem-registrado-por", a.registradoPor || "-");

  const tbody = document.getElementById("rem-items");
  if (tbody) {
    tbody.innerHTML = a.items
      .map(
        (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><code>${item.codigo}</code></td>
        <td>${item.nombre}</td>
        <td style="text-align:center;">${item.cantidad}</td>
        <td style="text-align:right;">$${item.precioAlquiler.toLocaleString("es-CO")}</td>
        <td style="text-align:right;">$${(item.precioAlquiler * item.cantidad).toLocaleString("es-CO")}</td>
      </tr>`,
      )
      .join("");
  }

  const subtotalDia =
    a.subtotalDia ||
    a.items.reduce((s, i) => s + i.precioAlquiler * i.cantidad, 0);
  const garantia = a.garantia || 0;

  set("rem-subtotal-dia", "$" + subtotalDia.toLocaleString("es-CO"));
  set("rem-garantia", "$" + garantia.toLocaleString("es-CO"));
  set("rem-total-salida", "$" + garantia.toLocaleString("es-CO"));

  const obsEl = document.getElementById("rem-observaciones");
  if (obsEl) obsEl.textContent = a.observaciones || "Sin observaciones.";
  const obsSection = document.getElementById("rem-obs-section");
  if (obsSection && !a.observaciones) obsSection.style.display = "none";

  if (box) box.style.display = "block";
}

// -----------------------------------------------
// UTILIDADES COMPARTIDAS
// -----------------------------------------------

/**
 * Muestra un mensaje de alerta en un elemento dado.
 * @param {HTMLElement} el - Elemento donde mostrar la alerta.
 * @param {string} msg - Mensaje a mostrar.
 * @param {'success'|'error'} tipo - Tipo de alerta.
 */
function mostrarAlerta(el, msg, tipo) {
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${tipo === "error" ? "error" : "success"}`;
  el.style.display = "block";
}

/**
 * Verifica si un item de menú es accesible para la sesión dada.
 */
function tieneAcceso(item, sesion) {
  return (
    item.always ||
    (item.permiso && sesion.permisos.includes(item.permiso)) ||
    (item.soloRol && sesion.role === item.soloRol)
  );
}

/**
 * Genera el menú lateral (sidebar) dinámicamente según los permisos del rol.
 * @param {object} sesion - Objeto de sesión con role y permisos.
 * @param {string} paginaActual - href de la página activa.
 */
function generarSidebar(sesion, paginaActual) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const menuItems = [
    { label: "🏠 Inicio", href: "index.html", always: true },
    {
      label: "📋 Ver Inventario",
      href: "productos_visualizacion.html",
      permiso: "productos",
    },
    {
      label: "➕ Ingresar Artículo",
      href: "productos_ingreso.html",
      permiso: "productos",
    },
    {
      label: "✏️ Editar Artículo",
      href: "productos_edicion.html",
      permiso: "productos",
    },
    {
      label: "🗑️ Eliminar Artículo",
      href: "productos_eliminacion.html",
      soloRol: "admin",
    },
    {
      label: "📤 Salida por Alquiler",
      href: "alquiler_salida.html",
      permiso: "facturacion",
    },
    {
      label: "↩️ Devolución Alquiler",
      href: "alquiler_devolucion.html",
      permiso: "facturacion",
    },
    {
      label: "\ud83d\udcca Reportes",
      href: "reportes.html",
      permiso: "reportes",
    },
    { label: "👥 Registrar Usuario", href: "registro.html", soloRol: "admin" },
    { label: "⚙️ Gestionar Usuarios", href: "admin_usuarios.html", soloRol: "admin" },
  ];

  const ul = document.createElement("ul");
  menuItems.forEach((item) => {
    if (!tieneAcceso(item, sesion)) return;
    const li = document.createElement("li");
    li.textContent = item.label;
    if (item.href === paginaActual) li.classList.add("active");
    li.onclick = () => {
      window.location.href = item.href;
    };
    ul.appendChild(li);
  });
  sidebar.innerHTML = "";
  sidebar.appendChild(ul);
}

// -----------------------------------------------
// SINCRONIZACIÓN CON MONGODB ATLAS
// -----------------------------------------------

function mostrarEstadoMongo(mensaje, tipo = "info") {
  const el = document.getElementById("mongo-estado");
  if (!el) return;

  const clase =
    tipo === "ok"
      ? "badge-success"
      : tipo === "error"
        ? "badge-danger"
        : "badge-warning";

  el.className = `badge ${clase}`;
  el.textContent = mensaje;
}

function formatearTiempoRelativo(fecha) {
  const ahora = Date.now();
  const diffMs = Math.max(0, ahora - fecha.getTime());
  const segundos = Math.floor(diffMs / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (segundos < 60) return "hace unos segundos";
  if (minutos < 60) return `hace ${minutos} min`;
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${dias} d`;
}

function actualizarUltimaSincronizacion(fecha = new Date()) {
  const el = document.getElementById("mongo-ultima-sync");
  const fechaValida = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(fechaValida.getTime())) return;

  const textoBase = fechaValida.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const texto = `${textoBase} (${formatearTiempoRelativo(fechaValida)})`;

  if (el) el.textContent = texto;
  localStorage.setItem("mongoUltimaSync", fechaValida.toISOString());
}

function cargarUltimaSincronizacionGuardada() {
  const guardada = localStorage.getItem("mongoUltimaSync");
  if (!guardada) return;
  actualizarUltimaSincronizacion(new Date(guardada));
}

async function verificarConexionMongo() {
  try {
    const res = await fetch(API_BASE + "/api/health");
    if (!res.ok) throw new Error("No disponible");
    mostrarEstadoMongo("Conectado", "ok");
  } catch (err) {
    mostrarEstadoMongo("Sin conexion", "error");
  }
}

/**
 * Exporta todos los datos de localStorage a MongoDB Atlas.
 */
async function exportarDatos() {
  const alquileres = JSON.parse(localStorage.getItem(obtenerClaveStorage("alquileres")) || "[]");
  const productos = JSON.parse(localStorage.getItem(obtenerClaveStorage("productos")) || "[]");

  try {
    const res = await fetch(API_BASE + "/api/exportar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alquileres, productos, test: obtenerSesion()?.isTest || false }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "No se pudo sincronizar con Mongo");
    }

    const data = await res.json();
    console.log("✅ Datos sincronizados con Mongo:", data);
    mostrarEstadoMongo("Sincronizado", "ok");
    actualizarUltimaSincronizacion();
    return data;
  } catch (err) {
    console.error("❌ Error sincronizando con MongoDB:", err);
    mostrarEstadoMongo("Error de sincronizacion", "error");
    throw err;
  }
}

/**
 * Carga datos desde MongoDB Atlas hacia localStorage.
 */
async function cargarDatosDesdeMongo() {
  try {
    const isTest = obtenerSesion()?.isTest || false;
    const productosRes = await fetch(API_BASE + "/api/productos?test=" + isTest);
    if (!productosRes.ok) throw new Error("Error cargando productos");
    const productos = await productosRes.json();

    const alquileresRes = await fetch(API_BASE + "/api/alquileres?test=" + isTest);
    if (!alquileresRes.ok) throw new Error("Error cargando alquileres");
    const alquileres = await alquileresRes.json();

    if (Array.isArray(productos)) {
      localStorage.setItem(obtenerClaveStorage("productos"), JSON.stringify(productos));
      console.log("📦 Productos cargados desde Mongo:", productos.length);
    }
    if (Array.isArray(alquileres)) {
      localStorage.setItem(obtenerClaveStorage("alquileres"), JSON.stringify(alquileres));
      console.log("📄 Alquileres cargados desde Mongo:", alquileres.length);

      // Si no hay historial, reiniciamos el consecutivo documental para empezar en 00000.
      if (alquileres.length === 0) {
        localStorage.removeItem(obtenerClaveStorage("consecutivoDocumental"));
      }
    }

    mostrarEstadoMongo("Datos cargados", "ok");
    actualizarUltimaSincronizacion();
  } catch (err) {
    console.error("❌ Error cargando desde MongoDB:", err);
    mostrarEstadoMongo("Error al cargar", "error");
    throw err;
  }
}
