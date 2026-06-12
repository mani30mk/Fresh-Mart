// ═══════════════════════════════════════════════════════════
// FreshMart — Customer Page Logic
// Cart, WhatsApp ordering, QR code, product rendering
// ═══════════════════════════════════════════════════════════

const WA_NUMBER = FreshMartStore.getWhatsAppNumber();
let cart = [];
let activeCategory = 'all';
let customerLocation = { text: '', mapsLink: '' };

// ── Initialize ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  generateQRCode();
  setupNavScroll();
  updateCartUI();
});

// ── Nav Scroll Effect ───────────────────────────────────────

function setupNavScroll() {
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ── QR Code Generation ──────────────────────────────────────

function generateQRCode() {
  const container = document.getElementById('qrCodeContainer');
  // Use deployed URL if available, otherwise show current URL
  let siteUrl = window.location.href.split('?')[0].split('#')[0];

  // If running from file://, use a placeholder message
  const isLocal = siteUrl.startsWith('file://');
  if (isLocal) {
    // Check if a custom URL was saved by seller
    const customUrl = localStorage.getItem('freshmart_site_url');
    if (customUrl) {
      siteUrl = customUrl;
    }
  }

  try {
    const qr = qrcode(0, 'M');
    qr.addData(siteUrl);
    qr.make();

    container.innerHTML = qr.createSvgTag({
      cellSize: 4,
      margin: 4,
      scalable: true
    });

    // Style the SVG
    const svg = container.querySelector('svg');
    if (svg) {
      svg.style.width = '180px';
      svg.style.height = '180px';
      svg.style.borderRadius = '8px';
    }

    // Update download button
    const downloadBtn = document.getElementById('downloadQRBtn');
    if (downloadBtn) {
      downloadBtn.onclick = () => downloadQRCode(siteUrl);
    }

    // Update URL display
    const urlDisplay = document.getElementById('qrUrlDisplay');
    if (urlDisplay) {
      if (isLocal && !localStorage.getItem('freshmart_site_url')) {
        urlDisplay.innerHTML = '⚠️ Deploy to Vercel first for a shareable QR';
      } else {
        urlDisplay.textContent = siteUrl;
      }
    }
  } catch (e) {
    container.innerHTML = `<div style="width:180px;height:180px;display:grid;place-items:center;background:var(--leaf);border-radius:16px;color:white;font-size:3rem;">📱</div>`;
  }
}

function downloadQRCode(url) {
  // Create a high-res QR code for printing
  const qr = qrcode(0, 'H'); // High error correction for print
  qr.addData(url);
  qr.make();

  // Create canvas for download
  const canvas = document.createElement('canvas');
  const size = 800;
  const cellSize = Math.floor(size / (qr.getModuleCount() + 8));
  const margin = Math.floor((size - cellSize * qr.getModuleCount()) / 2);
  canvas.width = size;
  canvas.height = size + 120; // Extra space for text

  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw QR modules
  const moduleCount = qr.getModuleCount();
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillStyle = '#2D6A4F';
        ctx.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
      }
    }
  }

  // Add text below QR
  ctx.fillStyle = '#1A1A1A';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🥬 FreshMart', canvas.width / 2, size + 50);
  ctx.font = '20px Arial';
  ctx.fillStyle = '#555';
  ctx.fillText('Scan to order fresh produce', canvas.width / 2, size + 85);

  // Download
  const link = document.createElement('a');
  link.download = 'freshmart-qr-code.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── Product Rendering ───────────────────────────────────────

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const products = FreshMartStore.getProducts();

  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--light);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
        <p>No products found in this category</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const inCart = cart.find(c => c.id === product.id);
    const cartQty = inCart ? inCart.qty : 1;

    return `
      <div class="product-card ${!product.inStock ? 'out-of-stock' : ''}" id="product-${product.id}">
        ${inCart ? '<div class="in-cart-badge">✓ In Cart</div>' : ''}
        <span class="product-emoji">${product.emoji}</span>
        <div class="product-name">${product.name}</div>
        <div class="product-price">${FreshMartStore.formatPrice(product.price)}</div>
        <div class="product-unit">per ${product.unit}</div>
        ${product.inStock ? `
          <div class="product-actions">
            <div class="qty-control">
              <button class="qty-btn" onclick="event.stopPropagation(); changeProductQty(${product.id}, -1)">−</button>
              <div class="qty-display" id="qty-${product.id}">${cartQty}</div>
              <button class="qty-btn" onclick="event.stopPropagation(); changeProductQty(${product.id}, 1)">+</button>
            </div>
          </div>
          <button class="add-to-cart-btn ${inCart ? 'in-cart' : ''}" onclick="addToCart(${product.id})">
            ${inCart ? '✓ Update Cart' : '🛒 Add to Cart'}
          </button>
        ` : ''}
      </div>`;
  }).join('');
}

