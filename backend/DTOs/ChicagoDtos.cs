using System.Text.Json.Serialization;

namespace Backend.DTOs;

public class ChicagoActionRequest
{
    [JsonPropertyName("newStateJson")]
    public string? NewStateJson { get; set; }
}
