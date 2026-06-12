// ═══════════════════════════════════════════════════════════
// FreshMart — Seller Dashboard Logic
// PIN auth, Product CRUD, Order management, Stats
// ═══════════════════════════════════════════════════════════

let isAuthenticated = false;
let editingProductId = null;
let failedAttempts = 0;
let lockoutUntil = 0;

// ── Initialize ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupPinInputs();

  // Check if session is active
  if (sessionStorage.getItem('freshmart_seller_auth') === 'true') {
    unlockDashboard();
  }
});

// ═══════════════════════════════════════════════════════════
// PIN AUTHENTICATION
// ═══════════════════════════════════════════════════════════

function setupPinInputs() {
  const inputs = document.querySelectorAll('.pin-digit');

  inputs.forEach((input, index) => {
    // Auto-focus next input on entry
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      // Only allow digits
      e.target.value = val.replace(/[^0-9]/g, '');

      if (e.target.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }

      // Auto-submit when all filled
      if (index === inputs.length - 1 && e.target.value) {
        handlePinLogin();
      }
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
      }
      if (e.key === 'Enter') {
        handlePinLogin();
      }
    });

    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
      pasted.split('').forEach((char, i) => {
        if (inputs[i]) inputs[i].value = char;
      });
      if (pasted.length === 4) handlePinLogin();
    });
  });

  // Focus first input
  setTimeout(() => inputs[0]?.focus(), 300);
}

function handlePinLogin() {
  const now = Date.now();
  if (now < lockoutUntil) {
    const secs = Math.ceil((lockoutUntil - now) / 1000);
    document.getElementById('pinError').innerHTML = `⏳ Too many attempts. Try again in ${secs}s`;
    return;
  }

  const inputs = document.querySelectorAll('.pin-digit');
  const pin = Array.from(inputs).map(i => i.value).join('');

  if (pin.length !== 4) {
    shakePin();
    document.getElementById('pinError').textContent = 'Please enter all 4 digits';
    return;
  }

  if (FreshMartStore.verifyPin(pin)) {
    // Success
    isAuthenticated = true;
    sessionStorage.setItem('freshmart_seller_auth', 'true');
    unlockDashboard();
  } else {
    // Failed
    failedAttempts++;
    shakePin();

    if (failedAttempts >= 3) {
      lockoutUntil = Date.now() + 30000; // 30 second lockout
      document.getElementById('pinError').innerHTML = '🔒 Too many wrong attempts. Locked for 30 seconds.';
      document.getElementById('pinSubmitBtn').disabled = true;

      setTimeout(() => {
        failedAttempts = 0;
        document.getElementById('pinError').textContent = '';
        document.getElementById('pinSubmitBtn').disabled = false;
      }, 30000);
    } else {
      document.getElementById('pinError').textContent = `Wrong PIN. ${3 - failedAttempts} attempts remaining.`;
    }

    // Clear inputs
    inputs.forEach(i => { i.value = ''; });
    inputs[0].focus();
  }
}

function shakePin() {
  const inputs = document.querySelectorAll('.pin-digit');
  inputs.forEach(i => {
    i.classList.add('error');
    setTimeout(() => i.classList.remove('error'), 500);
  });
}

function unlockDashboard() {
  isAuthenticated = true;
  document.getElementById('pinOverlay').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  renderStats();
  renderProducts();
  renderOrders();
}

function handleLogout() {
  isAuthenticated = false;
  sessionStorage.removeItem('freshmart_seller_auth');
  document.getElementById('pinOverlay').style.display = 'grid';
  document.getElementById('dashboard').style.display = 'none';

  // Clear PIN inputs
  document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
  document.getElementById('pinError').textContent = '';
  setTimeout(() => document.querySelector('.pin-digit')?.focus(), 300);
}

// ═══════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════

function switchTab(tab, btn) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  btn.classList.add('active');
  document.getElementById(tab + 'Tab').classList.add('active');
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

