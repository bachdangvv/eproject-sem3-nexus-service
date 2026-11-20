using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

public static class BillingEndpoints
{
    public static void MapBilling(this RouteGroupBuilder api)
    {
        var billing = api.MapGroup("/billing/accounts")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Billing));

        billing.MapGet("", (string? q, string? status, string? cityCode, BillingService service) =>
            service.ListAsync(q, status, cityCode));
        billing.MapGet("/{accountId}", (string accountId, BillingService service) =>
            service.FindAsync(accountId));
        billing.MapPost("/{accountId}", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user) =>
        {
            CreateInvoiceInput? input = http.Request.HasJsonContentType() && http.Request.ContentLength > 0
                ? await http.Request.ReadFromJsonAsync<CreateInvoiceInput>()
                : null;
            return await service.CreateAsync(accountId, input, int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!));
        });
        billing.MapPost("/{accountId}/payment", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user) =>
        {
            RecordPaymentInput? input = http.Request.HasJsonContentType() && http.Request.ContentLength > 0
                ? await http.Request.ReadFromJsonAsync<RecordPaymentInput>()
                : null;
            return await service.PayAsync(accountId, input, int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!), "CityOffice");
        });

        var retailBilling = api.MapGroup("/retail/billing/accounts")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Retail));

        retailBilling.MapGet("", (string? q, string? status, string? cityCode, BillingService service) =>
            service.ListAsync(q, status, cityCode));
        retailBilling.MapGet("/{accountId}", (string accountId, BillingService service) =>
            service.FindAsync(accountId));
        retailBilling.MapPost("/{accountId}/payment", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user) =>
        {
            RecordPaymentInput? input = http.Request.HasJsonContentType() && http.Request.ContentLength > 0
                ? await http.Request.ReadFromJsonAsync<RecordPaymentInput>()
                : null;
            return await service.PayAsync(accountId, input, int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!), "RetailOutlet");
        });
    }
}
