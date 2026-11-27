using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Nexus.Domain;

namespace Nexus.Application;

public sealed record InvoiceItemView(
    long Id,
    string InvoiceNumber,
    DateTime BillingPeriodStart,
    DateTime BillingPeriodEnd,
    decimal RentalAmount,
    decimal CallUsageAmount,
    decimal EquipmentFee,
    decimal Subtotal,
    decimal DiscountAmount,
    int DiscountPercent,
    decimal TaxAmount,
    decimal DepositAmount,
    decimal PreviousDueBalance,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    string Status,
    DateTime CreatedAt,
    DateTime? PaidAt);

public sealed record PaymentItemView(
    long Id,
    long InvoiceId,
    decimal Amount,
    DateTime PaidAt,
    string PaidByUsername,
    string Channel,
    string? Note,
    string InvoiceNumber,
    string InvoiceStatus,
    string ReceiptCode,
    string? PaidByDisplayName,
    int? RetailShopId,
    string? RetailShopName);

public sealed record PaymentHistoryGapView(long InvoiceId, string InvoiceNumber, decimal RecordedPaidAmount, decimal RecordedPaymentTotal);

public sealed record BillingView(
    string AccountId,
    string OrderId,
    string CustomerName,
    string PlanName,
    decimal Amount,
    string Status,
    DateTime? PaidAt,
    long? InvoiceId = null,
    string? InvoiceNumber = null,
    decimal RentalAmount = 0m,
    decimal CallUsageAmount = 0m,
    decimal EquipmentFee = 0m,
    decimal Subtotal = 0m,
    decimal DiscountAmount = 0m,
    int DiscountPercent = 0,
    decimal TaxAmount = 0m,
    decimal DepositAmount = 0m,
    decimal PreviousDueBalance = 0m,
    decimal TotalAmount = 0m,
    decimal PaidAmount = 0m,
    decimal DueAmount = 0m,
    int ConnectionCount = 1,
    decimal LocalMinutes = 0m,
    decimal StdMinutes = 0m,
    decimal MobileMinutes = 0m,
    DateTime? BillingPeriodStart = null,
    DateTime? BillingPeriodEnd = null,
    string? PaidByUsername = null,
    IReadOnlyList<InvoiceItemView>? Invoices = null,
    IReadOnlyList<PaymentItemView>? Payments = null,
    string ConnectionStatus = "Active",
    string RefundStatus = "None",
    decimal RefundAmount = 0m,
    DateTime? RefundedAt = null,
    IReadOnlyList<PaymentHistoryGapView>? PaymentHistoryGaps = null);

/// <summary>Persistence port for connection invoices, payment transactions, and billing account queries.</summary>
public interface IBillingStore
{
    Task<PaymentTransaction?> FindPaymentByOperationIdAsync(string operationId);
    Task<Invoice?> FindLatestInvoiceAsync(long connectionId);
    Task<Invoice?> ReadLatestInvoiceAsync(long connectionId);
    Task<IReadOnlyList<Invoice>> ListInvoicesAsync(long connectionId);
    Task<IReadOnlyList<Invoice>> ListOpenTrackedInvoicesAsync(long connectionId);
    Task<IReadOnlyList<EquipmentIncident>> ListUnsettledIncidentsForConnectionAsync(long connectionId);
    Task<IReadOnlyList<ServiceOrder>> ListConnectedOrdersAsync(string? q, string? status, string? cityCode);
    void Add(Invoice invoice);
    void Add(PaymentTransaction payment);
    Task SaveChangesAsync();
}

/// <summary>Service invoice generation, rollover and payment collection. Order deposits use DepositService.</summary>
public sealed class BillingService(IOperationsStore operations, IBillingStore bills)
{
    public async Task<IReadOnlyList<BillingView>> ListAsync(string? q, string? status, string? cityCode)
    {
        var orders = await bills.ListConnectedOrdersAsync(q, status, cityCode);
        return orders.Select(order =>
        {
            var latest = order.Connection?.Invoices.OrderByDescending(i => i.Id).FirstOrDefault();
            return ToView(order, latest, order.Connection?.Invoices.OrderByDescending(i => i.Id).ToList());
        }).ToArray();
    }

    public async Task<BillingView> FindAsync(string accountId)
    {
        var order = await FindConnectedOrderAsync(accountId);
        var allInvoices = await bills.ListInvoicesAsync(order.Connection!.Id);
        var latest = allInvoices.FirstOrDefault();
        return ToView(order, latest, allInvoices);
    }

