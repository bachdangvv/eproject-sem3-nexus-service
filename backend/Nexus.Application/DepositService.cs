using Nexus.Domain;

namespace Nexus.Application;

public sealed record DepositTransactionView(long Id, string OperationId, string Kind, decimal Amount,
    string Method, string Reference, string Note, DateTime At, string? Actor, int? RetailShopId,
    long? SourceInvoiceId, decimal CollectedAfter, decimal RefundedAfter);

public sealed record DepositView(string OrderId, string? AccountId, string CustomerName, string OrderStatus,
    string? ConnectionStatus, decimal GrossAmount, int DiscountPercent, decimal RequiredAmount,
    decimal CollectedAmount, decimal RefundedAmount, decimal Balance, decimal RemainingToCollect,
    decimal RefundableAmount, bool NeedsReconciliation, string Origin, string Status,
    IReadOnlyList<DepositTransactionView> Transactions);

public interface IDepositStore
{
    Task<ServiceOrder?> FindDepositOrderAsync(OrderNumber number, bool tracking = true);
    Task<IReadOnlyList<ServiceOrder>> ListDepositOrdersAsync(string? q, int? customerId = null);
    Task<DepositTransaction?> FindDepositTransactionAsync(string operationId);
    Task SaveDepositAsync(ServiceOrder order);
}

/// <summary>Verified deposit receipts/refunds, independent of rental billing and outstanding debts.</summary>
public sealed class DepositService(IDepositStore store, IOperationsStore operations)
{
    public async Task<IReadOnlyList<DepositView>> ListAsync(string? q, int? customerId = null) =>
        (await store.ListDepositOrdersAsync(q?.Trim(), customerId)).Select(ToView).ToArray();

    public async Task<DepositView> FindAsync(string code) => ToView(await FindOrderAsync(code, false));

