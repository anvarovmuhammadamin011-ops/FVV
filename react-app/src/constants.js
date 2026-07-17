// =============================================
// FVV ANDIJON – MONITORING TIZIMI v2 (React port)
// =============================================

export const APP_VERSION = '20260430-district-rating-fix';

export const DISTRICTS = [
  { id: 'viloyat', name: 'Andijon viloyati', scope: 'region' },
  { id: 'andijon-shahar', name: 'Andijon shahar', scope: 'district' },
  { id: 'andijon-tuman', name: 'Andijon tuman', scope: 'district' },
  { id: 'asaka', name: 'Asaka', scope: 'district' },
  { id: 'baliqchi', name: 'Baliqchi', scope: 'district' },
  { id: 'boz', name: 'Bo‘z', scope: 'district' },
  { id: 'buloqboshi', name: 'Buloqboshi', scope: 'district' },
  { id: 'izboskan', name: 'Izboskan', scope: 'district' },
  { id: 'jalakuduk', name: 'Jalaquduq', scope: 'district' },
  { id: 'xojabod', name: 'Xo‘jaobod', scope: 'district' },
  { id: 'marhamat', name: 'Marhamat', scope: 'district' },
  { id: 'oltinkol', name: 'Oltinko‘l', scope: 'district' },
  { id: 'paxtaobod', name: 'Paxtaobod', scope: 'district' },
  { id: 'qorgontepa', name: 'Qo‘rg‘ontepa', scope: 'district' },
  { id: 'shahrixon', name: 'Shahrixon', scope: 'district' },
  { id: 'ulugnor', name: 'Ulug‘nor', scope: 'district' },
  { id: 'xonobod', name: 'Xonobod shahar', scope: 'district' },
];

export function buildUsers() {
  const users = {
    viloyat: {
      admin: { pass: '111223', role: 'region', name: 'Andijon viloyati', district: 'viloyat' }
    }
  };

  DISTRICTS.filter(d => d.scope === 'district').forEach(district => {
    users[district.id] = {
      admin: { pass: '111223', role: 'admin', name: `${district.name} boshliq`, district: district.id }
    };
    for (let i = 1; i <= 8; i++) {
      users[district.id][`ishchi${i}`] = {
        pass: '122333',
        role: 'inspektor',
        name: `${district.name} - Inspektor ${i}`,
        district: district.id
      };
    }
  });

  return users;
}

export const USERS = buildUsers();

export function districtNameById(id) {
  const found = DISTRICTS.find(d => d.id === id);
  return found ? found.name : id;
}
