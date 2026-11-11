using Nexus.Domain;

namespace Nexus.Application;

public sealed record CityView(string Code, string Name);
public sealed record PlanView(int Id, string Name, string Type, string Description, decimal Price, bool Active);
public sealed record ProductView(int Id, string Name, string Description, bool Active);

public sealed class CatalogService(ICatalogStore store)
{
    public async Task<IReadOnlyList<CityView>> CitiesAsync() =>
        (await store.ListCitiesAsync()).Select(city => new CityView(city.Code, city.Name)).ToArray();

    public async Task<CityView> CreateCityAsync(CityInput input)
    {
        const string duplicate = "This city code already exists.";
        if (await store.CityExistsAsync(input.Code))
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        var city = new City { Code = input.Code, Name = input.Name.Trim() };
        store.Add(city);
        try { await store.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            if (!await store.CityExistsAsync(input.Code)) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }
        return new CityView(city.Code, city.Name);
    }

    public async Task<IReadOnlyList<PlanView>> PlansAsync(bool includeInactive) =>
        (await store.ListPlansAsync(includeInactive)).Select(ToView).ToArray();

    public async Task<PlanView> CreatePlanAsync(PlanInput input)
    {
        ValidatePrice(input.Price);
        var plan = new ServicePlan
        {
            Name = input.Name.Trim(), Type = input.Type, Description = input.Description?.Trim() ?? "",
            Price = input.Price, Active = input.Active
        };
        store.Add(plan);
        await store.SaveChangesAsync();
        return ToView(plan);
    }

    public async Task<PlanView> UpdatePlanAsync(int id, PlanInput input)
    {
        ValidatePrice(input.Price);
        var plan = await FindPlanAsync(id);
        plan.Name = input.Name.Trim();
        plan.Type = input.Type;
        plan.Description = input.Description?.Trim() ?? "";
        plan.Price = input.Price;
        plan.Active = input.Active;
        await store.SaveChangesAsync();
        return ToView(plan);
    }

    public async Task ArchivePlanAsync(int id)
    {
        // Preserve the catalog reference for previously filed requests.
        var plan = await FindPlanAsync(id);
        plan.Active = false;
        await store.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<ProductView>> ProductsAsync() =>
        (await store.ListProductsAsync()).Select(ToView).ToArray();

    public async Task<ProductView> CreateProductAsync(ProductInput input)
    {
        var product = new Product { Name = input.Name.Trim(), Description = input.Description?.Trim() ?? "", Active = input.Active };
        store.Add(product);
        await store.SaveChangesAsync();
        return ToView(product);
    }

    public async Task<ProductView> UpdateProductAsync(int id, ProductInput input)
    {
        var product = await FindProductAsync(id);
        product.Name = input.Name.Trim();
        product.Description = input.Description?.Trim() ?? "";
        product.Active = input.Active;
        await store.SaveChangesAsync();
        return ToView(product);
    }

    public async Task ArchiveProductAsync(int id)
    {
        var product = await FindProductAsync(id);
        product.Active = false;
        await store.SaveChangesAsync();
    }

    private async Task<ServicePlan> FindPlanAsync(int id) =>
        await store.FindPlanAsync(id) ?? throw new UseCaseException(UseCaseFailure.NotFound);

    private async Task<Product> FindProductAsync(int id) =>
        await store.FindProductAsync(id) ?? throw new UseCaseException(UseCaseFailure.NotFound);

    private static void ValidatePrice(decimal price)
    {
        if (decimal.Round(price, 2) != price)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Enter a price with up to two decimal places.");
    }

    private static PlanView ToView(ServicePlan plan) =>
        new(plan.Id, plan.Name, plan.Type, plan.Description, plan.Price, plan.Active);

    private static ProductView ToView(Product product) =>
        new(product.Id, product.Name, product.Description, product.Active);
}
