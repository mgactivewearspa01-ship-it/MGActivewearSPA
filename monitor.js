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
const MONITOR_VIEW_KEY = "mg_monitor_view";
let lastOrders = [];
let inventoryItems = [];

const refs = {
  ordersView: document.getElementById("ordersView"),
  productsView: document.getElementById("productsView"),
  showOrdersViewBtn: document.getElementById("showOrdersViewBtn"),
  showProductsViewBtn: document.getElementById("showProductsViewBtn"),
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
  inventoryGrid: document.getElementById("inventoryGrid"),
  inventorySearch: document.getElementById("inventorySearch"),
  inventoryRefreshBtn: document.getElementById("inventoryRefreshBtn"),
  inventoryMsg: document.getElementById("inventoryMsg"),
  inventoryCount: document.getElementById("inventoryCount"),
  inventoryUnits: document.getElementById("inventoryUnits"),
  newProductName: document.getElementById("newProductName"),
  newProductType: document.getElementById("newProductType"),
  newProductCategory: document.getElementById("newProductCategory"),
  newProductPrice: document.getElementById("newProductPrice"),
  newProductStock: document.getElementById("newProductStock"),
  newProductImage1: document.getElementById("newProductImage1"),
  newProductImage2: document.getElementById("newProductImage2"),
  newProductImage3: document.getElementById("newProductImage3"),
  newProductImage4: document.getElementById("newProductImage4"),
  newProductColors: document.getElementById("newProductColors"),
  newProductSizes: document.getElementById("newProductSizes"),
  inventoryCreateBtn: document.getElementById("inventoryCreateBtn"),
};

function setActiveMonitorView(view){
  const nextView = view === "products" ? "products" : "orders";
  const isProducts = nextView === "products";

  if(refs.ordersView){
    refs.ordersView.hidden = isProducts;
  }
  if(refs.productsView){
    refs.productsView.hidden = !isProducts;
  }
  if(refs.showOrdersViewBtn){
    refs.showOrdersViewBtn.classList.toggle("active", !isProducts);
    refs.showOrdersViewBtn.setAttribute("aria-pressed", String(!isProducts));
  }
  if(refs.showProductsViewBtn){
    refs.showProductsViewBtn.classList.toggle("active", isProducts);
    refs.showProductsViewBtn.setAttribute("aria-pressed", String(isProducts));
  }

  localStorage.setItem(MONITOR_VIEW_KEY, nextView);
}

function getInitialMonitorView(){
  const urlParams = new URLSearchParams(window.location.search);
  const requested = (urlParams.get("view") || "").trim().toLowerCase();
  if(requested === "products" || requested === "orders"){
    return requested;
  }

  const stored = (localStorage.getItem(MONITOR_VIEW_KEY) || "").trim().toLowerCase();
  if(stored === "products" || stored === "orders"){
    return stored;
  }
  return "orders";
}

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
  tag.className = `status-tag status-${status}`;
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
    detailBtn.setAttribute("aria-expanded", String(!detailBox.hidden));
  });
  detailBtn.setAttribute("aria-expanded", "false");
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

function setInventoryMessage(message, isError = false){
  if(!refs.inventoryMsg) return;
  if(!message){
    refs.inventoryMsg.hidden = true;
    refs.inventoryMsg.textContent = "";
    refs.inventoryMsg.className = "muted inventory-msg";
    return;
  }
  refs.inventoryMsg.hidden = false;
  refs.inventoryMsg.textContent = message;
  refs.inventoryMsg.className = isError ? "inventory-msg error" : "muted inventory-msg";
}

function getInventoryStatus(stock){
  if(stock <= 0){
    return { label: "Agotado", className: "inventory-status out" };
  }
  if(stock <= 4){
    return { label: `Bajo stock (${stock})`, className: "inventory-status low" };
  }
  return { label: `Disponible (${stock})`, className: "inventory-status" };
}

function normalizeList(value){
  if(Array.isArray(value)){
    return value
      .map(item => String(item || "").trim())
      .filter(Boolean);
  }
  if(typeof value === "string"){
    return value
      .split(/\r?\n|,/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function listToTextarea(value){
  return normalizeList(value).join("\n");
}

function sortInventoryItems(items){
  return [...items].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "es"));
}

function resetInventoryCreateForm(){
  if(refs.newProductName) refs.newProductName.value = "";
  if(refs.newProductType) refs.newProductType.value = "fitness";
  if(refs.newProductCategory) refs.newProductCategory.value = "";
  if(refs.newProductPrice) refs.newProductPrice.value = "";
  if(refs.newProductStock) refs.newProductStock.value = "";
  [refs.newProductImage1, refs.newProductImage2, refs.newProductImage3, refs.newProductImage4].forEach(input => {
    if(input) input.value = "";
  });
  if(refs.newProductColors) refs.newProductColors.value = "";
  if(refs.newProductSizes) refs.newProductSizes.value = "";
}

function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file?.name || "imagen",
      dataUrl: typeof reader.result === "string" ? reader.result : ""
    });
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

