using System.Globalization;
using System.Text.RegularExpressions;
using Nexus.Domain;

namespace Nexus.Application;

public sealed record CustomerView(int Id, string Code, string Name, string Phone, string Address, string CityCode,
    string? TaxId, string? Email, string? ContactPerson, string? CustomerType, string Status);
public sealed record RequestView(int Id, int CustomerId, string CustomerName, int PlanId, string PlanName,
    string Type, string CityCode, string Address, bool HasNexusLandline, decimal Price, DateTime CreatedAt, int ConnectionCount = 1, string? CustomerPhone = null);
public sealed record OrderView(string Code, int RequestId, string Status, RequestView Request, DateTime CreatedAt,
    string? AccountId, DateTime? ActivatedAt, int? AssignedProductId = null)
{
    public string CustomerName => Request.CustomerName;
    public string Type => Request.Type;
    public string ServiceType => Request.Type;
    public string? CustomerPhone => Request.CustomerPhone;
}
public sealed record OrderHistoryView(string Status, DateTime At, string Actor, string Note,
    bool? DistanceOk, bool? ServerAvailable, bool? LandlineFeasible);
public sealed record FeedbackView(int Rating, string Comment, DateTime CreatedAt);
public sealed record CreatedFeedback(long Id, int Rating, string Comment, DateTime CreatedAt);
public sealed record OrderDetailView(OrderView Order, IReadOnlyList<OrderHistoryView> History, IReadOnlyList<FeedbackView> Feedback)
{
    public int PlanId => Order.Request.PlanId;
    public string PlanName => Order.Request.PlanName;
    public decimal SnapshotPrice => Order.Request.Price;
}

public sealed record ConnectionLifecycleView(
    long Id,
    string AccountId,
    long OrderId,
    string Type,
    string CityCode,
    string Status,
    string? SuspendReason,
    DateTime? SuspendedAt,
    DateTime? TerminatedAt,
    string? RefundStatus,
    decimal? RefundAmount,
    string CustomerName,
    string CustomerPhone,
    string PlanName,
    DateTime ActivatedAt);

public sealed record DocumentUploadRequest(
    int CustomerId,
    string DocumentType,
    string Title,
    int Year,
    string CityCode,
    Stream FileStream,
    string FileName,
    string? ContentType,
    long FileSizeBytes);

public sealed record DocumentDownloadResult(
    Stream Stream,
    string DownloadFileName,
    string ContentType);

public sealed record CustomerDocumentView(
    int Id,
    int CustomerId,
    string CustomerName,
    string DocumentType,
    string Title,
    string FilePathOrUrl,
    string? OriginalFileName,
    string? ContentType,
    long? FileSizeBytes,
    bool HasStoredFile,
    int Year,
    string CityCode,
    DateTime UploadedAt,
    int UploadedById,
    string? UploadedByName = null);

public sealed record PlanChangeRequestView(
    int Id,
    long ConnectionId,
    string? AccountId,
    string CustomerName,
    string ServiceType,
    int CurrentPlanId,
    string CurrentPlanName,
    decimal CurrentPlanPrice,
    int TargetPlanId,
    string TargetPlanName,
    decimal TargetPlanPrice,
    DateTime RequestedAt,
    string Status,
    string? Note,
    int? ReviewedById,
    string? ReviewedByName,
    DateTime? ReviewedAt,
    int? RequestedById = null);

public sealed record CustomerQueryView(
    int Id,
    int CustomerId,
    string CustomerName,
    string Subject,
    string Category,
    string Question,
    string? Answer,
    string Status,
    DateTime CreatedAt,
    DateTime? AnsweredAt,
    int? AnsweredById,
    string? AnsweredByName,
    bool IsFaq,
    int? CreatedById = null,
    DateTime? ClosedAt = null,
    int? ClosedById = null);

public sealed record FaqItemView(
    int Id,
    string Category,
    string Subject,
    string Question,
    string Answer);


/// <summary>Application service orchestrating customer requests, order lifecycle, documents, plan changes, and inquiries.</summary>
public sealed class OperationsService(IOperationsStore operations, ICatalogStore catalog, IDocumentStorage documentStorage)
{
    public async Task<IReadOnlyList<CustomerView>> CustomersAsync(string? q)
    {
        var term = q?.Trim() ?? "";
        if (term.Length > 120)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Search text is too long.");

        int? id = term.StartsWith("CUS-", StringComparison.OrdinalIgnoreCase) && int.TryParse(term.AsSpan(4), out var number)
            ? number : null;
        return (await operations.SearchCustomersAsync(id, term)).Select(ToView).ToArray();
    }

    public async Task<CustomerView> CreateCustomerAsync(CustomerInput input)
    {
        await EnsureCityExistsAsync(input.CityCode);
        var name = input.Name.Trim();
        var customer = new Customer
        {
            Name = name, SearchName = name.ToUpperInvariant(), Phone = input.Phone,
            Address = input.Address.Trim(), CityCode = input.CityCode,
            TaxId = input.TaxId?.Trim(), Email = input.Email?.Trim(), ContactPerson = input.ContactPerson?.Trim(),
            CustomerType = input.CustomerType?.Trim() ?? "Corporate", Status = input.Status?.Trim() ?? "ACTIVE"
        };
        operations.Add(customer);
        await operations.SaveChangesAsync();
        return ToView(customer);
    }

