const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Product = require('./models/Product');
const Order = require('./models/Order');
const User = require('./models/User');
const Settings = require('./models/Settings');

let isConnected = false;
let connectingPromise = null;
let hasSeeded = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000
      });
      isConnected = true;
      console.log(`MongoDB Connected: ${conn.connection.host}`);

      // Auto-seed initial data from JSON once if collections are empty
      if (!hasSeeded) {
        hasSeeded = true;
        await autoSeedDatabase();
      }
      return true;
    } catch (err) {
      console.error('MongoDB connection error:', err.message);
      isConnected = false;
      return false;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

async function autoSeedDatabase() {
  try {
    const dataDir = path.join(__dirname, 'data');

    const [prodCount, settingsCount, userCount, orderCount] = await Promise.all([
      Product.countDocuments(),
      Settings.countDocuments(),
      User.countDocuments(),
      Order.countDocuments()
    ]);

    const seedTasks = [];

    if (prodCount === 0) {
      const prodPath = path.join(dataDir, 'products.json');
      if (fs.existsSync(prodPath)) {
        const prods = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
        if (Array.isArray(prods) && prods.length > 0) {
          seedTasks.push(Product.insertMany(prods).then(() => console.log(`Seeded ${prods.length} products to MongoDB`)));
        }
      }
    }

    if (settingsCount === 0) {
      const setPath = path.join(dataDir, 'settings.json');
      if (fs.existsSync(setPath)) {
        const settings = JSON.parse(fs.readFileSync(setPath, 'utf8'));
        seedTasks.push(Settings.create(settings).then(() => console.log('Seeded Settings to MongoDB')));
      }
    }

    if (userCount === 0) {
      const userPath = path.join(dataDir, 'users.json');
      if (fs.existsSync(userPath)) {
        const users = JSON.parse(fs.readFileSync(userPath, 'utf8'));
        if (Array.isArray(users) && users.length > 0) {
          seedTasks.push(User.insertMany(users).then(() => console.log(`Seeded ${users.length} users to MongoDB`)));
        }
      }
    }

    if (orderCount === 0) {
      const orderPath = path.join(dataDir, 'orders.json');
      if (fs.existsSync(orderPath)) {
        const orders = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
        if (Array.isArray(orders) && orders.length > 0) {
          seedTasks.push(Order.insertMany(orders).then(() => console.log(`Seeded ${orders.length} orders to MongoDB`)));
        }
      }
    }

    if (seedTasks.length > 0) {
      await Promise.all(seedTasks);
    }
  } catch (err) {
    console.error('Auto-seed warning:', err.message);
  }
}

function isDbReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isDbReady,
  Product,
  Order,
  User,
  Settings
};
