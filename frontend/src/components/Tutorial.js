export default function Tutorial() {
    const sections = [
        {
            title: "Getting Started",
            items: [
                { label: "Register an Account", desc: "Go to Register and create your account. The first user is automatically an admin. Subsequent users are employees." },
                { label: "Login", desc: "Use your username and password to log in. Your session stays active for 7 days." },
                { label: "Admin vs Employee", desc: "Admins see Payroll and Settings tabs. Employees can record sales/expenses, view inventory, reports, and generate invoices." },
            ],
        },
        {
            title: "Dashboard",
            items: [
                { label: "Summary Cards", desc: "Three cards show total Sales, total Expenses, and Profit/Loss for the selected period." },
                { label: "Filters", desc: "Use the category dropdown and date range pickers to filter all dashboard data. Click Apply to refresh." },
                { label: "Low-Stock Alert", desc: "If any product stock is at or below its reorder threshold, a warning banner appears at the top." },
                { label: "Charts", desc: "Sales vs Expenses (monthly line chart) shows trends over time. The pie chart gives a quick sales/expenses split by value." },
                { label: "Category Breakdown", desc: "Bar chart showing sales and expenses grouped by category." },
                { label: "Recent Transactions", desc: "The last 10 sales and expenses combined, newest first. Green for sales, red for expenses." },
            ],
        },
        {
            title: "Sales",
            items: [
                { label: "Record a Sale", desc: "Fill in Item/Service name, sale amount, category, and optionally link a product to auto-deduct stock. Click Add Sale." },
                { label: "Summary Cards", desc: "Revenue (total sales), Cost of Goods Sold (COGS from linked products), Gross Profit, and Margin percentage." },
                { label: "Table Columns", desc: "Each row shows Item, Amount, Category (as a badge), COGS, Gross Profit, Margin, Date, and action buttons." },
                { label: "Edit / Delete", desc: "Click Edit to change item, amount, or category. Click Delete to remove (confirm dialog appears)." },
                { label: "Search & Pagination", desc: "Search by item name. Results paginate at 10 per page with Prev/Next buttons." },
                { label: "Export CSV", desc: "Click Export CSV to download all matching sales as a .csv file." },
            ],
        },
        {
            title: "Expenses",
            items: [
                { label: "Record an Expense", desc: "Fill in Expense Item name, cost amount, and category. Click Add Expense." },
                { label: "Summary Cards", desc: "Total Expenses, Average per expense, and total Expense Count for the current view." },
                { label: "Edit / Delete / Search / Export", desc: "Same controls as Sales — edit inline, delete with confirmation, search by name, export to CSV." },
            ],
        },
        {
            title: "Inventory",
            items: [
                { label: "Products Tab", desc: "View all products with Name, SKU, Stock, Reorder Threshold, Unit Cost, Total Value, and Status (OK / Low)." },
                { label: "Add / Edit Product", desc: "Click Add Product to show the inline form. Enter name, SKU (optional), initial stock, reorder threshold, and unit cost." },
                { label: "Low Stock Detection", desc: "When stock ≤ reorder threshold, the row is highlighted and a badge shows Low. A banner alerts on Dashboard too." },
                { label: "Auto-Deduct on Sale", desc: "When a sale is linked to a product, the product's stock decreases automatically and COGS is recorded from the product's unit cost." },
                { label: "Purchase History Tab", desc: "View all restock events. Admin can record a new purchase by selecting product, quantity, and unit cost — stock updates automatically." },
            ],
        },
        {
            title: "Payroll",
            items: [
                { label: "Employees Tab", desc: "View all employees with Name, Pay Type (salary/hourly), Rate, and Tax ID. Admin can add/edit/delete employees." },
                { label: "Add Employee", desc: "Admin: click Add Employee. Enter name, choose Hourly or Salary, set the rate, and optionally add a Tax ID." },
                { label: "Run Payroll", desc: "Admin: select an employee, enter hours worked (for hourly), and click Run Payroll. The system calculates gross pay, deducts 20% tax, and records net pay." },
                { label: "Payroll History Tab", desc: "View all payroll runs showing Employee, Type, Hours, Gross, Tax, Net, and Date. Admin can delete entries." },
                { label: "Summary Cards", desc: "Total Employees, Total Gross Pay, Total Tax Withheld, and Total Net Pay across all history." },
            ],
        },
        {
            title: "Reports",
            items: [
                { label: "Balance Sheet", desc: "Shows Revenue, Expenses, Net Income, and Inventory Value in summary cards." },
                { label: "Income Chart", desc: "Bar chart comparing Revenue, Expenses, and Net Income for a quick financial snapshot." },
                { label: "Equity Breakdown", desc: "Table showing Cash, Inventory, Total Assets, Liabilities, and Total Equity." },
            ],
        },
        {
            title: "Invoice Generator",
            items: [
                { label: "Invoice Form (Left Panel)", desc: "Enter Invoice Number (auto-generated), Customer Name, and Due Date. The form is in the left column." },
                { label: "Select Items", desc: "Browse your sales records. Check the box next to each item to include it. Use Select All to toggle all." },
                { label: "Preview (Right Panel)", desc: "A live preview sidebar shows the selected items, customer name, invoice number, due date, and running total." },
                { label: "Generate & Download", desc: "Click Generate Invoice to create the PDF. Once generated, a Download PDF button appears. The PDF includes a professional layout with header, item table, and totals." },
            ],
        },
        {
            title: "Settings (Admin)",
            items: [
                { label: "Manage Categories", desc: "Admins can add, edit, and delete categories. Each category can apply to Sales, Expenses, or Both. These categories appear in dropdowns when recording sales and expenses." },
                { label: "Default Categories", desc: "Pre-loaded categories include General, Products, Services, Rent, Utilities, Supplies, Materials, Labor, Shipping, Marketing, Insurance, Taxes, Maintenance, Software, Travel, and Other." },
            ],
        },
        {
            title: "Tips & Best Practices",
            items: [
                { label: "Link Sales to Products", desc: "When recording a sale, select a product to auto-track COGS and inventory. This gives you accurate Gross Profit and Margin numbers." },
                { label: "Use Categories Consistently", desc: "Tag every sale and expense with a category. This enables the Dashboard category filter and the Reports balance sheet." },
                { label: "Run Payroll Monthly", desc: "For salaried employees, run payroll once per month. For hourly, run after collecting timesheets." },
                { label: "Low Stock Alerts", desc: "Set reorder thresholds on your products. The Dashboard and Inventory page will alert you when it's time to restock." },
            ],
        },
    ];

    return (
        <div className="page">
            <h1>Tutorial</h1>
            <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 24 }}>
                A complete guide to using every feature in Business-in-a-Box.
            </p>

            {sections.map((section, si) => (
                <div key={si} className="card-section" style={{ marginBottom: 20 }}>
                    <h3 style={{ marginBottom: 12 }}>{section.title}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {section.items.map((item, ii) => (
                            <div className="tutorial-item" style={{ padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid #3b82f6" }}>
                                <strong style={{ fontSize: 14 }}>{item.label}</strong>
                                <p style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="card-section" style={{ marginTop: 8 }}>
                <h3>Need Help?</h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    Contact support at support@businessbox.com or refer to this tutorial for step-by-step guidance on each feature.
                </p>
            </div>
        </div>
    );
}