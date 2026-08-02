const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expense_type: { type: String, required: true },
  amount: { type: Number, required: true },
  notes: { type: String },
  
  // Timestamps
  expense_date: { type: Date, default: Date.now }, // The backdatable transaction date
  entry_created_at: { type: Date, default: Date.now, immutable: true } // Audit trail
});

module.exports = mongoose.model('Expense', expenseSchema, 'expenses');
