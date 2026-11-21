using System.Text;
using System.Text.RegularExpressions;
using Nexus.Application;

namespace Nexus.Api;

/// <summary>Disk-backed document store enforcing extension whitelisting, 10 MB cap, and traversal-safe paths.</summary>
public sealed class LocalDocumentStorage : IDocumentStorage
{
    public const long MaxFileSizeBytes = 10L * 1024 * 1024;
    private const int MaxSanitizedBaseLength = 100;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".csv", ".doc", ".docx"
    };

    private static readonly Dictionary<string, string> ExtensionContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    private readonly string _rootPath;
    private readonly string _rootPrefix;

    public LocalDocumentStorage(IConfiguration configuration, IWebHostEnvironment env)
    {
        var configuredRoot = configuration["DocumentStorage:RootPath"];
        _rootPath = string.IsNullOrWhiteSpace(configuredRoot)
            ? Path.Combine(env.ContentRootPath, "data", "documents")
            : Path.GetFullPath(configuredRoot.Trim());
        _rootPrefix = Path.GetFullPath(_rootPath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
    }

    public async Task<StoredDocumentFile> SaveAsync(
        Stream content,
        string fileName,
        string? contentType,
        int year,
        string cityCode,
        CancellationToken cancellationToken = default)
    {
        if (year < 2000 || year > 2100)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Year must be between 2000 and 2100.");

        var normalizedCity = cityCode?.Trim() ?? "";
        if (!Regex.IsMatch(normalizedCity, "^[0-9]{3}$"))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "CityCode must be a 3-digit code.");

        var rawFileName = Path.GetFileName(fileName?.Trim() ?? "");
        if (string.IsNullOrWhiteSpace(rawFileName))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "A document file is required.");

        var ext = Path.GetExtension(rawFileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Unsupported document file extension.");

        if (content.CanSeek && content.Length == 0)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Uploaded file cannot be empty.");

        if (content.CanSeek && content.Length > MaxFileSizeBytes)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Uploaded file exceeds maximum allowed size of 10 MB.");

        var safeName = BuildSafeFileName(rawFileName, ext);
        var originalName = CleanOriginalFileName(rawFileName, safeName);
        var resolvedContentType = ExtensionContentTypes.GetValueOrDefault(ext, "application/octet-stream");

        var storedFileName = $"{Guid.NewGuid():N}_{safeName}";
        var relativePath = $"{year}/{normalizedCity}/{storedFileName}";
        var fullPath = ResolveSafePath(relativePath)
            ?? throw new UseCaseException(UseCaseFailure.InvalidInput, "Invalid document storage path.");

        var parentDir = Path.GetDirectoryName(fullPath)!;
        Directory.CreateDirectory(parentDir);

        long totalBytes = 0;
        var deletePartial = false;
        try
        {
            await using var target = new FileStream(
                fullPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true);

            var buffer = new byte[81920];
            int bytesRead;
            while ((bytesRead = await content.ReadAsync(buffer, cancellationToken)) > 0)
            {
                totalBytes += bytesRead;
                if (totalBytes > MaxFileSizeBytes)
                {
                    deletePartial = true;
                    throw new UseCaseException(UseCaseFailure.InvalidInput, "Uploaded file exceeds maximum allowed size of 10 MB.");
                }
                await target.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            }

            if (totalBytes == 0)
            {
                deletePartial = true;
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Uploaded file cannot be empty.");
            }

            await target.FlushAsync(cancellationToken);
        }
        catch
        {
            deletePartial = true;
            throw;
        }
        finally
        {
            if (deletePartial && File.Exists(fullPath))
            {
                try { File.Delete(fullPath); }
                catch { /* best effort cleanup */ }
            }
        }

        return new StoredDocumentFile(relativePath, originalName, resolvedContentType, totalBytes);
    }

    public bool Exists(string? relativePath)
    {
        var fullPath = ResolveSafePath(relativePath);
        return fullPath is not null && File.Exists(fullPath);
    }

    public Stream? OpenRead(string? relativePath)
    {
        var fullPath = ResolveSafePath(relativePath);
        if (fullPath is null || !File.Exists(fullPath))
            return null;

        return new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize: 65536, useAsync: true);
    }

    public Task DeleteAsync(string? relativePath, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveSafePath(relativePath);
        if (fullPath is not null && File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
        return Task.CompletedTask;
    }

    /// <summary>Resolves a stored relative path within the configured document root, returning null on traversal.</summary>
    private string? ResolveSafePath(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return null;

        var trimmed = relativePath.Trim();
        if (trimmed.Contains('\0'))
            return null;

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out _))
            return null;

        if (trimmed.StartsWith('/') || trimmed.StartsWith('\\'))
            return null;

        if (Path.IsPathRooted(trimmed))
            return null;

        var segments = trimmed.Split(['/', '\\'], StringSplitOptions.None);
        if (segments.Length == 0)
            return null;

        foreach (var segment in segments)
        {
            if (string.IsNullOrEmpty(segment) || segment == "." || segment == "..")
                return null;
        }

        var normalizedRelative = Path.Combine(segments);
        var candidateFullPath = Path.GetFullPath(Path.Combine(_rootPath, normalizedRelative));
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

        return candidateFullPath.StartsWith(_rootPrefix, comparison) ? candidateFullPath : null;
    }

    private static string BuildSafeFileName(string rawFileName, string ext)
    {
        var rawBase = Path.GetFileNameWithoutExtension(rawFileName);
        var builder = new StringBuilder(rawBase.Length);
        foreach (var ch in rawBase)
        {
            if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-')
            {
                builder.Append(ch);
            }
            else
            {
                builder.Append('_');
            }
        }

        var sanitizedBase = builder.ToString().Trim('.', '_', '-');
        if (string.IsNullOrWhiteSpace(sanitizedBase))
            sanitizedBase = "document";

        if (sanitizedBase.Length > MaxSanitizedBaseLength)
            sanitizedBase = sanitizedBase[..MaxSanitizedBaseLength].TrimEnd('.', '_', '-');

        if (string.IsNullOrWhiteSpace(sanitizedBase))
            sanitizedBase = "document";

        return $"{sanitizedBase}{ext}";
    }

    private static string CleanOriginalFileName(string rawFileName, string fallback)
    {
        var builder = new StringBuilder(rawFileName.Length);
        foreach (var ch in rawFileName)
        {
            if (!char.IsControl(ch) && ch != '/' && ch != '\\')
                builder.Append(ch);
        }

        var cleaned = builder.ToString().Trim();
        if (string.IsNullOrWhiteSpace(cleaned))
            return fallback;

        if (cleaned.Length <= 255)
            return cleaned;

        var ext = Path.GetExtension(cleaned);
        if (ext.Length >= 255)
            return fallback;

        var maxBase = 255 - ext.Length;
        var baseName = Path.GetFileNameWithoutExtension(cleaned);
        return $"{baseName[..Math.Min(baseName.Length, maxBase)]}{ext}";
    }
}
