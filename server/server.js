require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./db');

const Inventory = require('./models/Inventory');
const Sale = require('./models/Sale');
const Wastage = require('./models/Wastage');
const Supplier = require('./models/Supplier');
const SupplierPayment = require('./models/SupplierPayment');
const Customer = require('./models/Customer');
const CreditSale = require('./models/CreditSale');
const CreditPayment = require('./models/CreditPayment');
const Expense = require('./models/Expense');
const registerPdfRoute = require('./routes/pdfReport');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// Register PDF report route
registerPdfRoute(app, {
  Sale, Inventory, Wastage, Expense,
  Supplier, SupplierPayment, Customer, CreditSale, CreditPayment
});

// ---------------------------------------------------------------------------
// Helpers — map MongoDB _id → SQL-style keys so the frontend doesn't change
// ---------------------------------------------------------------------------
const mapInventory = doc => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return { ...obj, item_id: obj._id };
};

const mapSale = doc => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    sale_id: obj._id,
    item_name: obj.item_id?.item_name,
    unit_type: obj.item_id?.unit_type,
    item_id: obj.item_id?._id || obj.item_id
  };
};

const mapWastage = doc => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    wastage_id: obj._id,
    item_name: obj.item_id?.item_name,
    unit_type: obj.item_id?.unit_type,
    item_id: obj.item_id?._id || obj.item_id
  };
};

// ==========================================
// INVENTORY
// ==========================================

app.get('/api/inventory', async (req, res) => {
  try {
    const items = await Inventory.find().sort({ _id: -1 });
    res.json(items.map(mapInventory));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const {
      item_name, unit_type = 'weight',
      purchase_qty, unit, purchase_price_total,
      margin_slab_qty, margin_price, selling_price_per_unit,
      total_packets_purchased, cost_price_per_packet, selling_price_per_packet,
      transaction_date
    } = req.body;

    let data = { item_name, unit_type };
    if (transaction_date) data.created_at = new Date(transaction_date);

    if (unit_type === 'packet') {
      data = {
        ...data,
        total_packets_purchased,
        cost_price_per_packet,
        selling_price_per_packet,
        remaining_packets: total_packets_purchased
      };
    } else {
      const totalGrams = unit === 'kg' ? purchase_qty * 1000 : purchase_qty;
      data = {
        ...data,
        purchase_qty, unit, purchase_price_total,
        cost_price_per_unit: purchase_price_total / totalGrams,
        margin_slab_qty: margin_slab_qty || null,
        margin_price: margin_price || null,
        selling_price_per_unit,
        remaining_qty: totalGrams
      };
    }

    const item = await Inventory.create(data);
    res.status(201).json(mapInventory(item));
  } catch (err) {
    console.error('POST /api/inventory error:', err.message);
    res.status(500).send(err.message);
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name, unit_type = 'weight',
      purchase_qty, unit, purchase_price_total,
      margin_slab_qty, margin_price, selling_price_per_unit,
      total_packets_purchased, cost_price_per_packet, selling_price_per_packet,
    } = req.body;

    let data = { item_name, unit_type, updated_at: new Date(), manually_edited: true };

    if (unit_type === 'packet') {
      data = {
        ...data,
        total_packets_purchased, cost_price_per_packet, selling_price_per_packet,
        remaining_packets: req.body.remaining_packets ?? total_packets_purchased
      };
    } else {
      const totalGrams = unit === 'kg' ? purchase_qty * 1000 : purchase_qty;
      data = {
        ...data,
        purchase_qty, unit, purchase_price_total,
        cost_price_per_unit: purchase_price_total / totalGrams,
        margin_slab_qty: margin_slab_qty || null,
        margin_price: margin_price || null,
        selling_price_per_unit,
        remaining_qty: req.body.remaining_qty ?? totalGrams
      };
    }

    const item = await Inventory.findByIdAndUpdate(id, data, { new: true });
    if (!item) return res.status(404).send('Item not found');
    res.json(mapInventory(item));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Wastage.deleteMany({ item_id: id });
    await Sale.deleteMany({ item_id: id });
    const del = await Inventory.findByIdAndDelete(id);
    if (!del) return res.status(404).send('Item not found');
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/inventory error:', err.message);
    res.status(500).send(err.message);
  }
});

// ==========================================
// SALES
// ==========================================

