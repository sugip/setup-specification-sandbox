// dist/ に一覧ページと、テナントごとの解決済み設定値（全機能の最終状態）を出力する。
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, flattenCatalog, loadSpec, rel, resolveTenant } from './lib.mjs';

const DIST = join(ROOT, 'dist');

const { catalog, tenants } = loadSpec();
const { rows, features } = flattenCatalog(catalog);

const resolvedTenants = tenants.map(({ data: tenant }) => ({
  id: tenant.id,
  name: tenant.name,
  description: tenant.description,
  optionalFields: tenant.optional_fields ?? {},
  customizations: tenant.customizations ?? [],
  features: resolveTenant(features, tenant),
}));

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'tenants'), { recursive: true });

for (const tenant of resolvedTenants) {
  const out = join(DIST, 'tenants', `${tenant.id}.json`);
  writeFileSync(out, `${JSON.stringify(tenant, null, 2)}\n`);
  console.log(`wrote ${rel(out)}`);
}

const data = {
  generatedAt: new Date().toISOString(),
  optionalFields: catalog.optional_fields,
  rows,
  tenants: resolvedTenants,
};
// </script> で埋め込みが途切れないようにエスケープする
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = readFileSync(join(ROOT, 'viewer/index.html'), 'utf8').replace('/*__SPEC_DATA__*/null', () => json);
const out = join(DIST, 'index.html');
writeFileSync(out, html);
console.log(`wrote ${rel(out)}`);
