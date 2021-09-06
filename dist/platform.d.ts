import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from "homebridge";
import * as deskbluez from "deskbluez";
interface DeskConfig {
    name: string;
    address: string;
    modelName: string;
}
interface LinakDeskControlPlatformConfig extends PlatformConfig {
    desks: DeskConfig[];
}
export declare type LinakDeskPlatformAccessory = PlatformAccessory<DeskConfig>;
export declare class LinakDeskControlPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly api: API;
    readonly accessories: LinakDeskPlatformAccessory[];
    readonly config: LinakDeskControlPlatformConfig;
    readonly bluetooth: deskbluez.Bluetooth;
    constructor(log: Logger, config: PlatformConfig, api: API);
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: LinakDeskPlatformAccessory): void;
    didFinishLaunching(): void;
    setupAccessory(accessory: LinakDeskPlatformAccessory): void;
    /**
     * Code taken largely verbatim from https://github.com/alex20465/deskbluez/blob/master/src/lib/cli.ts
     * TODO: Refactor deskbluez to make these available as a lib instead of defined in CLI
     */
    private connectDesk;
}
export {};
//# sourceMappingURL=platform.d.ts.map