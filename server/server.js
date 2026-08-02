require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./db');

const Inventory = require('./models/Inventory');
const Sale = require('./models/Sale');
const Wastage = require('./models/Wastage');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Helpers to map MongoDB _id to SQL-style primary keys so the frontend doesn't break
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
// INVENTORY ENDPOINTS
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
      item_name,
      unit_type = 'weight',
      purchase_qty, unit, purchase_price_total,
      margin_slab_qty, margin_price, selling_price_per_unit,
      total_packets_purchased, cost_price_per_packet, selling_price_per_packet,
    } = req.body;

    let newItemData = { item_name, unit_type };

    if (unit_type === 'packet') {
      newItemData = {
        ...newItemData,
        total_packets_purchased,
        cost_price_per_packet,
        selling_price_per_packet,
        remaining_packets: total_packets_purchased
      };
    } else {
      const totalGrams = unit === 'kg' ? purchase_qty * 1000 : purchase_qty;
      const cost_price_per_unit = purchase_price_total / totalGrams;
      newItemData = {
        ...newItemData,
        purchase_qty,
        unit,
        purchase_price_total,
        cost_price_per_unit,
        margin_slab_qty: margin_slab_qty || null,
        margin_price: margin_price || null,
        selling_price_per_unit,
        remaining_qty: totalGrams
      };
    }

    const item = await Inventory.create(newItemData);
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
      item_name,
      unit_type = 'weight',
      purchase_qty, unit, purchase_price_total,
      margin_slab_qty, margin_price, selling_price_per_unit,
      total_packets_purchased, cost_price_per_packet, selling_price_per_packet,
    } = req.body;

    let updateData = { item_name, unit_type };

    if (unit_type === 'packet') {
      updateData = {
        ...updateData,
        total_packets_purchased,
        cost_price_per_packet,
        selling_price_per_packet,
        remaining_packets: req.body.remaining_packets ?? total_packets_purchased
      };
    } else {
      const totalGrams = unit === 'kg' ? purchase_qty * 1000 : purchase_qty;
      const cost_price_per_unit = purchase_price_total / totalGrams;
      updateData = {
        ...updateData,
        purchase_qty,
        unit,
        purchase_price_total,
        cost_price_per_unit,
        margin_slab_qty: margin_slab_qty || null,
        margin_price: margin_price || null,
        selling_price_per_unit,
        remaining_qty: req.body.remaining_qty ?? totalGrams
      };
    }

    const updatedItem = await Inventory.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedItem) return res.status(404).send('Item not found');
    res.json(mapInventory(updatedItem));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    // 1. Delete related Wastage rows
    await Wastage.deleteMany({ item_id: id }).session(session);

    // 2. Delete related Sales rows
    await Sale.deleteMany({ item_id: id }).session(session);

    // 3. Delete the inventory item itself
    const delResult = await Inventory.findByIdAndDelete(id).session(session);
    
    if (!delResult) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send('Item not found');
    }

    await session.commitTransaction();
    session.endSession();
    res.status(204).send();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('DELETE /api/inventory error:', err.message);
    res.status(500).send(err.message);
  }
});

// ==========================================
// SALES ENDPOINTS
// ==========================================

