export class EvaluationServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "EvaluationServiceError";
    this.status = status;
  }
}
