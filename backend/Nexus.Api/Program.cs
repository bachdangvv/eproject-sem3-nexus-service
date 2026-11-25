using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Nexus.Api;
using Nexus.Api.Endpoints;
using Nexus.Application;
using Nexus.Infrastructure;

// Configure ASP.NET Core services: ProblemDetails, Antiforgery CSRF, Cookie Auth, and Rate Limiting.
var demo = args.Contains("--demo");
var builder = WebApplication.CreateBuilder(args.Where(argument => argument != "--demo").ToArray());
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddValidation();
builder.Services.AddAntiforgery(options => options.HeaderName = "X-CSRF-Token");
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 12 * 1024 * 1024;
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "Nexus.Session";
    options.Cookie.SecurePolicy = demo ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IDocumentStorage, LocalDocumentStorage>();
builder.Services.AddScoped<StaffService>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<OperationsService>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<CustomerPortalService>();
builder.Services.AddScoped<DepositService>();
builder.Services.AddScoped<AdvanceService>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromMinutes(1) }));
});
if (demo)
{
    var keyDirectory = Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "data", "demo-keys"));
    builder.Services.AddDataProtection().SetApplicationName("Nexus Demo").PersistKeysToFileSystem(keyDirectory);
    var demoPath = Path.Combine(builder.Environment.ContentRootPath, "demo.db");
    builder.Services.AddNexusInfrastructure(true,
        builder.Configuration.GetConnectionString("Demo") ?? $"Data Source={demoPath};Foreign Keys=True");
}
else
{
    var sql = builder.Configuration.GetConnectionString("Nexus");
    if (string.IsNullOrWhiteSpace(sql))
        throw new InvalidOperationException("Set ConnectionStrings__Nexus or run the local demo with --demo.");
    builder.Services.AddNexusInfrastructure(false, sql);
}

var app = builder.Build();
app.Services.InitializeNexusDatabase(demo ? null : app.Configuration["NexusBootstrapPassword"]);

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Enforce X-CSRF-Token validation on all non-GET /api routes and expose session/endpoint groups.
var api = app.MapGroup("/api");
api.AddEndpointFilter(async (context, next) =>
{
    var request = context.HttpContext.Request;
    if (!HttpMethods.IsGet(request.Method))
    {
        var tokens = context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await tokens.IsRequestValidAsync(context.HttpContext))
            return Results.Problem("Refresh the session and try again.", statusCode: 400);
    }
    return await next(context);
});
api.MapGet("/session", (HttpContext context, IAntiforgery tokens) =>
{
    int? customerId = int.TryParse(
        context.User.FindFirstValue("customerId"),
        NumberStyles.None,
        CultureInfo.InvariantCulture,
        out var parsedCustomerId) && parsedCustomerId > 0
        ? parsedCustomerId
        : null;
    return new
    {
        csrfToken = tokens.GetAndStoreTokens(context).RequestToken,
        username = context.User.FindFirstValue(ClaimTypes.Name),
        displayName = context.User.FindFirstValue("displayName"),
        role = context.User.FindFirstValue(ClaimTypes.Role),
        customerId,
        customerCode = context.User.FindFirstValue("customerCode")
    };
});
api.MapStaff();
api.MapCatalog();
api.MapOperations();
api.MapBilling();
api.MapInventory();
api.MapPublic();
api.MapCustomer();
api.MapDeposits();
api.MapAdvances();
app.Run();
