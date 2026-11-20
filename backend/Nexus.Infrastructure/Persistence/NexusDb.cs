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
        db.Products.Add(new Product { Name = "Demo broadband router", Description = "Equipment catalog sample" });
        db.SaveChanges();
    }
}

public sealed class DemoDb(DbContextOptions<DemoDb> options) : NexusDb(options);
public sealed class SqlServerDb(DbContextOptions<SqlServerDb> options) : NexusDb(options);
