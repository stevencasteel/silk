import { EntityId } from "./Entity";
import { IComponentStore, IEntityRefs } from "../../contracts/ICore";
import { TagComponent } from "./Components";

export class EntityRefs implements IEntityRefs {
  private _player: EntityId = -1;
  private _weaver: EntityId = -1;

  constructor(private tags: IComponentStore<TagComponent>) {}

  public get player(): EntityId {
    if (this._player !== -1 && this.tags.has(this._player)) return this._player;
    for (const [id, tag] of this.tags.entries()) {
      if (tag.type === "player") {
        this._player = id;
        return id;
      }
    }
    return -1;
  }

  public set player(id: EntityId) {
    this._player = id;
  }

  public get weaver(): EntityId {
    if (this._weaver !== -1 && this.tags.has(this._weaver)) return this._weaver;
    for (const [id, tag] of this.tags.entries()) {
      if (tag.type === "weaver") {
        this._weaver = id;
        return id;
      }
    }
    return -1;
  }

  public set weaver(id: EntityId) {
    this._weaver = id;
  }
}