async function filesToUploads(fileList){
  const files = Array.from(fileList || []).filter(file => file && file.type.startsWith("image/"));
  if(files.length === 0) return [];
  return await Promise.all(files.map(file => fileToDataUrl(file)));
}

async function fileInputsToUploads(inputs){
  const uploads = [];
  for(const input of inputs || []){
    if(!input?.files?.length) continue;
    const batch = await filesToUploads(input.files);
    uploads.push(...batch);
  }
  return uploads;
}

function renderInventory(){
  if(!refs.inventoryGrid) return;
  const query = (refs.inventorySearch?.value || "").trim().toLowerCase();
  const filtered = inventoryItems.filter(item =>
    !query || (item.name || "").toLowerCase().includes(query)
  );

  if(refs.inventoryCount){
    refs.inventoryCount.textContent = String(filtered.length);
  }
  if(refs.inventoryUnits){
    const totalUnits = filtered.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
    refs.inventoryUnits.textContent = String(totalUnits);
  }

  refs.inventoryGrid.replaceChildren();
  if(filtered.length === 0){
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = query ? "Sin coincidencias en inventario" : "Sin inventario";
    refs.inventoryGrid.appendChild(empty);
    return;
  }

  filtered.forEach(item => {
    const stock = Math.max(0, Number(item.stock) || 0);
    const price = Number(item.price) || 0;
    const card = document.createElement("article");
    card.className = "inventory-card";

    const title = document.createElement("h3");
    title.textContent = item.name || "Producto sin nombre";

    const meta = document.createElement("p");
    meta.className = "inventory-meta";
    meta.textContent = item.updatedAt
      ? `Actualizado: ${formatDate(item.updatedAt)}`
      : "Sin actualización";

    const status = document.createElement("span");
    const statusInfo = getInventoryStatus(stock);
    status.className = statusInfo.className;
    status.textContent = statusInfo.label;

    const row = document.createElement("div");
    row.className = "inventory-row";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(stock);
    input.className = "inventory-stock";
    input.setAttribute("aria-label", `Stock de ${item.name}`);

    const fields = document.createElement("div");
    fields.className = "inventory-fields";

    const typeField = document.createElement("div");
    typeField.className = "inventory-field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Tipo";
    const typeInput = document.createElement("select");
    typeInput.className = "inventory-text";
    ["fitness", "beauty"].forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "fitness" ? "Fitness" : "Belleza";
      typeInput.appendChild(option);
    });
    typeInput.value = item.productType === "beauty" ? "beauty" : "fitness";
    typeField.appendChild(typeLabel);
    typeField.appendChild(typeInput);

    const categoryField = document.createElement("div");
    categoryField.className = "inventory-field";
    const categoryLabel = document.createElement("label");
    categoryLabel.textContent = "Categoría";
    const categoryInput = document.createElement("input");
    categoryInput.type = "text";
    categoryInput.className = "inventory-text";
    categoryInput.value = item.categoryLabel || "";
    categoryInput.placeholder = "Leggings, Skincare, Sets...";
    categoryField.appendChild(categoryLabel);
    categoryField.appendChild(categoryInput);

    const priceField = document.createElement("div");
    priceField.className = "inventory-field";
    const priceLabel = document.createElement("label");
    priceLabel.textContent = "Precio";
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.className = "inventory-text";
    priceInput.value = price ? String(price) : "";
    priceInput.placeholder = "0.00";
    priceField.appendChild(priceLabel);
    priceField.appendChild(priceInput);

    const photoField = document.createElement("div");
    photoField.className = "inventory-field";
    const photoLabel = document.createElement("label");
    photoLabel.textContent = "Fotos";
    const photoInputs = Array.from({ length: 4 }, (_, index) => {
      const inputEl = document.createElement("input");
      inputEl.type = "file";
      inputEl.accept = "image/*";
      inputEl.className = "inventory-text";
      inputEl.setAttribute("aria-label", `Foto ${index + 1} de ${item.name}`);
      return inputEl;
    });
    const currentPhotos = document.createElement("p");
    currentPhotos.className = "inventory-hint";
    currentPhotos.textContent = Array.isArray(item.imageUrls) && item.imageUrls.length
      ? `Fotos actuales: ${item.imageUrls.map(url => url.split("/").pop()).join(", ")}`
      : "Sin fotos cargadas";
    const photoHint = document.createElement("p");
    photoHint.className = "inventory-hint";
    photoHint.textContent = "Puedes subir hasta 4 fotos nuevas para reemplazar las actuales.";
    photoField.appendChild(photoLabel);
    photoInputs.forEach(inputEl => photoField.appendChild(inputEl));
    photoField.appendChild(currentPhotos);
    photoField.appendChild(photoHint);

    const colorField = document.createElement("div");
    colorField.className = "inventory-field";
    const colorLabel = document.createElement("label");
    colorLabel.textContent = "Colores";
    const colorInput = document.createElement("input");
    colorInput.type = "text";
    colorInput.className = "inventory-text";
    colorInput.value = normalizeList(item.colors).join(", ");
    colorInput.placeholder = "Beige, Negro, Rosa";
    colorField.appendChild(colorLabel);
    colorField.appendChild(colorInput);

    const sizeField = document.createElement("div");
    sizeField.className = "inventory-field";
    const sizeLabel = document.createElement("label");
    sizeLabel.textContent = "Tallas";
    const sizeInput = document.createElement("input");
    sizeInput.type = "text";
    sizeInput.className = "inventory-text";
    sizeInput.value = normalizeList(item.sizes).join(", ");
    sizeInput.placeholder = "S, M, L, XL";
    sizeField.appendChild(sizeLabel);
    sizeField.appendChild(sizeInput);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "inventory-save";
    saveBtn.textContent = "Guardar cambios";
    saveBtn.addEventListener("click", async () => {
      try{
        const nextStock = Number.parseInt(input.value, 10);
        const uploadedImages = await fileInputsToUploads(photoInputs);
        await guardarInventario(item.name, {
          stock: nextStock,
          productType: typeInput.value,
          categoryLabel: categoryInput.value.trim(),
          price: Number(priceInput.value),
          uploadedImages,
          colors: normalizeList(colorInput.value),
          sizes: normalizeList(sizeInput.value),
        });
      } catch(_err){
        setInventoryMessage("No se pudo leer una de las imágenes seleccionadas.", true);
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inventory-delete";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", async () => {
      await eliminarInventario(item.name);
    });

    fields.appendChild(typeField);
    fields.appendChild(categoryField);
    fields.appendChild(priceField);
    fields.appendChild(photoField);
    fields.appendChild(colorField);
    fields.appendChild(sizeField);
    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(deleteBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(status);
    card.appendChild(fields);
    card.appendChild(row);
    refs.inventoryGrid.appendChild(card);
  });
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

async function fetchInventario(){
  if(!API_BASE){
    throw new Error("No se puede conectar al inventario desde un archivo local.");
  }

  const res = await fetchWithAuth(`${API_BASE}/api/catalog-stock`);
  if(!res.ok){
    if(res.status === 401) throw new Error("Credenciales inválidas.");
    throw new Error("No se pudo leer /api/catalog-stock");
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

async function cargarInventario(){
  if(refs.inventoryRefreshBtn){
    refs.inventoryRefreshBtn.disabled = true;
  }
  setInventoryMessage("");
  try{
    const data = await fetchInventario();
    inventoryItems = sortInventoryItems(Array.isArray(data) ? data : []);
    renderInventory();
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo cargar el inventario.";
    setInventoryMessage(msg, true);
  } finally {
    if(refs.inventoryRefreshBtn){
      refs.inventoryRefreshBtn.disabled = false;
    }
  }
}

async function guardarInventario(name, payload){
  if(!name) return;
  const stock = Number.parseInt(payload?.stock, 10);
  const price = Number(payload?.price);
  if(!Number.isFinite(stock) || stock < 0){
    setInventoryMessage("El stock debe ser un número mayor o igual a 0.", true);
    return;
  }
  if(!Number.isFinite(price) || price < 0){
    setInventoryMessage("El precio debe ser un número mayor o igual a 0.", true);
    return;
  }

  setInventoryMessage("");
  try{
    if(!API_BASE){
      throw new Error("No se puede conectar al servidor. Abre el monitor desde http://localhost:3000/monitor.");
    }

    const res = await fetchWithAuth(`${API_BASE}/inventory/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stock,
        productType: payload?.productType || "fitness",
        categoryLabel: String(payload?.categoryLabel || "").trim(),
        price,
        uploadedImages: Array.isArray(payload?.uploadedImages) ? payload.uploadedImages : [],
        colors: normalizeList(payload?.colors),
        sizes: normalizeList(payload?.sizes),
      })
    });

    const body = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401) throw new Error("Credenciales inválidas.");
      throw new Error(body.mensaje || "No se pudo actualizar inventario.");
    }

    inventoryItems = inventoryItems.map(item =>
      item.name === name
        ? {
            ...item,
            productType: body.productType || "fitness",
            categoryLabel: body.categoryLabel || "",
            price: Number(body.price) || 0,
            stock: body.stock,
            updatedAt: body.updatedAt || new Date().toISOString(),
            imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
            colors: Array.isArray(body.colors) ? body.colors : [],
            sizes: Array.isArray(body.sizes) ? body.sizes : [],
          }
        : item
    );
    inventoryItems = sortInventoryItems(inventoryItems);
    renderInventory();
    setInventoryMessage(`Inventario actualizado para ${name}.`);
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo guardar el inventario.";
    setInventoryMessage(msg, true);
  }
}

async function eliminarInventario(name){
  if(!name) return;
  const ok = window.confirm(`¿Eliminar "${name}" del catálogo web?`);
  if(!ok) return;

  setInventoryMessage("");
  try{
    if(!API_BASE){
      throw new Error("No se puede conectar al servidor. Abre el monitor desde http://localhost:3000/monitor.");
    }

    const res = await fetchWithAuth(`${API_BASE}/inventory/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
    const body = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401) throw new Error("Credenciales inválidas.");
      throw new Error(body.mensaje || "No se pudo eliminar el producto.");
    }

    inventoryItems = sortInventoryItems(inventoryItems.filter(item => item.name !== name));
    renderInventory();
    setInventoryMessage(`Producto eliminado: ${name}.`);
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo eliminar el producto.";
    setInventoryMessage(msg, true);
  }
}

async function crearProductoInventario(){
  try{
    const uploadedImages = await fileInputsToUploads([
      refs.newProductImage1,
      refs.newProductImage2,
      refs.newProductImage3,
      refs.newProductImage4,
    ]);
    const payload = {
      name: refs.newProductName?.value.trim() || "",
      productType: refs.newProductType?.value || "fitness",
      categoryLabel: refs.newProductCategory?.value.trim() || "",
      price: Number(refs.newProductPrice?.value),
      stock: Number.parseInt(refs.newProductStock?.value || "", 10),
      uploadedImages,
      colors: normalizeList(refs.newProductColors?.value),
      sizes: normalizeList(refs.newProductSizes?.value),
    };

    if(!payload.name){
      setInventoryMessage("Escribe el nombre del producto.", true);
      return;
    }
    if(!Number.isFinite(payload.price) || payload.price < 0){
      setInventoryMessage("Indica un precio válido.", true);
      return;
    }
    if(!Number.isFinite(payload.stock) || payload.stock < 0){
      setInventoryMessage("Indica un stock válido.", true);
      return;
    }

    setInventoryMessage("");
    if(!API_BASE){
      throw new Error("No se puede conectar al servidor. Abre el monitor desde http://localhost:3000/monitor.");
    }
    if(refs.inventoryCreateBtn){
      refs.inventoryCreateBtn.disabled = true;
    }

    const res = await fetchWithAuth(`${API_BASE}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401) throw new Error("Credenciales inválidas.");
      throw new Error(body.mensaje || "No se pudo crear el producto.");
    }

    inventoryItems = sortInventoryItems([...inventoryItems, body]);
    renderInventory();
    resetInventoryCreateForm();
    setInventoryMessage(`Producto creado: ${body.name}.`);
  } catch(_err){
    const msg = _err && _err.message
      ? _err.message
      : "No se pudo crear el producto.";
    setInventoryMessage(msg, true);
  } finally {
    if(refs.inventoryCreateBtn){
      refs.inventoryCreateBtn.disabled = false;
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

refs.refreshBtn.addEventListener("click", () => {
  cargarPedidos();
});
if(refs.exportBtn){
  refs.exportBtn.addEventListener("click", exportarPedidos);
}
cargarPedidos();
setInterval(() => {
  cargarPedidos();
}, POLL_MS);
