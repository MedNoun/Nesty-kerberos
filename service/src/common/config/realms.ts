import { CryptoService } from '../crypto/crypto.service';

const cryptoService: CryptoService = new CryptoService();
export default () => ({
  insat: {
    lifetimeInterval: { min: 2 * 60 * 60 * 1000, max: 10 * 60 * 60 * 1000 },
    principals: new Map<string, string>([
      ['as@insat', cryptoService.genKey(32)],
      ['tgs@insat', cryptoService.genKey(32)],
      [
        'service_1@insat',
        '2f6adf42a50755fa690f481b26e1759f005311e47439c7c7b4505df9ebee4ddc',
      ],
      ['service_2@insat', cryptoService.genKey(32)],
    ]),
  },
  enit: {
    lifetimeInterval: { min: 2 * 60 * 60 * 1000, max: 10 * 60 * 60 * 1000 },
    principals: new Map<string, string>([
      ['as@enit', cryptoService.genKey(32)],
      ['tgs@enit', cryptoService.genKey(32)],
      ['service_1@enit', cryptoService.genKey(32)],
      ['service_2@enit', cryptoService.genKey(32)],
    ]),
  },
});
