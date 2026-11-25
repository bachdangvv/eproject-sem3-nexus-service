using Microsoft.EntityFrameworkCore;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

public abstract partial class NexusDb
{
    private static void ConfigureDeposits(ModelBuilder model)
    {
        model.Entity<SecurityDeposit>(d =>
        {
            d.HasKey(x => x.OrderId);
            d.HasOne(x => x.Order).WithOne(o => o.Deposit).HasForeignKey<SecurityDeposit>(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            d.Property(x => x.GrossAmount).HasPrecision(12, 2);
            d.Property(x => x.RequiredAmount).HasPrecision(12, 2);
            d.Property(x => x.CollectedAmount).HasPrecision(12, 2);
            d.Property(x => x.RefundedAmount).HasPrecision(12, 2);
            d.Property(x => x.Origin).HasMaxLength(20);
            d.Property(x => x.Version).IsConcurrencyToken();
            d.HasMany(x => x.Transactions).WithOne(t => t.Deposit).HasForeignKey(t => t.OrderId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<DepositTransaction>(t =>
        {
            t.HasKey(x => x.Id);
            t.HasIndex(x => x.OperationId).IsUnique();
            t.HasIndex(x => new { x.OrderId, x.Kind, x.Reference }).IsUnique();
            t.Property(x => x.OperationId).HasMaxLength(80);
            t.Property(x => x.Kind).HasMaxLength(20);
            t.Property(x => x.Method).HasMaxLength(30);
            t.Property(x => x.Reference).HasMaxLength(100);
            t.Property(x => x.Note).HasMaxLength(500);
            t.Property(x => x.Amount).HasPrecision(12, 2);
            t.Property(x => x.CollectedAfter).HasPrecision(12, 2);
            t.Property(x => x.RefundedAfter).HasPrecision(12, 2);
            t.HasOne(x => x.Actor).WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.RetailShop).WithMany().HasForeignKey(x => x.RetailShopId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne<Invoice>().WithMany().HasForeignKey(x => x.SourceInvoiceId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // Demo receipts are explicit fictitious evidence, rather than balances inferred from the tariff.
    private static void SeedDepositReceipt(ServiceOrder order, Employee actor)
    {
        var deposit = order.Deposit!;
        deposit.CollectedAmount = deposit.RequiredAmount;
        if (deposit.RequiredAmount == 0) return;
        deposit.Transactions.Add(new DepositTransaction
        {
            OperationId = $"demo-deposit-{Guid.NewGuid():N}", Kind = "Collection", Amount = deposit.RequiredAmount,
            Method = "Cash", Reference = $"DEMO-{order.Request.Type}-DEPOSIT",
            Note = "Fictitious seed receipt for demonstration only.", ActorId = actor.Id,
            RetailShopId = actor.RetailShopId, CollectedAfter = deposit.RequiredAmount
        });
    }

    /// <summary>Idempotent startup backfill. Ambiguous legacy payments never become invented cash receipts.</summary>
    public void InitializeLegacyDeposits()
    {
        using var transaction = Database.BeginTransaction();
        var missing = Orders.Where(o => o.Deposit == null)
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Connection)!.ThenInclude(c => c!.Invoices).ThenInclude(i => i.Payments)
            .ToList();
        foreach (var order in missing)
        {
            var deposit = SecurityDeposit.Create(order.Request.Type, order.Request.ConnectionCount);
            deposit.Origin = "Legacy";
            deposit.NeedsReconciliation = true;
            order.Deposit = deposit;
            var invoices = order.Connection?.Invoices.Where(i => i.DepositAmount > 0).OrderBy(i => i.Id).ToList() ?? [];
            if (invoices.Count > 0)
            {
                // Historical billed deposit is evidence of the obligation, not proof of receipt.
                deposit.RequiredAmount = invoices[0].DepositAmount;
                deposit.GrossAmount = Math.Max(deposit.GrossAmount, deposit.RequiredAmount);
                var invoice = invoices[0];
                if (invoices.Count == 1 && invoice.Status == "Paid" && invoice.PaidAt.HasValue &&
                    invoice.PaidAmount == invoice.TotalAmount && invoice.TotalAmount >= deposit.RequiredAmount &&
                    invoice.Payments.Sum(p => p.Amount) == invoice.PaidAmount)
                {
                    deposit.CollectedAmount = deposit.RequiredAmount;
                    deposit.NeedsReconciliation = false;
                    deposit.Transactions.Add(new DepositTransaction
                    {
                        OperationId = $"legacy-invoice-{invoice.Id}", Kind = "Collection", Amount = deposit.RequiredAmount,
                        Method = "LegacyInvoice", Reference = invoice.InvoiceNumber,
                        Note = "Imported allocation from a fully settled legacy invoice; no new cash was received.",
                        At = invoice.PaidAt.Value, ActorId = invoice.PaidById, SourceInvoiceId = invoice.Id,
                        CollectedAfter = deposit.CollectedAmount
                    });
                    if (order.Connection?.RefundStatus == "Refunded")
                    {
                        var conn = order.Connection;
                        if (conn.RefundedAt.HasValue && conn.RefundedById.HasValue && conn.RefundAmount > 0 &&
                            conn.RefundAmount <= deposit.CollectedAmount && DepositService.IsClosed(order))
                        {
                            deposit.RefundedAmount = conn.RefundAmount.Value;
                            deposit.Transactions.Add(new DepositTransaction
                            {
                                OperationId = $"legacy-refund-{order.Id}", Kind = "Refund", Amount = deposit.RefundedAmount,
                                Method = "LegacyEvidence", Reference = $"LEGACY-REFUND-{order.Id}",
                                Note = conn.RefundNote ?? "Imported legacy disbursement record; no new refund was made.",
                                At = conn.RefundedAt.Value, ActorId = conn.RefundedById,
                                CollectedAfter = deposit.CollectedAmount, RefundedAfter = deposit.RefundedAmount
                            });
                        }
                        else deposit.NeedsReconciliation = true;
                    }
                }
            }
            // No invoice/partial/rolled-over/multiple deposits require evidence, including old refund claims.
            if (!deposit.NeedsReconciliation) DepositService.ApplyRefundSummary(order);
        }
        SaveChanges();
        transaction.Commit();
    }
}

public sealed partial class EfNexusStore
{
    public Task<ServiceOrder?> FindDepositOrderAsync(OrderNumber number, bool tracking = true)
    {
        var query = DepositOrders();
        if (!tracking) query = query.AsNoTracking();
        return query.SingleOrDefaultAsync(o => o.Id == number.Serial && o.Request.Type == number.Type);
    }

    public async Task<IReadOnlyList<ServiceOrder>> ListDepositOrdersAsync(string? q, int? customerId = null)
    {
        var query = DepositOrders().AsNoTracking();
        if (customerId.HasValue) query = query.Where(o => o.Request.CustomerId == customerId.Value);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var number = OrderNumber.Parse(q);
            if (number is { } n) query = query.Where(o => o.Id == n.Serial && o.Request.Type == n.Type);
            else query = query.Where(o => o.Request.Customer.SearchName.Contains(q.ToUpper()) || o.Request.Customer.Phone.Contains(q));
        }
        return await query.OrderByDescending(o => o.Id).Take(100).ToListAsync();
    }

    public Task<DepositTransaction?> FindDepositTransactionAsync(string operationId) =>
        db.DepositTransactions.AsNoTracking().SingleOrDefaultAsync(t => t.OperationId == operationId);

    // Include lifecycle predicates in the atomic write, even if a split query observed a newer ledger row.
    // A concurrent cancellation/activation must invalidate a receipt based on the previous order state.
    public Task SaveDepositAsync(ServiceOrder order)
    {
        db.Entry(order).Property(o => o.Status).IsModified = true;
        if (order.Connection is not null) db.Entry(order.Connection).Property(c => c.Status).IsModified = true;
        return SaveChangesAsync();
    }

    private IQueryable<ServiceOrder> DepositOrders() => db.Orders.AsSplitQuery()
        .Include(o => o.Request).ThenInclude(r => r.Customer)
        .Include(o => o.Connection)
        .Include(o => o.Deposit)!.ThenInclude(d => d!.Transactions).ThenInclude(t => t.Actor);
}