    public async Task<CustomerView> UpdateCustomerAsync(int id, CustomerInput input)
    {
        var customer = await operations.FindCustomerAsync(id) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        await EnsureCityExistsAsync(input.CityCode);
        customer.Name = input.Name.Trim();
        customer.SearchName = customer.Name.ToUpperInvariant();
        customer.Phone = input.Phone;
        customer.Address = input.Address.Trim();
        customer.CityCode = input.CityCode;
        customer.TaxId = input.TaxId?.Trim();
        customer.Email = input.Email?.Trim();
        customer.ContactPerson = input.ContactPerson?.Trim();
        customer.CustomerType = input.CustomerType?.Trim() ?? customer.CustomerType ?? "Corporate";
        customer.Status = input.Status?.Trim() ?? customer.Status ?? "ACTIVE";
        await operations.SaveChangesAsync();
        return ToView(customer);
    }

    public async Task<IReadOnlyList<RequestView>> PendingRequestsAsync() =>
        (await operations.ListPendingRequestsAsync()).Select(ToView).ToArray();

    public async Task<RequestView> CreateRequestAsync(RequestInput input, int actorId)
    {
        var customer = await operations.FindCustomerAsync(input.CustomerId);
        var plan = await catalog.FindPlanAsync(input.PlanId);
        if (customer is null || customer.Status == "SUSPENDED")
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an active customer.");
        if (plan is null || !plan.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an active service plan.");

        var count = Math.Max(1, input.ConnectionCount ?? 1);
        var request = new ServiceRequest
        {
            Customer = customer, Plan = plan, PlanName = plan.Name, Type = plan.Type,
            CityCode = customer.CityCode, Address = customer.Address,
            HasNexusLandline = plan.Type == "D" && input.HasNexusLandline, CreatedById = actorId,
            SnapshotPrice = plan.Price, ConnectionCount = count
        };
        operations.Add(request);
        await operations.SaveChangesAsync();
        return ToView(request);
    }

    public async Task<Creation<OrderView>> ConfirmAsync(int id, int actorId)
    {
        var request = await operations.FindRequestForConfirmationAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound);
        if (request.Order is not null) return new Creation<OrderView>(ToView(request.Order), false);

        var order = request.Confirm(actorId);
        operations.Add(order);
        // The request flag, order and initial audit entry commit together.
        try { await operations.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            var existing = await operations.ReadOrderByRequestAsync(id);
            if (existing is null) throw;
            return new Creation<OrderView>(ToView(existing), false);
        }
        return new Creation<OrderView>(ToView(order), true);
    }

