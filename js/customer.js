// ═══════════════════════════════════════════════════════════
// FreshMart — Customer Page Logic
// Cart, WhatsApp ordering, QR code, product rendering
// ═══════════════════════════════════════════════════════════

const WA_NUMBER = FreshMartStore.getWhatsAppNumber();
let cart = [];
// ── Initialization ─────────────────────────────────────────────

const auth = firebase.auth();
let allProducts = [];
let activeCategory = 'all';
let customerLocation = { text: '', mapsLink: '' };
let isPointsApplied = false;
let pendingOrder = null;

let currentUser = null;
let authPhoneTemp = '';
let authNameTemp = '';

// ── Initialize ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  FreshMartStore.listenToProducts((products) => {
    allProducts = products;
    renderProducts();
  });
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

// ── Authentication ──────────────────────────────────────────

async function checkAuth() {
  const sessionUser = localStorage.getItem('freshmart_customer_auth');
  if (sessionUser) {
    currentUser = JSON.parse(sessionUser);
    updateAuthUI(); // Show immediate UI
    
    // Fetch latest points in background
    const c = await FreshMartStore.getCustomerByPhone(currentUser.phone);
    if (c) {
      currentUser.points = c.points || 0;
      localStorage.setItem('freshmart_customer_auth', JSON.stringify(currentUser));
      updateAuthUI(); // Update UI with latest points
    }
  } else {
    updateAuthUI();
  }
}

