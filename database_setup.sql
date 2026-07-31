-- =======================================================================================
-- Database Creation Script for FreshTrack POS
-- Target SQL Server: DESKTOP-0AA9057\SQLEXPRESS
-- =======================================================================================

-- 1. Create the Database (if it doesn't exist)
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'groceryshop')
BEGIN
    CREATE DATABASE groceryshop;
END
GO

USE groceryshop;
GO

-- 2. Create Inventory Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.Inventory (
        item_id INT IDENTITY(1,1) PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        purchase_qty DECIMAL(10,3) NOT NULL,
        unit VARCHAR(10) NOT NULL, -- 'kg' or 'g'
        purchase_price_total DECIMAL(10,2) NOT NULL,
        cost_price_per_unit DECIMAL(10,4) NOT NULL, -- Cost per gram (or base unit)
        margin_slab_qty DECIMAL(10,3) NULL, -- e.g., 250 (grams). Nullable to support simple pricing model
        margin_price DECIMAL(10,2) NULL, -- e.g., 15. Nullable to support simple pricing model
        selling_price_per_unit DECIMAL(10,4) NOT NULL, -- Selling price per gram
        remaining_qty DECIMAL(10,3) NOT NULL, -- Grams remaining
        created_at DATETIME NOT NULL DEFAULT GETDATE(), -- Immutable
        updated_at DATETIME NULL
    );
END
GO

-- 3. Create Sales Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Sales]') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.Sales (
        sale_id INT IDENTITY(1,1) PRIMARY KEY,
        bill_no VARCHAR(50) NULL,
        item_id INT NOT NULL,
        qty_sold DECIMAL(10,3) NOT NULL, -- Grams sold
        selling_price_per_unit DECIMAL(10,4) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        cost_price_per_unit DECIMAL(10,4) NOT NULL,
        profit DECIMAL(10,2) NOT NULL,
        sold_at DATETIME NOT NULL DEFAULT GETDATE(), -- Immutable, append-only
        CONSTRAINT FK_Sales_Inventory FOREIGN KEY (item_id) REFERENCES dbo.Inventory(item_id)
    );
END
GO

-- 4. Create Wastage Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Wastage]') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.Wastage (
        wastage_id INT IDENTITY(1,1) PRIMARY KEY,
        item_id INT NOT NULL,
        qty_wasted DECIMAL(10,3) NOT NULL, -- Grams wasted
        cost_price_per_unit DECIMAL(10,4) NOT NULL,
        loss_value DECIMAL(10,2) NOT NULL, -- qty_wasted * cost_price_per_unit
        reason VARCHAR(255) NULL,
        wasted_at DATETIME NOT NULL DEFAULT GETDATE(), -- Immutable
        CONSTRAINT FK_Wastage_Inventory FOREIGN KEY (item_id) REFERENCES dbo.Inventory(item_id)
    );
END
GO

PRINT 'Database [groceryshop] and all tables successfully created/verified.';
GO
