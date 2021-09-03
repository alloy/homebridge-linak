import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, PlatformAccessoryEvent } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

import * as deskbluez from 'deskbluez';

interface DeskConfig {
  name: string;
  address: string;
  modelName: string;
}

interface LinakDeskControlPlatformConfig extends PlatformConfig {
  desks: DeskConfig[];
}

export type LinakDeskPlatformAccessory = PlatformAccessory<DeskConfig>;


export class LinakDeskControlPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: LinakDeskPlatformAccessory[] = [];

  public readonly config: LinakDeskControlPlatformConfig;
  public readonly bluetooth: deskbluez.Bluetooth;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.config = config as LinakDeskControlPlatformConfig;
    this.bluetooth = new deskbluez.Bluetooth();
    this.log.debug('Finished initializing platform:', this.config.name);
    this.log.debug('Desks:', JSON.stringify(this.config.desks));
    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: LinakDeskPlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  // When this event is fired it means Homebridge has restored all cached accessories from disk.
  // Dynamic Platform plugins should only register new accessories after this event was fired,
  // in order to ensure they weren't added to homebridge already. This event can also be used
  // to start discovery of new accessories.
  didFinishLaunching() {
    this.log.debug('Executed didFinishLaunching callback');

    this.config.desks.forEach(desk => {
      const uuid = this.api.hap.uuid.generate(desk.address);
      this.log.debug('Linak Desk:', JSON.stringify({ ...desk, uuid }));
      let accessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (accessory) {
        this.log.info('Restoring existing desk accessory from cache:', accessory.displayName);
        // TODO: this.setupAccessory(accessory); Is this necessary or what is cached?
        this.setupAccessory(accessory);
      } else {
        this.log.info('Adding new desk accessory:', desk.name);
        accessory = new this.api.platformAccessory<DeskConfig>(desk.name, uuid);
        accessory.context = desk;
        this.setupAccessory(accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    });
  }

  setupAccessory(accessory: LinakDeskPlatformAccessory) {
    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log.info('Identify requested.', accessory.displayName);
    });

    const hap = this.api.hap;

    const accInfo = accessory.getService(hap.Service.AccessoryInformation);
    if (accInfo) {
      accInfo.setCharacteristic(hap.Characteristic.Manufacturer, 'Linak');
      accInfo.setCharacteristic(hap.Characteristic.Model, accessory.context.modelName);
      accInfo.setCharacteristic(hap.Characteristic.SerialNumber, accessory.context.address);
      accInfo.setCharacteristic(hap.Characteristic.FirmwareRevision, 'REPLACE WITH VERSION');
    }

    let service = accessory.getService(hap.Service.WindowCovering);
    if (service) {
      this.log.debug('Removing existing desk service');
      accessory.removeService(service);
    }

    /**
     * Working with blinds, taken from https://github.com/dxdc/homebridge-blinds/blob/master/index.js
     */
    service = new hap.Service.WindowCovering(accessory.context.name);
    service.getCharacteristic(hap.Characteristic.CurrentPosition).on('get', async (callback) => {
      // const desk = await this.connectDesk(accessory.context);
      // const state = await desk.state();
      // await desk.disconnect();
      // callback(null, state.cm);
      callback(null, 60);
    });
    service
      .getCharacteristic(hap.Characteristic.TargetPosition)
      .on('get', (callback) => {
        this.log.info('Get desk target height');
        callback(null, 60);
      })
      .on('set', (value) => {
        this.log.info('Set desk target height:', value.valueOf());
      });
    service.getCharacteristic(hap.Characteristic.PositionState).updateValue(hap.Characteristic.PositionState.STOPPED);
    service.getCharacteristic(hap.Characteristic.ObstructionDetected).updateValue(false);
  }

  /**
   * Code taken largely verbatim from https://github.com/alex20465/deskbluez/blob/master/src/lib/cli.ts
   * TODO: Refactor deskbluez to make these available as a lib instead of defined in CLI
   */

  private async connectDesk(deskConfig: DeskConfig) {
    const model = deskbluez.factory.getDeskModel(deskConfig.modelName);
    this.log.debug('Connecting to desk:', JSON.stringify({ deskConfig, model }));
    await this.bluetooth.startDiscovery();
    const bluetoothDevice = await this.bluetooth.connect(deskConfig.address);
    await this.bluetooth.stopDiscovery();
    const desk = deskbluez.factory.createDesk(model, bluetoothDevice);

    await desk.connect();
    await desk.subscribe();

    return desk;
  }
}
