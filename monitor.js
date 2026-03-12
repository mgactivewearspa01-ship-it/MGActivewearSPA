function resolveApiBase(){
  const rawDataset = document.body?.dataset?.apiBase?.trim() || "";
  const fromDataset =
    rawDataset && !rawDataset.includes("{{") && !rawDataset.includes("}}")
      ? rawDataset
      : "";
  if(fromDataset){
    return fromDataset.replace(/\/+$/, "");
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramBase = (urlParams.get("apiBase") || "").trim();
  if(paramBase){
    const cleaned = paramBase.replace(/\/+$/, "");
    localStorage.setItem("mg_api_base", cleaned);
    return cleaned;
  }

  const stored = (localStorage.getItem("mg_api_base") || "").trim();
  if(stored){
    return stored.replace(/\/+$/, "");
  }

  if(window.location.protocol === "file:"){
    return "";
  }
  const origin = window.location.origin || "";
  return origin === "null" ? "" : origin;
}

const API_BASE = resolveApiBase();
const POLL_MS = 30 * 60 * 1000;
const AUTH_STORAGE_KEY = "mg_admin_auth";
let lastOrders = [];

const refs = {
  nuevo: document.getElementById("nuevo"),
  proceso: document.getElementById("proceso"),
  listo: document.getElementById("listo"),
  countNuevo: document.getElementById("countNuevo"),
  countProceso: document.getElementById("countProceso"),
  countListo: document.getElementById("countListo"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
  lastUpdate: document.getElementById("lastUpdate"),
  errorBox: document.getElementById("errorBox"),
  apiStatus: document.getElementById("apiStatus"),
  apiDot: document.getElementById("apiDot"),
  apiLabel: document.getElementById("apiLabel"),
  kpiTotalOrders: document.getElementById("kpiTotalOrders"),
  kpiRevenue: document.getElementById("kpiRevenue"),
  kpiAvg: document.getElementById("kpiAvg"),
  kpiDoneToday: document.getElementById("kpiDoneToday"),
};

function formatDate(iso){
  if(!iso) return "Sin fecha";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString("es-PA");
}

function formatFileStamp(date){
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function computeKpisData(data){
  const totalOrders = data.length;
  const revenue = data.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const avg = totalOrders ? revenue / totalOrders : 0;

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const doneToday = data.filter(order => {
    if((order.status || "nuevo") !== "listo") return false;
    const dt = new Date(order.updatedAt || order.fecha || order.createdAt || 0);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  }).length;

  return { totalOrders, revenue, avg, doneToday };
}

function toCsvValue(value){
  if(value === null || value === undefined) return "";
  const str = String(value);
  if(/[\";\n]/.test(str)){
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildReportCsv(data){
  const now = new Date();
  const kpis = computeKpisData(data);
  const lines = [];

  lines.push("Reporte de pedidos");
  lines.push(`Generado: ${now.toLocaleString("es-PA")}`);
  lines.push(`Pedidos totales: ${kpis.totalOrders}`);
  lines.push(`Ventas totales: $${kpis.revenue.toFixed(2)}`);
  lines.push(`Ticket promedio: $${kpis.avg.toFixed(2)}`);
  lines.push(`Listos hoy: ${kpis.doneToday}`);
  lines.push("");

  const header = [
    "ID Pedido",
    "Fecha",
    "Estado",
    "Cliente",
    "Telefono",
    "Email",
    "Direccion",
    "Metodo de pago",
    "Notas",
    "Total",
    "Item",
    "Cantidad",
    "Precio",
    "Talla",
    "Color",
    "Imagen"
  ];
  lines.push(header.map(toCsvValue).join(";"));

  data.forEach(order => {
    const base = [
      order._id || order.id || "",
      formatDate(order.fecha || order.createdAt),
      order.status || "nuevo",
      order?.cliente?.name || "",
      order?.cliente?.phone || "",
      order?.cliente?.email || "",
      order?.cliente?.address || "",
      order?.cliente?.paymentMethod || "",
      order?.cliente?.notes || "",
      Number(order.total || 0).toFixed(2)
    ];

    const items = Array.isArray(order.productos) ? order.productos : [];
    if(items.length === 0){
      lines.push([...base, "", "", "", "", "", ""].map(toCsvValue).join(";"));
      return;
    }
    items.forEach(item => {
      const row = [
        ...base,
        item?.name || "",
        item?.quantity || 0,
        Number(item?.price || 0).toFixed(2),
        item?.size || "",
        item?.color || "",
        item?.image || ""
      ];
      lines.push(row.map(toCsvValue).join(";"));
    });
  });

  return `\uFEFF${lines.join("\n")}`;
}

function downloadCsv(csv, filename){
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function getStoredAuth(){
  return (localStorage.getItem(AUTH_STORAGE_KEY) || "").trim();
}

function buildAuthHeader(user, pass){
  return "Basic " + btoa(`${user}:${pass}`);
}

async function fetchWithAuth(url, options = {}){
  const headers = new Headers(options.headers || {});
  const stored = getStoredAuth();
  if(stored){
    headers.set("Authorization", stored);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include"
  });

  if(response.status !== 401){
    return response;
  }

  const user = window.prompt("Usuario del monitor:");
  if(!user) return response;
  const pass = window.prompt("Contraseña del monitor:");
  if(pass === null) return response;

  const auth = buildAuthHeader(user, pass);
  localStorage.setItem(AUTH_STORAGE_KEY, auth);
  headers.set("Authorization", auth);

  return await fetch(url, {
    ...options,
    headers,
    credentials: "include"
  });
}

function clearColumn(columnEl){
  const nodes = Array.from(columnEl.querySelectorAll(".card,.empty"));
  nodes.forEach(node => node.remove());
}

function ensureEmpty(columnEl){
  if(!columnEl.querySelector(".card")){
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Sin pedidos";
    columnEl.appendChild(p);
  }
}

function buildCard(order){
  const card = document.createElement("article");
  card.className = "card";

  const status = order.status || "nuevo";
  const statusMap = {
    nuevo: "NUEVO",
    proceso: "EN PROCESO",
    listo: "LISTO"
  };

  const top = document.createElement("div");
  top.className = "card-top";

  const title = document.createElement("h3");
  title.textContent = order?.cliente?.name || "Cliente sin nombre";

  const tag = document.createElement("span");
  tag.className = "status-tag";
  tag.textContent = statusMap[status] || "NUEVO";

  top.appendChild(title);
  top.appendChild(tag);

  const total = document.createElement("p");
  total.textContent = `Total: $${Number(order.total || 0).toFixed(2)}`;

  const phone = document.createElement("p");
  phone.textContent = `Tel: ${order?.cliente?.phone || "N/A"}`;

  const payment = document.createElement("p");
  payment.textContent = `Pago: ${order?.cliente?.paymentMethod || "N/A"}`;

  const items = document.createElement("span");
  items.className = "items-chip";
  const itemsCount = Array.isArray(order.productos) ? order.productos.length : 0;
  items.textContent = `${itemsCount} item(s)`;

  const created = document.createElement("p");
  created.textContent = `Creado: ${formatDate(order.fecha || order.createdAt)}`;

  const detailBox = document.createElement("div");
  detailBox.className = "details";
  detailBox.hidden = true;

  const itemsList = document.createElement("ul");
  const detailItems = Array.isArray(order.productos) ? order.productos : [];
  if(detailItems.length === 0){
    const li = document.createElement("li");
    li.textContent = "Sin items registrados.";
    itemsList.appendChild(li);
  } else {
    detailItems.forEach(item => {
      const li = document.createElement("li");
      const sizeLabel = item?.size ? `Talla: ${item.size}` : "Talla: -";
      const colorLabel = item?.color ? `Color: ${item.color}` : "Color: -";
      li.textContent = `${item?.name || "Item"} x${item?.quantity || 1} | ${sizeLabel} | ${colorLabel}`;
      itemsList.appendChild(li);
    });
  }
  detailBox.appendChild(itemsList);

  const actions = document.createElement("div");
  actions.className = "actions";

  if(status === "nuevo"){
    actions.appendChild(createActionButton("Procesar", "btn-process", () => cambiarEstado(order._id, "proceso")));
  }

  if(status === "proceso"){
    actions.appendChild(createActionButton("Pasar a listo", "btn-to-ready", () => cambiarEstado(order._id, "listo")));
  }

  if(status === "listo"){
    actions.appendChild(createActionButton("Volver a proceso", "btn-work", () => cambiarEstado(order._id, "proceso")));
  }

  const detailBtn = createActionButton("Ver detalle", "btn-detail", () => {
    detailBox.hidden = !detailBox.hidden;
    detailBtn.textContent = detailBox.hidden ? "Ver detalle" : "Ocultar detalle";
  });
  actions.appendChild(detailBtn);

  actions.appendChild(createActionButton("Eliminar", "btn-delete", () => eliminarPedido(order._id)));

  card.appendChild(top);
  card.appendChild(total);
  card.appendChild(phone);
  card.appendChild(payment);
  card.appendChild(items);
  card.appendChild(created);
  card.appendChild(detailBox);
  card.appendChild(actions);
  return card;
}

function createActionButton(label, className, onClick){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function setError(message){
  if(!message){
    refs.errorBox.hidden = true;
    refs.errorBox.textContent = "";
    return;
  }
  refs.errorBox.hidden = false;
  refs.errorBox.textContent = message;
}

function setApiConnection(isOnline){
  refs.apiDot.classList.toggle("online", isOnline);
  refs.apiLabel.textContent = isOnline ? "Conectado" : "Sin conexión";
}

function calculateKpis(data){
  const totalOrders = data.length;
  const revenue = data.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const avg = totalOrders ? (revenue / totalOrders) : 0;

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const doneToday = data.filter(order => {
    if((order.status || "nuevo") !== "listo") return false;
    const dt = new Date(order.updatedAt || order.fecha || order.createdAt || 0);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  }).length;

  refs.kpiTotalOrders.textContent = String(totalOrders);
  refs.kpiRevenue.textContent = `$${revenue.toFixed(2)}`;
  refs.kpiAvg.textContent = `$${avg.toFixed(2)}`;
  refs.kpiDoneToday.textContent = String(doneToday);
}

async function fetchPedidos(){
  if(!API_BASE){
    setApiConnection(false);
    throw new Error("No se puede conectar desde un archivo local. Abre el monitor desde el servidor (http://localhost:3000/monitor) o usa ?apiBase=http://localhost:3000.");
  }

  const res = await fetchWithAuth(`${API_BASE}/orders`);
  if(!res.ok){
    if(res.status === 401) throw new Error("Credenciales inválidas.");
    throw new Error("No se pudo leer /orders");
  }
  return await res.json();
}

async function cargarPedidos(){
  refs.refreshBtn.disabled = true;
  if(refs.exportBtn){
    refs.exportBtn.disabled = true;
  }
  setError("");
  try{
    const data = await fetchPedidos();
    setApiConnection(true);
    lastOrders = Array.isArray(data) ? data : [];

    clearColumn(refs.nuevo);
    clearColumn(refs.proceso);
    clearColumn(refs.listo);

    let nNuevo = 0;
    let nProceso = 0;
    let nListo = 0;

    data.forEach(order => {
      const status = order.status || "nuevo";
      const card = buildCard(order);
      if(status === "proceso"){
        refs.proceso.appendChild(card);
        nProceso += 1;
      } else if(status === "listo"){
        refs.listo.appendChild(card);
        nListo += 1;
      } else {
        refs.nuevo.appendChild(card);
        nNuevo += 1;
      }
    });

    ensureEmpty(refs.nuevo);
    ensureEmpty(refs.proceso);
    ensureEmpty(refs.listo);

    refs.countNuevo.textContent = String(nNuevo);
    refs.countProceso.textContent = String(nProceso);
    refs.countListo.textContent = String(nListo);
    calculateKpis(lastOrders);
    refs.lastUpdate.textContent = `Actualizado: ${new Date().toLocaleTimeString("es-PA")}`;
  } catch(_err){
    setApiConnection(false);
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo cargar pedidos. Verifica que el backend esté activo en puerto 3000.";
    setError(msg);
  } finally {
    refs.refreshBtn.disabled = false;
    if(refs.exportBtn){
      refs.exportBtn.disabled = false;
    }
  }
}

async function cambiarEstado(id, status){
  setError("");
  try{
    if(!API_BASE){
      setApiConnection(false);
      setError("No se puede conectar al servidor. Abre el monitor desde http://localhost:3000/monitor.");
      return;
    }
    const res = await fetchWithAuth(`${API_BASE}/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if(!res.ok){
      if(res.status === 401) throw new Error("Credenciales inválidas.");
      throw new Error("No se pudo actualizar estado");
    }
    await cargarPedidos();
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo actualizar el estado del pedido.";
    setError(msg);
  }
}

async function eliminarPedido(id){
  const ok = window.confirm("¿Seguro que quieres eliminar este pedido?");
  if(!ok) return;

  setError("");
  try{
    if(!API_BASE){
      setApiConnection(false);
      setError("No se puede conectar al servidor. Abre el monitor desde http://localhost:3000/monitor.");
      return;
    }
    const res = await fetchWithAuth(`${API_BASE}/orders/${id}`, {
      method: "DELETE"
    });
    if(!res.ok){
      if(res.status === 401) throw new Error("Credenciales inválidas.");
      throw new Error("No se pudo eliminar");
    }
    await cargarPedidos();
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo eliminar el pedido.";
    setError(msg);
  }
}

async function exportarPedidos(){
  setError("");
  if(refs.exportBtn){
    refs.exportBtn.disabled = true;
  }
  try{
    const data = await fetchPedidos();
    lastOrders = Array.isArray(data) ? data : [];
    if(lastOrders.length === 0){
      setError("No hay pedidos para exportar.");
      return;
    }
    const csv = buildReportCsv(lastOrders);
    const filename = `reporte_pedidos_${formatFileStamp(new Date())}.csv`;
    downloadCsv(csv, filename);
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo exportar el informe.";
    setError(msg);
  } finally {
    if(refs.exportBtn){
      refs.exportBtn.disabled = false;
    }
  }
}

refs.refreshBtn.addEventListener("click", cargarPedidos);
if(refs.exportBtn){
  refs.exportBtn.addEventListener("click", exportarPedidos);
}
cargarPedidos();
setInterval(cargarPedidos, POLL_MS);
