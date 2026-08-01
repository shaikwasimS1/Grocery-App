const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  bill_no: { type: String },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  unit_type: { type: String }, // 'weight' or 'packet'
  
  // Quantities and Pricing at time of sale
  qty_sold: { type: Number, required: true }, // grams or packets depending on unit_type
  selling_price_per_unit: { type: Number },
  total_amount: { type: Number, required: true },
  cost_price_per_unit: { type: Number },
  profit: { type: Number },
  
  // Timestamps
  sold_at: { type: Date, default: Date.now, immutable: true }
});

module.exports = mongoose.model('Sale', saleSchema, 'sales');
