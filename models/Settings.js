const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  shopName: { type: String, default: 'Shri Ghanshyam Tyre House' },
  shortName: { type: String, default: 'Ghanshyam Tyre House' },
  tagline: { type: String, default: 'Authorized Dealers in Tyres, Tubes & Flaps' },
  estYear: { type: Number, default: 2008 },
  ownerWhatsApp: { type: String, default: '919838451157' },
  enableOnlinePayment: { type: Boolean, default: false },
  shopUPI: { type: String, default: 'bhaveshk1157@okicici' },
  paymentQrImage: { type: String, default: '/images/payment-qr.jpg' },
  address: { type: String, default: '' },
  landmark: { type: String, default: '' },
  city: { type: String, default: 'Gorakhpur, Uttar Pradesh' },
  contactPhone: { type: String, default: '+91 98384 51157' },
  googleMapsUrl: { type: String, default: '' },
  adminWhitelist: [{
    id: { type: String },
    name: { type: String },
    phone: { type: String },
    password: { type: String },
    role: { type: String, default: 'admin' }
  }]
}, { timestamps: true });

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
