import { EntityId } from "./Entity";
import { IComponentStore, IEntityRefs } from "../../contracts/ICore";
import { PlayerTag, WeaverTag } from "./Components";

export class EntityRefs implements IEntityRefs {
  private _player: EntityId = -1;
  private _weaver: EntityId = -1;

  constructor(
    private playerTags: IComponentStore<PlayerTag>,
    private weaverTags: IComponentStore<WeaverTag>
  ) {}

  public get player(): EntityId {
    if (this._player !== -1 && this.playerTags.has(this._player)) return this._player;
    for (const [id] of this.playerTags.entries()) {
      this._player = id;
      return id;
    }
    return -1;
  }

  public set player(id: EntityId) {
    this._player = id;
  }

  public get weaver(): EntityId {
    if (this._weaver !== -1 && this.weaverTags.has(this._weaver)) return this._weaver;
    for (const [id] of this.weaverTags.entries()) {
      this._weaver = id;
      return id;
    }
    return -1;
  }

  public set weaver(id: EntityId) {
    this._weaver = id;
  }
}
