using System.ComponentModel.DataAnnotations;

namespace Nexus.Application;

public sealed record LoginInput(
    [property: Required, StringLength(40)] string Username,
    [property: Required, StringLength(128)] string Password);

public sealed record EmployeeInput(
    [property: Required, RegularExpression("^[a-zA-Z0-9._-]{3,40}$")] string Username,
    [property: Required, StringLength(100)] string DisplayName,
    [property: Required, StringLength(20)] string Role,
    [property: Required, StringLength(128, MinimumLength = 12)] string Password);

public sealed record CityInput(
    [property: Required, RegularExpression("^[0-9]{3}$")] string Code,
    [property: Required, StringLength(100)] string Name);

public sealed record CustomerInput(
    [property: Required, StringLength(120)] string Name,
    [property: Required, RegularExpression(@"^\+?[0-9]{7,15}$")] string Phone,
    [property: Required, StringLength(240)] string Address,
    [property: Required, RegularExpression("^[0-9]{3}$")] string CityCode);

public sealed record PlanInput(
    [property: Required, StringLength(100)] string Name,
    [property: Required, RegularExpression("^[DBT]$")] string Type,
    [property: StringLength(240)] string? Description,
    [property: Range(typeof(decimal), "0", "9999999999.99")] decimal Price,
    bool Active);

public sealed record ProductInput(
    [property: Required, StringLength(100)] string Name,
    [property: StringLength(240)] string? Description,
    bool Active);

public sealed record RequestInput(
    [property: Range(1, int.MaxValue)] int CustomerId,
    [property: Range(1, int.MaxValue)] int PlanId,
    bool HasNexusLandline);

public sealed record AssessmentInput(
    [property: Required] bool? DistanceOk,
    [property: Required] bool? ServerAvailable,
    bool? LandlineFeasible,
    [property: StringLength(500)] string? Note);

public sealed record FeedbackInput(
    [property: Range(1, 5)] int Rating,
    [property: Required, StringLength(600)] string Comment);
