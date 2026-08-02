const mongoose = require('mongoose');

const wastageSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  
  // Quantities and Pricing at time of waste
  qty_wasted: { type: Number, required: true }, // grams or packets depending on unit_type
  cost_price_per_unit: { type: Number },
  loss_value: { type: Number },
  
  reason: { type: String },
  
  // Timestamps
  wasted_at: { type: Date }, // Transaction date (mutable, backdatable)
  entry_created_at: { type: Date, default: Date.now, immutable: true } // Audit trail
});

module.exports = mongoose.model('Wastage', wastageSchema, 'wastages');
