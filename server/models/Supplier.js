const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  supplier_name: { type: String, required: true },
  phone_number: { type: String },
  address: { type: String },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  entry_created_at: { type: Date, default: Date.now, immutable: true }
});

module.exports = mongoose.model('Supplier', supplierSchema, 'suppliers');
