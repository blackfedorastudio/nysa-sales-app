const state = {
  products: [],
  filtered: [],
  visible: 48,
  cart: [],
  orders: [],
  recentOrders: [
    { id: "HST-1048", customerName: "Hotel Aegean", status: "Σε έλεγχο", meta: "10 προϊόντα / έκπτωση 10%" },
    { id: "HST-1047", customerName: "Beach Shop Ammos", status: "Εγκρίθηκε", meta: "24 προϊόντα / χωρίς έκπτωση" },
    { id: "HST-1046", customerName: "Souvenir Shop Thasos", status: "Εμπορική αλλαγή", meta: "7 προϊόντα / αλλαγή ποσότητας" },
  ],
  selectedCustomer: "CUST-001",
  user: null,
  recognition: null,
  listening: false,
  keepListening: false,
  voiceTranscript: "",
  previewOrderId: null,
};

let customers = [
  { id: "CUST-001", name: "Hotel Aegean", type: "Ξενοδοχείο", area: "Καβάλα", note: "Θέλει συχνά προσφορά και παράδοση Παρασκευή." },
  { id: "CUST-002", name: "Souvenir Shop Thasos", type: "Τουριστικό κατάστημα", area: "Θάσος", note: "Παίρνει συχνά μαγνητάκια και κούπες." },
  { id: "CUST-003", name: "Beach Shop Ammos", type: "Beach shop", area: "Νέα Πέραμος", note: "Φουσκωτά, πετσέτες, παντόφλες." },
  { id: "CUST-004", name: "Mini Market Lydia", type: "Mini market", area: "Νικήσιανη", note: "Τρόφιμα, παιχνίδια display, μικρά είδη." },
  { id: "CUST-005", name: "Gift Corner Kavala", type: "Souvenir / gifts", area: "Καβάλα", note: "Προτιμά Greece και Καβάλα σχέδια." },
  { id: "CUST-006", name: "Tourist Pharmacy Spot", type: "Pharmacy / cosmetics", area: "Παγγαίο", note: "Aphrodite, προσωπική φροντίδα, gift sets." },
];

let users = {
  maria: { password: "1234", name: "Μαρία", role: "seller", area: "Καβάλα / Θάσος", discountLimit: 10, active: true, customerIds: ["CUST-001", "CUST-002", "CUST-003"] },
  kostas: { password: "1234", name: "Κώστας", role: "seller", area: "Παγγαίο / Νέα Πέραμος", discountLimit: 8, active: true, customerIds: ["CUST-004", "CUST-005", "CUST-006"] },
  admin: { password: "1234", name: "Διαχείριση NYSA", role: "admin", area: "Κέντρο λειτουργίας", discountLimit: 80, active: true, customerIds: "ALL" },
};

customers = loadStored("nysa_customers", customers);
users = loadStored("nysa_users", users);
state.orders = loadStored("nysa_orders", state.orders);
state.recentOrders = loadStored("nysa_recent_orders", state.recentOrders);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function selectedCustomer() {
  return visibleCustomers().find((c) => c.id === state.selectedCustomer) || visibleCustomers()[0] || customers[0];
}

function sellerUsers() {
  return Object.entries(users).filter(([, user]) => user.role === "seller");
}

function visibleCustomers() {
  if (!state.user || state.user.customerIds === "ALL") return customers;
  return customers.filter((customer) => state.user.customerIds.includes(customer.id));
}

function ensureSelectedCustomer() {
  const visible = visibleCustomers();
  if (!visible.some((customer) => customer.id === state.selectedCustomer)) {
    state.selectedCustomer = visible[0]?.id || customers[0]?.id;
  }
}

function sellerLimit() {
  return Number(state.user?.discountLimit || 0);
}

function orderNeedsReview(order) {
  const limit = order.seller?.discountLimit ?? sellerLimit();
  const maxLineDiscount = Math.max(0, ...order.items.map((item) => Number(item.discount || 0)));
  return order.discount > limit || maxLineDiscount > limit;
}

function animateNumber(selector, value) {
  const el = $(selector);
  const from = Number(el.textContent.replace(/\D/g, "")) || 0;
  const duration = 650;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (value - from) * eased);
    el.textContent = current.toLocaleString("el-GR");
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2300);
}

