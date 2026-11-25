using Nexus.Domain;

namespace Nexus.Application;

public sealed record AdvanceTransactionView(long Id, string Kind, decimal Amount, string Method, string Reference,
    string Note, DateTime At, string Actor, int? RetailShopId, long? InvoiceId, long? PaymentId, decimal AvailableAfter);
public sealed record AdvanceInvoiceView(long Id, string Number, decimal TotalAmount, decimal DueAmount, string Status);
public sealed record AdvanceView(string OrderId, string? AccountId, string CustomerName, string OrderStatus,
    string? ConnectionStatus, decimal? PerConnectionAmount, decimal GrossAmount, int DiscountPercent,
    decimal QuotedAmount, decimal ReceivedAmount, decimal AllocatedAmount, decimal RefundedAmount,
    decimal AvailableAmount, decimal RemainingToCollect, decimal RefundableAmount, string Status, string Origin,
    IReadOnlyList<AdvanceInvoiceView> OpenInvoices, IReadOnlyList<AdvanceTransactionView> Transactions);

public interface IAdvanceStore
{
    Task<ServiceOrder?> FindAdvanceOrderAsync(OrderNumber number, bool tracking = true);
    Task<IReadOnlyList<ServiceOrder>> ListAdvanceOrdersAsync(string? q, int? customerId = null);
    Task<AdvanceTransaction?> FindAdvanceTransactionAsync(string operationId);
    Task<Invoice?> FindAdvanceInvoiceAsync(long connectionId, long invoiceId);
    Task SaveAdvanceAsync(ServiceOrder order);
}

/// <summary>Optional upfront cash and explicit invoice payments; waiver amounts never become spendable credit.</summary>
public sealed class AdvanceService(IAdvanceStore store, IOperationsStore operations)
{
    public async Task<IReadOnlyList<AdvanceView>> ListAsync(string? q, int? customerId = null)
    {
        if (q?.Length > 120) throw new UseCaseException(UseCaseFailure.InvalidInput, "Search text is too long.");
        return (await store.ListAdvanceOrdersAsync(q?.Trim(), customerId)).Select(ToView).ToArray();
    }
    public async Task<AdvanceView> FindAsync(string code) => ToView(await FindOrderAsync(code, false));

    public Task<AdvanceView> CollectAsync(string code, DepositMoneyInput input, int actorId) =>
        PostAsync(code, input, actorId, "Collection", null);
    public Task<AdvanceView> RefundAsync(string code, DepositMoneyInput input, int actorId) =>
        PostAsync(code, input, actorId, "Refund", null);
    public Task<AdvanceView> AllocateAsync(string code, AllocateAdvanceInput input, int actorId) =>
        PostAsync(code, new DepositMoneyInput(input.Amount, input.OperationId, "AdvanceCredit", input.Reference, input.Note),
            actorId, "Allocation", input.InvoiceId);

