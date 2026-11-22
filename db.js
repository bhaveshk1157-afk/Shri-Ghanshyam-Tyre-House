const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Product = require('./models/Product');
const Order = require('./models/Order');
const User = require('./models/User');
const Settings = require('./models/Settings');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    const conn = await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Auto-seed initial data from JSON if collections are empty
    await autoSeedDatabase();
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    isConnected = false;
    return false;
  }
}

async function autoSeedDatabase() {
  try {
    const dataDir = path.join(__dirname, 'data');

    // 1. Seed Products if empty
    const prodCount = await Product.countDocuments();
    if (prodCount === 0) {
      const prodPath = path.join(dataDir, 'products.json');
      if (fs.existsSync(prodPath)) {
        const prods = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
        if (Array.isArray(prods) && prods.length > 0) {
          await Product.insertMany(prods);
          console.log(`Seeded ${prods.length} products to MongoDB`);
        }
      }
    }

    // 2. Seed Settings if empty
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
      const setPath = path.join(dataDir, 'settings.json');
      if (fs.existsSync(setPath)) {
        const settings = JSON.parse(fs.readFileSync(setPath, 'utf8'));
        await Settings.create(settings);
        console.log('Seeded Settings to MongoDB');
      }
    }

    // 3. Seed Users if empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const userPath = path.join(dataDir, 'users.json');
      if (fs.existsSync(userPath)) {
        const users = JSON.parse(fs.readFileSync(userPath, 'utf8'));
        if (Array.isArray(users) && users.length > 0) {
          await User.insertMany(users);
          console.log(`Seeded ${users.length} users to MongoDB`);
        }
      }
    }

    // 4. Seed Orders if empty
    const orderCount = await Order.countDocuments();
    if (orderCount === 0) {
      const orderPath = path.join(dataDir, 'orders.json');
      if (fs.existsSync(orderPath)) {
        const orders = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
        if (Array.isArray(orders) && orders.length > 0) {
          await Order.insertMany(orders);
          console.log(`Seeded ${orders.length} orders to MongoDB`);
        }
      }
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
