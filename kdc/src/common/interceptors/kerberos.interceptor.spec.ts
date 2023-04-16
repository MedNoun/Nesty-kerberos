import { KerberosInterceptor } from './kerberos.interceptor';

describe('EncryptorInterceptor', () => {
  it('should be defined', () => {
    expect(new KerberosInterceptor()).toBeDefined();
  });
});
