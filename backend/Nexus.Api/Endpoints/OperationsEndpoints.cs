using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

public static class OperationsEndpoints
{
    public static void MapOperations(this RouteGroupBuilder api)
    {
        var retail = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Retail));
        var operations = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Retail, Roles.Technical));
        var technical = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Technical));

        retail.MapGet("/customers", (string? q, OperationsService service) => service.CustomersAsync(q));
        retail.MapPost("/customers", async (CustomerInput input, OperationsService service) =>
            Results.Json(await service.CreateCustomerAsync(input), statusCode: 201));
        retail.MapPut("/customers/{id:int}", (int id, CustomerInput input, OperationsService service) =>
            service.UpdateCustomerAsync(id, input));
        retail.MapGet("/requests", (OperationsService service) => service.PendingRequestsAsync());
        retail.MapPost("/requests", async (RequestInput input, OperationsService service, ClaimsPrincipal actor) =>
            Results.Json(await service.CreateRequestAsync(input, ActorId(actor)), statusCode: 201));
        retail.MapPost("/requests/{id:int}/confirm", async (int id, OperationsService service, ClaimsPrincipal actor) =>
            CreatedOrExisting(await service.ConfirmAsync(id, ActorId(actor))));
        retail.MapPost("/orders/{code}/feedback", async (string code, FeedbackInput input, OperationsService service, ClaimsPrincipal actor) =>
            Results.Json(await service.RecordFeedbackAsync(code, input, ActorId(actor)), statusCode: 201));

        operations.MapGet("/orders", (string? code, string? status, OperationsService service) => service.OrdersAsync(code, status));
        operations.MapGet("/orders/{code}", (string code, OperationsService service) => service.DetailAsync(code));

        technical.MapPost("/orders/{code}/assessment", (string code, AssessmentInput input, OperationsService service, ClaimsPrincipal actor) =>
            service.AssessAsync(code, input, ActorId(actor)));
        technical.MapPost("/orders/{code}/connection", async (string code, OperationsService service, ClaimsPrincipal actor) =>
            CreatedOrExisting(await service.ConnectAsync(code, ActorId(actor))));
    }

    private static int ActorId(ClaimsPrincipal actor) => int.Parse(actor.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static IResult CreatedOrExisting(Creation<OrderView> result) =>
        result.Created ? Results.Json(result.Value, statusCode: 201) : Results.Ok(result.Value);
}
