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
        billing.MapGet("/{accountId}", (string accountId, BillingService service) => service.FindAsync(accountId));
        billing.MapPost("/{accountId}", (string accountId, BillingService service) => service.CreateAsync(accountId));
        billing.MapPost("/{accountId}/payment", (string accountId, BillingService service, ClaimsPrincipal user) =>
            service.PayAsync(accountId, int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!)));
    }
}