function updateAuthUI() {
  const authNavArea = document.getElementById('authNavArea');
  if (!authNavArea) return;

  if (currentUser) {
    const pts = currentUser.points || 0;
    authNavArea.innerHTML = `
      <button class="nav-link" onclick="openProfileModal()" style="padding: 4px 6px; font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:4px; max-width: 140px;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 70px;" title="${currentUser.name}">👤 ${currentUser.name.split(' ')[0]}</span>
        <span style="background:var(--lime); color:var(--leaf-dark); padding:2px 4px; border-radius:10px; font-size:0.7rem; font-weight:800; box-shadow:0 2px 4px rgba(0,0,0,0.1); flex-shrink:0;">🌟 ${pts}</span>
      </button>
      <button class="nav-link" onclick="handleLogout()" style="padding: 4px 6px; font-size:0.75rem;" title="Logout">Logout</button>
    `;
  } else {
    authNavArea.innerHTML = `
      <button class="nav-link" onclick="openAuthModal()">Login</button>
    `;
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('freshmart_customer_auth');
  updateAuthUI();
  showToast('Logged out successfully', 'info');
}

function openAuthModal() {
  document.getElementById('authPhone').value = '';
  document.getElementById('authName').value = '';
  document.getElementById('authLoginPassword').value = '';
  document.getElementById('authSetPassword').value = '';
  
  document.getElementById('authPhoneStep').style.display = 'block';
  document.getElementById('authNameStep').style.display = 'none';
  document.getElementById('authLoginPasswordStep').style.display = 'none';
  document.getElementById('authSetPasswordStep').style.display = 'none';
  
  document.getElementById('authModalTitle').textContent = 'Welcome to FreshMart';
  document.getElementById('authModalDesc').textContent = 'Enter your phone number to continue';
  
  document.getElementById('authModal').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

// ── Profile Modal ───────────────────────────────────────────

async function openProfileModal() {
  if (!currentUser) return;
  // Refresh customer points from DB
  const c = await FreshMartStore.getCustomerByPhone(currentUser.phone);
  if (c) {
    currentUser.points = c.points || 0;
    localStorage.setItem('freshmart_customer_auth', JSON.stringify(currentUser));
  }
  
  document.getElementById('profilePointsBalance').textContent = currentUser.points || 0;
  document.getElementById('profileModal').classList.add('open');
  
  const ordersList = document.getElementById('profileOrdersList');
  ordersList.innerHTML = '<div style="text-align:center; padding: 24px;">Loading...</div>';
  
  const orders = await FreshMartStore.getCustomerOrders(currentUser.phone);
  
  if (orders.length === 0) {
    ordersList.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--light);">No orders yet</div>';
  } else {
    ordersList.innerHTML = orders.map(o => {
      const pEarned = o.pointsAwarded ? o.pointsAwarded : 0;
      return `
        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span style="font-size:0.8rem; color:var(--light);">${FreshMartStore.formatDate(o.date)}</span>
            <span style="font-size:0.8rem; font-weight:600;" class="order-status ${o.status}">${o.status}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <div style="font-weight:700; font-size:1rem;">${FreshMartStore.formatPrice(o.total)}</div>
              ${o.discount ? `<div style="font-size:0.75rem; color:var(--wa);">Saved ₹${o.discount} with points</div>` : ''}
            </div>
            ${pEarned > 0 ? `<div style="font-size:0.8rem; font-weight:600; color:var(--wa);">+${pEarned} 🌟</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('open');
}

async function handleAuthPhone() {
  const phone = document.getElementById('authPhone').value.trim();
  
  if (phone === 'admin888') {
    window.location.href = 'seller.html';
    return;
  }

  if (phone.length !== 10 || isNaN(phone)) {
    showToast('Please enter a valid 10-digit phone number', 'error');
    return;
  }
  
  const btn = document.querySelector('#authPhoneStep button');
  const originalText = btn.textContent;
  btn.textContent = 'Checking...';
  btn.disabled = true;

  try {
    authPhoneTemp = phone;
    const existingCustomer = await FreshMartStore.getCustomerByPhone(phone);
    
    if (existingCustomer) {
      document.getElementById('authPhoneStep').style.display = 'none';
      document.getElementById('authLoginPasswordStep').style.display = 'block';
      document.getElementById('authModalTitle').textContent = 'Welcome Back';
      document.getElementById('authModalDesc').textContent = 'Enter your password to login';
    } else {
      document.getElementById('authPhoneStep').style.display = 'none';
      document.getElementById('authNameStep').style.display = 'block';
      document.getElementById('authModalTitle').textContent = 'Create Account';
      document.getElementById('authModalDesc').textContent = 'Please tell us your name';
    }
  } catch (error) {
    console.error("Firestore Error:", error);
    alert("Database connection failed: " + error.message + "\n\n(If it says 'Missing or insufficient permissions', your Firestore Database Rules need to be updated to Test Mode!)");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleLoginPassword() {
  const pwd = document.getElementById('authLoginPassword').value;
  if (!pwd) return showToast('Please enter password', 'error');

  const btn = document.getElementById('loginBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Logging in...';
  btn.disabled = true;

  try {
    const dummyEmail = authPhoneTemp + '@freshmart.local';
    await auth.signInWithEmailAndPassword(dummyEmail, pwd);
    
    const customer = await FreshMartStore.getCustomerByPhone(authPhoneTemp);
    if (customer) {
      currentUser = customer;
      localStorage.setItem('freshmart_customer_auth', JSON.stringify(customer));
      updateAuthUI();
      closeAuthModal();
      showToast(`Welcome back, ${customer.name}!`, 'success');
      if (document.getElementById('cartPanel').classList.contains('open')) {
        validateOrder();
      }
    } else {
      showToast('Error: Customer data not found', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('Incorrect password or login failed', 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function handleAuthName() {
  const name = document.getElementById('authName').value.trim();
  if (!name) {
    showToast('Please enter your name', 'error');
    return;
  }
  
  authNameTemp = name;
  document.getElementById('authNameStep').style.display = 'none';
  document.getElementById('authSetPasswordStep').style.display = 'block';
  document.getElementById('authModalTitle').textContent = 'Secure Account';
  document.getElementById('authModalDesc').textContent = 'Create a password for your account';
}

async function handleSetPassword() {
  const pwd = document.getElementById('authSetPassword').value;
  if (pwd.length < 6) return showToast('Password must be at least 6 characters', 'error');

  const btn = document.getElementById('createAccountBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Creating Account...';
  btn.disabled = true;

  try {
    const dummyEmail = authPhoneTemp + '@freshmart.local';
    await auth.createUserWithEmailAndPassword(dummyEmail, pwd);
    
    // Store empty password in Firestore, Firebase Auth handles security
    const customer = await FreshMartStore.addCustomer(authNameTemp, authPhoneTemp, "");
    currentUser = customer;
    localStorage.setItem('freshmart_customer_auth', JSON.stringify(customer));
    updateAuthUI();
    closeAuthModal();
    showToast('Account created successfully!', 'success');
    if (document.getElementById('cartPanel').classList.contains('open')) {
      validateOrder();
    }
  } catch (error) {
    console.error(error);
    showToast('Error creating account: ' + error.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ── Product Rendering ───────────────────────────────────────

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const products = allProducts;

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
              <button class="qty-btn" onclick="event.stopPropagation(); changeProductQty('${product.id}', -1)">−</button>
              <div class="qty-display" id="qty-${product.id}">${cartQty}</div>
              <button class="qty-btn" onclick="event.stopPropagation(); changeProductQty('${product.id}', 1)">+</button>
            </div>
          </div>
          <button class="add-to-cart-btn ${inCart ? 'in-cart' : ''}" onclick="addToCart('${product.id}')">
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
  const products = allProducts;
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

  // Calculate Points Discount
  let discount = 0;
  let pointsUsed = 0;
  let subtotal = getCartTotal();

  if (currentUser && currentUser.points >= 100) {
    document.getElementById('pointsRedeemArea').style.display = 'block';
    const maxPointsToUse = Math.floor(currentUser.points / 100) * 100;
    const maxDiscount = (maxPointsToUse / 100) * 20;

    // Prevent discount from exceeding subtotal
    if (maxDiscount >= subtotal) {
      pointsUsed = Math.ceil(subtotal / 20) * 100;
      discount = subtotal;
    } else {
      pointsUsed = maxPointsToUse;
      discount = maxDiscount;
    }

    document.getElementById('cartAvailablePoints').textContent = currentUser.points;
    document.getElementById('cartPointsToUse').textContent = pointsUsed;
    document.getElementById('cartPointsDiscount').textContent = discount;

    const btn = document.getElementById('applyPointsBtn');
    if (isPointsApplied) {
      btn.textContent = 'Remove';
      btn.style.background = 'var(--tomato)';
    } else {
      btn.textContent = 'Apply';
      btn.style.background = 'var(--leaf)';
      discount = 0;
      pointsUsed = 0;
    }
  } else {
    document.getElementById('pointsRedeemArea').style.display = 'none';
    isPointsApplied = false;
  }

  // Update total
  const finalTotal = subtotal - discount;
  const totalHtml = discount > 0 
    ? `<span style="text-decoration: line-through; color: var(--light); font-size: 0.85rem; margin-right: 8px;">${FreshMartStore.formatPrice(subtotal)}</span> ${FreshMartStore.formatPrice(finalTotal)}`
    : FreshMartStore.formatPrice(finalTotal);
    
  document.getElementById('cartTotalValue').innerHTML = totalHtml;

  // Update WhatsApp button state
  validateOrder();
}

function togglePointsDiscount() {
  isPointsApplied = !isPointsApplied;
  updateCartUI();
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
  
  // Update button text contextually
  let isValid = false;
  if (!currentUser) {
    // If not logged in, button should say "Login to Order"
    btn.textContent = '🔒 Login to Order';
    btn.classList.remove('disabled');
    btn.disabled = false;
  } else {
    btn.textContent = '🛍️ Place Order';
    isValid = cart.length > 0 && location.length > 0 && payment.length > 0;
    btn.classList.toggle('disabled', !isValid);
    btn.disabled = !isValid;
  }
}

// Add input listeners for validation
document.getElementById('deliveryLocation').addEventListener('input', validateOrder);
document.getElementById('paymentType').addEventListener('change', validateOrder);

// ── Place Order ─────────────────────────────────────────────

async function placeOrder(event) {
  if (!currentUser) {
    event.preventDefault();
    openAuthModal();
    return;
  }

  const location = document.getElementById('deliveryLocation').value.trim();
  const payment = document.getElementById('paymentType').value;

  if (cart.length === 0 || !location || !payment) {
    event.preventDefault();
    if (cart.length === 0) showToast('Your cart is empty!', 'error');
    else if (!location) showToast('Please enter your delivery location', 'error');
    else if (!payment) showToast('Please select a payment method', 'error');
    return;
  }

  // Calculate Points Discount
  let discount = 0;
  let pointsUsed = 0;
  let subtotal = getCartTotal();

  if (currentUser && currentUser.points >= 100 && isPointsApplied) {
    const maxPointsToUse = Math.floor(currentUser.points / 100) * 100;
    const maxDiscount = (maxPointsToUse / 100) * 20;
    if (maxDiscount >= subtotal) {
      pointsUsed = Math.ceil(subtotal / 20) * 100;
      discount = subtotal;
    } else {
      pointsUsed = maxPointsToUse;
      discount = maxDiscount;
    }
  }

  // Save order to LocalStorage
  const order = {
    customerName: currentUser.name,
    customerPhone: currentUser.phone,
    items: cart.map(item => ({
      name: item.name,
      emoji: item.emoji,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      subtotal: item.price * item.qty
    })),
    subtotal: subtotal,
    discount: discount,
    pointsUsed: pointsUsed,
    total: subtotal - discount,
    location: location,
    mapsLink: customerLocation.mapsLink || '',
    payment: payment
  };

  if (payment === 'UPI' || payment === 'GPay') {
    pendingOrder = order;
    openUpiModal(order.total);
    return;
  }

  await submitOrderToStore(order);
}

// ── UPI Payment Flow ──────────────────────────────────────────

function openUpiModal(amount) {
  document.getElementById('upiAmountText').textContent = amount;
  
  // Generate UPI Intent String
  const upiId = 'maniofficial.ac.in@okhdfcbank';
  const payeeName = 'FreshMart';
  const upiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount}&cu=INR`;
  
  document.getElementById('upiPayAppBtn').href = upiUrl;

  // Generate QR Code
  const qrDiv = document.getElementById('upiQrCode');
  qrDiv.innerHTML = ''; // clear previous
  try {
    const qr = qrcode(0, 'M');
    qr.addData(upiUrl);
    qr.make();
    qrDiv.innerHTML = qr.createImgTag(5, 10);
  } catch(e) {
    console.error("QR Code generation failed", e);
  }

  document.getElementById('upiModal').classList.add('open');
}

function closeUpiModal() {
  document.getElementById('upiModal').classList.remove('open');
  pendingOrder = null;
  const btn = document.getElementById('placeOrderBtn');
  btn.textContent = '🛍️ Place Order';
  btn.disabled = false;
}

async function confirmUpiPayment() {
  if (!pendingOrder) return;
  document.getElementById('upiModal').classList.remove('open');
  await submitOrderToStore(pendingOrder);
  pendingOrder = null;
}

// ── Submit to Firebase ────────────────────────────────────────

async function submitOrderToStore(order) {
  const btn = document.getElementById('placeOrderBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Placing Order...';
  btn.disabled = true;

  try {
    await FreshMartStore.addOrder(order);

    if (order.pointsUsed > 0) {
      await FreshMartStore.updateCustomerPoints(currentUser.phone, -order.pointsUsed);
      currentUser.points -= order.pointsUsed;
      localStorage.setItem('freshmart_customer_auth', JSON.stringify(currentUser));
    }

    cart = [];
    isPointsApplied = false;
    document.getElementById('deliveryLocation').value = '';
    document.getElementById('paymentType').selectedIndex = 0;
    customerLocation = { text: '', mapsLink: '' };
    
    updateCartUI();
    renderProducts();

    // ── Send Email Notification via Web3Forms ──
    const itemsText = order.items.map(i => `- ${i.name} (x${i.qty}${i.unit})`).join('\n');
    const messageBody = `
New Order Received!

Customer: ${order.customerName}
Phone: ${order.customerPhone}

Items Ordered:
${itemsText}

Subtotal: ₹${order.subtotal}
Discount: -₹${order.discount}
Total: ₹${order.total}

Payment Method: ${order.payment}
Delivery Location: ${order.location}
Map Link: ${order.mapsLink || 'Not provided'}
`;

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        access_key: "214b49d4-e49c-49c0-aaa2-2f81c0654031",
        name: order.customerName,
        subject: `New FreshMart Order from ${order.customerName}`,
        from_name: "FreshMart Orders",
        message: messageBody
      })
    }).catch(err => console.error("Web3Forms error:", err));

    showToast('🎉 Order placed successfully!', 'success');
    toggleCart();
  } catch (error) {
    console.error("Error placing order:", error);
    showToast('Error placing order. Please try again.', 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
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
