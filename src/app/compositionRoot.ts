export class CompositionRoot {
  private services = new Map<string, any>();

  public register(token: string, instance: any): void {
    this.services.set(token, instance);
  }

  public resolve<T>(token: string): T {
    const service = this.services.get(token);
    if (!service) {
      throw new Error(`Service token not found: ${token}`);
    }
    return service as T;
  }
}
