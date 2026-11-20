using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

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

    protected override void OnModelCreating(ModelBuilder model)
    {
        ConfigureProperties(model);
        model.Entity<Employee>().HasIndex(user => user.Username).IsUnique();
        model.Entity<Customer>().HasIndex(customer => customer.Phone);
        model.Entity<Customer>().HasOne(customer => customer.City).WithMany()
            .HasForeignKey(customer => customer.CityCode).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ServicePlan>(plan =>
        {
            plan.Property(p => p.Price).HasPrecision(12, 2);
            plan.Property(p => p.LocalCallRate).HasPrecision(12, 2);
            plan.Property(p => p.StdCallRate).HasPrecision(12, 2);
            plan.Property(p => p.MobileMsgRate).HasPrecision(12, 2);
        });
        model.Entity<ServiceRequest>(request =>
        {
            request.Property(r => r.SnapshotPrice).HasPrecision(12, 2);
            request.HasOne(r => r.Plan).WithMany().OnDelete(DeleteBehavior.Restrict);
            request.HasOne(r => r.Customer).WithMany().OnDelete(DeleteBehavior.Restrict);
            request.HasOne<Employee>().WithMany().HasForeignKey(r => r.CreatedById).OnDelete(DeleteBehavior.Restrict);
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
            invoice.Property(i => i.InvoiceNumber).HasMaxLength(60);
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
            invoice.Property(i => i.Status).HasMaxLength(20).IsConcurrencyToken();
            invoice.Property(i => i.PaidAt).IsConcurrencyToken();
            invoice.HasOne(i => i.Connection).WithMany(c => c.Invoices)
                .HasForeignKey(i => i.ConnectionId).OnDelete(DeleteBehavior.Restrict);
            invoice.HasOne(i => i.PaidBy).WithMany()
                .HasForeignKey(i => i.PaidById).OnDelete(DeleteBehavior.Restrict);
            invoice.HasMany(i => i.Payments).WithOne(p => p.Invoice)
                .HasForeignKey(p => p.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PaymentTransaction>(payment =>
        {
            payment.HasKey(p => p.Id);
            payment.Property(p => p.Amount).HasPrecision(12, 2);
            payment.Property(p => p.Channel).HasMaxLength(30);
            payment.Property(p => p.Note).HasMaxLength(250);
            payment.HasOne(p => p.PaidBy).WithMany()
                .HasForeignKey(p => p.PaidById).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<ServiceFeedback>().HasOne(entry => entry.RecordedBy).WithMany()
            .OnDelete(DeleteBehavior.Restrict);
        model.Entity<ServiceFeedback>().ToTable(table =>
            table.HasCheckConstraint("CK_Feedback_Rating", "Rating >= 1 AND Rating <= 5"));

        model.Entity<Connection>()
            .HasOne(c => c.AssignedProduct).WithMany().HasForeignKey(c => c.AssignedProductId).OnDelete(DeleteBehavior.Restrict);

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
    }

    public static void SeedDemo(DbContext context, bool _)
    {
        var db = (NexusDb)context;
        if (db.Employees.Any() || db.Cities.Any()) return;

        var hasher = new PasswordHasher<Employee>();
        foreach (var role in Roles.All)
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
        }

        db.Cities.Add(new City { Code = "101", Name = "City 101" });
        db.Customers.Add(new Customer
        {
            Name = "Trần Minh B", SearchName = "TRẦN MINH B", Phone = "0900000002", Address = "10 Nexus Street", CityCode = "101"
        });
        db.Plans.AddRange(
            new ServicePlan { Name = "BB Basic", Type = "B", Price = 225, Description = "64 Kbps · monthly" },
            new ServicePlan { Name = "Dial-up 10h", Type = "D", Price = 50, Description = "10 hours · one month" },
            new ServicePlan { Name = "Landline Monthly", Type = "T", Price = 35, Description = "Monthly local rental" });

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
    }
}

public sealed class DemoDb(DbContextOptions<DemoDb> options) : NexusDb(options);
public sealed class SqlServerDb(DbContextOptions<SqlServerDb> options) : NexusDb(options);
