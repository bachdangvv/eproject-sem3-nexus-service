using Microsoft.AspNetCore.Diagnostics;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api;

public sealed class ApiExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception switch
        {
            DomainRuleException { Failure: DomainRuleFailure.InvalidInput } => StatusCodes.Status400BadRequest,
            DomainRuleException { Failure: DomainRuleFailure.InvalidState } => StatusCodes.Status409Conflict,
            UseCaseException { Failure: UseCaseFailure.InvalidInput } => StatusCodes.Status400BadRequest,
            UseCaseException { Failure: UseCaseFailure.NotFound } => StatusCodes.Status404NotFound,
            UseCaseException { Failure: UseCaseFailure.Conflict } => StatusCodes.Status409Conflict,
            UseCaseException { Failure: UseCaseFailure.Unauthorized } => StatusCodes.Status401Unauthorized,
            _ => 0
        };
        if (status == 0) return false;

        var response = status == StatusCodes.Status404NotFound
            ? Results.NotFound()
            : Results.Problem(exception.Message, statusCode: status);
        await response.ExecuteAsync(context);
        return true;
    }
}
