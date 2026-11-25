namespace Nexus.Domain;

/// <summary>Order-level deposit obligation and verified cash totals, separate from postpaid invoices.</summary>
public sealed class SecurityDeposit
{
    public long OrderId { get; set; }
    public ServiceOrder Order { get; set; } = null!;
    public decimal GrossAmount { get; set; }
    public int DiscountPercent { get; set; }
    public decimal RequiredAmount { get; set; }
    public decimal CollectedAmount { get; set; }
    public decimal RefundedAmount { get; set; }
    public bool NeedsReconciliation { get; set; }
    public string Origin { get; set; } = "Order";
    public long Version { get; set; }
    public List<DepositTransaction> Transactions { get; set; } = [];

    // Quotes establish an obligation only. They never create a collection or a refundable balance.
    public static SecurityDeposit Create(string type, int connectionCount)
    {
        var count = Math.Max(1, connectionCount);
        var gross = FinancialConstants.GetSecurityDeposit(type) * count;
        var percent = FinancialConstants.GetBulkDiscountPercent(count);
        return new SecurityDeposit
        {
            GrossAmount = gross,
            DiscountPercent = percent,
            RequiredAmount = gross - decimal.Round(gross * percent / 100m, 2)
        };
    }
}

/// <summary>Append-only receipt, disbursement or reconciliation evidence. OperationId prevents duplicate posting.</summary>
public sealed class DepositTransaction
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public SecurityDeposit Deposit { get; set; } = null!;
    public required string OperationId { get; set; }
    public required string Kind { get; set; }
    public decimal Amount { get; set; }
    public required string Method { get; set; }
    public required string Reference { get; set; }
    public required string Note { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public int? ActorId { get; set; }
    public Employee? Actor { get; set; }
    public int? RetailShopId { get; set; }
    public RetailShop? RetailShop { get; set; }
    public long? SourceInvoiceId { get; set; }
    public decimal CollectedAfter { get; set; }
    public decimal RefundedAfter { get; set; }
}
