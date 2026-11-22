const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customer: {
    name: { type: String, default: '' },
    phone: { type: String, required: true },
    shopName: { type: String, default: '' },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    gstNumber: { type: String, default: '' }
  },
  items: [{
    id: { type: String },
    name: { type: String },
    size: { type: String },
    brand: { type: String },
    wholesalePrice: { type: Number },
    quantity: { type: Number },
    total: { type: Number },
    image: { type: String }
  }],
  grandTotal: { type: Number, required: true },
  total: { type: Number },
  paymentMethod: { type: String, default: 'UPI (QR Code)' },
  transactionId: { type: String, default: '' },
  paymentStatus: { type: String, default: '❌ Payment Not Done' },
  paymentDone: { type: Boolean, default: false },
  orderStatus: { type: String, default: 'Order Placed (Pending Shop Confirmation)' },
  status: { type: String, default: 'Order Placed' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
