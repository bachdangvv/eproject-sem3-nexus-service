using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

/// <summary>Shared EF Core DbContext defining schema constraints, relationships, and demo seed data.</summary>
public abstract partial class NexusDb(DbContextOptions options) : DbContext(options)
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<ServicePlan> Plans => Set<ServicePlan>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ServiceRequest> Requests => Set<ServiceRequest>();
    public DbSet<ServiceOrder> Orders => Set<ServiceOrder>();
    public DbSet<OrderEvent> OrderEvents => Set<OrderEvent>();
    public DbSet<Connection> Connections => Set<Connection>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<PaymentTransaction> Payments => Set<PaymentTransaction>();
    public DbSet<ServiceFeedback> Feedback => Set<ServiceFeedback>();
    public DbSet<RetailShop> RetailShops => Set<RetailShop>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<VendorPayment> VendorPayments => Set<VendorPayment>();
    public DbSet<EquipmentIncident> EquipmentIncidents => Set<EquipmentIncident>();
    public DbSet<CustomerDocument> CustomerDocuments => Set<CustomerDocument>();
    public DbSet<PlanChangeRequest> PlanChangeRequests => Set<PlanChangeRequest>();
    public DbSet<CustomerQuery> CustomerQueries => Set<CustomerQuery>();
    public DbSet<SecurityDeposit> SecurityDeposits => Set<SecurityDeposit>();
    public DbSet<DepositTransaction> DepositTransactions => Set<DepositTransaction>();
    public DbSet<AdvanceAccount> AdvanceAccounts => Set<AdvanceAccount>();
    public DbSet<AdvanceTransaction> AdvanceTransactions => Set<AdvanceTransaction>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        ConfigureProperties(model);
        ConfigureDeposits(model);
        ConfigureAdvances(model);
        model.Entity<Employee>().HasIndex(user => user.Username).IsUnique();
        model.Entity<Employee>().HasOne(user => user.RetailShop).WithMany()
            .HasForeignKey(user => user.RetailShopId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Employee>().HasOne(user => user.Customer).WithOne()
            .HasForeignKey<Employee>(user => user.CustomerId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Customer>().HasIndex(customer => customer.Phone);
        model.Entity<Customer>().HasOne(customer => customer.City).WithMany()
            .HasForeignKey(customer => customer.CityCode).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ServicePlan>(plan =>
        {
            plan.Property(p => p.Price).HasPrecision(12, 2);
            plan.Property(p => p.LocalCallRate).HasPrecision(12, 2);
            plan.Property(p => p.StdCallRate).HasPrecision(12, 2);
            plan.Property(p => p.MobileMsgRate).HasPrecision(12, 2);
            plan.ToTable(table =>
                table.HasCheckConstraint("CK_Plans_ValidityMonths", "ValidityMonths IN (1, 3, 6, 12)"));
        });
        model.Entity<ServiceRequest>(request =>
        {
            request.Property(r => r.SnapshotPrice).HasPrecision(12, 2);
            request.HasOne(r => r.Plan).WithMany().OnDelete(DeleteBehavior.Restrict);
            request.HasOne(r => r.Customer).WithMany().OnDelete(DeleteBehavior.Restrict);
            request.HasOne<Employee>().WithMany().HasForeignKey(r => r.CreatedById).OnDelete(DeleteBehavior.Restrict);
            request.HasOne(r => r.RetailShop).WithMany().HasForeignKey(r => r.RetailShopId).OnDelete(DeleteBehavior.Restrict);
            request.HasOne(r => r.Order).WithOne(order => order.Request)
                .HasForeignKey<ServiceOrder>(order => order.RequestId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<ServiceOrder>().HasOne(order => order.Connection).WithOne()
            .HasForeignKey<Connection>(connection => connection.OrderId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ServiceOrder>().HasMany(order => order.History).WithOne()
            .HasForeignKey(entry => entry.OrderId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ServiceOrder>().HasMany(order => order.Feedback).WithOne()
            .HasForeignKey(entry => entry.OrderId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<OrderEvent>().HasOne(entry => entry.Actor).WithMany()
            .HasForeignKey(entry => entry.ActorId).OnDelete(DeleteBehavior.Restrict);
        // Numeric keys serve as globally unique serials. Constraints preserve both public ID widths.
        model.Entity<ServiceOrder>().ToTable(table =>
            table.HasCheckConstraint("CK_Orders_Serial", "Id >= 1 AND Id <= 9999999999"));
        model.Entity<Connection>().ToTable(table =>
            table.HasCheckConstraint("CK_Connections_Serial", "Id >= 1 AND Id <= 999999999999"));
        model.Entity<Invoice>(invoice =>
        {
            invoice.HasKey(i => i.Id);
            invoice.HasIndex(i => i.InvoiceNumber).IsUnique();
            invoice.Property(i => i.RentalAmount).HasPrecision(12, 2);
            invoice.Property(i => i.LocalMinutes).HasPrecision(10, 2);
            invoice.Property(i => i.StdMinutes).HasPrecision(10, 2);
            invoice.Property(i => i.MobileMinutes).HasPrecision(10, 2);
            invoice.Property(i => i.CallUsageAmount).HasPrecision(12, 2);
            invoice.Property(i => i.EquipmentFee).HasPrecision(12, 2);
            invoice.Property(i => i.Subtotal).HasPrecision(12, 2);
            invoice.Property(i => i.DiscountAmount).HasPrecision(12, 2);
            invoice.Property(i => i.TaxRate).HasPrecision(6, 4);
            invoice.Property(i => i.TaxAmount).HasPrecision(12, 2);
            invoice.Property(i => i.DepositAmount).HasPrecision(12, 2);
            invoice.Property(i => i.PreviousDueBalance).HasPrecision(12, 2);
            invoice.Property(i => i.TotalAmount).HasPrecision(12, 2);
            invoice.Property(i => i.PaidAmount).HasPrecision(12, 2);
            invoice.Property(i => i.DueAmount).HasPrecision(12, 2);
            invoice.Property(i => i.PaidAt).IsConcurrencyToken();
            invoice.Property(i => i.PaidAmount).IsConcurrencyToken();
            invoice.Property(i => i.DueAmount).IsConcurrencyToken();
            invoice.HasOne(i => i.Connection).WithMany(c => c.Invoices)
                .HasForeignKey(i => i.ConnectionId).OnDelete(DeleteBehavior.Restrict);
            invoice.HasOne(i => i.CreatedBy).WithMany()
                .HasForeignKey(i => i.CreatedById).OnDelete(DeleteBehavior.Restrict);
            invoice.HasOne(i => i.PaidBy).WithMany()
                .HasForeignKey(i => i.PaidById).OnDelete(DeleteBehavior.Restrict);
            invoice.HasMany(i => i.Payments).WithOne(p => p.Invoice)
                .HasForeignKey(p => p.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PaymentTransaction>(payment =>
        {
            payment.HasKey(p => p.Id);
            payment.Property(p => p.Amount).HasPrecision(12, 2);
            payment.HasOne(p => p.PaidBy).WithMany()
                .HasForeignKey(p => p.PaidById).OnDelete(DeleteBehavior.Restrict);
            payment.HasOne(p => p.RetailShop).WithMany()
                .HasForeignKey(p => p.RetailShopId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<ServiceFeedback>().HasOne(entry => entry.RecordedBy).WithMany()
            .OnDelete(DeleteBehavior.Restrict);
        model.Entity<ServiceFeedback>().ToTable(table =>
            table.HasCheckConstraint("CK_Feedback_Rating", "Rating >= 1 AND Rating <= 5"));

        model.Entity<Connection>()
            .HasOne(c => c.AssignedProduct).WithMany().HasForeignKey(c => c.AssignedProductId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Connection>()
            .HasOne(c => c.RefundedBy).WithMany().HasForeignKey(c => c.RefundedById).OnDelete(DeleteBehavior.Restrict);

        model.Entity<RetailShop>(shop =>
        {
            shop.HasKey(s => s.Id);
            shop.HasIndex(s => s.Code).IsUnique();
            shop.HasOne(s => s.City).WithMany().HasForeignKey(s => s.CityCode).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<Vendor>(vendor =>
        {
            vendor.HasKey(v => v.Id);
            vendor.HasIndex(v => v.Code).IsUnique();
        });

        model.Entity<PurchaseOrder>(po =>
        {
            po.HasKey(p => p.Id);
            po.HasIndex(p => p.OrderNumber).IsUnique();
            po.HasOne(p => p.Vendor).WithMany().HasForeignKey(p => p.VendorId).OnDelete(DeleteBehavior.Restrict);
            po.HasOne(p => p.Product).WithMany().HasForeignKey(p => p.ProductId).OnDelete(DeleteBehavior.Restrict);
            po.HasMany(p => p.Payments).WithOne(vp => vp.PurchaseOrder).HasForeignKey(vp => vp.PurchaseOrderId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<VendorPayment>(vp =>
        {
            vp.HasKey(v => v.Id);
            vp.HasIndex(v => v.PaymentNumber).IsUnique();
            vp.HasOne(v => v.Vendor).WithMany().HasForeignKey(v => v.VendorId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<EquipmentIncident>(incident =>
        {
            incident.HasKey(i => i.Id);
            incident.HasOne(i => i.Connection).WithMany(c => c.Incidents).HasForeignKey(i => i.ConnectionId).OnDelete(DeleteBehavior.Restrict);
            incident.HasOne(i => i.Product).WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Restrict);
            incident.HasOne(i => i.RecordedBy).WithMany().HasForeignKey(i => i.RecordedById).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<CustomerDocument>(doc =>
        {
            doc.HasKey(d => d.Id);
            doc.HasOne(d => d.Customer).WithMany().HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.Restrict);
            doc.HasOne(d => d.City).WithMany().HasForeignKey(d => d.CityCode).OnDelete(DeleteBehavior.Restrict);
            doc.HasOne(d => d.UploadedBy).WithMany().HasForeignKey(d => d.UploadedById).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PlanChangeRequest>(pcr =>
        {
            pcr.HasKey(p => p.Id);
            pcr.HasOne(p => p.Connection).WithMany().HasForeignKey(p => p.ConnectionId).OnDelete(DeleteBehavior.Restrict);
            pcr.HasOne(p => p.TargetPlan).WithMany().HasForeignKey(p => p.TargetPlanId).OnDelete(DeleteBehavior.Restrict);
            pcr.HasOne(p => p.RequestedBy).WithMany().HasForeignKey(p => p.RequestedById).OnDelete(DeleteBehavior.Restrict);
            pcr.HasOne(p => p.ReviewedBy).WithMany().HasForeignKey(p => p.ReviewedById).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<CustomerQuery>(cq =>
        {
            cq.HasKey(q => q.Id);
            cq.HasOne(q => q.Customer).WithMany().HasForeignKey(q => q.CustomerId).OnDelete(DeleteBehavior.Restrict);
            cq.HasOne(q => q.CreatedBy).WithMany().HasForeignKey(q => q.CreatedById).OnDelete(DeleteBehavior.Restrict);
            cq.HasOne(q => q.AnsweredBy).WithMany().HasForeignKey(q => q.AnsweredById).OnDelete(DeleteBehavior.Restrict);
            cq.HasOne(q => q.ClosedBy).WithMany().HasForeignKey(q => q.ClosedById).OnDelete(DeleteBehavior.Restrict);
        });
    }

    public static void SeedDemo(DbContext context, bool _)
    {
        var db = (NexusDb)context;
        if (db.Employees.Any() || db.Cities.Any()) return;

        var hasher = new PasswordHasher<Employee>();
        var empMap = new Dictionary<string, Employee>();
        foreach (var role in Roles.Staff)
        {
            var user = new Employee
            {
                Username = role.ToLowerInvariant() + ".demo",
                DisplayName = role + " Demo",
                Role = role,
                PasswordHash = ""
            };
            user.PasswordHash = hasher.HashPassword(user, "Nexus-Demo-2026!");
            db.Employees.Add(user);
            empMap[role] = user;
        }

        var city101 = new City { Code = "101", Name = "City 101" };
        db.Cities.Add(city101);
        var customer = new Customer
        {
            Name = "Trần Minh B", SearchName = "TRẦN MINH B", Phone = "0900000002", Address = "10 Nexus Street", CityCode = "101",
            Status = "ACTIVE"
        };
        db.Customers.Add(customer);

        var customerUser = new Employee
        {
            Username = "customer.demo",
            DisplayName = "Trần Minh B",
            Role = Roles.Customer,
            PasswordHash = "",
            Active = true,
            Customer = customer
        };
        customerUser.PasswordHash = hasher.HashPassword(customerUser, "Nexus-Demo-2026!");
        db.Employees.Add(customerUser);
        empMap[Roles.Customer] = customerUser;
        var bbPlan = new ServicePlan { Name = "BB Basic", Type = "B", Price = 225, Description = "64 Kbps · monthly", ValidityMonths = 1, SpeedKbps = 64 };
        var bb128Plan = new ServicePlan { Name = "BB Unlimited 128Kbps Monthly", Type = "B", Price = 350, Description = "128 Kbps · monthly", ValidityMonths = 1, SpeedKbps = 128 };
        var dialPlan = new ServicePlan { Name = "Dial-up 10h", Type = "D", Price = 50, Description = "10 hours · one month", ValidityMonths = 1, HoursAllowance = 10 };
        var landlinePlan = new ServicePlan { Name = "Landline Monthly", Type = "T", Price = 35, Description = "Monthly local rental · 75c/min local", LocalCallRate = 0.75m, ValidityMonths = 1 };
        db.Plans.AddRange(
            bbPlan,
            dialPlan,
            landlinePlan,
            // Canonical Dial-Up (D) plans from specification
            new ServicePlan { Name = "Dial-up 30h", Type = "D", Price = 130, Description = "30 hours · 3 months validity", ValidityMonths = 3, HoursAllowance = 30 },
            new ServicePlan { Name = "Dial-up 60h", Type = "D", Price = 260, Description = "60 hours · 6 months validity", ValidityMonths = 6, HoursAllowance = 60 },
            new ServicePlan { Name = "Dial-up Unlimited 28Kbps Monthly", Type = "D", Price = 75, Description = "Unlimited 28 Kbps · monthly", ValidityMonths = 1, SpeedKbps = 28 },
            new ServicePlan { Name = "Dial-up Unlimited 28Kbps Quarterly", Type = "D", Price = 150, Description = "Unlimited 28 Kbps · quarterly", ValidityMonths = 3, SpeedKbps = 28 },
            new ServicePlan { Name = "Dial-up Unlimited 56Kbps Monthly", Type = "D", Price = 100, Description = "Unlimited 56 Kbps · monthly", ValidityMonths = 1, SpeedKbps = 56 },
            new ServicePlan { Name = "Dial-up Unlimited 56Kbps Quarterly", Type = "D", Price = 180, Description = "Unlimited 56 Kbps · quarterly", ValidityMonths = 3, SpeedKbps = 56 },
            // Canonical Broadband (B) plans from specification
            new ServicePlan { Name = "BB Hourly 30h", Type = "B", Price = 175, Description = "30 hours · 1 month validity", ValidityMonths = 1, HoursAllowance = 30 },
            new ServicePlan { Name = "BB Hourly 60h", Type = "B", Price = 315, Description = "60 hours · 6 months validity", ValidityMonths = 6, HoursAllowance = 60 },
            new ServicePlan { Name = "BB Unlimited 64Kbps Quarterly", Type = "B", Price = 400, Description = "64 Kbps · quarterly", ValidityMonths = 3, SpeedKbps = 64 },
            bb128Plan,
            new ServicePlan { Name = "BB Unlimited 128Kbps Quarterly", Type = "B", Price = 445, Description = "128 Kbps · quarterly", ValidityMonths = 3, SpeedKbps = 128 },
            // Canonical Landline (T) plans from specification with per-minute call tariffs
            new ServicePlan { Name = "Landline Local Unlimited Yearly", Type = "T", Price = 75, Description = "Yearly local rental · 55c/min local", LocalCallRate = 0.55m, ValidityMonths = 12 },
            new ServicePlan { Name = "Landline STD Monthly", Type = "T", Price = 125, Description = "Monthly STD rental · 70c local / $2.25 STD / $1.00 mobile", LocalCallRate = 0.70m, StdCallRate = 2.25m, MobileMsgRate = 1.00m, ValidityMonths = 1 },
            new ServicePlan { Name = "Landline STD Half-Yearly", Type = "T", Price = 420, Description = "Half-yearly STD rental · 60c local / $2.00 STD / $1.15 mobile", LocalCallRate = 0.60m, StdCallRate = 2.00m, MobileMsgRate = 1.15m, ValidityMonths = 6 },
            // Doc 1 §Financial, p.6 (P141) omits the numeric dollar figure ("Yearly - $"); $780 is an assumed seed default (Admin-editable).
            new ServicePlan { Name = "Landline STD Yearly", Type = "T", Price = 780, Description = "Yearly STD rental · 60c local / $1.75 STD / $1.25 mobile", LocalCallRate = 0.60m, StdCallRate = 1.75m, MobileMsgRate = 1.25m, ValidityMonths = 12 }
        );

        var router = new Product { Name = "Demo broadband router", Description = "Equipment catalog sample", QuantityInStock = 25, ReplacementPrice = 45.00m };
        var opticalRouter = new Product { Name = "Broadband Optical Router", Description = "Gigabit dual-band Wi-Fi 6 fiber ONT terminal", QuantityInStock = 40, ReplacementPrice = 75.00m };
        var adslModem = new Product { Name = "ADSL2+ High-Speed Modem", Description = "Standard copper broadband DSL modem router", QuantityInStock = 18, ReplacementPrice = 30.00m };
        var landlinePhone = new Product { Name = "Nexus Landline Telephone Handset", Description = "Caller ID digital desktop corded handset", QuantityInStock = 50, ReplacementPrice = 20.00m };
        db.Products.AddRange(router, opticalRouter, adslModem, landlinePhone);

        var shop1 = new RetailShop { Code = "RS-101-01", Name = "Nexus Central Flagship Outlet", CityCode = "101", Address = "108 Tran Hung Dao, District 1", Phone = "02839001001", Active = true };
        var shop2 = new RetailShop { Code = "RS-101-02", Name = "Nexus Westside Service Center", CityCode = "101", Address = "45 Nguyen Trai, District 5", Phone = "02839001002", Active = true };
        var shop3 = new RetailShop { Code = "RS-101-03", Name = "Nexus Tech Zone Outlet", CityCode = "101", Address = "220 Vo Van Ngan, Thu Duc", Phone = "02839001003", Active = true };
        db.RetailShops.AddRange(shop1, shop2, shop3);

        var vendor1 = new Vendor { Code = "VND-CISCO", Name = "Cisco Systems Network Vietnam", ContactPerson = "Le Hoang Nam", Phone = "02838221000", Email = "orders@cisco.com.vn", Address = "Level 14, Sunwah Tower, 115 Nguyen Hue, Dist 1", Active = true };
        var vendor2 = new Vendor { Code = "VND-HUAWEI", Name = "Huawei Technologies Optical Co.", ContactPerson = "Nguyen Thu Trang", Phone = "02437725888", Email = "telecom@huawei.vn", Address = "Keangnam Landmark 72, Pham Hung, Hanoi", Active = true };
        var vendor3 = new Vendor { Code = "VND-VNPT", Name = "VNPT Technology Devices JSC", ContactPerson = "Pham Quoc Bao", Phone = "02437669999", Email = "contact@vnpt-technology.vn", Address = "124 Hoang Quoc Viet, Cau Giay, Hanoi", Active = true };
        db.Vendors.AddRange(vendor1, vendor2, vendor3);

        var po1 = new PurchaseOrder
        {
            OrderNumber = "PO-000001",
            Vendor = vendor1,
            Product = opticalRouter,
            Quantity = 50,
            UnitPrice = 55.00m,
            TotalAmount = 2750.00m,
            Status = "Received",
            OrderedAt = DateTime.UtcNow.AddDays(-10),
            ReceivedAt = DateTime.UtcNow.AddDays(-5),
            Note = "Q1 core fiber ONT terminal inventory replenishment"
        };
        var po2 = new PurchaseOrder
        {
            OrderNumber = "PO-000002",
            Vendor = vendor2,
            Product = adslModem,
            Quantity = 20,
            UnitPrice = 22.00m,
            TotalAmount = 440.00m,
            Status = "Received",
            OrderedAt = DateTime.UtcNow.AddDays(-7),
            ReceivedAt = DateTime.UtcNow.AddDays(-2),
            Note = "Backup copper modem inventory"
        };
        var po3 = new PurchaseOrder
        {
            OrderNumber = "PO-000003",
            Vendor = vendor3,
            Product = landlinePhone,
            Quantity = 60,
            UnitPrice = 15.00m,
            TotalAmount = 900.00m,
            Status = "Ordered",
            OrderedAt = DateTime.UtcNow.AddDays(-1),
            ReceivedAt = null,
            Note = "Standard corded telephone sets delivery"
        };
        db.PurchaseOrders.AddRange(po1, po2, po3);

        var vp1 = new VendorPayment
        {
            PaymentNumber = "VP-000001",
            PurchaseOrder = po1,
            Vendor = vendor1,
            Amount = 2750.00m,
            PaidAt = DateTime.UtcNow.AddDays(-4),
            Method = "BankTransfer",
            Reference = "VCB-99823101",
            Note = "Settled in full via Vietcombank corporate transfer"
        };
        var vp2 = new VendorPayment
        {
            PaymentNumber = "VP-000002",
            PurchaseOrder = po2,
            Vendor = vendor2,
            Amount = 220.00m,
            PaidAt = DateTime.UtcNow.AddDays(-1),
            Method = "BankTransfer",
            Reference = "BIDV-7712390",
            Note = "50% advance payment for modem batch"
        };
        db.VendorPayments.AddRange(vp1, vp2);
        db.SaveChanges();

        var retailEmp = empMap[Roles.Retail];
        retailEmp.RetailShopId = shop1.Id;
        var techEmp = empMap[Roles.Technical];
        var adminEmp = empMap[Roles.Admin];
        var billingEmp = empMap[Roles.Billing];

        // Demo Service Requests, Orders, and Connections exhibiting lifecycle statuses
        var reqActive = new ServiceRequest
        {
            CustomerId = customer.Id,
            Customer = customer,
            PlanId = bbPlan.Id,
            Plan = bbPlan,
            PlanName = bbPlan.Name,
            Type = bbPlan.Type,
            CityCode = "101",
            Address = "10 Nexus Street",
            SnapshotPrice = bbPlan.Price,
            ConnectionCount = 1,
            CreatedById = retailEmp.Id
        };
        var orderActive = reqActive.Confirm(retailEmp.Id);
        orderActive.Assess(true, true, null, "Standard fiber line verified.", techEmp.Id);
        SeedDepositReceipt(orderActive, retailEmp);
        orderActive.Activate(techEmp.Id, opticalRouter.Id);
        foreach (var ev in orderActive.History) ev.Actor = ev.Status == OrderStatus.Pending ? retailEmp : techEmp;
        orderActive.Connection!.Status = "Active";
        orderActive.Connection.ActivatedAt = DateTime.UtcNow.AddMonths(-3);
        db.Requests.Add(reqActive);

        var reqSuspended = new ServiceRequest
        {
            CustomerId = customer.Id,
            Customer = customer,
            PlanId = dialPlan.Id,
            Plan = dialPlan,
            PlanName = dialPlan.Name,
            Type = dialPlan.Type,
            CityCode = "101",
            Address = "10 Nexus Street",
            SnapshotPrice = dialPlan.Price,
            ConnectionCount = 1,
            CreatedById = retailEmp.Id
        };
        var orderSuspended = reqSuspended.Confirm(retailEmp.Id);
        orderSuspended.Assess(true, true, true, "Landline pair available.", techEmp.Id);
        SeedDepositReceipt(orderSuspended, retailEmp);
        orderSuspended.Activate(techEmp.Id, adslModem.Id);
        foreach (var ev in orderSuspended.History) ev.Actor = ev.Status == OrderStatus.Pending ? retailEmp : techEmp;
        orderSuspended.Connection!.Status = "TemporarilyInactive";
        orderSuspended.Connection.SuspendReason = "Customer requested temporary seasonal suspension.";
        orderSuspended.Connection.SuspendedAt = DateTime.UtcNow.AddDays(-14);
        orderSuspended.Connection.ActivatedAt = DateTime.UtcNow.AddMonths(-5);
        db.Requests.Add(reqSuspended);

        var reqTerminated = new ServiceRequest
        {
            CustomerId = customer.Id,
            Customer = customer,
            PlanId = landlinePlan.Id,
            Plan = landlinePlan,
            PlanName = landlinePlan.Name,
            Type = landlinePlan.Type,
            CityCode = "101",
            Address = "10 Nexus Street",
            SnapshotPrice = landlinePlan.Price,
            ConnectionCount = 1,
            CreatedById = retailEmp.Id
        };
        var orderTerminated = reqTerminated.Confirm(retailEmp.Id);
        orderTerminated.Assess(true, true, true, "Distribution box connection tested.", techEmp.Id);
        SeedDepositReceipt(orderTerminated, retailEmp);
        orderTerminated.Activate(techEmp.Id, landlinePhone.Id);
        foreach (var ev in orderTerminated.History) ev.Actor = ev.Status == OrderStatus.Pending ? retailEmp : techEmp;
        orderTerminated.Connection!.Status = "PermanentlyInactive";
        orderTerminated.Connection.SuspendReason = "Customer contract terminated upon relocation.";
        orderTerminated.Connection.SuspendedAt = DateTime.UtcNow.AddDays(-30);
        orderTerminated.Connection.TerminatedAt = DateTime.UtcNow.AddDays(-7);
        orderTerminated.Connection.RefundStatus = "Pending";
        orderTerminated.Connection.RefundAmount = 250.00m;
        orderTerminated.Connection.ActivatedAt = DateTime.UtcNow.AddYears(-1);
        db.Requests.Add(reqTerminated);
        db.Orders.AddRange(orderActive, orderSuspended, orderTerminated);

        // Seed Customer Documents
        db.CustomerDocuments.AddRange(
            new CustomerDocument
            {
                CustomerId = customer.Id,
                Customer = customer,
                DocumentType = "AddressProof",
                Title = "Proof of Address - Utility Bill",
                FilePathOrUrl = "/documents/2026/101/utility_bill_cus1.pdf",
                Year = 2026,
                CityCode = "101",
                City = city101,
                UploadedAt = DateTime.UtcNow.AddDays(-20),
                UploadedById = retailEmp.Id,
                UploadedBy = retailEmp
            },
            new CustomerDocument
            {
                CustomerId = customer.Id,
                Customer = customer,
                DocumentType = "RegistrationForm",
                Title = "Signed Service Agreement",
                FilePathOrUrl = "/documents/2026/101/service_agreement_cus1.pdf",
                Year = 2026,
                CityCode = "101",
                City = city101,
                UploadedAt = DateTime.UtcNow.AddDays(-25),
                UploadedById = retailEmp.Id,
                UploadedBy = retailEmp
            },
            new CustomerDocument
            {
                CustomerId = customer.Id,
                Customer = customer,
                DocumentType = "PaymentReceipt",
                Title = "Deposit Payment Receipt",
                FilePathOrUrl = "/documents/2025/101/deposit_receipt_cus1.pdf",
                Year = 2025,
                CityCode = "101",
                City = city101,
                UploadedAt = DateTime.UtcNow.AddMonths(-4),
                UploadedById = billingEmp.Id,
                UploadedBy = billingEmp
            }
        );

        // Seed Plan Change Requests
        db.PlanChangeRequests.AddRange(
            new PlanChangeRequest
            {
                Connection = orderActive.Connection!,
                TargetPlanId = bb128Plan.Id,
                TargetPlan = bb128Plan,
                RequestedById = retailEmp.Id,
                RequestedBy = retailEmp,
                RequestedAt = DateTime.UtcNow.AddDays(-2),
                Status = "Pending",
                Note = "Customer requested upgrade to BB Unlimited 128Kbps Monthly plan."
            },
            new PlanChangeRequest
            {
                Connection = orderSuspended.Connection!,
                TargetPlanId = bbPlan.Id,
                TargetPlan = bbPlan,
                RequestedById = retailEmp.Id,
                RequestedBy = retailEmp,
                RequestedAt = DateTime.UtcNow.AddDays(-10),
                Status = "Approved",
                Note = "Upgraded to BB Basic upon seasonal return.",
                ReviewedById = adminEmp.Id,
                ReviewedBy = adminEmp,
                ReviewedAt = DateTime.UtcNow.AddDays(-9)
            }
        );

        // Seed Customer Queries & FAQ Catalog
        db.CustomerQueries.AddRange(
            new CustomerQuery
            {
                CustomerId = customer.Id,
                Customer = customer,
                Subject = "Service Tax Rate Inquiry",
                Category = "Billing",
                Question = "Why is there a 12.24% tax rate applied to my monthly invoice?",
                Answer = "The 12.24% charge corresponds to the statutory Government Service Tax mandated for telecommunications services.",
                Status = "Answered",
                CreatedAt = DateTime.UtcNow.AddDays(-15),
                CreatedById = retailEmp.Id,
                CreatedBy = retailEmp,
                AnsweredAt = DateTime.UtcNow.AddDays(-14),
                AnsweredById = billingEmp.Id,
                AnsweredBy = billingEmp,
                IsFaq = true
            },
            new CustomerQuery
            {
                CustomerId = customer.Id,
                Customer = customer,
                Subject = "Broadband Optical Router Requirements",
                Category = "Technical",
                Question = "Can I use my existing ADSL modem for fiber broadband?",
                Answer = "No, fiber optic broadband requires an optical network terminal (ONT) router such as the Broadband Optical Router.",
                Status = "Answered",
                CreatedAt = DateTime.UtcNow.AddDays(-12),
                CreatedById = retailEmp.Id,
                CreatedBy = retailEmp,
                AnsweredAt = DateTime.UtcNow.AddDays(-11),
                AnsweredById = techEmp.Id,
                AnsweredBy = techEmp,
                IsFaq = true
            },
            new CustomerQuery
            {
                CustomerId = customer.Id,
                Customer = customer,
                Subject = "Temporary Line Suspension Query",
                Category = "General",
                Question = "How do I request a temporary suspension while traveling abroad?",
                Answer = null,
                Status = "Open",
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                CreatedById = retailEmp.Id,
                CreatedBy = retailEmp,
                AnsweredAt = null,
                AnsweredById = null,
                AnsweredBy = null,
                IsFaq = false
            }
        );

        db.SaveChanges();
    }
}

public sealed class DemoDb(DbContextOptions<DemoDb> options) : NexusDb(options);
public sealed class SqlServerDb(DbContextOptions<SqlServerDb> options) : NexusDb(options);
