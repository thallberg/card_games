namespace Backend.DTOs;

public record TexasHoldemActionRequest(string Action, int? Amount = null, string? StateJson = null);
