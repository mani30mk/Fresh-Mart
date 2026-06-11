// ═══════════════════════════════════════════════════════════
// FreshMart Store — LocalStorage Data Layer
// Shared between Customer & Seller pages
// ═══════════════════════════════════════════════════════════

const FreshMartStore = (() => {
  const PRODUCTS_KEY = 'freshmart_products';
  const ORDERS_KEY = 'freshmart_orders';
  const SELLER_PIN = '6382';
  const WA_NUMBER = '917305235834';

  const defaultProducts = [
    { id: 1, emoji: "🍎", name: "Apple", price: 80, unit: "kg", category: "fruits", inStock: true },
    { id: 2, emoji: "🍌", name: "Banana", price: 40, unit: "dozen", category: "fruits", inStock: true },
    { id: 3, emoji: "🍅", name: "Tomato", price: 30, unit: "kg", category: "vegetables", inStock: true },
    { id: 4, emoji: "🥕", name: "Carrot", price: 35, unit: "kg", category: "vegetables", inStock: true },
    { id: 5, emoji: "🥦", name: "Broccoli", price: 60, unit: "piece", category: "vegetables", inStock: true },
    { id: 6, emoji: "🍇", name: "Grapes", price: 90, unit: "kg", category: "fruits", inStock: true },
    { id: 7, emoji: "🥔", name: "Potato", price: 25, unit: "kg", category: "vegetables", inStock: true },
    { id: 8, emoji: "🧅", name: "Onion", price: 30, unit: "kg", category: "vegetables", inStock: true },
    { id: 9, emoji: "🍋", name: "Lemon", price: 10, unit: "piece", category: "fruits", inStock: true },
    { id: 10, emoji: "🥭", name: "Mango", price: 120, unit: "kg", category: "fruits", inStock: true },
    { id: 11, emoji: "🌿", name: "Spinach", price: 20, unit: "bunch", category: "leafy", inStock: true },
    { id: 12, emoji: "🍆", name: "Brinjal", price: 28, unit: "kg", category: "vegetables", inStock: true },
  ];

  // ── Products ──────────────────────────────────────────────

  function getProducts() {
    const data = localStorage.getItem(PRODUCTS_KEY);
    if (!data) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
      return [...defaultProducts];
    }
    return JSON.parse(data);
  }

  function saveProducts(products) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }

  function addProduct(product) {
    const products = getProducts();
    product.id = Date.now();
    product.inStock = true;
    products.push(product);
    saveProducts(products);
    return product;
  }

  function updateProduct(id, updates) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      saveProducts(products);
      return products[index];
    }
    return null;
  }

  function deleteProduct(id) {
    const products = getProducts().filter(p => p.id !== id);
    saveProducts(products);
  }

  // ── Orders ────────────────────────────────────────────────

  function getOrders() {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  function addOrder(order) {
    const orders = getOrders();
    order.id = 'FM-' + String(1000 + orders.length + 1);
    order.date = new Date().toISOString();
    order.status = 'pending';
    orders.unshift(order); // newest first
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return order;
  }

  function updateOrderStatus(id, status) {
    const orders = getOrders();
    const order = orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    }
    return order;
  }

  function deleteOrder(id) {
    const orders = getOrders().filter(o => o.id !== id);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }

  // ── Auth & Stats ──────────────────────────────────────────

  function verifyPin(pin) {
    return pin === SELLER_PIN;
  }

  function getStats() {
    const products = getProducts();
    const orders = getOrders();
    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    return {
      totalProducts: products.length,
      inStockProducts: products.filter(p => p.inStock).length,
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      revenue
    };
  }

  function getWhatsAppNumber() {
    return WA_NUMBER;
  }

  // ── Utilities ─────────────────────────────────────────────

  function formatPrice(price) {
    return '₹' + Number(price).toLocaleString('en-IN');
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function exportOrders() {
    const orders = getOrders();
    const csv = [
      'Order ID,Date,Items,Total,Location,Payment,Status',
      ...orders.map(o => {
        const items = o.items.map(i => `${i.name} x${i.qty}${i.unit}`).join('; ');
        return `${o.id},"${FreshMartStore.formatDate(o.date)}","${items}",${o.total},"${o.location}",${o.payment},${o.status}`;
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freshmart-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initialize on first load
  function init() {
    if (!localStorage.getItem(PRODUCTS_KEY)) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
    }
  }

  return {
    getProducts, saveProducts, addProduct, updateProduct, deleteProduct,
    getOrders, addOrder, updateOrderStatus, deleteOrder,
    verifyPin, getStats, getWhatsAppNumber,
    formatPrice, formatDate, exportOrders, init
  };
})();

FreshMartStore.init();
