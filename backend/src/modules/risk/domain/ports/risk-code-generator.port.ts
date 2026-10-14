export abstract class RiskCodeGeneratorPort {
  abstract nextCode(year: number): Promise<string>;
}