    private async Task<AdvanceView> PostAsync(string code, DepositMoneyInput input, int actorId, string kind, long? invoiceId)
    {
        if (input.Amount <= 0 || decimal.Round(input.Amount, 2) != input.Amount ||
            string.IsNullOrWhiteSpace(input.Reference) || string.IsNullOrWhiteSpace(input.Note))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "A positive two-decimal amount, evidence reference and reason are required.");
        var order = await FindOrderAsync(code);
        var existing = await store.FindAdvanceTransactionAsync(input.OperationId);
        if (existing is not null)
        {
            EnsureSame(existing, order.Id, input, kind, invoiceId, actorId);
            return ToView(await FindOrderAsync(code, false));
        }
        var advance = order.Advance!;
        var available = advance.ReceivedAmount - advance.AllocatedAmount - advance.RefundedAmount;
        var now = DateTime.UtcNow;
        PaymentTransaction? payment = null;
        if (kind == "Collection")
        {
            // An optional quote must remain usable after activation; it never adds an activation prerequisite.
            if (!advance.PerConnectionAmount.HasValue || DepositService.IsClosed(order) ||
                order.Status is not (OrderStatus.Feasible or OrderStatus.Connected))
                throw new UseCaseException(UseCaseFailure.Conflict, "Collect only under a configured advance quote after feasibility and before closure.");
            if (input.Amount > advance.QuotedAmount - advance.ReceivedAmount)
                throw new UseCaseException(UseCaseFailure.Conflict, "Collection exceeds the remaining advance quote.");
            advance.ReceivedAmount += input.Amount;
        }
        else
        {
            if (input.Amount > available)
                throw new UseCaseException(UseCaseFailure.Conflict, "Amount exceeds actual unused advance credit.");
            if (kind == "Refund")
            {
                if (!DepositService.IsClosed(order))
                    throw new UseCaseException(UseCaseFailure.Conflict, "Refund unused advance after cancellation, non-feasibility or permanent termination.");
                advance.RefundedAmount += input.Amount;
            }
            else
            {
                if (order.Connection is null || invoiceId is null)
                    throw new UseCaseException(UseCaseFailure.Conflict, "Activate the connection and issue an invoice before allocating advance.");
                var invoice = await store.FindAdvanceInvoiceAsync(order.Connection.Id, invoiceId.Value)
                    ?? throw new UseCaseException(UseCaseFailure.NotFound, "Invoice does not belong to this account.");
                if (invoice.Status is not ("Unpaid" or "PartiallyPaid") || input.Amount > invoice.DueAmount)
                    throw new UseCaseException(UseCaseFailure.Conflict, "Allocate only to an open invoice, within its remaining debt.");
                payment = new PaymentTransaction
                {
                    InvoiceId = invoice.Id, Amount = input.Amount, PaidAt = now, PaidById = actorId,
                    Channel = "Advance", Note = $"Advance allocation: {input.Reference.Trim()}. {input.Note.Trim()}"
                };
                invoice.Payments.Add(payment);
                invoice.PaidAmount += input.Amount;
                invoice.DueAmount = invoice.TotalAmount - invoice.PaidAmount;
                invoice.Status = invoice.DueAmount == 0 ? "Paid" : "PartiallyPaid";
                if (invoice.DueAmount == 0) { invoice.PaidAt = now; invoice.PaidById = actorId; }
                advance.AllocatedAmount += input.Amount;
            }
        }
        var actor = await operations.FindEmployeeByIdAsync(actorId) ?? throw new UseCaseException(UseCaseFailure.Unauthorized);
        if (payment is not null) payment.RetailShopId = actor.RetailShopId;
        advance.Version++;
        advance.Transactions.Add(new AdvanceTransaction
        {
            OperationId = input.OperationId, Kind = kind, Amount = input.Amount, At = now,
            Method = input.Method, Reference = input.Reference.Trim(), Note = input.Note.Trim(), ActorId = actorId,
            RetailShopId = actor.RetailShopId, InvoiceId = invoiceId, Payment = payment,
            AvailableAfter = advance.ReceivedAmount - advance.AllocatedAmount - advance.RefundedAmount
        });
        try { await store.SaveAdvanceAsync(order); }
        catch (StoreWriteException)
        {
            var retry = await store.FindAdvanceTransactionAsync(input.OperationId);
            if (retry is null) throw new UseCaseException(UseCaseFailure.Conflict, "Advance, invoice or lifecycle changed concurrently. Refresh and retry with the same operation ID.");
            EnsureSame(retry, order.Id, input, kind, invoiceId, actorId);
        }
        return ToView(await FindOrderAsync(code, false));
    }

    private static void EnsureSame(AdvanceTransaction t, long orderId, DepositMoneyInput input, string kind, long? invoiceId, int actorId)
    {
        if (t.OrderId != orderId || t.Kind != kind || t.InvoiceId != invoiceId || t.ActorId != actorId ||
            t.Amount != input.Amount || t.Method != input.Method || t.Reference != input.Reference.Trim() || t.Note != input.Note.Trim())
            throw new UseCaseException(UseCaseFailure.Conflict, "Operation ID was already used with different transaction details.");
    }

    private async Task<ServiceOrder> FindOrderAsync(string code, bool tracking = true)
    {
        var number = OrderNumber.Parse(code) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        var order = await store.FindAdvanceOrderAsync(number, tracking) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        if (order.Advance is null) throw new UseCaseException(UseCaseFailure.Conflict, "Advance quote has not been initialized.");
        return order;
    }

    public static AdvanceView ToView(ServiceOrder order)
    {
        var a = order.Advance!;
        var closed = DepositService.IsClosed(order);
        var available = a.ReceivedAmount - a.AllocatedAmount - a.RefundedAmount;
        var status = !a.PerConnectionAmount.HasValue ? "NotConfigured" :
            closed ? available > 0 ? "RefundPending" : a.RefundedAmount > 0 ? "Refunded" : "Closed" :
            a.PerConnectionAmount == 0 ? "NotRequired" : a.QuotedAmount == 0 ? "Waived" :
            a.ReceivedAmount == 0 ? "Uncollected" : a.ReceivedAmount < a.QuotedAmount ? "PartiallyCollected" :
            available > 0 ? "Available" : "FullyAllocated";
        return new AdvanceView(order.Code, order.Connection?.AccountId, order.Request.Customer.Name,
            order.Status.ToString(), order.Connection?.Status, a.PerConnectionAmount, a.GrossAmount,
            a.DiscountPercent, a.QuotedAmount, a.ReceivedAmount, a.AllocatedAmount, a.RefundedAmount,
            available, closed ? 0 : Math.Max(0, a.QuotedAmount - a.ReceivedAmount), closed ? available : 0,
            status, a.Origin,
            (order.Connection?.Invoices ?? []).Where(i => i.Status is "Unpaid" or "PartiallyPaid" && i.DueAmount > 0)
                .OrderByDescending(i => i.Id).Select(i => new AdvanceInvoiceView(i.Id, i.InvoiceNumber, i.TotalAmount, i.DueAmount, i.Status)).ToArray(),
            a.Transactions.OrderBy(t => t.Id).Select(t => new AdvanceTransactionView(t.Id, t.Kind, t.Amount,
                t.Method, t.Reference, t.Note, DateTime.SpecifyKind(t.At, DateTimeKind.Utc), t.Actor?.Username ?? "",
                t.RetailShopId, t.InvoiceId, t.PaymentId, t.AvailableAfter)).ToArray());
    }
}
