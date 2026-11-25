namespace Nexus.Domain;

/// <summary>Canonical authorization role constants.</summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Retail = "Retail";
    public const string Technical = "Technical";
    public const string Billing = "Billing";
    public const string Customer = "Customer";
    public static readonly string[] Staff = [Admin, Retail, Technical, Billing];
    public static readonly string[] All = [Admin, Retail, Technical, Billing, Customer];
}

/// <summary>User account with role assignment and optional retail shop or customer affiliation.</summary>
public sealed class Employee
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string DisplayName { get; set; }
    public required string Role { get; set; }
    public required string PasswordHash { get; set; }
    public bool Active { get; set; } = true;
    public int? RetailShopId { get; set; }
    public RetailShop? RetailShop { get; set; }
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
}

public sealed class City
{
    public required string Code { get; set; }
    public required string Name { get; set; }
}

public sealed class Customer
{
    public int Id { get; set; }
    public string Code => $"CUS-{Id:D6}";
    public required string Name { get; set; }
    public required string SearchName { get; set; }
    public required string Phone { get; set; }
    public required string Address { get; set; }
    public required string CityCode { get; set; }
    public string? TaxId { get; set; }
    public string? Email { get; set; }
    public string? ContactPerson { get; set; }
    public string? CustomerType { get; set; }
    public string? Status { get; set; }
    public City City { get; set; } = null!;
    public bool IsSuspended => string.Equals(Status, "SUSPENDED", StringComparison.OrdinalIgnoreCase);
}

public sealed class ServicePlan
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Type { get; set; }
    public required string Description { get; set; }
    public decimal Price { get; set; }
    public bool Active { get; set; } = true;
    public decimal LocalCallRate { get; set; }
    public decimal StdCallRate { get; set; }
    public decimal MobileMsgRate { get; set; }
    public int ValidityMonths { get; set; } = 1; // 1, 3, 6, or 12
    public int? HoursAllowance { get; set; }
    public int? SpeedKbps { get; set; }
    // Null means no advance policy has been configured; zero is an explicit no-advance policy.
    public decimal? AdvancePerConnection { get; set; }
}

public sealed class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public bool Active { get; set; } = true;
    public int QuantityInStock { get; set; } = 0;
    public decimal ReplacementPrice { get; set; } = 0m;
}

public sealed class ServiceRequest
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int PlanId { get; set; }
    public ServicePlan Plan { get; set; } = null!;
    // Snapshot the selected plan and installation address when the request is filed.
    public required string PlanName { get; set; }
    public required string Type { get; set; }
    public required string CityCode { get; set; }
    public required string Address { get; set; }
    public bool HasNexusLandline { get; set; }
    public decimal SnapshotPrice { get; set; }
    public int ConnectionCount { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedById { get; set; }
    public int? RetailShopId { get; set; }
    public RetailShop? RetailShop { get; set; }
    public bool Confirmed { get; private set; }
    public ServiceOrder? Order { get; set; }

    /// <summary>Confirms the request and creates an initial Pending service order with audit history.</summary>
    public ServiceOrder Confirm(int actorId)
    {
        Confirmed = true;
        var order = new ServiceOrder
        {
            Request = this, Deposit = SecurityDeposit.Create(Type, ConnectionCount),
            Advance = AdvanceAccount.Create(Plan?.AdvancePerConnection, ConnectionCount)
        };
        order.History.Add(new OrderEvent
        {
            Status = OrderStatus.Pending, ActorId = actorId, Note = "Retail confirmed the request."
        });
        return order;
    }
}

public enum OrderStatus { Pending, Feasible, NotFeasible, Connected, Cancelled }

public sealed class ServiceOrder
{
    public long Id { get; set; }
    public int RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public string Code => new OrderNumber(Request.Type, Id).ToString();
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Connection? Connection { get; set; }
    public SecurityDeposit? Deposit { get; set; }
    public AdvanceAccount? Advance { get; set; }
    public List<OrderEvent> History { get; set; } = [];
    public List<ServiceFeedback> Feedback { get; set; } = [];

    /// <summary>Evaluates technical feasibility (including landline availability for Dial-Up) and logs audit history.</summary>
    public void Assess(bool? distanceOk, bool? serverAvailable, bool? landlineFeasible, string? note, int actorId)
    {
        if (Status != OrderStatus.Pending)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Only Pending orders can be assessed.");

        var needsLandline = Request.Type == "D" && !Request.HasNexusLandline;
        if (needsLandline && landlineFeasible is null)
            throw new DomainRuleException(DomainRuleFailure.InvalidInput, "Check landline feasibility for this Dial-up order.");

        var feasible = distanceOk == true && serverAvailable == true && (!needsLandline || landlineFeasible == true);
        if (!feasible && string.IsNullOrWhiteSpace(note))
            throw new DomainRuleException(DomainRuleFailure.InvalidInput, "Enter the reason the order is not feasible.");

        Status = feasible ? OrderStatus.Feasible : OrderStatus.NotFeasible;
        History.Add(new OrderEvent
        {
            Status = Status, ActorId = actorId, Note = note?.Trim() ?? "",
            DistanceOk = distanceOk, ServerAvailable = serverAvailable,
            LandlineFeasible = needsLandline ? landlineFeasible : null
        });
    }

