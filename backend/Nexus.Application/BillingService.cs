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
    string? Note);

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
    DateTime? RefundedAt = null);

/// <summary>Persistence port for connection invoices, payment transactions, and billing account queries.</summary>
public interface IBillingStore
{
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

/// <summary>Application service implementing invoice generation, rollover, payment collection, and deposit refunds.</summary>
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

        var count = Math.Max(1, order.Request.ConnectionCount);
        var baseRental = order.Request.SnapshotPrice > 0 ? order.Request.SnapshotPrice : order.Request.Plan!.Price;
        var rentalAmount = Math.Round(baseRental * count, 2);
        var discountPercent = FinancialConstants.GetBulkDiscountPercent(count);

        var isFirstInvoice = existingInvoices.Count == 0;
        var includeDeposit = input?.IncludeDeposit ?? isFirstInvoice;
        var unitDeposit = includeDeposit ? FinancialConstants.GetSecurityDeposit(order.Request.Type) : 0m;
        var depositGross = Math.Round(unitDeposit * count, 2);

        var discountOnRental = Math.Round(rentalAmount * discountPercent / 100m, 2);
        var discountOnDeposit = Math.Round(depositGross * discountPercent / 100m, 2);
        var totalDiscount = discountOnRental + discountOnDeposit;

        var netRental = rentalAmount - discountOnRental;
        var netDeposit = depositGross - discountOnDeposit;

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
        var taxableCharges = Math.Max(0m, netRental + callUsage + equipmentFee);
        var taxRate = FinancialConstants.ServiceTaxRate;
        var taxAmount = Math.Round(taxableCharges * taxRate, 2);

        var openTrackedInvoices = await bills.ListOpenTrackedInvoicesAsync(connectionId);
        var previousDue = openTrackedInvoices.Sum(i => i.DueAmount);
        foreach (var prior in openTrackedInvoices)
        {
            prior.Status = "RolledOver";
            prior.DueAmount = 0m;
        }

        var subtotal = Math.Max(0m, rentalAmount + callUsage + equipmentFee - discountOnRental);
        var totalAmount = taxableCharges + taxAmount + netDeposit + previousDue;

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
            DiscountAmount = totalDiscount,
            DiscountPercent = discountPercent,
            TaxRate = taxRate,
            TaxAmount = taxAmount,
            DepositAmount = netDeposit,
            PreviousDueBalance = previousDue,
            TotalAmount = totalAmount,
            PaidAmount = 0m,
            DueAmount = totalAmount,
            Status = "Unpaid",
            CreatedAt = now,
            CreatedById = actorId
        };

        bills.Add(invoice);
        await bills.SaveChangesAsync();

        var updatedInvoices = await bills.ListInvoicesAsync(connectionId);
        return ToView(order, invoice, updatedInvoices);
    }

    public async Task<BillingView> PayAsync(string accountId, RecordPaymentInput? input, int actorId, string channel = "CityOffice")
    {
        if (input?.Amount is { } specified)
        {
            if (specified <= 0m)
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Payment amount must be greater than zero.");
            if (decimal.Round(specified, 2) != specified)
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Enter a payment amount with up to two decimal places.");
        }

        var order = await FindConnectedOrderAsync(accountId);
        var connectionId = order.Connection!.Id;
        var invoice = await bills.FindLatestInvoiceAsync(connectionId)
            ?? throw new UseCaseException(UseCaseFailure.Conflict, "Create a billing record before recording payment.");

        if (invoice.Status == "Paid")
        {
            var currentInvoices = await bills.ListInvoicesAsync(connectionId);
            return ToView(order, invoice, currentInvoices);
        }

        if (invoice.Status == "RolledOver")
            throw new UseCaseException(UseCaseFailure.Conflict, "Cannot record payment against a rolled-over invoice.");

        var payAmount = input?.Amount is { } amount
            ? Math.Min(amount, invoice.DueAmount)
            : invoice.DueAmount;

        var now = DateTime.UtcNow;
        var paidTimestamp = new DateTime(now.Ticks - (now.Ticks % TimeSpan.TicksPerSecond), DateTimeKind.Utc);

        var payment = new PaymentTransaction
        {
            InvoiceId = invoice.Id,
            Amount = payAmount,
            PaidAt = paidTimestamp,
            PaidById = actorId,
            Channel = channel,
            Note = input?.Note?.Trim()
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
        catch (StoreWriteException error) when (error.ConcurrentChange)
        {
            var latest = await bills.ReadLatestInvoiceAsync(connectionId);
            if (latest?.PaidAt is null) throw;
            var fallbackInvoices = await bills.ListInvoicesAsync(connectionId);
            return ToView(order, latest, fallbackInvoices);
        }

        var updatedAll = await bills.ListInvoicesAsync(connectionId);
        return ToView(order, invoice, updatedAll);
    }

    public async Task<BillingView> RefundDepositAsync(string accountId, RefundDepositInput? input, int actorId)
    {
        var order = await FindConnectedOrderAsync(accountId);
        var conn = order.Connection!;
        if (conn.Status != "PermanentlyInactive")
            throw new UseCaseException(UseCaseFailure.Conflict, "Only permanently terminated connections can receive a deposit refund.");
        if (conn.RefundStatus == "Refunded")
            throw new UseCaseException(UseCaseFailure.Conflict, "Security deposit refund has already been disbursed.");
        if (conn.RefundStatus != "Pending" || (conn.RefundAmount ?? 0m) <= 0m)
            throw new UseCaseException(UseCaseFailure.Conflict, "No pending security deposit refund is available for this account.");

        conn.RefundStatus = "Refunded";
        conn.RefundedAt = DateTime.UtcNow;
        conn.RefundedById = actorId;
        conn.RefundNote = string.IsNullOrWhiteSpace(input?.Note) ? null : input.Note.Trim();

        await bills.SaveChangesAsync();
        var allInvoices = await bills.ListInvoicesAsync(conn.Id);
        return ToView(order, allInvoices.FirstOrDefault(), allInvoices);
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();

    private async Task<ServiceOrder> FindConnectedOrderAsync(string accountId) =>
        await operations.FindOrderByAccountIdAsync(accountId)
        ?? throw new UseCaseException(UseCaseFailure.NotFound);

    internal static BillingView ToView(ServiceOrder order, Invoice? invoice, IReadOnlyList<Invoice>? allInvoices = null)
    {
        var conn = order.Connection!;
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
                FinancialConstants.GetBulkDiscountPercent(count),
                0m, 0m, 0m, defaultRental, 0m, defaultRental,
                count, 0m, 0m, 0m, null, null, null, null, null,
                conn.Status,
                conn.RefundStatus ?? "None",
                conn.RefundAmount ?? 0m,
                conn.RefundedAt is DateTime rAtNull ? DateTime.SpecifyKind(rAtNull, DateTimeKind.Utc) : null);
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

        var paymentViews = invoice.Payments?.Select(p => new PaymentItemView(
            p.Id,
            p.InvoiceId,
            p.Amount,
            DateTime.SpecifyKind(p.PaidAt, DateTimeKind.Utc),
            p.PaidBy?.DisplayName ?? p.PaidBy?.Username ?? "",
            p.Channel,
            p.Note
        )).ToList();

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
            conn.RefundStatus ?? "None",
            conn.RefundAmount ?? 0m,
            conn.RefundedAt is DateTime rAt ? DateTime.SpecifyKind(rAt, DateTimeKind.Utc) : null);
    }
}
