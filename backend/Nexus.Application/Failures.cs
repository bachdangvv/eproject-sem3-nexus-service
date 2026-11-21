namespace Nexus.Application;

/// <summary>Application-layer error categories mapped to HTTP status codes.</summary>
public enum UseCaseFailure { InvalidInput, NotFound, Conflict, Unauthorized, Forbidden }

/// <summary>Exception raised when an application use case fails validation, lookup, or state checks.</summary>
public sealed class UseCaseException(UseCaseFailure failure, string? message = null) : Exception(message)
{
    public UseCaseFailure Failure { get; } = failure;
}

/// <summary>Exception wrapping EF Core persistence or optimistic concurrency conflicts.</summary>
public sealed class StoreWriteException(bool concurrentChange, Exception innerException)
    : Exception("The changes could not be saved.", innerException)
{
    public bool ConcurrentChange { get; } = concurrentChange;
}

/// <summary>Wraps idempotent create-or-return results indicating whether a new entity was created.</summary>
public sealed record Creation<T>(T Value, bool Created);
