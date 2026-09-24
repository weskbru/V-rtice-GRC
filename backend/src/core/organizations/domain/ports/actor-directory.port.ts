export abstract class ActorDirectoryPort {
  abstract findActorLabel(userId: string): Promise<string | undefined>;
}
