using Nexus.Application;

namespace Nexus.Api.Endpoints;

/// <summary>Anonymous Zero-PII endpoints for public order/account tracking and active service plan catalog.</summary>
public static class PublicEndpoints
{
    /// <summary>Maps public tracking and public tariff catalog routes without exposing subscriber PII.</summary>
    public static void MapPublic(this RouteGroupBuilder api)
    {
        api.MapGet("/public/track/order/{code}", async (string code, IOperationsStore operations) =>
        {
            var number = Nexus.Domain.OrderNumber.Parse(code);
            if (number is null) return Results.NotFound();

            var order = await operations.FindOrderAsync(number.Value);
            if (order is null) return Results.NotFound();

            return Results.Ok(new
            {
                type = "order",
                id = order.Code,
                serviceType = ServiceType(order.Request.Type),
                status = order.Status.ToString(),
                cityCode = order.Request.CityCode,
                accountId = order.Connection?.AccountId,
                orderId = order.Code
            });
        });

        api.MapGet("/public/track/account/{accountId}", async (string accountId, IOperationsStore operations, IBillingStore bills) =>
        {
            var order = await operations.FindOrderByAccountIdAsync(accountId);
            if (order is null) return Results.NotFound();

            var invoices = await bills.ListInvoicesAsync(order.Connection!.Id);
            var dueAmount = invoices
                .Where(i => i.Status is "Unpaid" or "PartiallyPaid")
                .Sum(i => i.DueAmount);

            return Results.Ok(new
            {
                type = "account",
                id = order.Connection.AccountId,
                orderId = order.Code,
                serviceType = ServiceType(order.Request.Type),
                status = order.Status == Nexus.Domain.OrderStatus.Connected
                    ? order.Connection.Status
                    : order.Status.ToString(),
                cityCode = order.Request.CityCode,
                accountId = order.Connection.AccountId,
                dueAmount
            });
        });

        api.MapGet("/public/plans", (CatalogService catalog) =>
            catalog.PlansAsync(includeInactive: false));

        api.MapGet("/public/cities", (CatalogService catalog) =>
            catalog.CitiesAsync());

        api.MapPost("/register", async (RegisterCustomerInput input, CustomerPortalService portal, HttpContext context) =>
        {
            var outcome = await portal.RegisterAsync(input);
            await StaffEndpoints.SignInUserAsync(context, outcome.Employee);
            return Results.Json(outcome.View, statusCode: 201);
        }).RequireRateLimiting("login");
    }

    private static string ServiceType(string type) => type switch
    {
        "D" => "DIAL_UP",
        "T" => "LANDLINE",
        _ => "BROADBAND"
    };
}