    public async Task<BillingView> CreateAsync(string accountId, CreateInvoiceInput? input, int actorId)
    {
        var order = await FindConnectedOrderAsync(accountId);
        var connectionId = order.Connection!.Id;
        var existingInvoices = await bills.ListInvoicesAsync(connectionId);

        // If any invoice already exists and no specific cycle input was provided, preserve idempotency
        if (existingInvoices.Count > 0 && input == null)
        {
            var latestExisting = existingInvoices[0];
            return ToView(order, latestExisting, existingInvoices);
        }

        var localMin = input?.LocalMinutes ?? 0m;
        var stdMin = input?.StdMinutes ?? 0m;
        var mobileMin = input?.MobileMinutes ?? 0m;
        if (localMin < 0m || stdMin < 0m || mobileMin < 0m)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Call minutes cannot be negative.");

        var manualEquipmentFee = input?.EquipmentFee ?? 0m;
        if (manualEquipmentFee < 0m || decimal.Round(manualEquipmentFee, 2) != manualEquipmentFee)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Equipment fee must be non-negative with up to two decimal places.");

        var now = DateTime.UtcNow;
        var start = input?.PeriodStart is { } ps ? NormalizeUtc(ps) : now;
        var validityMonths = Math.Max(1, order.Request.Plan?.ValidityMonths ?? 1);
        var end = input?.PeriodEnd is { } pe ? NormalizeUtc(pe) : start.AddMonths(validityMonths);
        if (end <= start)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Billing period end must be after billing period start.");

        // Historical imports with an unknown period have start == end. Never rewrite them.
        if (existingInvoices.Any(i => i.BillingPeriodStart < i.BillingPeriodEnd &&
            i.BillingPeriodStart < end && start < i.BillingPeriodEnd))
            throw new UseCaseException(UseCaseFailure.Conflict, "An invoice already covers all or part of this billing period. Refresh the account and choose a different period.");

        var count = Math.Max(1, order.Request.ConnectionCount);
        var baseRental = order.Request.SnapshotPrice > 0 ? order.Request.SnapshotPrice : order.Request.Plan!.Price;
        var rentalAmount = Math.Round(baseRental * count, 2);
        // Security deposits are collected against the Order before activation, independently of service bills.
        // Keep legacy invoice fields readable but reject new attempts to bill the deposit twice.
        if (input?.IncludeDeposit == true)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Collect security deposits through the Order deposit ledger, not a service invoice.");

        var callUsage = Math.Round(
            localMin * (order.Request.Plan?.LocalCallRate ?? 0m) +
            stdMin * (order.Request.Plan?.StdCallRate ?? 0m) +
            mobileMin * (order.Request.Plan?.MobileMsgRate ?? 0m),
            2);

        var unsettledIncidents = await bills.ListUnsettledIncidentsForConnectionAsync(connectionId);
        var unsettledIncidentFee = Math.Round(unsettledIncidents.Sum(i => i.ReplacementFee), 2);
        var equipmentFee = manualEquipmentFee + unsettledIncidentFee;
        foreach (var incident in unsettledIncidents)
        {
            incident.Settled = true;
        }
        var taxableCharges = Math.Max(0m, rentalAmount + callUsage + equipmentFee);
        // Preserve the current tax policy; treatment of refundable deposits needs spec clarification.
        var taxRate = FinancialConstants.ServiceTaxRate;
        var taxAmount = Math.Round(taxableCharges * taxRate, 2);

        var openTrackedInvoices = await bills.ListOpenTrackedInvoicesAsync(connectionId);
        var previousDue = openTrackedInvoices.Sum(i => i.DueAmount);
        foreach (var prior in openTrackedInvoices)
        {
            prior.Status = "RolledOver";
            prior.DueAmount = 0m;
        }

        var subtotal = taxableCharges;
        var totalAmount = taxableCharges + taxAmount + previousDue;

        var invoice = new Invoice
        {
            ConnectionId = connectionId,
            InvoiceNumber = $"INV-{order.Connection.AccountId}-{now:yyyyMMddHHmmssfff}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}",
            BillingPeriodStart = start,
            BillingPeriodEnd = end,
            RentalAmount = rentalAmount,
            LocalMinutes = localMin,
            StdMinutes = stdMin,
            MobileMinutes = mobileMin,
            CallUsageAmount = callUsage,
            EquipmentFee = equipmentFee,
            Subtotal = subtotal,
            DiscountAmount = 0m,
            DiscountPercent = 0,
            TaxRate = taxRate,
            TaxAmount = taxAmount,
            DepositAmount = 0m,
            PreviousDueBalance = previousDue,
            TotalAmount = totalAmount,
            PaidAmount = 0m,
            DueAmount = totalAmount,
            Status = "Unpaid",
            CreatedAt = now,
            CreatedById = actorId
        };

        order.Connection.BillingVersion++;
        bills.Add(invoice);
        try { await bills.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            throw new UseCaseException(UseCaseFailure.Conflict, "The account changed during invoice issuance. Refresh and check its invoices before retrying.");
        }

        var updatedInvoices = await bills.ListInvoicesAsync(connectionId);
        return ToView(order, invoice, updatedInvoices);
    }

