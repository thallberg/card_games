using System.Text.Json.Serialization;

namespace Backend.DTOs;

public class SkitgubbeActionRequest
{
    [JsonPropertyName("newStateJson")]
    public string? NewStateJson { get; set; }
}
