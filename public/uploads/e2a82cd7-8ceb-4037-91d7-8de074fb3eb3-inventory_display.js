const mongoose = require("mongoose");
const Company = require("../../models/company");
const Product = require("../../models/products");
const Order = require("../../models/orders");
const Branch = require("../../models/branches");
const Employee = require("../../models/employees");
const Inventory = require("../../models/inventory");
const { v4: uuidv4 } = require('uuid');

async function inventory_display(req, res) {
  try {
    console.log("[InventoryDisplay] Session user:", req.user);
    const employee = await Employee.findOne({ e_id: req.user.emp_id }).lean();

    if (!employee) {
      console.log("[InventoryDisplay] Employee not found:", req.user.emp_id);
      return res.status(403).send(`No employee found for emp_id: ${req.user.emp_id}.`);
    }

    if (employee.status !== "active") {
      console.log("[InventoryDisplay] Employee not active:", { e_id: employee.e_id, status: employee.status });
      return res.status(403).send(`Employee (e_id: ${employee.e_id}) is not active.`);
    }

    if (!employee.bid) {
      console.log("[InventoryDisplay] No bid assigned:", { e_id: employee.e_id });
      return res.status(403).send(`No branch assigned to employee (e_id: ${employee.e_id}).`);
    }

    const branch = await Branch.findOne({ bid: employee.bid, active: "active" }).lean();
    if (!branch) {
      console.log("[InventoryDisplay] No active branch for bid:", employee.bid);
      return res.status(403).send(`No active branch for bid: ${employee.bid}.`);
    }

    console.log("[InventoryDisplay] Fetching inventory for branch:", { bid: branch.bid, b_name: branch.b_name });
    const stocks = await Inventory.find({ branch_id: branch.bid }).lean();
    
    if (stocks.length === 0) {
      console.log("[InventoryDisplay] No inventory records found for branch:", branch.bid);
    } else {
      console.log("[InventoryDisplay] Fetched stocks:", stocks.map(s => ({
        product_id: s.product_id,
        product_name: s.product_name,
        company_id: s.company_id,
        company_name: s.company_name,
        model_no: s.model_no,
        quantity: s.quantity
      })));
    }

    res.render('salesmanager/inventory_feature/display_inventory', {
      activePage: 'employee',
      activeRoute: 'stocks',
      stocks,
      hasStocks: stocks.length > 0,
      branchid: branch.bid,
      branchname: branch.b_name,
      successMessage: req.query.success ? 'Inventory updated successfully!' : undefined
    });
  } catch (error) {
    console.error("[InventoryDisplay] Error:", error);
    res.status(500).send('Internal Server Error');
  }
}

async function renderAddOrderForm(req, res) {
  try {
    console.log("[AddOrderForm] Session user:", req.user);
    const employee = await Employee.findOne({ e_id: req.user.emp_id }).lean();

    if (!employee) {
      console.log("[AddOrderForm] Employee not found for emp_id:", req.user.emp_id);
      return res.status(403).send(`No employee found for emp_id: ${req.user.emp_id}.`);
    }

    if (employee.status !== "active") {
      console.log("[AddOrderForm] Employee not active:", { e_id: employee.e_id, status: employee.status });
      return res.status(403).send(`Employee (e_id: ${employee.e_id}) is not active.`);
    }

    if (!employee.bid) {
      console.log("[AddOrderForm] No bid assigned:", { e_id: employee.e_id });
      return res.status(403).send(`No branch assigned to employee (e_id: ${employee.e_id}).`);
    }

    const branch = await Branch.findOne({ bid: employee.bid, active: "active" }).lean();
    if (!branch) {
      console.log("[AddOrderForm] No active branch for bid:", employee.bid);
      return res.status(403).send(`No active branch for bid: ${employee.bid}.`);
    }

    const companies = await Company.find({ active: "active" }).lean();
    res.render("salesmanager/orders_feature/addorder", {
      activePage: "employee",
      activeRoute: "orders",
      companies,
      branchname: branch.b_name,
      branchid: branch.bid
    });
  } catch (error) {
    console.error("[AddOrderForm] Error:", error);
    res.status(500).send("Internal Server Error");
  }
}