function renderStats() {
  const stats = FreshMartStore.getStats();
  document.getElementById('statProducts').textContent = stats.totalProducts;
  document.getElementById('statInStock').textContent = stats.inStockProducts;
  document.getElementById('statOrders').textContent = stats.totalOrders;
  document.getElementById('statPending').textContent = stats.pendingOrders;
  document.getElementById('statRevenue').textContent = FreshMartStore.formatPrice(stats.revenue);
}

// ═══════════════════════════════════════════════════════════
// PRODUCT MANAGEMENT
// ═══════════════════════════════════════════════════════════

function renderProducts() {
  const products = FreshMartStore.getProducts();
  const body = document.getElementById('productsTableBody');

  if (products.length === 0) {
    body.innerHTML = `
      <div style="text-align:center;padding:48px;color:var(--s-text-muted);">
        <div style="font-size:3rem;margin-bottom:12px;">📦</div>
        <p>No products yet. Add your first product!</p>
      </div>`;
    return;
  }

  body.innerHTML = products.map(p => `
    <div class="pt-row" id="row-${p.id}">
      <div class="pt-emoji">${p.emoji}</div>
      <div class="pt-name">${p.name}</div>
      <div class="pt-price">
        <input type="number" class="pt-price-input" value="${p.price}" min="1"
          onchange="updatePrice(${p.id}, this.value)"
          title="Edit price directly">
      </div>
      <div class="pt-category">${p.unit}</div>
      <div>
        <button class="pt-stock ${p.inStock ? 'in' : 'out'}" onclick="toggleStock(${p.id})">
          ${p.inStock ? '● In Stock' : '○ Out'}
        </button>
      </div>
      <div class="pt-actions">
        <button class="pt-action-btn" onclick="openEditModal(${p.id})" title="Edit product">✏️</button>
        <button class="pt-action-btn delete" onclick="deleteProduct(${p.id})" title="Delete product">🗑️</button>
      </div>
    </div>
  `).join('');
}

function updatePrice(id, newPrice) {
  const price = parseInt(newPrice);
  if (price < 1 || isNaN(price)) {
    showToast('Price must be at least ₹1', 'error');
    renderProducts();
    return;
  }
  FreshMartStore.updateProduct(id, { price });
  renderStats();
  showToast('Price updated!', 'success');
}

function toggleStock(id) {
  const products = FreshMartStore.getProducts();
  const product = products.find(p => p.id === id);
  if (product) {
    FreshMartStore.updateProduct(id, { inStock: !product.inStock });
    renderProducts();
    renderStats();
    showToast(`${product.emoji} ${product.name} is now ${!product.inStock ? 'in stock' : 'out of stock'}`, 'info');
  }
}

function deleteProduct(id) {
  const products = FreshMartStore.getProducts();
  const product = products.find(p => p.id === id);

  if (confirm(`Delete "${product.name}"? This cannot be undone.`)) {
    FreshMartStore.deleteProduct(id);
    renderProducts();
    renderStats();
    showToast(`${product.emoji} ${product.name} deleted`, 'error');
  }
}

// ── Product Modal ───────────────────────────────────────────

function openProductModal(productId = null) {
  editingProductId = productId;
  const modal = document.getElementById('productModal');
  const title = document.getElementById('modalTitle');
  const submitBtn = document.getElementById('modalSubmitBtn');

  if (productId) {
    const product = FreshMartStore.getProducts().find(p => p.id === productId);
    if (!product) return;

    title.textContent = 'Edit Product';
    submitBtn.textContent = 'Save Changes';
    document.getElementById('prodEmoji').value = product.emoji;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodUnit').value = product.unit;
    document.getElementById('prodCategory').value = product.category;
  } else {
    title.textContent = 'Add New Product';
    submitBtn.textContent = 'Add Product';
    document.getElementById('productForm').reset();
  }

  modal.classList.add('open');
}