function setView(view) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === view));
  $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view));
  const titles = {
    dashboard: "Αρχική",
    catalog: "Κατάλογος",
    codeOrder: "Παραγγελία με Κωδικό",
    aiOrder: "Agent Παραγγελίας",
    cart: "Καλάθι",
    admin: "Κέντρο Ελέγχου",
  };
  $("#viewTitle").textContent = titles[view] || "NYSA Παραγγελιοληψία";
  if (view === "cart") renderCart();
  if (view === "admin") renderAdmin();
}

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function imageTag(product) {
  if (!product.image_url) return `<div class="image-fallback"><strong>NYSA</strong><span>Φωτογραφία προϊόντος</span></div>`;
  return `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.closest('.product-image').innerHTML='<div class=&quot;image-fallback&quot;><strong>NYSA</strong><span>Φωτογραφία προϊόντος</span></div>'" />`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uniqueCategories(products) {
  const set = new Set(products.map((p) => p.main_category || "Άλλο"));
  return ["Όλες", ...[...set].sort((a, b) => a.localeCompare(b, "el"))];
}

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persistBusinessData() {
  localStorage.setItem("nysa_customers", JSON.stringify(customers));
  localStorage.setItem("nysa_users", JSON.stringify(users));
  localStorage.setItem("nysa_orders", JSON.stringify(state.orders));
  localStorage.setItem("nysa_recent_orders", JSON.stringify(state.recentOrders));
}

function stockInfo(product) {
  const seed = String(product.product_code || product.id || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  if (seed % 19 === 0) return { label: "Μη διαθέσιμο", className: "out", qty: 0 };
  if (seed % 7 === 0) return { label: "Χαμηλό", className: "low", qty: (seed % 8) + 1 };
  return { label: "Διαθέσιμο", className: "ok", qty: (seed % 46) + 12 };
}

async function loadProducts() {
  const res = await fetch("./data/products.json");
  state.products = await res.json();
  state.filtered = state.products;
  animateNumber("#productCount", state.products.length);
  populateFilters();
  renderProducts();
}

function populateFilters() {
  ensureSelectedCustomer();
  const categoryOptions = uniqueCategories(state.products).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  $("#categoryFilter").innerHTML = categoryOptions;
  const customerOptions = visibleCustomers().map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  $("#customerSelect").innerHTML = customerOptions;
  $("#cartCustomerSelect").innerHTML = customerOptions;
  $("#customerSelect").value = state.selectedCustomer;
  $("#cartCustomerSelect").value = state.selectedCustomer;
  renderActiveCustomer();
}

function renderActiveCustomer() {
  const customer = selectedCustomer();
  $("#activeCustomerName").textContent = customer.name;
  $("#activeCustomerMeta").textContent = `${customer.type} / ${customer.area}`;
}

function filterProducts() {
  const q = normalize($("#productSearch").value);
  const cat = $("#categoryFilter").value;
  state.visible = 48;
  state.filtered = state.products.filter((p) => {
    const matchesCat = cat === "Όλες" || p.main_category === cat;
    const haystack = normalize(`${p.product_code} ${p.name} ${p.main_category} ${p.subcategories} ${p.category_path}`);
    return matchesCat && (!q || haystack.includes(q));
  });
  renderProducts();
}

function renderProducts() {
  const products = state.filtered.slice(0, state.visible);
  $("#catalogResultCount").textContent = `${state.filtered.length.toLocaleString("el-GR")} προϊόντα`;
  $("#loadMoreBtn").hidden = state.visible >= state.filtered.length;
  $("#productGrid").innerHTML = products.map((p) => `
    <article class="product-card">
      <div class="product-image">${imageTag(p)}</div>
      <div class="product-body">
        <div class="sku">${escapeHtml(p.product_code)}</div>
        <div class="stock-badge ${stockInfo(p).className}">${stockInfo(p).label} · ${stockInfo(p).qty} τεμ.</div>
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-meta">${escapeHtml(p.main_category)}${p.subcategories ? " / " + escapeHtml(p.subcategories) : ""}</div>
        <div class="qty-row">
          <input type="number" min="1" value="1" aria-label="Ποσότητα για ${escapeHtml(p.name)}" data-qty="${p.id}">
          <button class="primary-btn" data-add="${p.id}">Προσθήκη</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCustomers() {
  const visible = visibleCustomers();
  $("#customerCount").textContent = visible.length;
  $("#assignedCount").textContent = visible.length;
  $("#customerList").innerHTML = visible.map((c) => `
    <div class="customer-card ${c.id === state.selectedCustomer ? "active" : ""}" data-customer="${c.id}">
      <button class="card-main" data-customer-select="${c.id}">
        <strong>${escapeHtml(c.name)}</strong>
        <small>${escapeHtml(c.type)} / ${escapeHtml(c.area)}</small>
        <small>${escapeHtml(c.note)}</small>
      </button>
      <button class="icon-btn" data-edit-customer="${c.id}" aria-label="Επεξεργασία πελάτη">✎</button>
    </div>
  `).join("");
  $("#recentOrderCount").textContent = state.recentOrders.length;
  $("#recentOrders").innerHTML = state.recentOrders.map((order) => `
    <div class="order-card">
      <div>
        <span class="sku">${escapeHtml(order.id)}</span>
        <strong>${escapeHtml(order.customerName)}</strong>
        <small>${escapeHtml(order.meta)}</small>
      </div>
      <div class="card-actions">
        <span class="status ${order.status === "Εγκρίθηκε" ? "approved" : "needs"}">${escapeHtml(order.status)}</span>
        <button class="icon-btn" data-edit-recent="${order.id}" aria-label="Επεξεργασία παραγγελίας">✎</button>
      </div>
    </div>
  `).join("");
  renderCustomerProfile();
  updateAdminCounts();
}

function renderCustomerProfile() {
  const customer = selectedCustomer();
  const orders = state.orders.filter((order) => order.customer.id === customer.id);
  const units = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  const avgDiscount = orders.length
    ? Math.round(orders.reduce((sum, order) => sum + Number(order.discount || 0), 0) / orders.length)
    : customer.name.includes("Hotel") ? 10 : customer.name.includes("Beach") ? 5 : 0;
  const productCounts = new Map();
  orders.flatMap((order) => order.items).forEach((item) => {
    const key = item.product.product_code;
    productCounts.set(key, {
      name: item.product.name,
      qty: (productCounts.get(key)?.qty || 0) + item.qty,
    });
  });
  const commonProducts = [...productCounts.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 3)
    .map(([code, item]) => `${code} · ${item.name}`);
  const fallbackProducts = customer.type.includes("Beach")
    ? ["Φουσκωτά / σανίδες θαλάσσης", "Πετσέτες και εποχιακά", "Παιχνίδια παραλίας"]
    : customer.type.includes("Ξενοδοχείο")
      ? ["Είδη οικιακής χρήσης", "Αναλώσιμα δωματίων", "Είδη εξυπηρέτησης"]
      : ["Souvenir", "Display προϊόντα", "Εποχιακά είδη"];
  $("#profileBadge").textContent = orders.length ? `${orders.length} παραγγελίες` : "προφίλ";
  $("#customerProfile").innerHTML = `
    <div class="profile-main">
      <strong>${escapeHtml(customer.name)}</strong>
      <small>${escapeHtml(customer.type)} / ${escapeHtml(customer.area)}</small>
      <p>${escapeHtml(customer.note)}</p>
    </div>
    <div class="profile-stats">
      <div><span>Τεμάχια</span><strong>${units || "—"}</strong></div>
      <div><span>Συνήθης έκπτωση</span><strong>${avgDiscount}%</strong></div>
      <div><span>Τελευταία κίνηση</span><strong>${orders[0]?.createdAt || "χωρίς νέα"}</strong></div>
    </div>
    <div class="profile-products">
      <span>Συνήθη προϊόντα</span>
      ${(commonProducts.length ? commonProducts : fallbackProducts).map((item) => `<em>${escapeHtml(item)}</em>`).join("")}
    </div>
  `;
}

function addToCart(product, qty = 1) {
  if (!product) return;
  const existing = state.cart.find((item) => item.product.id === product.id);
  if (existing) existing.qty += qty;
  else state.cart.push({ product, qty, discount: 0 });
  updateCartBadge();
  toast(`${product.product_code} προστέθηκε στο καλάθι`);
}

function updateCartBadge() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  $("#cartCount").textContent = count;
  $("#cartUnits").textContent = count;
}

function renderCart() {
  updateCartBadge();
  if (!state.cart.length) {
    $("#cartItems").innerHTML = `<div class="notice">Το καλάθι είναι άδειο.</div>`;
    return;
  }
  $("#cartItems").innerHTML = state.cart.map((item) => `
    <div class="cart-line">
      <div>
        <span class="sku">${escapeHtml(item.product.product_code)}</span>
        <strong>${escapeHtml(item.product.name)}</strong>
        <small>${escapeHtml(item.product.main_category)}</small>
      </div>
      <label class="mini-field">
        <span>Ποσ.</span>
        <input type="number" min="1" value="${item.qty}" data-cart-qty="${item.product.id}">
      </label>
      <label class="mini-field">
        <span>Έκπτ. %</span>
        <input type="number" min="0" max="80" value="${item.discount || 0}" data-cart-discount="${item.product.id}">
      </label>
      <button class="ghost-btn danger" data-remove="${item.product.id}">×</button>
    </div>
  `).join("");
}

function parseSkuLines(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const results = [];
  const warnings = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-zΑ-Ωα-ω0-9\-]+)\s*(?:x|\*|,|\s)\s*(\d+)/i);
    if (!match) {
      warnings.push(`Δεν διάβασα τη γραμμή: ${line}`);
      continue;
    }
    const code = match[1].trim();
    const qty = Number(match[2]);
    const matches = state.products.filter((p) => String(p.product_code).toLowerCase() === code.toLowerCase());
    if (!matches.length) warnings.push(`Δεν βρέθηκε κωδικός: ${code}`);
    else if (matches.length > 1) {
      results.push({ product: matches[0], qty, duplicate: matches.length });
      warnings.push(`Ο κωδικός ${code} έχει ${matches.length} προϊόντα. Προστέθηκε η πρώτη διαθέσιμη εγγραφή.`);
    } else results.push({ product: matches[0], qty });
  }
  return { results, warnings };
}

function submitOrder() {
  if (!state.cart.length) {
    toast("Το καλάθι είναι άδειο");
    return;
  }
  const discount = Number($("#discountInput").value || 0);
  const customer = visibleCustomers().find((c) => c.id === $("#cartCustomerSelect").value) || selectedCustomer();
  const hasItemDiscount = state.cart.some((item) => Number(item.discount || 0) > 0);
  const order = {
    id: `ORD-${String(state.orders.length + 1).padStart(3, "0")}`,
    customer,
    createdAt: new Date().toLocaleString("el-GR"),
    items: state.cart.map((item) => ({ ...item })),
    discount,
    note: $("#orderNote").value.trim(),
    seller: state.user ? {
      username: state.user.username,
      name: state.user.name,
      discountLimit: state.user.discountLimit,
    } : null,
    status: "Καταχωρήθηκε",
  };
  if (orderNeedsReview(order)) order.status = "Έλεγχος έκπτωσης";
  else if (hasItemDiscount || discount > 0) order.status = "Εμπορική καταχώρηση";
  state.orders.unshift(order);
  state.recentOrders.unshift({
    id: order.id,
    customerName: customer.name,
    status: order.status,
    meta: `${order.items.length} προϊόντα / ${order.items.reduce((sum, item) => sum + item.qty, 0)} τεμάχια / ${order.seller?.name || "Πωλητής"}`,
  });
  state.cart = [];
  $("#discountInput").value = 0;
  $("#orderNote").value = "";
  updateCartBadge();
  renderCart();
  updateAdminCounts();
  renderCustomers();
  persistBusinessData();
  toast(order.status === "Έλεγχος έκπτωσης" ? "Η παραγγελία χρειάζεται έγκριση έκπτωσης" : "Η παραγγελία καταχωρήθηκε");
  setView("dashboard");
}

function renderAdmin() {
  updateAdminCounts();
  renderSellerList();
  renderAssignments();
  $("#adminOrders").innerHTML = state.orders.length ? state.orders.map((order) => {
    const units = order.items.reduce((sum, item) => sum + item.qty, 0);
    const statusClass = order.status === "Εγκρίθηκε" ? "approved" : "needs";
    const itemRows = order.items.map((item) => `
      <div class="order-item-row">
        <span>${escapeHtml(item.product.product_code)}</span>
        <strong>${escapeHtml(item.product.name)}</strong>
        <small>${item.qty} τεμ. / έκπτωση είδους ${Number(item.discount || 0)}%</small>
      </div>
    `).join("");
    return `
      <article class="admin-order">
        <div class="panel-head">
          <div>
            <span class="sku">${order.id}</span>
            <strong>${escapeHtml(order.customer.name)}</strong>
            <small>${order.createdAt} / ${units} τεμάχια / ${escapeHtml(order.seller?.name || "Πωλητής")}</small>
          </div>
          <span class="status ${statusClass}">${order.status}</span>
        </div>
        <small>${escapeHtml(order.note || "Χωρίς σημείωση")} / Γενική έκπτωση ${order.discount}%</small>
        <div class="order-items">${itemRows}</div>
        <div class="admin-actions">
          <button class="primary-btn" data-approve="${order.id}">Έγκριση</button>
          <button class="ghost-btn" data-preview-order="${order.id}">Προβολή</button>
          <button class="ghost-btn" data-edit-order="${order.id}">Εμπορική αλλαγή</button>
          <button class="ghost-btn danger" data-cancel="${order.id}">Ακύρωση</button>
        </div>
      </article>
    `;
  }).join("") : `<div class="notice">Δεν υπάρχουν νέες παραγγελίες. Μόλις ένας πωλητής στείλει καλάθι, θα εμφανιστεί εδώ για έλεγχο, αλλαγή ή έγκριση.</div>`;
}

function renderSellerList() {
  const sellers = sellerUsers();
  $("#sellerCount").textContent = sellers.length;
  $("#sellerList").innerHTML = sellers.map(([username, seller]) => `
    <article class="seller-card">
      <div>
        <strong>${escapeHtml(seller.name)}</strong>
        <small>@${escapeHtml(username)} / ${escapeHtml(seller.area || "Χωρίς περιοχή")}</small>
        <small>${seller.customerIds.length} πελάτες / όριο έκπτωσης ${seller.discountLimit}%</small>
      </div>
      <button class="pill-btn ${seller.active ? "ok" : "muted"}" data-toggle-seller="${escapeHtml(username)}">
        ${seller.active ? "Ενεργός" : "Ανενεργός"}
      </button>
    </article>
  `).join("");
}

function renderAssignments() {
  $("#assignmentGrid").innerHTML = sellerUsers().map(([username, seller]) => `
    <article class="assignment-card">
      <div class="panel-head">
        <div>
          <strong>${escapeHtml(seller.name)}</strong>
          <small>Πελάτες που εμφανίζονται στο app του πωλητή</small>
        </div>
        <span class="sku">${seller.customerIds.length}/${customers.length}</span>
      </div>
      <div class="assignment-options">
        ${customers.map((customer) => `
          <label class="check-row">
            <input type="checkbox" data-assign-customer="${customer.id}" data-assign-seller="${escapeHtml(username)}" ${seller.customerIds.includes(customer.id) ? "checked" : ""}>
            <span>${escapeHtml(customer.name)}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function orderPreviewHtml(order) {
  if (!order) return `<div class="notice">Δεν βρέθηκε η παραγγελία.</div>`;
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  return `
    <div class="preview-sheet">
      <div class="preview-head">
        <div>
          <span class="eyebrow">NYSA παραγγελία</span>
          <h2>${escapeHtml(order.id)}</h2>
          <p>${escapeHtml(order.customer.name)} / ${escapeHtml(order.customer.area)}</p>
        </div>
        <div>
          <strong>${escapeHtml(order.status)}</strong>
          <small>${escapeHtml(order.createdAt)}</small>
          <small>${escapeHtml(order.seller?.name || "Πωλητής")}</small>
        </div>
      </div>
      <table class="preview-table">
        <thead><tr><th>Κωδικός</th><th>Προϊόν</th><th>Stock</th><th>Ποσ.</th><th>Έκπτωση</th></tr></thead>
        <tbody>
          ${order.items.map((item) => `
            <tr>
              <td>${escapeHtml(item.product.product_code)}</td>
              <td>${escapeHtml(item.product.name)}</td>
              <td>${stockInfo(item.product).label}</td>
              <td>${item.qty}</td>
              <td>${Number(item.discount || 0)}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="preview-total">
        <span>Σύνολο τεμαχίων</span><strong>${units}</strong>
        <span>Γενική έκπτωση</span><strong>${order.discount}%</strong>
      </div>
      <p class="preview-note">${escapeHtml(order.note || "Χωρίς σημείωση")}</p>
    </div>
  `;
}

function openOrderPreview(id) {
  state.previewOrderId = id;
  const order = state.orders.find((item) => item.id === id);
  $("#orderPreview").innerHTML = orderPreviewHtml(order);
  $("#previewModal").hidden = false;
}

function closeOrderPreview() {
  $("#previewModal").hidden = true;
}

function exportOrderCsv(order) {
  if (!order) return;
  const header = ["order_id", "customer", "seller", "code", "product", "stock_status", "qty", "line_discount", "general_discount", "status", "note"];
  const rows = order.items.map((item) => [
    order.id,
    order.customer.name,
    order.seller?.name || "",
    item.product.product_code,
    item.product.name,
    stockInfo(item.product).label,
    item.qty,
    Number(item.discount || 0),
    order.discount,
    order.status,
    order.note || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${order.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportOrderExcel(order) {
  if (!order) return;
  const rows = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(order.id)}</td>
      <td>${escapeHtml(order.customer.name)}</td>
      <td>${escapeHtml(order.seller?.name || "")}</td>
      <td>${escapeHtml(item.product.product_code)}</td>
      <td>${escapeHtml(item.product.name)}</td>
      <td>${escapeHtml(stockInfo(item.product).label)}</td>
      <td>${item.qty}</td>
      <td>${Number(item.discount || 0)}%</td>
      <td>${order.discount}%</td>
      <td>${escapeHtml(order.status)}</td>
      <td>${escapeHtml(order.note || "")}</td>
    </tr>
  `).join("");
  const workbook = `
    <html><head><meta charset="UTF-8"></head><body>
      <table>
        <thead>
          <tr><th>Παραγγελία</th><th>Πελάτης</th><th>Πωλητής</th><th>Κωδικός</th><th>Προϊόν</th><th>Stock</th><th>Ποσότητα</th><th>Έκπτωση είδους</th><th>Γενική έκπτωση</th><th>Κατάσταση</th><th>Σημείωση</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${order.id}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function printOrderPreview() {
  const order = state.orders.find((item) => item.id === state.previewOrderId);
  if (!order) return;
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${order.id}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.preview-head{display:flex;justify-content:space-between}.preview-total{margin-top:18px;font-weight:700}</style></head><body>${orderPreviewHtml(order)}</body></html>`);
  win.document.close();
  win.print();
}

function openEditor(config) {
  $("#editMode").value = config.mode;
  $("#editId").value = config.id;
  $("#editEyebrow").textContent = config.eyebrow;
  $("#editTitle").textContent = config.title;
  $("#editLabelOne").textContent = config.labels[0];
  $("#editLabelTwo").textContent = config.labels[1];
  $("#editLabelThree").textContent = config.labels[2];
  $("#editLabelFour").textContent = config.labels[3];
  $("#editFieldOne").value = config.values[0] || "";
  $("#editFieldTwo").value = config.values[1] || "";
  $("#editFieldThree").value = config.values[2] || "";
  $("#editFieldFour").value = config.values[3] || "";
  $("#editFieldThree").closest("label").hidden = Boolean(config.hideThird);
  $("#editModal").hidden = false;
  $("#editFieldOne").focus();
}

function closeEditor() {
  $("#editModal").hidden = true;
}

function editCustomer(id) {
  const customer = customers.find((c) => c.id === id);
  if (!customer) return;
  openEditor({
    mode: "customer",
    id,
    eyebrow: "Πελάτης",
    title: "Επεξεργασία πελάτη",
    labels: ["Επωνυμία", "Κατηγορία", "Περιοχή", "Σημείωση πωλητή"],
    values: [customer.name, customer.type, customer.area, customer.note],
  });
}

function editRecentOrder(id) {
  const order = state.recentOrders.find((item) => item.id === id);
  if (!order) return;
  openEditor({
    mode: "recentOrder",
    id,
    eyebrow: order.id,
    title: "Επεξεργασία παραγγελίας",
    labels: ["Πελάτης", "Κατάσταση", "Περιγραφή", "Σημείωση"],
    values: [order.customerName, order.status, order.meta, ""],
    hideThird: false,
  });
}

function saveEditor() {
  const mode = $("#editMode").value;
  const id = $("#editId").value;
  if (mode === "customer") {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    Object.assign(customer, {
      name: $("#editFieldOne").value.trim() || customer.name,
      type: $("#editFieldTwo").value.trim() || customer.type,
      area: $("#editFieldThree").value.trim() || customer.area,
      note: $("#editFieldFour").value.trim() || customer.note,
    });
    populateFilters();
    renderCustomers();
    persistBusinessData();
    toast("Τα στοιχεία πελάτη ενημερώθηκαν");
  }
  if (mode === "recentOrder") {
    const order = state.recentOrders.find((item) => item.id === id);
    if (!order) return;
    order.customerName = $("#editFieldOne").value.trim() || order.customerName;
    order.status = $("#editFieldTwo").value.trim() || order.status;
    order.meta = $("#editFieldThree").value.trim() || order.meta;
    renderCustomers();
    persistBusinessData();
    toast("Η παραγγελία ενημερώθηκε");
  }
  closeEditor();
}

function updateAdminCounts() {
  animateNumber("#pendingCount", pendingOrders().length);
  $("#adminOrderCount").textContent = `${state.orders.length} παραγγελίες`;
  if ($("#controlPending")) $("#controlPending").textContent = pendingOrders().length;
  if ($("#controlSellers")) $("#controlSellers").textContent = sellerUsers().length;
  if ($("#controlToday")) $("#controlToday").textContent = state.orders.length;
}

function pendingOrders() {
  const current = state.orders
    .filter((o) => o.status !== "Εγκρίθηκε" && o.status !== "Ακυρώθηκε")
    .map((o) => ({
      id: o.id,
      customerName: o.customer.name,
      status: o.status,
      meta: `${o.items.reduce((sum, item) => sum + item.qty, 0)} τεμάχια / γενική έκπτωση ${o.discount}%`,
    }));
  const history = state.recentOrders.filter((o) => o.status !== "Εγκρίθηκε" && o.status !== "Ακυρώθηκε");
  return [...current, ...history].filter((order, index, arr) => arr.findIndex((item) => item.id === order.id) === index);
}

function openPendingModal() {
  const pending = pendingOrders();
  $("#pendingList").innerHTML = pending.length
    ? pending.map((order) => `
      <div class="pending-card">
        <div>
          <span class="sku">${escapeHtml(order.id)}</span>
          <strong>${escapeHtml(order.customerName)}</strong>
          <small>${escapeHtml(order.meta)}</small>
        </div>
        <span class="status needs">${escapeHtml(order.status)}</span>
      </div>
    `).join("")
    : `<div class="notice">Δεν υπάρχουν εκκρεμείς παραγγελίες αυτή τη στιγμή.</div>`;
  $("#pendingModal").hidden = false;
}

function closePendingModal() {
  $("#pendingModal").hidden = true;
}

function setOrderStatus(id, status) {
  const order = state.orders.find((o) => o.id === id);
  if (order) order.status = status;
  const recent = state.recentOrders.find((o) => o.id === id);
  if (recent) recent.status = status;
  persistBusinessData();
}

function applyRoleNavigation() {
  const isAdmin = state.user?.role === "admin";
  $$(".nav-item").forEach((button) => {
    const view = button.dataset.view;
    button.hidden = isAdmin ? view !== "admin" : view === "admin";
  });
  $$("[data-view-jump]").forEach((button) => {
    if (isAdmin && button.dataset.viewJump !== "admin") button.hidden = true;
    else button.hidden = false;
  });
}

function replaceGreekNumbers(text) {
  const numbers = {
    "ένα": 1,
    "ενα": 1,
    "μία": 1,
    "μια": 1,
    "δύο": 2,
    "δυο": 2,
    "τρία": 3,
    "τρια": 3,
    "τέσσερα": 4,
    "τεσσερα": 4,
    "πέντε": 5,
    "πεντε": 5,
    "έξι": 6,
    "εξι": 6,
    "επτά": 7,
    "εφτά": 7,
    "επτα": 7,
    "εφτα": 7,
    "οκτώ": 8,
    "οχτώ": 8,
    "οκτω": 8,
    "οχτω": 8,
    "εννέα": 9,
    "εννεα": 9,
    "δέκα": 10,
    "δεκα": 10,
  };
  return text.replace(/[Α-Ωα-ωάέήίόύώϊϋΐΰ]+/g, (word) => {
    const key = normalize(word);
    return numbers[key] ? String(numbers[key]) : word;
  });
}

function parseAiText() {
  const text = replaceGreekNumbers($("#aiInput").value);
  const normalizedText = normalize(text);
  const found = [];
  const seen = new Set();
  for (const product of state.products) {
    const code = String(product.product_code || "").trim();
    if (!code || seen.has(code)) continue;
    const index = normalizedText.indexOf(normalize(code));
    if (index === -1) continue;
    seen.add(code);
    const before = normalizedText.slice(Math.max(0, index - 36), index);
    const after = normalizedText.slice(index + code.length, index + code.length + 36);
    const beforeQty = before.match(/(\d+)\s*(?:x|\*|τεμ|τεμαχια|απο)?\s*$/i);
    const afterQty = after.match(/^\s*(?:x|\*|τεμ|τεμαχια)?\s*(\d+)/i);
    const qty = Number(beforeQty?.[1] || afterQty?.[1] || 1);
    found.push(`${code} x ${qty}`);
  }
  const discountMatch = text.match(/(\d+)\s*(?:%|τοις\s+εκατό|τοις\s+εκατο)/i);
  if (discountMatch) $("#discountInput").value = Number(discountMatch[1]);
  const { results, warnings } = parseSkuLines(found.join("\n"));
  results.forEach((r) => addToCart(r.product, r.qty));
  $("#aiPreview").innerHTML = `
    <strong>Πρόχειρη παραγγελία:</strong> ${results.length} προϊόντα προστέθηκαν στο καλάθι.
    ${warnings.length ? `<br>${warnings.map(escapeHtml).join("<br>")}` : ""}
  `;
  setTimeout(() => setView("cart"), 700);
}

function setupVoiceAgent() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("#voiceBtn").disabled = true;
    $("#voiceStatus").textContent = "Ο browser δεν υποστηρίζει φωνητική καταχώρηση. Δοκίμασε Chrome.";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "el-GR";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    state.listening = true;
    state.keepListening = true;
    state.voiceTranscript = $("#aiInput").value.trim();
    $("#voiceBtn").textContent = "Διακοπή φωνής";
    $("#voiceBtn").classList.add("recording");
    $("#voiceStatus").textContent = "Ακούω. Μπορείς να μιλήσεις συνεχόμενα και να σταματήσεις όταν τελειώσεις.";
  };
  recognition.onresult = (event) => {
    let finalText = state.voiceTranscript;
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) finalText = `${finalText} ${text}`.trim();
      else interimText = text;
    }
    state.voiceTranscript = finalText;
    const combined = `${finalText} ${interimText}`.trim();
    $("#aiInput").value = combined;
    $("#voiceStatus").textContent = interimText ? `Ακούω: ${interimText}` : "Η φράση καταγράφηκε. Συνέχισε ή πάτησε διακοπή.";
  };
  recognition.onend = () => {
    state.listening = false;
    if (state.keepListening) {
      setTimeout(() => {
        if (!state.keepListening) return;
        try {
          recognition.start();
        } catch {
          state.keepListening = false;
          $("#voiceBtn").textContent = "Υπαγόρευση beta";
          $("#voiceBtn").classList.remove("recording");
        }
      }, 250);
      return;
    }
    $("#voiceBtn").textContent = "Υπαγόρευση beta";
    $("#voiceBtn").classList.remove("recording");
    $("#voiceStatus").textContent = $("#aiInput").value.trim()
      ? "Η φωνητική σημείωση είναι έτοιμη. Έλεγξέ την και πάτησε “Δημιουργία πρόχειρης”."
      : "Δεν καταγράφηκε κείμενο. Πάτησε ξανά έναρξη και μίλησε πιο κοντά στο μικρόφωνο.";
  };
  recognition.onerror = (event) => {
    state.listening = false;
    if (event.error === "no-speech" && state.keepListening) {
      $("#voiceStatus").textContent = "Δεν άκουσα καθαρά. Συνεχίζω να ακούω...";
      return;
    }
    state.keepListening = false;
    $("#voiceBtn").textContent = "Υπαγόρευση beta";
    $("#voiceBtn").classList.remove("recording");
    const messages = {
      "no-speech": "Δεν άκουσα καθαρή φωνή. Πάτησε ξανά και μίλησε λίγο πιο κοντά.",
      "not-allowed": "Δεν δόθηκε άδεια μικροφώνου στον browser.",
      network: "Η φωνητική υπηρεσία δεν απάντησε. Δοκίμασε ξανά σε Chrome.",
    };
    $("#voiceStatus").textContent = messages[event.error] || "Δεν έγινε καταγραφή. Έλεγξε μικρόφωνο/άδεια browser.";
  };
  state.recognition = recognition;
}

function bindEvents() {
  $("#pendingStatBtn").addEventListener("click", openPendingModal);
  $("#pendingClose").addEventListener("click", closePendingModal);
  $("#pendingModal").addEventListener("click", (event) => {
    if (event.target.id === "pendingModal") closePendingModal();
  });
  $("#editForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditor();
  });
  $("#editClose").addEventListener("click", closeEditor);
  $("#editCancel").addEventListener("click", closeEditor);
  $("#editModal").addEventListener("click", (event) => {
    if (event.target.id === "editModal") closeEditor();
  });
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const username = normalize($("#usernameInput").value).trim();
    const password = $("#passwordInput").value.trim();
    const user = users[username];
    if (!user || user.password !== password) {
      $("#loginError").hidden = false;
      return;
    }
    if (!user.active) {
      $("#loginError").textContent = "Ο λογαριασμός είναι ανενεργός.";
      $("#loginError").hidden = false;
      return;
    }
    state.user = { username, ...user };
    $("#sellerName").textContent = user.name;
    $("#roleLabel").textContent = user.role === "admin" ? "Διαχειριστής" : "Πωλητής";
    $("#loginScreen").hidden = true;
    $("#appShell").hidden = false;
    $("#loginError").hidden = true;
    applyRoleNavigation();
    ensureSelectedCustomer();
    populateFilters();
    renderCustomers();
    setView(user.role === "admin" ? "admin" : "dashboard");
  });
  $("#logoutBtn").addEventListener("click", () => {
    state.user = null;
    $("#appShell").hidden = true;
    $("#loginScreen").hidden = false;
    $("#passwordInput").value = "";
    $("#usernameInput").focus();
  });
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));
  $("#productSearch").addEventListener("input", filterProducts);
  $("#categoryFilter").addEventListener("change", filterProducts);
  $("#loadMoreBtn").addEventListener("click", () => {
    state.visible += 48;
    renderProducts();
  });
  $("#customerSelect").addEventListener("change", (event) => {
    state.selectedCustomer = event.target.value;
    $("#cartCustomerSelect").value = state.selectedCustomer;
    renderActiveCustomer();
    renderCustomers();
  });
  $("#cartCustomerSelect").addEventListener("change", (event) => {
    state.selectedCustomer = event.target.value;
    $("#customerSelect").value = state.selectedCustomer;
    renderActiveCustomer();
    renderCustomers();
  });
  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) {
      const id = Number(add.dataset.add);
      const product = state.products.find((p) => Number(p.id) === id);
      const qtyInput = document.querySelector(`[data-qty="${id}"]`);
      addToCart(product, Number(qtyInput?.value || 1));
    }
    const customer = event.target.closest("[data-customer-select]");
    if (customer) {
      state.selectedCustomer = customer.dataset.customerSelect;
      $("#customerSelect").value = state.selectedCustomer;
      $("#cartCustomerSelect").value = state.selectedCustomer;
      renderActiveCustomer();
      renderCustomers();
      toast("Πελάτης επιλέχθηκε");
    }
    const editCustomerButton = event.target.closest("[data-edit-customer]");
    if (editCustomerButton) editCustomer(editCustomerButton.dataset.editCustomer);
    const editRecentButton = event.target.closest("[data-edit-recent]");
    if (editRecentButton) editRecentOrder(editRecentButton.dataset.editRecent);
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      state.cart = state.cart.filter((item) => Number(item.product.id) !== Number(remove.dataset.remove));
      renderCart();
      updateCartBadge();
    }
    const approve = event.target.closest("[data-approve]");
    if (approve) {
      setOrderStatus(approve.dataset.approve, "Εγκρίθηκε");
      renderAdmin();
      renderCustomers();
    }
    const edit = event.target.closest("[data-edit-order]");
    if (edit) {
      setOrderStatus(edit.dataset.editOrder, "Εμπορική αλλαγή");
      renderAdmin();
      renderCustomers();
    }
    const cancel = event.target.closest("[data-cancel]");
    if (cancel) {
      setOrderStatus(cancel.dataset.cancel, "Ακυρώθηκε");
      renderAdmin();
      renderCustomers();
    }
    const preview = event.target.closest("[data-preview-order]");
    if (preview) openOrderPreview(preview.dataset.previewOrder);
    const toggleSeller = event.target.closest("[data-toggle-seller]");
    if (toggleSeller) {
      const seller = users[toggleSeller.dataset.toggleSeller];
      if (seller) seller.active = !seller.active;
      persistBusinessData();
      renderAdmin();
    }
  });
  document.addEventListener("input", (event) => {
    const qty = event.target.closest("[data-cart-qty]");
    if (qty) {
      const item = state.cart.find((i) => Number(i.product.id) === Number(qty.dataset.cartQty));
      if (item) item.qty = Math.max(1, Number(qty.value || 1));
      updateCartBadge();
    }
    const discount = event.target.closest("[data-cart-discount]");
    if (discount) {
      const item = state.cart.find((i) => Number(i.product.id) === Number(discount.dataset.cartDiscount));
      if (item) item.discount = Math.min(80, Math.max(0, Number(discount.value || 0)));
    }
    const assignment = event.target.closest("[data-assign-customer]");
    if (assignment) {
      const seller = users[assignment.dataset.assignSeller];
      if (!seller) return;
      const customerId = assignment.dataset.assignCustomer;
      if (assignment.checked && !seller.customerIds.includes(customerId)) seller.customerIds.push(customerId);
      if (!assignment.checked) seller.customerIds = seller.customerIds.filter((id) => id !== customerId);
      persistBusinessData();
      renderSellerList();
    }
  });
  $("#sellerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = normalize($("#newSellerUsername").value).trim();
    if (!username || users[username]) {
      toast("Χρειάζεται μοναδικό username");
      return;
    }
    users[username] = {
      password: $("#newSellerPassword").value.trim() || "1234",
      name: $("#newSellerName").value.trim() || username,
      role: "seller",
      area: $("#newSellerArea").value.trim() || "Νέα περιοχή",
      discountLimit: Math.min(80, Math.max(0, Number($("#newSellerLimit").value || 0))),
      active: true,
      customerIds: [],
    };
    event.target.reset();
    persistBusinessData();
    renderAdmin();
    toast("Ο πωλητής δημιουργήθηκε");
  });
  $("#previewClose")?.addEventListener("click", closeOrderPreview);
  $("#previewModal")?.addEventListener("click", (event) => {
    if (event.target.id === "previewModal") closeOrderPreview();
  });
  $("#printPreviewBtn")?.addEventListener("click", printOrderPreview);
  $("#exportCsvBtn")?.addEventListener("click", () => {
    const order = state.orders.find((item) => item.id === state.previewOrderId);
    exportOrderCsv(order);
  });
  $("#exportExcelBtn")?.addEventListener("click", () => {
    const order = state.orders.find((item) => item.id === state.previewOrderId);
    exportOrderExcel(order);
  });
  $("#parseSkuBtn").addEventListener("click", () => {
    const { results, warnings } = parseSkuLines($("#skuInput").value);
    results.forEach((r) => addToCart(r.product, r.qty));
    $("#skuNotice").innerHTML = warnings.length ? warnings.map(escapeHtml).join("<br>") : `${results.length} προϊόντα προστέθηκαν.`;
    if (results.length) setTimeout(() => setView("cart"), 600);
  });
  $("#clearSkuBtn").addEventListener("click", () => {
    $("#skuInput").value = "";
  });
  $("#parseAiBtn").addEventListener("click", parseAiText);
  $("#voiceBtn").addEventListener("click", () => {
    if (!state.recognition) return;
    if (state.listening || state.keepListening) {
      state.keepListening = false;
      state.recognition.stop();
      return;
    }
    state.keepListening = true;
    try {
      state.recognition.start();
    } catch {
      $("#voiceStatus").textContent = "Η φωνητική καταχώρηση είναι ήδη ενεργή.";
    }
  });
  $("#clearCartBtn").addEventListener("click", () => {
    state.cart = [];
    renderCart();
    updateCartBadge();
  });
  $("#submitOrderBtn").addEventListener("click", submitOrder);
}

let deferredPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $("#installBtn").hidden = false;
});

$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#installBtn").hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

bindEvents();
renderCustomers();
updateCartBadge();
setupVoiceAgent();
loadProducts().catch(() => {
  $("#productGrid").innerHTML = `<div class="notice">Δεν φορτώθηκε ο κατάλογος προϊόντων.</div>`;
});