    /// <summary>Activates a Feasible order into a Connected subscriber account with optional equipment allocation.</summary>
    public void Activate(int actorId, int? productId = null)
    {
        if (Status != OrderStatus.Feasible)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Only Feasible orders can be connected.");

        if (Deposit is null || Deposit.NeedsReconciliation || Deposit.CollectedAmount < Deposit.RequiredAmount || Deposit.RefundedAmount > 0)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Collect the full security deposit or reconcile legacy evidence before activation.");
        Deposit.Version++;
        if (Advance is not null) Advance.Version++;

        Connection = new Connection
        {
            Type = Request.Type,
            CityCode = Request.CityCode,
            AssignedProductId = productId
        };
        Status = OrderStatus.Connected;
        History.Add(new OrderEvent
        {
            Status = Status, ActorId = actorId, Note = productId.HasValue
                ? $"Technical activated the connection with equipment #{productId.Value}."
                : "Technical activated the connection."
        });
    }

    /// <summary>Closes an unconnected order; a collected deposit remains available for Billing to refund.</summary>
    public void Cancel(string reason, int actorId)
    {
        if (Connection is not null || Status == OrderStatus.Connected)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Terminate the connection instead of cancelling a connected order.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleException(DomainRuleFailure.InvalidInput, "Enter the cancellation reason.");
        if (Status == OrderStatus.Cancelled) return;
        Status = OrderStatus.Cancelled;
        if (Deposit is not null) Deposit.Version++;
        if (Advance is not null) Advance.Version++;
        History.Add(new OrderEvent { Status = Status, ActorId = actorId, Note = $"Retail cancelled order: {reason.Trim()}" });
    }

    public ServiceFeedback RecordFeedback(int rating, string comment, int actorId)
    {
        if (Status != OrderStatus.Connected)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Feedback is available after the connection is active.");

        return new ServiceFeedback
        {
            OrderId = Id, RecordedById = actorId, Rating = rating, Comment = comment.Trim()
        };
    }
}

public sealed class OrderEvent
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public int ActorId { get; set; }
    public Employee Actor { get; set; } = null!;
    public required string Note { get; set; }
    public bool? DistanceOk { get; set; }
    public bool? ServerAvailable { get; set; }
    public bool? LandlineFeasible { get; set; }
}

public sealed class Connection
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public required string Type { get; set; }
    public required string CityCode { get; set; }
    public string AccountId => $"{Type}{CityCode}{Id:D12}";
    public DateTime ActivatedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Active"; // Active, TemporarilyInactive, PermanentlyInactive
    public string? SuspendReason { get; set; }
    public DateTime? SuspendedAt { get; set; }
    public DateTime? TerminatedAt { get; set; }
    public string? RefundStatus { get; set; }
    public decimal? RefundAmount { get; set; }
    public DateTime? RefundedAt { get; set; }
    public int? RefundedById { get; set; }
    public Employee? RefundedBy { get; set; }
    public string? RefundNote { get; set; }
    public int? AssignedProductId { get; set; }
    public Product? AssignedProduct { get; set; }
    public List<Invoice> Invoices { get; set; } = [];
    public List<EquipmentIncident> Incidents { get; set; } = [];
}

public sealed class RetailShop
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string CityCode { get; set; }
    public City City { get; set; } = null!;
    public required string Address { get; set; }
    public required string Phone { get; set; }
    public bool Active { get; set; } = true;
}

public sealed class Vendor
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string ContactPerson { get; set; }
    public required string Phone { get; set; }
    public required string Email { get; set; }
    public required string Address { get; set; }
    public bool Active { get; set; } = true;
}

public sealed class PurchaseOrder
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = "";
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = "Ordered"; // Ordered, Received, Cancelled
    public DateTime OrderedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReceivedAt { get; set; }
    public string? Note { get; set; }
    public List<VendorPayment> Payments { get; set; } = [];

    public void Receive()
    {
        if (Status == "Received") return;
        if (Status == "Cancelled")
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Cancelled orders cannot be received.");

        Status = "Received";
        ReceivedAt = DateTime.UtcNow;
        Product.QuantityInStock += Quantity;
    }

    public void Cancel()
    {
        if (Status == "Received")
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Received orders cannot be cancelled.");

        Status = "Cancelled";
    }
}

public sealed class VendorPayment
{
    public int Id { get; set; }
    public string PaymentNumber { get; set; } = "";
    public int PurchaseOrderId { get; set; }
    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public string Method { get; set; } = "BankTransfer"; // BankTransfer, Cheque, Cash
    public string? Reference { get; set; }
    public string? Note { get; set; }
}

