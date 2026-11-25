namespace Nexus.Domain;

/// <summary>Optional advance quote and actual cash credit, separate from security deposits and invoice charges.</summary>
public sealed class AdvanceAccount
{
    public long OrderId { get; set; }
    public ServiceOrder Order { get; set; } = null!;
    public decimal? PerConnectionAmount { get; set; }
    public decimal GrossAmount { get; set; }
    public int DiscountPercent { get; set; }
    public decimal QuotedAmount { get; set; }
    public decimal ReceivedAmount { get; set; }
    public decimal AllocatedAmount { get; set; }
    public decimal RefundedAmount { get; set; }
    public string Origin { get; set; } = "Order";
    public long Version { get; set; }
    public List<AdvanceTransaction> Transactions { get; set; } = [];

    // The discount reduces the amount requested upfront; it never creates unreceived credit.
    public static AdvanceAccount Create(decimal? perConnection, int connectionCount)
    {
        var gross = (perConnection ?? 0m) * Math.Max(1, connectionCount);
        var percent = perConnection.HasValue ? FinancialConstants.GetBulkDiscountPercent(connectionCount) : 0;
        return new AdvanceAccount
        {
            PerConnectionAmount = perConnection, GrossAmount = gross, DiscountPercent = percent,
            QuotedAmount = gross - decimal.Round(gross * percent / 100m, 2)
        };
    }
}

/// <summary>Append-only cash receipt, invoice allocation or refund with globally unique retry identity.</summary>
public sealed class AdvanceTransaction
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public AdvanceAccount Advance { get; set; } = null!;
    public required string OperationId { get; set; }
    public required string Kind { get; set; }
    public decimal Amount { get; set; }
    public required string Method { get; set; }
    public required string Reference { get; set; }
    public required string Note { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public int ActorId { get; set; }
    public Employee Actor { get; set; } = null!;
    public int? RetailShopId { get; set; }
    public RetailShop? RetailShop { get; set; }
    public long? InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
    public long? PaymentId { get; set; }
    public PaymentTransaction? Payment { get; set; }
    public decimal AvailableAfter { get; set; }
}