app.get('/api/sales', async (req, res) => {
  try {
    const sales = await Sale.find().populate('item_id', 'item_name unit_type').sort({ _id: -1 });
    res.json(sales.map(mapSale));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/sales', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { item_id, qty_sold, total_amount, auto_waste } = req.body;
    
    const inventory = await Inventory.findById(item_id).session(session);
    if (!inventory) throw new Error('Item not found');

    const isPacket = inventory.unit_type === 'packet';
    let newSale, newWastage = null, total_deduct = 0;

    if (isPacket) {
      const packetsSelling = Math.round(qty_sold);
      if (inventory.remaining_packets < packetsSelling) {
        throw new Error(`Insufficient stock. Remaining: ${inventory.remaining_packets} packets`);
      }

      const cogs = packetsSelling * inventory.cost_price_per_packet;
      const profit = total_amount - cogs;
      const bill_no = 'BILL-' + Date.now().toString().slice(-6);

      newSale = await Sale.create([{
        bill_no,
        item_id,
        qty_sold: packetsSelling,
        selling_price_per_unit: inventory.selling_price_per_packet,
        total_amount,
        cost_price_per_unit: inventory.cost_price_per_packet,
        profit,
        unit_type: 'packet'
      }], { session });

      inventory.remaining_packets -= packetsSelling;
      total_deduct = packetsSelling;
      await inventory.save({ session });

    } else {
      // Weight-based
      if (inventory.remaining_qty < qty_sold) {
        throw new Error('Insufficient stock');
      }

      const cogs = qty_sold * inventory.cost_price_per_unit;
      const profit = total_amount - cogs;
      const bill_no = 'BILL-' + Date.now().toString().slice(-6);

      newSale = await Sale.create([{
        bill_no,
        item_id,
        qty_sold,
        selling_price_per_unit: inventory.selling_price_per_unit,
        total_amount,
        cost_price_per_unit: inventory.cost_price_per_unit,
        profit,
        unit_type: 'weight'
      }], { session });

      let wasted_grams = 0;

      if (auto_waste) {
        wasted_grams = inventory.remaining_qty - qty_sold;
        if (wasted_grams > 0) {
          const loss_value = wasted_grams * inventory.cost_price_per_unit;
          newWastage = await Wastage.create([{
            item_id,
            qty_wasted: wasted_grams,
            cost_price_per_unit: inventory.cost_price_per_unit,
            loss_value,
            reason: 'Auto-cleared at end of day'
          }], { session });
          newWastage = newWastage[0];
        }
      }

      total_deduct = qty_sold + wasted_grams;
      inventory.remaining_qty -= total_deduct;
      await inventory.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Populate item_id for response to match GET endpoint behavior
    await Sale.populate(newSale[0], { path: 'item_id', select: 'item_name unit_type' });
    if (newWastage) {
      await Wastage.populate(newWastage, { path: 'item_id', select: 'item_name unit_type' });
    }

    res.status(201).json({
      sale: mapSale(newSale[0]),
      wastage: mapWastage(newWastage),
      item_id,
      total_deduct,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).send(err.message);
  }
});

// ==========================================
// WASTAGE ENDPOINTS
// ==========================================

app.get('/api/wastage', async (req, res) => {
  try {
    const wastages = await Wastage.find().populate('item_id', 'item_name unit_type').sort({ _id: -1 });
    res.json(wastages.map(mapWastage));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/wastage', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { item_id, qty_wasted, reason } = req.body;
    
    const inventory = await Inventory.findById(item_id).session(session);
    if (!inventory) throw new Error('Item not found');

    const isPacket = inventory.unit_type === 'packet';
    let newWastage;

    if (isPacket) {
      const packetsWasted = Math.round(qty_wasted);
      if (inventory.remaining_packets < packetsWasted) throw new Error('Insufficient packets for wastage');

      const loss_value = packetsWasted * inventory.cost_price_per_packet;

      newWastage = await Wastage.create([{
        item_id,
        qty_wasted: packetsWasted,
        cost_price_per_unit: inventory.cost_price_per_packet,
        loss_value,
        reason: reason || 'Manual write-off'
      }], { session });

      inventory.remaining_packets -= packetsWasted;
      await inventory.save({ session });

    } else {
      // Weight-based
      if (inventory.remaining_qty < qty_wasted) throw new Error('Insufficient stock for wastage');

      const loss_value = qty_wasted * inventory.cost_price_per_unit;

      newWastage = await Wastage.create([{
        item_id,
        qty_wasted,
        cost_price_per_unit: inventory.cost_price_per_unit,
        loss_value,
        reason: reason || 'Manual write-off'
      }], { session });

      inventory.remaining_qty -= qty_wasted;
      await inventory.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    await Wastage.populate(newWastage[0], { path: 'item_id', select: 'item_name unit_type' });

    res.status(201).json(mapWastage(newWastage[0]));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).send(err.message);
  }
});

app.delete('/api/wastage/:id', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    
    const wastage = await Wastage.findById(id).populate('item_id').session(session);
    if (!wastage) throw new Error('Wastage not found');

    const inventory = wastage.item_id;
    if (inventory) {
      if (inventory.unit_type === 'packet') {
        inventory.remaining_packets += Math.round(wastage.qty_wasted);
      } else {
        inventory.remaining_qty += wastage.qty_wasted;
      }
      await inventory.save({ session });
    }

    await Wastage.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();
    res.status(204).send();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).send(err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
