"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinakDeskControlPlatform = void 0;
const constants_1 = require("./constants");
const deskbluez = __importStar(require("deskbluez"));
const AbstractDesk_1 = require("deskbluez/dist/desks/AbstractDesk");
class LinakDeskControlPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.api = api;
        // public readonly Service: typeof Service = this.api.hap.Service;
        // public readonly Characteristic: typeof Characteristic =
        //   this.api.hap.Characteristic;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.config = config;
        this.bluetooth = new deskbluez.Bluetooth();
        this.log.debug("Finished initializing platform:", this.config.name);
        this.log.debug("Desks:", JSON.stringify(this.config.desks));
        this.api.on("didFinishLaunching", this.didFinishLaunching.bind(this));
    }
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory) {
        this.log.info("Loading accessory from cache:", accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    didFinishLaunching() {
        this.log.debug("Executed didFinishLaunching callback");
        this.config.desks.forEach((desk) => {
            const uuid = this.api.hap.uuid.generate(desk.address);
            this.log.debug("Linak Desk:", JSON.stringify({ ...desk, uuid }));
            let accessory = this.accessories.find((accessory) => accessory.UUID === uuid);
            if (accessory) {
                this.log.info("Restoring existing desk accessory from cache:", accessory.displayName);
                // TODO: this.setupAccessory(accessory); Is this necessary or what is cached?
                this.setupAccessory(accessory);
            }
            else {
                this.log.info("Adding new desk accessory:", desk.name);
                accessory = new this.api.platformAccessory(desk.name, uuid);
                accessory.context = desk;
                this.setupAccessory(accessory);
                this.api.registerPlatformAccessories(constants_1.PLUGIN_NAME, constants_1.PLATFORM_NAME, [
                    accessory,
                ]);
            }
        });
    }
    setupAccessory(accessory) {
        accessory.on("identify" /* IDENTIFY */, () => {
            this.log.info("Identify requested.", accessory.displayName);
        });
        const hap = this.api.hap;
        const accInfo = accessory.getService(hap.Service.AccessoryInformation);
        if (accInfo) {
            accInfo.setCharacteristic(hap.Characteristic.Manufacturer, "Linak");
            accInfo.setCharacteristic(hap.Characteristic.Model, accessory.context.modelName);
            accInfo.setCharacteristic(hap.Characteristic.SerialNumber, accessory.context.address);
            accInfo.setCharacteristic(hap.Characteristic.FirmwareRevision, constants_1.VERSION);
        }
        let service = accessory.getService(hap.Service.WindowCovering);
        if (service) {
            this.log.debug("Removing existing desk service");
            accessory.removeService(service);
        }
        /**
         * Working with blinds, taken from:
         * - https://github.com/dxdc/homebridge-blinds/blob/master/index.js
         * - https://github.com/hjdhjd/homebridge-blinds-cmd/blob/master/src/blindsCmd-blind.ts
         */
        service = new hap.Service.WindowCovering(accessory.context.name);
        // Set initial state
        service
            .getCharacteristic(hap.Characteristic.CurrentPosition)
            .updateValue(42);
        service
            .getCharacteristic(hap.Characteristic.PositionState)
            .updateValue(hap.Characteristic.PositionState.STOPPED);
        service
            .getCharacteristic(hap.Characteristic.ObstructionDetected)
            .updateValue(false);
        // Setup event listeners
        service
            .getCharacteristic(hap.Characteristic.CurrentPosition)
            .on("get", async (callback) => {
            // const desk = await this.connectDesk(accessory.context);
            // const state = await desk.state();
            // await desk.disconnect();
            // callback(null, state.cm);
            callback(null, 60);
        });
        service
            .getCharacteristic(hap.Characteristic.PositionState)
            .on("get", async (callback) => {
            callback(null, hap.Characteristic.PositionState.STOPPED);
        });
        service
            .getCharacteristic(hap.Characteristic.TargetPosition)
            .on("get", (callback) => {
            this.log.info("Get desk target height");
            callback(null, 60);
        })
            .on("set", (value) => {
            this.log.info("Set desk target height:", value.valueOf());
            this.actionMoveTo(accessory, value.valueOf());
        });
        accessory.addService(service);
    }
    /**
     * Code taken largely verbatim from https://github.com/alex20465/deskbluez/blob/master/src/lib/cli.ts
     * TODO: Refactor deskbluez to make these available as a lib instead of defined in CLI
     */
    async actionMoveTo(accessory, pos) {
        const desk = await this.connectDesk(accessory.context);
        const completed = await desk.moveTo(pos, AbstractDesk_1.LENGTH_UNITS.PCT);
        if (completed === false) {
            // if not completed possible resistance detected.
            this.log.warn("Resistance detected, stop action for safety.");
            // const hap = this.api.hap;
            // const service = accessory.getService(this.api.hap.Service.WindowCovering);
            // assert(service);
            // service
            //   .getCharacteristic(hap.Characteristic.PositionState)
            //   .updateValue(hap.Characteristic.PositionState.STOPPED);
        }
    }
    async connectDesk(deskConfig) {
        const model = deskbluez.factory.getDeskModel(deskConfig.modelName);
        this.log.debug("Connecting to desk:", JSON.stringify({ deskConfig, model }));
        await this.bluetooth.init(); // TODO: Do we ever need to specify other adapters?
        await this.bluetooth.startDiscovery();
        const bluetoothDevice = await this.bluetooth.connect(deskConfig.address);
        await this.bluetooth.stopDiscovery();
        const desk = deskbluez.factory.createDesk(model, bluetoothDevice);
        await desk.connect();
        await desk.subscribe();
        return desk;
    }
}
exports.LinakDeskControlPlatform = LinakDeskControlPlatform;
//# sourceMappingURL=platform.js.map