using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

public static class CatalogEndpoints
{
    public static void MapCatalog(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Admin));
        api.MapGet("/cities", (CatalogService service) => service.CitiesAsync()).RequireAuthorization();
        api.MapGet("/plans", (CatalogService service, ClaimsPrincipal user) =>
            service.PlansAsync(user.IsInRole(Roles.Admin))).RequireAuthorization();

        admin.MapPost("/cities", async (CityInput input, CatalogService service) =>
            Results.Json(await service.CreateCityAsync(input), statusCode: 201));
        admin.MapPost("/plans", async (PlanInput input, CatalogService service) =>
            Results.Json(await service.CreatePlanAsync(input), statusCode: 201));
        admin.MapPut("/plans/{id:int}", (int id, PlanInput input, CatalogService service) =>
            service.UpdatePlanAsync(id, input));
        admin.MapDelete("/plans/{id:int}", async (int id, CatalogService service) =>
        {
            await service.ArchivePlanAsync(id);
            return Results.NoContent();
        });

        admin.MapGet("/products", (CatalogService service) => service.ProductsAsync());
        admin.MapPost("/products", async (ProductInput input, CatalogService service) =>
            Results.Json(await service.CreateProductAsync(input), statusCode: 201));
        admin.MapPut("/products/{id:int}", (int id, ProductInput input, CatalogService service) =>
            service.UpdateProductAsync(id, input));
        admin.MapDelete("/products/{id:int}", async (int id, CatalogService service) =>
        {
            await service.ArchiveProductAsync(id);
            return Results.NoContent();
        });
    }
}