public sealed class EquipmentIncident
{
    public int Id { get; set; }
    public long ConnectionId { get; set; }
    public Connection Connection { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public DateTime IncidentDate { get; set; } = DateTime.UtcNow;
    public required string Description { get; set; }
    public decimal ReplacementFee { get; set; }
    public int RecordedById { get; set; }
    public Employee RecordedBy { get; set; } = null!;
    public bool Settled { get; set; } = false;
}

/// <summary>Statutory tax rate, per-service security deposits, and bulk corporate discount tiers.</summary>
public static class FinancialConstants
{
    public const decimal ServiceTaxRate = 0.1224m; // 12.24% government service tax

    /// <summary>Returns the base refundable security deposit in USD for a service type code.</summary>
    public static decimal GetSecurityDeposit(string type) => type switch
    {
        "D" => 325m, // Dial-up refundable security deposit
        "B" => 500m, // Broadband refundable security deposit
        "T" => 250m, // Landline refundable security deposit
        _ => 0m
    };

    /// <summary>Returns the bulk connection deposit discount percentage (25%–100%) for corporate tiers.</summary>
    public static int GetBulkDiscountPercent(int connectionCount)
    {
        var qty = Math.Max(1, connectionCount);
        if (qty > 50) return 100;
        if (qty >= 25) return 75;
        if (qty >= 15) return 50;
        if (qty >= 10) return 25;
        return 0;
    }
}

public sealed class Invoice
{
    public long Id { get; set; }
    public long ConnectionId { get; set; }
    public Connection Connection { get; set; } = null!;
    public string InvoiceNumber { get; set; } = "";
    public DateTime BillingPeriodStart { get; set; } = DateTime.UtcNow;
    public DateTime BillingPeriodEnd { get; set; } = DateTime.UtcNow.AddMonths(1);
    public decimal RentalAmount { get; set; }
    public decimal LocalMinutes { get; set; }
    public decimal StdMinutes { get; set; }
    public decimal MobileMinutes { get; set; }
    public decimal CallUsageAmount { get; set; }
    public decimal EquipmentFee { get; set; }
    public decimal Subtotal { get; set; }
    // Legacy breakdown stays readable; new service invoices keep deposit/discount fields zero.
    public decimal DiscountAmount { get; set; }
    public int DiscountPercent { get; set; }
    public decimal TaxRate { get; set; } = FinancialConstants.ServiceTaxRate;
    public decimal TaxAmount { get; set; }
    public decimal DepositAmount { get; set; }
    public decimal PreviousDueBalance { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DueAmount { get; set; }
    public string Status { get; set; } = "Unpaid"; // Unpaid, PartiallyPaid, Paid, RolledOver
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedById { get; set; }
    public Employee? CreatedBy { get; set; }
    public DateTime? PaidAt { get; set; }
    public int? PaidById { get; set; }
    public Employee? PaidBy { get; set; }
    public List<PaymentTransaction> Payments { get; set; } = [];
}

public sealed class PaymentTransaction
{
    public long Id { get; set; }
    public long InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public int PaidById { get; set; }
    public Employee PaidBy { get; set; } = null!;
    public int? RetailShopId { get; set; }
    public RetailShop? RetailShop { get; set; }
    public string Channel { get; set; } = "CityOffice"; // CityOffice | RetailOutlet
    public string? Note { get; set; }
}

public sealed class ServiceFeedback
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public int RecordedById { get; set; }
    public Employee RecordedBy { get; set; } = null!;
    public int Rating { get; set; }
    public required string Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class CustomerDocument
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public required string DocumentType { get; set; } // 'AddressProof', 'RegistrationForm', 'PaymentReceipt', 'Other'
    public required string Title { get; set; }
    public required string FilePathOrUrl { get; set; }
    public string? OriginalFileName { get; set; }
    public string? ContentType { get; set; }
    public long? FileSizeBytes { get; set; }
    public int Year { get; set; }
    public required string CityCode { get; set; }
    public City? City { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public int UploadedById { get; set; }
    public Employee UploadedBy { get; set; } = null!;
}

public sealed class PlanChangeRequest
{
    public int Id { get; set; }
    public long ConnectionId { get; set; }
    public Connection Connection { get; set; } = null!;
    public int TargetPlanId { get; set; }
    public ServicePlan TargetPlan { get; set; } = null!;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public int? RequestedById { get; set; }
    public Employee? RequestedBy { get; set; }
    public string Status { get; set; } = "Pending"; // 'Pending', 'Approved', 'Rejected'
    public string? Note { get; set; }
    public int? ReviewedById { get; set; }
    public Employee? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

public sealed class CustomerQuery
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public required string Subject { get; set; }
    public required string Category { get; set; } // 'Billing', 'Technical', 'Plan', 'General'
    public required string Question { get; set; }
    public string? Answer { get; set; }
    public string Status { get; set; } = "Open"; // 'Open', 'Answered', 'Closed'
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedById { get; set; }
    public Employee? CreatedBy { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public int? AnsweredById { get; set; }
    public Employee? AnsweredBy { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ClosedById { get; set; }
    public Employee? ClosedBy { get; set; }
    public bool IsFaq { get; set; } = false;
}
