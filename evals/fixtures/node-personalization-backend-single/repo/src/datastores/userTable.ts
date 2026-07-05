import { register, type PersonalDataStore } from '../consent/registry';

// Primary user table — email, display name, hashed password. Registers
// with the consent registry so export/erasure requests reach it.
class UserTable implements PersonalDataStore {
  name = 'userTable';
  private rows = new Map<string, { email: string; displayName: string }>();

  async exportUser(tenant: string, user: string) {
    return this.rows.get(`${tenant}:${user}`) ?? {};
  }

  async eraseUser(tenant: string, user: string) {
    this.rows.delete(`${tenant}:${user}`);
  }
}

export const userTable = new UserTable();
register(userTable);
