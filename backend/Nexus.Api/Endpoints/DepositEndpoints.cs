using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

public static class DepositEndpoints
{
    public static void MapDeposits(this RouteGroupBuilder api)
    {
        var staff = api.MapGroup("/deposits").RequireAuthorization(p => p.RequireRole(Roles.Staff));
        staff.MapGet("", (string? q, DepositService service) => service.ListAsync(q));
        staff.MapGet("/{code}", (string code, DepositService service) => service.FindAsync(code));
        staff.MapPost("/{code}/collections", (string code, DepositMoneyInput input, ClaimsPrincipal user, DepositService service) =>
            service.PostAsync(code, input, EndpointHelpers.ActorId(user), false))
            .RequireAuthorization(p => p.RequireRole(Roles.Retail, Roles.Billing));
        staff.MapPost("/{code}/refunds", (string code, DepositMoneyInput input, ClaimsPrincipal user, DepositService service) =>
            service.PostAsync(code, input, EndpointHelpers.ActorId(user), true))
            .RequireAuthorization(p => p.RequireRole(Roles.Billing));
        staff.MapPost("/{code}/reconcile", (string code, ReconcileDepositInput input, ClaimsPrincipal user, DepositService service) =>
            service.ReconcileAsync(code, input, EndpointHelpers.ActorId(user)))
            .RequireAuthorization(p => p.RequireRole(Roles.Billing));

        // Resolve ownership from the authenticated actor. Customers cannot supply another customer's ID.
        api.MapGet("/customer/deposits", async (ClaimsPrincipal user, CustomerPortalService portal, DepositService service) =>
        {
            var profile = await portal.ProfileAsync(EndpointHelpers.ActorId(user));
            return await service.ListAsync(null, profile.Id);
        }).RequireAuthorization(p => p.RequireRole(Roles.Customer));
    }
}
