const mongoose = require('mongoose');

const creditSaleSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' }, // Link to actual sale if available
  bill_no: { type: String },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  
  // Timestamps
  credit_date: { type: Date, default: Date.now }, // The backdatable transaction date
  entry_created_at: { type: Date, default: Date.now, immutable: true } // Audit trail
});

module.exports = mongoose.model('CreditSale', creditSaleSchema, 'credit_sales');
