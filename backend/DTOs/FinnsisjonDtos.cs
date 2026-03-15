using System.Text.Json.Serialization;

namespace Backend.DTOs;

public class FinnsisjonActionRequest
{
    [JsonPropertyName("newStateJson")]
    public string? NewStateJson { get; set; }
}
