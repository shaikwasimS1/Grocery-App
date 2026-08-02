const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema({
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  amount_paid: { type: Number, required: true },
  payment_mode: { type: String, enum: ['cash', 'UPI', 'bank'], default: 'cash' },
  notes: { type: String },
  
  // Timestamps
  payment_date: { type: Date, default: Date.now }, // The backdatable transaction date
  entry_created_at: { type: Date, default: Date.now, immutable: true } // Audit trail
});

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema, 'supplier_payments');