async function getProductsByCompany(req, res) {
  try {
    const companyId = req.params.companyId;
    console.log(`[GetProducts] Fetching for companyId: ${companyId}`);

    const products = await Product.find({ 
      Com_id: companyId, 
      Status: { $ne: /^Rejected$/i }
    }).lean();

    console.log("[GetProducts] Fetched:", products.map(p => ({
      prod_id: p.prod_id,
      Prod_name: p.Prod_name,
      Com_id: p.Com_id,
      Status: p.Status
    })));

    res.json(products);
  } catch (error) {
    console.error("[GetProducts] Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

const orders_display = async (req, res) => {
  try {
    console.log("[OrdersDisplay] Session user:", req.user);
    const employee = await Employee.findOne({ e_id: req.user.emp_id }).lean();

    if (!employee) {
      console.log("[OrdersDisplay] Employee not found:", req.user.emp_id);
      return res.status(403).send(`No employee found for emp_id: ${req.user.emp_id}.`);
    }

    if (employee.status !== "active") {
      console.log("[OrdersDisplay] Employee not active:", { e_id: employee.e_id, status: employee.status });
      return res.status(403).send(`Employee (e_id: ${employee.e_id}) is not active.`);
    }

    if (!employee.bid) {
      console.log("[OrdersDisplay] No bid assigned:", { e_id: employee.e_id });
      return res.status(403).send(`No branch assigned to employee (e_id: ${employee.e_id}).`);
    }

    const branch = await Branch.findOne({ bid: employee.bid, active: "active" }).lean();
    if (!branch) {
      console.log("[OrdersDisplay] No active branch for bid:", employee.bid);
      return res.status(403).send(`No active branch for bid: ${employee.bid}.`);
    }

    const orders = await Order.find({ branch_name: branch.b_name }).lean();
    res.render('salesmanager/orders_feature/ordersdisplay', {
      activePage: 'employee',
      activeRoute: 'orders',
      orders,
      branchid: branch.bid,
      branchname: branch.b_name
    });
  } catch (error) {
    console.error("[OrdersDisplay] Error:", error);
    res.status(500).send('Internal Server Error');
  }
};

const order_details = async (req, res) => {
  try {
    console.log("[OrderDetails] Session user:", req.user);
    const employee = await Employee.findOne({ e_id: req.user.emp_id }).lean();

    if (!employee) {
      console.log("[OrderDetails] Employee not found:", req.user.emp_id);
      return res.status(403).send(`No employee found for emp_id: ${req.user.emp_id}.`);
    }

    if (employee.status !== "active") {
      console.log("[OrderDetails] Employee not active:", { e_id: employee.e_id, status: employee.status });
      return res.status(403).send(`Employee (e_id: ${employee.e_id}) is not active.`);
    }

    if (!employee.bid) {
      console.log("[OrderDetails] No bid assigned:", { e_id: employee.e_id });
      return res.status(403).send(`No branch assigned to employee (e_id: ${employee.e_id}).`);
    }

    const branch = await Branch.findOne({ bid: employee.bid, active: "active" }).lean();
    if (!branch) {
      console.log("[OrderDetails] No active branch for bid:", employee.bid);
      return res.status(403).send(`No active branch for bid: ${employee.bid}.`);
    }

    const order = await Order.findOne({ order_id: req.params.id, branch_name: branch.b_name }).lean();
    if (!order) {
      console.log("[OrderDetails] Order not found:", req.params.id);
      return res.status(404).send('Order not found or not accessible');
    }

    res.render('salesmanager/orders_feature/orderdetails', {
      activePage: 'employee',
      activeRoute: 'orders',
      order
    });
  } catch (error) {
    console.error("[OrderDetails] Error:", error);
    res.status(500).send('Internal Server Error');
  }
};

// Shared function to update inventory when order is accepted
async function updateInventoryForOrder(order, branch, session = null) {
  try {
    console.log(`[InventoryUpdate] Starting for order: ${order.order_id}`, {
      status: order.status,
      branch_id: branch.bid,
      branch_name: branch.b_name,
      company_id: order.company_id,
      product_id: order.product_id,
      quantity: order.quantity
    });

    const company = await Company.findOne({ c_id: order.company_id }).lean();
    if (!company) {
      console.error(`[InventoryUpdate] Company not found for c_id: ${order.company_id}`);
      return { success: false, message: `Company not found for c_id: ${order.company_id}` };
    }
    console.log(`[InventoryUpdate] Company found: ${company.cname}`);

    const product = await Product.findOne({ prod_id: order.product_id }).lean();
    if (!product) {
      console.error(`[InventoryUpdate] Product not found for prod_id: ${order.product_id}`);
      return { success: false, message: `Product not found for prod_id: ${order.product_id}` };
    }
    console.log(`[InventoryUpdate] Product found: ${product.Prod_name}`);

    let inventory = await Inventory.findOne({
      branch_id: branch.bid,
      product_id: order.product_id,
      company_id: order.company_id
    }).session(session);

    if (inventory) {
      const oldQuantity = inventory.quantity;
      inventory.quantity = oldQuantity + parseInt(order.quantity);
      inventory.updatedAt = new Date();
      await inventory.save({ session });
      console.log(`[InventoryUpdate] Updated existing inventory: ${inventory._id}`, {
        old_quantity: oldQuantity,
        added_quantity: parseInt(order.quantity),
        new_quantity: inventory.quantity,
        branch_id: inventory.branch_id,
        product_id: inventory.product_id,
        company_id: inventory.company_id
      });
    } else {
      inventory = new Inventory({
        branch_id: branch.bid,
        branch_name: branch.b_name,
        product_id: order.product_id,
        product_name: product.Prod_name,
        company_id: order.company_id,
        company_name: company.cname,
        model_no: product.Model_no,
        quantity: parseInt(order.quantity)
      });
      await inventory.save({ session });
      console.log(`[InventoryUpdate] Created new inventory: ${inventory._id}`, {
        quantity: inventory.quantity,
        branch_id: inventory.branch_id,
        product_id: inventory.product_id,
        company_id: inventory.company_id
      });
    }

    return { success: true };
  } catch (error) {
    console.error(`[InventoryUpdate] Error for order: ${order.order_id}`, {
      error_message: error.message,
      stack: error.stack
    });
    return { success: false, message: error.message };
  }
}

const addorder_post = async (req, res) => {
  try {
    const { branch_name, company_id, product_id, quantity, ordered_date } = req.body;
    console.log("[AddOrder] Session user:", req.user, "Request body:", req.body);

    const employee = await Employee.findOne({ e_id: req.user.emp_id }).lean();
    if (!employee) {
      console.log("[AddOrder] Employee not found:", req.user.emp_id);
      return res.status(403).json({ success: false, message: `No employee found for emp_id: ${req.user.emp_id}.` });
    }

    if (employee.status !== "active") {
      console.log("[AddOrder] Employee not active:", { e_id: employee.e_id, status: employee.status });
      return res.status(403).json({ success: false, message: `Employee (e_id: ${employee.e_id}) is not active.` });
    }

    if (!employee.bid) {
      console.log("[AddOrder] No bid assigned:", { e_id: employee.e_id });
      return res.status(403).json({ success: false, message: `No branch assigned to employee (e_id: ${employee.e_id}).` });
    }

    const branch = await Branch.findOne({ bid: employee.bid, b_name: branch_name, active: "active" }).lean();
    if (!branch) {
      console.log("[AddOrder] No active branch:", { bid: employee.bid, branch_name });
      return res.status(403).json({ success: false, message: `No active branch for bid: ${employee.bid}, branch_name: ${branch_name}.` });
    }

    const company = await Company.findOne({ c_id: company_id }).lean();
    const product = await Product.findOne({ prod_id: product_id }).lean();
    if (!company || !product) {
      console.log("[AddOrder] Invalid company or product:", { company_id, product_id });
      return res.status(400).json({ success: false, message: "Invalid company or product" });
    }

    if (parseInt(quantity) <= 0) {
      console.log("[AddOrder] Invalid quantity:", quantity);
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    const order = new Order({
      order_id: `ORD-${uuidv4().slice(0, 8)}`,
      branch_id: branch.bid,
      branch_name,
      company_id,
      company_name: company.cname,
      product_id,
      product_name: product.Prod_name,
      quantity: parseInt(quantity),
      ordered_date: new Date(ordered_date),
      status: "Pending",
      installation_type: product.installationType || "None"
    });

    await order.save();
    console.log(`[AddOrder] Order created: ${order.order_id}, status: ${order.status}`);
    res.json({ success: true, redirect: "/salesmanager/orders" });
  } catch (error) {
    console.error("[AddOrder] Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const updateDeliveryDate = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, delivery_date, status } = req.body;
    console.log("[UpdateDelivery] Starting:", {
      user: req.user,
      request_body: { order_id, delivery_date, status }
    });

    const company = await Company.findOne({ c_id: req.user.c_id }).lean();
    if (!company) {
      console.log("[UpdateDelivery] Company not found:", req.user.c_id);
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: `No company found for c_id: ${req.user.c_id}.` });
    }

    const order = await Order.findOne({ order_id, company_id: company.c_id }).session(session);
    if (!order) {
      console.log("[UpdateDelivery] Order not found:", { order_id, company_id: company.c_id });
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found or not accessible' });
    }
    console.log("[UpdateDelivery] Order found:", {
      order_id: order.order_id,
      current_status: order.status,
      branch_id: order.branch_id,
      company_id: order.company_id,
      product_id: order.product_id,
      quantity: order.quantity
    });

    const branch = await Branch.findOne({ bid: order.branch_id, active: "active" }).lean();
    if (!branch) {
      console.log("[UpdateDelivery] No active branch:", order.branch_id);
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: `No active branch for order: ${order_id}` });
    }

    if (status && status.toLowerCase() === "accepted" && order.status.toLowerCase() !== "accepted") {
      console.log(`[UpdateDelivery] Status changing to Accepted for order: ${order_id}`);
      const inventoryResult = await updateInventoryForOrder(order, branch, session);
      if (!inventoryResult.success) {
        console.error(`[UpdateDelivery] Inventory update failed: ${inventoryResult.message}`);
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Failed to update inventory: ${inventoryResult.message}` });
      }
      console.log(`[UpdateDelivery] Inventory updated for order: ${order_id}`);
      order.status = status;
    } else if (status) {
      order.status = status;
    }

    if (delivery_date) {
      order.delivery_date = new Date(delivery_date);
    }

    await order.save({ session });
    await session.commitTransaction();
    console.log(`[UpdateDelivery] Order updated: ${order_id}`, {
      status: order.status,
      delivery_date: order.delivery_date
    });

    res.json({ success: true, redirect: '/salesmanager/stocks?success=true' });
  } catch (error) {
    await session.abortTransaction();
    console.error("[UpdateDelivery] Error:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};

const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, status } = req.body;
    console.log("[UpdateOrderStatus] Starting:", {
      user: req.user,
      request_body: { order_id, status }
    });

    const company = await Company.findOne({ c_id: req.user.c_id }).lean();
    if (!company) {
      console.log("[UpdateOrderStatus] Company not found:", req.user.c_id);
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: `No company found for c_id: ${req.user.c_id}.` });
    }

    const order = await Order.findOne({ order_id, company_id: company.c_id }).session(session);
    if (!order) {
      console.log("[UpdateOrderStatus] Order not found:", { order_id, company_id: company.c_id });
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found or not accessible' });
    }
    console.log("[UpdateOrderStatus] Order found:", {
      order_id: order.order_id,
      current_status: order.status,
      branch_id: order.branch_id,
      company_id: order.company_id,
      product_id: order.product_id,
      quantity: order.quantity
    });

    const branch = await Branch.findOne({ bid: order.branch_id, active: "active" }).lean();
    if (!branch) {
      console.log("[UpdateOrderStatus] No active branch:", order.branch_id);
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: `No active branch for order: ${order_id}` });
    }

    if (!status) {
      console.log("[UpdateOrderStatus] No status provided for order:", order_id);
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    if (status.toLowerCase() === "accepted" && order.status.toLowerCase() !== "accepted") {
      console.log(`[UpdateOrderStatus] Changing to Accepted for order: ${order_id}`);
      const inventoryResult = await updateInventoryForOrder(order, branch, session);
      if (!inventoryResult.success) {
        console.error(`[UpdateOrderStatus] Inventory update failed: ${inventoryResult.message}`);
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Failed to update inventory: ${inventoryResult.message}` });
      }
      console.log(`[UpdateOrderStatus] Inventory updated for order: ${order_id}`);
    }

    order.status = status;
    await order.save({ session });
    await session.commitTransaction();
    console.log(`[UpdateOrderStatus] Order updated: ${order_id}`, {
      status: order.status
    });

    res.json({ success: true, redirect: '/salesmanager/stocks?success=true' });
  } catch (error) {
    await session.abortTransaction();
    console.error("[UpdateOrderStatus] Error:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};

module.exports = {
  inventory_display,
  orders_display,
  order_details,
  addorder_post,
  renderAddOrderForm,
  getProductsByCompany,
  updateDeliveryDate,
  updateOrderStatus
};