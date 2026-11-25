using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

public static class AdvanceEndpoints
{
    public static void MapAdvances(this RouteGroupBuilder api)
    {
        var staff = api.MapGroup("/advances").RequireAuthorization(p => p.RequireRole(Roles.Staff));
        staff.MapGet("", (string? q, AdvanceService service) => service.ListAsync(q));
        staff.MapGet("/{code}", (string code, AdvanceService service) => service.FindAsync(code));
        staff.MapPost("/{code}/collections", (string code, DepositMoneyInput input, ClaimsPrincipal user, AdvanceService service) =>
            service.CollectAsync(code, input, EndpointHelpers.ActorId(user)))
            .RequireAuthorization(p => p.RequireRole(Roles.Retail, Roles.Billing));
        staff.MapPost("/{code}/allocations", (string code, AllocateAdvanceInput input, ClaimsPrincipal user, AdvanceService service) =>
            service.AllocateAsync(code, input, EndpointHelpers.ActorId(user)))
            .RequireAuthorization(p => p.RequireRole(Roles.Billing));
        staff.MapPost("/{code}/refunds", (string code, DepositMoneyInput input, ClaimsPrincipal user, AdvanceService service) =>
            service.RefundAsync(code, input, EndpointHelpers.ActorId(user)))
            .RequireAuthorization(p => p.RequireRole(Roles.Billing));
        api.MapGet("/customer/advances", async (ClaimsPrincipal user, CustomerPortalService portal, AdvanceService service) =>
        {
            var customer = await portal.ProfileAsync(EndpointHelpers.ActorId(user));
            return await service.ListAsync(null, customer.Id);
        }).RequireAuthorization(p => p.RequireRole(Roles.Customer));
    }
}
