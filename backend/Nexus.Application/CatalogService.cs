using Nexus.Domain;

namespace Nexus.Application;

public sealed record CityView(string Code, string Name);
public sealed record PlanView(
    int Id,
    string Name,
    string Type,
    string Description,
    decimal Price,
    bool Active,
    decimal LocalCallRate = 0m,
    decimal StdCallRate = 0m,
    decimal MobileMsgRate = 0m,
    int ValidityMonths = 1,
    int? HoursAllowance = null,
    int? SpeedKbps = null,
    decimal? AdvancePerConnection = null);
public sealed record ProductView(int Id, string Name, string Description, bool Active, int QuantityInStock, decimal ReplacementPrice);

/// <summary>Application service managing cities, service plans, and equipment product catalog entries.</summary>
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

    public async Task<CityView> UpdateCityAsync(string code, CityUpdateInput input)
    {
        var normalizedCode = code.Trim();
        var city = await store.FindCityAsync(normalizedCode)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "City not found.");

        city.Name = input.Name.Trim();
        await store.SaveChangesAsync();
        return new CityView(city.Code, city.Name);
    }

    public async Task<IReadOnlyList<PlanView>> PlansAsync(bool includeInactive) =>
        (await store.ListPlansAsync(includeInactive)).Select(ToView).ToArray();

    public async Task<PlanView> CreatePlanAsync(PlanInput input)
    {
        ValidatePrice(input.Price);
        ValidatePrice(input.LocalCallRate);
        ValidatePrice(input.StdCallRate);
        ValidatePrice(input.MobileMsgRate);
        ValidateValidityMonths(input.ValidityMonths);
        if (input.AdvancePerConnection is { } advance) ValidatePrice(advance);
        var plan = new ServicePlan
        {
            Name = input.Name.Trim(),
            Type = input.Type,
            Description = input.Description?.Trim() ?? "",
            Price = input.Price,
            Active = input.Active,
            LocalCallRate = input.LocalCallRate,
            StdCallRate = input.StdCallRate,
            MobileMsgRate = input.MobileMsgRate,
            ValidityMonths = input.ValidityMonths,
            HoursAllowance = input.HoursAllowance,
            SpeedKbps = input.SpeedKbps,
            AdvancePerConnection = input.AdvancePerConnection
        };
        store.Add(plan);
        await store.SaveChangesAsync();
        return ToView(plan);
    }

    public async Task<PlanView> UpdatePlanAsync(int id, PlanInput input)
    {
        ValidatePrice(input.Price);
        ValidatePrice(input.LocalCallRate);
        ValidatePrice(input.StdCallRate);
        ValidatePrice(input.MobileMsgRate);
        ValidateValidityMonths(input.ValidityMonths);
        if (input.AdvancePerConnection is { } advance) ValidatePrice(advance);
        var plan = await FindPlanAsync(id);
        plan.Name = input.Name.Trim();
        plan.Type = input.Type;
        plan.Description = input.Description?.Trim() ?? "";
        plan.Price = input.Price;
        plan.Active = input.Active;
        plan.LocalCallRate = input.LocalCallRate;
        plan.StdCallRate = input.StdCallRate;
        plan.MobileMsgRate = input.MobileMsgRate;
        plan.ValidityMonths = input.ValidityMonths;
        plan.HoursAllowance = input.HoursAllowance;
        plan.SpeedKbps = input.SpeedKbps;
        plan.AdvancePerConnection = input.AdvancePerConnection;
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
        ValidatePrice(input.ReplacementPrice);
        if (input.QuantityInStock < 0)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Quantity in stock cannot be negative.");
        var product = new Product
        {
            Name = input.Name.Trim(),
            Description = input.Description?.Trim() ?? "",
            Active = input.Active,
            QuantityInStock = input.QuantityInStock,
            ReplacementPrice = input.ReplacementPrice
        };
        store.Add(product);
        await store.SaveChangesAsync();
        return ToView(product);
    }

    public async Task<ProductView> UpdateProductAsync(int id, ProductInput input)
    {
        ValidatePrice(input.ReplacementPrice);
        if (input.QuantityInStock < 0)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Quantity in stock cannot be negative.");
        var product = await FindProductAsync(id);
        product.Name = input.Name.Trim();
        product.Description = input.Description?.Trim() ?? "";
        product.Active = input.Active;
        product.QuantityInStock = input.QuantityInStock;
        product.ReplacementPrice = input.ReplacementPrice;
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
        if (price < 0m)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Price and rates cannot be negative.");
        if (decimal.Round(price, 2) != price)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Enter a price with up to two decimal places.");
    }

    private static void ValidateValidityMonths(int validityMonths)
    {
        if (validityMonths is not (1 or 3 or 6 or 12))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "ValidityMonths must be 1, 3, 6, or 12.");
    }

    private static PlanView ToView(ServicePlan plan) =>
        new(plan.Id, plan.Name, plan.Type, plan.Description, plan.Price, plan.Active,
            plan.LocalCallRate, plan.StdCallRate, plan.MobileMsgRate,
            plan.ValidityMonths, plan.HoursAllowance, plan.SpeedKbps, plan.AdvancePerConnection);

    private static ProductView ToView(Product product) =>
        new(product.Id, product.Name, product.Description, product.Active, product.QuantityInStock, product.ReplacementPrice);
}
