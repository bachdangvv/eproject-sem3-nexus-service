namespace Nexus.Application;

/// <summary>Metadata describing a customer document persisted to disk.</summary>
public sealed record StoredDocumentFile(
    string RelativePath,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes);

/// <summary>Abstraction for safe, sandboxed local storage of uploaded customer documents.</summary>
public interface IDocumentStorage
{
    /// <summary>Validates and writes an uploaded document stream under <c>year/cityCode</c>.</summary>
    Task<StoredDocumentFile> SaveAsync(
        Stream content,
        string fileName,
        string? contentType,
        int year,
        string cityCode,
        CancellationToken cancellationToken = default);

    /// <summary>Checks whether a stored relative path exists inside the document root.</summary>
    bool Exists(string? relativePath);
    /// <summary>Opens a read stream for an existing stored relative path.</summary>
    Stream? OpenRead(string? relativePath);
    /// <summary>Deletes a stored document file if present.</summary>
    Task DeleteAsync(string? relativePath, CancellationToken cancellationToken = default);
}
