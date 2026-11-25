using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

/// <summary>Minimal API endpoints for Billing department invoicing/refunds and Retail in-store payments.</summary>
public static class BillingEndpoints
{
    /// <summary>Maps billing account lookup, invoice creation, payment collection, and deposit refund routes.</summary>
    public static void MapBilling(this RouteGroupBuilder api)
    {
        var billing = api.MapGroup("/billing/accounts")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Billing));

        billing.MapGet("", (string? q, string? status, string? cityCode, BillingService service) =>
            service.ListAsync(q, status, cityCode));
        billing.MapGet("/{accountId}", (string accountId, BillingService service) =>
            service.FindAsync(accountId));
        billing.MapPost("/{accountId}", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<CreateInvoiceInput>(http, cancellationToken);
            if (!ok) return error!;
            return Results.Ok(await service.CreateAsync(accountId, input, EndpointHelpers.ActorId(user)));
        });
        billing.MapPost("/{accountId}/payment", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<RecordPaymentInput>(http, cancellationToken);
            if (!ok) return error!;
            return Results.Ok(await service.PayAsync(accountId, input, EndpointHelpers.ActorId(user), "CityOffice"));
        });
        billing.MapPost("/{accountId}/refund", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<RefundDepositInput>(http, cancellationToken);
            if (!ok) return error!;
            return Results.Problem("Refund through /api/deposits/{orderId}/refunds with amount, operationId, method, reference and note.", statusCode: 409);
        });

        var retailBilling = api.MapGroup("/retail/billing/accounts")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Retail));

        retailBilling.MapGet("", (string? q, string? status, string? cityCode, BillingService service) =>
            service.ListAsync(q, status, cityCode));
        retailBilling.MapGet("/{accountId}", (string accountId, BillingService service) =>
            service.FindAsync(accountId));
        retailBilling.MapPost("/{accountId}/payment", async (string accountId, HttpContext http, BillingService service, ClaimsPrincipal user, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<RecordPaymentInput>(http, cancellationToken);
            if (!ok) return error!;
            return Results.Ok(await service.PayAsync(accountId, input, EndpointHelpers.ActorId(user), "RetailOutlet"));
        });
    }
}
