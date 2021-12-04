import _ from 'lodash';
import Fs from 'fs-extra';
import Axios from 'axios';
import { decode } from 'js-base64';
import { _log, _err, _setFailed } from './utils/log';
import { MClient, MClientOptions } from './m/client';
import { WClient, WClientOptions } from './w/client';
import { PartialDeep } from './@types';

export type Config = PartialDeep<{
  m: MClientOptions[];
  w: WClientOptions[];
  cids: string[];
}>;

_.templateSettings.interpolate = /{{([\s\S]+?)}}/g;

const DEFAULT_CID_LIST = [decode('MTAwODA4ZmM0MzlkZWRiYjA2Y2E1ZmQ4NTg4NDhlNTIxYjg3MTY=')];

const getConfig = async (): Promise<Config> => {
  let config = {};
  if (process.env.CONFIG_URL) {
    try {
      const { data } = await Axios.get(process.env.CONFIG_URL);
      config = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e: any) {
      _err('CONFIG_URL 配置错误', e.toString());
    }
  } else if (Fs.existsSync('config.json')) {
    try {
      config = Fs.readJsonSync('config.json');
    } catch (e: any) {
      _err('config.json 格式错误', e.toString());
    }
  }
  return config;
};

(async () => {
  const config = await getConfig();

  // M
  const mConfig = config.m || [];
  if (mConfig.length) {
    for (const [i, config] of Object.entries(mConfig)) {
      _log(`\nM[${i}]`);
      if (!config || (typeof config !== 'string' && !config.cookie)) continue;
      const mClient = new MClient(config);
      await mClient.gsSignIn();
      await mClient.earnCoin();
    }
  }

  // W
  const wConfig = config.w || [];
  const wCids = [...DEFAULT_CID_LIST, ...(config.cids || [])];
  if (wConfig.length) {
    await WClient.fetchGiftListMap(wCids);
    for (const [i, config] of Object.entries(wConfig)) {
      _log(`\nW[${i}]`);
      if (!config?.alc) {
        _setFailed();
        _err('未提供 ALC，请查看 README 并更新配置');
        continue;
      }
      const wClient = new WClient(config);
      await wClient.signInAndGetGift(i);
    }
  }

  _log();
})();