app.get('/api/sales', async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate('item_id', 'item_name unit_type')
      .sort({ _id: -1 });
    res.json(sales.map(mapSale));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { item_id, qty_sold, total_amount, auto_waste, transaction_date } = req.body;

    // 1. Fetch inventory
    const inventory = await Inventory.findById(item_id);
    if (!inventory) return res.status(400).send('Item not found');

    const isPacket = inventory.unit_type === 'packet';
    const bill_no = 'BILL-' + Date.now().toString().slice(-6);

    let newSale, newWastage = null;

    if (isPacket) {
      const packetsSelling = Math.round(qty_sold);
      if ((inventory.remaining_packets || 0) < packetsSelling) {
        return res.status(400).send(`Insufficient stock. Only ${inventory.remaining_packets} packets remaining.`);
      }

      const cogs   = packetsSelling * inventory.cost_price_per_packet;
      const profit = total_amount - cogs;

      // 2a. Record sale
      newSale = await Sale.create({
        bill_no, item_id, qty_sold: packetsSelling,
        selling_price_per_unit: inventory.selling_price_per_packet,
        total_amount,
        cost_price_per_unit: inventory.cost_price_per_packet,
        profit, unit_type: 'packet',
        ...(transaction_date && { sold_at: new Date(transaction_date) })
      });

      // 2b. Deduct stock atomically
      await Inventory.findByIdAndUpdate(item_id, {
        $inc: { remaining_packets: -packetsSelling },
        updated_at: new Date()
      });

    } else {
      // Weight-based
      const gramsSold = qty_sold;
      if ((inventory.remaining_qty || 0) < gramsSold) {
        return res.status(400).send(`Insufficient stock. Only ${inventory.remaining_qty}g remaining.`);
      }

      const cogs   = gramsSold * inventory.cost_price_per_unit;
      const profit = total_amount - cogs;

      // 2a. Record sale
      newSale = await Sale.create({
        bill_no, item_id, qty_sold: gramsSold,
        selling_price_per_unit: inventory.selling_price_per_unit,
        total_amount,
        cost_price_per_unit: inventory.cost_price_per_unit,
        profit, unit_type: 'weight',
        ...(transaction_date && { sold_at: new Date(transaction_date) })
      });

      // 2b. Deduct sold grams
      let totalDeduct = gramsSold;

      // 2c. Auto-waste remaining if leftover mode
      if (auto_waste) {
        const wastedGrams = (inventory.remaining_qty || 0) - gramsSold;
        if (wastedGrams > 0) {
          const loss_value = wastedGrams * inventory.cost_price_per_unit;
          newWastage = await Wastage.create({
            item_id, qty_wasted: wastedGrams,
            cost_price_per_unit: inventory.cost_price_per_unit,
            loss_value,
            reason: 'Auto-cleared at end of day',
            ...(transaction_date && { wasted_at: new Date(transaction_date) })
          });
          totalDeduct += wastedGrams;
        }
      }

      await Inventory.findByIdAndUpdate(item_id, {
        $inc: { remaining_qty: -totalDeduct },
        updated_at: new Date()
      });
    }

    // 3. Populate for response
    await newSale.populate('item_id', 'item_name unit_type');
    if (newWastage) await newWastage.populate('item_id', 'item_name unit_type');

    res.status(201).json({
      sale: mapSale(newSale),
      wastage: mapWastage(newWastage),
    });
  } catch (err) {
    console.error('POST /api/sales error:', err.message);
    res.status(400).send(err.message);
  }
});

// ==========================================
// WASTAGE
// ==========================================

