const Sale = require("../../models/sale");
const Company = require("../../models/company");
const Product = require("../../models/products");
const Employee = require("../../models/employees");
const Branch = require("../../models/branches");
const Inventory = require("../../models/inventory");

async function sales_display(req, res) {
  try {
    const user = res.locals.user;
    const employee = await Employee.findOne({ e_id: user.emp_id });
    if (!employee) {
      return res.status(404).send("Salesman not found");
    }

    const branch = await Branch.findOne({ bid: employee.bid }).lean();
    const branchName = branch ? branch.b_name : "Unknown Branch";

    const sales = await Sale.find({ salesman_id: employee.e_id }).lean();

    const realsales = await Promise.all(
      sales.map(async (sale) => {
        let companyName = "Unknown Company";
        let productName = "Unknown Product";
        let modelNumber = "N/A";

        if (typeof sale.company_id === "string") {
          const company = await Company.findOne({ c_id: sale.company_id }).lean();
          if (company) {
            companyName = company.cname;
          }
        } else {
          const company = await Company.findById(sale.company_id).lean();
          if (company) {
            companyName = company.cname;
          }
        }

        if (typeof sale.product_id === "string") {
          const product = await Product.findOne({ prod_id: sale.product_id }).lean();
          if (product) {
            productName = product.Prod_name;
            modelNumber = product.Model_no;
          }
        } else {
          const product = await Product.findById(sale.product_id).lean();
          if (product) {
            productName = product.Prod_name;
            modelNumber = product.Model_no;
          }
        }

        return {
          ...sale,
          company_name: companyName,
          product_name: productName,
          model_number: modelNumber,
          total_amount: sale.amount,
          saledate: sale.sales_date
        };
      })
    );

    res.render("salesman/sales_features/sales", {
      salers: realsales,
      branchName: branchName,
      activePage: 'employee',
      activeRoute: 'sales'
    });
  } catch (error) {
    console.error("Error rendering sales:", error);
    res.status(500).send("Internal server error");
  }
}

async function salesdetaildisplay(req, res) {
  try {
    const user = res.locals.user;
    const employee = await Employee.findOne({ e_id: user.emp_id });
    if (!employee) {
      return res.status(404).send("Salesman not found");
    }

    const id = req.params.sales_id;
    const sale = await Sale.findOne({ sales_id: id, salesman_id: employee.e_id }).lean();

    if (!sale) {
      return res.status(404).send("Sale not found");
    }

    const branch = await Branch.findOne({ bid: employee.bid }).lean();
    const branchName = branch ? branch.b_name : "Unknown Branch";

    let companyName = "Unknown Company";
    let productName = "Unknown Product";
    let modelNumber = "N/A";

    if (typeof sale.company_id === "string") {
      const company = await Company.findOne({ c_id: sale.company_id }).lean();
      if (company) {
        companyName = company.cname;
      }
    } else {
      const company = await Company.findById(sale.company_id).lean();
      if (company) {
        companyName = company.cname;
      }
    }

    if (typeof sale.product_id === "string") {
      const product = await Product.findOne({ prod_id: sale.product_id }).lean();
      if (product) {
        productName = product.Prod_name;
        modelNumber = product.Model_no;
      }
    } else {
      const product = await Product.findById(sale.product_id).lean();
      if (product) {
        productName = product.Prod_name;
        modelNumber = product.Model_no;
      }
    }

    res.render("salesman/sales_features/sales_details", {
      sale: {
        ...sale,
        company_name: companyName,
        product_name: productName,
        model_number: modelNumber,
        salesman_name: `${employee.f_name} ${employee.last_name}`,
        branch_name: branchName,
        total_amount: sale.amount,
        saledate: sale.sales_date,
        price: sale.sold_price
      },
      activePage: 'employee',
      activeRoute: 'sales',
      showForm: req.query.add === 'true'
    });
  } catch (error) {
    console.error("Error rendering sales details:", error);
    res.status(500).send("Internal server error");
  }
}

async function renderAddSaleForm(req, res) {
  try {
    const user = res.locals.user;
    const employee = await Employee.findOne({ e_id: user.emp_id });
    if (!employee) {
      return res.status(404).send("Salesman not found");
    }

    const branch = await Branch.findOne({ bid: employee.bid }).lean();
    const branchName = branch ? branch.b_name : "Unknown Branch";

    const companies = await Company.find({ active: "active" }).lean();
    res.render("salesman/sales_features/addsale", {
      companies,
      branchName: branchName,
      activePage: 'employee',
      activeRoute: 'sales',
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error rendering add sale form:", error);
    res.status(500).send("Internal server error");
  }
}

async function addSale(req, res) {
  try {
    const user = res.locals.user;
    const employee = await Employee.findOne({ e_id: user.emp_id });
    if (!employee) {
      return res.status(404).send("Salesman not found");
    }

    const {
      customer_name,
      sales_date,
      unique_code,
      company_id,
      product_id,
      purchased_price,
      sold_price,
      quantity,
      phone_number
    } = req.body;

    // Validate unique_code
    const existingSale = await Sale.findOne({ unique_code });
    if (existingSale) {
      return res.redirect(`/salesman/add-sale?error=Unique code ${unique_code} already exists. Please use a different code.`);
    }

    // Validate company
    const company = await Company.findOne({ c_id: company_id }).lean();
    if (!company) {
      return res.redirect(`/salesman/add-sale?error=Company not found`);
    }

    // Validate product
    const product = await Product.findOne({ prod_id: product_id }).lean();
    if (!product) {
      return res.redirect(`/salesman/add-sale?error=Product not found`);
    }

    // Validate inventory
    const inventory = await Inventory.findOne({
      branch_id: employee.bid,
      product_id,
      company_id
    });
    if (!inventory || inventory.quantity < parseInt(quantity)) {
      return res.redirect(`/salesman/add-sale?error=Insufficient inventory for ${product.Prod_name} (Available: ${inventory ? inventory.quantity : 0})`);
    }

    // Generate sales_id
    const count = await Sale.countDocuments() + 1;
    const sales_id = `S${String(count).padStart(3, '0')}`;

    // Calculate amount and profit/loss
    const amount = parseFloat(sold_price) * parseInt(quantity);
    const profit_or_loss = (parseFloat(sold_price) - parseFloat(purchased_price)) * parseInt(quantity);

    // Create sale
    const newSale = new Sale({
      sales_id,
      branch_id: employee.bid,
      salesman_id: employee.e_id,
      company_id: company.c_id,
      product_id: product.prod_id,
      customer_name,
      sales_date: new Date(sales_date),
      unique_code,
      purchased_price: parseFloat(purchased_price),
      sold_price: parseFloat(sold_price),
      quantity: parseInt(quantity),
      amount,
      profit_or_loss,
      phone_number
    });

    // Update inventory
    inventory.quantity -= parseInt(quantity);
    inventory.updatedAt = new Date();
    await inventory.save();

    await newSale.save();
    res.redirect("/salesman/sales?success=true");
  } catch (error) {
    console.error("Error adding sale:", error);
    res.redirect(`/salesman/add-sale?error=Failed to add sale: ${error.message}`);
  }
}

module.exports = { sales_display, salesdetaildisplay, renderAddSaleForm, addSale };