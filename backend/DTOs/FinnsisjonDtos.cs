using System.Text.Json.Serialization;

namespace Backend.DTOs;

public class FinnsisjonActionRequest
{
    /// <summary>ask | draw</summary>
    [JsonPropertyName("action")]
    public string? Action { get; set; }

    [JsonPropertyName("askTo")]
    public string? AskTo { get; set; }

    [JsonPropertyName("askRank")]
    public string? AskRank { get; set; }

    [JsonPropertyName("drawCardIndex")]
    public int? DrawCardIndex { get; set; }

    [JsonPropertyName("newStateJson")]
    public string? NewStateJson { get; set; }
}