    public async Task<DepositView> PostAsync(string code, DepositMoneyInput input, int actorId, bool refund)
    {
        ValidateMoney(input.Amount);
        if (input.Amount <= 0 || string.IsNullOrWhiteSpace(input.Reference) || string.IsNullOrWhiteSpace(input.Note))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "A positive amount, receipt reference and reason are required.");
        var order = await FindOrderAsync(code);
        var kind = refund ? "Refund" : "Collection";
        var existing = await store.FindDepositTransactionAsync(input.OperationId);
        if (existing is not null)
        {
            EnsureSame(existing, order.Id, input, actorId, kind);
            return ToView(await FindOrderAsync(code, false));
        }
        var deposit = order.Deposit!;
        if (deposit.NeedsReconciliation)
            throw new UseCaseException(UseCaseFailure.Conflict, "Reconcile legacy deposit evidence before posting money.");
        if (refund)
        {
            if (!IsClosed(order))
                throw new UseCaseException(UseCaseFailure.Conflict, "Refund only after cancellation, non-feasibility or permanent termination.");
            if (input.Amount > deposit.CollectedAmount - deposit.RefundedAmount)
                throw new UseCaseException(UseCaseFailure.Conflict, "Refund exceeds the verified deposit balance.");
            deposit.RefundedAmount += input.Amount;
        }
        else
        {
            if (order.Status != OrderStatus.Feasible || order.Connection is not null)
                throw new UseCaseException(UseCaseFailure.Conflict, "Collect a deposit after feasibility and before activation.");
            if (input.Amount > deposit.RequiredAmount - deposit.CollectedAmount)
                throw new UseCaseException(UseCaseFailure.Conflict, "Collection exceeds the remaining required deposit.");
            deposit.CollectedAmount += input.Amount;
        }
        var actor = await operations.FindEmployeeByIdAsync(actorId)
            ?? throw new UseCaseException(UseCaseFailure.Unauthorized);
        deposit.Version++;
        deposit.Transactions.Add(new DepositTransaction
        {
            OperationId = input.OperationId, Kind = kind, Amount = input.Amount,
            Method = input.Method, Reference = input.Reference.Trim(), Note = input.Note.Trim(),
            ActorId = actorId, RetailShopId = actor.RetailShopId,
            CollectedAfter = deposit.CollectedAmount, RefundedAfter = deposit.RefundedAmount
        });
        ApplyRefundSummary(order);
        await SaveOrReplayAsync(order, input, actorId, kind);
        return ToView(await FindOrderAsync(code, false));
    }

    // Legacy reconciliation records evidence without creating a second cash receipt for an old invoice.
    public async Task<DepositView> ReconcileAsync(string code, ReconcileDepositInput input, int actorId)
    {
        ValidateMoney(input.CollectedAmount);
        ValidateMoney(input.RefundedAmount);
        if (string.IsNullOrWhiteSpace(input.Reference) || string.IsNullOrWhiteSpace(input.Note))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Evidence reference and reconciliation reason are required.");
        var order = await FindOrderAsync(code);
        var existing = await store.FindDepositTransactionAsync(input.OperationId);
        if (existing is not null)
        {
            EnsureSameReconciliation(existing, order.Id, input, actorId);
            return ToView(await FindOrderAsync(code, false));
        }
        var deposit = order.Deposit!;
        if (!deposit.NeedsReconciliation || deposit.Origin != "Legacy")
            throw new UseCaseException(UseCaseFailure.Conflict, "Only unresolved legacy deposits can be reconciled.");
        if (input.CollectedAmount < deposit.CollectedAmount ||
            input.RefundedAmount < deposit.RefundedAmount || input.RefundedAmount > input.CollectedAmount ||
            (input.RefundedAmount > 0 && !IsClosed(order)))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Evidence cannot reduce verified totals, refund more than was received or refund an open service.");
        deposit.CollectedAmount = input.CollectedAmount;
        deposit.RefundedAmount = input.RefundedAmount;
        deposit.NeedsReconciliation = false;
        deposit.Version++;
        deposit.Transactions.Add(new DepositTransaction
        {
            OperationId = input.OperationId, Kind = "Reconciliation", Amount = 0, Method = "LegacyEvidence",
            Reference = input.Reference.Trim(), Note = input.Note.Trim(), ActorId = actorId,
            CollectedAfter = deposit.CollectedAmount, RefundedAfter = deposit.RefundedAmount
        });
        ApplyRefundSummary(order);
        try { await store.SaveDepositAsync(order); }
        catch (StoreWriteException)
        {
            var retry = await store.FindDepositTransactionAsync(input.OperationId);
            if (retry is null) throw new UseCaseException(UseCaseFailure.Conflict, "Deposit changed concurrently. Refresh and retry with the same operation ID.");
            EnsureSameReconciliation(retry, order.Id, input, actorId);
        }
        return ToView(await FindOrderAsync(code, false));
    }

    private async Task SaveOrReplayAsync(ServiceOrder order, DepositMoneyInput input, int actorId, string kind)
    {
        try { await store.SaveDepositAsync(order); }
        catch (StoreWriteException)
        {
            var retry = await store.FindDepositTransactionAsync(input.OperationId);
            if (retry is null) throw new UseCaseException(UseCaseFailure.Conflict, "Deposit changed concurrently. Refresh and retry with the same operation ID.");
            EnsureSame(retry, order.Id, input, actorId, kind);
        }
    }

    private static void EnsureSame(DepositTransaction transaction, long orderId, DepositMoneyInput input, int actorId, string kind)
    {
        if (transaction.OrderId != orderId || transaction.ActorId != actorId || transaction.Kind != kind ||
            transaction.Amount != input.Amount || transaction.Method != input.Method ||
            transaction.Reference != input.Reference.Trim() || transaction.Note != input.Note.Trim())
            throw new UseCaseException(UseCaseFailure.Conflict, "Operation ID has already been used for a different transaction.");
    }

    private static void EnsureSameReconciliation(DepositTransaction transaction, long orderId, ReconcileDepositInput input, int actorId)
    {
        if (transaction.OrderId != orderId || transaction.ActorId != actorId || transaction.Kind != "Reconciliation" ||
            transaction.CollectedAfter != input.CollectedAmount || transaction.RefundedAfter != input.RefundedAmount ||
            transaction.Reference != input.Reference.Trim() || transaction.Note != input.Note.Trim())
            throw new UseCaseException(UseCaseFailure.Conflict, "Operation ID has already been used for a different reconciliation.");
    }

    private static void ValidateMoney(decimal amount)
    {
        if (amount < 0 || decimal.Round(amount, 2) != amount)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Use a non-negative USD amount with at most two decimal places.");
    }

    private async Task<ServiceOrder> FindOrderAsync(string code, bool tracking = true)
    {
        var number = OrderNumber.Parse(code) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        var order = await store.FindDepositOrderAsync(number, tracking) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        if (order.Deposit is null) throw new UseCaseException(UseCaseFailure.Conflict, "Deposit evidence has not been initialized.");
        return order;
    }

    public static bool IsClosed(ServiceOrder order) => order.Status is OrderStatus.Cancelled or OrderStatus.NotFeasible ||
        order.Connection?.Status == "PermanentlyInactive";

    public static (string Status, decimal Amount, DateTime? At) RefundSummary(ServiceOrder order)
    {
        if (order.Deposit is not { } d || d.NeedsReconciliation) return ("NeedsReconciliation", 0, null);
        var balance = d.CollectedAmount - d.RefundedAmount;
        var last = d.Transactions.Where(t => t.Kind == "Refund" || t.Kind == "Reconciliation" && t.RefundedAfter > 0)
            .OrderByDescending(t => t.At).FirstOrDefault();
        if (!IsClosed(order)) return ("None", 0, null);
        return (balance > 0 ? "Pending" : d.RefundedAmount > 0 ? "Refunded" : "None",
            balance > 0 ? balance : d.RefundedAmount, last is null ? null : DateTime.SpecifyKind(last.At, DateTimeKind.Utc));
    }

    // Compatibility account fields are projections of verified ledger totals, never independent refund authority.
    public static void ApplyRefundSummary(ServiceOrder order)
    {
        if (order.Connection is not { } connection || order.Deposit is not { } deposit) return;
        var closed = IsClosed(order);
        var balance = deposit.CollectedAmount - deposit.RefundedAmount;
        connection.RefundStatus = deposit.NeedsReconciliation ? "NeedsReconciliation" : !closed ? "None" :
            balance > 0 ? "Pending" : deposit.RefundedAmount > 0 ? "Refunded" : "None";
        connection.RefundAmount = deposit.NeedsReconciliation || !closed ? 0 : balance > 0 ? balance : deposit.RefundedAmount;
        var last = deposit.Transactions.Where(t => t.Kind == "Refund" || t.Kind == "Reconciliation" && t.RefundedAfter > 0)
            .OrderByDescending(t => t.At).FirstOrDefault();
        connection.RefundedAt = last?.At;
        connection.RefundedById = last?.ActorId;
        connection.RefundNote = last?.Note;
    }

    public static DepositView ToView(ServiceOrder order)
    {
        var d = order.Deposit!;
        var balance = d.CollectedAmount - d.RefundedAmount;
        var closed = IsClosed(order);
        var status = d.NeedsReconciliation ? "NeedsReconciliation" :
            closed ? balance > 0 ? "RefundPending" : d.RefundedAmount > 0 ? "Refunded" : "Closed" :
            d.RequiredAmount == 0 ? "Waived" : d.CollectedAmount >= d.RequiredAmount ? "Collected" :
            d.CollectedAmount > 0 ? "PartiallyCollected" : "Uncollected";
        return new DepositView(order.Code, order.Connection?.AccountId, order.Request.Customer.Name,
            order.Status.ToString(), order.Connection?.Status, d.GrossAmount, d.DiscountPercent,
            d.RequiredAmount, d.CollectedAmount, d.RefundedAmount, balance,
            closed || d.NeedsReconciliation ? 0 : Math.Max(0, d.RequiredAmount - d.CollectedAmount),
            closed && !d.NeedsReconciliation ? balance : 0, d.NeedsReconciliation, d.Origin, status,
            d.Transactions.OrderBy(t => t.Id).Select(t => new DepositTransactionView(t.Id, t.OperationId, t.Kind, t.Amount,
                t.Method, t.Reference, t.Note, DateTime.SpecifyKind(t.At, DateTimeKind.Utc), t.Actor?.Username,
                t.RetailShopId, t.SourceInvoiceId, t.CollectedAfter, t.RefundedAfter)).ToArray());
    }
}
