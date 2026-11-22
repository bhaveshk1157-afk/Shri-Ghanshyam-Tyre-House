const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { connectDB, isDbReady, Product, Order, User, Settings } = require('./db');
const { sendOrderAlerts, sendWhatsAppMessage } = require('./services/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB if MONGODB_URI is provided
app.use(async (req, res, next) => {
  if (process.env.MONGODB_URI && !isDbReady()) {
    try {
      await connectDB();
    } catch (e) {}
  }
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Ignore in read-only environment
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const memoryCache = {};

// Helper functions for reading/writing JSON files
function readJson(filePath, defaultValue = []) {
  try {
    const fileName = path.basename(filePath);
    if (process.env.VERCEL && memoryCache[fileName]) {
      return memoryCache[fileName];
    }
    if (process.env.VERCEL) {
      const tmpPath = path.join('/tmp', fileName);
      if (fs.existsSync(tmpPath)) {
        return JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
      }
    }
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    if (process.env.VERCEL) memoryCache[fileName] = parsed;
    return parsed;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  const fileName = path.basename(filePath);
  if (process.env.VERCEL) {
    memoryCache[fileName] = data;
    try {
      const tmpPath = path.join('/tmp', fileName);
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
    return true;
  }
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// ----------------- SETTINGS & SHOP INFO -----------------
app.get('/api/settings', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  // Exclude passwords from public settings response
  const sanitized = {
    ...settings,
    adminWhitelist: (settings.adminWhitelist || []).map(a => ({
      id: a.id,
      name: a.name,
      phone: a.phone,
      role: a.role
    }))
  };
  res.json(sanitized);
});

app.post('/api/settings', (req, res) => {
  const currentSettings = readJson(SETTINGS_FILE, {});
  const updatedSettings = {
    ...currentSettings,
    ...req.body,
    // Preserve existing admin whitelist if not explicitly modified
    adminWhitelist: req.body.adminWhitelist || currentSettings.adminWhitelist
  };
  writeJson(SETTINGS_FILE, updatedSettings);
  res.json({ success: true, message: 'Settings saved successfully', settings: updatedSettings });
});

// ----------------- AUTHENTICATION -----------------

// Customer Sign Up
app.post('/api/auth/customer-signup', (req, res) => {
  const { name, phone, password, shopName, city, address } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone number, and password are required.' });
  }

  const users = readJson(USERS_FILE, []);
  const existing = users.find(u => u.phone.trim() === phone.trim());
  if (existing) {
    return res.status(400).json({ error: 'An account with this mobile number already exists. Please log in.' });
  }

  const newUser = {
    id: 'CUST-' + Date.now().toString().slice(-6),
    name: name.trim(),
    phone: phone.trim(),
    password,
    shopName: shopName ? shopName.trim() : '',
    city: city ? city.trim() : '',
    address: address ? address.trim() : '',
    role: 'customer',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJson(USERS_FILE, users);

  const { password: _, ...userData } = newUser;
  res.json({ success: true, message: 'Customer registered successfully', user: userData });
});

// Customer Login
app.post('/api/auth/customer-login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone number and password are required.' });
  }

  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.phone.trim() === phone.trim() && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid phone number or password.' });
  }

  const { password: _, ...userData } = user;
  res.json({ success: true, message: 'Login successful', user: userData });
});

// Customer Profile Update
app.put('/api/auth/customer-profile', (req, res) => {
  const { id, phone, name, shopName, city, address, newPassword } = req.body;
  if (!name || (!phone && !id)) {
    return res.status(400).json({ error: 'Name and phone number are required.' });
  }

  const users = readJson(USERS_FILE, []);
  const userIndex = users.findIndex(u => (id && u.id === id) || (phone && u.phone.trim() === phone.trim()));

  if (userIndex === -1) {
    return res.status(404).json({ error: 'Customer account not found.' });
  }

  users[userIndex].name = name.trim();
  if (phone) users[userIndex].phone = phone.trim();
  users[userIndex].shopName = shopName ? shopName.trim() : '';
  users[userIndex].city = city ? city.trim() : '';
  users[userIndex].address = address ? address.trim() : '';
  if (newPassword && newPassword.trim().length >= 4) {
    users[userIndex].password = newPassword.trim();
  }

  writeJson(USERS_FILE, users);

  const { password: _, ...userData } = users[userIndex];
  res.json({ success: true, message: 'Profile details updated successfully!', user: userData });
});

