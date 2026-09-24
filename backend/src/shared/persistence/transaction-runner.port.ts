export abstract class TransactionRunnerPort {
  abstract run<T>(fn: () => Promise<T>): Promise<T>;
}
