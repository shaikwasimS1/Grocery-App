const mongoose = require('mongoose');

const creditPaymentSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount_paid: { type: Number, required: true },
  payment_mode: { type: String, enum: ['cash', 'UPI', 'bank'], default: 'cash' },
  
  // Timestamps
  payment_date: { type: Date, default: Date.now }, // The backdatable transaction date
  entry_created_at: { type: Date, default: Date.now, immutable: true } // Audit trail
});

module.exports = mongoose.model('CreditPayment', creditPaymentSchema, 'credit_payments');