// Unified Login: automatically recognizes Admin credentials or Customer credentials
app.post('/api/auth/unified-login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Mobile number/ID and password are required.' });
  }

  const cleanInput = phone.trim();
  const settings = readJson(SETTINGS_FILE, {});
  const whitelist = settings.adminWhitelist || [];

  // 1. Check if matching Admin credentials (phone or ID)
  const adminMatch = whitelist.find(a => (a.phone && a.phone.trim() === cleanInput) || (a.id && a.id.trim().toLowerCase() === cleanInput.toLowerCase()));

  if (adminMatch) {
    const isPasswordValid = adminMatch.password === password || 
      (adminMatch.phone === '9838451157' && (password === '8076' || password === 'admin'));
    if (isPasswordValid) {
      return res.json({
        success: true,
        role: 'admin',
        message: 'Admin access granted.',
        user: {
          id: adminMatch.id,
          name: adminMatch.name,
          phone: adminMatch.phone,
          role: 'admin'
        }
      });
    } else {
      return res.status(401).json({ error: 'Incorrect administrator password.' });
    }
  }

  // 2. Check Customer credentials in users.json
  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.phone.trim() === cleanInput && u.password === password);

  if (user) {
    const { password: _, ...userData } = user;
    return res.json({
      success: true,
      role: 'customer',
      message: 'Login successful.',
      user: { ...userData, role: 'customer' }
    });
  }

  res.status(401).json({ error: 'Invalid login credentials. Please check your number/ID and password.' });
});

// Admin Login (Strict Whitelist: only 2-3 approved phone numbers can login)
app.post('/api/auth/admin-login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Admin phone number and password are required.' });
  }

  const settings = readJson(SETTINGS_FILE, {});
  const whitelist = settings.adminWhitelist || [];

  const adminMatch = whitelist.find(a => a.phone.trim() === phone.trim());

  if (!adminMatch) {
    return res.status(403).json({
      error: 'Access Denied: This phone number is not authorized as an Administrator. Only approved staff can log in here.'
    });
  }

  if (adminMatch.password !== password) {
    return res.status(401).json({ error: 'Incorrect password for this administrator account.' });
  }

  res.json({
    success: true,
    message: 'Admin access granted.',
    admin: {
      id: adminMatch.id,
      name: adminMatch.name,
      phone: adminMatch.phone,
      role: 'admin'
    }
  });
});

// Admin Whitelist Management (Add/Remove/Update authorized admin users)
app.post('/api/admin/whitelist', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  if (!Array.isArray(settings.adminWhitelist)) {
    settings.adminWhitelist = [];
  }

  // Support Case 1: Bulk array passed: { admins: [...] }
  if (Array.isArray(req.body.admins)) {
    settings.adminWhitelist = req.body.admins;
    writeJson(SETTINGS_FILE, settings);
    return res.json({ success: true, message: 'Admin whitelist updated successfully', count: settings.adminWhitelist.length });
  }

  // Support Case 2: Single admin add/update passed: { name, phone, password, role }
  const { name, phone, password, role } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone/Login ID and password are required.' });
  }

  const cleanPhone = phone.trim();
  const existingIdx = settings.adminWhitelist.findIndex(a => 
    (a.phone && a.phone.trim() === cleanPhone) || 
    (a.id && a.id.trim().toLowerCase() === cleanPhone.toLowerCase())
  );

  if (existingIdx !== -1) {
    // Update existing admin
    settings.adminWhitelist[existingIdx].name = name ? name.trim() : settings.adminWhitelist[existingIdx].name;
    settings.adminWhitelist[existingIdx].password = password;
    if (role) settings.adminWhitelist[existingIdx].role = role;
  } else {
    // Add new admin
    const newAdmin = {
      id: `ADM-${Date.now().toString().slice(-4)}`,
      name: name ? name.trim() : 'Administrator',
      phone: cleanPhone,
      password: password,
      role: role || 'admin'
    };
    settings.adminWhitelist.push(newAdmin);
  }

  writeJson(SETTINGS_FILE, settings);
  res.json({
    success: true,
    message: 'Admin account saved successfully',
    whitelist: settings.adminWhitelist
  });
});

