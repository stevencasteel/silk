export class WardenStateMachine {
  private activeState: string = "DORMANT";

  public setWardenState(state: string): void {
    this.activeState = state;
  }

  public getActiveState(): string {
    return this.activeState;
  }
}
