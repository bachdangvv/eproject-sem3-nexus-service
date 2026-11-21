using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

/// <summary>Minimal API endpoints for Customer Portal self-service operations.</summary>
public static class CustomerEndpoints
{
    /// <summary>Maps owner-scoped customer profile, request, order, billing, plan-change, and query endpoints.</summary>
    public static void MapCustomer(this RouteGroupBuilder api)
    {
        var customer = api.MapGroup("/customer")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Customer));

        customer.MapGet("/profile", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.ProfileAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapPut("/profile", (CustomerProfileInput input, CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.UpdateProfileAsync(EndpointHelpers.ActorId(user), input);
        });

        customer.MapGet("/requests", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.RequestsAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapPost("/requests", async (CustomerRequestInput input, CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return Results.Json(await service.CreateRequestAsync(EndpointHelpers.ActorId(user), input), statusCode: 201);
        });

        customer.MapGet("/orders", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.OrdersAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapGet("/orders/{code}", (string code, CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.OrderDetailAsync(EndpointHelpers.ActorId(user), code);
        });

        customer.MapPost("/orders/{code}/feedback", async (string code, FeedbackInput input, CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return Results.Json(await service.RecordFeedbackAsync(EndpointHelpers.ActorId(user), code, input), statusCode: 201);
        });

        customer.MapGet("/connections", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.ConnectionsAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapGet("/billing", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.BillingAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapPost("/billing/{accountId}/payments", async (
            string accountId,
            HttpContext httpContext,
            CustomerPortalService service,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<CustomerPaymentInput>(httpContext, cancellationToken);
            if (!ok) return error!;
            return Results.Json(await service.PayOnlineAsync(EndpointHelpers.ActorId(user), accountId, input), statusCode: 201);
        });

        customer.MapGet("/plan-changes", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.PlanChangesAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapPost("/plan-changes", async (PlanChangeRequestInput input, CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return Results.Json(await service.SubmitPlanChangeAsync(EndpointHelpers.ActorId(user), input), statusCode: 201);
        });

        customer.MapGet("/queries", (CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return service.QueriesAsync(EndpointHelpers.ActorId(user));
        });

        customer.MapPost("/queries", async (CustomerSelfQueryInput input, CustomerPortalService service, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.CustomerId(user);
            return Results.Json(await service.CreateQueryAsync(EndpointHelpers.ActorId(user), input), statusCode: 201);
        });
    }
}
