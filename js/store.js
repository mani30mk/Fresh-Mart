// ═══════════════════════════════════════════════════════════
// FreshMart Store — Firebase Firestore Data Layer
// ═══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyAJaqgMTRB--hWa_mRTmxocbpnFOUDmbLc",
  authDomain: "fresh-mart-2ac19.firebaseapp.com",
  projectId: "fresh-mart-2ac19",
  storageBucket: "fresh-mart-2ac19.firebasestorage.app",
  messagingSenderId: "639894755198",
  appId: "1:639894755198:web:19676dd8215ee54ea2052f",
  measurementId: "G-1Y3JBV53VG"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const FreshMartStore = (() => {
  const SELLER_PIN = '6382';
  const WA_NUMBER = '917305235834';

  const defaultProducts = [
    { emoji: "🍎", name: "Apple", price: 80, unit: "kg", category: "fruits", inStock: true },
    { emoji: "🍌", name: "Banana", price: 40, unit: "dozen", category: "fruits", inStock: true },
    { emoji: "🍅", name: "Tomato", price: 30, unit: "kg", category: "vegetables", inStock: true },
    { emoji: "🥕", name: "Carrot", price: 35, unit: "kg", category: "vegetables", inStock: true },
    { emoji: "🥦", name: "Broccoli", price: 60, unit: "piece", category: "vegetables", inStock: true },
    { emoji: "🍇", name: "Grapes", price: 90, unit: "kg", category: "fruits", inStock: true },
    { emoji: "🥔", name: "Potato", price: 25, unit: "kg", category: "vegetables", inStock: true },
    { emoji: "🧅", name: "Onion", price: 30, unit: "kg", category: "vegetables", inStock: true },
    { emoji: "🍋", name: "Lemon", price: 10, unit: "piece", category: "fruits", inStock: true },
    { emoji: "🥭", name: "Mango", price: 120, unit: "kg", category: "fruits", inStock: true },
    { emoji: "🌿", name: "Spinach", price: 20, unit: "bunch", category: "leafy", inStock: true },
    { emoji: "🍆", name: "Brinjal", price: 28, unit: "kg", category: "vegetables", inStock: true },
  ];

  // ── Products ──────────────────────────────────────────────

  function listenToProducts(callback) {
    return db.collection('products').onSnapshot(snapshot => {
      const products = [];
      snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
      callback(products);
    }, error => console.error("Error listening to products: ", error));
  }

  async function addProduct(product) {
    product.inStock = true;
    const docRef = await db.collection('products').add(product);
    return { id: docRef.id, ...product };
  }

  async function updateProduct(id, updates) {
    await db.collection('products').doc(id).update(updates);
  }

  async function deleteProduct(id) {
    await db.collection('products').doc(id).delete();
  }

  // ── Customers ─────────────────────────────────────────────

  async function getCustomerByPhone(phone) {
    const snapshot = await db.collection('customers').where('phone', '==', phone).get();
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }

  async function addCustomer(name, phone, password) {
    const newCustomer = { name, phone, password, points: 0, joinedAt: new Date().toISOString() };
    const docRef = await db.collection('customers').add(newCustomer);
    return { id: docRef.id, ...newCustomer };
  }

  async function updateCustomerPoints(phone, pointsDelta) {
    const snapshot = await db.collection('customers').where('phone', '==', phone).get();
    if (snapshot.empty) return;
    const doc = snapshot.docs[0];
    const currentPoints = doc.data().points || 0;
    await db.collection('customers').doc(doc.id).update({ points: currentPoints + pointsDelta });
  }

  // ── Orders ────────────────────────────────────────────────

  function listenToOrders(callback) {
    return db.collection('orders').orderBy('date', 'desc').onSnapshot(snapshot => {
      const orders = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
      callback(orders);
    }, error => console.error("Error listening to orders: ", error));
  }

  async function addOrder(order) {
    order.date = new Date().toISOString();
    order.status = 'pending';
    const docRef = await db.collection('orders').add(order);
    return { id: docRef.id, ...order };
  }

  async function updateOrderStatus(id, status, pointsAwarded = undefined) {
    const updates = { status };
    if (pointsAwarded !== undefined) {
      updates.pointsAwarded = pointsAwarded;
    }
    await db.collection('orders').doc(id).update(updates);
  }

  async function getCustomerOrders(phone) {
    const snapshot = await db.collection('orders').where('customerPhone', '==', phone).get();
    const orders = [];
    snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
    return orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function deleteOrder(id) {
    await db.collection('orders').doc(id).delete();
  }

  // ── Auth & Stats ──────────────────────────────────────────

  function verifyPin(pin) {
    return pin === SELLER_PIN;
  }

  async function getStats() {
    const prodSnap = await db.collection('products').get();
    const ordSnap = await db.collection('orders').get();
    
    const products = [];
    prodSnap.forEach(d => products.push(d.data()));
    
    const orders = [];
    let revenue = 0;
    ordSnap.forEach(d => {
      const o = d.data();
      orders.push(o);
      revenue += (o.total || 0);
    });
    
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

  function formatPrice(price) {
    return '₹' + Number(price).toLocaleString('en-IN');
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  async function exportOrders() {
    const snap = await db.collection('orders').orderBy('date', 'desc').get();
    const orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
    
    const csv = [
      'Order ID,Date,Items,Total,Location,Payment,Status',
      ...orders.map(o => {
        const items = o.items.map(i => `${i.name} x${i.qty}${i.unit}`).join('; ');
        return `${o.id},"${formatDate(o.date)}","${items}",${o.total},"${o.location}",${o.payment},${o.status}`;
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

  async function init() {
    try {
      const snapshot = await db.collection('products').limit(1).get();
      if (snapshot.empty) {
        console.log("Seeding initial products into Firestore...");
        for (const p of defaultProducts) {
          await addProduct(p);
        }
        console.log("Seeding complete!");
      }
    } catch (e) {
      console.error("Error connecting to Firestore: ", e);
    }
  }

  return {
    listenToProducts, addProduct, updateProduct, deleteProduct, getCustomerByPhone,
    addCustomer,
    updateCustomerPoints,
    listenToOrders,
    addOrder,
    updateOrderStatus,
    deleteOrder,
    getCustomerOrders,
    verifyPin, getStats, getWhatsAppNumber,
    formatPrice, formatDate, exportOrders, init
  };
})();

FreshMartStore.init();
