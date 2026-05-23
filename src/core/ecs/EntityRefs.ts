import { EntityId } from "./Entity";
import { ComponentStore } from "./ComponentStore";
import { PlayerTag, WeaverTag } from "./Components";

export class EntityRefs {
    private _player: EntityId = -1;
    private _weaver: EntityId = -1;

    constructor(
        private playerTags: ComponentStore<PlayerTag>,
        private weaverTags: ComponentStore<WeaverTag>
    ) {}

    public get player(): EntityId {
        if (this._player !== -1) return this._player;
        for (const [id] of this.playerTags.entries()) {
            return id;
        }
        return -1;
    }

    public set player(id: EntityId) {
        this._player = id;
    }

    public get weaver(): EntityId {
        if (this._weaver !== -1) return this._weaver;
        for (const [id] of this.weaverTags.entries()) {
            return id;
        }
        return -1;
    }

    public set weaver(id: EntityId) {
        this._weaver = id;
    }
}