    public async Task<BillingView> PayAsync(string accountId, RecordPaymentInput? input, int actorId, string channel = "CityOffice")
    {
        if (input is null || input.OperationId is not { } operationId || !Regex.IsMatch(operationId, "^[a-zA-Z0-9-]{16,64}$"))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "A stable operationId is required. Reuse it when retrying the same payment.");
        if (input.Amount is { } specified)
        {
            if (specified <= 0m)
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Payment amount must be greater than zero.");
            if (decimal.Round(specified, 2) != specified)
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Enter a payment amount with up to two decimal places.");
        }

        var order = await FindConnectedOrderAsync(accountId);
        var connectionId = order.Connection!.Id;
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            AccountId = order.Connection.AccountId, ActorId = actorId, Channel = channel,
            input.InvoiceId, Amount = input.Amount?.ToString("0.00", CultureInfo.InvariantCulture), Note = input.Note?.Trim() ?? ""
        }))));
        var replay = await bills.FindPaymentByOperationIdAsync(operationId);
        if (replay is not null)
        {
            EnsurePaymentReplay(replay, fingerprint);
            return await FindAsync(accountId);
        }

        if (input.InvoiceId is { } requestedId &&
            !(await bills.ListInvoicesAsync(connectionId)).Any(i => i.Id == requestedId))
            throw new UseCaseException(UseCaseFailure.NotFound, "Invoice not found.");
        var invoice = await bills.FindLatestInvoiceAsync(connectionId)
            ?? throw new UseCaseException(UseCaseFailure.Conflict, "Create a billing record before recording payment.");

        var payAmount = input.Amount ?? invoice.DueAmount;
        string? conflict = null;
        if (input.InvoiceId is { } invoiceId && invoice.Id != invoiceId)
            conflict = "Only the current active invoice can be paid.";
        else if (invoice.Status == "Paid")
            conflict = "This invoice is already paid. Check payment history before recording another receipt.";
        else if (invoice.Status == "RolledOver")
            conflict = "Cannot record payment against a rolled-over invoice.";
        else if (payAmount <= 0m || payAmount > invoice.DueAmount)
            conflict = "Payment must be within the invoice's remaining debt. Refresh the invoice before recording the receipt.";
        if (conflict is not null)
        {
            // The original request may have committed after the first operation lookup.
            var completed = await bills.FindPaymentByOperationIdAsync(operationId);
            if (completed is not null)
            {
                EnsurePaymentReplay(completed, fingerprint);
                return await FindAsync(accountId);
            }
            throw new UseCaseException(UseCaseFailure.Conflict, conflict);
        }
        var actor = await operations.FindEmployeeByIdAsync(actorId)
            ?? throw new UseCaseException(UseCaseFailure.Unauthorized);

        var paidTimestamp = DateTime.UtcNow;

        var payment = new PaymentTransaction
        {
            InvoiceId = invoice.Id,
            Amount = payAmount,
            PaidAt = paidTimestamp,
            PaidById = actorId,
            RetailShopId = actor.RetailShopId,
            Channel = channel,
            Note = input.Note?.Trim(),
            OperationId = operationId,
            RequestFingerprint = fingerprint
        };
        bills.Add(payment);

        invoice.PaidAmount += payAmount;
        invoice.DueAmount = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);
        if (invoice.DueAmount <= 0)
        {
            invoice.PaidAt = paidTimestamp;
            invoice.PaidById = actorId;
            invoice.Status = "Paid";
        }
        else
        {
            invoice.Status = "PartiallyPaid";
        }

        try { await bills.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            var saved = await bills.FindPaymentByOperationIdAsync(operationId);
            if (saved is not null)
            {
                EnsurePaymentReplay(saved, fingerprint);
                return await FindAsync(accountId);
            }
            throw new UseCaseException(UseCaseFailure.Conflict, "Invoice changed concurrently. Refresh and check payment history before retrying.");
        }

        var updatedAll = await bills.ListInvoicesAsync(connectionId);
        return ToView(order, invoice, updatedAll);
    }

    private static void EnsurePaymentReplay(PaymentTransaction payment, string fingerprint)
    {
        if (payment.RequestFingerprint != fingerprint)
            throw new UseCaseException(UseCaseFailure.Conflict, "Operation ID has already been used for a different payment.");
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();

    private async Task<ServiceOrder> FindConnectedOrderAsync(string accountId) =>
        await operations.FindOrderByAccountIdAsync(accountId)
        ?? throw new UseCaseException(UseCaseFailure.NotFound);

    internal static BillingView ToView(ServiceOrder order, Invoice? invoice, IReadOnlyList<Invoice>? allInvoices = null)
    {
        var conn = order.Connection!;
        var refund = DepositService.RefundSummary(order);
        var count = Math.Max(1, order.Request.ConnectionCount);
        var basePlanPrice = order.Request.SnapshotPrice > 0 ? order.Request.SnapshotPrice : order.Request.Plan.Price;

        if (invoice == null)
        {
            var defaultRental = basePlanPrice * count;
            return new BillingView(
                conn.AccountId,
                order.Code,
                order.Request.Customer.Name,
                order.Request.PlanName,
                defaultRental,
                "NotBilled",
                null,
                null,
                null,
                defaultRental,
                0m, 0m, defaultRental, 0m,
                0,
                0m, 0m, 0m, defaultRental, 0m, defaultRental,
                count, 0m, 0m, 0m, null, null, null, null, null,
                conn.Status,
                refund.Status,
                refund.Amount,
                refund.At);
        }

        var invoiceViews = allInvoices?.Select(i => new InvoiceItemView(
            i.Id,
            i.InvoiceNumber,
            DateTime.SpecifyKind(i.BillingPeriodStart, DateTimeKind.Utc),
            DateTime.SpecifyKind(i.BillingPeriodEnd, DateTimeKind.Utc),
            i.RentalAmount,
            i.CallUsageAmount,
            i.EquipmentFee,
            i.Subtotal,
            i.DiscountAmount,
            i.DiscountPercent,
            i.TaxAmount,
            i.DepositAmount,
            i.PreviousDueBalance,
            i.TotalAmount,
            i.PaidAmount,
            i.DueAmount,
            i.Status,
            DateTime.SpecifyKind(i.CreatedAt, DateTimeKind.Utc),
            i.PaidAt is DateTime pAt ? DateTime.SpecifyKind(pAt, DateTimeKind.Utc) : null
        )).ToList();

        // History belongs to the account, not just its latest bill. Rollover never moves or recreates receipts.
        var historyInvoices = allInvoices ?? new[] { invoice };
        var paymentViews = historyInvoices.SelectMany(i => i.Payments.Select(p => new PaymentItemView(
            p.Id,
            i.Id,
            p.Amount,
            DateTime.SpecifyKind(p.PaidAt, DateTimeKind.Utc),
            p.PaidBy?.Username ?? "",
            p.Channel,
            p.Note,
            i.InvoiceNumber,
            i.Status,
            $"PAY-{p.Id:D10}", // Internal lookup code derived from the persisted transaction, not external payment evidence.
            p.PaidBy?.DisplayName,
            p.RetailShopId,
            p.RetailShop?.Name
        ))).OrderByDescending(p => p.PaidAt).ThenByDescending(p => p.Id).ToList();
        var historyGaps = historyInvoices.Where(i => i.PaidAmount != i.Payments.Sum(p => p.Amount))
            .Select(i => new PaymentHistoryGapView(i.Id, i.InvoiceNumber, i.PaidAmount, i.Payments.Sum(p => p.Amount))).ToList();

        return new BillingView(
            conn.AccountId,
            order.Code,
            order.Request.Customer.Name,
            order.Request.PlanName,
            invoice.TotalAmount,
            invoice.Status,
            invoice.PaidAt is DateTime paidAt ? DateTime.SpecifyKind(paidAt, DateTimeKind.Utc) : null,
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.RentalAmount,
            invoice.CallUsageAmount,
            invoice.EquipmentFee,
            invoice.Subtotal,
            invoice.DiscountAmount,
            invoice.DiscountPercent,
            invoice.TaxAmount,
            invoice.DepositAmount,
            invoice.PreviousDueBalance,
            invoice.TotalAmount,
            invoice.PaidAmount,
            invoice.DueAmount,
            count,
            invoice.LocalMinutes,
            invoice.StdMinutes,
            invoice.MobileMinutes,
            DateTime.SpecifyKind(invoice.BillingPeriodStart, DateTimeKind.Utc),
            DateTime.SpecifyKind(invoice.BillingPeriodEnd, DateTimeKind.Utc),
            invoice.PaidBy?.Username,
            invoiceViews,
            paymentViews,
            conn.Status,
            refund.Status,
            refund.Amount,
            refund.At,
            historyGaps);
    }
}