    public async Task<IReadOnlyList<OrderView>> OrdersAsync(string? code, string? status)
    {
        OrderNumber? number = null;
        if (!string.IsNullOrWhiteSpace(code))
            number = OrderNumber.Parse(code) ??
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Use an Order ID like B0000000001.");

        OrderStatus? orderStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<OrderStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed) || char.IsDigit(status[0]))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Unknown order status.");
            orderStatus = parsed;
        }
        return (await operations.ListOrdersAsync(number, orderStatus)).Select(ToView).ToArray();
    }

    public async Task<OrderDetailView> DetailAsync(string code)
    {
        var order = await FindOrderAsync(code);
        var history = await operations.ReadHistoryAsync(order.Id);
        var feedback = await operations.ReadFeedbackAsync(order.Id);
        return new OrderDetailView(ToView(order),
            history.Select(entry => new OrderHistoryView(entry.Status.ToString(), AsUtc(entry.At),
                entry.Actor.Username, entry.Note, entry.DistanceOk, entry.ServerAvailable, entry.LandlineFeasible)).ToArray(),
            feedback.Select(entry => new FeedbackView(entry.Rating, entry.Comment, AsUtc(entry.CreatedAt))).ToArray());
    }

    public async Task<CreatedFeedback> RecordFeedbackAsync(string code, FeedbackInput input, int actorId)
    {
        var order = await FindOrderAsync(code);
        var feedback = order.RecordFeedback(input.Rating, input.Comment, actorId);
        operations.Add(feedback);
        await operations.SaveChangesAsync();
        return new CreatedFeedback(feedback.Id, feedback.Rating, feedback.Comment, AsUtc(feedback.CreatedAt));
    }

    public async Task<OrderView> AssessAsync(string code, AssessmentInput input, int actorId)
    {
        var order = await FindOrderAsync(code);
        order.Assess(input.DistanceOk, input.ServerAvailable, input.LandlineFeasible, input.Note, actorId);
        try { await operations.SaveChangesAsync(); }
        catch (StoreWriteException error) when (error.ConcurrentChange)
        {
            throw new UseCaseException(UseCaseFailure.Conflict, "The order changed. Refresh and try again.");
        }
        return ToView(order);
    }

    public async Task<Creation<OrderView>> ConnectAsync(string code, int? productId, int actorId)
    {
        var order = await FindOrderAsync(code);
        if (order.Connection is not null) return new Creation<OrderView>(ToView(order), false);

        var requiredQty = Math.Max(1, order.Request.ConnectionCount);
        Product? product = null;
        if (productId.HasValue)
        {
            product = await catalog.FindProductAsync(productId.Value);
            if (product is null || !product.Active)
                throw new UseCaseException(UseCaseFailure.NotFound, "Equipment not found or inactive.");
            if (product.QuantityInStock < requiredQty)
                throw new UseCaseException(UseCaseFailure.InvalidInput, $"Insufficient equipment stock (required {requiredQty}, available {product.QuantityInStock}).");
        }

        // Validate and activate order state before mutating tracked product stock.
        order.Activate(actorId, productId);
        if (product is not null)
            product.QuantityInStock -= requiredQty;

        try { await operations.SaveChangesAsync(); }
        catch (StoreWriteException error)
        {
            var existing = await operations.ReadOrderByIdAsync(order.Id);
            if (existing?.Connection is not null)
                return new Creation<OrderView>(ToView(existing), false);
            if (error.ConcurrentChange)
                throw new UseCaseException(UseCaseFailure.Conflict, "Order or equipment stock changed concurrently. Refresh and try again.");
            throw;
        }
        return new Creation<OrderView>(ToView(order), true);
    }

    // --- Group 3.1: Connection Lifecycle ---
    public async Task<IReadOnlyList<ConnectionLifecycleView>> ConnectionsAsync(
        string? q = null,
        string? code = null,
        string? customerName = null,
        string? serviceType = null,
        string? phone = null,
        string? fromDate = null,
        string? toDate = null,
        string? status = null,
        string? cityCode = null)
    {
        if (q?.Length > 120 || code?.Length > 120 || customerName?.Length > 120 || phone?.Length > 120)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Search text is too long.");

        var normalizedServiceType = NormalizeServiceType(serviceType);

        string? normalizedStatus = null;
        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var trimmedStatus = status.Trim();
            normalizedStatus = trimmedStatus.ToUpperInvariant() switch
            {
                "ACTIVE" => "Active",
                "SUSPENDED" or "TEMPORARILYINACTIVE" => "TemporarilyInactive",
                "PERMANENTLYINACTIVE" or "TERMINATED" => "PermanentlyInactive",
                _ => trimmedStatus
            };
        }

        string? normalizedCityCode = null;
        if (!string.IsNullOrWhiteSpace(cityCode) && !cityCode.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            normalizedCityCode = cityCode.Trim();
        }

        var (fromUtc, toExclusiveUtc) = ParseSearchDateRangeUtc(fromDate, toDate);

        var orders = await operations.ListConnectionsAsync(
            q, code, customerName, normalizedServiceType, phone,
            fromUtc, toExclusiveUtc, normalizedStatus, normalizedCityCode);
        return orders.Select(ToLifecycleView).ToArray();
    }

    private static string? NormalizeServiceType(string? serviceType)
    {
        if (string.IsNullOrWhiteSpace(serviceType) || serviceType.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            return null;

        return serviceType.Trim().ToUpperInvariant() switch
        {
            "B" or "BROADBAND" => "B",
            "D" or "DIALUP" or "DIAL-UP" or "DIAL_UP" => "D",
            "T" or "LANDLINE" or "TELEPHONE" => "T",
            _ => throw new UseCaseException(UseCaseFailure.InvalidInput, "Unknown service type.")
        };
    }

    private static (DateTime? FromUtc, DateTime? ToExclusiveUtc) ParseSearchDateRangeUtc(string? fromDate, string? toDate)
    {
        DateTime? fromUtc = null;
        if (!string.IsNullOrWhiteSpace(fromDate))
            fromUtc = ParseSearchDateUtc(fromDate, "fromDate");

        DateTime? toStartUtc = null;
        if (!string.IsNullOrWhiteSpace(toDate))
            toStartUtc = ParseSearchDateUtc(toDate, "toDate");

        if (fromUtc.HasValue && toStartUtc.HasValue && fromUtc.Value > toStartUtc.Value)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "From date cannot be after to date.");

        return (fromUtc, toStartUtc?.AddDays(1));
    }

    private static DateTime ParseSearchDateUtc(string value, string paramName)
    {
        var trimmed = value.Trim();
        if (DateOnly.TryParseExact(trimmed, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateOnly))
            return new DateTime(dateOnly.Year, dateOnly.Month, dateOnly.Day, 0, 0, 0, DateTimeKind.Utc);
        if (DateTime.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
            return DateTime.SpecifyKind(parsed.Date, DateTimeKind.Utc);
        throw new UseCaseException(UseCaseFailure.InvalidInput, $"Invalid {paramName} format.");
    }

    public async Task<ConnectionLifecycleView> ConnectionDetailAsync(string accountId)
    {
        var order = await operations.FindOrderWithConnectionByAccountIdAsync(accountId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Connection not found.");
        return ToLifecycleView(order);
    }

    public async Task<ConnectionLifecycleView> SuspendConnectionAsync(string accountId, SuspendConnectionInput input, int actorId)
    {
        if (string.IsNullOrWhiteSpace(input.Reason))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Enter a valid suspension reason.");

        var order = await operations.FindOrderWithConnectionByAccountIdAsync(accountId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Connection not found.");

        var conn = order.Connection!;
        if (conn.Status == "TemporarilyInactive")
            throw new UseCaseException(UseCaseFailure.Conflict, "Connection is already suspended.");
        if (conn.Status == "PermanentlyInactive")
            throw new UseCaseException(UseCaseFailure.Conflict, "Terminated connection cannot be suspended.");
        if (conn.Status != "Active")
            throw new UseCaseException(UseCaseFailure.Conflict, "Only active connections can be suspended.");

        conn.Status = "TemporarilyInactive";
        conn.SuspendReason = input.Reason.Trim();
        conn.SuspendedAt = DateTime.UtcNow;

        order.History.Add(new OrderEvent
        {
            OrderId = order.Id,
            Status = order.Status,
            ActorId = actorId,
            At = DateTime.UtcNow,
            Note = $"Technical suspended connection: {conn.SuspendReason}"
        });

        await operations.SaveChangesAsync();
        return ToLifecycleView(order);
    }

    public async Task<ConnectionLifecycleView> ReactivateConnectionAsync(string accountId, int actorId)
    {
        var order = await operations.FindOrderWithConnectionByAccountIdAsync(accountId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Connection not found.");

        var conn = order.Connection!;
        if (conn.Status == "Active")
            throw new UseCaseException(UseCaseFailure.Conflict, "Connection is already active.");
        if (conn.Status == "PermanentlyInactive")
            throw new UseCaseException(UseCaseFailure.Conflict, "Terminated connection cannot be reactivated.");
        if (conn.Status != "TemporarilyInactive")
            throw new UseCaseException(UseCaseFailure.Conflict, "Only temporarily suspended connections can be reactivated.");

        conn.Status = "Active";
        conn.SuspendReason = null;

        order.History.Add(new OrderEvent
        {
            OrderId = order.Id,
            Status = order.Status,
            ActorId = actorId,
            At = DateTime.UtcNow,
            Note = "Technical reactivated connection."
        });

        await operations.SaveChangesAsync();
        return ToLifecycleView(order);
    }

    public async Task<ConnectionLifecycleView> TerminateConnectionAsync(string accountId, TerminateConnectionInput? input, int actorId)
    {
        var order = await operations.FindOrderWithConnectionByAccountIdAsync(accountId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Connection not found.");

        var conn = order.Connection!;
        if (conn.Status == "PermanentlyInactive")
            throw new UseCaseException(UseCaseFailure.Conflict, "Connection is already terminated.");

        conn.Status = "PermanentlyInactive";
        conn.TerminatedAt = DateTime.UtcNow;

        // Deposit Refund Determination Engine: exclude RolledOver invoices and apply bulk discount fallback.
        var depositInvoice = conn.Invoices.FirstOrDefault(i => i.DepositAmount > 0);
        var count = Math.Max(1, order.Request?.ConnectionCount ?? 1);
        var discountPercent = FinancialConstants.GetBulkDiscountPercent(count);
        var depositGross = Math.Round(FinancialConstants.GetSecurityDeposit(conn.Type) * count, 2);
        var discountOnDeposit = Math.Round(depositGross * discountPercent / 100m, 2);
        decimal baseDeposit = depositInvoice != null
            ? depositInvoice.DepositAmount
            : depositGross - discountOnDeposit;

        decimal unpaidDues = conn.Invoices
            .Where(i => i.Status is "Unpaid" or "PartiallyPaid")
            .Sum(i => i.DueAmount);
        decimal damageFees = conn.Incidents.Where(i => !i.Settled).Sum(i => i.ReplacementFee);
        decimal netRefund = Math.Max(0m, Math.Round(baseDeposit - (unpaidDues + damageFees), 2));

        conn.RefundAmount = netRefund;
        conn.RefundStatus = netRefund > 0 ? "Pending" : "None";

        var note = input?.Note?.Trim();
        var auditNote = string.IsNullOrWhiteSpace(note)
            ? $"Technical terminated connection. Deposit: ${baseDeposit}, Liabilities: ${unpaidDues + damageFees}, Net Refund: ${netRefund} (Status: {conn.RefundStatus})"
            : $"Technical terminated connection ({note}). Deposit: ${baseDeposit}, Liabilities: ${unpaidDues + damageFees}, Net Refund: ${netRefund} (Status: {conn.RefundStatus})";

        order.History.Add(new OrderEvent
        {
            OrderId = order.Id,
            Status = order.Status,
            ActorId = actorId,
            At = DateTime.UtcNow,
            Note = auditNote
        });

        await operations.SaveChangesAsync();
        return ToLifecycleView(order);
    }

    // --- Group 3.2: 5-Criteria Advanced Search ---
    public async Task<IReadOnlyList<OrderView>> SearchOrdersAsync(
        string? code, string? customerName, string? serviceType, string? phone,
        string? fromDate, string? toDate, string? status)
    {
        if (code?.Length > 120 || customerName?.Length > 120 || phone?.Length > 120)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Search text is too long.");

        var normalizedServiceType = NormalizeServiceType(serviceType);
        var (fromUtc, toExclusiveUtc) = ParseSearchDateRangeUtc(fromDate, toDate);

        var orders = await operations.SearchOrdersAsync(code, customerName, normalizedServiceType, phone, fromUtc, toExclusiveUtc, status);
        return orders.Select(ToView).ToArray();
    }

    // --- Group 4.1: Customer Document Archival ---
    private const long MaxDocumentFileSizeBytes = 10L * 1024 * 1024;

    private static readonly Dictionary<string, string> CanonicalDocumentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["AddressProof"] = "AddressProof",
        ["RegistrationForm"] = "RegistrationForm",
        ["PaymentReceipt"] = "PaymentReceipt",
        ["Other"] = "Other"
    };

    private static readonly HashSet<string> AllowedDocumentExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".csv", ".doc", ".docx"
    };

    public async Task<CustomerDocumentView> RecordDocumentAsync(CustomerDocumentInput input, int actorId)
    {
        if (input.CustomerId < 1)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "CustomerId must be a positive integer.");

        var title = input.Title?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(title) || title.Length > 200)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Title is required and must be at most 200 characters.");

        var filePathOrUrl = input.FilePathOrUrl?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(filePathOrUrl) || filePathOrUrl.Length > 500)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "FilePathOrUrl is required and must be at most 500 characters.");
        ValidateDocumentFilePathOrUrl(filePathOrUrl);

        if (input.Year < 2000 || input.Year > 2100)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Year must be between 2000 and 2100.");

        var docTypeKey = input.DocumentType?.Trim() ?? "";
        if (!CanonicalDocumentTypes.TryGetValue(docTypeKey, out var canonicalDocType))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Invalid document type.");

        var cityCode = input.CityCode?.Trim() ?? "";
        if (!Regex.IsMatch(cityCode, "^[0-9]{3}$"))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "CityCode must be a 3-digit code.");

        var customer = await operations.FindCustomerAsync(input.CustomerId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Customer does not exist.");

        if (!await catalog.CityExistsAsync(cityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "City code does not exist.");

        var doc = new CustomerDocument
        {
            CustomerId = customer.Id,
            Customer = customer,
            DocumentType = canonicalDocType,
            Title = title,
            FilePathOrUrl = filePathOrUrl,
            Year = input.Year,
            CityCode = cityCode,
            UploadedAt = DateTime.UtcNow,
            UploadedById = actorId
        };

        operations.Add(doc);
        await operations.SaveChangesAsync();

        var actor = await operations.FindEmployeeByIdAsync(actorId);
        return ToDocumentView(doc, actor?.DisplayName ?? actor?.Username);
    }

    private static void ValidateDocumentFilePathOrUrl(string filePathOrUrl)
    {
        foreach (var ch in filePathOrUrl)
        {
            if (char.IsControl(ch) || ch == '\\')
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Document path or URL contains invalid characters.");
        }

        if (filePathOrUrl.StartsWith("//", StringComparison.Ordinal))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Protocol-relative URLs are not allowed.");

        if (Uri.TryCreate(filePathOrUrl, UriKind.Absolute, out var absUri))
        {
            if (!string.Equals(absUri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(absUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Only http or https document URLs are allowed.");

            if (string.IsNullOrEmpty(absUri.Host))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Document URL must specify a valid host.");

            var unescapedPath = Uri.UnescapeDataString(absUri.AbsolutePath);
            if (unescapedPath.Contains('\\') || unescapedPath.Any(char.IsControl))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Document URL path contains invalid characters.");

            var urlSegments = unescapedPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (urlSegments.Any(s => s is "." or ".."))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Document URL path cannot contain traversal segments.");

            var urlExt = Path.GetExtension(absUri.AbsolutePath);
            if (string.IsNullOrEmpty(urlExt) || !AllowedDocumentExtensions.Contains(urlExt))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Unsupported document file extension.");
            return;
        }

        var colonIndex = filePathOrUrl.IndexOf(':');
        var slashIndex = filePathOrUrl.IndexOf('/');
        if (colonIndex >= 0 && (slashIndex < 0 || colonIndex < slashIndex))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Invalid document path scheme.");

        if (filePathOrUrl.Contains('?') || filePathOrUrl.Contains('#'))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Relative document paths cannot contain query or fragment characters.");

        var relative = filePathOrUrl.StartsWith('/') ? filePathOrUrl[1..] : filePathOrUrl;
        if (string.IsNullOrWhiteSpace(relative))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Document path is required.");

        var segments = relative.Split('/', StringSplitOptions.None);
        if (segments.Any(s => string.IsNullOrEmpty(s) || s is "." or ".." || Uri.UnescapeDataString(s) is "." or ".." || s.Contains(':')))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Document path contains invalid or traversal segments.");

        var fileExt = Path.GetExtension(segments[^1]);
        if (string.IsNullOrEmpty(fileExt) || !AllowedDocumentExtensions.Contains(fileExt))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Unsupported document file extension.");
    }

    public async Task<CustomerDocumentView> UploadDocumentAsync(
        DocumentUploadRequest input,
        int actorId,
        CancellationToken cancellationToken = default)
    {
        if (input.CustomerId < 1)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "CustomerId must be a positive integer.");

        var title = input.Title?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(title) || title.Length > 200)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Title is required and must be at most 200 characters.");

        if (input.Year < 2000 || input.Year > 2100)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Year must be between 2000 and 2100.");

        var docTypeKey = input.DocumentType?.Trim() ?? "";
        if (!CanonicalDocumentTypes.TryGetValue(docTypeKey, out var canonicalDocType))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Invalid document type.");

        var cityCode = input.CityCode?.Trim() ?? "";
        if (!Regex.IsMatch(cityCode, "^[0-9]{3}$"))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "CityCode must be a 3-digit code.");

        if (string.IsNullOrWhiteSpace(input.FileName))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "A document file is required.");

        var ext = Path.GetExtension(input.FileName.Trim());
        if (string.IsNullOrEmpty(ext) || !AllowedDocumentExtensions.Contains(ext))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Unsupported document file extension.");

        if (input.FileSizeBytes <= 0)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Uploaded file cannot be empty.");

        if (input.FileSizeBytes > MaxDocumentFileSizeBytes)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Uploaded file exceeds maximum allowed size of 10 MB.");

        var customer = await operations.FindCustomerAsync(input.CustomerId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Customer does not exist.");

        if (!await catalog.CityExistsAsync(cityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "City code does not exist.");

        var stored = await documentStorage.SaveAsync(
            input.FileStream,
            input.FileName,
            input.ContentType,
            input.Year,
            cityCode,
            cancellationToken);

        var doc = new CustomerDocument
        {
            CustomerId = customer.Id,
            Customer = customer,
            DocumentType = canonicalDocType,
            Title = title,
            FilePathOrUrl = stored.RelativePath,
            OriginalFileName = stored.OriginalFileName,
            ContentType = stored.ContentType,
            FileSizeBytes = stored.FileSizeBytes,
            Year = input.Year,
            CityCode = cityCode,
            UploadedAt = DateTime.UtcNow,
            UploadedById = actorId
        };

        try
        {
            operations.Add(doc);
            await operations.SaveChangesAsync();
        }
        catch
        {
            await documentStorage.DeleteAsync(stored.RelativePath, CancellationToken.None);
            throw;
        }

        var actor = await operations.FindEmployeeByIdAsync(actorId);
        return ToDocumentView(doc, actor?.DisplayName ?? actor?.Username);
    }

    public async Task<IReadOnlyList<CustomerDocumentView>> DocumentsAsync(int? year, string? cityCode, int? customerId, string? documentType)
    {
        var normalizedDocType = documentType;
        if (!string.IsNullOrWhiteSpace(documentType)
            && !documentType.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase)
            && CanonicalDocumentTypes.TryGetValue(documentType.Trim(), out var canonical))
        {
            normalizedDocType = canonical;
        }

        var docs = await operations.ListDocumentsAsync(year, cityCode, customerId, normalizedDocType);
        return docs.Select(d => ToDocumentView(d)).ToArray();
    }

    public async Task<DocumentDownloadResult> OpenDocumentDownloadAsync(int id)
    {
        var doc = await operations.FindDocumentAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Document not found.");

        if (string.IsNullOrWhiteSpace(doc.OriginalFileName)
            || doc.FileSizeBytes is not > 0
            || string.IsNullOrWhiteSpace(doc.FilePathOrUrl))
        {
            throw new UseCaseException(UseCaseFailure.NotFound, "Stored document file not found.");
        }

        var stream = documentStorage.OpenRead(doc.FilePathOrUrl);
        if (stream is null)
            throw new UseCaseException(UseCaseFailure.NotFound, "Stored document file not found.");

        var contentType = string.IsNullOrWhiteSpace(doc.ContentType)
            ? "application/octet-stream"
            : doc.ContentType;

        return new DocumentDownloadResult(stream, doc.OriginalFileName, contentType);
    }

    private CustomerDocumentView ToDocumentView(CustomerDocument d, string? uploadedByName = null)
    {
        var hasStoredFile = !string.IsNullOrWhiteSpace(d.OriginalFileName)
            && d.FileSizeBytes is > 0
            && documentStorage.Exists(d.FilePathOrUrl);

        return new CustomerDocumentView(
            d.Id,
            d.CustomerId,
            d.Customer?.Name ?? "",
            d.DocumentType,
            d.Title,
            d.FilePathOrUrl,
            d.OriginalFileName,
            d.ContentType,
            d.FileSizeBytes,
            hasStoredFile,
            d.Year,
            d.CityCode,
            AsUtc(d.UploadedAt),
            d.UploadedById,
            uploadedByName ?? d.UploadedBy?.DisplayName ?? d.UploadedBy?.Username
        );
    }

    // --- Group 4.2: Plan Change Requests ---
    public async Task<PlanChangeRequestView> SubmitPlanChangeAsync(PlanChangeRequestInput input, int actorId)
    {
        var order = await operations.FindOrderWithConnectionByIdAsync(input.ConnectionId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Connection does not exist.");

        var conn = order.Connection!;
        if (conn.Status != "Active")
            throw new UseCaseException(UseCaseFailure.Conflict, "Only active connections can request plan changes.");

        var targetPlan = await catalog.FindPlanAsync(input.TargetPlanId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Target plan does not exist.");

        if (!targetPlan.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Selected plan is archived or inactive.");

        if (!string.Equals(targetPlan.Type, order.Request.Type, StringComparison.OrdinalIgnoreCase))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Target plan must match the connection's service type.");

        if (order.Request.PlanId == targetPlan.Id)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Target plan must be different from current plan.");

        if (await operations.HasPendingPlanChangeAsync(conn.Id))
            throw new UseCaseException(UseCaseFailure.Conflict, "A pending plan change request already exists for this connection.");

        var request = new PlanChangeRequest
        {
            ConnectionId = conn.Id,
            Connection = conn,
            TargetPlanId = targetPlan.Id,
            TargetPlan = targetPlan,
            RequestedById = actorId,
            RequestedAt = DateTime.UtcNow,
            Status = "Pending",
            Note = input.Note?.Trim()
        };

        operations.Add(request);
        await operations.SaveChangesAsync();

        return ToPlanChangeView(request, order);
    }

    public async Task<IReadOnlyList<PlanChangeRequestView>> PlanChangesAsync(string? status, long? connectionId)
    {
        var list = await operations.ListPlanChangesAsync(status, connectionId);
        if (list.Count == 0)
            return [];

        var connectionIds = list.Select(r => r.ConnectionId).Distinct().ToArray();
        var orders = await operations.ListOrdersByConnectionIdsAsync(connectionIds);
        var ordersByConnectionId = orders
            .Where(o => o.Connection != null)
            .ToDictionary(o => o.Connection!.Id);

        return list.Select(r => ToPlanChangeView(r, ordersByConnectionId.GetValueOrDefault(r.ConnectionId))).ToArray();
    }

    public async Task<PlanChangeRequestView> ApprovePlanChangeAsync(int id, int actorId)
    {
        var request = await operations.FindPlanChangeAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Plan change request not found.");

        if (request.Status != "Pending")
            throw new UseCaseException(UseCaseFailure.Conflict, "Request has already been reviewed.");

        var order = await operations.FindOrderWithConnectionByIdAsync(request.ConnectionId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Associated order not found.");

        var targetPlan = await catalog.FindPlanAsync(request.TargetPlanId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Target plan not found.");

        if (order.Connection?.Status != "Active")
            throw new UseCaseException(UseCaseFailure.Conflict, "Only active connections can approve plan changes.");

        if (!targetPlan.Active)
            throw new UseCaseException(UseCaseFailure.Conflict, "Target plan is archived or inactive.");

        if (!string.Equals(targetPlan.Type, order.Request.Type, StringComparison.OrdinalIgnoreCase))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Target plan must match the connection's service type.");

        request.Status = "Approved";
        request.ReviewedById = actorId;
        request.ReviewedAt = DateTime.UtcNow;

        order.Request.PlanId = targetPlan.Id;
        order.Request.Plan = targetPlan;
        order.Request.PlanName = targetPlan.Name;
        order.Request.SnapshotPrice = targetPlan.Price;

        order.History.Add(new OrderEvent
        {
            OrderId = order.Id,
            Status = order.Status,
            ActorId = actorId,
            At = DateTime.UtcNow,
            Note = $"Staff approved plan change to {targetPlan.Name} (${targetPlan.Price:F2})."
        });

        await operations.SaveChangesAsync();

        var actor = await operations.FindEmployeeByIdAsync(actorId);
        return ToPlanChangeView(request, order, actor?.DisplayName ?? actor?.Username);
    }

    public async Task<PlanChangeRequestView> RejectPlanChangeAsync(int id, RejectPlanChangeInput? input, int actorId)
    {
        var request = await operations.FindPlanChangeAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Plan change request not found.");

        if (request.Status != "Pending")
            throw new UseCaseException(UseCaseFailure.Conflict, "Request has already been reviewed.");

        request.Status = "Rejected";
        if (!string.IsNullOrWhiteSpace(input?.Note))
            request.Note = input.Note.Trim();
        request.ReviewedById = actorId;
        request.ReviewedAt = DateTime.UtcNow;

        var order = await operations.FindOrderWithConnectionByIdAsync(request.ConnectionId);
        if (order != null)
        {
            var eventNote = string.IsNullOrWhiteSpace(request.Note)
                ? "Staff rejected plan change."
                : $"Staff rejected plan change: {request.Note}";
            if (eventNote.Length > 500)
                eventNote = eventNote[..500];

            order.History.Add(new OrderEvent
            {
                OrderId = order.Id,
                Status = order.Status,
                ActorId = actorId,
                At = DateTime.UtcNow,
                Note = eventNote
            });
        }

        await operations.SaveChangesAsync();

        var actor = await operations.FindEmployeeByIdAsync(actorId);
        return ToPlanChangeView(request, order, actor?.DisplayName ?? actor?.Username);
    }

    internal static PlanChangeRequestView ToPlanChangeView(PlanChangeRequest r, ServiceOrder? order, string? reviewedByName = null)
    {
        var req = order?.Request;
        var currentPrice = req is null
            ? 0m
            : (req.SnapshotPrice > 0 ? req.SnapshotPrice : req.Plan?.Price ?? 0m);

        return new PlanChangeRequestView(
            r.Id,
            r.ConnectionId,
            r.Connection?.AccountId ?? order?.Connection?.AccountId,
            req?.Customer?.Name ?? "",
            req?.Type ?? r.Connection?.Type ?? "",
            req?.PlanId ?? 0,
            req?.PlanName ?? "",
            currentPrice,
            r.TargetPlanId,
            r.TargetPlan?.Name ?? "",
            r.TargetPlan?.Price ?? 0m,
            AsUtc(r.RequestedAt),
            r.Status,
            r.Note,
            r.ReviewedById,
            reviewedByName ?? r.ReviewedBy?.DisplayName ?? r.ReviewedBy?.Username,
            r.ReviewedAt.HasValue ? AsUtc(r.ReviewedAt.Value) : null,
            r.RequestedById
        );
    }

    // --- Group 4.3: Customer Queries & Dynamic FAQ Catalog ---
    private static readonly HashSet<string> ValidQueryCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Billing", "Technical", "Plan", "General"
    };

    public async Task<CustomerQueryView> CreateQueryAsync(CustomerQueryInput input, int actorId)
    {
        if (string.IsNullOrWhiteSpace(input.Subject))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Subject is required.");

        if (string.IsNullOrWhiteSpace(input.Question))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Question is required.");

        if (input.Question.Length > 1000)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Question text exceeds maximum length.");

        if (!ValidQueryCategories.Contains(input.Category.Trim()))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Invalid category.");

        var customer = await operations.FindCustomerAsync(input.CustomerId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Customer does not exist.");

        var query = new CustomerQuery
        {
            CustomerId = customer.Id,
            Customer = customer,
            Subject = input.Subject.Trim(),
            Category = input.Category.Trim(),
            Question = input.Question.Trim(),
            Status = "Open",
            CreatedAt = DateTime.UtcNow,
            CreatedById = actorId
        };

        operations.Add(query);
        await operations.SaveChangesAsync();

        return ToQueryView(query);
    }

    public async Task<IReadOnlyList<CustomerQueryView>> QueriesAsync(string? status, string? category, int? customerId)
    {
        var queries = await operations.ListQueriesAsync(status, category, customerId);
        return queries.Select(q => ToQueryView(q)).ToArray();
    }

    public async Task<CustomerQueryView> AnswerQueryAsync(int id, AnswerQueryInput input, int actorId)
    {
        if (string.IsNullOrWhiteSpace(input.Answer))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Answer is required.");

        var query = await operations.FindQueryAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Query not found.");

        if (query.Status == "Closed")
            throw new UseCaseException(UseCaseFailure.Conflict, "Closed inquiries cannot be re-answered.");

        query.Status = "Answered";
        query.Answer = input.Answer.Trim();
        query.AnsweredAt = DateTime.UtcNow;
        query.AnsweredById = actorId;
        query.IsFaq = input.IsFaq;

        await operations.SaveChangesAsync();

        var actor = await operations.FindEmployeeByIdAsync(actorId);
        return ToQueryView(query, actor?.DisplayName ?? actor?.Username);
    }

    public async Task<CustomerQueryView> CloseQueryAsync(int id, int actorId)
    {
        var query = await operations.FindQueryAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Query not found.");

        if (query.Status != "Closed")
        {
            query.Status = "Closed";
            query.ClosedById = actorId;
            query.ClosedAt = DateTime.UtcNow;
            await operations.SaveChangesAsync();
        }

        return ToQueryView(query);
    }

    internal static CustomerQueryView ToQueryView(CustomerQuery q, string? answeredByName = null) =>
        new(
            q.Id,
            q.CustomerId,
            q.Customer?.Name ?? "",
            q.Subject,
            q.Category,
            q.Question,
            q.Answer,
            q.Status,
            AsUtc(q.CreatedAt),
            q.AnsweredAt.HasValue ? AsUtc(q.AnsweredAt.Value) : null,
            q.AnsweredById,
            answeredByName ?? q.AnsweredBy?.DisplayName ?? q.AnsweredBy?.Username,
            q.IsFaq,
            q.CreatedById,
            q.ClosedAt.HasValue ? AsUtc(q.ClosedAt.Value) : null,
            q.ClosedById
        );

    public async Task<IReadOnlyList<FaqItemView>> FaqCatalogAsync(string? category)
    {
        var queries = await operations.ListFaqCatalogAsync(category);
        return queries.Select(q => new FaqItemView(
            q.Id,
            q.Category,
            q.Subject,
            q.Question,
            q.Answer!
        )).ToArray();
    }

    internal static ConnectionLifecycleView ToLifecycleView(ServiceOrder order)
    {
        var conn = order.Connection!;
        return new ConnectionLifecycleView(
            conn.Id,
            conn.AccountId,
            order.Id,
            conn.Type,
            conn.CityCode,
            conn.Status,
            conn.SuspendReason,
            conn.SuspendedAt.HasValue ? AsUtc(conn.SuspendedAt.Value) : null,
            conn.TerminatedAt.HasValue ? AsUtc(conn.TerminatedAt.Value) : null,
            conn.RefundStatus,
            conn.RefundAmount,
            order.Request.Customer.Name,
            order.Request.Customer.Phone,
            order.Request.PlanName,
            AsUtc(conn.ActivatedAt)
        );
    }


    private async Task<ServiceOrder> FindOrderAsync(string code)
    {
        var number = OrderNumber.Parse(code);
        if (number is null) throw new UseCaseException(UseCaseFailure.NotFound);
        return await operations.FindOrderAsync(number.Value) ?? throw new UseCaseException(UseCaseFailure.NotFound);
    }

    private async Task EnsureCityExistsAsync(string code)
    {
        if (!await catalog.CityExistsAsync(code))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city.");
    }

    internal static CustomerView ToView(Customer customer) =>
        new(customer.Id, customer.Code, customer.Name, customer.Phone, customer.Address, customer.CityCode,
            customer.TaxId, customer.Email, customer.ContactPerson, customer.CustomerType, customer.Status ?? "ACTIVE");

    internal static RequestView ToView(ServiceRequest request) =>
        new(request.Id, request.CustomerId, request.Customer.Name, request.PlanId, request.PlanName,
            request.Type, request.CityCode, request.Address, request.HasNexusLandline,
            request.SnapshotPrice > 0 ? request.SnapshotPrice : request.Plan.Price, AsUtc(request.CreatedAt),
            request.ConnectionCount >= 1 ? request.ConnectionCount : 1, request.Customer?.Phone);

    internal static OrderView ToView(ServiceOrder order) =>
        new(order.Code, order.RequestId, order.Status.ToString(), ToView(order.Request), AsUtc(order.CreatedAt),
            order.Connection?.AccountId, order.Connection is null ? null : AsUtc(order.Connection.ActivatedAt),
            order.Connection?.AssignedProductId);

    internal static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
