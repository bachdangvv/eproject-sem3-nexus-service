using Nexus.Domain;

namespace Nexus.Application;

public sealed record BillingView(string AccountId, string OrderId, string CustomerName,
    string PlanName, decimal Amount, string Status, DateTime? PaidAt);

public interface IBillingStore
{
    Task<BillingRecord?> FindBillAsync(long connectionId);
    Task<BillingRecord?> ReadBillAsync(long connectionId);
    void Add(BillingRecord bill);
    Task SaveChangesAsync();
}

public sealed class BillingService(IOperationsStore operations, IBillingStore bills)
{
    public async Task<BillingView> FindAsync(string accountId)
    {
        var order = await FindConnectedOrderAsync(accountId);
        return ToView(order, await bills.ReadBillAsync(order.Connection!.Id));
    }

    public async Task<BillingView> CreateAsync(string accountId)
    {
        var order = await FindConnectedOrderAsync(accountId);
        var connectionId = order.Connection!.Id;
        var existing = await bills.FindBillAsync(connectionId);
        if (existing is not null) return ToView(order, existing);

        var bill = new BillingRecord { ConnectionId = connectionId, Amount = order.Request.Plan.Price };
        bills.Add(bill);
        try { await bills.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            existing = await bills.ReadBillAsync(connectionId);
            if (existing is null) throw;
            return ToView(order, existing);
        }
        return ToView(order, bill);
    }

    public async Task<BillingView> PayAsync(string accountId, int actorId)
    {
        var order = await FindConnectedOrderAsync(accountId);
        var connectionId = order.Connection!.Id;
        var bill = await bills.FindBillAsync(connectionId)
            ?? throw new UseCaseException(UseCaseFailure.Conflict, "Create a billing record before recording payment.");
        if (bill.PaidAt is not null) return ToView(order, bill);

        bill.PaidAt = DateTime.UtcNow;
        bill.PaidById = actorId;
        try { await bills.SaveChangesAsync(); }
        catch (StoreWriteException error) when (error.ConcurrentChange)
        {
            var existing = await bills.ReadBillAsync(connectionId);
            if (existing?.PaidAt is null) throw;
            return ToView(order, existing);
        }
        return ToView(order, bill);
    }

    private async Task<ServiceOrder> FindConnectedOrderAsync(string accountId) =>
        await operations.FindOrderByAccountIdAsync(accountId)
        ?? throw new UseCaseException(UseCaseFailure.NotFound);

    private static BillingView ToView(ServiceOrder order, BillingRecord? bill) =>
        new(order.Connection!.AccountId, order.Code, order.Request.Customer.Name,
            order.Request.PlanName, bill?.Amount ?? order.Request.Plan.Price,
            bill is null ? "NotBilled" : bill.PaidAt is null ? "Unpaid" : "Paid",
            bill?.PaidAt is DateTime paidAt ? DateTime.SpecifyKind(paidAt, DateTimeKind.Utc) : null);
}
