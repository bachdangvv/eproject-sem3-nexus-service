using Nexus.Application;

namespace Nexus.Api.Endpoints;

public static class PublicEndpoints
{
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
                serviceType = order.Request.Type,
                status = order.Status.ToString(),
                cityCode = order.Request.CityCode,
                route = order.Request.Address,
                customerName = order.Request.Customer.Name,
                accountId = order.Connection?.AccountId,
                orderId = order.Code
            });
        });

        api.MapGet("/public/track/account/{accountId}", async (string accountId, IOperationsStore operations) =>
        {
            var order = await operations.FindOrderByAccountIdAsync(accountId);
            if (order is null) return Results.NotFound();

            return Results.Ok(new
            {
                type = "account",
                id = order.Connection!.AccountId,
                orderId = order.Code,
                serviceType = order.Request.Type,
                status = order.Status == Nexus.Domain.OrderStatus.Connected ? "ACTIVE" : order.Status.ToString(),
                cityCode = order.Request.CityCode,
                route = order.Request.Address,
                customerName = order.Request.Customer.Name,
                accountId = order.Connection.AccountId
            });
        });
    }
}
