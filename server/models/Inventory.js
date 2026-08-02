const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  unit_type: { type: String, default: 'weight' }, // 'weight' or 'packet'

  // Weight-based fields
  purchase_qty: { type: Number },
  unit: { type: String }, // 'kg' or 'g'
  purchase_price_total: { type: Number },
  cost_price_per_unit: { type: Number },
  margin_slab_qty: { type: Number },
  margin_price: { type: Number },
  selling_price_per_unit: { type: Number },
  remaining_qty: { type: Number }, // in grams

  // Packet-based fields
  total_packets_purchased: { type: Number },
  cost_price_per_packet: { type: Number },
  selling_price_per_packet: { type: Number },
  remaining_packets: { type: Number },

  // New Fields
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  low_stock_threshold: { type: Number }, // Threshold for dashboard alerts

  // Timestamps
  created_at: { type: Date }, // Transaction date (mutable, backdatable)
  updated_at: { type: Date },
  entry_created_at: { type: Date, default: Date.now, immutable: true }, // Audit trail
  manually_edited: { type: Boolean, default: false }
});

// Update the updated_at field on save
inventorySchema.pre('save', function() {
  this.updated_at = Date.now();
});

module.exports = mongoose.model('Inventory', inventorySchema, 'inventory');