app.get('/api/wastage', async (req, res) => {
  try {
    const wastages = await Wastage.find()
      .populate('item_id', 'item_name unit_type')
      .sort({ _id: -1 });
    res.json(wastages.map(mapWastage));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/wastage', async (req, res) => {
  try {
    const { item_id, qty_wasted, reason, transaction_date } = req.body;

    const inventory = await Inventory.findById(item_id);
    if (!inventory) return res.status(400).send('Item not found');

    const isPacket = inventory.unit_type === 'packet';
    let newWastage;

    if (isPacket) {
      const packetsWasted = Math.round(qty_wasted);
      if ((inventory.remaining_packets || 0) < packetsWasted) {
        return res.status(400).send(`Insufficient packets. Only ${inventory.remaining_packets} remaining.`);
      }

      const loss_value = packetsWasted * inventory.cost_price_per_packet;

      newWastage = await Wastage.create({
        item_id, qty_wasted: packetsWasted,
        cost_price_per_unit: inventory.cost_price_per_packet,
        loss_value, reason: reason || 'Manual write-off', unit_type: 'packet',
        ...(transaction_date && { wasted_at: new Date(transaction_date) })
      });

      await Inventory.findByIdAndUpdate(item_id, {
        $inc: { remaining_packets: -packetsWasted },
        updated_at: new Date()
      });

    } else {
      if ((inventory.remaining_qty || 0) < qty_wasted) {
        return res.status(400).send(`Insufficient stock. Only ${inventory.remaining_qty}g remaining.`);
      }

      const loss_value = qty_wasted * inventory.cost_price_per_unit;

      newWastage = await Wastage.create({
        item_id, qty_wasted,
        cost_price_per_unit: inventory.cost_price_per_unit,
        loss_value,
        reason: reason || 'Manual write-off', unit_type: 'weight',
        ...(transaction_date && { wasted_at: new Date(transaction_date) })
      });

      await Inventory.findByIdAndUpdate(item_id, {
        $inc: { remaining_qty: -qty_wasted },
        updated_at: new Date()
      });
    }

    await newWastage.populate('item_id', 'item_name unit_type');
    res.status(201).json(mapWastage(newWastage));

  } catch (err) {
    console.error('POST /api/wastage error:', err.message);
    res.status(400).send(err.message);
  }
});

app.delete('/api/wastage/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const wastage = await Wastage.findById(id).populate('item_id');
    if (!wastage) return res.status(404).send('Wastage record not found');

    const inventory = wastage.item_id;
    if (inventory) {
      if (inventory.unit_type === 'packet') {
        await Inventory.findByIdAndUpdate(inventory._id, {
          $inc: { remaining_packets: Math.round(wastage.qty_wasted) },
          updated_at: new Date()
        });
      } else {
        await Inventory.findByIdAndUpdate(inventory._id, {
          $inc: { remaining_qty: wastage.qty_wasted },
          updated_at: new Date()
        });
      }
    }

    await Wastage.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/wastage error:', err.message);
    res.status(400).send(err.message);
  }
});

// ==========================================
// SUPPLIERS
// ==========================================

app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ _id: -1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/suppliers/:id/balance', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sum of all purchases mapped to this supplier
    const purchases = await Inventory.aggregate([
      { $match: { supplier_id: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalPurchases: { $sum: '$purchase_price_total' } } }
    ]);
    
    // Sum of all payments to this supplier
    const payments = await SupplierPayment.aggregate([
      { $match: { supplier_id: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalPaid: { $sum: '$amount_paid' } } }
    ]);
    
    const totalPurchases = purchases[0]?.totalPurchases || 0;
    const totalPaid = payments[0]?.totalPaid || 0;
    
    res.json({ totalPurchases, totalPaid, pendingBalance: totalPurchases - totalPaid });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/suppliers/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await SupplierPayment.create({ ...req.body, supplier_id: id });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ==========================================
// CUSTOMERS (CREDIT BOOK)
// ==========================================

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ _id: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/customers/:id/balance', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sales = await CreditSale.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalCredit: { $sum: '$amount' } } }
    ]);
    
    const payments = await CreditPayment.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalPaid: { $sum: '$amount_paid' } } }
    ]);
    
    const totalCredit = sales[0]?.totalCredit || 0;
    const totalPaid = payments[0]?.totalPaid || 0;
    
    res.json({ totalCredit, totalPaid, pendingBalance: totalCredit - totalPaid });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/customers/:id/sales', async (req, res) => {
  try {
    const sales = await CreditSale.find({ customer_id: req.params.id }).sort({ credit_date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/customers/:id/payments', async (req, res) => {
  try {
    const payments = await CreditPayment.find({ customer_id: req.params.id }).sort({ payment_date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/customers/:id/sales', async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await CreditSale.create({ ...req.body, customer_id: id });
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/customers/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await CreditPayment.create({ ...req.body, customer_id: id });
    
    // Auto-update status if fully paid
    const salesAgg = await CreditSale.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalCredit: { $sum: '$amount' } } }
    ]);
    const paymentsAgg = await CreditPayment.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalPaid: { $sum: '$amount_paid' } } }
    ]);
    
    const pendingBalance = (salesAgg[0]?.totalCredit || 0) - (paymentsAgg[0]?.totalPaid || 0);
    
    if (pendingBalance <= 0.01) { // allow tiny floating point differences
      await CreditSale.updateMany(
        { customer_id: id, status: 'pending' },
        { $set: { status: 'paid' } }
      );
    }
    
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ==========================================
// EXPENSES
// ==========================================

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ _id: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