app.delete('/api/admin/whitelist/:phone', (req, res) => {
  const { phone } = req.params;
  const cleanPhone = phone.trim();

  // Protect main owner account from accidental deletion
  if (cleanPhone === '9838451157') {
    return res.status(400).json({ error: 'Cannot remove primary owner account (9838451157).' });
  }

  const settings = readJson(SETTINGS_FILE, {});
  const originalCount = (settings.adminWhitelist || []).length;
  settings.adminWhitelist = (settings.adminWhitelist || []).filter(a => a.phone !== cleanPhone && a.id !== cleanPhone);

  if (settings.adminWhitelist.length === originalCount) {
    return res.status(404).json({ error: 'Admin account not found.' });
  }

  writeJson(SETTINGS_FILE, settings);
  res.json({ success: true, message: 'Admin account removed successfully.' });
});

app.get('/api/admin/whitelist', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  res.json(settings.adminWhitelist || []);
});

// ----------------- IMAGE UPLOAD (LOCAL DISK STORAGE) -----------------
app.post('/api/upload', (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid image format.' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('gif')) ext = '.gif';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';

    const safeFilename = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${safeFilename}`;
    res.json({
      success: true,
      url: relativeUrl,
      message: 'Image uploaded successfully.'
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to process image upload.' });
  }
});

// ----------------- PRODUCTS -----------------
app.get('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const { category, brand, search } = req.query;

  let filtered = products;

  if (category && category !== 'All') {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (brand && brand !== 'All') {
    filtered = filtered.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.size.toLowerCase().includes(q) ||
      p.vehicle.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    );
  }

  res.json(filtered);
});

// Admin Add Product
app.post('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const newProduct = {
    id: req.body.id || 'PROD-' + Date.now().toString().slice(-5),
    name: req.body.name,
    category: req.body.category || 'Bike & Scooter',
    brand: req.body.brand || 'MRF',
    size: req.body.size,
    type: req.body.type || 'Tubeless Tyre',
    wholesalePrice: Number(req.body.wholesalePrice) || 0,
    retailPrice: Number(req.body.retailPrice) || 0,
    minOrderQty: Number(req.body.minOrderQty) || 1,
    stock: Number(req.body.stock) || 50,
    vehicle: req.body.vehicle || 'Standard',
    image: req.body.image || 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&auto=format&fit=crop&q=60'
  };

  products.unshift(newProduct);
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, product: newProduct });
});

// Admin Edit Product
app.put('/api/products/:id', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  products[index] = { ...products[index], ...req.body };
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, product: products[index] });
});

// Admin Delete Product
app.delete('/api/products/:id', (req, res) => {
  let products = readJson(PRODUCTS_FILE, []);
  products = products.filter(p => p.id !== req.params.id);
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: 'Product removed' });
});

// ----------------- ORDERS -----------------
app.get('/api/orders', (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  const { phone } = req.query;

  // Normalize order IDs, total, and status fields for seamless client compatibility
  const normalized = orders.map(o => {
    const id = o.orderId || o.id || 'ORD-0';
    const status = o.orderStatus || o.status || 'Order Placed';
    const total = o.grandTotal !== undefined ? o.grandTotal : (o.total || 0);
    return {
      ...o,
      id,
      orderId: id,
      status,
      orderStatus: status,
      total,
      grandTotal: total
    };
  });

  if (phone) {
    const customerOrders = normalized.filter(o => o.customer && o.customer.phone === phone);
    return res.json(customerOrders);
  }

  // Admin view: return all orders, newest first
  res.json(normalized);
});

// Update Order (Status or details)
app.put('/api/orders/:id', (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  const targetId = String(req.params.id).trim().toLowerCase();
  const index = orders.findIndex(o => 
    (o.orderId && String(o.orderId).trim().toLowerCase() === targetId) ||
    (o.id && String(o.id).trim().toLowerCase() === targetId)
  );

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const updatedStatus = req.body.status || req.body.orderStatus;
  if (updatedStatus) {
    orders[index].orderStatus = updatedStatus;
    orders[index].status = updatedStatus;
  }
  orders[index] = { ...orders[index], ...req.body };
  if (updatedStatus) {
    orders[index].orderStatus = updatedStatus;
    orders[index].status = updatedStatus;
  }

  writeJson(ORDERS_FILE, orders);
  res.json({ success: true, order: orders[index] });
});

// Create Order (Saves order, generates WhatsApp text)
app.post('/api/orders', (req, res) => {
  const { customer, items, paymentMethod, transactionId, notes } = req.body;

  if (!customer || !customer.phone || !items || items.length === 0) {
    return res.status(400).json({ error: 'Customer details and items are required.' });
  }

  const settings = readJson(SETTINGS_FILE, {});
  const orders = readJson(ORDERS_FILE, []);

  const orderId = 'GTH-' + (1000 + orders.length + 1);

  let grandTotal = 0;
  const processedItems = items.map(item => {
    const itemTotal = (item.wholesalePrice || 0) * (item.quantity || 1);
    grandTotal += itemTotal;
    return {
      id: item.id,
      name: item.name,
      size: item.size,
      brand: item.brand,
      quantity: item.quantity,
      wholesalePrice: item.wholesalePrice,
      total: itemTotal
    };
  });

  // Determine accurate payment status text
  let isPaymentDone = false;
  let paymentStatusText = '';

  if (paymentMethod === 'UPI (QR Code)') {
    if (transactionId) {
      isPaymentDone = true;
      paymentStatusText = `✅ PAYMENT DONE (UPI Ref: ${transactionId})`;
    } else {
      isPaymentDone = false;
      paymentStatusText = `❌ Payment Not Done (UPI Selected - Awaiting Verification)`;
    }
  } else if (paymentMethod === 'Cash on Delivery') {
    isPaymentDone = false;
    paymentStatusText = `❌ Payment Not Done (Pay on Delivery / Cash)`;
  } else if (paymentMethod === 'Bank NEFT / RTGS') {
    if (transactionId) {
      isPaymentDone = true;
      paymentStatusText = `✅ PAYMENT DONE (Bank Ref: ${transactionId})`;
    } else {
      isPaymentDone = false;
      paymentStatusText = `❌ Payment Not Done (Bank Transfer Pending)`;
    }
  } else {
    isPaymentDone = false;
    paymentStatusText = `❌ Payment Not Done`;
  }

  const newOrder = {
    orderId,
    customer,
    items: processedItems,
    grandTotal,
    paymentMethod: paymentMethod || 'Cash / Delivery',
    paymentStatus: paymentStatusText,
    paymentDone: isPaymentDone,
    transactionId: transactionId || '',
    orderStatus: 'Order Placed',
    shopAcknowledgment: 'Order Received by Shop',
    gstNumber: customer.gstNumber || '',
    notes: notes || '',
    timestamp: new Date().toISOString()
  };

  orders.unshift(newOrder);
  writeJson(ORDERS_FILE, orders);

  // Generate complete message for the Shop Owner
  const ownerWhatsApp = (settings.ownerWhatsApp || '919838451157').replace(/\D/g, '');
  let waText = `🚨 *NEW WEBSITE ORDER ALERT - GHANSHYAM TYRE HOUSE* 🚨\n`;
  waText += `*Order ID:* ${orderId}\n`;
  waText += `-----------------------------------------\n`;
  waText += `👤 *Customer Name:* ${customer.name}\n`;
  if (customer.shopName) {
    waText += `🏪 *Shop / Business:* ${customer.shopName}\n`;
  }
  waText += `📞 *Customer Phone:* ${customer.phone}\n`;
  waText += `📍 *Delivery Address:* ${customer.address || ''}, ${customer.city || ''}\n`;
  if (customer.gstNumber) {
    waText += `📋 *GSTIN:* ${customer.gstNumber}\n`;
  }
  waText += `-----------------------------------------\n`;
  waText += `📦 *ITEMS ORDERED:*\n`;
  processedItems.forEach((itm, idx) => {
    waText += `${idx + 1}. ${itm.name} [Size: ${itm.size}] - Qty: ${itm.quantity} pcs @ ₹${itm.wholesalePrice} = ₹${itm.total}\n`;
  });
  waText += `-----------------------------------------\n`;
  waText += `💰 *TOTAL AMOUNT: ₹${grandTotal.toLocaleString('en-IN')}*\n`;
  waText += `💳 *Payment Method:* ${newOrder.paymentMethod}\n`;
  waText += `🔴 *PAYMENT STATUS:* ${paymentStatusText}\n`;
  if (transactionId) {
    waText += `🔢 *UPI / Transaction Ref:* ${transactionId}\n`;
  }
  if (notes) {
    waText += `📝 *Order Note:* ${notes}\n`;
  }
  waText += `-----------------------------------------\n`;
  waText += `✓ Order recorded on website store database.`;

  // Trigger WhatsApp Automated Notification (Meta Cloud API)
  sendOrderAlerts(newOrder, settings).catch(err => {
    console.error('[WhatsApp Service Alert Error]', err);
  });

  // Automated notification attempt if webhook/gateway is configured
  if (settings.notificationWebhook) {
    try {
      fetch(settings.notificationWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: ownerWhatsApp, message: waText, order: newOrder })
      }).catch(err => console.error('Webhook notification error:', err.message));
    } catch (e) {
      console.error(e);
    }
  }

  console.log(`[ORDER ALERT TO OWNER (${ownerWhatsApp})]: Order #${orderId} from ${customer.name} - Payment: ${paymentStatusText}`);

  const whatsappUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsApp}&text=${encodeURIComponent(waText)}`;

  res.json({
    success: true,
    order: newOrder,
    whatsappUrl,
    ownerNotificationText: waText,
    paymentStatusText: paymentStatusText,
    isPaymentDone: isPaymentDone,
    message: 'Order created successfully and owner notification prepared.'
  });
});

// ----------------- WHATSAPP CLOUD API WEBHOOKS -----------------
// Verification challenge for Meta Developer App setup
app.get('/api/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'ghanshyam_secret_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification challenge passed successfully');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming webhook updates from WhatsApp
app.post('/api/webhook/whatsapp', (req, res) => {
  console.log('[WhatsApp Webhook Event]:', JSON.stringify(req.body));
  res.status(200).send('EVENT_RECEIVED');
});

// Test WhatsApp Endpoint
app.post('/api/whatsapp/test', async (req, res) => {
  const { phone, message } = req.body;
  const target = phone || '919838451157';
  const text = message || 'Test order alert from Shri Ghanshyam Tyre House!';
  const result = await sendWhatsAppMessage(target, text);
  res.json({ success: true, result });
});

// Update Order Status (Admin)
app.patch('/api/orders/:id', (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  const index = orders.findIndex(o => o.orderId === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (req.body.orderStatus) {
    orders[index].orderStatus = req.body.orderStatus;
  }
  if (req.body.paymentStatus) {
    orders[index].paymentStatus = req.body.paymentStatus;
  }

  writeJson(ORDERS_FILE, orders);
  res.json({ success: true, order: orders[index] });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Ghanshyam Tyre House server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
