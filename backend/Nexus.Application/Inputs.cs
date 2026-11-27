using System.ComponentModel.DataAnnotations;

namespace Nexus.Application;

// Validated HTTP request input contracts bound by Minimal API endpoints.
/// <summary>Credentials payload for staff authentication.</summary>
public sealed record LoginInput(
    [property: Required, StringLength(40)] string Username,
    [property: Required, StringLength(128)] string Password);

public sealed record EmployeeInput(
    [property: Required, RegularExpression("^[a-zA-Z0-9._-]{3,40}$")] string Username,
    [property: Required, StringLength(100)] string DisplayName,
    [property: Required, StringLength(20)] string Role,
    [property: Required, StringLength(128, MinimumLength = 12)] string Password,
    [property: Range(1, int.MaxValue)] int? RetailShopId = null);

public sealed record EmployeeUpdateInput(
    [property: Required, StringLength(100)] string DisplayName,
    [property: Required, StringLength(20)] string Role,
    [property: StringLength(128, MinimumLength = 12)] string? Password = null,
    [property: Range(1, int.MaxValue)] int? RetailShopId = null,
    bool? Active = null);

public sealed record CityInput(
    [property: Required, RegularExpression("^[0-9]{3}$")] string Code,
    [property: Required, StringLength(100)] string Name);

public sealed record CityUpdateInput(
    [property: Required, StringLength(100)] string Name);

public sealed record CustomerInput(
    [property: Required, StringLength(120)] string Name,
    [property: Required, RegularExpression(@"^\+?[0-9]{7,15}$")] string Phone,
    [property: Required, StringLength(240)] string Address,
    [property: Required, RegularExpression("^[0-9]{3}$")] string CityCode,
    [property: StringLength(32)] string? TaxId = null,
    [property: EmailAddress, StringLength(160)] string? Email = null,
    [property: StringLength(120)] string? ContactPerson = null,
    [property: StringLength(40)] string? CustomerType = null,
    [property: RegularExpression("^(ACTIVE|SUSPENDED)$")] string? Status = null);

public sealed record PlanInput(
    [property: Required, StringLength(100)] string Name,
    [property: Required, RegularExpression("^[DBT]$")] string Type,
    [property: StringLength(240)] string? Description,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal Price,
    bool Active,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal LocalCallRate = 0m,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal StdCallRate = 0m,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal MobileMsgRate = 0m,
    [property: Range(1, 12)] int ValidityMonths = 1,
    [property: Range(1, 100000)] int? HoursAllowance = null,
    [property: Range(1, 10000000)] int? SpeedKbps = null,
    [property: Range(typeof(decimal), "0", "999999.99")] decimal? AdvancePerConnection = null);

public sealed record ProductInput(
    [property: Required, StringLength(100)] string Name,
    [property: StringLength(240)] string? Description,
    bool Active,
    [property: Range(0, 1000000)] int QuantityInStock = 0,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal ReplacementPrice = 0m);

public sealed record ConnectInput(
    int? ProductId = null);

public sealed record RetailShopInput(
    [property: Required, RegularExpression("^[a-zA-Z0-9._-]{2,30}$")] string Code,
    [property: Required, StringLength(120)] string Name,
    [property: Required, RegularExpression("^[0-9]{3}$")] string CityCode,
    [property: Required, StringLength(240)] string Address,
    [property: Required, RegularExpression(@"^\+?[0-9]{7,15}$")] string Phone,
    bool Active = true);

public sealed record VendorInput(
    [property: Required, RegularExpression("^[a-zA-Z0-9._-]{2,30}$")] string Code,
    [property: Required, StringLength(120)] string Name,
    [property: Required, StringLength(120)] string ContactPerson,
    [property: Required, RegularExpression(@"^\+?[0-9]{7,15}$")] string Phone,
    [property: Required, EmailAddress, StringLength(160)] string Email,
    [property: Required, StringLength(240)] string Address,
    bool Active = true);

public sealed record PurchaseOrderInput(
    [property: Range(1, int.MaxValue)] int VendorId,
    [property: Range(1, int.MaxValue)] int ProductId,
    [property: Range(1, 100000)] int Quantity,
    [property: Range(typeof(decimal), "0.01", "9999999999.99")] decimal UnitPrice,
    [property: StringLength(500)] string? Note = null);

public sealed record VendorPaymentInput(
    [property: Range(1, int.MaxValue)] int PurchaseOrderId,
    [property: Range(typeof(decimal), "0.01", "9999999999.99")] decimal Amount,
    [property: Required, RegularExpression("^(BankTransfer|Cheque|Cash)$")] string Method,
    [property: StringLength(100)] string? Reference = null,
    [property: StringLength(500)] string? Note = null);

public sealed record EquipmentIncidentInput(
    long? ConnectionId = null,
    [property: StringLength(30)] string? AccountId = null,
    [property: Range(1, int.MaxValue)] int ProductId = 0,
    [property: Required, StringLength(500)] string Description = "",
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal ReplacementFee = 0m);

public sealed record RequestInput(
    [property: Range(1, int.MaxValue)] int CustomerId,
    [property: Range(1, int.MaxValue)] int PlanId,
    bool HasNexusLandline,
    [property: Range(1, 10000)] int? ConnectionCount = 1);

public sealed record CreateInvoiceInput(
    [property: Range(typeof(decimal), "0", "99999999.99")] decimal? LocalMinutes = 0m,
    [property: Range(typeof(decimal), "0", "99999999.99")] decimal? StdMinutes = 0m,
    [property: Range(typeof(decimal), "0", "99999999.99")] decimal? MobileMinutes = 0m,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal? EquipmentFee = 0m,
    bool? IncludeDeposit = null,
    DateTime? PeriodStart = null,
    DateTime? PeriodEnd = null);