// ── Category Filter ─────────────────────────────────────────

function filterCategory(category, btn) {
  activeCategory = category;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

// ── Quantity Controls (on product cards) ─────────────────────

function changeProductQty(productId, delta) {
  const display = document.getElementById(`qty-${productId}`);
  if (!display) return;
  let qty = parseInt(display.textContent) + delta;
  if (qty < 1) qty = 1;
  if (qty > 50) qty = 50;
  display.textContent = qty;
}

// ── Cart Management ─────────────────────────────────────────

function addToCart(productId) {
  const products = FreshMartStore.getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const qtyDisplay = document.getElementById(`qty-${productId}`);
  const qty = qtyDisplay ? parseInt(qtyDisplay.textContent) : 1;

  const existing = cart.find(c => c.id === productId);
  if (existing) {
    existing.qty = qty; // Replace with selected qty instead of adding
  } else {
    cart.push({
      id: product.id,
      emoji: product.emoji,
      name: product.name,
      price: product.price,
      unit: product.unit,
      qty: qty
    });
  }

  showToast(`${product.emoji} ${product.name} × ${qty} ${product.unit} added to cart!`, 'success');
  updateCartUI();
  renderProducts();

  // Auto-open cart on first add
  if (cart.length === 1 && !document.getElementById('cartPanel').classList.contains('open')) {
    setTimeout(() => toggleCart(), 400);
  }
}

function removeFromCart(index) {
  const item = cart[index];
  cart.splice(index, 1);
  showToast(`${item.emoji} ${item.name} removed`, 'info');
  updateCartUI();
  renderProducts();
}

function changeCartQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty < 1) cart[index].qty = 1;
  if (cart[index].qty > 50) cart[index].qty = 50;
  updateCartUI();
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function updateCartUI() {
  // Update cart count badge
  const countEl = document.getElementById('cartCount');
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = totalItems;
  countEl.classList.toggle('hidden', totalItems === 0);

  // Render cart items
  const container = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Your cart is empty</p>
        <p style="font-size: 0.82rem; margin-top: 8px; color: var(--lighter);">Browse products and add items to get started</p>
      </div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';

  container.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <span class="cart-item-emoji">${item.emoji}</span>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${FreshMartStore.formatPrice(item.price)} / ${item.unit}</div>
      </div>
      <div class="cart-item-qty">
        <button onclick="changeCartQty(${i}, -1)">−</button>
        <span>${item.qty} ${item.unit}</span>
        <button onclick="changeCartQty(${i}, 1)">+</button>
      </div>
      <div class="cart-item-price">${FreshMartStore.formatPrice(item.price * item.qty)}</div>
      <button class="cart-item-remove" onclick="removeFromCart(${i})" title="Remove">✕</button>
    </div>
  `).join('');

  // Update total
  document.getElementById('cartTotalValue').textContent = FreshMartStore.formatPrice(getCartTotal());

  // Update WhatsApp button state
  validateOrder();
}

// ── Cart Toggle ─────────────────────────────────────────────

function toggleCart() {
  const overlay = document.getElementById('cartOverlay');
  const panel = document.getElementById('cartPanel');
  const isOpen = panel.classList.contains('open');

  overlay.classList.toggle('open', !isOpen);
  panel.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

// ── Order Validation ────────────────────────────────────────

function validateOrder() {
  const location = document.getElementById('deliveryLocation').value.trim();
  const payment = document.getElementById('paymentType').value;
  const btn = document.getElementById('placeOrderBtn');
  const isValid = cart.length > 0 && location.length > 0 && payment.length > 0;

  if (btn) {
    btn.classList.toggle('disabled', !isValid);
    btn.disabled = !isValid;
  }
}

// Add input listeners for validation
document.getElementById('deliveryLocation').addEventListener('input', validateOrder);
document.getElementById('paymentType').addEventListener('change', validateOrder);

// ── Place Order ─────────────────────────────────────────────

function placeOrder(event) {
  const location = document.getElementById('deliveryLocation').value.trim();
  const payment = document.getElementById('paymentType').value;

  if (cart.length === 0 || !location || !payment) {
    event.preventDefault();
    if (cart.length === 0) showToast('Your cart is empty!', 'error');
    else if (!location) showToast('Please enter your delivery location', 'error');
    else if (!payment) showToast('Please select a payment method', 'error');
    return;
  }

  // Save order to LocalStorage
  const order = {
    items: cart.map(item => ({
      name: item.name,
      emoji: item.emoji,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      subtotal: item.price * item.qty
    })),
    total: getCartTotal(),
    location: location,
    mapsLink: customerLocation.mapsLink || '',
    payment: payment
  };

  FreshMartStore.addOrder(order);

  cart = [];
  document.getElementById('deliveryLocation').value = '';
  document.getElementById('paymentType').selectedIndex = 0;
  customerLocation = { text: '', mapsLink: '' };
  
  updateCartUI();
  renderProducts();
  showToast('🎉 Order placed successfully!', 'success');
  toggleCart();
}

// ── Geolocation — Live Location ─────────────────────────────

function getMyLocation() {
  const btn = document.getElementById('liveLocationBtn');
  const status = document.getElementById('locationStatus');
  const input = document.getElementById('deliveryLocation');

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  // Show loading state
  btn.classList.add('loading');
  btn.textContent = 'Locating...';
  status.textContent = 'Getting your location...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const mapsLink = `https://maps.google.com/maps?q=${lat},${lng}`;

      // Store for WhatsApp message
      customerLocation.mapsLink = mapsLink;
      customerLocation.text = `Lat: ${lat}, Lng: ${lng}`;

      // Update input with coordinates
      input.value = `GPS: ${lat}, ${lng}`;

      // Update status with clickable maps link
      status.innerHTML = `Location found! <a href="${mapsLink}" target="_blank">View on Google Maps</a>`;

      // Update button state
      btn.classList.remove('loading');
      btn.classList.add('success');
      btn.textContent = 'Location Set';

      showToast('Location captured successfully!', 'success');
      validateOrder();

      // Reset button after 3 seconds
      setTimeout(() => {
        btn.classList.remove('success');
        btn.textContent = '📍 Use My Location';
      }, 3000);
    },
    (error) => {
      btn.classList.remove('loading');
      btn.textContent = '📍 Use My Location';

      let msg = 'Could not get your location. ';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg += 'Please allow location access in your browser.';
          break;
        case error.POSITION_UNAVAILABLE:
          msg += 'Location info unavailable.';
          break;
        case error.TIMEOUT:
          msg += 'Request timed out. Try again.';
          break;
        default:
          msg += 'Please type your address manually.';
      }
      status.textContent = msg;
      showToast(msg, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ── Toast Notifications ─────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✓', error: '✗', info: 'i' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
