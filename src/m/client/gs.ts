import Axios, { AxiosInstance } from 'axios';
import { ds } from '../ds';
import { _log, _warn, _err, _setFailed } from '../../utils/log';
import { retryAsync } from '../../utils/retry';
import { mConsts } from '../../utils/const';
import { maskId } from '../../utils/mask';
import { dvid } from '../dvid';

export interface MGSRole {
  region: string;
  game_uid: string;
  region_name: string;
}

export class MGSClient {
  protected axios: AxiosInstance;

  constructor(cookie: string, ua?: string) {
    this.axios = Axios.create({
      timeout: 10000,
      baseURL: mConsts[1],
      headers: {
        [mConsts[2]]: dvid(),
        [mConsts[3]]: '5',
        [mConsts[4]]: '2.34.1',
        'user-agent': ua || mConsts[5],
        cookie,
      },
    });
  }

  async getRoles(): Promise<MGSRole[]> {
    try {
      return await retryAsync(
        () =>
          this.axios.get<{ data?: { list?: MGSRole[] } }>(mConsts[9]).then(({ data }) => {
            const list = data?.data?.list;
            if (!list) {
              _setFailed();
              _err(JSON.stringify(data));
              return [] as MGSRole[];
            }
            return list;
          }),
        e => _warn('角色信息请求失败，进行重试', e.toString()),
      );
    } catch (e: any) {
      _setFailed();
      _err('角色信息请求失败', e.toString());
      return [] as MGSRole[];
    }
  }

  async signIn({ region, game_uid: uid, region_name }: MGSRole) {
    const act_id = mConsts[0];
    try {
      await retryAsync(
        () =>
          this.axios
            .post<{ retcode: number; data: { success: number } }>(
              mConsts[10],
              { act_id, region, uid },
              {
                headers: {
                  ds: ds(true),
                  origin: mConsts[6],
                  referer: `${mConsts[7]}${act_id}${mConsts[8]}`,
                },
              },
            )
            .then(({ data }) => {
              (() => {
                switch (data.retcode) {
                  case 0:
                    if (data.data.success !== 0) {
                      _setFailed();
                      _err('由于风控，签到请求失败，请查看 README');
                      return _err;
                    }
                    return _log;
                  case -5003:
                    return _warn;
                  default:
                    _setFailed();
                    return _err;
                }
              })()(maskId(uid), region_name, JSON.stringify(data));
            }),
        e => _warn('签到请求失败，进行重试', e.toString()),
      );
    } catch (e: any) {
      _setFailed();
      _err(maskId(uid), region_name, '签到请求失败', e.toString());
    }
  }
}
