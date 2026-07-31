const express = require('express');
const cors = require('cors');
const { sql, poolPromise } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// INVENTORY ENDPOINTS
// ==========================================

// Get all inventory
app.get('/api/inventory', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Inventory ORDER BY item_id DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Add new inventory item (supports both 'weight' and 'packet' types)
app.post('/api/inventory', async (req, res) => {
  try {
    const {
      item_name,
      unit_type = 'weight',
      // weight fields
      purchase_qty,
      unit,
      purchase_price_total,
      margin_slab_qty,
      margin_price,
      selling_price_per_unit,
      // packet fields
      total_packets_purchased,
      cost_price_per_packet,
      selling_price_per_packet,
    } = req.body;

    const pool = await poolPromise;

    if (unit_type === 'packet') {
      // Packet-based item
      const result = await pool.request()
        .input('item_name', sql.VarChar, item_name)
        .input('unit_type', sql.VarChar, 'packet')
        .input('total_packets_purchased', sql.Int, total_packets_purchased)
        .input('cost_price_per_packet', sql.Decimal(10, 2), cost_price_per_packet)
        .input('selling_price_per_packet', sql.Decimal(10, 2), selling_price_per_packet)
        .input('remaining_packets', sql.Int, total_packets_purchased)
        .query(`
          INSERT INTO Inventory
            (item_name, unit_type,
             total_packets_purchased, cost_price_per_packet,
             selling_price_per_packet, remaining_packets, created_at, updated_at)
          OUTPUT INSERTED.*
          VALUES
            (@item_name, @unit_type,
             @total_packets_purchased, @cost_price_per_packet,
             @selling_price_per_packet, @remaining_packets, GETUTCDATE(), GETUTCDATE())
        `);
      return res.status(201).json(result.recordset[0]);
    }

    // Weight-based item (default)
    const totalGrams = unit === 'kg' ? purchase_qty * 1000 : purchase_qty;
    const cost_price_per_unit = purchase_price_total / totalGrams;
    const remaining_qty = totalGrams;

    const result = await pool.request()
      .input('item_name', sql.VarChar, item_name)
      .input('unit_type', sql.VarChar, 'weight')
      .input('purchase_qty', sql.Decimal(10, 3), purchase_qty)
      .input('unit', sql.VarChar, unit)
      .input('purchase_price_total', sql.Decimal(10, 2), purchase_price_total)
      .input('cost_price_per_unit', sql.Decimal(10, 4), cost_price_per_unit)
      .input('margin_slab_qty', sql.Decimal(10, 3), margin_slab_qty || null)
      .input('margin_price', sql.Decimal(10, 2), margin_price || null)
      .input('selling_price_per_unit', sql.Decimal(10, 4), selling_price_per_unit)
      .input('remaining_qty', sql.Decimal(10, 3), remaining_qty)
      .query(`
        INSERT INTO Inventory
          (item_name, unit_type, purchase_qty, unit, purchase_price_total,
           cost_price_per_unit, margin_slab_qty, margin_price,
           selling_price_per_unit, remaining_qty, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES
          (@item_name, @unit_type, @purchase_qty, @unit, @purchase_price_total,
           @cost_price_per_unit, @margin_slab_qty, @margin_price,
           @selling_price_per_unit, @remaining_qty, GETUTCDATE(), GETUTCDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('POST /api/inventory error:', err.message);
    res.status(500).send(err.message);
  }
});

// Update inventory item
app.put('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name,
      unit_type = 'weight',
      // weight fields
      purchase_qty, unit, purchase_price_total,
      margin_slab_qty, margin_price, selling_price_per_unit,
      // packet fields
      total_packets_purchased,
      cost_price_per_packet,
      selling_price_per_packet,
    } = req.body;

    const pool = await poolPromise;

    if (unit_type === 'packet') {
      const result = await pool.request()
        .input('id', sql.Int, id)
        .input('item_name', sql.VarChar, item_name)
        .input('unit_type', sql.VarChar, 'packet')
        .input('total_packets_purchased', sql.Int, total_packets_purchased)
        .input('cost_price_per_packet', sql.Decimal(10, 2), cost_price_per_packet)
        .input('selling_price_per_packet', sql.Decimal(10, 2), selling_price_per_packet)
        .input('remaining_packets', sql.Int, req.body.remaining_packets ?? total_packets_purchased)
        .query(`
          UPDATE Inventory SET
            item_name = @item_name,
            unit_type = @unit_type,
            total_packets_purchased = @total_packets_purchased,
            cost_price_per_packet = @cost_price_per_packet,
            selling_price_per_packet = @selling_price_per_packet,
            remaining_packets = @remaining_packets,
            updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE item_id = @id
        `);
      if (result.rowsAffected[0] === 0) return res.status(404).send('Item not found');
      return res.json(result.recordset[0]);
    }

    // Weight-based
    const totalGrams = unit === 'kg' ? purchase_qty * 1000 : purchase_qty;
    const cost_price_per_unit = purchase_price_total / totalGrams;

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('item_name', sql.VarChar, item_name)
      .input('unit_type', sql.VarChar, 'weight')
      .input('purchase_qty', sql.Decimal(10, 3), purchase_qty)
      .input('unit', sql.VarChar, unit)
      .input('purchase_price_total', sql.Decimal(10, 2), purchase_price_total)
      .input('cost_price_per_unit', sql.Decimal(10, 4), cost_price_per_unit)
      .input('margin_slab_qty', sql.Decimal(10, 3), margin_slab_qty || null)
      .input('margin_price', sql.Decimal(10, 2), margin_price || null)
      .input('selling_price_per_unit', sql.Decimal(10, 4), selling_price_per_unit)
      .input('remaining_qty', sql.Decimal(10, 3), req.body.remaining_qty ?? totalGrams)
      .query(`
        UPDATE Inventory SET
          item_name = @item_name,
          unit_type = @unit_type,
          purchase_qty = @purchase_qty,
          unit = @unit,
          purchase_price_total = @purchase_price_total,
          cost_price_per_unit = @cost_price_per_unit,
          margin_slab_qty = @margin_slab_qty,
          margin_price = @margin_price,
          selling_price_per_unit = @selling_price_per_unit,
          remaining_qty = @remaining_qty,
          updated_at = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE item_id = @id
      `);
    if (result.rowsAffected[0] === 0) return res.status(404).send('Item not found');
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Delete inventory item (cascades through Sales and Wastage first)
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const id = req.params.id;

      // 1. Delete related Wastage rows
      await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('DELETE FROM Wastage WHERE item_id = @id');

      // 2. Delete related Sales rows
      await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('DELETE FROM Sales WHERE item_id = @id');

      // 3. Delete the inventory item itself
      const delResult = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('DELETE FROM Inventory WHERE item_id = @id');

      if (delResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(404).send('Item not found');
      }

      await transaction.commit();
      res.status(204).send();
    } catch (err) {
      await transaction.rollback();
      console.error('DELETE /api/inventory error:', err.message);
      res.status(500).send(err.message);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ==========================================
// SALES ENDPOINTS
// ==========================================

app.get('/api/sales', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT S.sale_id, S.bill_no, S.item_id, S.qty_sold,
             S.selling_price_per_unit, S.total_amount,
             S.cost_price_per_unit, S.profit, S.sold_at,
             I.item_name, I.unit_type
      FROM Sales S
      JOIN Inventory I ON S.item_id = I.item_id
      ORDER BY S.sale_id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { item_id, qty_sold, total_amount, auto_waste } = req.body;
    const pool = await poolPromise;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Get current inventory details
      const invRequest = new sql.Request(transaction);
      const invResult = await invRequest
        .input('item_id', sql.Int, item_id)
        .query(`SELECT cost_price_per_unit, selling_price_per_unit,
                       remaining_qty, item_name, unit_type,
                       cost_price_per_packet, selling_price_per_packet,
                       remaining_packets
                FROM Inventory WHERE item_id = @item_id`);

      if (invResult.recordset.length === 0) throw new Error('Item not found');

      const inventory = invResult.recordset[0];
      const isPacket = inventory.unit_type === 'packet';

      if (isPacket) {
        // Packet-based stock check
        const packetsSelling = Math.round(qty_sold); // qty_sold is packets count for packet items
        if (inventory.remaining_packets < packetsSelling) {
          throw new Error(`Insufficient stock. Remaining: ${inventory.remaining_packets} packets`);
        }

        const cogs = packetsSelling * inventory.cost_price_per_packet;
        const profit = total_amount - cogs;
        const bill_no = 'BILL-' + Date.now().toString().slice(-6);

        // Insert sale
        const saleRequest = new sql.Request(transaction);
        const saleResult = await saleRequest
          .input('bill_no', sql.VarChar, bill_no)
          .input('item_id', sql.Int, item_id)
          .input('qty_sold', sql.Decimal(10, 3), packetsSelling)
          .input('selling_price_per_unit', sql.Decimal(10, 4), inventory.selling_price_per_packet)
          .input('total_amount', sql.Decimal(10, 2), total_amount)
          .input('cost_price_per_unit', sql.Decimal(10, 4), inventory.cost_price_per_packet)
          .input('profit', sql.Decimal(10, 2), profit)
          .input('unit_type', sql.VarChar, 'packet')
          .query(`
            INSERT INTO Sales (bill_no, item_id, qty_sold, selling_price_per_unit,
                               total_amount, cost_price_per_unit, profit, unit_type, sold_at)
            OUTPUT INSERTED.*
            VALUES (@bill_no, @item_id, @qty_sold, @selling_price_per_unit,
                    @total_amount, @cost_price_per_unit, @profit, @unit_type, GETUTCDATE())
          `);

        // Update remaining_packets
        const updateRequest = new sql.Request(transaction);
        await updateRequest
          .input('item_id', sql.Int, item_id)
          .input('deduct', sql.Int, packetsSelling)
          .query('UPDATE Inventory SET remaining_packets = remaining_packets - @deduct WHERE item_id = @item_id');

        await transaction.commit();

        return res.status(201).json({
          sale: { ...saleResult.recordset[0], item_name: inventory.item_name },
          wastage: null,
          item_id,
          total_deduct: packetsSelling,
        });
      }

      // Weight-based
      if (inventory.remaining_qty < qty_sold) {
        throw new Error('Insufficient stock');
      }

      const cogs = qty_sold * inventory.cost_price_per_unit;
      const profit = total_amount - cogs;
      const bill_no = 'BILL-' + Date.now().toString().slice(-6);

      // Insert sale
      const saleRequest = new sql.Request(transaction);
      const saleResult = await saleRequest
        .input('bill_no', sql.VarChar, bill_no)
        .input('item_id', sql.Int, item_id)
        .input('qty_sold', sql.Decimal(10, 3), qty_sold)
        .input('selling_price_per_unit', sql.Decimal(10, 4), inventory.selling_price_per_unit)
        .input('total_amount', sql.Decimal(10, 2), total_amount)
        .input('cost_price_per_unit', sql.Decimal(10, 4), inventory.cost_price_per_unit)
        .input('profit', sql.Decimal(10, 2), profit)
        .input('unit_type', sql.VarChar, 'weight')
        .query(`
          INSERT INTO Sales (bill_no, item_id, qty_sold, selling_price_per_unit,
                             total_amount, cost_price_per_unit, profit, unit_type, sold_at)
          OUTPUT INSERTED.*
          VALUES (@bill_no, @item_id, @qty_sold, @selling_price_per_unit,
                  @total_amount, @cost_price_per_unit, @profit, @unit_type, GETUTCDATE())
        `);

      let wasted_grams = 0;
      let wastageResult = null;

      // Auto Wastage (if requested)
      if (auto_waste) {
        wasted_grams = inventory.remaining_qty - qty_sold;
        if (wasted_grams > 0) {
          const loss_value = wasted_grams * inventory.cost_price_per_unit;
          const wasteRequest = new sql.Request(transaction);
          const wRes = await wasteRequest
            .input('item_id', sql.Int, item_id)
            .input('qty_wasted', sql.Decimal(10, 3), wasted_grams)
            .input('cost_price_per_unit', sql.Decimal(10, 4), inventory.cost_price_per_unit)
            .input('loss_value', sql.Decimal(10, 2), loss_value)
            .input('reason', sql.VarChar, 'Auto-cleared at end of day')
            .query(`
              INSERT INTO Wastage (item_id, qty_wasted, cost_price_per_unit, loss_value, reason, wasted_at)
              OUTPUT INSERTED.*
              VALUES (@item_id, @qty_wasted, @cost_price_per_unit, @loss_value, @reason, GETUTCDATE())
            `);
          wastageResult = wRes.recordset[0];
        }
      }

      // Update remaining_qty
      const total_deduct = qty_sold + wasted_grams;
      const updateRequest = new sql.Request(transaction);
      await updateRequest
        .input('item_id', sql.Int, item_id)
        .input('deduct', sql.Decimal(10, 3), total_deduct)
        .query('UPDATE Inventory SET remaining_qty = remaining_qty - @deduct WHERE item_id = @item_id');

      await transaction.commit();

      res.status(201).json({
        sale: { ...saleResult.recordset[0], item_name: inventory.item_name },
        wastage: wastageResult ? { ...wastageResult, item_name: inventory.item_name } : null,
        item_id,
        total_deduct,
      });
    } catch (err) {
      await transaction.rollback();
      res.status(400).send(err.message);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ==========================================
// WASTAGE ENDPOINTS
// ==========================================

app.get('/api/wastage', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT W.wastage_id, W.item_id, W.qty_wasted,
             W.cost_price_per_unit, W.loss_value, W.reason, W.wasted_at,
             I.item_name, I.unit_type
      FROM Wastage W
      JOIN Inventory I ON W.item_id = I.item_id
      ORDER BY W.wastage_id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/wastage', async (req, res) => {
  try {
    const { item_id, qty_wasted, reason } = req.body;
    const pool = await poolPromise;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const invRequest = new sql.Request(transaction);
      const invResult = await invRequest
        .input('item_id', sql.Int, item_id)
        .query(`SELECT cost_price_per_unit, remaining_qty, item_name, unit_type,
                       cost_price_per_packet, remaining_packets
                FROM Inventory WHERE item_id = @item_id`);

      if (invResult.recordset.length === 0) throw new Error('Item not found');

      const inventory = invResult.recordset[0];
      const isPacket = inventory.unit_type === 'packet';

      if (isPacket) {
        const packetsWasted = Math.round(qty_wasted);
        if (inventory.remaining_packets < packetsWasted) throw new Error('Insufficient packets for wastage');

        const loss_value = packetsWasted * inventory.cost_price_per_packet;

        const wasteRequest = new sql.Request(transaction);
        const wasteResult = await wasteRequest
          .input('item_id', sql.Int, item_id)
          .input('qty_wasted', sql.Decimal(10, 3), packetsWasted)
          .input('cost_price_per_unit', sql.Decimal(10, 4), inventory.cost_price_per_packet)
          .input('loss_value', sql.Decimal(10, 2), loss_value)
          .input('reason', sql.VarChar, reason || 'Manual write-off')
          .query(`
            INSERT INTO Wastage (item_id, qty_wasted, cost_price_per_unit, loss_value, reason, wasted_at)
            OUTPUT INSERTED.*
            VALUES (@item_id, @qty_wasted, @cost_price_per_unit, @loss_value, @reason, GETUTCDATE())
          `);

        const updateRequest = new sql.Request(transaction);
        await updateRequest
          .input('item_id', sql.Int, item_id)
          .input('qty_wasted', sql.Int, packetsWasted)
          .query('UPDATE Inventory SET remaining_packets = remaining_packets - @qty_wasted WHERE item_id = @item_id');

        await transaction.commit();
        return res.status(201).json({ ...wasteResult.recordset[0], item_name: inventory.item_name });
      }

      // Weight-based wastage
      if (inventory.remaining_qty < qty_wasted) throw new Error('Insufficient stock for wastage');

      const loss_value = qty_wasted * inventory.cost_price_per_unit;

      const wasteRequest = new sql.Request(transaction);
      const wasteResult = await wasteRequest
        .input('item_id', sql.Int, item_id)
        .input('qty_wasted', sql.Decimal(10, 3), qty_wasted)
        .input('cost_price_per_unit', sql.Decimal(10, 4), inventory.cost_price_per_unit)
        .input('loss_value', sql.Decimal(10, 2), loss_value)
        .input('reason', sql.VarChar, reason || 'Manual write-off')
        .query(`
          INSERT INTO Wastage (item_id, qty_wasted, cost_price_per_unit, loss_value, reason, wasted_at)
          OUTPUT INSERTED.*
          VALUES (@item_id, @qty_wasted, @cost_price_per_unit, @loss_value, @reason, GETUTCDATE())
        `);

      const updateRequest = new sql.Request(transaction);
      await updateRequest
        .input('item_id', sql.Int, item_id)
        .input('qty_wasted', sql.Decimal(10, 3), qty_wasted)
        .query('UPDATE Inventory SET remaining_qty = remaining_qty - @qty_wasted WHERE item_id = @item_id');

      await transaction.commit();
      res.status(201).json({ ...wasteResult.recordset[0], item_name: inventory.item_name });
    } catch (err) {
      await transaction.rollback();
      res.status(400).send(err.message);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete('/api/wastage/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const getReq = new sql.Request(transaction);
      const wRes = await getReq
        .input('id', sql.Int, req.params.id)
        .query('SELECT W.item_id, W.qty_wasted, I.unit_type FROM Wastage W JOIN Inventory I ON W.item_id=I.item_id WHERE W.wastage_id = @id');

      if (wRes.recordset.length === 0) throw new Error('Wastage not found');

      const { item_id, qty_wasted, unit_type } = wRes.recordset[0];

      const delReq = new sql.Request(transaction);
      await delReq.input('id', sql.Int, req.params.id).query('DELETE FROM Wastage WHERE wastage_id = @id');

      const updReq = new sql.Request(transaction);
      if (unit_type === 'packet') {
        await updReq
          .input('item_id', sql.Int, item_id)
          .input('qty', sql.Int, Math.round(qty_wasted))
          .query('UPDATE Inventory SET remaining_packets = remaining_packets + @qty WHERE item_id = @item_id');
      } else {
        await updReq
          .input('item_id', sql.Int, item_id)
          .input('qty', sql.Decimal(10, 3), qty_wasted)
          .query('UPDATE Inventory SET remaining_qty = remaining_qty + @qty WHERE item_id = @item_id');
      }

      await transaction.commit();
      res.status(204).send();
    } catch (err) {
      await transaction.rollback();
      res.status(400).send(err.message);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
