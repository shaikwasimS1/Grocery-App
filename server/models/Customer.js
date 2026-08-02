const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customer_name: { type: String, required: true },
  phone_number: { type: String },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  entry_created_at: { type: Date, default: Date.now, immutable: true }
});

module.exports = mongoose.model('Customer', customerSchema, 'customers');
