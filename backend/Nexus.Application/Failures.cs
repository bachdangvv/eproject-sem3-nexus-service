namespace Nexus.Application;

public enum UseCaseFailure { InvalidInput, NotFound, Conflict, Unauthorized }

public sealed class UseCaseException(UseCaseFailure failure, string? message = null) : Exception(message)
{
    public UseCaseFailure Failure { get; } = failure;
}

public sealed class StoreWriteException(bool concurrentChange, Exception innerException)
    : Exception("The changes could not be saved.", innerException)
{
    public bool ConcurrentChange { get; } = concurrentChange;
}

public sealed record Creation<T>(T Value, bool Created);
