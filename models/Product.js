const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: { type: String, required: true },
  size: { type: String, required: true },
  category: { type: String, required: true },
  itemType: { type: String, default: 'Tyre' },
  wholesalePrice: { type: Number, required: true },
  mrp: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  speedRating: { type: String, default: '' },
  loadIndex: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