public sealed record RecordPaymentInput(
    [property: Range(typeof(decimal), "0.01", "9999999999.99")] decimal? Amount = null,
    [property: StringLength(250)] string? Note = null,
    [property: Required, RegularExpression("^[a-zA-Z0-9-]{16,64}$")] string? OperationId = null,
    [property: Range(1, long.MaxValue)] long? InvoiceId = null);

public sealed record RefundDepositInput(
    [property: StringLength(500)] string? Note = null);

public sealed record DepositMoneyInput(
    [property: Range(typeof(decimal), "0.01", "9999999999.99")] decimal Amount,
    [property: Required, RegularExpression("^[a-zA-Z0-9-]{16,64}$")] string OperationId,
    [property: Required, RegularExpression("^(Cash|BankTransfer|Cheque)$")] string Method,
    [property: Required, StringLength(100)] string Reference,
    [property: Required, StringLength(500)] string Note);

public sealed record ReconcileDepositInput(
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal CollectedAmount,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal RefundedAmount,
    [property: Required, RegularExpression("^[a-zA-Z0-9-]{16,64}$")] string OperationId,
    [property: Required, StringLength(100)] string Reference,
    [property: Required, StringLength(500)] string Note);

public sealed record CancelOrderInput([property: Required, StringLength(450)] string Reason);

public sealed record AllocateAdvanceInput(
    [property: Range(1, long.MaxValue)] long InvoiceId,
    [property: Range(typeof(decimal), "0.01", "9999999999.99")] decimal Amount,
    [property: Required, RegularExpression("^[a-zA-Z0-9-]{16,64}$")] string OperationId,
    [property: Required, StringLength(100)] string Reference,
    [property: Required, StringLength(500)] string Note);

public sealed record AssessmentInput(
    [property: Required] bool? DistanceOk,
    [property: Required] bool? ServerAvailable,
    bool? LandlineFeasible,
    [property: StringLength(500)] string? Note);

public sealed record FeedbackInput(
    [property: Range(1, 5)] int Rating,
    [property: Required, StringLength(600)] string Comment);

public sealed record SuspendConnectionInput(
    [property: Required, StringLength(500)] string Reason);

public sealed record TerminateConnectionInput(
    [property: StringLength(500)] string? Note = null);

public sealed record CustomerDocumentInput(
    [property: Range(1, int.MaxValue)] int CustomerId,
    [property: Required, StringLength(40)] string DocumentType,
    [property: Required, StringLength(200)] string Title,
    [property: Required, StringLength(500)] string FilePathOrUrl,
    [property: Range(2000, 2100)] int Year,
    [property: Required, RegularExpression("^[0-9]{3}$")] string CityCode);

public sealed record PlanChangeRequestInput(
    [property: Range(1, long.MaxValue)] long ConnectionId,
    [property: Range(1, int.MaxValue)] int TargetPlanId,
    [property: StringLength(500)] string? Note = null);

public sealed record RejectPlanChangeInput(
    [property: StringLength(500)] string? Note = null);

public sealed record CustomerQueryInput(
    [property: Range(1, int.MaxValue)] int CustomerId,
    [property: Required, StringLength(200)] string Subject,
    [property: Required, StringLength(40)] string Category,
    [property: Required, StringLength(1000)] string Question);

public sealed record AnswerQueryInput(
    [property: Required, StringLength(2000)] string Answer,
    bool IsFaq = false);

public sealed record RegisterCustomerInput(
    [property: Required, StringLength(120)] string Name,
    [property: Required, RegularExpression(@"^\+?[0-9]{7,15}$")] string Phone,
    [property: Required, StringLength(240)] string Address,
    [property: Required, RegularExpression("^[0-9]{3}$")] string CityCode,
    [property: Required, RegularExpression("^[a-zA-Z0-9._-]{3,40}$")] string Username,
    [property: Required, StringLength(128, MinimumLength = 12)] string Password,
    [property: EmailAddress, StringLength(160)] string? Email = null,
    [property: StringLength(120)] string? ContactPerson = null,
    [property: StringLength(32)] string? TaxId = null,
    [property: StringLength(40)] string? CustomerType = null);

public sealed record CustomerProfileInput(
    [property: Required, StringLength(120)] string Name,
    [property: Required, RegularExpression(@"^\+?[0-9]{7,15}$")] string Phone,
    [property: Required, StringLength(240)] string Address,
    [property: Required, RegularExpression("^[0-9]{3}$")] string CityCode,
    [property: EmailAddress, StringLength(160)] string? Email = null,
    [property: StringLength(120)] string? ContactPerson = null,
    [property: StringLength(32)] string? TaxId = null,
    [property: StringLength(40)] string? CustomerType = null);

public sealed record CustomerRequestInput(
    [property: Range(1, int.MaxValue)] int PlanId,
    bool HasNexusLandline,
    [property: Range(1, 10000)] int? ConnectionCount = 1,
    [property: StringLength(240)] string? Address = null,
    [property: RegularExpression("^[0-9]{3}$")] string? CityCode = null);

public sealed record CustomerPaymentInput(
    [property: Range(1, long.MaxValue)] long? InvoiceId = null,
    [property: Range(typeof(decimal), "0.01", "9999999999.99")] decimal? Amount = null,
    [property: StringLength(250)] string? Note = null,
    [property: Required, RegularExpression("^[a-zA-Z0-9-]{16,64}$")] string? OperationId = null);

public sealed record CustomerSelfQueryInput(
    [property: Required, StringLength(200)] string Subject,
    [property: Required, StringLength(40)] string Category,
    [property: Required, StringLength(1000)] string Question);

