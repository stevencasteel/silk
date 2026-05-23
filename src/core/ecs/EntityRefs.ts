import { EntityId } from "./Entity";
import { ComponentStore } from "./ComponentStore";
import { PlayerTag, WardenTag, AnchorTag } from "./Components";

export class EntityRefs {
    private _player: EntityId = -1;
    private _warden: EntityId = -1;
    private _anchor: EntityId = -1;

    constructor(
        private playerTags: ComponentStore<PlayerTag>,
        private wardenTags: ComponentStore<WardenTag>,
        private anchorTags: ComponentStore<AnchorTag>
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

    public get warden(): EntityId {
        if (this._warden !== -1) return this._warden;
        for (const [id] of this.wardenTags.entries()) {
            return id;
        }
        return -1;
    }

    public set warden(id: EntityId) {
        this._warden = id;
    }

    public get anchor(): EntityId {
        if (this._anchor !== -1) return this._anchor;
        for (const [id] of this.anchorTags.entries()) {
            return id;
        }
        return -1;
    }

    public set anchor(id: EntityId) {
        this._anchor = id;
    }
}
