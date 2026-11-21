namespace Nexus.Domain;

/// <summary>Categorizes domain invariant violations for HTTP status mapping.</summary>
public enum DomainRuleFailure { InvalidInput, InvalidState }

/// <summary>Exception thrown when an aggregate invariant or state transition rule is violated.</summary>
public sealed class DomainRuleException(DomainRuleFailure failure, string message) : Exception(message)
{
    public DomainRuleFailure Failure { get; } = failure;
}
