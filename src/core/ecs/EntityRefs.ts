import { EntityId } from "./Entity";
import { ComponentStore } from "./ComponentStore";
import { PlayerTag, SpiderTag, AnchorTag } from "./Components";

export class EntityRefs {
    private _player: EntityId = -1;
    private _spider: EntityId = -1;
    private _anchor: EntityId = -1;

    constructor(
        private playerTags: ComponentStore<PlayerTag>,
        private spiderTags: ComponentStore<SpiderTag>,
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

    public get spider(): EntityId {
        if (this._spider !== -1) return this._spider;
        for (const [id] of this.spiderTags.entries()) {
            return id;
        }
        return -1;
    }

    public set spider(id: EntityId) {
        this._spider = id;
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