function openEditModal(id) {
  openProductModal(id);
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
  editingProductId = null;
}

function handleProductSubmit(event) {
  event.preventDefault();

  const emoji = document.getElementById('prodEmoji').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const price = parseInt(document.getElementById('prodPrice').value);
  const unit = document.getElementById('prodUnit').value;
  const category = document.getElementById('prodCategory').value;

  if (!emoji || !name || !price || price < 1) {
    showToast('Please fill in all fields correctly', 'error');
    return;
  }

  if (editingProductId) {
    // Update existing product
    FreshMartStore.updateProduct(editingProductId, { emoji, name, price, unit, category });
    showToast(`${emoji} ${name} updated!`, 'success');
  } else {
    // Add new product
    FreshMartStore.addProduct({ emoji, name, price, unit, category });
    showToast(`${emoji} ${name} added!`, 'success');
  }

  closeProductModal();
  renderProducts();
  renderStats();
}

// Close modal on overlay click
document.getElementById('productModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('productModal')) {
    closeProductModal();
  }
});

// ═══════════════════════════════════════════════════════════
// ORDER MANAGEMENT
// ═══════════════════════════════════════════════════════════

function renderOrders() {
  const orders = FreshMartStore.getOrders();
  const container = document.getElementById('ordersList');

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty-icon">📋</div>
        <p>No orders yet</p>
        <p style="font-size:0.82rem;margin-top:8px;">Orders placed by customers will appear here</p>
      </div>`;
    return;
  }

  container.innerHTML = orders.map(order => {
    const itemsStr = order.items.map(i =>
      `${i.emoji} ${i.name} × ${i.qty}${i.unit}`
    ).join(', ');

    return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <span class="order-id">${order.id}</span>
            <span class="order-date">${FreshMartStore.formatDate(order.date)}</span>
          </div>
          <span class="order-status ${order.status}">${order.status}</span>
        </div>
        <div class="order-items">${itemsStr}</div>
        <div class="order-meta">
          <span>💰 ${FreshMartStore.formatPrice(order.total)}</span>
          <span>📍 ${order.location}</span>
          ${order.mapsLink ? `<a href="${order.mapsLink}" target="_blank" class="btn btn--sm btn--outline" style="border-color:var(--s-border); color:var(--lime); padding: 4px 8px; font-size: 0.75rem;">🗺️ View Map</a>` : ''}
          <span>💳 ${order.payment}</span>
        </div>
        <div class="order-actions">
          ${order.status === 'pending' ? `
            <button class="btn btn--primary btn--sm" onclick="updateOrderStatus('${order.id}', 'completed')">✅ Complete</button>
            <button class="btn btn--danger btn--sm" onclick="updateOrderStatus('${order.id}', 'cancelled')">✕ Cancel</button>
          ` : ''}
          ${order.status === 'completed' ? `
            <span style="color:var(--wa);font-size:0.82rem;font-weight:600;">✅ Completed</span>
          ` : ''}
          ${order.status === 'cancelled' ? `
            <span style="color:var(--tomato);font-size:0.82rem;font-weight:600;">❌ Cancelled</span>
          ` : ''}
          <button class="btn btn--ghost btn--sm" onclick="deleteOrder('${order.id}')" style="color:var(--s-text-muted);margin-left:auto;">🗑️ Delete</button>
        </div>
      </div>`;
  }).join('');
}

function updateOrderStatus(id, status) {
  FreshMartStore.updateOrderStatus(id, status);
  renderOrders();
  renderStats();

  const labels = { completed: '✅ Order completed!', cancelled: '❌ Order cancelled' };
  showToast(labels[status] || 'Status updated', status === 'completed' ? 'success' : 'error');
}

function deleteOrder(id) {
  if (confirm('Delete this order record?')) {
    FreshMartStore.deleteOrder(id);
    renderOrders();
    renderStats();
    showToast('Order deleted', 'info');
  }
}

// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
