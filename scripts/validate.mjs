// 仕様（カタログとテナント設定）を検証する。エラーがあれば終了コード 1。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { CATALOG_PATH, ROOT, flattenCatalog, loadSpec, normalizeSetting, rel } from './lib.mjs';

const errors = [];
const warnings = [];
const error = (path, message) => errors.push(`${rel(path)}: ${message}`);
const warn = (path, message) => warnings.push(`${rel(path)}: ${message}`);

const ajv = new Ajv2020({ allErrors: true });
const loadSchema = (name) => ajv.compile(JSON.parse(readFileSync(join(ROOT, 'schema', name), 'utf8')));
const validateCatalogSchema = loadSchema('catalog.schema.json');
const validateTenantSchema = loadSchema('tenant.schema.json');

const schemaErrors = (path, validate, data) => {
  if (validate(data)) return false;
  for (const e of validate.errors) error(path, `スキーマ違反 ${e.instancePath || '/'} ${e.message}`);
  return true;
};

const { catalog, tenants } = loadSpec();

if (schemaErrors(CATALOG_PATH, validateCatalogSchema, catalog)) {
  // カタログが壊れているとテナントを検証できないので、ここで止める
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const { rows, features } = flattenCatalog(catalog);
const seen = new Set();
for (const row of rows) {
  if (seen.has(row.id)) error(CATALOG_PATH, `ID が重複しています: ${row.id}`);
  seen.add(row.id);
}
for (const [id, feature] of features) {
  if (feature.optionalField && !catalog.optional_fields[feature.optionalField]) {
    error(CATALOG_PATH, `${id}: 未定義の任意項目 ${feature.optionalField} を参照しています`);
  }
}

const tenantIds = new Set();
for (const { path, stem, data: tenant } of tenants) {
  if (schemaErrors(path, validateTenantSchema, tenant)) continue;

  if (tenant.id !== stem) error(path, `id (${tenant.id}) をファイル名 (${stem}) と一致させてください`);
  if (tenantIds.has(tenant.id)) error(path, `テナント id が重複しています: ${tenant.id}`);
  tenantIds.add(tenant.id);

  const definedFields = tenant.optional_fields ?? {};
  for (const field of Object.keys(definedFields)) {
    if (!catalog.optional_fields[field]) error(path, `プロダクトに存在しない任意項目です: ${field}`);
  }

  const settings = tenant.features ?? {};
  const isEnabled = (id) => {
    const feature = features.get(id);
    if (feature.parentId && !isEnabled(feature.parentId)) return false;
    return feature.toggle === 'required' || normalizeSetting(settings[id])?.enabled === true;
  };

  const usedFields = new Set();
  for (const [id, value] of Object.entries(settings)) {
    const feature = features.get(id);
    if (!feature) {
      error(path, `存在しない機能IDです: ${id}`);
      continue;
    }
    if (feature.toggle === 'required') {
      error(path, `${id} は必須機能のため、テナント側では指定しません`);
      continue;
    }
    const setting = normalizeSetting(value);
    if (feature.parentId && setting.enabled && !isEnabled(feature.parentId)) {
      error(path, `${id} を ON にするには親機能 ${feature.parentId} を ON にする必要があります`);
    }
    if (!setting.enabled) {
      if (Object.keys(setting.params).length) error(path, `${id} は OFF のため params は指定できません`);
      continue;
    }
    for (const [key, param] of Object.entries(feature.params)) {
      const given = setting.params[key];
      if (param.required && !given) error(path, `${id}: ${param.label}（params.${key}）が必要です`);
      if (given && param.max_length && [...given].length > param.max_length) {
        error(path, `${id}: params.${key} は ${param.max_length} 文字以内にしてください`);
      }
    }
    for (const key of Object.keys(setting.params)) {
      if (!feature.params[key]) error(path, `${id}: 未定義の params.${key} です`);
    }
  }

  for (const [id, feature] of features) {
    if (!feature.optionalField || !isEnabled(id)) continue;
    usedFields.add(feature.optionalField);
    if (!definedFields[feature.optionalField]) {
      error(path, `${id} を使うには optional_fields.${feature.optionalField} の定義が必要です`);
    }
  }
  for (const field of Object.keys(definedFields)) {
    if (!usedFields.has(field)) warn(path, `optional_fields.${field} はどの機能でも使われていません`);
  }

  for (const { feature } of tenant.customizations ?? []) {
    if (!features.has(feature)) error(path, `customizations: 存在しない機能IDです: ${feature}`);
  }
}

report();

function report() {
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) {
    console.error(`\n${errors.length} 件のエラーがあります`);
    process.exit(1);
  }
  console.log(`OK: 機能 ${features.size} 件 / テナント ${tenants.length} 件`);
  process.exit(0);
}
