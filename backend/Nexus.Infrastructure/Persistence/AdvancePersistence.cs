using Microsoft.EntityFrameworkCore;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

public abstract partial class NexusDb
{
    private static void ConfigureAdvances(ModelBuilder model)
    {
        model.Entity<ServicePlan>().Property(p => p.AdvancePerConnection).HasPrecision(12, 2);
        model.Entity<AdvanceAccount>(a =>
        {
            a.HasKey(x => x.OrderId);
            a.HasOne(x => x.Order).WithOne(o => o.Advance).HasForeignKey<AdvanceAccount>(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            a.Property(x => x.PerConnectionAmount).HasPrecision(12, 2);
            a.Property(x => x.GrossAmount).HasPrecision(12, 2);
            a.Property(x => x.QuotedAmount).HasPrecision(12, 2);
            a.Property(x => x.ReceivedAmount).HasPrecision(12, 2);
            a.Property(x => x.AllocatedAmount).HasPrecision(12, 2);
            a.Property(x => x.RefundedAmount).HasPrecision(12, 2);
            a.Property(x => x.Origin).HasMaxLength(20);
            a.Property(x => x.Version).IsConcurrencyToken();
            a.HasMany(x => x.Transactions).WithOne(t => t.Advance).HasForeignKey(t => t.OrderId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AdvanceTransaction>(t =>
        {
            t.HasKey(x => x.Id);
            t.HasIndex(x => x.OperationId).IsUnique();
            t.HasIndex(x => new { x.OrderId, x.Kind, x.Reference }).IsUnique();
            t.HasIndex(x => x.PaymentId).IsUnique();
            t.Property(x => x.OperationId).HasMaxLength(80);
            t.Property(x => x.Kind).HasMaxLength(20);
            t.Property(x => x.Method).HasMaxLength(30);
            t.Property(x => x.Reference).HasMaxLength(100);
            t.Property(x => x.Note).HasMaxLength(500);
            t.Property(x => x.Amount).HasPrecision(12, 2);
            t.Property(x => x.AvailableAfter).HasPrecision(12, 2);
            t.HasOne(x => x.Actor).WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.RetailShop).WithMany().HasForeignKey(x => x.RetailShopId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.Invoice).WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // Prior releases recorded no advance receipts. Never infer credit from a deposit or a paid service invoice.
    public void InitializeLegacyAdvances()
    {
        using var transaction = Database.BeginTransaction();
        foreach (var order in Orders.Where(o => o.Advance == null).Include(o => o.Request).ToList())
        {
            order.Advance = AdvanceAccount.Create(null, order.Request.ConnectionCount);
            order.Advance.Origin = "Legacy";
        }
        SaveChanges();
        transaction.Commit();
    }
}

public sealed partial class EfNexusStore : IAdvanceStore
{
    private IQueryable<ServiceOrder> AdvanceOrders() => db.Orders.AsSplitQuery()
        .Include(o => o.Request).ThenInclude(r => r.Customer)
        .Include(o => o.Connection)!.ThenInclude(c => c!.Invoices)
        .Include(o => o.Advance)!.ThenInclude(a => a!.Transactions).ThenInclude(t => t.Actor);

    public Task<ServiceOrder?> FindAdvanceOrderAsync(OrderNumber number, bool tracking = true)
    {
        var query = AdvanceOrders();
        if (!tracking) query = query.AsNoTracking();
        return query.SingleOrDefaultAsync(o => o.Id == number.Serial && o.Request.Type == number.Type);
    }

    public async Task<IReadOnlyList<ServiceOrder>> ListAdvanceOrdersAsync(string? q, int? customerId = null)
    {
        var query = AdvanceOrders().AsNoTracking();
        if (customerId.HasValue) query = query.Where(o => o.Request.CustomerId == customerId.Value);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var number = OrderNumber.Parse(q);
            if (number is { } n) query = query.Where(o => o.Id == n.Serial && o.Request.Type == n.Type);
            else if (TryParseAccountId(q, out var type, out var city, out var connectionId))
                query = query.Where(o => o.Connection != null && o.Connection.Id == connectionId && o.Connection.Type == type && o.Connection.CityCode == city);
            else query = query.Where(o => o.Request.Customer.SearchName.Contains(q.ToUpper()) || o.Request.Customer.Phone.Contains(q));
        }
        return await query.OrderByDescending(o => o.Id).Take(100).ToListAsync();
    }

    public Task<AdvanceTransaction?> FindAdvanceTransactionAsync(string operationId) =>
        db.AdvanceTransactions.AsNoTracking().SingleOrDefaultAsync(t => t.OperationId == operationId);

    public Task<Invoice?> FindAdvanceInvoiceAsync(long connectionId, long invoiceId) =>
        db.Invoices.Include(i => i.Payments).SingleOrDefaultAsync(i => i.ConnectionId == connectionId && i.Id == invoiceId);

    // Updating lifecycle predicates and credit/invoice tokens in one SaveChanges prevents stale-state cash writes.
    public Task SaveAdvanceAsync(ServiceOrder order)
    {
        db.Entry(order).Property(o => o.Status).IsModified = true;
        if (order.Connection is not null) db.Entry(order.Connection).Property(c => c.Status).IsModified = true;
        return SaveChangesAsync();
    }
}
